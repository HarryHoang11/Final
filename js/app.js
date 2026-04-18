// ====================================================
// APP.JS - Core Utilities & Firebase Config
// ====================================================

const firebaseConfig = {
  apiKey: "AIzaSyC6YriuZw9PbYDHlVifE2K6iXz2d7FqZDk",
  authDomain: "project-85fd3.firebaseapp.com",
  projectId: "project-85fd3",
  storageBucket: "project-85fd3.appspot.com",
  messagingSenderId: "964555570847",
  appId: "1:964555570847:web:e1a3c1077b6b020e2aecaa",
  measurementId: "G-TEJLCZ68XF"
};

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}

const API_BASE = window.location.origin + "/api";

// ── FORMAT PRICE ──────────────────────────────────
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0
  }).format(price);
}

// ── CATEGORY DATA ─────────────────────────────────
const CATEGORY_ICONS = {
  laptop: "💻",
  phone: "📱",
  headphones: "🎧",
  accessories: "🔌",
  all: "🛍️"
};

const CATEGORY_LABELS = {
  laptop: "Laptop",
  phone: "Điện thoại",
  headphones: "Tai nghe",
  accessories: "Phụ kiện"
};

// ── TOAST ─────────────────────────────────────────
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// ── PRODUCT CARD ──────────────────────────────────
function createProductCard(product) {
  const icon = CATEGORY_ICONS[product.category] || "📦";
  const label = CATEGORY_LABELS[product.category] || product.category;
  // FIX: escape single quotes in product name for onclick
  const safeName = (product.name || '').replace(/'/g, "\\'");
  const safeImg = (product.imageUrl || '').replace(/'/g, "\\'");

  return `
  <div class="product-card" onclick="window.location='/product/${product.id}'">
    <div class="product-card-image">
      ${product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy">`
        : `<div class="no-image"><span>${icon}</span></div>`
      }
      <span class="product-card-badge">${label}</span>
    </div>
    <div class="product-card-body">
      <div class="product-card-category">${label}</div>
      <h3 class="product-card-name">${product.name}</h3>
      <p class="product-card-desc">${product.description || "Không có mô tả"}</p>
      <div class="product-card-footer">
        <div class="product-price">${formatPrice(product.price)}</div>
        <button class="btn-add-cart"
          onclick="event.stopPropagation(); addToCart('${product.id}', '${safeName}', ${product.price}, '${safeImg}')">
          + Giỏ hàng
        </button>
      </div>
    </div>
  </div>
  `;
}
window.createProductCard = createProductCard;

// ── PAGE DETECTOR ─────────────────────────────────
function getCurrentPage() {
  const path = window.location.pathname;
  if (path === "/" || path === "/index.html") return "home";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/product/")) return "product-detail";
  if (path === "/cart") return "cart";
  if (path === "/login") return "login";
  if (path === "/register") return "register";
  if (path === "/admin") return "admin";
  return "unknown";
}
