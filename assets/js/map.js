// 1. 你的 GAS 網頁應用程式 URL
const romanticApiUrl = "https://script.google.com/macros/s/AKfycbzEaSWoZET1mj-R9lGD1fCTGx2wPT5Jygnwg-FMXkiMhl6htfNuolwbEWCSANP5i1s_lA/exec";

// 2. 初始化 Leaflet 地圖（預設定位在台灣中心點附近）
const map = L.map('map').setView([23.973875, 120.982024], 7.5); 

// 3. 載入底圖
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 用來存放地圖標記的圖層群組（這樣每次篩選才能清空重畫）
let markersGroup = L.layerGroup().addTo(map);

// 全域變數，用來存放從雲端抓下來的所有補給站資料
let allStations = [];

// 4. 抓取資料並初始化網頁
async function initData() {
    try {
        console.log("正在從 GAS 浪漫補給站抓取最新資料...");
        const response = await fetch(romanticApiUrl);
        
        if (!response.ok) {
            throw new Error("網路連線回應錯誤: " + response.status);
        }

        // 直接接收 GAS 處理好的 JSON 陣列
        allStations = await response.json(); 
        console.log("🎉 成功載入浪漫補給站資料，總數：", allStations.length, allStations);
        
        // 開始進行初次地圖與列表渲染
        renderMapAndList(allStations);

    } catch (error) {
        console.error("❌ 地圖資料載入失敗，請檢查雲端設定:", error);
        // 如果載入失敗，這裡放一個英文欄位規格的本地備用防當機資料
        allStations = [
            { "name": "連線失敗備用點", "category": "系統提示", "city": "請檢查網路", "discount": "請重新整理網頁", "phone": "", "address": "目前無法取得雲端試算表資料", "lat": 23.97, "lng": 120.98, "logo": "" }
        ];
        renderMapAndList(allStations);
    }
}

