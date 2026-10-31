#!/usr/bin/env python3
"""
arbweb.py — jp-arb 雲端版：定時比價 + 網頁儀表板 + Telegram 通知

環境變數：
    FIRECRAWL_API_KEY     必填，直接打 Firecrawl REST（不需要 Node）
    TELEGRAM_BOT_TOKEN    選填，有填才會推通知
    TELEGRAM_ADMIN_IDS    選填，逗號分隔的 chat id
    SCAN_INTERVAL_MIN     預設 30（盯特定商品頁，1 credit／台）
    SEARCH_REFRESH_H      預設 24（完整搜尋，11 credits／台）
    MIN_CREDITS           預設 40，剩餘額度低於此就暫停
    DB_PATH               預設 ./data/arb.db
    APP_PASSWORD          選填，設了就開 HTTP Basic 驗證
    APP_USER              預設 admin
"""

import html
import json
import os
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import datetime, timedelta, timezone

import arb

TZ = timezone(timedelta(hours=8))
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "data", "arb.db"))
INTERVAL_MIN = float(os.environ.get("SCAN_INTERVAL_MIN", "30"))
SEARCH_REFRESH_H = float(os.environ.get("SEARCH_REFRESH_H", "24"))
MIN_CREDITS = int(os.environ.get("MIN_CREDITS", "40"))
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TG_IDS = [i.strip() for i in os.environ.get("TELEGRAM_ADMIN_IDS", "").split(",") if i.strip()]
APP_USER = os.environ.get("APP_USER", "admin")
APP_PASS = os.environ.get("APP_PASSWORD", "").strip()

SCAN_LOCK = threading.Lock()
STATE = {"scanning": False, "last_run": None, "last_error": None, "progress": "",
         "credits": None, "full": None}

SEED = [
    # 日本關鍵字 | 台灣關鍵字 | 目標價(円) | 備註 | 盯這個商品頁
    ("Jabra Speak2 55", "jabra speak2 55", 13000, "藍芽 + USB-A/C，12h 電池，IP64",
     "https://paypayfleamarket.yahoo.co.jp/item/z710320738"),
    ("Jabra Speak2 40", "jabra speak2 40", 10000, "純 USB，無藍芽",
     "https://paypayfleamarket.yahoo.co.jp/item/z714251304"),
    ("Poly Sync 20", "poly sync 20", 8000, "藍芽 + USB",
     "https://page.auctions.yahoo.co.jp/jp/auction/c1213636713"),
    ("Jabra Speak2 75", "jabra speak2 75", 26000, "旗艦款",
     "https://page.auctions.yahoo.co.jp/jp/auction/v1248080179"),
]


