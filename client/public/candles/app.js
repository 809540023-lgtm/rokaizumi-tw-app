const data = [
  [1, 'Elephant'], [2, 'Golden Retriever Pair (2 dogs)'],
  [20, 'Christmas Snowman & Trees', 'RZ-C026'], [21, 'Macaron Dessert Bowl'],
  [3, 'Puppy in Egg'],
  [5, 'Iced Latte'], [7, 'Strawberry Shake'], [8, 'Cherry Shake'],
  [9, 'Pineapple Juice'], [10, 'Passion Fruit Drink'], [13, 'Green Jelly'],
  [14, 'Blue Jelly'], [15, 'Grey & White Flowers'], [16, 'Floral Tower 1'],
  [17, 'Floral Tower 2'], [25, 'Sleeping Bear & Chocolate'],
  [27, 'Fruit & Flower Cake'], [28, 'Strawberry Cake'],
  [29, 'Knitted Mitten + Yarn Ball (1 of each)'], [30, 'Rose Ball (1 candle · random colour)']
];
// Fill these five labels when the scent list is confirmed. The dropdown stays hidden until all five are ready.
const scentOptions = [
  { value: 'scent-white-floral', label: 'A. White Floral' },
  { value: 'scent-relaxing-herb', label: 'B. Relaxing Herb' },
  { value: 'scent-sweet-berry', label: 'C. Sweet Berry' },
  { value: 'scent-citrus-mint', label: 'D. Citrus Mint' },
  { value: 'scent-unscented', label: 'E. Unscented' },
];
const selected = new Set();
let orderPlaced = false;
let submitting = false;
const grid = document.getElementById('products');
const dialog = document.getElementById('photo-dialog');
const orderForm = document.getElementById('order-form');
const paymentOptions = document.createElement('fieldset');
paymentOptions.className = 'payment-options';
paymentOptions.innerHTML = '<legend>Payment method</legend><label><input type="radio" name="paymentMethod" value="card" checked disabled> Credit / debit card via Stripe</label><label><input type="radio" name="paymentMethod" value="paypal" disabled> PayPal</label><small id="payment-method-status" role="status">Checking secure payment options…</small>';
const readyScentOptions = scentOptions.filter(option => option.label.trim());
if (readyScentOptions.length === 5) {
  const scentLabel = document.createElement('label');
  scentLabel.htmlFor = 'scent-choice';
  scentLabel.textContent = 'Choose one fragrance for your set';
  const scentSelect = document.createElement('select');
  scentSelect.id = 'scent-choice';
  scentSelect.name = 'scent';
  scentSelect.required = true;
  scentSelect.setAttribute('aria-describedby', 'scent-help');
  scentSelect.add(new Option('Choose a fragrance', ''));
  for (const option of readyScentOptions)
    scentSelect.add(new Option(option.label, option.value));
  const scentHelp = document.createElement('small');
  scentHelp.id = 'scent-help';
  scentHelp.textContent = 'One fragrance will be used for all five candles.';
  const noteLabel = orderForm.querySelector('label[for="order-note"]');
  orderForm.insertBefore(scentLabel, noteLabel);
  orderForm.insertBefore(scentSelect, noteLabel);
  orderForm.insertBefore(scentHelp, noteLabel);
}
orderForm.insertBefore(paymentOptions, orderForm.querySelector('.import-confirm'));
let paymentDescription = "card";
let priceLabel = 'A$99';
const priceNodes = [];
function collectPriceNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (/A\$[\d,]/.test(node.nodeValue)) priceNodes.push(node);
    return;
  }
  if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;
  for (const child of node.childNodes) collectPriceNodes(child);
}
function applyPrice() {
  document.querySelector('#order .order-grid > div:first-child p').textContent = `Choose five designs for ${priceLabel}, with delivery to Australia included. Pay by ${paymentDescription}; we begin making your set after payment. Your tracking number is provided within 3 business days of payment. Delivery time is additional.`;
  document.querySelector('#order-help > p').textContent = `Delivery to Australia · ${priceLabel} total. Choose your payment method after entering your details.`;
  document.querySelector('#order .selected > small').textContent = `No sign-up. ${priceLabel} total, including delivery. Pay by ${paymentDescription}.`;
  setSubmitLabel();
  priceNodes.length = 0;
  collectPriceNodes(document.body);
  for (const node of priceNodes) {
    node.nodeValue = node.nodeValue.replace(/A\$[\d,]+(?:\.\d{2})?/g, match => {
      const cents = /\.\d{2}$/.test(match) ? match.slice(match.lastIndexOf('.')) : '';
      return priceLabel + cents;
    });
  }
  document.title = document.title.replace(/A\$[\d,]+(?:\.\d{2})?/g, match => {
    const cents = /\.\d{2}$/.test(match) ? match.slice(match.lastIndexOf('.')) : '';
    return priceLabel + cents;
  });
}
function setSubmitLabel() {
  document.getElementById('submit-order').textContent = paymentOptions.querySelector('input:checked').value !== 'bank_transfer' ? `Continue to secure payment · ${priceLabel}` : `Place order · ${priceLabel}`;
}
applyPrice();
paymentOptions.addEventListener('change', setSubmitLabel);
fetch('/api/candles/orders/payment-methods', { headers: { accept: 'application/json' } })
  .then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
  .then(methods => {
    const available = [];
    for (const [method, label] of [['card', 'card'], ['paypal', 'PayPal']]) {
      const input = paymentOptions.querySelector(`input[value="${method}"]`);
      input.disabled = methods[method] !== true;
      input.parentElement.title = input.disabled ? 'Temporarily unavailable' : '';
      if (!input.disabled) available.push(label);
    }
    paymentDescription = available.join(' or ') || 'card';
    if (methods.card) paymentOptions.querySelector('input[value="card"]').checked = true;
    else if (methods.paypal) paymentOptions.querySelector('input[value="paypal"]').checked = true;
    document.getElementById('payment-method-status').textContent = 'Secure checkout opens after you place your order. Card details stay with the payment provider.';
    applyPrice();
  })
  .catch(() => { document.getElementById('payment-method-status').textContent = 'Online payment availability could not be checked. Please try again in a moment.'; });

