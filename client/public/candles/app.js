const data = [
  [1, 'Elephant'], [2, 'Golden Retriever Pair (2 dogs)'], [3, 'Puppy in Egg'],
  [5, 'Iced Latte'], [7, 'Strawberry Shake'], [8, 'Cherry Shake'],
  [9, 'Pineapple Juice'], [10, 'Passion Fruit Drink'], [13, 'Green Jelly'],
  [14, 'Blue Jelly'], [15, 'Grey & White Flowers'], [16, 'Floral Tower 1'],
  [17, 'Floral Tower 2'], [20, 'Christmas Snowman & Trees', 'Christmas design'],
  [21, 'Macaron Dessert Bowl'], [25, 'Sleeping Bear & Chocolate'],
  [27, 'Fruit & Flower Cake'], [28, 'Strawberry Cake'],
  [29, 'Knitted Mittens'], [30, 'Rose Bouquet Spheres']
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
  img.src = `images/${scene}-${num}.jpeg`;
  img.alt = `${scene === 'lit' ? 'Illustrative lit scene' : 'Clean-background illustrative image'} of ${name}`;
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
  card.innerHTML = `<button class="photo-trigger" type="button" aria-label="Enlarge photos of ${name}"><img class="photo lit" src="images/lit-${num}.jpeg" alt="Illustrative lit scene of ${name}" loading="lazy"></button>
    <div class="card-body"><div class="sku">${sku}</div><div class="name">${name}</div>
      <button class="pick" type="button" aria-pressed="false" aria-label="Select ${name}">Add to my five</button>
    </div>`;
  card.querySelector('.photo-trigger').addEventListener('click', () => {
    activePhoto = [n, name];
    document.getElementById('dialog-title').textContent = `${sku} · ${name}`;
    document.getElementById('dialog-original').href = `images/candle-${num}.jpeg`;
    const boxLink = document.getElementById('dialog-box');
    boxLink.hidden = n !== 20;
    if (n === 20) boxLink.href = 'images/box-20.jpeg';
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
    li.textContent = 'Select five candle designs above.';
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
  btn.textContent = selected.size === 5 ? 'Enter delivery details' : `Choose ${5 - selected.size} more`;
  for (const card of grid.children) {
    const on = selected.has(Number(card.dataset.id));
    card.classList.toggle('chosen', on);
    const b = card.querySelector('.pick');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '✓ Selected · click to remove' : 'Add to my five';
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
  status.textContent = 'Submitting your order…';
  button.disabled = true;
  try {
    const response = await fetch('/api/candles/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    document.getElementById('order-reference').textContent = result.orderNumber;
    form.hidden = true;
    document.getElementById('order-success').hidden = false;
    document.getElementById('inquire').disabled = true;
    status.textContent = '';
  } catch (error) {
    status.textContent = `Your order was not submitted. ${error.message} Please keep this page open and try again.`;
    button.disabled = false;
  }
});
