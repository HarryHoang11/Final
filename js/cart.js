// ====================================================
// CART.JS - Shopping Cart Logic
// ====================================================

let cartItems = [];

async function initCart() {
  cartItems = getLocalCart();

  if (window.currentUser) {
    try {
      const serverCart = await apiCall('GET', '/cart');
      if (serverCart.items && serverCart.items.length > 0) {
        cartItems = serverCart.items;
        saveLocalCart(cartItems);
      }
    } catch (e) {
      console.log('Could not sync cart from server');
    }
  }

  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const emptyState = document.getElementById('cart-empty');
  const cartContent = document.getElementById('cart-content');

  if (!container) return;

  if (cartItems.length === 0) {
    if (emptyState) emptyState.classList.remove('d-none');
    if (cartContent) cartContent.classList.add('d-none');
    updateSummary();
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (cartContent) cartContent.classList.remove('d-none');

  container.innerHTML = cartItems.map(item => `
    <div class="list-group-item" id="cart-item-${item.productId}">
      <div class="d-flex gap-3 align-items-center">
        <div style="width:80px;height:80px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#f3f4f6">
          ${item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">📦</div>`
          }
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold">${item.name}</div>
          <div class="text-primary">${formatPrice(item.price)}</div>
          <div class="d-flex align-items-center gap-2 mt-2">
            <button class="btn btn-outline-secondary btn-sm" onclick="changeQty('${item.productId}', -1)">−</button>
            <span class="fw-bold">${item.qty}</span>
            <button class="btn btn-outline-secondary btn-sm" onclick="changeQty('${item.productId}', 1)">+</button>
          </div>
        </div>
        <div class="d-flex flex-column align-items-end gap-2">
          <div class="fw-bold text-primary">${formatPrice(item.price * item.qty)}</div>
          <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.productId}')">
            🗑️ Xóa
          </button>
        </div>
      </div>
    </div>
  `).join('');

  updateSummary();
}

function changeQty(productId, delta) {
  const item = cartItems.find(i => i.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cartItems = cartItems.filter(i => i.productId !== productId);
  saveCart();
  renderCart();
  showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
}

function updateSummary() {
  const subtotal = cartItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const shipping = subtotal > 0 ? 30000 : 0;
  const total = subtotal + shipping;

  const subEl = document.getElementById('subtotal');
  const shipEl = document.getElementById('shipping');
  const totalEl = document.getElementById('total');
  const totalBadge = document.getElementById('total-items');

  if (subEl) subEl.textContent = formatPrice(subtotal);
  if (shipEl) shipEl.textContent = subtotal > 0 ? formatPrice(shipping) : 'Miễn phí';
  if (totalEl) totalEl.textContent = formatPrice(total);
  if (totalBadge) totalBadge.textContent = `${cartItems.reduce((s, i) => s + i.qty, 0)} sản phẩm`;

  loadCartCount();
}

async function saveCart() {
  saveLocalCart(cartItems);
  if (window.currentUser) {
    try { await apiCall('POST', '/cart', { items: cartItems }); } catch (e) {}
  }
}

async function checkout() {
  if (!window.currentUser) {
    showToast('Vui lòng đăng nhập để đặt hàng', 'error');
    setTimeout(() => window.location.href = '/login', 1500);
    return;
  }

  if (cartItems.length === 0) {
    showToast('Giỏ hàng trống!', 'error');
    return;
  }

  const total = cartItems.reduce((sum, i) => sum + (i.price * i.qty), 0) + 30000;

  try {
    const order = await apiCall('POST', '/orders', { products: cartItems, total });
    cartItems = [];
    saveLocalCart([]);
    renderCart();
    showToast('🎉 Đặt hàng thành công! Mã đơn: ' + order.id.slice(0, 8), 'success');
    setTimeout(() => window.location.href = '/', 2000);
  } catch (e) {
    showToast('Lỗi đặt hàng: ' + e.message, 'error');
  }
}

// FIX: use auth state ready, not a fixed timeout
document.addEventListener('DOMContentLoaded', () => {
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(() => {
      setTimeout(initCart, 300);
    });
  } else {
    setTimeout(initCart, 800);
  }
});
