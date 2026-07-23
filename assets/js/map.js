// Google Apps Script API 網址
const romanticApiUrl = 'https://script.google.com/macros/s/AKfycbzEaSWoZET1mj-R9lGD1fCTGx2wPT5Jygnwg-FMXkiMhl6htfNuolwbEWCSANP5i1s_lA/exec';

let map;
let allPlaces = []; 
let markersGroup = L.layerGroup(); 
let markerMap = {}; // 用來存放 index 對應的 Marker 物件
let userLatLng = null; // 儲存使用者 GPS 座標

// 0. 定義自訂玫瑰花 Emoji 地圖標記 Icon
const roseEmojiIcon = L.divIcon({
  className: 'rose-marker',
  html: `<div style="
    font-size: 32px;
    line-height: 1;
    filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));
    cursor: pointer;
    text-align: center;
  ">🌹</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

// 輔助函式：Haversine 演算法計算兩點 GPS 距離 (公里)
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. 初始化地圖與資料
async function initMapAndData() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  map = L.map('map', {
    zoomControl: false // 隱藏預設按鈕，畫面更乾淨
  }).setView([22.9997, 120.2270], 12);
  
  // 自訂 Zoom Control 置於右上角
  L.control.zoom({ position: 'topright' }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersGroup.addTo(map);

  try {
    const response = await fetch(romanticApiUrl);
    allPlaces = await response.json();

    populateFilterOptions(allPlaces);
    renderData(allPlaces);

    // 綁定選單、搜尋與按鈕事件
    const citySelect = document.getElementById('city-filter') || document.getElementById('citySelect');
    const categorySelect = document.getElementById('category-filter') || document.getElementById('categorySelect');
    const searchInput = document.getElementById('search-input') || document.getElementById('searchInput');
    const geoBtn = document.getElementById('geo-btn') || document.getElementById('geoBtn');
    const dragHandle = document.getElementById('dragHandle');

    if (citySelect) citySelect.addEventListener('change', filterData);
    if (categorySelect) categorySelect.addEventListener('change', filterData);
    if (searchInput) searchInput.addEventListener('input', filterData);
    
    // GPS 定位按鈕事件
    if (geoBtn) {
      geoBtn.addEventListener('click', getUserLocation);
    }

    // 手機端 Bottom Sheet 拖曳條點擊展開/收合事件
    if (dragHandle) {
      dragHandle.addEventListener('click', () => {
        const resultsPanel = document.getElementById('resultsPanel');
        if (resultsPanel) {
          resultsPanel.classList.toggle('active');
        }
      });
    }

  } catch (error) {
    console.error('資料讀取失敗:', error);
  }
}

// 2. 動態生成選單選項
function populateFilterOptions(data) {
  const citySelect = document.getElementById('city-filter') || document.getElementById('citySelect');
  const categorySelect = document.getElementById('category-filter') || document.getElementById('categorySelect');

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

// 3. 執行三合一篩選 (縣市 + 類別 + 關鍵字 + GPS 距離排序)
function filterData() {
  const citySelect = document.getElementById('city-filter') || document.getElementById('citySelect');
  const categorySelect = document.getElementById('category-filter') || document.getElementById('categorySelect');
  const searchInput = document.getElementById('search-input') || document.getElementById('searchInput'); 

  const selectedCity = citySelect ? citySelect.value : 'all';
  const selectedCategory = categorySelect ? categorySelect.value : 'all';
  const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filteredPlaces = allPlaces.filter(place => {
    const cityVal = place.city || place.City || '';
    const catVal = place.category || place.Category || '';
    const nameVal = place.name || place.Name || '';
    const addressVal = place.address || place.Address || '';
    const noteVal = place.note || place.Note || '';

    const matchCity = (selectedCity === 'all' || selectedCity === '' || selectedCity.includes('全部')) || (cityVal === selectedCity);
    const matchCategory = (selectedCategory === 'all' || selectedCategory === '' || selectedCategory.includes('全部')) || (catVal === selectedCategory);
    
    const matchSearch = searchText === '' || 
      cityVal.toLowerCase().includes(searchText) ||
      catVal.toLowerCase().includes(searchText) ||
      nameVal.toLowerCase().includes(searchText) ||
      addressVal.toLowerCase().includes(searchText) ||
      noteVal.toLowerCase().includes(searchText);

    return matchCity && matchCategory && matchSearch;
  });

  // 如果已發動 GPS 定位，依照距離進行升冪排序（由近到遠）
  if (userLatLng) {
    filteredPlaces.forEach(place => {
      const lat = place.lat || place.Lat;
      const lng = place.lng || place.Lng;
      if (lat && lng) {
        place.calcDistance = getDistanceInKm(userLatLng.lat, userLatLng.lng, lat, lng);
      } else {
        place.calcDistance = 9999;
      }
    });

    filteredPlaces.sort((a, b) => a.calcDistance - b.calcDistance);
  }

  // 篩選時自動展開清單面板
  const resultsPanel = document.getElementById('resultsPanel');
  if (resultsPanel && (selectedCity !== 'all' || selectedCategory !== 'all' || searchText !== '')) {
    resultsPanel.classList.add('active');
  }

  renderData(filteredPlaces);
}

// 4. 生成店家卡片 HTML (含距離標籤與雙向跳轉功能)
function createCardHtml(place, index) {
  const name = place.name || place.Name || '未命名店家';
  const city = place.city || place.City || '';
  const category = place.category || place.Category || '補給站';
  const phone = place.phone || place.Phone || place.tel || place.Tel || '';
  const discount = place.discount || place.Discount || '優惠待定';
  const address = place.address || place.Address || '';
  const logoUrl = place.logo || place.Logo || place.imageUrl || place.ImageUrl || '';
  const lat = place.lat || place.Lat;
  const lng = place.lng || place.Lng;

  const queryText = address ? `${name} ${address}` : name;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
  const tagText = city ? `${city} · ${category}` : category;

  const distanceHtml = place.calcDistance && place.calcDistance < 999 
    ? `<span class="distance-badge"><i class="fa-solid fa-route"></i> ${place.calcDistance.toFixed(1)} km</span>` 
    : '';

  return `
    <div id="station-card-${index}" class="station-card" style="
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      transition: all 0.3s ease;
    ">
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${logoUrl ? 
              `<img src="${logoUrl}" alt="${name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #eee;">` : 
              `<div style="width: 40px; height: 40px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; border: 1px solid #eee;"><i class="fa-solid fa-store"></i></div>`
            }
            <span style="
              background-color: #fde8e0;
              color: #e07a5f;
              font-size: 12.5px;
              font-weight: 600;
              padding: 4px 10px;
              border-radius: 20px;
              display: inline-block;
            ">${tagText}</span>
          </div>
          ${distanceHtml}
        </div>

        <h3 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 10px 0; line-height: 1.3;">${name}</h3>

        ${address ? `
          <p style="margin: 0 0 6px 0; font-size: 13.5px; color: #64748b; display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
            <i class="fa-solid fa-location-dot" style="color: #c85a44; font-size: 13px; margin-top: 3px; flex-shrink: 0;"></i>
            <span>${address}</span>
          </p>
        ` : ''}

        ${phone ? `
          <p style="margin: 0 0 6px 0; font-size: 13.5px; color: #64748b; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-phone" style="font-size: 12px; flex-shrink: 0;"></i>
            <span>${phone}</span>
          </p>
        ` : ''}

        <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #e07a5f; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-gift" style="flex-shrink: 0;"></i>
          <span>${discount}</span>
        </p>
      </div>

      <div style="display: flex; gap: 8px;">
        ${(lat && lng) ? `
          <button onclick="focusOnMap(${index}, ${lat}, ${lng})" style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background-color: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
            padding: 9px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <i class="fa-solid fa-location-crosshairs" style="color: #e07a5f;"></i>
            <span>地圖看位置</span>
          </button>
        ` : ''}

        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" style="
          flex: 1.2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background-color: #1e293b;
          color: #ffffff;
          text-decoration: none;
          padding: 9px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: background-color 0.2s;
        ">
          <i class="fa-solid fa-paper-plane" style="font-size: 11px;"></i>
          <span>開啟導航</span>
        </a>
      </div>
    </div>
  `;
}

// 5. 點擊卡片「地圖看位置」觸發的函式
function focusOnMap(index, lat, lng) {
  // 手機端點擊時收合卡片抽屜，顯示全貌地圖
  if (window.innerWidth <= 768) {
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) resultsPanel.classList.remove('active');
  }

  if (map) {
    map.flyTo([lat, lng], 16, { duration: 1.2 });
    
    if (markerMap[index]) {
      setTimeout(() => {
        markerMap[index].openPopup();
      }, 1200);
    }
  }
}

// 6. GPS 定位函式
function getUserLocation() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
      userLatLng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // 在地圖上繪製使用者藍色定位點
      L.circleMarker([userLatLng.lat, userLatLng.lng], {
        radius: 8,
        color: '#ffffff',
        fillColor: '#1877f2',
        fillOpacity: 1,
        weight: 2
      }).addTo(map).bindPopup("📍 你目前的位置").openPopup();

      // ✨ 動畫平移至當前位置
      map.flyTo([userLatLng.lat, userLatLng.lng], 15, {
        duration: 1.5
      });

      // 展開面板呈現排序好的距離
      const resultsPanel = document.getElementById('resultsPanel');
      if (resultsPanel) resultsPanel.classList.add('active');

      filterData(); // 重新計算距離並排序列表
    }, error => {
      alert("無法取得您的位置，請確認瀏覽器已開啟定位權限。");
    });
  } else {
    alert("您的瀏覽器不支援 GPS 定位功能。");
  }
}

// 7. 渲染地圖 Marker 與卡片
function renderData(places) {
  markersGroup.clearLayers();
  markerMap = {}; 
  
  const cardContainer = document.getElementById('station-grid') || document.getElementById('stationGrid'); 
  if (cardContainer) cardContainer.innerHTML = '';

  if (!places || places.length === 0) {
    if (cardContainer) {
      cardContainer.innerHTML = `
        <div style="
          text-align: center;
          padding: 40px 20px;
          background: #ffffff;
          border-radius: 16px;
          border: 1px dashed #cbd5e1;
          margin: 10px 0;
        ">
          <div style="font-size: 36px; margin-bottom: 8px;">🌹</div>
          <h4 style="font-size: 16px; color: #1e293b; font-weight: 700; margin: 0 0 6px 0;">找不到相關浪漫補給站</h4>
          <p style="font-size: 13px; color: #64748b; margin: 0;">嘗試調整搜尋關鍵字看看吧！</p>
        </div>
      `;
    }
    return;
  }

  const bounds = [];

  places.forEach((place, index) => {
    const lat = place.lat || place.Lat;
    const lng = place.lng || place.Lng;
    const name = place.name || place.Name || '';
    const category = place.category || place.Category || '';

    if (lat && lng) {
      const marker = L.marker([lat, lng], { icon: roseEmojiIcon })
        .bindPopup(`<b>${name}</b><br><span style="color: #64748b; font-size: 12px;">${category}</span>`);
      
      // 點擊地圖上的玫瑰花 Marker
      marker.on('click', () => {
        const resultsPanel = document.getElementById('resultsPanel');
        if (resultsPanel) resultsPanel.classList.add('active'); // 展開面板

        const targetCard = document.getElementById(`station-card-${index}`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

          targetCard.style.borderColor = '#e07a5f';
          targetCard.style.boxShadow = '0 0 0 3px rgba(224, 122, 95, 0.25)';

          setTimeout(() => {
            targetCard.style.borderColor = '#e5e7eb';
            targetCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
          }, 1500);
        }
      });

      markersGroup.addLayer(marker);
      markerMap[index] = marker;
      bounds.push([lat, lng]);
    }

    if (cardContainer) {
      const cardHtml = createCardHtml(place, index);
      cardContainer.insertAdjacentHTML('beforeend', cardHtml);
    }
  });

  if (bounds.length > 0 && map) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// 8. 初始化 Swiper 與地圖
document.addEventListener('DOMContentLoaded', () => {
  initMapAndData();

  const swiperElement = document.querySelector('.about-swiper');
  if (swiperElement && typeof Swiper !== 'undefined') {
    new Swiper('.about-swiper', {
      loop: true,
      autoplay: {
        delay: 4000,
        disableOnInteraction: false,
      },
      effect: 'fade',
      fadeEffect: {
        crossFade: true
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
    });
  }
});