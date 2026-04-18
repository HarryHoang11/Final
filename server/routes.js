// ====================================================
// ROUTES.JS - All API Routes (Fixed)
// ====================================================
const express = require("express");
const { v4: uuidv4 } = require("uuid");

module.exports = (db, bucket, admin) => {
  const router = express.Router();

  // ─── MIDDLEWARE ──────────────────────────────────
  const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    try {
      const token = authHeader.split("Bearer ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  const verifyAdmin = async (req, res, next) => {
    try {
      const userDoc = await db.collection("users").doc(req.user.uid).get();
      if (!userDoc.exists || userDoc.data().role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admin only" });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  // Cloudinary config
  let cloudinary = null;
  try {
    cloudinary = require("cloudinary").v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } catch (e) {
    console.warn("Cloudinary not configured - image upload disabled");
  }

  // ==================== PRODUCTS ====================

  // FIX: upload-image phải đặt TRƯỚC /:id, không thì bị match nhầm
  // POST /api/products/upload-image (admin)
  router.post("/products/upload-image", verifyToken, verifyAdmin, async (req, res) => {
    try {
      if (!cloudinary) return res.status(503).json({ error: "Image upload not configured" });
      const { imageData, fileName, mimeType } = req.body;
      if (!imageData) return res.status(400).json({ error: "imageData is required" });

      const dataUri = `data:${mimeType || "image/jpeg"};base64,${imageData}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "techstore/products",
        public_id: `product_${Date.now()}_${uuidv4().slice(0, 8)}`,
        resource_type: "image",
        transformation: [{ width: 800, crop: "limit" }]
      });
      res.json({ imageUrl: result.secure_url, publicId: result.public_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/products
  router.get("/products", async (req, res) => {
    try {
      const { category, search, limit = 20 } = req.query;

      // FIX: tách 2 trường hợp để tránh Firestore yêu cầu composite index
      // khi dùng where() + limit() mà chưa tạo index
      let snap;
      if (category && category !== "all") {
        // Chỉ filter theo category, không orderBy để tránh lỗi index
        snap = await db.collection("products")
          .where("category", "==", category)
          .limit(parseInt(limit))
          .get();
      } else {
        snap = await db.collection("products")
          .limit(parseInt(limit))
          .get();
      }

      let products = [];
      snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

      // Search filter phía server
      if (search) {
        const kw = search.toLowerCase();
        products = products.filter(p =>
          (p.name || "").toLowerCase().includes(kw) ||
          (p.description || "").toLowerCase().includes(kw) ||
          (p.category || "").toLowerCase().includes(kw)
        );
      }

      res.json({ products, total: products.length });
    } catch (err) {
      console.error("GET /products error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/products/:id
  router.get("/products/:id", async (req, res) => {
    try {
      const doc = await db.collection("products").doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Product not found" });
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/products (admin)
  router.post("/products", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { name, price, category, description, imageUrl, stock } = req.body;
      if (!name || !price || !category) {
        return res.status(400).json({ error: "name, price, category are required" });
      }
      const ref = await db.collection("products").add({
        name, price: Number(price), category,
        description: description || "",
        imageUrl: imageUrl || "",
        stock: Number(stock) || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ id: ref.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/products/:id (admin)
  router.put("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { name, price, category, description, imageUrl, stock } = req.body;
      const ref = db.collection("products").doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Product not found" });

      await ref.update({
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(stock !== undefined && { stock: Number(stock) }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/products/:id (admin)
  router.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const ref = db.collection("products").doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Product not found" });
      await ref.delete();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== ORDERS ====================

  // POST /api/orders
  router.post("/orders", verifyToken, async (req, res) => {
    try {
      const { products, total, shippingAddress, paymentMethod } = req.body;
      if (!products || !total) return res.status(400).json({ error: "products and total are required" });

      const ref = await db.collection("orders").add({
        userId: req.user.uid,
        userEmail: req.user.email,
        products,
        total: Number(total),
        shippingAddress: shippingAddress || "",
        paymentMethod: paymentMethod || "cod",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ id: ref.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FIX: /orders/all phải đặt TRƯỚC /orders/:id
  // GET /api/orders/all (admin)
  router.get("/orders/all", verifyToken, verifyAdmin, async (req, res) => {
    try {
      // FIX: bỏ orderBy để tránh lỗi "index required" khi collection mới
      // Sắp xếp phía server thay thế
      const snap = await db.collection("orders").limit(200).get();
      const orders = [];
      snap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

      // Sắp xếp theo createdAt giảm dần (an toàn hơn orderBy)
      orders.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      res.json({ orders });
    } catch (err) {
      console.error("GET /orders/all error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/orders (user's own orders)
  router.get("/orders", verifyToken, async (req, res) => {
    try {
      // FIX: bỏ orderBy tránh lỗi index, sort JS thay thế
      const snap = await db.collection("orders")
        .where("userId", "==", req.user.uid)
        .limit(50)
        .get();
      const orders = [];
      snap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
      orders.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      res.json({ orders });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/orders/:id/status (admin)
  router.put("/orders/:id/status", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ["pending", "processing", "shipped", "delivered", "cancelled"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: "Trạng thái không hợp lệ" });
      }

      const orderRef = db.collection("orders").doc(req.params.id);
      const doc = await orderRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

      await orderRef.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true, message: `Đã đổi trạng thái thành ${status}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== CART ====================

  router.get("/cart", verifyToken, async (req, res) => {
    try {
      const doc = await db.collection("carts").doc(req.user.uid).get();
      res.json(doc.exists ? doc.data() : { items: [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/cart", verifyToken, async (req, res) => {
    try {
      const { items } = req.body;
      await db.collection("carts").doc(req.user.uid).set({
        items: items || [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true, items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== SEARCH HISTORY & RECOMMENDATIONS ====================

  router.post("/search-history", verifyToken, async (req, res) => {
    try {
      const { keyword } = req.body;
      if (!keyword) return res.status(400).json({ error: "keyword required" });
      await db.collection("search_history").add({
        userId: req.user.uid,
        keyword: keyword.toLowerCase().trim(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/recommendations", verifyToken, async (req, res) => {
    try {
      const { keyword } = req.query;

      // FIX: bỏ orderBy để tránh lỗi index
      const historySnap = await db.collection("search_history")
        .where("userId", "==", req.user.uid)
        .limit(10).get();

      const keywords = [];
      historySnap.forEach(doc => keywords.push(doc.data().keyword));
      if (keyword) keywords.unshift(keyword.toLowerCase());

      const productsSnap = await db.collection("products").get();
      const products = [];
      productsSnap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

      const scored = products.map(p => {
        let score = 0;
        const text = `${p.name} ${p.description} ${p.category}`.toLowerCase();
        keywords.forEach((kw, idx) => {
          const weight = 1 / (idx + 1);
          if (text.includes(kw)) score += weight * 10;
          kw.split(" ").forEach(word => {
            if (word.length > 2 && text.includes(word)) score += weight * 3;
          });
        });
        return { ...p, score };
      });

      let recommendations = scored
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (recommendations.length === 0) {
        recommendations = products.sort(() => 0.5 - Math.random()).slice(0, 3);
      }

      res.json({ recommendations, keywords });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== USERS ====================

  // FIX: /users/all và /users/me phải đặt TRƯỚC bất kỳ /users/:id nào
  // GET /api/users/all (admin)
  router.get("/users/all", verifyToken, verifyAdmin, async (req, res) => {
    try {
      // FIX: bỏ orderBy, sort JS thay thế
      const snap = await db.collection("users").limit(100).get();
      const users = [];
      snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
      users.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      res.json({ users });
    } catch (err) {
      console.error("GET /users/all error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/users/me", verifyToken, async (req, res) => {
    try {
      const doc = await db.collection("users").doc(req.user.uid).get();
      if (!doc.exists) return res.status(404).json({ error: "User not found" });
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/users", verifyToken, async (req, res) => {
    try {
      const { email, displayName } = req.body;
      const userRef = db.collection("users").doc(req.user.uid);
      const existing = await userRef.get();
      if (!existing.exists) {
        await userRef.set({
          id: req.user.uid,
          email: email || req.user.email,
          displayName: displayName || "",
          role: "user",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      const updated = await userRef.get();
      res.json({ id: req.user.uid, ...updated.data() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== COMMENTS ====================

  // GET /api/products/:id/comments
  router.get("/products/:id/comments", async (req, res) => {
    try {
      // FIX: bỏ orderBy tránh lỗi index trên subcollection mới
      const snap = await db.collection("products").doc(req.params.id)
        .collection("comments")
        .limit(50)
        .get();
      const comments = [];
      snap.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
      comments.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      res.json({ comments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/products/:id/comments
  router.post("/products/:id/comments", verifyToken, async (req, res) => {
    try {
      const { content, rating } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: "content is required" });
      }

      const userDoc = await db.collection("users").doc(req.user.uid).get();
      const displayName = userDoc.exists ? userDoc.data().displayName : req.user.email;

      const ref = await db.collection("products").doc(req.params.id)
        .collection("comments").add({
          userId: req.user.uid,
          userEmail: req.user.email,
          displayName: displayName || req.user.email,
          content: content.trim(),
          rating: Number(rating) || 5,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      res.json({ id: ref.id, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/products/:productId/comments/:commentId
  router.delete("/products/:productId/comments/:commentId", verifyToken, async (req, res) => {
    try {
      const commentRef = db.collection("products").doc(req.params.productId)
        .collection("comments").doc(req.params.commentId);
      const doc = await commentRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Comment not found" });

      const userDoc = await db.collection("users").doc(req.user.uid).get();
      const isAdmin = userDoc.exists && userDoc.data().role === "admin";
      const isOwner = doc.data().userId === req.user.uid;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: "Không có quyền xóa comment này" });
      }

      await commentRef.delete();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== WALLET ====================

  const WALLET_COLLECTION = "wallets";

  router.get("/wallet", verifyToken, async (req, res) => {
    try {
      const walletRef = db.collection(WALLET_COLLECTION).doc(req.user.uid);
      const doc = await walletRef.get();

      if (!doc.exists) {
        await walletRef.set({
          userId: req.user.uid,
          balance: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ balance: 0, transactions: [] });
      }

      // FIX: bỏ orderBy trên subcollection tránh lỗi index
      const txSnap = await walletRef.collection("transactions").limit(20).get();
      const transactions = [];
      txSnap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
      transactions.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return tB - tA;
      });

      res.json({ balance: doc.data().balance || 0, transactions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/wallet/deposit", verifyToken, async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Số tiền không hợp lệ" });
      }

      const walletRef = db.collection(WALLET_COLLECTION).doc(req.user.uid);
      const walletDoc = await walletRef.get();
      const currentBalance = walletDoc.exists ? walletDoc.data().balance || 0 : 0;
      const newBalance = currentBalance + parseInt(amount);

      await walletRef.set({
        userId: req.user.uid,
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await walletRef.collection("transactions").add({
        type: "deposit",
        amount: parseInt(amount),
        description: "Nạp tiền vào ví",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, newBalance, message: `Nạp thành công ${parseInt(amount).toLocaleString()} ₫` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};