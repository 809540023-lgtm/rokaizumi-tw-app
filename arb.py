#!/usr/bin/env python3
"""
arb.py — 日本→台灣 價差選品掃描器

用法:
    python3 arb.py rate                       # 看目前匯率
    python3 arb.py scan "SONY WH-1000XM5"     # 掃單一商品
    python3 arb.py batch watchlist.txt        # 批次掃描, 產出 report.md / report.csv
    python3 arb.py listing "SONY WH-1000XM5" --price 5990   # 產生蝦皮上架草稿
    python3 arb.py watch                      # 自動追蹤目標價

資料來源:
    日本在售/成交價 → Firecrawl Alexandria (auctions-yahoo-co-jp/listings/search)
    台灣市價       → feebee.com.tw (飛比價格, 彙整蝦皮/momo/PChome)
    匯率           → open.er-api.com (快取 12 小時)
"""

import argparse
import csv
import json
import os
import re
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

# ---------------------------------------------------------------- 費用模型
# 依 2026 蝦皮台灣實際費率調整此處即可
FEES = {
    "deal_fee": 0.055,      # 成交手續費（3C 周邊常見 5.5%，依品類而異）
    "payment_fee": 0.025,   # 金流與系統處理費
    "free_ship_fee": 0.06,  # 免運方案一 6%（方案二為每筆 60 元，可改 0 並調 tw_shipping）
    "tw_shipping": 60,      # 台灣寄出運費（店到店）
    "packing": 30,          # 包材
    "target_margin": 0.35,  # 目標淨利率
}

GOOD_CONDITION = {"NEW", "USED10", "USED20"}
JUNK_RE = re.compile(
    r"ジャンク|現状品|現状渡し|通電のみ|通電確認|部品取り|部品|訳あり|故障|破損|"
    r"難あり|カバー|ケース|箱のみ|説明書|保証書|互換品|互換|パーツ|本体のみ|"
    r"収納|保護フィルム|イヤーピース|フィルム"
)
CONDITION_LABEL = {
    "NEW": "全新", "USED10": "未使用近", "USED20": "傷不明顯",
    "USED40": "有些傷", "USED60": "有傷", "USED80": "狀態差",
}

PRICE_RE = re.compile(r"\$\s?([0-9][0-9,]*)")
CACHE = Path.home() / ".cache" / "jp-arb" / "rates.json"
FC_CMD = os.environ.get("FIRECRAWL_CMD", "npx -y firecrawl-cli@latest").split()
FC_KEY = os.environ.get("FIRECRAWL_API_KEY", "").strip()
FC_URL = os.environ.get("FIRECRAWL_API_URL", "https://api.firecrawl.dev").rstrip("/")


# ---------------------------------------------------------------- 基礎工具
def firecrawl(*args, timeout=240, retries=5):
    last = ""
    for attempt in range(retries):
        proc = subprocess.run([*FC_CMD, *args], capture_output=True, text=True, timeout=timeout)
        if proc.returncode == 0:
            return proc.stdout
        last = (proc.stderr or proc.stdout or "").strip()
        wait = 20
        m = re.search(r"Retry after:\s*(\d+)", last)
        if m:
            wait = int(m.group(1)) + 2
        retryable = bool(m) or "429" in last or "rate limit" in last.lower()
        if not retryable and attempt == 0:
            raise RuntimeError(last[-400:] or f"exit {proc.returncode}")
        time.sleep(wait * (attempt + 1) / 2)
    raise RuntimeError(last[-400:] or "firecrawl failed")


def firecrawl_json(*args):
    out = firecrawl(*args)
    start = out.find("{")
    if start < 0:
        raise RuntimeError("no JSON in output")
    return json.loads(out[start:])