# ---------------------------------------------------------------- DB
def db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    with closing(db()) as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS items(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT UNIQUE NOT NULL,
            tw_keyword TEXT,
            target_jpy INTEGER,
            note TEXT,
            url TEXT,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS meta(
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS snapshots(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL,
            ts TEXT NOT NULL,
            jp_price INTEGER,
            jp_cond TEXT,
            jp_url TEXT,
            jp_id TEXT,
            jp_sold_avg INTEGER,
            tw_median INTEGER,
            tw_min INTEGER,
            cost_twd INTEGER,
            sell_twd INTEGER,
            net_twd INTEGER,
            margin_pct REAL,
            roi_pct REAL,
            risk TEXT,
            note TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_snap_kw ON snapshots(keyword, ts DESC);
        CREATE TABLE IF NOT EXISTS alerts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            keyword TEXT,
            kind TEXT,
            message TEXT,
            url TEXT,
            sent INTEGER DEFAULT 0
        );
        """)
        if conn.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO items(keyword, tw_keyword, target_jpy, note, url) "
                "VALUES(?,?,?,?,?)", SEED)
        # 舊資料沒有 url 的，用 SEED 補上
        for kw, _tw, _tgt, _note, url in SEED:
            conn.execute("UPDATE items SET url=? WHERE keyword=? AND (url IS NULL OR url='')",
                         (url, kw))
        conn.commit()


def meta_get(conn, key, default=None):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def meta_set(conn, key, value):
    conn.execute("INSERT INTO meta(key, value) VALUES(?,?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    conn.commit()


def now_str():
    return datetime.now(TZ).strftime("%Y-%m-%d %H:%M")


# ---------------------------------------------------------------- 通知
def telegram(text):
    if not (TG_TOKEN and TG_IDS):
        return False
    ok = False
    for chat in TG_IDS:
        data = urllib.parse.urlencode({
            "chat_id": chat, "text": text,
            "parse_mode": "HTML", "disable_web_page_preview": "true",
        }).encode()
        try:
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage", data=data)
            with urllib.request.urlopen(req, timeout=20) as resp:
                ok = json.load(resp).get("ok", False) or ok
        except Exception as exc:
            print(f"[telegram] {exc}", flush=True)
    return ok


# ---------------------------------------------------------------- 掃描
def scan_one(keyword, tw_kw):
    """完整搜尋（貴：11 credits）— 更新台灣價、成交行情、找更好的在售品。"""
    try:
        return arb.evaluate(keyword, tw_kw or keyword)
    except Exception as exc:
        return {"keyword": keyword, "note": f"掃描失敗：{str(exc)[:160]}"}


def check_one(item):
    """盯單一商品頁（便宜：1 credit）。"""
    try:
        res = arb.check_item(item["url"])
    except Exception as exc:
        return {"keyword": item["keyword"], "note": f"檢查失敗：{str(exc)[:120]}"}
    return {
        "keyword": item["keyword"],
        "pick_id": item["url"].rsplit("/", 1)[-1],
        "pick_url": item["url"],
        "pick_title": res.get("title") or "",
        "cost_jpy": None if res["sold"] else res["price"],
        "sold": res["sold"],
        "note": "已售出" if res["sold"] else None,
    }


def record(conn, row, target):
    kw = row["keyword"]
    prev = conn.execute(
        "SELECT * FROM snapshots WHERE keyword=? ORDER BY ts DESC LIMIT 1", (kw,)).fetchone()
    price = row.get("cost_jpy")
    sold = row.get("sold")
    alerts = []

    # 便宜模式只帶價格，其餘沿用上一次的估值
    carry = {}
    if prev:
        for k in ("tw_median", "tw_min", "cost_twd", "sell_twd", "net_twd",
                  "margin_pct", "roi_pct", "risk", "jp_sold_avg"):
            if row.get(k) is None:
                carry[k] = prev[k]
    merged = {**{k: row.get(k) for k in
                 ("tw_median", "tw_min", "cost_twd", "sell_twd", "net_twd",
                  "margin_pct", "roi_pct", "risk", "jp_sold_avg")}, **carry}

    if sold:
        alerts.append(("gone", f"⚠️ 已售出（原價 ¥{prev['jp_price']:,}）" if prev and prev["jp_price"]
                       else "⚠️ 已售出", row.get("pick_url")))
    elif row.get("note") and not price:
        alerts.append(("error", row["note"], None))
    else:
        if target and price and price <= target:
            alerts.append(("target", f"🎯 命中目標價 ¥{price:,}（目標 ¥{target:,}）", row.get("pick_url")))
        if prev and prev["jp_price"] and price:
            if price < prev["jp_price"]:
                alerts.append(("lower", f"📉 新低價 ¥{price:,}（上次 ¥{prev['jp_price']:,}）", row.get("pick_url")))
            elif price > prev["jp_price"]:
                alerts.append(("higher", f"📈 漲價 ¥{price:,}（上次 ¥{prev['jp_price']:,}）", row.get("pick_url")))

    conn.execute("""INSERT INTO snapshots(keyword, ts, jp_price, jp_cond, jp_url, jp_id,
                    jp_sold_avg, tw_median, tw_min, cost_twd, sell_twd, net_twd,
                    margin_pct, roi_pct, risk, note)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
        kw, now_str(), price, row.get("pick_condition") or (prev["jp_cond"] if prev else None),
        row.get("pick_url") or (prev["jp_url"] if prev else None),
        row.get("pick_id") or (prev["jp_id"] if prev else None),
        merged["jp_sold_avg"], merged["tw_median"], merged["tw_min"],
        merged["cost_twd"], merged["sell_twd"], merged["net_twd"],
        merged["margin_pct"], merged["roi_pct"], merged["risk"], row.get("note")))
    for kind, msg, url in alerts:
        conn.execute("INSERT INTO alerts(ts, keyword, kind, message, url) VALUES(?,?,?,?,?)",
                     (now_str(), kw, kind, msg, url))
    conn.commit()
    return alerts


