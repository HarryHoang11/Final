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
  await updateNavbarAuth(user);
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
  const authSection = document.getElementById("navbar-auth");
  if (!authSection) return;

  if (user) {
    let role = "user";
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (snap.exists) role = snap.data().role || "user";
    } catch (e) {
      console.warn("Không lấy được role:", e);
    }
    window.userRole = role;

    authSection.innerHTML = `
      <a href="/cart" class="cart-btn d-flex align-items-center gap-2 text-decoration-none text-white">
        <i class="bi bi-cart3 fs-5"></i>
        <span>Giỏ hàng</span>
        <span class="cart-count badge bg-warning text-dark fw-bold" id="cart-count">0</span>
      </a>
      ${role === "admin" ? `
        <a href="/admin" class="btn btn-warning btn-sm d-flex align-items-center gap-1">
          <i class="bi bi-gear-fill"></i> Admin
        </a>` : ""}
      <div class="d-flex align-items-center gap-3">
        <span class="text-light small d-none d-md-inline">
          ${user.email?.split("@")[0] || "User"}
        </span>
        <button onclick="signOutUser()" class="btn btn-outline-light btn-sm">Đăng xuất</button>
      </div>
    `;
    loadCartCount();
  } else {
    window.userRole = null;
    authSection.innerHTML = `
      <a href="/cart" class="cart-btn d-flex align-items-center gap-2 text-decoration-none text-white">
        <i class="bi bi-cart3 fs-5"></i>
        <span>Giỏ hàng</span>
        <span class="cart-count badge bg-warning text-dark fw-bold" id="cart-count">0</span>
      </a>
      <a href="/login" class="btn btn-outline-light btn-sm">Đăng nhập</a>
    `;
    loadCartCount();
  }
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
  const countEl = document.getElementById("cart-count");
  if (!countEl) return;
  const cart = getLocalCart();
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  if (total > 0) {
    countEl.textContent = total;
    countEl.classList.add("show");
  } else {
    countEl.classList.remove("show");
  }
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
