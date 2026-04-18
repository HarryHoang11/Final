// ====================================================
// CHATBOX.JS - AI Product Recommendation Chatbox
// ====================================================

let chatOpen = false;

const WELCOME_MSG = 'Xin chào! 👋 Tôi là trợ lý TechStore. Bạn đang tìm kiếm sản phẩm gì?';

const QUICK_REPLIES = [
  { label: '💻 Laptop gaming', query: 'laptop gaming' },
  { label: '📱 Điện thoại flagship', query: 'flagship phone' },
  { label: '🎧 Tai nghe chống ồn', query: 'noise cancelling headphones' },
  { label: '🔌 Phụ kiện', query: 'accessories' }
];

function initChatbox() {
  const container = document.getElementById('chatbox-container');
  if (!container) return;

  container.innerHTML = `
    <div class="chatbox-container">
      <div class="chatbox" id="chatbox">
        <div class="chatbox-header">
          <div class="chatbox-avatar">🤖</div>
          <div class="chatbox-header-info">
            <h4>TechBot</h4>
            <p>● Trực tuyến</p>
          </div>
          <button onclick="toggleChatbox()" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;margin-left:auto">✕</button>
        </div>
        <div class="chatbox-messages" id="chatbox-messages"></div>
        <div class="chatbox-input">
          <input type="text" id="chatbox-input-field" placeholder="Tìm sản phẩm..."
            onkeydown="if(event.key==='Enter') sendChatMessage()">
          <button class="chatbox-send" onclick="sendChatMessage()">➤</button>
        </div>
      </div>
      <button class="chatbox-toggle" onclick="toggleChatbox()" title="Trợ lý gợi ý sản phẩm">
        💬
      </button>
    </div>
  `;

  addBotMessage(WELCOME_MSG);
  addQuickReplies();
}

function toggleChatbox() {
  chatOpen = !chatOpen;
  const box = document.getElementById('chatbox');
  if (box) box.classList.toggle('open', chatOpen);
}

function addBotMessage(text, products = null) {
  const container = document.getElementById('chatbox-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg bot';

  let html = `<div class="chat-bubble">${text}</div>`;

  if (products && products.length > 0) {
    html += `<div class="chat-products">`;
    products.forEach(p => {
      html += `
        <a href="/product/${p.id}" class="chat-product-item">
          <div class="chat-product-img">
            ${p.imageUrl
              ? `<img src="${p.imageUrl}" alt="${p.name}">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-size:18px">${CATEGORY_ICONS[p.category] || '📦'}</div>`
            }
          </div>
          <div>
            <div class="chat-product-name">${p.name}</div>
            <div class="chat-product-price">${formatPrice(p.price)}</div>
          </div>
        </a>
      `;
    });
    html += `</div>`;
  }

  msg.innerHTML = html;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function addUserMessage(text) {
  const container = document.getElementById('chatbox-messages');
  if (!container) return;
  const msg = document.createElement('div');
  msg.className = 'chat-msg user';
  msg.innerHTML = `<div class="chat-bubble">${text}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function addQuickReplies() {
  const container = document.getElementById('chatbox-messages');
  if (!container) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';

  QUICK_REPLIES.forEach(qr => {
    const btn = document.createElement('button');
    btn.textContent = qr.label;
    btn.className = 'quick-reply-btn';
    btn.onclick = () => {
      const inputField = document.getElementById('chatbox-input-field');
      if (inputField) { inputField.value = qr.query; sendChatMessage(); }
    };
    wrap.appendChild(btn);
  });

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatbox-input-field');
  if (!input) return;
  const keyword = input.value.trim();
  if (!keyword) return;

  input.value = '';
  addUserMessage(keyword);

  if (window.currentUser) {
    try { await apiCall('POST', '/search-history', { keyword }); } catch (e) {}
  }

  const container = document.getElementById('chatbox-messages');
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot';
  typing.id = 'typing-indicator';
  typing.innerHTML = '<div class="chat-bubble" style="color:#9ca3af">Đang tìm kiếm...</div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  try {
    let products = [];

    if (window.currentUser) {
      const result = await apiCall('GET', `/recommendations?keyword=${encodeURIComponent(keyword)}`);
      products = result.recommendations || [];
    } else {
      const result = await fetch(`${API_BASE}/products?search=${encodeURIComponent(keyword)}&limit=5`);
      const data = await result.json();
      products = data.products || [];
    }

    document.getElementById('typing-indicator')?.remove();

    if (products.length > 0) {
      addBotMessage(
        `🔍 Tìm thấy <strong>${products.length}</strong> sản phẩm phù hợp với "<em>${keyword}</em>":`,
        products
      );
    } else {
      addBotMessage(`Xin lỗi, tôi không tìm thấy sản phẩm phù hợp với "<em>${keyword}</em>". Hãy thử từ khóa khác nhé!`);
    }

    const viewAll = document.createElement('div');
    viewAll.style.cssText = 'margin-top:8px;';
    viewAll.innerHTML = `
      <a href="/products?search=${encodeURIComponent(keyword)}"
         style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:500">
        Xem tất cả kết quả →
      </a>
    `;
    container.appendChild(viewAll);
    container.scrollTop = container.scrollHeight;

  } catch (e) {
    document.getElementById('typing-indicator')?.remove();
    addBotMessage('Có lỗi xảy ra. Vui lòng thử lại sau! 😢');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('chatbox-container')) {
    const div = document.createElement('div');
    div.id = 'chatbox-container';
    document.body.appendChild(div);
  }
  setTimeout(initChatbox, 500);
});