def fc_post(path, payload, timeout=240, retries=5):
    """直接打 Firecrawl REST API — 伺服器上不需要 Node。"""
    last = ""
    for attempt in range(retries):
        req = urllib.request.Request(
            f"{FC_URL}{path}",
            data=json.dumps(payload, ensure_ascii=False).encode(),
            headers={"Authorization": f"Bearer {FC_KEY}",
                     "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.load(resp)
            if data.get("success"):
                return data
            last = json.dumps(data, ensure_ascii=False)[:400]
        except urllib.error.HTTPError as exc:
            last = exc.read().decode("utf-8", "replace")[:400]
            if exc.code not in (429, 500, 502, 503, 504):
                raise RuntimeError(last)
        except Exception as exc:            # 網路層錯誤一樣重試
            last = str(exc)
        time.sleep(min(60, 5 * (attempt + 1)))
    raise RuntimeError(last or "firecrawl REST failed")


def fc_alexandria(provider, capability, options):
    if FC_KEY:
        data = fc_post("/v2/scrape", {
            "alexandria": {"provider": provider, "capability": capability,
                           "options": options},
        })
        return data["data"]["alexandria"][0]["data"]
    data = firecrawl_json("scrape", "--alexandria", f"{provider}/{capability}",
                          "--options", json.dumps(options, ensure_ascii=False))
    return data["data"]["alexandria"][0]["data"]


def fc_markdown(url, country=None, wait=None, main=True):
    if FC_KEY:
        payload = {"url": url, "formats": ["markdown"]}
        if main:
            payload["onlyMainContent"] = True
        if country:
            payload["location"] = {"country": country}
        if wait:
            payload["waitFor"] = wait
        return fc_post("/v2/scrape", payload)["data"].get("markdown") or ""
    args = ["scrape", url, "--formats", "markdown"]
    if main:
        args.append("--only-main-content")
    if country:
        args += ["--country", country]
    if wait:
        args += ["--wait-for", str(wait)]
    return firecrawl(*args)


def get_rates(force=False):
    if not force and CACHE.exists() and time.time() - CACHE.stat().st_mtime < 43200:
        return json.loads(CACHE.read_text())
    with urllib.request.urlopen("https://open.er-api.com/v6/latest/TWD", timeout=20) as resp:
        data = json.load(resp)
    out = {
        "base": "TWD",
        "rates": data["rates"],
        "updated": data.get("time_last_update_utc", ""),
        "ts": time.time(),
    }
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(out))
    return out


def jpy_to_twd(rates):
    return 1.0 / rates["rates"]["JPY"]


# ---------------------------------------------------------------- 資料抓取
def jp_listings(keyword, status, sort=None, limit=50):
    opts = {"query": keyword, "status": status, "limit": limit}
    if sort:
        opts["sort"] = sort
    data = fc_alexandria("auctions-yahoo-co-jp", "listings/search", opts)
    return data


MERCARI_BLOCK = re.compile(
    r"¥([0-9][0-9,]*)\s*\\\\\s*\\\\\s*(.+?)\]\((https://jp\.mercari\.com/(?:item|shops/product)/[A-Za-z0-9]+)\)",
    re.S,
)


def kw_tokens(keyword):
    return [t.lower() for t in re.findall(r"[A-Za-z0-9]{2,}", keyword)]


def relevant(title, tokens):
    """Mercari 搜尋頁會夾帶無關的推薦商品，需驗證標題真的含關鍵字。"""
    if not tokens:
        return True
    low = title.lower()
    need = 1 if len(tokens) == 1 else 2
    return sum(t in low for t in tokens) >= need


def mercari_listings(keyword, limit=30):
    """Mercari 在售（價格低→高）。只回傳 C2C 個人出品，跳過 Mercari Shops 零售。"""
    url = (f"https://jp.mercari.com/search?keyword={quote(keyword)}"
           f"&sort=price&order=asc&status=on_sale")
    md = fc_markdown(url, country="JP", wait=4000)
    out = []
    for m in MERCARI_BLOCK.finditer(md):
        price = int(m.group(1).replace(",", ""))
        title = re.sub(r"\s+", " ", m.group(2)).strip()
        link = m.group(3)
        if "/shops/" in link or not relevant(title, kw_tokens(keyword)):
            continue
        out.append({
            "auction_id": link.rsplit("/", 1)[-1],
            "title": title,
            "price": price,
            "shipping_fee": 0,
            "condition": None,
            "is_mercari": True,
            "url": link,
        })
        if len(out) >= limit:
            break
    return out


def tw_prices(keyword):
    url = f"https://feebee.com.tw/all/{quote(keyword)}/"
    md = fc_markdown(url)
    vals = sorted({int(m.replace(",", "")) for m in PRICE_RE.findall(md)})
    vals = [v for v in vals if 500 <= v <= 200000]
    if not vals:
        return None
    med = statistics.median(vals)
    core = [v for v in vals if v >= med * 0.6]      # 濾掉配件價
    return {
        "min": min(core),
        "median": int(statistics.median(core)),
        "max": max(core),
        "n": len(core),
        "url": url,
    }


# ---------------------------------------------------------------- 計算
def psych(x):
    """湊成 4,290 / 5,990 這種心理價。"""
    if x < 1000:
        return max(99, int(round(x / 10) * 10) - 1)
    return int(round(x / 100) * 100) - 10


def evaluate(keyword, tw_kw=None, rates=None, skip_tw=False):
    rates = rates or get_rates()
    fx = jpy_to_twd(rates)

    closed = jp_listings(keyword, "CLOSED", limit=50)
    opened = jp_listings(keyword, "OPEN", sort="+PRICE", limit=30)
    stats = closed.get("statistics") or {}
    items = opened.get("items") or []

    sold_avg = stats.get("avg_price") or 0
    floor_jpy = max(1500, sold_avg * 0.30)   # 濾掉 ¥1 起標的垃圾件／配件

    def valid(i):
        if i.get("condition") not in GOOD_CONDITION:
            return False
        if JUNK_RE.search(i.get("title") or ""):
            return False
        total = (i.get("price") or 0) + (i.get("shipping_fee") or 0)
        return total >= floor_jpy

    good = [i for i in items if valid(i)]
    pick = None
    if good:
        pick = min(good, key=lambda i: (i.get("price") or 9e9) + (i.get("shipping_fee") or 0))

    tw = None if skip_tw else tw_prices(tw_kw or keyword)

    row = {
        "keyword": keyword,
        "jp_sold_avg_jpy": stats.get("avg_price"),
        "jp_sold_min_jpy": stats.get("min_price"),
        "jp_sold_max_jpy": stats.get("max_price"),
        "jp_open_n": len(items),
        "jp_good_n": len(good),
        "tw_median": (tw or {}).get("median"),
        "tw_min": (tw or {}).get("min"),
        "tw_max": (tw or {}).get("max"),
        "tw_url": (tw or {}).get("url"),
        "fx": round(fx, 6),
    }

    if not pick:
        row["note"] = f"無合格在售（在售 {len(items)} 件，通過品況/價格門檻 0 件）"
        return row

    cost_jpy = (pick.get("price") or 0) + (pick.get("shipping_fee") or 0)
    cost = cost_jpy * fx
    row.update({
        "pick_id": pick.get("auction_id"),
        "pick_title": (pick.get("title") or "")[:60],
        "pick_condition": CONDITION_LABEL.get(pick.get("condition"), pick.get("condition")),
        "cost_jpy": cost_jpy,
        "cost_twd": round(cost),
        "pick_url": f"https://paypayfleamarket.yahoo.co.jp/item/{pick.get('auction_id')}"
        if pick.get("is_fleamarket_item")
        else f"https://page.auctions.yahoo.co.jp/jp/auction/{pick.get('auction_id')}",
    })

    tw_med = row["tw_median"]
    if tw_med:
        sell = min(tw_med * 0.88, cost * 2.2)
    else:
        sell = cost * 2.0
    sell = psych(sell)

    fee = sell * (FEES["deal_fee"] + FEES["payment_fee"] + FEES["free_ship_fee"])
    extra = FEES["tw_shipping"] + FEES["packing"]
    net = sell - fee - extra - cost

    row.update({
        "sell_twd": sell,
        "fees_twd": round(fee),
        "net_twd": round(net),
        "margin_pct": round(net / sell * 100, 1) if sell else 0,
        "roi_pct": round(net / cost * 100, 1) if cost else 0,
    })

    # 進價遠低於 120 天成交均價 → 假貨/詐騙/說明不清的機率很高
    ratio = cost_jpy / sold_avg if sold_avg else 1.0
    row["risk"] = "⚠️疑" if ratio < 0.70 else "OK"
    return row


# ---------------------------------------------------------------- 輸出
COLS = [
    ("keyword", "商品", 26),
    ("cost_twd", "進價", 7),
    ("sell_twd", "建議售價", 9),
    ("net_twd", "淨利", 7),
    ("margin_pct", "淨利率", 7),
    ("tw_median", "台灣市價", 9),
    ("pick_condition", "品況", 8),
    ("risk", "風險", 5),
]


def to_markdown(rows):
    out = ["| " + " | ".join(c[1] for c in COLS) + " |",
           "|" + "|".join("---" for _ in COLS) + "|"]
    for r in rows:
        cells = []
        for key, _, _ in COLS:
            v = r.get(key)
            if v is None:
                cells.append("—")
            elif key in ("cost_twd", "sell_twd", "net_twd", "tw_median"):
                cells.append(f"{v:,}")
            elif key in ("margin_pct",):
                cells.append(f"{v}%")
            else:
                cells.append(str(v))
        out.append("| " + " | ".join(cells) + " |")
    return "\n".join(out)


def print_rows(rows):
    print(to_markdown(rows))
    print()
    for r in rows:
        if r.get("pick_url"):
            print(f"- **{r['keyword']}** {r['pick_condition']} ¥{r['cost_jpy']:,} → {r['pick_url']}")
    print()


LISTING_TMPL = """【商品名稱】(60 字內, 前 20 字放關鍵字)
[預購] {title} 會議/音樂 公司貨平行輸入

【商品說明】
★ 日本原裝進口,{cond}
★ 型號:{title}
★ 付款後約 10–14 天到貨(日本採購+國際運送)

【規格】
(貼官方規格)

【注意事項】
1. 本商品為日本代購預購,下單後始向日本採購,不適用 7 天猶豫期。
2. 出貨前皆會拆箱檢查並錄影,外觀瑕疵會先告知。
3. 保固依原廠日本保固,台灣無官方保固,提供 30 天店保。
4. 需統編/發票請先聊聊告知。

【建議設定】
備貨天數:{days} 個工作日
售價:{price:,} 元
運費:依蝦皮免運方案
"""


def listing(keyword, price, cond="未使用近"):
    row = evaluate(keyword)
    title = (row.get("pick_title") or keyword)[:40]
    print(LISTING_TMPL.format(title=title, cond=cond, days=10, price=price or row.get("sell_twd") or 0))
    if row.get("pick_url"):
        print(f"# 日本來源: {row['pick_url']}")


# ---------------------------------------------------------------- 自動追蹤
STATE = Path.home() / ".cache" / "jp-arb" / "watch-state.json"
LOG = Path.home() / "jp-arb" / "watch.log"


def notify(title, body):
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification {json.dumps(body)} with title {json.dumps(title)} sound name "Glass"'],
            capture_output=True, timeout=10,
        )
    except Exception:
        pass


