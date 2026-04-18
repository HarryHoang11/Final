// ====================================================
// SEED.JS - Add sample products & admin user to Firebase
// Run: node seed.js
// ====================================================

const admin = require('firebase-admin');
require('dotenv').config();

let serviceAccount;
try {
  serviceAccount = require('./firebase/serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error('❌ serviceAccountKey.json not found. Please set it up first.');
  process.exit(1);
}

const db = admin.firestore();

const sampleProducts = [
  {
    name: 'ASUS ROG Strix G15 2024',
    price: 35990000,
    category: 'laptop',
    description: 'Laptop gaming cao cấp với AMD Ryzen 9 7945HX, RTX 4070, RAM 16GB DDR5, màn hình 165Hz 1080p.',
    imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600',
    stock: 15
  },
  {
    name: 'MacBook Air M3 13"',
    price: 28990000,
    category: 'laptop',
    description: 'Siêu mỏng nhẹ với chip Apple M3 mạnh mẽ, pin 18 giờ, màn hình Liquid Retina 13.6".',
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600',
    stock: 20
  },
  {
    name: 'Lenovo Legion 5 Pro',
    price: 29990000,
    category: 'laptop',
    description: 'Gaming laptop với Intel Core i7-13700H, RTX 4060, RAM 16GB, màn hình 2K 165Hz.',
    imageUrl: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600',
    stock: 12
  },
  {
    name: 'iPhone 15 Pro Max',
    price: 32990000,
    category: 'phone',
    description: 'Flagship Apple với chip A17 Pro, camera 48MP ProRAW, titanium design, Action Button.',
    imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600',
    stock: 25
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    price: 31990000,
    category: 'phone',
    description: 'Android flagship với Snapdragon 8 Gen 3, camera 200MP, S Pen tích hợp, màn hình 6.8".',
    imageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600',
    stock: 18
  },
  {
    name: 'Sony WH-1000XM5',
    price: 8490000,
    category: 'headphones',
    description: 'Tai nghe chống ồn hàng đầu thế giới, âm thanh Hi-Res, pin 30 giờ, kết nối Multipoint.',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
    stock: 30
  },
  {
    name: 'Apple AirPods Pro 2',
    price: 6490000,
    category: 'headphones',
    description: 'True Wireless với ANC thế hệ 2, Adaptive Audio, Lossless Audio, chống nước IPX4.',
    imageUrl: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600',
    stock: 45
  },
  {
    name: 'Bàn phím cơ Keychron K2',
    price: 1890000,
    category: 'accessories',
    description: 'Bàn phím cơ compact 75%, switch Gateron, đèn RGB, kết nối Bluetooth + USB-C.',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600',
    stock: 50
  },
  {
    name: 'Chuột Logitech MX Master 3S',
    price: 2490000,
    category: 'accessories',
    description: 'Chuột không dây cao cấp, MagSpeed scroll, 8000 DPI, pin 70 ngày, kết nối đa thiết bị.',
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600',
    stock: 35
  },
  {
    name: 'Xiaomi 14 Ultra',
    price: 22990000,
    category: 'phone',
    description: 'Camera Leica chuyên nghiệp, Snapdragon 8 Gen 3, sạc 90W, màn hình AMOLED 2K.',
    imageUrl: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=600',
    stock: 10
  }
];

async function seedProducts() {
  console.log('🌱 Seeding products...');
  const batch = db.batch();

  for (const product of sampleProducts) {
    const ref = db.collection('products').doc();
    batch.set(ref, {
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ ${product.name}`);
  }

  await batch.commit();
  console.log(`\n✅ Added ${sampleProducts.length} products!\n`);
}

async function createAdminUser(email, password) {
  try {
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log(`ℹ️  User ${email} already exists`);
    } catch {
      user = await admin.auth().createUser({ email, password, displayName: 'Admin' });
      console.log(`✅ Created auth user: ${email}`);
    }

    await db.collection('users').doc(user.uid).set({
      id: user.uid,
      email,
      displayName: 'Admin',
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`✅ Set admin role for: ${email}\n`);
  } catch (err) {
    console.error('Error creating admin:', err.message);
  }
}

async function main() {
  console.log('\n🚀 TechStore Seed Script\n' + '='.repeat(40));

  await seedProducts();

  // Create default admin account
  await createAdminUser('admin@techstore.vn', 'admin123');

  console.log('🎉 Seed completed!\n');
  console.log('Admin credentials:');
  console.log('  Email:    admin@techstore.vn');
  console.log('  Password: admin123\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
