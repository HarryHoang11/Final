// ====================================================
// ADMIN.JS - Admin Panel (Hoàn chỉnh + Fix tracking)
// ====================================================

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await requireAdmin();
    if (!user) return;
    document.getElementById("admin-email").textContent = user.email || "Admin";
    loadAdminProducts();
  } catch (err) {
    console.error("Admin initialization error:", err);
    console.warn("Chạy ở chế độ dev - bỏ qua lỗi auth");
    loadAdminProducts(); // vẫn load UI dù auth lỗi
  }
});

// ── TABS ──────────────────────────────────────────
function showTab(tab) {
  ["products", "orders", "stats", "users"].forEach((t) => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tab) ? "block" : "none";
  });

  document.querySelectorAll(".admin-nav a").forEach(a => a.classList.remove("active"));
  const activeLink = document.querySelector(`.admin-nav a[onclick="showTab('${tab}')"]`);
  if (activeLink) activeLink.classList.add("active");

  if (tab === "orders") loadOrders();
  if (tab === "stats") loadStats();
  if (tab === "users") loadUsers();
}

// ── PRODUCTS ──────────────────────────────────────
async function loadAdminProducts() {
  const loading = document.getElementById("products-table-loading");
  const wrap = document.getElementById("products-table-wrap");
  const tbody = document.getElementById("products-table-body");

  loading.style.display = "block";
  wrap.style.display = "none";

  try {
    const data = await apiCall("GET", "/products?limit=100");
    loading.style.display = "none";
    wrap.style.display = "block";

    if (!data.products || data.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Chưa có sản phẩm nào</td></tr>`;
      return;
    }

    tbody.innerHTML = data.products.map(p => `
      <tr>
        <td>
          <div style="width:50px;height:50px;background:#f3f4f6;border-radius:8px;overflow:hidden">
            ${p.imageUrl
              ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">${CATEGORY_ICONS[p.category] || "📦"}</div>`}
          </div>
        </td>
        <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${p.name}</td>
        <td><span class="badge bg-primary">${CATEGORY_LABELS[p.category] || p.category}</span></td>
        <td style="color:#3b82f6;font-weight:600">${formatPrice(p.price)}</td>
        <td>${p.stock ?? 0}</td>
        <td>
          <button class="btn btn-secondary btn-sm me-1" onclick="editProduct('${p.id}')">✏️ Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${(p.name || '').replace(/'/g, "\\'")}')">🗑️ Xóa</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
    loading.innerHTML = `<p class="text-danger">Lỗi tải sản phẩm: ${err.message}</p>`;
  }
}

// ── PRODUCT MODAL ─────────────────────────────────
function openProductModal(product = null) {
  document.getElementById("modal-title").textContent = product ? "Sửa sản phẩm" : "Thêm sản phẩm";
  document.getElementById("edit-product-id").value = product ? product.id : "";
  document.getElementById("product-name").value = product ? product.name : "";
  document.getElementById("product-price").value = product ? product.price : "";
  document.getElementById("product-stock").value = product ? (product.stock || 0) : "";
  document.getElementById("product-category").value = product ? product.category : "";
  document.getElementById("product-description").value = product ? (product.description || "") : "";
  document.getElementById("product-image-url").value = product ? (product.imageUrl || "") : "";
  document.getElementById("image-filename").textContent = "Chưa chọn ảnh";
  document.getElementById("modal-error").classList.add("d-none");

  const preview = document.getElementById("image-preview");
  if (product && product.imageUrl) {
    preview.style.display = "block";
    document.getElementById("preview-img").src = product.imageUrl;
  } else {
    preview.style.display = "none";
  }

  // FIX: dùng classList thay vì style.display
  document.getElementById("product-modal").classList.add("show");
}

function closeModal() {
  // FIX: dùng classList thay vì style.display
  document.getElementById("product-modal").classList.remove("show");
}

async function editProduct(id) {
  try {
    const product = await apiCall("GET", `/products/${id}`);
    openProductModal(product);
  } catch (err) {
    showToast("Lỗi tải thông tin sản phẩm: " + err.message, "error");
  }
}

async function saveProduct() {
  const id = document.getElementById("edit-product-id").value;
  const name = document.getElementById("product-name").value.trim();
  const price = parseInt(document.getElementById("product-price").value);
  const stock = parseInt(document.getElementById("product-stock").value) || 0;
  const category = document.getElementById("product-category").value;
  const description = document.getElementById("product-description").value.trim();
  const imageUrl = document.getElementById("product-image-url").value.trim();

  const errEl = document.getElementById("modal-error");
  errEl.classList.add("d-none");

  if (!name || !price || !category) {
    errEl.textContent = "Vui lòng điền đầy đủ thông tin bắt buộc (*)";
    errEl.classList.remove("d-none");
    return;
  }

  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Đang lưu...";

  const productData = { name, price, stock, category, description, imageUrl };

  try {
    const fileInput = document.getElementById("product-image-file");
    if (fileInput.files && fileInput.files[0]) {
      const uploadedUrl = await uploadImage(fileInput.files[0]);
      if (uploadedUrl) productData.imageUrl = uploadedUrl;
    }

    if (id) {
      await apiCall("PUT", `/products/${id}`, productData);
      showToast("Cập nhật sản phẩm thành công!", "success");
    } else {
      await apiCall("POST", "/products", productData);
      showToast("Thêm sản phẩm thành công!", "success");
    }

    closeModal();
    loadAdminProducts();
  } catch (err) {
    errEl.textContent = "Lỗi: " + err.message;
    errEl.classList.remove("d-none");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Lưu sản phẩm";
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Xác nhận xóa sản phẩm "${name}"?`)) return;
  try {
    await apiCall("DELETE", `/products/${id}`);
    showToast(`Đã xóa sản phẩm "${name}"`, "success");
    loadAdminProducts();
  } catch (err) {
    showToast("Lỗi xóa sản phẩm: " + err.message, "error");
  }
}

async function uploadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        const result = await apiCall("POST", "/products/upload-image", {
          imageData: base64,
          fileName: file.name,
          mimeType: file.type
        });
        resolve(result.imageUrl);
      } catch (err) {
        console.error("Upload failed:", err);
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("image-filename").textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("preview-img").src = e.target.result;
    document.getElementById("image-preview").style.display = "block";
    document.getElementById("product-image-url").value = "";
  };
  reader.readAsDataURL(file);
}

// ── ORDERS ────────────────────────────────────────
async function loadOrders() {
  const tbody = document.getElementById("orders-table-body");
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const data = await apiCall("GET", "/orders/all");

    if (!data.orders || data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">Chưa có đơn hàng nào</td></tr>`;
      return;
    }

    const statusColors = { pending: "warning", processing: "info", shipped: "primary", delivered: "success", cancelled: "danger" };
    const statusLabels = { pending: "Chờ xử lý", processing: "Đang xử lý", shipped: "Đã giao", delivered: "Hoàn thành", cancelled: "Đã hủy" };

    tbody.innerHTML = data.orders.map(o => {
      const currentStatus = o.status || "pending";
      return `
        <tr>
          <td><code style="font-size:12px">${o.id.slice(0, 8)}...</code></td>
          <td>${o.userEmail || "—"}</td>
          <td>${o.products?.length || 0} sản phẩm</td>
          <td style="color:#3b82f6;font-weight:600">${formatPrice(o.total)}</td>
          <td><span class="badge bg-${statusColors[currentStatus] || 'secondary'}">${statusLabels[currentStatus] || currentStatus}</span></td>
          <td style="font-size:12px">${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString("vi-VN") : "—"}</td>
          <td>
            <select class="form-select form-select-sm" onchange="updateOrderStatus('${o.id}', this.value)" style="width:140px">
              ${Object.entries(statusLabels).map(([val, label]) =>
                `<option value="${val}" ${currentStatus === val ? "selected" : ""}>${label}</option>`
              ).join('')}
            </select>
          </td>
        </tr>
      `;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center p-4">Lỗi tải đơn hàng: ${e.message}</td></tr>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const result = await apiCall("PUT", `/orders/${orderId}/status`, { status: newStatus });
    showToast(result.message || "Cập nhật thành công", "success");
  } catch (err) {
    showToast("Lỗi: " + err.message, "error");
    loadOrders();
  }
}

// ── STATS ─────────────────────────────────────────
async function loadStats() {
  try {
    const [prods, orders] = await Promise.all([
      fetch(`${API_BASE}/products?limit=1000`).then(r => r.json()),
      apiCall("GET", "/orders/all").catch(() => ({ orders: [] }))
    ]);

    document.getElementById("stat-products").textContent = prods.products?.length || 0;
    document.getElementById("stat-orders").textContent = orders.orders?.length || 0;

    const revenue = (orders.orders || []).reduce((sum, o) => sum + (o.total || 0), 0);
    document.getElementById("stat-revenue").textContent = formatPrice(revenue);
  } catch (e) {
    console.warn("Load stats failed:", e);
  }
}

// ── USERS ─────────────────────────────────────────
async function loadUsers() {
  const container = document.getElementById("users-content");
  if (!container) return;
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

  try {
    const data = await apiCall("GET", "/users/all");
    if (!data.users || data.users.length === 0) {
      container.innerHTML = `<p class="text-muted">Chưa có người dùng nào</p>`;
      return;
    }
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead><tr><th>Email</th><th>Tên</th><th>Vai trò</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            ${data.users.map(u => `
              <tr>
                <td>${u.email || "—"}</td>
                <td>${u.displayName || "—"}</td>
                <td><span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">${u.role || 'user'}</span></td>
                <td style="font-size:12px">${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString("vi-VN") : "—"}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<p class="text-danger">Lỗi tải người dùng: ${e.message}</p>`;
  }
}

// Close modal when clicking backdrop
document.getElementById("product-modal")?.addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});