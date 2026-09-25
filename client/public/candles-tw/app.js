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
let activePhoto = null;
function showScene(scene) {
  if (!activePhoto) return;
  const [n, name] = activePhoto;
  const num = String(n).padStart(2, '0');
  const img = document.getElementById('dialog-image');
  img.src = `/candles/images/${scene}-${num}.jpeg`;
  img.alt = `${scene === 'lit' ? '點燃情境圖' : '乾淨背景圖'} of ${name}`;
  document.getElementById('dialog-media').classList.toggle('studio', scene === 'studio');
  for (const button of dialog.querySelectorAll('[data-scene]'))
    button.setAttribute('aria-pressed', String(button.dataset.scene === scene));
}
for (const button of dialog.querySelectorAll('[data-scene]'))
  button.addEventListener('click', () => showScene(button.dataset.scene));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
for (const [n, name, customSku] of data) {
  const sku = customSku || `RZ-C${String(n).padStart(3, '0')}`;
  const num = String(n).padStart(2, '0');
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = String(n);
  card.innerHTML = `<button class="photo-trigger" type="button" aria-label="放大照片： ${name}"><img class="photo lit" src="/candles/images/lit-${num}.jpeg" alt="點燃情境圖 of ${name}" loading="lazy"></button>
    <div class="card-body"><div class="sku">${sku}</div><div class="name">${name}</div>
      <button class="pick" type="button" aria-pressed="false" aria-label="Select ${name}">選這款</button>
    </div>`;
  card.querySelector('.photo-trigger').addEventListener('click', () => {
    activePhoto = [n, name];
    document.getElementById('dialog-title').textContent = `${sku} · ${name}`;
    document.getElementById('dialog-original').href = `/candles/images/candle-${num}.jpeg`;
    const boxLink = document.getElementById('dialog-box');
    boxLink.hidden = n !== 20;
    if (n === 20) boxLink.href = '/candles/images/box-20.jpeg';
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
