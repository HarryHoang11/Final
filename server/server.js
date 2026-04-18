// ====================================================
// SERVER.JS - Main Express Server
// ====================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const admin = require('firebase-admin');

let firebaseOptions = {};
const possiblePaths = [
  '../firebase/serviceAccountKey.json',
  './serviceAccountKey.json',
  '../serviceAccountKey.json'
];
let loaded = false;
for (const p of possiblePaths) {
  try {
    const serviceAccount = require(p);
    firebaseOptions.credential = admin.credential.cert(serviceAccount);
    console.log(`✅ Loaded serviceAccountKey from: ${p}`);
    loaded = true;
    break;
  } catch (e) {}
}
if (!loaded) {
  console.warn('⚠️  serviceAccountKey.json not found. Using environment variables.');
  firebaseOptions.credential = admin.credential.applicationDefault();
}

if (process.env.FIREBASE_STORAGE_BUCKET) {
  firebaseOptions.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
}

admin.initializeApp(firebaseOptions);

const db = admin.firestore();
let bucket = null;
try { bucket = admin.storage().bucket(); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu trúc thực tế:
//   techstore/
//   ├── css/style.css
//   ├── js/app.js
//   ├── public/index.html
//   └── server/server.js  (__dirname = .../server)
const ROOT   = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// FIX: serve ROOT để /css/ và /js/ hoạt động đúng MIME
app.use(express.static(ROOT));
app.use(express.static(PUBLIC));

// FIX: trả 204 cho favicon thay vì 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

const routes = require('./routes');
app.use('/api', routes(db, bucket, admin));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/products', (req, res) => res.sendFile(path.join(PUBLIC, 'products.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(PUBLIC, 'product-detail.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(PUBLIC, 'cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(PUBLIC, 'checkout.html')));
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/wallet', (req, res) => res.sendFile(path.join(PUBLIC, 'wallet.html')));

// ── GLOBAL ERROR HANDLER ──────────────────────────
// FIX: bắt lỗi 500 và in ra terminal thay vì crash im lặng
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack || err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 TechStore running at http://localhost:${PORT}`);
  console.log(`📁 Static root : ${ROOT}`);
  console.log(`📁 HTML pages  : ${PUBLIC}`);
  console.log(`Pages: / | /products | /cart | /login | /register | /admin | /wallet\n`);
});

module.exports = app;