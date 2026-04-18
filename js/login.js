// ====================================================
// LOGIN.JS
// ====================================================

// FIX: use auth state instead of relying on window.currentUser being set
document.addEventListener("DOMContentLoaded", () => {
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
      if (user) window.location.href = "/";
    });
  }
});

async function doLogin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");
  const errEl = document.getElementById("error-msg");

  if (!email || !password) {
    showError("Vui lòng nhập đầy đủ thông tin");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Đang đăng nhập...";
  errEl.classList.add("hidden");

  try {
    await signIn(email, password);
    showToast("Đăng nhập thành công!", "success");
    const redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
    setTimeout(() => window.location.href = redirect, 800);
  } catch (err) {
    const msgs = {
      "auth/user-not-found": "Email không tồn tại",
      "auth/wrong-password": "Mật khẩu không đúng",
      "auth/too-many-requests": "Quá nhiều lần thử. Vui lòng thử lại sau",
      "auth/invalid-email": "Email không hợp lệ",
      "auth/invalid-credential": "Email hoặc mật khẩu không đúng",
    };
    showError(msgs[err.code] || err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Đăng nhập";
  }
}

async function doSignInGoogle() {
  try {
    document.getElementById("login-btn").disabled = true;
    await signInWithGoogle();
    showToast("Đăng nhập bằng Google thành công!", "success");
    window.location.href = "/";
  } catch (err) {
    showError(err.message || "Lỗi đăng nhập Google");
    document.getElementById("login-btn").disabled = false;
  }
}

async function doSignInFacebook() {
  try {
    document.getElementById("login-btn").disabled = true;
    await signInWithFacebook();
    showToast("Đăng nhập bằng Facebook thành công!", "success");
    window.location.href = "/";
  } catch (err) {
    showError(err.message || "Lỗi đăng nhập Facebook");
    document.getElementById("login-btn").disabled = false;
  }
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = "⚠️ " + msg;
  el.classList.remove("hidden");
}

function togglePwd(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

function fillDemo(type) {
  if (type === "admin") {
    document.getElementById("email").value = "admin@techstore.vn";
    document.getElementById("password").value = "admin123";
  } else {
    document.getElementById("email").value = "user@techstore.vn";
    document.getElementById("password").value = "user123";
  }
}
