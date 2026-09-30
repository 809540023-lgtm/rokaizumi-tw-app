#!/usr/bin/env node
/**
 * 面膜照片本機代理：Google 雲端 → ろかいずみ網站。
 *
 * 為什麼需要這支程式？
 *   網站跑在 Render（雲端），沒辦法讀你電腦上的 Google 雲端硬碟；
 *   而你的電腦已經用 rclone 授權過那個雲端硬碟了。
 *   所以讓「本機」負責抓檔案，「網站」負責辨識與上架。
 *
 * 它做四件事：
 *   1. 用 rclone 把雲端資料夾抓到本機暫存目錄
 *   2. 用 macOS 內建的 sips 縮圖（省流量、也省資料庫空間）
 *   3. 用檔名判斷照片角色（正面／背面成分／外盒／質地）
 *   4. POST 到網站的 /api/mask-agent/sync，順便跑 AI 辨識與上架流程
 *
 * 用法：
 *   node mask-agent.mjs --folder "MaskBridge/面膜/2026-09-30" --brand LuLuLun --supplier-jpy 320
 *   node mask-agent.mjs --folder "MaskBridge/面膜" --per-subfolder      # 每個子資料夾＝一個商品
 *   node mask-agent.mjs --folder "..." --dry-run                        # 只看會做什麼，不上傳
 *
 * 零依賴：只用 Node 內建模組 + rclone + sips（macOS 內建）。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const CONFIG_PATH = path.join(SCRIPT_DIR, "config.json");

/* ------------------------------------------------------------------ */
/* 參數                                                                */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = {
    folder: null,
    brand: null,
    nameZh: null,
    supplierJpy: null,
    qty: 600,
    moq: null,
    stock: null,
    hint: null,
    site: null,
    token: null,
    perSubfolder: false,
    publish: false,
    dryRun: false,
    keepTemp: false,
    maxSide: 1200,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--folder") args.folder = next();
    else if (a === "--brand") args.brand = next();
    else if (a === "--name") args.nameZh = next();
    else if (a === "--supplier-jpy") args.supplierJpy = Number(next());
    else if (a === "--qty") args.qty = Number(next());
    else if (a === "--moq") args.moq = Number(next());
    else if (a === "--stock") args.stock = Number(next());
    else if (a === "--hint") args.hint = next();
    else if (a === "--site") args.site = next();
    else if (a === "--token") args.token = next();
    else if (a === "--max-side") args.maxSide = Number(next());
    else if (a === "--per-subfolder") args.perSubfolder = true;
    else if (a === "--publish") args.publish = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--keep-temp") args.keepTemp = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

const USAGE = `
面膜照片本機代理 — 把 Google 雲端的照片送到網站並跑上架流程

  node mask-agent.mjs --folder <雲端資料夾> [選項]

必要
  --folder <路徑>        rclone 的雲端路徑，例如 "MaskBridge/面膜/2026-09-30"

常用選項
  --brand <品牌>         例：LuLuLun（AI 讀不出來時一定要給）
  --supplier-jpy <數字>  日圓進貨單價。沒給就用照片上的定價推估（不可靠）
  --qty <數字>           一次進貨量，影響運費攤提（預設 600）
  --moq <數字>           起批量（預設 12）
  --stock <數字>         可上架庫存（預設 30）
  --hint <文字>          給 AI 的現場補充，例如「難波門市限定，一盒5片入」
  --per-subfolder        把每個子資料夾當成一個商品（一個資料夾放多個商品時用）
  --publish              跑完流程後直接上架（預設只建檔，等人確認再上架）
  --dry-run              只列出會做什麼，不真的上傳
  --keep-temp            保留暫存檔案（除錯用）
  --site <網址>          預設 https://rokaizumi-tw.jp
  --token <token>        預設讀 config.json 或環境變數 MASK_AGENT_TOKEN

設定檔：與本程式同目錄的 config.json
  { "siteUrl": "https://rokaizumi-tw.jp", "agentToken": "....", "driveRemote": "gdrive" }
`;

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const ROLE_ORDER = ["front", "back", "box", "texture", "detail"];

function guessRole(fileName, index) {
  const n = String(fileName).toLowerCase();
  if (/(front|omote|正面|主圖|main|外觀)/.test(n)) return "front";
  if (/(back|ura|背面|成分|ingredient|label|標示)/.test(n)) return "back";
  if (/(box|carton|外盒|盒裝|箱)/.test(n)) return "box";
  if (/(texture|swatch|質地|精華|觸感)/.test(n)) return "texture";
  if (/(detail|zoom|特寫|細節)/.test(n)) return "detail";
  return ROLE_ORDER[index % ROLE_ORDER.length];
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|gif|avif)$/i;

async function hasCommand(cmd, args = ["--version"]) {
  try {
    await execFileAsync(cmd, args, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/** 用 sips 縮圖並轉成 JPEG；sips 是 macOS 內建，不用額外套件 */
async function downscale(inputPath, outputPath, maxSide) {
  try {
    await execFileAsync("sips", [
      "-Z",
      String(maxSide),
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "82",
      inputPath,
      "--out",
      outputPath,
    ]);
    return true;
  } catch {
    return false;
  }
}

/** 遞迴列出資料夾裡的圖片（雲端路徑已抓到本機後使用） */
function listImages(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (IMAGE_EXT.test(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

async function rclone(args, label) {
  try {
    const { stdout, stderr } = await execFileAsync("rclone", args, { timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    return { ok: true, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message, label };
  }
}

/* ------------------------------------------------------------------ */
/* 主要流程                                                            */
/* ------------------------------------------------------------------ */

async function sendBatch({ site, token, payload }) {
  const res = await fetch(`${site.replace(/\/+$/, "")}/api/mask-agent/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mask-agent-token": token },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`網站回應 ${res.status}：${body?.error ?? JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

async function processFolder({ folder, brand, nameZh, supplierJpy, qty, moq, stock, hint, publish, dryRun, keepTemp, maxSide, site, token, label }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mask-agent-"));
  const localDir = path.join(tempRoot, "photos");

  try {
    console.log(`\n📥 從雲端抓取：${folder}`);
    const copy = await rclone(["copy", folder, localDir, "--transfers", "8", "--checkers", "16", "--progress=false"], folder);
    if (!copy.ok) {
      throw new Error(`rclone 複製失敗：${String(copy.error).slice(0, 300)}`);
    }

    const files = listImages(localDir);
    if (files.length === 0) {
      console.log("⚠️  這個資料夾沒有圖片，跳過。");
      return;
    }
    console.log(`📷 找到 ${files.length} 張圖片`);

    const photos = [];
    for (let i = 0; i < files.length; i += 1) {
      const src = files[i];
      const name = path.basename(src);
      const shrunk = path.join(tempRoot, `s-${name.replace(/\.[^.]+$/, "")}.jpg`);
      const ok = await downscale(src, shrunk, maxSide);
      const usePath = ok ? shrunk : src;
      const bytes = fs.readFileSync(usePath);

      photos.push({
        name,
        role: guessRole(name, i),
        mimeType: "image/jpeg",
        base64: bytes.toString("base64"),
      });
      console.log(
        `   ${ok ? "縮圖" : "原始"} ${name.padEnd(28)} → ${guessRole(name, i).padEnd(8)} ${(bytes.length / 1024).toFixed(0)} KB`,
      );
    }

    if (dryRun) {
      console.log("\n🧪 --dry-run：以上是會上傳的內容，沒有真的送出。");
      return;
    }

    const totalKb = photos.reduce((s, p) => s + p.base64.length * 0.75, 0) / 1024;
    console.log(`\n⬆️  上傳到 ${site}（共約 ${(totalKb / 1024).toFixed(1)} MB）…`);

    const result = await sendBatch({
      site,
      token,
      payload: {
        folder,
        brand: brand ?? undefined,
        nameZh: nameZh ?? undefined,
        supplierJpy: supplierJpy ?? undefined,
        qty,
        moq: moq ?? undefined,
        stock: stock ?? undefined,
        hint: hint ?? undefined,
        runPipeline: true,
        publish,
        photos,
      },
    });

    const s = result.pipeline?.summary ?? {};
    console.log(`\n✅ ${result.created ? "已建立新品項" : "已更新既有品項"}：${result.sku}`);
    console.log(`   品名：${s.name ?? result.name ?? "（未命名）"}`);
    console.log(`   照片：新增 ${result.photos.added} 張、略過 ${result.photos.skipped} 張（重複）`);
    if (result.photos.failed > 0) console.log(`   ⚠️ 失敗 ${result.photos.failed} 張：${result.photos.failures.join("；")}`);

    const stages = result.pipeline?.stages ?? [];
    if (stages.length > 0) {
      console.log(`   流程：${stages.map((x) => `${x.stage}${x.status === "success" ? "✓" : "✗"}`).join(" ")}`);
      const failed = stages.filter((x) => x.status !== "success" && x.status !== "skipped");
      for (const f of failed) console.log(`   ❌ ${f.stage}：${f.error}`);
    }
    if (result.pipeline?.error) console.log(`   ❌ 流程錯誤：${result.pipeline.error}`);

    if (s.unitCostTwd) {
      console.log(
        `   成本 NT$${s.unitCostTwd}｜批發 NT$${s.wholesaleTwd}｜零售 NT$${s.retailTwd}｜成分 ${s.ingredientsCount} 項`,
      );
    }
    console.log(`   法遵：${result.complianceStatus}（阻擋 ${s.blockedFindings ?? 0}、提醒 ${s.warningFindings ?? 0}）`);
    if (s.missingLabels?.length) {
      console.log(`   中文標示還缺：${s.missingLabels.join("、")}（到後台「面膜作業」補齊）`);
    }

    if (result.publish) {
      if (result.publish.error) console.log(`   ⚠️ 上架未完成：${result.publish.error}`);
      else console.log(`   🛒 已上架，商品編號 ${result.publish.productId}`);
    } else {
      console.log(`   👉 確認文案與法遵後，到「面膜作業」按上架（或加 --publish 直接上架）`);
    }
  } finally {
    if (!keepTemp) fs.rmSync(tempRoot, { recursive: true, force: true });
    else console.log(`\n📁 暫存保留在 ${tempRoot}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.folder) {
    console.log(USAGE);
    process.exit(1);
  }

  const config = loadConfig();
  const site = args.site ?? config.siteUrl ?? process.env.MASK_SITE_URL ?? "https://rokaizumi-tw.jp";
  const token = args.token ?? config.agentToken ?? process.env.MASK_AGENT_TOKEN ?? "";
  const remote = config.driveRemote ?? "gdrive";

  if (!token) {
    console.error(
      `❌ 沒有設定代理 token。\n` +
        `   請在 ${CONFIG_PATH} 填入：\n` +
        `   { "siteUrl": "${site}", "agentToken": "<向網站管理者索取>" }\n` +
        `   或設定環境變數 MASK_AGENT_TOKEN。`,
    );
    process.exit(1);
  }

  if (!(await hasCommand("rclone"))) {
    console.error("❌ 找不到 rclone。請先安裝：brew install rclone，並確認已授權雲端硬碟（rclone lsd gdrive:）。");
    process.exit(1);
  }

  const hasSips = await hasCommand("sips");
  if (!hasSips) {
    console.log("ℹ️  找不到 sips（非 macOS），照片會以原始大小上傳。");
  }

  // rclone 路徑：使用者可以只給 "面膜/2026-09-30"，自動補上 remote。
  // 也支援本機路徑（/ 或 ./ 或 ~ 開頭），方便先用本機照片測試整條流程。
  const isLocalPath = /^(\/|\.\/|~)/.test(args.folder);
  const folderPath = args.folder.includes(":") || isLocalPath
    ? args.folder.replace(/^~/, os.homedir())
    : `${remote}:${args.folder}`;

  console.log("=== 面膜照片代理 ===");
  console.log(`網站：${site}`);
  console.log(`雲端：${folderPath}`);

  // 先確認網站與 token 可用
  try {
    const ping = await fetch(`${site.replace(/\/+$/, "")}/api/mask-agent/ping`, {
      headers: { "x-mask-agent-token": token },
    });
    const body = await ping.json().catch(() => null);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}：${body?.message ?? body?.error ?? ""}`);
    console.log(`✅ 網站連線正常（AI 已設定：${body.aiConfigured ? "是" : "否，請檢查 MISTRAL_API_KEY"}）`);
  } catch (err) {
    console.error(`❌ 連不上網站或 token 不對：${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (args.perSubfolder) {
    // 展開雲端資料夾的下一層，每個子資料夾當成一個商品
    const listing = await rclone(["lsf", "--dirs-only", folderPath], folderPath);
    if (!listing.ok) {
      console.error(`❌ 無法列出 ${folderPath}：${String(listing.error).slice(0, 200)}`);
      process.exit(1);
    }
    const subfolders = listing.stdout
      .split("\n")
      .map((l) => l.trim().replace(/\/$/, ""))
      .filter(Boolean);

    if (subfolders.length === 0) {
      console.log("ℹ️  沒有子資料夾，改成把整個資料夾當成一個商品處理。");
      await processFolder({ ...args, folder: folderPath, site, token, label: folderPath });
      return;
    }

    console.log(`📂 找到 ${subfolders.length} 個子資料夾，每個當成一個商品`);
    for (const sub of subfolders) {
      await processFolder({
        ...args,
        folder: `${folderPath}/${sub}`,
        brand: args.brand,
        site,
        token,
        label: sub,
      });
    }
  } else {
    await processFolder({ ...args, folder: folderPath, site, token, label: folderPath });
  }

  console.log("\n=== 完成 ===");
  console.log("接著到網站「面膜作業」確認文案與法遵，補齊中文標示後按上架。");
}

main().catch((err) => {
  console.error("\n❌ 執行失敗：", err instanceof Error ? err.message : err);
  process.exit(1);
});