def run_scan(trigger="auto", full=None):
    if not SCAN_LOCK.acquire(blocking=False):
        return {"ok": False, "error": "掃描中，請稍後"}
    try:
        STATE.update(scanning=True, last_error=None, progress="")
        init_db()

        with closing(db()) as conn:
            items = conn.execute("SELECT * FROM items WHERE active=1").fetchall()
            last_full = meta_get(conn, "last_full_search")
            if full is None:
                due = (not last_full) or (
                    time.time() - float(last_full) > SEARCH_REFRESH_H * 3600)
                full = due
            # 盯商品頁是免費的（直抓），只有完整搜尋才需要額度
            if full:
                left = arb.credits_left()
                if left is not None and left < MIN_CREDITS:
                    msg = f"Firecrawl 額度不足（剩 {left}），本次跳過完整搜尋，只盯商品頁"
                    STATE["last_error"] = msg
                    conn.execute("INSERT INTO alerts(ts, keyword, kind, message) VALUES(?,?,?,?)",
                                 (now_str(), "-", "error", msg))
                    conn.commit()
                    full = False
            all_alerts = []
            for idx, it in enumerate(items, 1):
                STATE["progress"] = f"{idx}/{len(items)} {it['keyword']}"
                has_val = conn.execute(
                    "SELECT 1 FROM snapshots WHERE keyword=? AND tw_median IS NOT NULL LIMIT 1",
                    (it["keyword"],)).fetchone()
                if full or not it["url"] or not has_val:
                    row = scan_one(it["keyword"], it["tw_keyword"])
                else:
                    row = check_one(it)
                all_alerts += [(it["keyword"],) + a for a in record(conn, row, it["target_jpy"])]
            if full:
                meta_set(conn, "last_full_search", time.time())
            meta_set(conn, "last_scan", time.time())

        STATE["last_run"] = now_str()
        STATE["credits"] = arb.credits_left()
        STATE["full"] = bool(full)

        if all_alerts:
            lines = [f"<b>jp-arb 比價通知</b>（{trigger}）", ""]
            for kw, kind, msg, url in all_alerts:
                lines.append(f"<b>{html.escape(kw)}</b> {html.escape(msg)}")
                if url:
                    lines.append(f'<a href="{url}">{url}</a>')
            telegram("\n".join(lines[:40]))
            with closing(db()) as conn:
                conn.execute("UPDATE alerts SET sent=1 WHERE sent=0")
                conn.commit()
        return {"ok": True, "alerts": len(all_alerts), "full": bool(full),
                "credits": STATE["credits"]}
    except Exception as exc:
        STATE["last_error"] = str(exc)[:300]
        return {"ok": False, "error": str(exc)[:300]}
    finally:
        STATE.update(scanning=False, progress="")
        SCAN_LOCK.release()


def scheduler():
    time.sleep(20)                      # 等服務起來
    while True:
        try:
            run_scan("排程")
        except Exception as exc:
            print(f"[scheduler] {exc}", flush=True)
        time.sleep(INTERVAL_MIN * 60)