def load_state():
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            return {}
    return {}


def watch(file, notify_on=True, quiet=False, src="both"):
    lines = []
    for raw in Path(file).read_text().splitlines():
        line = raw.split("#")[0].strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2 or not parts[1]:
            continue
        lines.append((parts[0], int(parts[1])))

    state = load_state()
    alerts, rows = [], []
    stamp = time.strftime("%Y-%m-%d %H:%M")

    for keyword, target in lines:
        cands, err = [], []
        if src in ("both", "yahoo"):
            try:
                items = jp_listings(keyword, "OPEN", sort="+PRICE", limit=30).get("items") or []
                for i in items:
                    cands.append({
                        "title": i.get("title") or "",
                        "price": (i.get("price") or 0) + (i.get("shipping_fee") or 0),
                        "cond": CONDITION_LABEL.get(i.get("condition"), i.get("condition")),
                        "ok_cond": i.get("condition") in GOOD_CONDITION,
                        "url": (f"https://paypayfleamarket.yahoo.co.jp/item/{i['auction_id']}"
                                if i.get("is_fleamarket_item")
                                else f"https://page.auctions.yahoo.co.jp/jp/auction/{i['auction_id']}"),
                        "src": "Y!",
                    })
            except Exception as exc:
                err.append(f"Y! {str(exc)[:30]}")
        if src in ("both", "mercari"):
            try:
                for i in mercari_listings(keyword):
                    cands.append({
                        "title": i["title"],
                        "price": i["price"] + i["shipping_fee"],
                        "cond": "狀態未標示",
                        "ok_cond": True,
                        "url": i["url"],
                        "src": "メルカリ",
                    })
            except Exception as exc:
                err.append(f"メルカリ {str(exc)[:30]}")

        valid = [
            c for c in cands
            if c["ok_cond"]
            and not JUNK_RE.search(c["title"])
            and c["price"] >= 1000
        ]
        prev = state.get(keyword, {})

        if not valid:
            status = "無合格在售"
            if err:
                status = f"抓取失敗（{'、'.join(err)}）"
            elif prev.get("lowest_jpy"):
                alerts.append((keyword, f"原本 ¥{prev['lowest_jpy']:,} 的商品已消失（可能售出）"))
                status = "⚠️ 已售出／下架"
            rows.append({"kw": keyword, "status": status, "target": target})
            state[keyword] = {}
            continue

        best = min(valid, key=lambda c: c["price"])
        price, url, cond = best["price"], best["url"], best["cond"]

        prev_low = prev.get("lowest_jpy")
        newly_hit = price <= target and not (prev_low and prev_low <= target)
        if newly_hit:
            alerts.append((keyword, f"✅ 命中目標價 ¥{price:,}（目標 ¥{target:,}）{cond}｜{best['src']}\n{url}"))
        elif prev_low and price < prev_low:
            alerts.append((keyword, f"📉 新低價 ¥{price:,}（上次 ¥{prev['lowest_jpy']:,}）{cond}｜{best['src']}\n{url}"))

        state[keyword] = {"lowest_jpy": price, "url": url, "cond": cond,
                          "src": best["src"], "ts": stamp}
        rows.append({"kw": keyword, "price": price, "cond": cond, "target": target,
                     "url": url, "src": best["src"], "n": len(valid)})

    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

    out = [f"## {stamp} 追蹤結果", ""]
    for r in rows:
        if "price" in r:
            flag = "🎯" if r["price"] <= r["target"] else "　"
            out.append(f"{flag} {r['kw']}：¥{r['price']:,}（目標 ¥{r['target']:,}）"
                       f"{r['cond']}｜{r['src']}　共 {r['n']} 件\n   {r['url']}")
        else:
            out.append(f"　 {r['kw']}：{r['status']}")
    if alerts:
        out += ["", "### 通知"] + [f"- {kw}：{msg}" for kw, msg in alerts]
    text = "\n".join(out)

    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as fh:
        fh.write(text + "\n\n")

    if not quiet:
        print(text)

    if alerts and notify_on:
        notify(f"jp-arb：{len(alerts)} 筆通知", alerts[0][1].split("\n")[0])

    return len(alerts)