// 5. 核心渲染函式：將資料畫到地圖上並產出下方卡片
function renderMapAndList(data) {
    // A. 清空地圖上原有的所有 Marker
    markersGroup.clearLayers();
    
    // B. 清空網頁下方的文字卡片列表容器
    const stationGrid = document.getElementById('stationGrid');
    if (stationGrid) stationGrid.innerHTML = '';

    // 如果篩選後沒有半個補給站，顯示提示訊息
    if (data.length === 0) {
        if (stationGrid) stationGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--peach);">沒有找到相符的浪漫補給站</div>`;
        return;
    }

    // 預設的浪漫占位圖，當無圖片或破圖時使用
    const defaultPlaceholder = "https://via.placeholder.com/150?text=Romantic";

    // C. 開始依序跑每一筆補給站資料
    data.forEach(station => {
        // 【嚴格對齊英文欄位】完全移除中文 Key 避免錯位判定
        const name = station.name || "未命名補給站";
        const category = station.category || "未分類";
        const city = station.city || "";
        const discount = station.discount || "無特別優惠";
        const phone = station.phone || "無";
        const address = station.address || "";
        
        // --- 圖片處理與安全篩選邏輯 ---
        let logoRaw = station.logo || "";
        let logo = logoRaw.toString().trim();

        // 核心防護：如果拿到的內容不是網址（例如試算表欄位錯格吃到中文字），直接清空觸發預設圖
        if (!logo.toLowerCase().startsWith("http")) {
            logo = ""; 
        } else if (logo.includes("drive.google.com")) {
            // 解析 Google Drive 格式並轉為直接外連網址 (若無使用 GAS 的 Base64 轉換時的雙重保險)
            let fileId = "";
            if (logo.includes("id=")) {
                const urlParams = new URLSearchParams(logo.split('?')[1]);
                fileId = urlParams.get('id');
            } else if (logo.includes("/file/d/")) {
                const matches = logo.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (matches) fileId = matches[1];
            }
            
            if (fileId) {
                logo = `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
        }

        // 最終保險：如果空值，套用預設圖
        if (!logo) {
            logo = defaultPlaceholder;
        }
        
        // 強制將經緯度字串轉為浮點數，防呆避免地圖出錯
        const lat = parseFloat(station.lat);
        const lng = parseFloat(station.lng);

        // 產生 Google Maps 導航連結
        const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name + ' ' + address)}`;
        
        // 建立地圖地標彈出視窗（Popup）的 HTML（加入 onerror 破圖防禦）
        const popupHtml = `
            <div class="map-popup-content" style="font-family: sans-serif; min-width: 200px;">
                <img src="${logo}" alt="LOGO" class="popup-logo" onerror="this.src='${defaultPlaceholder}';" style="width:50px; height:50px; object-fit:cover; border-radius:50%; float:right; margin-left:10px;">
                <h4 style="margin: 5px 0; color:#E05263; font-size:16px; font-weight:bold;">${name}</h4>
                <p style="margin: 3px 0; font-size:13px;"><strong>分類：</strong>${city} · ${category}</p>
                <p style="margin: 3px 0; font-size:13px; color:#E05263;"><strong>優惠：</strong>${discount}</p>
                <p style="margin: 3px 0; font-size:12px; color:#666;"><strong>地址：</strong>${address}</p>
                <a href="${mapUrl}" target="_blank" style="margin-top:8px; display:inline-block; color:white; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:12px; background-color:#1D2D44;">
                    <i class="fa-solid fa-location-arrow"></i> 開始導航
                </a>
            </div>
        `;

        // D. 只要經緯度合法，就畫地標（Marker）上地圖
        if (!isNaN(lat) && !isNaN(lng)) {
            L.marker([lat, lng])
             .bindPopup(popupHtml)
             .addTo(markersGroup);
        }

        // E. 同步渲染網頁下方的精美文字卡片（修正 src 與 onerror）
        if (stationGrid) {
            const card = document.createElement('div');
            card.className = 'station-card';
            card.innerHTML = `
                <div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                        <img src="${logo}" onerror="this.src='${defaultPlaceholder}';" style="width:40px; height:40px; object-fit:cover; border-radius:50%; border:1px solid #ddd;">
                        <span class="station-tag" style="margin:0;">${city} · ${category}</span>
                    </div>
                    <h3 class="station-name">${name}</h3>
                    <p style="font-size:13px; color:#666; margin-bottom:5px;"><i class="fa-solid fa-phone"></i> ${phone}</p>
                    <p class="station-discount"><i class="fa-solid fa-gift"></i> ${discount}</p>
                </div>
                <a href="${mapUrl}" target="_blank" class="nav-btn"><i class="fa-solid fa-location-arrow"></i> 開啟 Google Maps 導航</a>
            `;
            stationGrid.appendChild(card);
        }
    });

    // F. 當點選或輸入搜尋時，自動縮放到適合看見所有篩選地標的視野
    if (data.length > 0) {
        const group = new L.featureGroup(markersGroup.getLayers());
        if (group.getBounds().isValid()) {
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
}

// 6. 搜尋關鍵字即時監聽（同步修正為英文標頭對齊屬性）
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        
        // 篩選包含關鍵字的補給站（支援名稱、分類、縣市、地址、優惠等模糊搜尋）
        const filtered = allStations.filter(station => {
            const name = (station.name || "").toLowerCase();
            const category = (station.category || "").toLowerCase();
            const city = (station.city || "").toLowerCase();
            const address = (station.address || "").toLowerCase();
            const discount = (station.discount || "").toLowerCase();
            
            return name.includes(keyword) || 
                   category.includes(keyword) || 
                   city.includes(keyword) || 
                   address.includes(keyword) || 
                   discount.includes(keyword);
        });
        
        // 重新呼叫渲染，讓地圖與列表同步更新！
        renderMapAndList(filtered);
    });
}

// 執行初始化，啟動浪漫補給站功能！
initData();