# ---------------------------------------------------------------- 網頁
CSS = """
*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,"PingFang TC","Noto Sans TC",sans-serif;
background:#0e1117;color:#e6edf3;padding:24px}h1{font-size:22px;margin:0 0 4px}
.sub{color:#8b949e;font-size:13px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:16px}
.card.hit{border-color:#2ea043;box-shadow:0 0 0 1px #2ea04355}
.card.gone{border-color:#6e7681;opacity:.65}
.name{font-weight:600;font-size:16px;margin-bottom:2px}
.note{color:#8b949e;font-size:12px;margin-bottom:10px}
.big{font-size:26px;font-weight:700;letter-spacing:.5px}
.big small{font-size:13px;font-weight:400;color:#8b949e;margin-left:6px}
.row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;border-top:1px solid #21262d}
.row span:first-child{color:#8b949e}
.net{color:#3fb950;font-weight:600}.neg{color:#f85149;font-weight:600}
.tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;background:#1f6feb33;
color:#58a6ff;border:1px solid #1f6feb55;margin-left:6px}
.tag.warn{background:#d2992233;color:#d29922;border-color:#d2992255}
.tag.ok{background:#2ea04333;color:#3fb950;border-color:#2ea04355}
a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}
.btn{background:#238636;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:14px;
cursor:pointer;font-weight:600}.btn:disabled{background:#30363d;color:#8b949e;cursor:default}
.bar{display:flex;align-items:center;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.alertbox{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:14px 16px;margin-top:22px}
.alertbox h2{font-size:15px;margin:0 0 10px}.alertbox div{font-size:13px;padding:3px 0;color:#c9d1d9}
"""


def basic_ok(headers):
    if not APP_PASS:
        return True
    auth = headers.get("authorization", "")
    if not auth.startswith("Basic "):
        return False
    import base64
    try:
        user, _, pw = base64.b64decode(auth[6:]).decode().partition(":")
    except Exception:
        return False
    return user == APP_USER and pw == APP_PASS


