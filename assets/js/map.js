// Google Apps Script API 網址
const romanticApiUrl = 'https://script.google.com/macros/s/AKfycbzEaSWoZET1mj-R9lGD1fCTGx2wPT5Jygnwg-FMXkiMhl6htfNuolwbEWCSANP5i1s_lA/exec';

let map;
let allPlaces = []; 
let markersGroup = L.layerGroup(); 

// 1. 初始化地圖與取得 API 資料
async function initMapAndData() {
  map = L.map('map').setView([22.9997, 120.2270], 12);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersGroup.addTo(map);

  try {
    const response = await fetch(romanticApiUrl);
    allPlaces = await response.json();

    populateFilterOptions(allPlaces);
    renderData(allPlaces);

    // 監聽選單與搜尋事件
    const citySelect = document.getElementById('citySelect');
    const categorySelect = document.getElementById('categorySelect');
    if (citySelect) citySelect.addEventListener('change', filterData);
    if (categorySelect) categorySelect.addEventListener('change', filterData);

    const searchInput = document.getElementById('searchInput'); 
    if (searchInput) {
      searchInput.addEventListener('input', filterData);
    }

  } catch (error) {
    console.error('資料讀取失敗:', error);
  }
}

// 2. 動態生成下拉選單選項
function populateFilterOptions(data) {
  const citySelect = document.getElementById('citySelect');
  const categorySelect = document.getElementById('categorySelect');

  if (!citySelect || !categorySelect) return;

  const cities = new Set();
  const categories = new Set();

  data.forEach(item => {
    const cityVal = item.city || item.City;
    const catVal = item.category || item.Category;

    if (cityVal) cities.add(String(cityVal).trim());
    if (catVal) categories.add(String(catVal).trim());
  });

  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

// 3. 執行三合一篩選邏輯
function filterData() {
  const citySelect = document.getElementById('citySelect');
  const categorySelect = document.getElementById('categorySelect');
  const selectedCity = citySelect ? citySelect.value : 'all';
  const selectedCategory = categorySelect ? categorySelect.value : 'all';

  const searchInput = document.getElementById('searchInput'); 
  const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredPlaces = allPlaces.filter(place => {
    const cityVal = place.city || place.City || '';
    const catVal = place.category || place.Category || '';
    const nameVal = place.name || place.Name || '';
    const addressVal = place.address || place.Address || '';
    const noteVal = place.note || place.Note || '';

    const matchCity = (selectedCity === 'all') || (cityVal === selectedCity);
    const matchCategory = (selectedCategory === 'all') || (catVal === selectedCategory);
    
    const matchSearch = searchText === '' || 
      cityVal.toLowerCase().includes(searchText) ||
      catVal.toLowerCase().includes(searchText) ||
      nameVal.toLowerCase().includes(searchText) ||
      addressVal.toLowerCase().includes(searchText) ||
      noteVal.toLowerCase().includes(searchText);

    return matchCity && matchCategory && matchSearch;
  });

  renderData(filteredPlaces);
}

// 4. 生成漂亮的店家卡片 HTML (含圖片/Icon與 Google Maps 導航按鈕)
function createCardHtml(place) {
  const name = place.name || place.Name || '未命名店家';
  const city = place.city || place.City || '';
  const category = place.category || place.Category || '補給站';
  const phone = place.phone || place.Phone || place.tel || place.Tel || '';
  const discount = place.discount || place.Discount || '優惠待定';
  const address = place.address || place.Address || '';
  
  // 店家圓形 Logo (如果 GAS 沒有 logo 欄位，預設帶一個圖示)
  const logoUrl = place.logo || place.Logo || place.imageUrl || place.ImageUrl || '';

  // Google Maps 導航網址 (優先使用地址，沒有地址用名稱)
  const queryText = address ? `${name} ${address}` : name;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;

  // 標籤顯示：若有縣市就顯示「台南市 · 咖啡午茶」，沒有就只顯示「咖啡午茶」
  const tagText = city ? `${city} · ${category}` : category;

  return `
    <div class="station-card" style="
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div>
        <!-- 頂部：圓形 Logo 與 分類標籤 -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          ${logoUrl ? 
            `<img src="${logoUrl}" alt="${name}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid #eee;">` : 
            `<div style="width: 44px; height: 44px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; border: 1px solid #eee;"><i class="fa-solid fa-store"></i></div>`
          }
          <span style="
            background-color: #fde8e0;
            color: #e07a5f;
            font-size: 13px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
          ">${tagText}</span>
        </div>

        <!-- 店名 -->
        <h3 style="
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 12px 0;
          line-height: 1.3;
        ">${name}</h3>

        <!-- 電話 (如果有資料才顯示) -->
        ${phone ? `
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-phone" style="color: #64748b;"></i>
            <span>${phone}</span>
          </p>
        ` : ''}

        <!-- 優惠內容 -->
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #e07a5f; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-gift" style="color: #e07a5f;"></i>
          <span>${discount}</span>
        </p>
      </div>

      <!-- 導航按鈕 -->
      <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: #1e293b;
        color: #ffffff;
        text-decoration: none;
        padding: 12px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        transition: background-color 0.2s;
      " onmouseover="this.style.backgroundColor='#0f172a'" onmouseout="this.style.backgroundColor='#1e293b'">
        <i class="fa-solid fa-paper-plane" style="font-size: 13px;"></i>
        <span>開啟 Google Maps 導航</span>
      </a>
    </div>
  `;
}

// 5. 渲染地圖 Marker 與 店家卡片
function renderData(places) {
  markersGroup.clearLayers();
  
  const cardContainer = document.getElementById('stationGrid'); 
  if (cardContainer) cardContainer.innerHTML = '';

  const bounds = [];

  places.forEach(place => {
    const lat = place.lat || place.Lat;
    const lng = place.lng || place.Lng;
    const name = place.name || place.Name || '';
    const category = place.category || place.Category || '';

    // A. 地圖 Marker
    if (lat && lng) {
      const marker = L.marker([lat, lng])
        .bindPopup(`<b>${name}</b><br>${category}`);
      
      markersGroup.addLayer(marker);
      bounds.push([lat, lng]);
    }

    // B. 卡片渲染
    if (cardContainer) {
      const cardHtml = createCardHtml(place);
      cardContainer.insertAdjacentHTML('beforeend', cardHtml);
    }
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// 確保 DOM 載入後啟動
document.addEventListener('DOMContentLoaded', () => {
  initMapAndData();
});