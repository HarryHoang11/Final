# ⚡ TechStore - Cửa hàng Công nghệ

Website bán đồ công nghệ với đầy đủ tính năng: xác thực Firebase, Firestore, Storage, chatbox gợi ý sản phẩm và trang Admin.

---

## 🗂️ Cấu trúc dự án

```
/techstore
├── /public                  # Frontend HTML
│   ├── index.html           # Trang chủ
│   ├── products.html        # Danh sách sản phẩm
│   ├── product-detail.html  # Chi tiết sản phẩm
│   ├── cart.html            # Giỏ hàng
│   ├── login.html           # Đăng nhập
│   ├── register.html        # Đăng ký
│   └── admin.html           # Trang Admin
├── /css
│   └── style.css            # Stylesheet chính
├── /js
│   ├── app.js               # Utilities & helpers
│   ├── auth.js              # Firebase Authentication
│   ├── cart.js              # Logic giỏ hàng
│   └── chatbox.js           # Chatbox gợi ý sản phẩm
├── /server
│   ├── server.js            # Express server
│   └── routes.js            # API routes
├── /firebase
│   ├── firebaseConfig.js    # Firebase config (client)
│   └── serviceAccountKey.json  # [TẠO THỦ CÔNG - xem hướng dẫn]
├── seed.js                  # Script thêm dữ liệu mẫu
├── package.json
└── .env.example
```

---

## 🔥 Hướng dẫn kết nối Firebase

### Bước 1: Tạo Firebase Project

1. Truy cập [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → đặt tên (vd: `techstore-app`) → Create
3. Bật **Google Analytics** (tuỳ chọn)

### Bước 2: Bật các dịch vụ Firebase

#### 🔐 Authentication
1. Sidebar → **Authentication** → **Get started**
2. Tab **Sign-in method** → Enable **Email/Password** → Save

#### 🗄️ Firestore Database
1. Sidebar → **Firestore Database** → **Create database**
2. Chọn **Start in test mode** (sau có thể thêm rules)
3. Chọn region gần nhất (vd: `asia-southeast1`)

#### 🖼️ Storage
1. Sidebar → **Storage** → **Get started**
2. Chọn **Start in test mode** → Done

### Bước 3: Lấy Firebase Config (Client)

1. Project Overview → click biểu tượng **Web** (`</>`)
2. Đặt tên app → **Register app**
3. Copy **firebaseConfig** object
4. Mở file `/js/app.js` và thay thế `FIREBASE_CONFIG`:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Bước 4: Tạo Service Account (Backend)

1. Project Settings (⚙️) → **Service accounts**
2. Click **"Generate new private key"** → Download JSON
3. **Đổi tên file** thành `serviceAccountKey.json`
4. **Copy vào thư mục** `/firebase/serviceAccountKey.json`

> ⚠️ **QUAN TRỌNG**: Không commit file này lên Git! (đã có trong .gitignore)

### Bước 5: Cấu hình .env

```bash
cp .env.example .env
```

Mở `.env` và điền:
```
PORT=3000
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

---

## 🚀 Cách chạy dự án

### Yêu cầu
- Node.js v18+
- npm v8+

### 1. Cài đặt dependencies

```bash
cd techstore
npm install
```

### 2. Thêm dữ liệu mẫu (chỉ cần chạy 1 lần)

```bash
node seed.js
```

Lệnh này sẽ thêm:
- 10 sản phẩm mẫu (laptop, điện thoại, tai nghe, phụ kiện)
- Tài khoản Admin: `admin@techstore.vn` / `admin123456`

### 3. Khởi động server

```bash
# Production
npm start

# Development (tự động restart khi có thay đổi)
npm run dev
```

### 4. Mở trình duyệt

```
http://localhost:3000
```

---

## 📱 Các trang & tính năng

| Trang | URL | Mô tả |
|-------|-----|-------|
| Trang chủ | `/` | Banner, sản phẩm nổi bật, tìm kiếm |
| Sản phẩm | `/products` | Danh sách + filter + tìm kiếm |
| Chi tiết | `/product/:id` | Thông tin chi tiết + thêm giỏ |
| Giỏ hàng | `/cart` | Quản lý giỏ hàng + đặt hàng |
| Đăng nhập | `/login` | Firebase Auth login |
| Đăng ký | `/register` | Firebase Auth register |
| Admin | `/admin` | Quản lý sản phẩm (chỉ admin) |

---

## 🔌 API Endpoints

```
GET    /api/products              Lấy danh sách sản phẩm
GET    /api/products/:id          Lấy 1 sản phẩm
POST   /api/products              Thêm sản phẩm [Admin]
PUT    /api/products/:id          Sửa sản phẩm [Admin]
DELETE /api/products/:id          Xóa sản phẩm [Admin]
POST   /api/products/upload-image Upload ảnh [Admin]

GET    /api/cart                  Lấy giỏ hàng [Auth]
POST   /api/cart                  Cập nhật giỏ hàng [Auth]

POST   /api/orders                Tạo đơn hàng [Auth]
GET    /api/orders                Đơn hàng của tôi [Auth]
GET    /api/orders/all            Tất cả đơn hàng [Admin]

POST   /api/search-history        Lưu lịch sử tìm kiếm [Auth]
GET    /api/recommendations       Gợi ý sản phẩm [Auth]

POST   /api/users                 Tạo user profile [Auth]
GET    /api/users/me              Thông tin tôi [Auth]
```

---

## 🏗️ Firebase Database Structure

```
users/
  {uid}/
    id, email, displayName, role, createdAt

products/
  {id}/
    name, price, category, description, imageUrl, stock, createdAt, updatedAt

orders/
  {id}/
    userId, userEmail, products[], total, status, createdAt

carts/
  {userId}/
    items[], updatedAt

search_history/
  {id}/
    userId, keyword, timestamp
```

---

## 🔒 Firestore Security Rules (Production)

Thay thế rules mặc định trong Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Products: ai cũng đọc được, chỉ admin mới sửa
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Users: chỉ đọc/ghi của chính mình
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Orders: chỉ xem của mình
    match /orders/{id} {
      allow read: if request.auth.uid == resource.data.userId || isAdmin();
      allow create: if request.auth != null;
    }
    
    // Cart: chỉ của mình
    match /carts/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Search history: chỉ của mình
    match /search_history/{id} {
      allow create: if request.auth != null;
      allow read: if request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## 🤖 Chatbox - Cách hoạt động

1. **User tìm kiếm**: Keyword được lưu vào `search_history` collection
2. **API Recommendations**: Backend tính điểm sản phẩm dựa trên lịch sử tìm kiếm
3. **Gợi ý**: Trả về top 5 sản phẩm phù hợp nhất
4. **Guest**: Tìm kiếm trực tiếp qua API (không lưu lịch sử)

---

## 🎨 Tech Stack

- **Frontend**: HTML5, CSS3 (biến CSS, Grid, Flexbox), Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication  
- **Storage**: Firebase Storage
- **Fonts**: Syne + DM Sans (Google Fonts)