def render():
    init_db()
    with closing(db()) as conn:
        items = conn.execute("SELECT * FROM items WHERE active=1 ORDER BY id").fetchall()
        latest = {}
        for it in items:
            r = conn.execute("SELECT * FROM snapshots WHERE keyword=? ORDER BY ts DESC LIMIT 1",
                             (it["keyword"],)).fetchone()
            if r:
                latest[it["keyword"]] = r
        alerts = conn.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 25").fetchall()

    cards = []
    for it in items:
        r = latest.get(it["keyword"])
        target = it["target_jpy"] or 0
        if not r:
            cards.append(f'<div class="card"><div class="name">{html.escape(it["keyword"])}</div>'
                         f'<div class="note">{html.escape(it["note"] or "")}</div>'
                         f'<div class="sub">尚未掃描</div></div>')
            continue
        price = r["jp_price"]
        cls = "card"
        if price is None:
            cls += " gone"
        elif target and price <= target:
            cls += " hit"
        net = r["net_twd"]
        net_cls = "net" if (net or 0) > 0 else "neg"
        tag = ""
        if price and target:
            tag = ('<span class="tag ok">低於目標</span>' if price <= target
                   else f'<span class="tag">差 ¥{price - target:,}</span>')
        if r["risk"]:
            tag += f'<span class="tag warn">{html.escape(r["risk"])}</span>'
        price_html = (f'<div class="big">¥{price:,}<small>目標 ¥{target:,}</small>{tag}</div>'
                      if price else '<div class="big">—<small>無合格在售</small></div>')
        link = (f'<div class="row"><span>日本連結</span><span>'
                f'<a href="{r["jp_url"]}" target="_blank">前往 ↗</a></span></div>' if r["jp_url"] else "")
        cards.append(f"""<div class="{cls}">
  <div class="name">{html.escape(it['keyword'])}</div>
  <div class="note">{html.escape(it['note'] or '')}</div>
  {price_html}
  <div class="row"><span>品況</span><span>{html.escape(r['jp_cond'] or '—')}</span></div>
  <div class="row"><span>台灣中位價</span><span>{'NT$' + format(r['tw_median'], ',') if r['tw_median'] else '—'}</span></div>
  <div class="row"><span>進貨成本</span><span>{'NT$' + format(r['cost_twd'], ',') if r['cost_twd'] else '—'}</span></div>
  <div class="row"><span>建議售價</span><span>{'NT$' + format(r['sell_twd'], ',') if r['sell_twd'] else '—'}</span></div>
  <div class="row"><span>淨利 / 毛利率</span><span class="{net_cls}">{'NT$' + format(net, ',') if net is not None else '—'} / {r['margin_pct'] or 0:.1f}%</span></div>
  {link}
  <div class="row"><span>更新</span><span>{html.escape(r['ts'])}</span></div>
</div>""")

    alert_rows = "".join(
        f'<div>{html.escape(a["ts"])}　<b>{html.escape(a["keyword"] or "")}</b>　{html.escape(a["message"] or "")}</div>'
        for a in alerts) or '<div class="sub">尚無通知</div>'

    scanning = STATE["scanning"]
    status = (f'掃描中 {html.escape(STATE["progress"])}' if scanning
              else f'上次掃描：{STATE["last_run"] or "尚未執行"}　每 {INTERVAL_MIN:g} 分鐘盯一次（每 {SEARCH_REFRESH_H:g} 小時做一次完整搜尋）')
    err = f'<div class="neg" style="font-size:13px">{html.escape(STATE["last_error"])}</div>' if STATE["last_error"] else ""

    return f"""<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>jp-arb 日本→台灣 比價儀表板</title><style>{CSS}</style>
{'<meta http-equiv="refresh" content="60">' if scanning else ''}
</head><body>
<h1>日本 → 台灣 比價儀表板</h1>
<div class="sub">{status}　·　Telegram {'已連線' if TG_TOKEN and TG_IDS else '未設定'}</div>
<div class="bar">
  <form method="post" action="/scan">
    <button class="btn" {'disabled' if scanning else ''}>{'掃描中…' if scanning else '立即掃描'}</button>
  </form>
  {err}
</div>
<div class="grid">{''.join(cards)}</div>
<div class="alertbox"><h2>最近通知</h2>{alert_rows}</div>
</body></html>"""


# ---------------------------------------------------------------- FastAPI
def build_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

    app = FastAPI(title="jp-arb")

    def guard(request: Request):
        if not basic_ok(request.headers):
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="jp-arb"'})
        return None

    @app.get("/healthz")
    def healthz():
        return {"ok": True, "scanning": STATE["scanning"], "last_run": STATE["last_run"]}

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request):
        if (g := guard(request)):
            return g
        return HTMLResponse(render())

    @app.post("/scan")
    def scan(request: Request):
        if (g := guard(request)):
            return g
        threading.Thread(target=run_scan, args=("手動",), daemon=True).start()
        return RedirectResponse("/", status_code=303)

    @app.get("/api/state")
    def api_state(request: Request):
        if (g := guard(request)):
            return g
        with closing(db()) as conn:
            rows = conn.execute("""
                SELECT s.* FROM snapshots s
                JOIN (SELECT keyword, MAX(ts) m FROM snapshots GROUP BY keyword) t
                  ON s.keyword=t.keyword AND s.ts=t.m""").fetchall()
            items = conn.execute("SELECT * FROM items WHERE active=1").fetchall()
            alerts = conn.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 50").fetchall()
        return JSONResponse({
            "status": STATE,
            "items": [dict(i) for i in items],
            "latest": [dict(r) for r in rows],
            "alerts": [dict(a) for a in alerts],
        })

    @app.on_event("startup")
    def startup():
        init_db()
        threading.Thread(target=scheduler, daemon=True).start()

    return app


app = build_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
