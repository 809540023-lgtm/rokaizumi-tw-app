"use strict";
const MASKS = window.PRODUCTS;
const GROCERY = window.SUPERMARKET_PRODUCTS;
const COSTCO = window.COSTCO_PRODUCTS;
const EXCLUSIVE = window.EXCLUSIVE_PRODUCTS;
const P = [...COSTCO, ...GROCERY, ...MASKS, ...EXCLUSIVE];
let currentCatalog =
  location.hash === "#exclusive"
    ? "exclusive"
    : location.hash === "#shop"
      ? "shop"
      : location.hash === "#supermarket"
        ? "supermarket"
        : "costco";
let groceryCategory = "全部";
const cart = new Map();
let shippingMethod = "ems";
const CART_KEY = "roka-line-shop-cart-v1";
try {
  const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const p of P) {
      const quantity = saved[p.id];
      if (
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= p.stock &&
        Number.isFinite(p.price)
      )
        cart.set(p.id, quantity);
    }
  }
} catch {
  /* Private browsing or disabled storage: the shop remains usable. */
}
let submissionKey = null;
function saveCart() {
  submissionKey = null;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(cart)));
  } catch {}
}
const MIN_ORDER_TWD = 2000;
const $ = id => document.getElementById(id);
const money = n => "NT$" + Math.round(n).toLocaleString("zh-TW");
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
function price(p) {
  return p.price;
}
function totals() {
  let count = 0,
    subtotal = 0,
    weight = 100,
    weightUnknown = false;
  for (const p of P) {
    const q = cart.get(p.id) || 0;
    count += q;
    subtotal += q * price(p);
    if (q && p.weight === null) weightUnknown = true;
    else weight += q * p.weight;
  }
  const shipping = count ? (subtotal >= 5000 ? 0 : 220) : 0;
  return {
    count,
    subtotal,
    weight,
    weightUnknown,
    shipping,
    method: shippingMethod,
    total: shipping === null ? null : subtotal + shipping,
  };
}
function showTab(tab) {
  if (!["shop", "supermarket", "costco", "exclusive", "bag", "guide"].includes(tab)) return;
  if (tab === "shop" || tab === "supermarket" || tab === "costco" || tab === "exclusive") {
    currentCatalog = tab;
    history.replaceState(
      null,
      "",
      tab === "shop"
        ? "#shop"
        : tab === "supermarket"
          ? "#supermarket"
          : tab === "exclusive"
            ? "#exclusive"
            : location.pathname + location.search
    );
  }
  for (const id of ["shop", "supermarket", "costco", "exclusive", "bag", "guide"])
    $(id).classList.toggle("hidden", id !== tab);
  document.querySelectorAll("[data-tab]").forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  renderCart();
  window.scrollTo({ top: 0 });
}
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 1800);
}
function add(id, quantity = 1) {
  const p = P.find(p => p.id === id);
  if (
    !p ||
    p.price === null ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > p.stock
  )
    throw Error("此商品目前無法加入購物袋");
  const next = (cart.get(id) || 0) + quantity;
  if (next > p.stock) throw Error("超出這款商品庫存");
  cart.set(id, next);
  saveCart();
  renderCart();
  toast("已加入購物袋");
  return totals();
}
function setQuantity(id, q) {
  if (
    !P.some(
      p => p.id === id && q <= p.stock && (q === 0 || Number.isFinite(p.price))
    ) ||
    !Number.isInteger(q) ||
    q < 0
  )
    throw Error("數量無效");
  q ? cart.set(id, q) : cart.delete(id);
  saveCart();
  renderCart();
}
function packImage(p) {
  return p.image
    ? `<span class="${p.imageCrop ? "pack-crop" : "pack-photo"}"><img referrerpolicy="no-referrer" src="${p.image}" alt="${esc(p.jp)} ${esc(p.spec)} 原裝包裝" loading="lazy"></span>`
    : `<span class="pack-pending"><strong>${esc(p.jp)}</strong><small>商品照片準備中</small></span>`;
}
function renderProducts() {
  $("products").innerHTML = MASKS.map(
    p =>
      `<article class="card"><button class="pack" data-detail="${p.id}" aria-label="查看${esc(p.name)}詳情">${packImage(p)}</button><div class="card-body"><span class="meta">${p.id} · ${esc(p.spec)}</span><h3><button class="textbtn" data-detail="${p.id}">${esc(p.name)}</button></h3><div><span class="tag">${p.tag}</span></div><p class="price">${p.price === null ? "價格核對中" : money(price(p))}</p><p class="muted">${p.price === null ? `可選數量上限：${p.stock} 包／盒` : `可選數量上限：${p.stock} 包／盒 · 運費另計`}</p><button class="btn" data-add="${p.id}" ${p.price === null ? "disabled" : ""}>${p.price === null ? "暫停加入" : "加入購物袋"}</button></div></article>`
  ).join("");
}
function renderGrocery() {
  $("supermarket-products").innerHTML = GROCERY.filter(
    p => groceryCategory === "全部" || p.category === groceryCategory
  )
    .map(
      p =>
        `<article class="card"><button class="pack" data-detail="${p.id}" aria-label="查看${esc(p.name)}詳情">${packImage(p)}</button><div class="card-body"><span class="meta">${p.id} · ${esc(p.spec)}</span><h3><button class="textbtn" data-detail="${p.id}">${esc(p.name)}</button></h3><p class="price">${money(price(p))}</p><p class="muted">可選數量上限：${p.stock} 件 · 運費另計</p><button class="btn" data-add="${p.id}">加入購物袋</button></div></article>`
    )
    .join("");
  $("supermarket-count").textContent =
    `${groceryCategory} · ${GROCERY.filter(p => groceryCategory === "全部" || p.category === groceryCategory).length}款`;
  document.querySelectorAll("[data-category]").forEach(b => {
    const active = b.dataset.category === groceryCategory;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}
function renderCostco() {
  $("costco-products").innerHTML = COSTCO.map(
    p =>
      `<article class="card"><button class="pack" data-detail="${p.id}" aria-label="查看${esc(p.name)}詳情">${packImage(p)}</button><div class="card-body"><h3><button class="textbtn" data-detail="${p.id}">${esc(p.name)}</button></h3><p class="price">${money(price(p))}</p><p class="muted">可選數量上限：${p.stock} 件 · 運費另計</p><button class="btn" data-add="${p.id}">加入購物袋</button></div></article>`
  ).join("");
}
function renderExclusive() {
  $("exclusive-products").innerHTML = EXCLUSIVE.map(
    p =>
      `<article class="card"><button class="pack" data-detail="${p.id}" aria-label="查看${esc(p.name)}詳情">${packImage(p)}</button><div class="card-body"><span class="meta">${p.id} · ${esc(p.spec)}</span><h3><button class="textbtn" data-detail="${p.id}">${esc(p.name)}</button></h3><div><span class="tag">${esc(p.tag || "專屬賣場")}</span></div><p class="price">${money(price(p))}</p><p class="muted">可選數量上限：${p.stock} 組 · 運費另計</p><button class="btn" data-add="${p.id}">加入購物袋</button></div></article>`
  ).join("");
}
function sumHtml(t) {
  return `<div class="summary"><div class="sumrow"><span>商品小計（${t.count}件）</span><strong>${money(t.subtotal)}</strong></div><div class="sumrow"><span>EMS 運費${t.subtotal >= 5000 ? "（免運）" : ""}</span><strong>${money(t.shipping)}</strong></div><p class="muted">商品滿 NT$2,000 可下單，運費 NT$220；商品滿 NT$5,000 免運（門檻不含運費）。</p><div class="sumrow total"><span>總額</span><span>${money(t.total)}</span></div></div>`;
}
function shippingOptions(t) {
  return `<div class="shipping-options"><strong>日本郵政 EMS｜滿 NT$5,000 免運</strong><p class="muted">商品 NT$2,000～4,999 運費 NT$220。填寫收件資料後直接刷卡付款，下單後七個工作天內從日本寄出。</p></div>`;
}
function renderCart() {
  const t = totals();
  $("bagcount").textContent = t.count;
  $("bartext").textContent = t.count
    ? `${t.count}件 · 商品 ${money(t.subtotal)}`
    : currentCatalog === "costco"
      ? `日本好市多${COSTCO.length}款 · 已標示售價`
      : currentCatalog === "supermarket"
        ? `日本超市必買${GROCERY.length}選 · 已標示售價`
        : currentCatalog === "exclusive"
          ? `專屬賣場${EXCLUSIVE.length}款 · 已標示售價`
          : `${MASKS.length}款面膜與眼膜 · 已標示售價`;
  $("cart").innerHTML = t.count
    ? P.filter(p => cart.has(p.id))
        .map(
          p =>
            `<div class="row">${p.image ? `<img referrerpolicy="no-referrer" src="${p.image}" alt="${esc(p.name)}">` : `<div class="row-pending" aria-label="商品照片準備中">${p.id}</div>`}<div class="row-content"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.spec)} · ${money(price(p))}/${p.catalog === "exclusive" ? "組" : p.catalog !== "mask" && p.catalog ? "件" : "包"}</p><button class="textbtn" data-remove="${p.id}">移除</button></div><div class="quantity"><button data-step="-1" data-id="${p.id}" aria-label="減少${esc(p.name)}數量">−</button><span>${cart.get(p.id)}</span><button data-step="1" data-id="${p.id}" aria-label="增加${esc(p.name)}數量">＋</button></div></div>`
        )
        .join("") +
      shippingOptions(t) +
      sumHtml(t) +
      `<button class="btn" id="startCheckout" ${t.subtotal < MIN_ORDER_TWD ? "disabled" : ""}>${t.subtotal < MIN_ORDER_TWD ? "還差 " + money(MIN_ORDER_TWD - t.subtotal) + " 可結帳" : "填寫收件資料・前往付款"}</button><p class="muted">最低訂購商品小計 NT$2,000（不含運費，面膜、超市、好市多與專屬賣場可合併計算）。填寫收件資料後直接進入 Stripe 刷卡付款。</p>`
    : `<div class="empty"><h2>購物袋還是空的</h2><p>選好商品後可加入購物袋，查看商品金額與運費。</p><button class="btn" data-tab="shop">繼續挑選</button></div>`;
}
function detail(id) {
  const p = P.find(p => p.id === id);
  if (!p) return;
  $("detailtitle").textContent = p.name;
  $("detailbody").innerHTML =
    `${p.image ? `<div class="detail-photo">${packImage(p)}</div>` : `<div class="detail-pending">${esc(p.jp)}<small>商品照片準備中</small></div>`}${p.jp ? `<p class="meta">${esc(p.jp)}</p>` : ""}<section aria-label="商品說明"><h3>商品說明</h3><p>${esc(p.desc)}</p></section><p><strong>商品規格：</strong>${esc(p.spec)}</p><p class="price">${p.price === null ? "價格核對中" : money(price(p))} <span class="muted">${p.price === null ? "" : "售價・運費另計"}</span></p><p><strong>可選數量上限：</strong>${p.catalog === "exclusive" ? p.stock + " 組" : p.catalog === "supermarket" || p.catalog === "costco" ? p.stock + " 件" : p.stock + " 包／盒"}</p>${p.jan ? `<p class="muted">商品條碼（JAN）：${esc(p.jan)}</p>` : ""}${p.catalog === "costco" ? `<section aria-label="商品與保存"><h3>商品與保存</h3><p>成分、過敏原、保存方式與期限，請以商品包裝標示為準。</p></section>` : p.catalog === "supermarket" ? `<section aria-label="食用與保存"><h3>食用與保存</h3><p>商品搭配方式供您參考；成分、過敏原、保存方式與期限，請以商品包裝標示為準。</p></section><p><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">查看原廠商品資料</a></p>` : p.catalog === "exclusive" ? `<section aria-label="使用與保存"><h3>使用與注意事項</h3><p>請依商品包裝標示使用。使用前先在衣物不明顯處測試；本品不可用於人體，使用後請清洗衣物並洗淨手部。</p><p><a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">查看原廠商品資料</a></p></section>` : `<section aria-label="使用與保存"><h3>使用與保存</h3><p>請依商品包裝標示的使用部位、方式與敷用時間使用；使用後避免重複使用同一片。使用時若有不適，請停止使用。</p><p>多片裝開封後請密封保存，避免高溫及陽光直射。完整成分、保存期限與個別注意事項，請以收到的商品包裝標示為準。</p></section>`}<button class="btn" data-add="${p.id}" ${p.price === null ? "disabled" : ""}>${p.price === null ? "暫停加入" : "加入購物袋"}</button>`;
  $("detail").showModal();
}
function checkout() {
  const t = totals();
  if (t.subtotal < MIN_ORDER_TWD) return;
  const c = window.SHOP_CONFIG;
  if (!c?.enabled) {
    toast("刷卡設定尚未完成，暫未開放下單");
    return;
  }
  $("checkoutbody").innerHTML =
    `<p>免會員下單。填完收件資料後直接進入 Stripe 安全付款頁，確認總額後刷卡。下單後七個工作天內從日本寄出，送達時間另計。</p><p>商品小計：<strong>${money(t.subtotal)}</strong>；運費：<strong>${money(t.shipping)}</strong>（滿 NT$5,000 免運）。</p><form id="orderForm"><label>收件姓名<input name="name" required maxlength="100" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="320" autocomplete="email"></label><label>台灣收件電話<input name="phone" type="tel" required maxlength="40" autocomplete="tel"></label><label>郵遞區號<input name="postalCode" required inputmode="numeric" pattern="[0-9]{3}([0-9]{2,3})?" autocomplete="postal-code"></label><label>台灣完整地址<input name="address" required maxlength="500" autocomplete="street-address"></label><label class="test-consent"><input name="consent" type="checkbox" required>我已閱讀<a href="policies.html" target="_blank">購物與隱私說明</a>，同意店家處理訂單資料。同意顯示的商品金額與運費，並前往 Stripe 付款。</label><button class="btn" type="submit">前往 Stripe 刷卡付款</button></form>`;
  $("checkout").showModal();
}
let orderToken = null;
document.addEventListener("submit", async e => {
  if (e.target.id !== "orderForm") return;
  e.preventDefault();
  const form = e.target,
    button = form.querySelector("button");
  if (button.disabled) return;
  button.disabled = true;
  try {
    submissionKey ??= crypto.randomUUID();
    orderToken ??= Array.from(crypto.getRandomValues(new Uint8Array(32)), x =>
      x.toString(16).padStart(2, "0")
    ).join("");
    const data = Object.fromEntries(new FormData(form));
    const r = await fetch("/api/line-shop/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: submissionKey,
        token: orderToken,
        termsVersion: window.SHOP_CONFIG.termsVersion,
        consent: true,
        customer: data,
        items: P.filter(p => cart.has(p.id)).map(p => ({
          productId: p.id,
          quantity: cart.get(p.id),
        })),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    const url = "?order=" + encodeURIComponent(d.id) + "&token=" + orderToken;
    history.replaceState(null, "", url);
    if (d.checkoutUrl) {
      cart.clear();
      try { localStorage.removeItem(CART_KEY); } catch {}
      location.assign(d.checkoutUrl);
    } else showOrder(d);
  } catch (error) {
    toast(error.message || "提交未確認成功，請重試");
    button.disabled = false;
  }
});
function showOrder(d) {
  $("checkoutbody").innerHTML =
    `<div class="success"><h2>${d.status === "paid" ? "付款成功" : d.status === "pending" ? "訂單待付款" : d.status === "expired" ? "付款期限已過" : "付款連結準備中"}</h2><p>訂單：${esc(d.id)}</p><p>商品小計：${money(d.subtotalTwd)}；EMS 運費：${d.shippingTwd === null ? "待確認" : money(d.shippingTwd)}</p><p>${d.totalTwd === null ? "請稍後更新付款連結。" : "總額：" + money(d.totalTwd)}</p>${d.checkoutUrl ? `<a class="btn" href="${esc(d.checkoutUrl)}">前往 Stripe 刷卡付款</a>` : ""}<p>下單後七個工作天內從日本寄出。請保留本頁連結；連結可查詢訂單，請勿公開分享。</p><button class="btn" id="refreshOrder">更新訂單狀態</button></div>`;
  if (!$("checkout").open) $("checkout").showModal();
}
async function refreshOrder() {
  const q = new URLSearchParams(location.search);
  if (!q.get("order") || !q.get("token")) return;
  try {
    const r = await fetch(
      "/api/line-shop/orders/" +
        encodeURIComponent(q.get("order")) +
        "?token=" +
        encodeURIComponent(q.get("token")),
      { cache: "no-store" }
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    showOrder(d);
  } catch (e) {
    toast(e.message);
  }
}
document.addEventListener("click", e => {
  if (e.target.id === "refreshOrder") refreshOrder();
});
refreshOrder();
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.category) {
      groceryCategory = b.dataset.category;
      renderGrocery();
    } else if (b.dataset.tab) showTab(b.dataset.tab);
    else if (b.dataset.add) add(b.dataset.add);
    else if (b.dataset.detail) detail(b.dataset.detail);
    else if (b.dataset.close) $(b.dataset.close).close();
    else if (b.dataset.remove) setQuantity(b.dataset.remove, 0);
    else if (b.dataset.step)
      setQuantity(
        b.dataset.id,
        (cart.get(b.dataset.id) || 0) + Number(b.dataset.step)
      );
    else if (b.id === "barbutton") showTab("bag");
    else if (b.id === "startCheckout") checkout();
  } catch (error) {
    toast(error.message);
  }
});
$("supermarket-filters").innerHTML = [
  "全部",
  ...new Set(GROCERY.map(p => p.category)),
]
  .map(
    c =>
      `<button data-category="${esc(c)}" aria-pressed="${c === "全部"}">${esc(c)}</button>`
  )
  .join("");
renderProducts();
renderGrocery();
renderCostco();
renderExclusive();
renderCart();
showTab(currentCatalog);
window.addEventListener("hashchange", () =>
  showTab(
    location.hash === "#exclusive"
      ? "exclusive"
      : location.hash === "#shop"
        ? "shop"
        : location.hash === "#supermarket"
          ? "supermarket"
          : "costco"
  )
);
