// ====================================================
// AUTH.JS - Firebase Authentication
// ====================================================

const auth = firebase.auth();
const db = firebase.firestore();

window.currentUser = null;
window.idToken = null;
window.userRole = null;

// ── SESSION TIMEOUT (15 phút) ─────────────────────
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
let sessionTimer = null;

function resetSessionTimer() {
  clearTimeout(sessionTimer);
  if (window.currentUser) {
    sessionTimer = setTimeout(() => {
      showToast("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", "info");
      auth.signOut().then(() => {
        setTimeout(() => window.location.href = "/login", 1500);
      });
    }, SESSION_TIMEOUT_MS);
  }
}

// Reset timer on user activity
['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
  document.addEventListener(event, resetSessionTimer, { passive: true });
});

// ── AUTH STATE ────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  window.currentUser = user;
  if (user) {
    window.idToken = await user.getIdToken();
    resetSessionTimer();
  } else {
    window.idToken = null;
    clearTimeout(sessionTimer);
  }
  // FIX: đợi DOM + inline scripts load xong rồi mới update navbar
  // Dùng setTimeout(0) để đẩy sau call stack hiện tại
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => updateNavbarAuth(user), 0);
    });
  } else {
    // DOM đã ready, nhưng inline scripts có thể chưa chạy
    // requestAnimationFrame đảm bảo chạy sau tất cả scripts đồng bộ
    requestAnimationFrame(() => updateNavbarAuth(user));
  }
});

// ── AUTH HEADER ───────────────────────────────────
async function getAuthHeader() {
  if (!window.currentUser) return {};
  const token = await window.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// ── API CALL ──────────────────────────────────────
async function apiCall(method, endpoint, data = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeader())
  };

  const options = { method, headers };
  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(API_BASE + endpoint, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API Error");
  }

  return res.json();
}

