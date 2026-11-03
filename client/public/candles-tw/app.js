const data = [
  [1, '大象'], [2, '黃金獵犬雙狗組'], [3, '蛋殼小狗'],
  [5, '冰拿鐵'], [7, '草莓奶昔'], [8, '櫻桃奶昔'],
  [9, '鳳梨果汁'], [10, '百香果飲品'], [13, '綠色果凍'],
  [14, '藍色果凍'], [15, '灰白花束'], [16, '花朵塔 1'],
  [17, '花朵塔 2'], [20, '聖誕雪人與樹', 'RZ-C026'],
  [21, '馬卡龍甜點碗'], [25, '睡熊與巧克力'],
  [27, '水果花朵蛋糕'], [28, '草莓蛋糕'],
  [29, '針織手套'], [30, '玫瑰花束球']
];
const selected = new Set();
const grid = document.getElementById('products');
const dialog = document.getElementById('photo-dialog');
const orderForm = document.getElementById('order-form');
const paymentOptions = document.createElement('fieldset');
paymentOptions.className = 'payment-options';
paymentOptions.innerHTML = '<legend>付款方式</legend><label><input type="radio" name="paymentMethod" value="card" checked> 信用卡／金融卡（Stripe）</label><label><input type="radio" name="paymentMethod" value="bank_transfer"> 銀行轉帳</label>';
orderForm.insertBefore(paymentOptions, orderForm.querySelector('.import-confirm'));
let priceLabel = 'NT$1,499';
const priceNodes = [];
function collectPriceNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (/NT\$[\d,]/.test(node.nodeValue)) priceNodes.push(node);
    return;
  }
  if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;
  for (const child of node.childNodes) collectPriceNodes(child);
}
function applyPrice() {
  document.querySelector('#order .order-grid > div:first-child p').textContent = `任選五款 ${priceLabel}，含從日本寄送至台灣。選好五款並填寫收件資料後，可使用信用卡／金融卡透過 Stripe 付款，或選擇銀行轉帳。確認款項後開始製作，並在 3 個工作日內完成、提供快遞單號。`;
  document.querySelector('#order-help > p').textContent = `價格 ${priceLabel}，含寄送至台灣。填寫資料後選擇信用卡付款或銀行轉帳。`;
  document.querySelector('.selected > small').textContent = `填寫台灣收件資料後，可選擇信用卡付款或銀行轉帳。總金額 ${priceLabel}，含運費。`;
  priceNodes.length = 0;
  collectPriceNodes(document.body);
  for (const node of priceNodes)
    node.nodeValue = node.nodeValue.replace(/NT\$[\d,]+(?:\.\d{2})?/g, match => priceLabel + (/^\.\d{2}$/.test(match.slice(match.lastIndexOf('.'))) ? match.slice(match.lastIndexOf('.')) : ''));
  document.title = document.title.replace(/NT\$[\d,]+(?:\.\d{2})?/g, match => priceLabel + (/^\.\d{2}$/.test(match.slice(match.lastIndexOf('.'))) ? match.slice(match.lastIndexOf('.')) : ''));
}
applyPrice();
let activePhoto = null;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const staticImages = n => {
  const num = String(n).padStart(2, '0');
  return {
    lit: `/candles/images/lit-${num}.jpeg`,
    studio: `/candles/images/studio-${num}.jpeg`,
    original: `/candles/images/candle-${num}.jpeg`,
    box: n === 20 ? '/candles/images/box-20.jpeg' : null,
  };
};
function showScene(scene) {
  if (!activePhoto) return;
  const img = document.getElementById('dialog-image');
  img.src = scene === 'studio' ? (activePhoto.studio || activePhoto.lit) : activePhoto.lit;
  img.alt = `${scene === 'lit' ? '點燃情境圖' : '乾淨背景圖'} of ${activePhoto.name}`;
  document.getElementById('dialog-media').classList.toggle('studio', scene === 'studio');
  for (const button of dialog.querySelectorAll('[data-scene]'))
    button.setAttribute('aria-pressed', String(button.dataset.scene === scene));
}
for (const button of dialog.querySelectorAll('[data-scene]'))
  button.addEventListener('click', () => showScene(button.dataset.scene));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
function addCard(product) {
  const { n, name, sku, lit, original, box } = product;
  const safeName = escapeHtml(name);
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = String(n);
  card.innerHTML = `<button class="photo-trigger" type="button" aria-label="放大照片： ${safeName}"><img class="photo lit" src="${lit}" alt="點燃情境圖 of ${safeName}" loading="lazy"></button>
    <div class="card-body"><div class="sku">${escapeHtml(sku)}</div><div class="name">${safeName}</div>
      <button class="pick" type="button" aria-pressed="false" aria-label="Select ${safeName}">選這款</button>
    </div>`;
  card.querySelector('.photo-trigger').addEventListener('click', () => {
    activePhoto = product;
    document.getElementById('dialog-title').textContent = `${sku} · ${name}`;
    document.getElementById('dialog-original').href = original;
    const boxLink = document.getElementById('dialog-box');
    boxLink.hidden = !box;
    if (box) boxLink.href = box;
    showScene('lit');
    dialog.showModal();
  });
  card.querySelector('.pick').addEventListener('click', () => {
    if (selected.has(n)) selected.delete(n);
    else if (selected.size < 5) selected.add(n);
    else { document.getElementById('order').scrollIntoView({ behavior: 'smooth' }); return; }
    update();
  });
  grid.append(card);
}
for (const [n, name, customSku] of data)
  addCard({ n, name, sku: customSku || `RZ-C${String(n).padStart(3, '0')}`, ...staticImages(n) });