let activePhoto = null;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const staticImages = n => {
  const num = String(n).padStart(2, '0');
  const suffix = n === 29 ? '-v2' : '';
  return {
    lit: `images/lit-${num}${suffix}.jpeg`,
    studio: `images/studio-${num}${suffix}.jpeg`,
    original: `images/candle-${num}.jpeg`,
    box: n === 20 ? 'images/box-20.jpeg' : null,
  };
};
function showScene(scene) {
  if (!activePhoto) return;
  const img = document.getElementById('dialog-image');
  img.src = scene === 'studio' ? (activePhoto.studio || activePhoto.lit) : activePhoto.lit;
  img.alt = `${scene === 'lit' ? 'Illustrative lit scene' : 'Clean-background illustrative image'} of ${activePhoto.name}`;
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
  card.innerHTML = `<button class="photo-trigger" type="button" aria-label="Enlarge photos of ${safeName}"><img class="photo lit" src="${lit}" alt="Illustrative lit scene of ${safeName}" loading="lazy"></button>
    <div class="card-body"><div class="sku">${escapeHtml(sku)}</div><div class="name">${safeName}</div>
      <button class="pick" type="button" aria-pressed="false" aria-label="Select ${safeName}">Add to my five</button>
    </div>`;
  card.querySelector('.photo-trigger').addEventListener('click', () => {
    activePhoto = product;
    document.getElementById('dialog-title').textContent = `${sku} · ${name}`;
    document.getElementById('dialog-original').href = n === 29 ? product.studio : original;
    document.getElementById('dialog-original').textContent = n === 29 ? 'View unlit set illustration ↗' : 'View original photo ↗';
    const boxLink = document.getElementById('dialog-box');
    boxLink.hidden = !box;
    if (box) boxLink.href = box;
    showScene('lit');
    dialog.showModal();
  });
  card.querySelector('.pick').addEventListener('click', () => {
    if (orderPlaced || submitting) return;
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
  if (selected.size !== 5 || orderPlaced || submitting) return;
  const panel = document.getElementById('order-help');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('customer-name').focus({ preventScroll: true });
});
document.getElementById('order-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (selected.size !== 5 || orderPlaced || submitting) return;
  const form = event.currentTarget;
  const status = document.getElementById('order-status');
  const button = document.getElementById('submit-order');
  const fields = Object.fromEntries(new FormData(form));
  const scentSelect = form.querySelector('#scent-choice');
  if (scentSelect?.value) {
    const scentName = scentSelect.selectedOptions[0].textContent.trim();
    fields.note = [fields.note?.trim(), `Fragrance choice: ${scentName}`].filter(Boolean).join('\n\n');
    delete fields.scent;
  }
  const payload = { ...fields, items: [...selected].sort((a, b) => a - b) };
  submitting = true;
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
    orderPlaced = true;
    if (payload.paymentMethod !== 'bank_transfer') {
      if (result.receiptToken) {
        const query = new URLSearchParams({ order: result.orderNumber, receipt: result.receiptToken });
        history.replaceState(null, '', `${location.pathname}?${query}`);
      }
      form.hidden = true;
      document.getElementById('inquire').disabled = true;
      for (const card of grid.children) card.querySelector('.pick').disabled = true;
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      await showPaymentResult();
      return;
    }
    document.getElementById('order-reference').textContent = result.orderNumber;
    document.getElementById('payment-reference').textContent = result.orderNumber;
    const bank = result.payment.bank;
    document.getElementById('bank-holder').textContent = bank.accountHolder;
    document.getElementById('bank-bsb').textContent = bank.bsb;
    document.getElementById('bank-account').textContent = bank.accountNumber;
    document.getElementById('bank-name').textContent = bank.bankName;
    for (const card of grid.children) card.querySelector('.pick').disabled = true;
    document.getElementById('notification-warning').hidden = result.notificationSent === true;
    document.getElementById('customer-email-status').textContent = result.customerEmailSent === true
      ? `Your order confirmation and payment details have been emailed to ${payload.email}. Please check your inbox and spam folder.`
      : 'Your order is saved, but we could not email your confirmation just now. Please save the bank details and order number below. We will retry sending the email; do not submit another order.';
    form.hidden = true;
    document.getElementById('order-success').hidden = false;
    document.getElementById('inquire').disabled = true;
    document.getElementById('inquire').textContent = 'Order placed · see payment details below';
    document.getElementById('order-success').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('payment-heading').focus({ preventScroll: true });
    status.textContent = '';
  } catch (error) {
    submitting = false;
    status.textContent = `We could not confirm your order status. ${error.message} Keep this page open and check your confirmation email before trying again. If an order number was emailed to you, do not place another order; reply to that email for help.`;
    button.disabled = false;
  }
});