# ---------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description="日本→台灣 價差選品掃描器")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("rate", help="顯示匯率")
    p_scan = sub.add_parser("scan", help="掃描單一商品")
    p_scan.add_argument("keyword")
    p_scan.add_argument("--tw", dest="tw_kw", help="台灣搜尋關鍵字（預設同日本）")
    p_scan.add_argument("--no-tw", action="store_true")
    p_scan.add_argument("--json", action="store_true")

    p_batch = sub.add_parser("batch", help="批次掃描 watchlist")
    p_batch.add_argument("file")
    p_batch.add_argument("--out", default="report.md")
    p_batch.add_argument("--csv", dest="csv_out", default="report.csv")
    p_batch.add_argument("--workers", type=int, default=2)

    p_list = sub.add_parser("listing", help="產生蝦皮上架草稿")
    p_list.add_argument("keyword")
    p_list.add_argument("--price", type=int)

    p_watch = sub.add_parser("watch", help="自動追蹤目標價（可搭配 cron / launchd）")
    p_watch.add_argument("file", nargs="?", default="watch.txt")
    p_watch.add_argument("--no-notify", action="store_true", help="不跳 macOS 通知")
    p_watch.add_argument("--quiet", action="store_true", help="只寫 log 不印出")
    p_watch.add_argument("--src", choices=["both", "yahoo", "mercari"], default="both",
                         help="比價來源（預設 Yahoo + Mercari 一起比）")

    args = ap.parse_args()

    if args.cmd == "rate":
        r = get_rates()
        print(f"更新時間: {r['updated']}")
        print(f"1 JPY = {jpy_to_twd(r):.6f} TWD")
        print(f"1 USD = {1 / r['rates']['USD']:.4f} TWD")
        return

    if args.cmd == "scan":
        row = evaluate(args.keyword, args.tw_kw, skip_tw=args.no_tw)
        if args.json:
            print(json.dumps(row, ensure_ascii=False, indent=2))
        else:
            print_rows([row])
        return

    if args.cmd == "batch":
        lines = []
        for raw in Path(args.file).read_text().splitlines():
            line = raw.split("#")[0].strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split("|")]
            lines.append((parts[0], parts[1] if len(parts) > 1 and parts[1] else None))

        rates = get_rates()

        def work(item):
            kw, tw_kw = item
            try:
                return evaluate(kw, tw_kw, rates=rates)
            except Exception as exc:  # 單一商品失敗不影響整批
                return {"keyword": kw, "note": f"ERROR {exc}"[:80]}

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            rows = list(pool.map(work, lines))

        rows.sort(key=lambda r: (r.get("margin_pct") or -999), reverse=True)

        Path(args.out).write_text(to_markdown(rows) + "\n")
        fields = list(dict.fromkeys(k for r in rows for k in r))
        with open(args.csv_out, "w", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

        print_rows(rows)
        print(f"已寫出 {args.out} / {args.csv_out}")
        return

    if args.cmd == "listing":
        listing(args.keyword, args.price)
        return

    if args.cmd == "watch":
        watch(args.file, notify_on=not args.no_notify, quiet=args.quiet, src=args.src)
        return


if __name__ == "__main__":
    sys.exit(main())