function update() {
  document.getElementById('order-help').hidden = true;
  document.getElementById('inline-count').textContent = `${selected.size} / 5`;
  document.getElementById('order-count').textContent = `${selected.size} / 5`;
  document.getElementById('sticky-count').textContent = selected.size;
  document.getElementById('sticky').hidden = selected.size === 0;
  const chosen = data.filter(([n]) => selected.has(n));
  const list = document.getElementById('selection');
  list.replaceChildren();
  if (!chosen.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '請先選五款蠟燭。';
    list.append(li);
  }
  for (const [n, name, customSku] of chosen) {
    const li = document.createElement('li');
    li.textContent = name;
    const span = document.createElement('span');
    span.textContent = customSku || `RZ-C${String(n).padStart(3, '0')}`;
    li.append(span);
    list.append(li);
  }
  const btn = document.getElementById('inquire');
  btn.disabled = selected.size !== 5;
  btn.textContent = selected.size === 5 ? '填寫台灣收件資料' : `還需選 ${5 - selected.size} 款`;
  for (const card of grid.children) {
    const on = selected.has(Number(card.dataset.id));
    card.classList.toggle('chosen', on);
    const b = card.querySelector('.pick');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '✓ 已選 · 點擊取消' : '選這款';
  }
}
document.getElementById('inquire').addEventListener('click', () => {
  if (selected.size !== 5) return;
  const panel = document.getElementById('order-help');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('customer-name').focus({ preventScroll: true });
});
document.getElementById('order-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (selected.size !== 5) return;
  const form = event.currentTarget;
  const status = document.getElementById('order-status');
  const button = document.getElementById('submit-order');
  const fields = Object.fromEntries(new FormData(form));
  const payload = { ...fields, items: [...selected].sort((a, b) => a - b) };
  status.textContent = '正在送出台灣訂單…';
  button.disabled = true;
  try {
    const response = await fetch('/api/candles/orders/tw', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '請稍後再試。');
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    document.getElementById('order-reference').textContent = result.orderNumber;
    document.getElementById('notification-warning').hidden = result.notificationSent === true;
    form.hidden = true;
    document.getElementById('order-success').hidden = false;
    document.getElementById('inquire').disabled = true;
    status.textContent = '';
  } catch (error) {
    status.textContent = `訂單尚未送出。 ${error.message} 請保持此頁開啟並重試。`;
    button.disabled = false;
  }
});

// Stripe 刷卡完成後回到 /candles-tw/?payment=success&session_id=…
if (new URLSearchParams(location.search).get('payment') === 'success') {
  const notice = document.createElement('div');
  notice.className = 'paid-notice';
  notice.setAttribute('role', 'status');
  notice.innerHTML = `<div class="wrap"><h2>已收到您的付款 · 謝謝</h2><p>信用卡付款 ${priceLabel} 已完成，收據已寄到您的信箱。我們會立即開始製作您的五款蠟燭，並在 3 個工作天內提供快遞追蹤編號。您不需要再做任何事。</p></div>`;
  document.getElementById('top').prepend(notice);
  window.scrollTo({ top: 0 });
}
function focusRequestedProduct() {
  const id = new URLSearchParams(location.search).get('product');
  if (!id) return;
  const card = grid.querySelector(`.card[data-id="${id.replace(/[^0-9]/g, '')}"]`);
  if (!card) return;
  card.classList.add('focused');
  card.scrollIntoView({ block: 'center' });
}

// 後台新增／改名的商品與售價以 /api/candles/products 為準；讀不到時沿用上方寫死的內容。
fetch('/api/candles/products', { headers: { accept: 'application/json' } })
  .then(response => (response.ok ? response.json() : null))
  .then(catalog => {
    if (!catalog || !Array.isArray(catalog.products) || !catalog.products.length || selected.size) return;
    if (catalog.prices?.twd) {
      priceLabel = `NT$${catalog.prices.twd.toLocaleString('en-US')}`;
      applyPrice();
    }
    data.length = 0;
    grid.replaceChildren();
    for (const product of catalog.products) {
      const fallback = staticImages(product.id);
      data.push([product.id, product.nameTw || product.name, product.sku]);
      addCard({
        n: product.id,
        name: product.nameTw || product.name,
        sku: product.sku,
        lit: product.lit || fallback.lit,
        studio: product.studio || fallback.studio,
        original: product.original || fallback.original,
        box: product.box || fallback.box,
      });
    }
    update();
    focusRequestedProduct();
  })
  .catch(() => { /* 保持寫死的商品清單 */ });
focusRequestedProduct();