for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = document.getElementById(button.dataset.copy).textContent;
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = 'Copied. Paste it into your banking app.';
    } catch {
      status.textContent = 'Please select and copy the value manually: ' + value;
    }
  });
}

// A return URL never proves payment. Only the server's verified order status does.
async function showPaymentResult() {
  const params = new URLSearchParams(location.search);
  const order = params.get('order');
  const receipt = params.get('receipt');
  const payment = params.get('payment');
  if (!order && !payment) return;
  orderPlaced = true;
  const notice = document.createElement('div');
  notice.className = 'paid-notice';
  notice.setAttribute('role', 'status');
  const wrap = document.createElement('div'); wrap.className = 'wrap';
  const heading = document.createElement('h2'); heading.textContent = 'Checking your payment';
  const text = document.createElement('p'); text.textContent = 'Please keep this page open while we verify the payment. Do not pay again.';
  wrap.append(heading, text); notice.append(wrap); document.getElementById('top').prepend(notice);
  window.scrollTo({ top: 0 });
  if (!order || !receipt) {
    heading.textContent = 'Please check your payment confirmation';
    text.textContent = 'A return link alone cannot confirm payment. Check your payment confirmation email, or contact info@rokaizumi-tw.jp with your order number. Do not pay again if your payment provider shows a completed charge.';
    return;
  }
  try {
    if (payment === 'paypal') {
      const response = await fetch('/api/candles/orders/paypal/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order, receipt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment is still being verified.');
    }
    const response = await fetch(`/api/candles/orders/payment-status?${new URLSearchParams({ order, receipt })}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Payment is still being verified.');
    if (result.status === 'paid') {
      heading.textContent = 'Payment confirmed · thank you';
      text.textContent = `Order ${result.orderNumber}: your A$${Number(result.amount).toFixed(2)} payment is confirmed. Your receipt will be emailed to you. We will complete your set and provide a courier tracking number within 3 business days. Delivery time is additional.`;
    } else {
      heading.textContent = 'Order saved · awaiting payment confirmation';
      text.textContent = `Your order number is ${result.orderNumber}. ${payment === 'cancelled' ? 'Checkout was cancelled. You can resume the same order below.' : 'Payment is not yet confirmed. If you have already paid, do not pay again; refresh this page or check your email shortly.'} Please do not place another order for the same set.`;
      if (payment !== 'success' && payment !== 'paypal') {
        const resume = document.createElement('button'); resume.className = 'primary'; resume.textContent = 'Resume secure payment';
        resume.addEventListener('click', async () => {
          resume.disabled = true;
          try {
            const retry = await fetch('/api/candles/orders/checkout/resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order, receipt }) });
            const next = await retry.json();
            if (!retry.ok || !next.checkoutUrl) throw new Error(next.error || 'Payment is temporarily unavailable.');
            window.location.assign(next.checkoutUrl);
          } catch (error) { text.textContent = `Order ${order}: ${error.message}`; resume.disabled = false; }
        });
        wrap.append(resume);
      }
      const refresh = document.createElement('button'); refresh.className = 'copy-detail'; refresh.textContent = 'Check payment status again';
      refresh.addEventListener('click', () => location.reload()); wrap.append(refresh);
    }
  } catch (error) {
    heading.textContent = 'Payment verification pending';
    text.textContent = `Order ${order}: ${error.message} Do not pay again if your provider shows a completed charge. Contact info@rokaizumi-tw.jp with your order number if you need help.`;
  }
}
void showPaymentResult();
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
    if (catalog.prices?.aud) {
      priceLabel = `A$${catalog.prices.aud}`;
      applyPrice();
    }
    data.length = 0;
    grid.replaceChildren();
    for (const product of catalog.products) {
      const fallback = staticImages(product.id);
      data.push([product.id, product.name, product.sku]);
      addCard({
        n: product.id,
        name: product.name,
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