// ── NAVBAR ────────────────────────────────────────
async function updateNavbarAuth(user) {
  // Lấy role + displayName từ Firestore trong 1 lần gọi
  let role = 'user';
  let displayName = null;
  if (user) {
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (snap.exists) {
        role = snap.data().role || 'user';
        displayName = snap.data().displayName || null;
      }
    } catch (e) {
      console.warn('Không lấy được thông tin user:', e);
    }
    window.userRole = role;
  } else {
    window.userRole = null;
  }

  const name = user
    ? (displayName || user.displayName || user.email?.split('@')[0] || 'User')
    : null;

  // ── 1. Navbar cũ (Bootstrap collapse) — id="navbar-auth" ──
  const legacyNav = document.getElementById('navbar-auth');
  if (legacyNav) {
    if (user) {
      legacyNav.innerHTML = `
        <a href="/cart" class="cart-btn d-flex align-items-center gap-2 text-decoration-none text-white">
          <i class="bi bi-cart3 fs-5"></i>
          <span>Giỏ hàng</span>
          <span class="cart-count badge bg-warning text-dark fw-bold" id="cart-count">0</span>
        </a>
        ${role === 'admin' ? `<a href="/admin" class="btn btn-warning btn-sm"><i class="bi bi-gear-fill me-1"></i>Admin</a>` : ''}
        <span class="text-light small d-none d-md-inline">${name}</span>
        <button onclick="signOutUser()" class="btn btn-outline-light btn-sm">Đăng xuất</button>
      `;
    } else {
      legacyNav.innerHTML = `
        <a href="/cart" class="cart-btn d-flex align-items-center gap-2 text-decoration-none text-white">
          <i class="bi bi-cart3 fs-5"></i>
          <span>Giỏ hàng</span>
          <span class="cart-count badge bg-warning text-dark fw-bold" id="cart-count">0</span>
        </a>
        <a href="/login" class="btn btn-outline-light btn-sm">Đăng nhập</a>
      `;
    }
  }

  // ── 2. Navbar mới (custom drawer) — id="navbar-auth-desktop" ──
  const desktopNav = document.getElementById('navbar-auth-desktop');
  if (desktopNav) {
    if (user) {
      desktopNav.innerHTML = `
        <a href="/cart" style="display:flex;align-items:center;gap:6px;color:var(--text-primary);text-decoration:none;font-size:14px;padding:7px 12px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;white-space:nowrap;transition:all 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <i class="bi bi-cart3"></i>
          <span class="d-none d-sm-inline">Giỏ hàng</span>
          <span class="cart-badge" id="cart-count" style="background:var(--warning);color:#000;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;display:none">0</span>
        </a>
        ${role === 'admin' ? `<a href="/admin" style="display:flex;align-items:center;gap:5px;font-size:13px;padding:7px 12px;border-radius:8px;background:#f59e0b;color:#000;text-decoration:none;font-weight:600;white-space:nowrap"><i class="bi bi-gear-fill"></i>Admin</a>` : ''}
        <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis" class="d-none d-md-inline">${name}</span>
        <button onclick="signOutUser()" style="font-size:13px;padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text-primary);cursor:pointer;white-space:nowrap;transition:all 0.15s" onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-primary)'">Đăng xuất</button>
      `;
    } else {
      desktopNav.innerHTML = `
        <a href="/cart" style="display:flex;align-items:center;gap:6px;color:var(--text-primary);text-decoration:none;font-size:14px;padding:7px 12px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;white-space:nowrap" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <i class="bi bi-cart3"></i>
          <span class="d-none d-sm-inline">Giỏ hàng</span>
          <span class="cart-badge" id="cart-count" style="background:var(--warning);color:#000;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;display:none">0</span>
        </a>
        <a href="/login" style="font-size:13px;padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text-primary);text-decoration:none;white-space:nowrap">Đăng nhập</a>
        <a href="/register" style="font-size:13px;padding:7px 14px;border-radius:8px;background:var(--accent);border:none;color:white;text-decoration:none;white-space:nowrap">Đăng ký</a>
      `;
    }
  }

  // ── 3. Mobile drawer auth — id="drawer-auth" ──
  const drawerAuth = document.getElementById('drawer-auth');
  if (drawerAuth) {
    if (user) {
      drawerAuth.innerHTML = `
        <div style="padding:10px 14px;font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:8px;width:100%;border-radius:8px;background:rgba(255,255,255,0.03)">
          <i class="bi bi-person-circle fs-5 text-primary"></i>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
          ${role === 'admin' ? `<a href="/admin" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#f59e0b;color:#000;text-decoration:none;font-weight:600;flex-shrink:0">Admin</a>` : ''}
          <button onclick="signOutUser()" style="font-size:12px;padding:5px 12px;border-radius:7px;background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text-primary);cursor:pointer;flex-shrink:0">Đăng xuất</button>
        </div>
      `;
    } else {
      drawerAuth.innerHTML = `
        <a href="/login" style="flex:1;text-align:center;padding:10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text-primary);text-decoration:none;font-size:14px;font-weight:500">Đăng nhập</a>
        <a href="/register" style="flex:1;text-align:center;padding:10px;border-radius:8px;background:var(--accent);color:white;text-decoration:none;font-size:14px;font-weight:500">Đăng ký</a>
      `;
    }
  }

  // ── 4. Sync cart count ──
  loadCartCount();
}

// ── SIGN UP ───────────────────────────────────────
async function signUp(email, password, displayName) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });
  await db.collection('users').doc(cred.user.uid).set({
    id: cred.user.uid,
    email,
    displayName,
    role: 'user',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return cred.user;
}

// ── SIGN IN ───────────────────────────────────────
async function signIn(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// ── SOCIAL SIGN IN ────────────────────────────────
async function signInWithProvider(provider) {
  const cred = await auth.signInWithPopup(provider);
  const user = cred.user;
  if (!user) throw new Error('Lỗi xác thực nhà cung cấp');

  const docRef = db.collection('users').doc(user.uid);
  const snap = await docRef.get();
  const role = user.email === 'admin@techstore.vn' ? 'admin' : 'user';

  if (!snap.exists) {
    await docRef.set({
      id: user.uid,
      email: user.email,
      displayName: user.displayName || 'Người dùng',
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      provider: provider.providerId
    });
  } else {
    await docRef.set({
      id: user.uid,
      email: user.email,
      displayName: user.displayName || snap.data().displayName || 'Người dùng',
      role: snap.data().role || role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      provider: provider.providerId
    }, { merge: true });
  }
  return user;
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return signInWithProvider(provider);
}

async function signInWithFacebook() {
  const provider = new firebase.auth.FacebookAuthProvider();
  return signInWithProvider(provider);
}

// ── SIGN OUT ──────────────────────────────────────
async function signOutUser() {
  clearTimeout(sessionTimer);
  await auth.signOut();
  saveLocalCart([]);
  showToast("Đã đăng xuất", "info");
  setTimeout(() => window.location.href = "/", 500);
}

// ── REQUIRE AUTH ──────────────────────────────────
function requireAuth(redirectUrl = "/login") {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      if (!user) {
        window.location.href = redirectUrl;
      } else {
        resolve(user);
      }
    });
  });
}

// ── REQUIRE ADMIN ─────────────────────────────────
async function requireAdmin() {
  const user = await requireAuth();
  const docRef = db.collection('users').doc(user.uid);
  const snap = await docRef.get();

  const adminEmails = ['admin@techstore.vn'];
  if ((!snap.exists || snap.data().role !== 'admin') && adminEmails.includes(user.email)) {
    await docRef.set({
      id: user.uid,
      email: user.email,
      displayName: user.displayName || 'Admin',
      role: 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return user;
  }

  if (!snap.exists || snap.data().role !== 'admin') {
    showToast('Bạn không có quyền truy cập trang này', 'error');
    setTimeout(() => window.location.href = '/', 1500);
    return null;
  }

  return user;
}

// ── LOCAL CART ────────────────────────────────────
function getLocalCart() {
  try {
    return JSON.parse(localStorage.getItem("techstore_cart") || "[]");
  } catch {
    return [];
  }
}

function saveLocalCart(items) {
  localStorage.setItem("techstore_cart", JSON.stringify(items));
  loadCartCount();
}

// ── CART COUNT ────────────────────────────────────
function loadCartCount() {
  const cart = getLocalCart();
  const total = cart.reduce((sum, item) => sum + item.qty, 0);

  // Update tất cả elements có id chứa "cart-count" (cả navbar cũ + mới + mobile)
  document.querySelectorAll('[id*="cart-count"]').forEach(el => {
    el.textContent = total;
    // Bootstrap badge dùng class "show", custom badge dùng display style
    if (el.classList.contains('cart-badge') || el.classList.contains('cart-count')) {
      if (total > 0) {
        el.classList.add('show');
        el.style.display = 'inline-block';
      } else {
        el.classList.remove('show');
        el.style.display = 'none';
      }
    } else {
      // badge style Bootstrap
      if (total > 0) { el.classList.add('show'); }
      else { el.classList.remove('show'); }
    }
  });
}

// ── ADD TO CART ───────────────────────────────────
// FIX: addToCart now receives all params correctly from createProductCard
async function addToCart(productId, name, price, imageUrl) {
  let cart = getLocalCart();
  const existing = cart.find((i) => i.productId === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ productId, name, price: Number(price), imageUrl: imageUrl || '', qty: 1 });
  }

  saveLocalCart(cart);

  if (window.currentUser) {
    try { await apiCall("POST", "/cart", { items: cart }); } catch (e) {}
  }

  showToast(`✅ Đã thêm "${name}" vào giỏ hàng`, "success");
  loadCartCount();
}

// Expose globals
window.signUp = signUp;
window.signIn = signIn;
window.signInWithGoogle = signInWithGoogle;
window.signInWithFacebook = signInWithFacebook;
window.signOutUser = signOutUser;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.addToCart = addToCart;
window.updateNavbarAuth = updateNavbarAuth;
window.apiCall = apiCall;
window.getLocalCart = getLocalCart;
window.saveLocalCart = saveLocalCart;
window.loadCartCount = loadCartCount;