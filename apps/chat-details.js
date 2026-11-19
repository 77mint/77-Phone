/* =========================================================
   Chat 聊天详情页 (apps/chat-details.js)
   - 拦截 #ctRoomMoreBtn，不改动 apps/chat.js / apps/chat.css
   - 包含：资料/群成员、置顶排序、免打扰小铃铛、聊天背景、
     查找聊天记录（感知真实时间日历筛选）、实时天气/地点感知、
     线上预设单选页、单独挂载世界书多选页、清空记录
   ========================================================= */

(function () {
    const SETTINGS_KEY = 'chat_thread_settings_v1';
    const REAL_CTX_CACHE_KEY = 'phone_real_context_cache_v1';
    const THREADS_KEY = 'chat_threads_v1';
    const MSGS_PREFIX = 'chat_msgs_v1_';
    const PRESETS_LIST_KEY = 'phone_presets_list_v1';
    const PRESETS_ONLINE_KEY = 'phone_presets_active_online_v1';

    let currentThreadId = null;
    let overlayEl = null;
    let rootPageEl = null;
    let searchPageEl = null;
    let presetPageEl = null;
    let lorePageEl = null;
    let toastEl = null;
    let toastTimer = null;

    // 查找聊天记录状态
    let searchKeyword = '';
    let selectedDateStr = ''; // YYYY-MM-DD
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth(); // 0-11

    // SVG 图标
    const SVG_BACK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
    const SVG_CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
    const SVG_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`;
    const SVG_CLEAR = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    const SVG_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    const SVG_GROUP = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    // 实色镂空免打扰小铃铛（彻底避免斜线交叉叠色）
    const SVG_MUTE_BELL = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <defs>
                <mask id="ctdMuteBellMask">
                    <rect width="24" height="24" fill="white"/>
                    <line x1="2.5" y1="2.5" x2="21.5" y2="21.5" stroke="black" stroke-width="3.6" stroke-linecap="round"/>
                </mask>
            </defs>
            <g mask="url(#ctdMuteBellMask)" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8.5a6 6 0 0 0-12 0c0 6.2-2.2 8.2-2.2 8.2h16.4S18 14.7 18 8.5"/>
                <path d="M10.4 19.6a1.8 1.8 0 0 0 3.2 0"/>
                <path d="M12 2.5v1"/>
            </g>
            <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>`;

    /* ---------------- 工具函数 ---------------- */
    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function saveJSON(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {}
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function bindPressed(el) {
        if (!el || el.dataset.ctdPressedBound) return;
        el.dataset.ctdPressedBound = '1';
        el.addEventListener('touchstart', () => {
            el.classList.add('is-pressed');
        }, { passive: true });
        el.addEventListener('touchmove', () => {
            el.classList.remove('is-pressed');
        }, { passive: true });
        el.addEventListener('touchend', () => {
            el.classList.remove('is-pressed');
        }, { passive: true });
        el.addEventListener('touchcancel', () => {
            el.classList.remove('is-pressed');
        }, { passive: true });
    }

    function bindAllPressed(root) {
        if (!root) return;
        root.querySelectorAll('.ctd-back-btn, .ctd-row:not(.ctd-row-static), .ctd-switch, .ctd-cal-nav-btn, .ctd-cal-day.has-msg, .ctd-date-pill-clear, .ctd-msg-item, .ctd-sheet-btn, .ctd-modal-btn').forEach(bindPressed);
    }

    function showToast(msg) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'ctd-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('show');
        }, 2000);
    }

    function getAllSettings() {
        return loadJSON(SETTINGS_KEY, {});
    }

    function getThreadSettings(threadId) {
        if (!threadId) return {};
        const all = getAllSettings();
        return Object.assign({
            pinned: false,
            muted: false,
            realTime: false,
            realWeather: false,
            realLocation: false,
            presetId: '',
            loreOverride: false,
            loreIds: [],
            hasBg: false
        }, all[threadId] || {});
    }

    function updateThreadSettings(threadId, patch) {
        if (!threadId) return {};
        const all = getAllSettings();
        const next = Object.assign(getThreadSettings(threadId), patch);
        all[threadId] = next;
        saveJSON(SETTINGS_KEY, all);
        return next;
    }

    function getThreads() {
        try {
            if (window.PhoneChat && typeof window.PhoneChat.getThreads === 'function') {
                return window.PhoneChat.getThreads() || [];
            }
        } catch (e) {}
        return loadJSON(THREADS_KEY, []);
    }

    function getThreadById(threadId) {
        return getThreads().find(t => t.id === threadId) || null;
    }

    function getArchiveChars() {
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
                return window.PhoneArchive.getChars() || [];
            }
        } catch (e) {}
        return [];
    }

    function getCharById(charId) {
        const list = getArchiveChars();
        return list.find(c => c.id === charId) || null;
    }

    function getCharAvatar(charObj) {
        if (!charObj) return '';
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
                return window.PhoneArchive.getCharAvatar(charObj.id) || charObj.avatar || '';
            }
        } catch (e) {}
        return charObj.avatar || '';
    }

    function getThreadMessages(threadId) {
        const msgs = loadJSON(MSGS_PREFIX + threadId, []);
        return Array.isArray(msgs) ? msgs : [];
    }

    /* ---------------- 日期解析（用于感知真实时间日历） ---------------- */
    function toDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function extractMsgTimestamp(msg) {
        if (!msg) return null;
        if (typeof msg.ts === 'number' && msg.ts > 1000000000000) return msg.ts;
        if (typeof msg.timestamp === 'number' && msg.timestamp > 1000000000000) return msg.timestamp;
        if (typeof msg.createdAt === 'number' && msg.createdAt > 1000000000000) return msg.createdAt;
        if (typeof msg.id === 'string') {
            const match = msg.id.match(/(\d{13})/);
            if (match) return Number(match[1]);
        }
        return null;
    }

    function getMsgDateStr(msg) {
        if (msg && typeof msg.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(msg.date)) {
            return msg.date;
        }
        const ts = extractMsgTimestamp(msg);
        if (ts) return toDateStr(new Date(ts));
        return '';
    }

    function formatMsgTimeLabel(msg, withDate) {
        const ts = extractMsgTimestamp(msg);
        if (ts) {
            const d = new Date(ts);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            if (withDate) {
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                return `${mo}-${da} ${hh}:${mm}`;
            }
            return `${hh}:${mm}`;
        }
        return msg && msg.time ? msg.time : '';
    }

    function formatMsgPreview(msg) {
        if (!msg) return '';
        if (msg.type === 'image') return '[图片]';
        if (msg.type === 'voice') return msg.transcript ? `[语音] ${msg.transcript}` : '[语音消息]';
        if (msg.type === 'transfer') return `[转账] ¥${Number(msg.amount || 0).toFixed(2)}`;
        if (msg.type === 'listen') return `[一起听] ${msg.songTitle || msg.text || ''}`;
        return msg.text || '';
    }

    /* ---------------- 预设与世界书读取 ---------------- */
    function getAvailableOnlinePresets() {
        let list = [];
        try {
            if (window.PhonePresets && typeof window.PhonePresets.getPresets === 'function') {
                list = window.PhonePresets.getPresets() || [];
            }
        } catch (e) {}
        if (!Array.isArray(list) || !list.length) {
            list = loadJSON(PRESETS_LIST_KEY, []);
        }
        if (!Array.isArray(list)) return [];
        return list.filter(p => p && p.type !== 'folder' && (!p.mode || p.mode === 'online'));
    }

    function getGlobalActivePreset() {
        try {
            if (window.PhonePresets && typeof window.PhonePresets.getActivePreset === 'function') {
                const p = window.PhonePresets.getActivePreset('online');
                if (p) return p;
            }
        } catch (e) {}
        const activeId = localStorage.getItem(PRESETS_ONLINE_KEY) || '';
        const list = getAvailableOnlinePresets();
        return list.find(p => p.id === activeId) || null;
    }

    function getPresetDisplayInfo(settings) {
        const list = getAvailableOnlinePresets();
        const globalPreset = getGlobalActivePreset();
        const globalName = globalPreset ? (globalPreset.name || '未命名预设') : '未选择';
        if (settings && settings.presetId) {
            const custom = list.find(p => p.id === settings.presetId);
            if (custom) {
                return {
                    isCustom: true,
                    preset: custom,
                    label: custom.name || '未命名预设',
                    globalName
                };
            }
        }
        return {
            isCustom: false,
            preset: globalPreset,
            label: globalPreset ? `跟随全局（${globalName}）` : '跟随全局（未选择）',
            globalName
        };
    }

    function getAvailableLorebooks() {
        const candidates = [];
        try {
            if (window.PhoneLorebook) {
                if (typeof window.PhoneLorebook.getBooks === 'function') {
                    const res = window.PhoneLorebook.getBooks();
                    if (Array.isArray(res)) candidates.push(...res);
                } else if (typeof window.PhoneLorebook.getAll === 'function') {
                    const res = window.PhoneLorebook.getAll();
                    if (Array.isArray(res)) candidates.push(...res);
                } else if (typeof window.PhoneLorebook.getList === 'function') {
                    const res = window.PhoneLorebook.getList();
                    if (Array.isArray(res)) candidates.push(...res);
                }
            }
        } catch (e) {}

        if (!candidates.length) {
            const keys = ['phone_lorebooks_v1', 'phone_lorebook_books_v1', 'lorebooks_v1', 'phone_worldbooks_v1'];
            for (const k of keys) {
                const arr = loadJSON(k, null);
                if (Array.isArray(arr) && arr.length) {
                    candidates.push(...arr);
                    break;
                }
            }
        }

        if (!candidates.length) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k || (!k.includes('lore') && !k.includes('worldbook'))) continue;
                    const parsed = loadJSON(k, null);
                    if (Array.isArray(parsed) && parsed.length && parsed[0] && (parsed[0].name || parsed[0].title)) {
                        candidates.push(...parsed);
                        break;
                    }
                }
            } catch (e) {}
        }

        const seen = new Set();
        return candidates.filter(b => {
            if (!b || !b.id) return false;
            if (seen.has(b.id)) return false;
            seen.add(b.id);
            return true;
        });
    }

    /* ---------------- 真实天气与地点感知 ---------------- */
    function weatherCodeToText(code) {
        const map = {
            0: '晴',
            1: '大部晴朗',
            2: '多云',
            3: '阴',
            45: '雾',
            48: '冻雾',
            51: '小毛毛雨',
            53: '毛毛雨',
            55: '浓毛毛雨',
            61: '小雨',
            63: '中雨',
            65: '大雨',
            71: '小雪',
            73: '中雪',
            75: '大雪',
            80: '阵雨',
            81: '强阵雨',
            82: '暴雨',
            95: '雷阵雨',
            96: '雷阵雨伴冰雹'
        };
        return map[code] || '多云';
    }

    function getRealContextCache() {
        return loadJSON(REAL_CTX_CACHE_KEY, {});
    }

    async function fetchCoords() {
        if (navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 5500,
                        maximumAge: 300000
                    });
                });
                return {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    source: 'gps'
                };
            } catch (e) {}
        }

        const resp = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!resp.ok) throw new Error('ip_geo_failed');
        const data = await resp.json();
        return {
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            source: 'ip'
        };
    }

    async function refreshRealContext(needLocation, needWeather) {
        const cache = getRealContextCache();
        const coords = await fetchCoords();

        let locationText = cache.locationText || '';
        if (needLocation || !locationText) {
            try {
                const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=zh`;
                const gRes = await fetch(geoUrl);
                if (gRes.ok) {
                    const gData = await gRes.json();
                    const parts = [gData.principalSubdivision, gData.city, gData.locality].filter(Boolean);
                    const unique = [...new Set(parts)];
                    locationText = unique.join(' · ') || gData.countryName || '';
                }
            } catch (e) {}
            if (!locationText && (coords.city || coords.region)) {
                locationText = [coords.region, coords.city].filter(Boolean).join(' · ');
            }
        }

        let weatherText = cache.weatherText || '';
        if (needWeather) {
            const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
            const wRes = await fetch(wUrl);
            if (wRes.ok) {
                const wData = await wRes.json();
                if (wData && wData.current) {
                    const temp = Math.round(wData.current.temperature_2m);
                    const desc = weatherCodeToText(wData.current.weather_code);
                    const hum = wData.current.relative_humidity_2m;
                    weatherText = `${desc} ${temp}°C（湿度 ${hum}%）`;
                }
            }
        }

        const nextCache = {
            lat: coords.lat,
            lon: coords.lon,
            locationText: locationText || cache.locationText || '',
            weatherText: weatherText || cache.weatherText || '',
            updatedAt: Date.now()
        };
        saveJSON(REAL_CTX_CACHE_KEY, nextCache);
        return nextCache;
    }

    /* ---------------- 聊天界面同步：置顶 / 免打扰铃铛 / 背景 ---------------- */
    function sortThreadsByPin() {
        const allSettings = getAllSettings();
        const threads = loadJSON(THREADS_KEY, []);
        if (!Array.isArray(threads) || !threads.length) return;

        const pinnedList = [];
        const normalList = [];
        threads.forEach(t => {
            if (allSettings[t.id] && allSettings[t.id].pinned) {
                pinnedList.push(t);
            } else {
                normalList.push(t);
            }
        });
        const sorted = pinnedList.concat(normalList);
        const changed = sorted.some((t, i) => threads[i] && threads[i].id !== t.id);
        if (changed) {
            saveJSON(THREADS_KEY, sorted);
        }
        syncHomePinnedUI(sorted, allSettings);
    }

    function syncHomePinnedUI(sortedThreads, allSettings) {
        const listEl = document.querySelector('#app-chat .ct-flat-list');
        if (!listEl) return;
        const settings = allSettings || getAllSettings();
        const threads = sortedThreads || getThreads();
        const pinnedIds = new Set(threads.filter(t => settings[t.id] && settings[t.id].pinned).map(t => t.id));
        const pinnedNames = new Set(threads.filter(t => pinnedIds.has(t.id)).map(t => t.name));

        const rows = Array.from(listEl.children);
        if (!rows.length) return;

        rows.forEach(row => {
            const tid = row.dataset.threadId || row.dataset.id || '';
            const nameEl = row.querySelector('.ct-chat-name, .ct-name, [class*="name"]');
            const rowName = nameEl ? nameEl.textContent.trim() : '';
            const isPinned = (tid && pinnedIds.has(tid)) || (rowName && pinnedNames.has(rowName));
            row.classList.toggle('ctd-pinned-row', Boolean(isPinned));
        });

        const pinnedRows = rows.filter(r => r.classList.contains('ctd-pinned-row'));
        const normalRows = rows.filter(r => !r.classList.contains('ctd-pinned-row'));
        const reordered = pinnedRows.concat(normalRows);
        const needMove = reordered.some((el, idx) => rows[idx] !== el);
        if (needMove) {
            reordered.forEach(el => listEl.appendChild(el));
        }
    }

    function syncMuteBellUI() {
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return;
        const tid = resolveActiveThreadId();
        const settings = getThreadSettings(tid);
        let bell = titleEl.querySelector('#ctRoomMuteBell');

        if (tid && settings.muted) {
            if (!bell) {
                bell = document.createElement('span');
                bell.id = 'ctRoomMuteBell';
                bell.className = 'ctd-mute-bell';
                bell.innerHTML = SVG_MUTE_BELL;
                titleEl.appendChild(bell);
            }
        } else if (bell) {
            bell.remove();
        }
    }

    async function syncRoomBackgroundUI() {
        const msgBox = document.getElementById('ctRoomMessages');
        if (!msgBox) return;
        const tid = resolveActiveThreadId();
        if (!tid || !window.PhoneDB || typeof window.PhoneDB.get !== 'function') {
            msgBox.style.backgroundImage = '';
            msgBox.classList.remove('ctd-has-bg');
            return;
        }
        try {
            const bgData = await window.PhoneDB.get('chat_bg_' + tid);
            if (bgData) {
                msgBox.style.backgroundImage = `url("${bgData}")`;
                msgBox.classList.add('ctd-has-bg');
            } else {
                msgBox.style.backgroundImage = '';
                msgBox.classList.remove('ctd-has-bg');
            }
        } catch (e) {
            msgBox.style.backgroundImage = '';
            msgBox.classList.remove('ctd-has-bg');
        }
    }

    function resolveActiveThreadId() {
        if (currentThreadId) return currentThreadId;
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return null;
        const clone = titleEl.cloneNode(true);
        const bell = clone.querySelector('#ctRoomMuteBell');
        if (bell) bell.remove();
        const titleText = clone.textContent.trim();
        if (!titleText) return null;
        const threads = getThreads();
        const matched = threads.find(t => (t.name || '').trim() === titleText);
        if (matched) {
            currentThreadId = matched.id;
            return matched.id;
        }
        return null;
    }

    /* ---------------- 弹窗与动作菜单 ---------------- */
    function openActionSheet({ title, desc, actions }) {
        const backdrop = document.createElement('div');
        backdrop.className = 'ctd-sheet-backdrop';
        const actionsHtml = actions.map((a, idx) => `
            <button type="button" class="ctd-sheet-btn ${a.danger ? 'danger' : ''}" data-idx="${idx}">${escapeHtml(a.label)}</button>
        `).join('');

        backdrop.innerHTML = `
            <div class="ctd-sheet-box">
                <div class="ctd-sheet-group">
                    ${title ? `
                        <div class="ctd-sheet-header">
                            <div class="ctd-sheet-title">${escapeHtml(title)}</div>
                            ${desc ? `<div class="ctd-sheet-desc">${escapeHtml(desc)}</div>` : ''}
                        </div>
                    ` : ''}
                    ${actionsHtml}
                </div>
                <div class="ctd-sheet-group">
                    <button type="button" class="ctd-sheet-btn cancel" data-cancel="1">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        bindAllPressed(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('open'));

        function close() {
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 260);
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                close();
                return;
            }
            const cancelBtn = e.target.closest('[data-cancel="1"]');
            if (cancelBtn) {
                close();
                return;
            }
            const actBtn = e.target.closest('[data-idx]');
            if (actBtn) {
                const idx = Number(actBtn.dataset.idx);
                close();
                if (actions[idx] && typeof actions[idx].onClick === 'function') {
                    actions[idx].onClick();
                }
            }
        });
    }

    function openInputModal({ title, value, placeholder, onConfirm }) {
        const backdrop = document.createElement('div');
        backdrop.className = 'ctd-modal-backdrop';
        backdrop.innerHTML = `
            <div class="ctd-modal-card">
                <div class="ctd-modal-body">
                    <div class="ctd-modal-title">${escapeHtml(title)}</div>
                    <input type="text" class="ctd-modal-input" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder || '')}" maxlength="32">
                </div>
                <div class="ctd-modal-actions">
                    <button type="button" class="ctd-modal-btn" data-act="cancel">取消</button>
                    <button type="button" class="ctd-modal-btn" data-act="ok">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        bindAllPressed(backdrop);
        const input = backdrop.querySelector('.ctd-modal-input');
        requestAnimationFrame(() => {
            backdrop.classList.add('open');
            setTimeout(() => input && input.focus(), 120);
        });

        function close() {
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 220);
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close();
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            if (btn.dataset.act === 'cancel') {
                close();
            } else {
                const val = input ? input.value.trim() : '';
                close();
                if (typeof onConfirm === 'function') onConfirm(val);
            }
        });
    }

    /* ---------------- DOM 构建与页面渲染 ---------------- */
    function ensureOverlayDOM() {
        if (overlayEl) return;
        const appChat = document.getElementById('app-chat');
        const mountParent = (appChat && appChat.parentElement) ? appChat.parentElement : document.body;

        overlayEl = document.createElement('div');
        overlayEl.id = 'ctDetailsOverlay';
        overlayEl.className = 'ctd-overlay';
        overlayEl.innerHTML = `
            <div class="ctd-page ctd-page-root" id="ctDetailsMainView">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" id="ctdBackBtn">${SVG_BACK}</button>
                    <div class="ctd-title">聊天详情</div>
                </div>
                <div class="ctd-scroll" id="ctdMainScroll"></div>
            </div>

            <div class="ctd-page" id="ctDetailsSearchView">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" id="ctdSearchBackBtn">${SVG_BACK}</button>
                    <div class="ctd-title">查找聊天记录</div>
                </div>
                <div class="ctd-scroll" id="ctdSearchScroll"></div>
            </div>

            <div class="ctd-page" id="ctDetailsPresetView">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" id="ctdPresetBackBtn">${SVG_BACK}</button>
                    <div class="ctd-title">线上预设</div>
                </div>
                <div class="ctd-scroll" id="ctdPresetScroll"></div>
            </div>

            <div class="ctd-page" id="ctDetailsLoreView">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" id="ctdLoreBackBtn">${SVG_BACK}</button>
                    <div class="ctd-title">单独挂载世界书</div>
                </div>
                <div class="ctd-scroll" id="ctdLoreScroll"></div>
            </div>
        `;
        mountParent.appendChild(overlayEl);

        rootPageEl = document.getElementById('ctDetailsMainView');
        searchPageEl = document.getElementById('ctDetailsSearchView');
        presetPageEl = document.getElementById('ctDetailsPresetView');
        lorePageEl = document.getElementById('ctDetailsLoreView');

        document.getElementById('ctdBackBtn').addEventListener('click', closeDetails);
        document.getElementById('ctdSearchBackBtn').addEventListener('click', () => closeSubPage(searchPageEl));
        document.getElementById('ctdPresetBackBtn').addEventListener('click', () => closeSubPage(presetPageEl));
        document.getElementById('ctdLoreBackBtn').addEventListener('click', () => closeSubPage(lorePageEl));
        bindAllPressed(overlayEl);
    }

    function openSubPage(pageEl) {
        if (!pageEl) return;
        rootPageEl.classList.add('is-behind');
        pageEl.classList.add('open');
    }

    function closeSubPage(pageEl) {
        if (!pageEl) return;
        pageEl.classList.remove('open');
        rootPageEl.classList.remove('is-behind');
        renderMainView();
    }

    function openDetails(threadId) {
        currentThreadId = threadId || resolveActiveThreadId();
        if (!currentThreadId) return;
        ensureOverlayDOM();
        searchPageEl.classList.remove('open');
        presetPageEl.classList.remove('open');
        lorePageEl.classList.remove('open');
        rootPageEl.classList.remove('is-behind');
        renderMainView();
        requestAnimationFrame(() => overlayEl.classList.add('open'));
    }

    function closeDetails() {
        if (!overlayEl) return;
        overlayEl.classList.remove('open');
        searchPageEl.classList.remove('open');
        presetPageEl.classList.remove('open');
        lorePageEl.classList.remove('open');
        rootPageEl.classList.remove('is-behind');
    }

    /* ---------------- 主详情页渲染 ---------------- */
    function renderMainView() {
        const scrollEl = document.getElementById('ctdMainScroll');
        if (!scrollEl || !currentThreadId) return;

        const thread = getThreadById(currentThreadId);
        const settings = getThreadSettings(currentThreadId);
        const cache = getRealContextCache();
        const isGroup = thread && thread.type === 'group';

        // 1. 资料卡
        let profileHtml = '';
        if (isGroup) {
            const memberIds = Array.isArray(thread.memberIds) ? thread.memberIds : [];
            const membersHtml = memberIds.map(id => {
                const c = getCharById(id);
                const name = c ? (c.name || c.nickname || '未命名') : '成员';
                const av = getCharAvatar(c);
                return `
                    <div class="ctd-member-item">
                        <div class="ctd-member-av">${av ? `<img src="${escapeHtml(av)}" alt="">` : escapeHtml(name.slice(0, 1))}</div>
                        <div class="ctd-member-name">${escapeHtml(name)}</div>
                    </div>
                `;
            }).join('');

            profileHtml = `
                <div class="ctd-card ctd-profile-card">
                    <div class="ctd-profile-head ctd-row-static" id="ctdEditGroupNameRow" style="cursor:pointer;">
                        <div class="ctd-avatar-lg">${SVG_GROUP}</div>
                        <div class="ctd-profile-info">
                            <div class="ctd-profile-name">${escapeHtml(thread.name || '群聊')}</div>
                            <div class="ctd-profile-sub">共 ${memberIds.length} 位成员 · 点击修改群名</div>
                        </div>
                        <div class="ctd-chevron">${SVG_CHEVRON}</div>
                    </div>
                    ${membersHtml ? `<div class="ctd-group-members">${membersHtml}</div>` : ''}
                </div>
            `;
        } else {
            const c = thread ? getCharById(thread.charId) : null;
            const name = thread ? (thread.name || (c && (c.name || c.nickname)) || '联系人') : '联系人';
            const av = getCharAvatar(c);
            const fallbackChar = (c && c.id === 'assistant-shuixiaojiu') ? '九' : name.slice(0, 1);
            profileHtml = `
                <div class="ctd-card ctd-profile-card">
                    <div class="ctd-profile-head">
                        <div class="ctd-avatar-lg">${av ? `<img src="${escapeHtml(av)}" alt="">` : escapeHtml(fallbackChar)}</div>
                        <div class="ctd-profile-info">
                            <div class="ctd-profile-name">${escapeHtml(name)}</div>
                            <div class="ctd-profile-sub">私聊会话</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. 聊天基础设置：置顶 / 免打扰 / 聊天背景
        const basicCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">置顶聊天</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.pinned ? 'on' : ''}" id="ctdPinSwitch" aria-label="置顶聊天"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">消息免打扰</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.muted ? 'on' : ''}" id="ctdMuteSwitch" aria-label="消息免打扰"></button>
                    </div>
                </div>
                <div class="ctd-row" id="ctdBgRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">聊天背景</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value" id="ctdBgValue">${settings.hasBg ? '已设置' : '默认'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 3. 查找聊天记录（位于感知真实天气上方那一块）
        const searchCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSearchEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">查找聊天记录</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 4. 实时环境感知：天气 & 地点
        const weatherSub = settings.realWeather
            ? (cache.weatherText ? `当前同步：${cache.weatherText}` : '正在同步实时天气信息...')
            : '开启后将同步当前所在地区的实时天气';
        const locationSub = settings.realLocation
            ? (cache.locationText ? `当前同步：${cache.locationText}` : '正在同步实时位置信息...')
            : '开启后将同步当前所在城市与位置信息';

        const realEnvCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实天气</div>
                        <div class="ctd-row-sub">${escapeHtml(weatherSub)}</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.realWeather ? 'on' : ''}" id="ctdWeatherSwitch" aria-label="感知真实天气"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实地点</div>
                        <div class="ctd-row-sub">${escapeHtml(locationSub)}</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.realLocation ? 'on' : ''}" id="ctdLocationSwitch" aria-label="感知真实地点"></button>
                    </div>
                </div>
            </div>
        `;

        // 5. 线上预设（可点进单选） & 单独挂载世界书
        const presetInfo = getPresetDisplayInfo(settings);
        const loreCount = Array.isArray(settings.loreIds) ? settings.loreIds.length : 0;
        const loreStatusText = settings.loreOverride ? `已选 ${loreCount} 本` : '跟随全局';

        const modelCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdPresetEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">当前线上预设</div>
                        <div class="ctd-row-sub">仅对当前对话生效，支持单选指定</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(presetInfo.label)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdLoreEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">单独挂载世界书</div>
                        <div class="ctd-row-sub">开启后仅启用已勾选的世界书</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(loreStatusText)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 6. 清空聊天记录
        const clearCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdClearChatRow">
                    <div class="ctd-row-title">清空聊天记录</div>
                </div>
            </div>
        `;

        scrollEl.innerHTML = profileHtml + basicCardHtml + searchCardHtml + realEnvCardHtml + modelCardHtml + clearCardHtml;
        bindAllPressed(scrollEl);
        bindMainViewEvents(thread);
    }

    function bindMainViewEvents(thread) {
        const editGroupRow = document.getElementById('ctdEditGroupNameRow');
        if (editGroupRow && thread && thread.type === 'group') {
            editGroupRow.addEventListener('click', () => {
                openInputModal({
                    title: '修改群聊名称',
                    value: thread.name || '',
                    placeholder: '请输入群聊名称',
                    onConfirm: (newName) => {
                        if (!newName) return;
                        const list = loadJSON(THREADS_KEY, []);
                        const idx = list.findIndex(t => t.id === currentThreadId);
                        if (idx >= 0) {
                            list[idx].name = newName;
                            saveJSON(THREADS_KEY, list);
                        }
                        const titleEl = document.getElementById('ctRoomTitle');
                        if (titleEl) {
                            titleEl.textContent = newName;
                            syncMuteBellUI();
                        }
                        renderMainView();
                        showToast('群聊名称已更新');
                    }
                });
            });
        }

        const pinSwitch = document.getElementById('ctdPinSwitch');
        if (pinSwitch) {
            pinSwitch.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = getThreadSettings(currentThreadId);
                const next = updateThreadSettings(currentThreadId, { pinned: !cur.pinned });
                pinSwitch.classList.toggle('on', next.pinned);
                sortThreadsByPin();
                showToast(next.pinned ? '已置顶该聊天' : '已取消置顶');
            });
        }

        const muteSwitch = document.getElementById('ctdMuteSwitch');
        if (muteSwitch) {
            muteSwitch.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = getThreadSettings(currentThreadId);
                const next = updateThreadSettings(currentThreadId, { muted: !cur.muted });
                muteSwitch.classList.toggle('on', next.muted);
                syncMuteBellUI();
                showToast(next.muted ? '已开启消息免打扰' : '已关闭消息免打扰');
            });
        }

        const bgRow = document.getElementById('ctdBgRow');
        if (bgRow) {
            bgRow.addEventListener('click', () => {
                openActionSheet({
                    title: '设置聊天背景',
                    actions: [
                        {
                            label: '从相册选择背景图',
                            onClick: () => pickChatBackground()
                        },
                        {
                            label: '恢复默认背景',
                            onClick: async () => {
                                if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
                                    await window.PhoneDB.del('chat_bg_' + currentThreadId);
                                }
                                updateThreadSettings(currentThreadId, { hasBg: false });
                                await syncRoomBackgroundUI();
                                renderMainView();
                                showToast('已恢复默认背景');
                            }
                        }
                    ]
                });
            });
        }

        const searchEntry = document.getElementById('ctdSearchEntryRow');
        if (searchEntry) {
            searchEntry.addEventListener('click', () => {
                searchKeyword = '';
                selectedDateStr = '';
                const now = new Date();
                calYear = now.getFullYear();
                calMonth = now.getMonth();
                renderSearchView();
                openSubPage(searchPageEl);
            });
        }

        const weatherSwitch = document.getElementById('ctdWeatherSwitch');
        if (weatherSwitch) {
            weatherSwitch.addEventListener('click', async (e) => {
                e.stopPropagation();
                const cur = getThreadSettings(currentThreadId);
                const enable = !cur.realWeather;
                updateThreadSettings(currentThreadId, { realWeather: enable });
                weatherSwitch.classList.toggle('on', enable);
                if (enable) {
                    renderMainView();
                    try {
                        await refreshRealContext(cur.realLocation, true);
                        renderMainView();
                        showToast('已开启实时天气感知');
                    } catch (err) {
                        showToast('未能获取天气信息，请检查网络或定位权限');
                    }
                } else {
                    renderMainView();
                    showToast('已关闭实时天气感知');
                }
            });
        }

        const locationSwitch = document.getElementById('ctdLocationSwitch');
        if (locationSwitch) {
            locationSwitch.addEventListener('click', async (e) => {
                e.stopPropagation();
                const cur = getThreadSettings(currentThreadId);
                const enable = !cur.realLocation;
                updateThreadSettings(currentThreadId, { realLocation: enable });
                locationSwitch.classList.toggle('on', enable);
                if (enable) {
                    renderMainView();
                    try {
                        await refreshRealContext(true, cur.realWeather);
                        renderMainView();
                        showToast('已开启实时地点感知');
                    } catch (err) {
                        showToast('未能获取位置信息，请检查定位权限');
                    }
                } else {
                    renderMainView();
                    showToast('已关闭实时地点感知');
                }
            });
        }

        const presetEntry = document.getElementById('ctdPresetEntryRow');
        if (presetEntry) {
            presetEntry.addEventListener('click', () => {
                renderPresetView();
                openSubPage(presetPageEl);
            });
        }

        const loreEntry = document.getElementById('ctdLoreEntryRow');
        if (loreEntry) {
            loreEntry.addEventListener('click', () => {
                renderLoreView();
                openSubPage(lorePageEl);
            });
        }

        const clearRow = document.getElementById('ctdClearChatRow');
        if (clearRow) {
            clearRow.addEventListener('click', () => {
                const name = (thread && thread.name) || '当前对话';
                openActionSheet({
                    title: '清空聊天记录',
                    desc: `确定清空与「${name}」的全部聊天记录吗？此操作无法撤销。`,
                    actions: [
                        {
                            label: '清空聊天记录',
                            danger: true,
                            onClick: () => clearThreadMessages()
                        }
                    ]
                });
            });
        }
    }

    function pickChatBackground() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                if (!dataUrl) return;
                try {
                    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
                        await window.PhoneDB.set('chat_bg_' + currentThreadId, dataUrl);
                    }
                    updateThreadSettings(currentThreadId, { hasBg: true });
                    await syncRoomBackgroundUI();
                    renderMainView();
                    showToast('已更新聊天背景');
                } catch (e) {
                    showToast('背景保存失败，请重试');
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    function clearThreadMessages() {
        if (!currentThreadId) return;
        saveJSON(MSGS_PREFIX + currentThreadId, []);
        const threads = loadJSON(THREADS_KEY, []);
        const idx = threads.findIndex(t => t.id === currentThreadId);
        if (idx >= 0) {
            threads[idx].lastMsg = '';
            threads[idx].lastTime = '';
            saveJSON(THREADS_KEY, threads);
        }
        const msgBox = document.getElementById('ctRoomMessages');
        if (msgBox) msgBox.innerHTML = '';
        showToast('已清空聊天记录');
    }

    /* ---------------- 查找聊天记录页（含感知真实时间日历） ---------------- */
    function renderSearchView() {
        const scrollEl = document.getElementById('ctdSearchScroll');
        if (!scrollEl || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const realTimeOn = Boolean(settings.realTime);

        scrollEl.innerHTML = `
            <div class="ctd-search-box">
                <span class="ctd-search-icon">${SVG_SEARCH}</span>
                <input type="text" class="ctd-search-input" id="ctdSearchInput" placeholder="搜索聊天内容" value="${escapeHtml(searchKeyword)}">
                <button type="button" class="ctd-search-clear ${searchKeyword ? 'visible' : ''}" id="ctdSearchClear">${SVG_CLEAR}</button>
            </div>
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实时间</div>
                        <div class="ctd-row-sub">开启后可按日期筛选记录，并同步真实时间</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${realTimeOn ? 'on' : ''}" id="ctdRealTimeSwitch" aria-label="感知真实时间"></button>
                    </div>
                </div>
            </div>
            <div class="ctd-calendar-wrap" id="ctdCalendarSlot"></div>
            <div id="ctdSearchResultSlot"></div>
        `;

        bindAllPressed(scrollEl);

        const inputEl = document.getElementById('ctdSearchInput');
        const clearBtn = document.getElementById('ctdSearchClear');
        const rtSwitch = document.getElementById('ctdRealTimeSwitch');

        inputEl.addEventListener('input', () => {
            searchKeyword = inputEl.value.trim();
            clearBtn.classList.toggle('visible', Boolean(searchKeyword));
            renderSearchBody();
        });

        clearBtn.addEventListener('click', () => {
            searchKeyword = '';
            inputEl.value = '';
            clearBtn.classList.remove('visible');
            inputEl.focus();
            renderSearchBody();
        });

        rtSwitch.addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { realTime: !cur.realTime });
            rtSwitch.classList.toggle('on', next.realTime);
            selectedDateStr = '';
            renderSearchBody();
        });

        renderSearchBody();
    }

    function renderSearchBody() {
        const calSlot = document.getElementById('ctdCalendarSlot');
        const resultSlot = document.getElementById('ctdSearchResultSlot');
        if (!calSlot || !resultSlot || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const realTimeOn = Boolean(settings.realTime);
        const msgs = getThreadMessages(currentThreadId);

        // 1. 日历区（仅开启感知真实时间时显示）
        if (!realTimeOn) {
            calSlot.innerHTML = '';
        } else if (selectedDateStr) {
            const [y, m, d] = selectedDateStr.split('-');
            calSlot.innerHTML = `
                <div class="ctd-date-pill-bar">
                    <span class="ctd-date-pill-text">已选日期：${Number(y)}年${Number(m)}月${Number(d)}日</span>
                    <button type="button" class="ctd-date-pill-clear" id="ctdClearDateBtn">重选日期</button>
                </div>
            `;
            bindAllPressed(calSlot);
            document.getElementById('ctdClearDateBtn').addEventListener('click', () => {
                selectedDateStr = '';
                renderSearchBody();
            });
        } else {
            const msgDates = new Set();
            msgs.forEach(m => {
                const ds = getMsgDateStr(m);
                if (ds) msgDates.add(ds);
            });

            const firstDay = new Date(calYear, calMonth, 1).getDay();
            const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
            let daysHtml = '';
            for (let i = 0; i < firstDay; i++) {
                daysHtml += `<div class="ctd-cal-day"></div>`;
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasMsg = msgDates.has(ds);
                daysHtml += `
                    <div class="ctd-cal-day ${hasMsg ? 'has-msg' : ''}" ${hasMsg ? `data-date="${ds}"` : ''}>
                        <span>${day}</span>
                        ${hasMsg ? '<span class="ctd-cal-dot"></span>' : ''}
                    </div>
                `;
            }

            calSlot.innerHTML = `
                <div class="ctd-calendar-card">
                    <div class="ctd-cal-header">
                        <div class="ctd-cal-month">${calYear}年${calMonth + 1}月</div>
                        <div class="ctd-cal-nav">
                            <button type="button" class="ctd-cal-nav-btn" id="ctdCalPrev">${SVG_BACK}</button>
                            <button type="button" class="ctd-cal-nav-btn" id="ctdCalNext">${SVG_CHEVRON}</button>
                        </div>
                    </div>
                    <div class="ctd-cal-weekdays">
                        <span class="ctd-cal-weekday">日</span>
                        <span class="ctd-cal-weekday">一</span>
                        <span class="ctd-cal-weekday">二</span>
                        <span class="ctd-cal-weekday">三</span>
                        <span class="ctd-cal-weekday">四</span>
                        <span class="ctd-cal-weekday">五</span>
                        <span class="ctd-cal-weekday">六</span>
                    </div>
                    <div class="ctd-cal-grid">${daysHtml}</div>
                </div>
            `;
            bindAllPressed(calSlot);

            document.getElementById('ctdCalPrev').addEventListener('click', () => {
                calMonth--;
                if (calMonth < 0) {
                    calMonth = 11;
                    calYear--;
                }
                renderSearchBody();
            });
            document.getElementById('ctdCalNext').addEventListener('click', () => {
                calMonth++;
                if (calMonth > 11) {
                    calMonth = 0;
                    calYear++;
                }
                renderSearchBody();
            });
            calSlot.querySelectorAll('.ctd-cal-day.has-msg').forEach(el => {
                el.addEventListener('click', () => {
                    selectedDateStr = el.dataset.date;
                    renderSearchBody();
                });
            });
        }

        // 2. 消息结果区
        // 开启感知真实时间后：未选日期且未输入关键词时，不展示下方长串聊天记录
        if (realTimeOn && !selectedDateStr && !searchKeyword) {
            resultSlot.innerHTML = `<div class="ctd-empty-hint">点击带有圆点的日期可查看当日记录</div>`;
            return;
        }

        let filtered = msgs.slice();
        if (realTimeOn && selectedDateStr) {
            filtered = filtered.filter(m => getMsgDateStr(m) === selectedDateStr);
        }
        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            filtered = filtered.filter(m => formatMsgPreview(m).toLowerCase().includes(kw));
        }

        if (!filtered.length) {
            const emptyText = selectedDateStr ? '该日期暂无聊天记录' : '未找到相关聊天记录';
            resultSlot.innerHTML = `<div class="ctd-empty-hint">${emptyText}</div>`;
            return;
        }

        const thread = getThreadById(currentThreadId);
        const listHtml = filtered.slice().reverse().map(m => {
            let senderName = '我';
            if (m.sender !== 'me') {
                const c = m.charId ? getCharById(m.charId) : (thread && thread.charId ? getCharById(thread.charId) : null);
                senderName = (c && (c.name || c.nickname)) || (thread && thread.name) || '对方';
            }
            const timeLabel = formatMsgTimeLabel(m, realTimeOn);
            const bodyText = formatMsgPreview(m);
            return `
                <div class="ctd-msg-item">
                    <div class="ctd-msg-meta">
                        <span class="ctd-msg-sender">${escapeHtml(senderName)}</span>
                        <span class="ctd-msg-time">${escapeHtml(timeLabel)}</span>
                    </div>
                    <div class="ctd-msg-body">${escapeHtml(bodyText)}</div>
                </div>
            `;
        }).join('');

        resultSlot.innerHTML = `<div class="ctd-msg-list">${listHtml}</div>`;
        bindAllPressed(resultSlot);
    }

    /* ---------------- 线上预设单选页 ---------------- */
    function renderPresetView() {
        const scrollEl = document.getElementById('ctdPresetScroll');
        if (!scrollEl || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const presets = getAvailableOnlinePresets();
        const globalPreset = getGlobalActivePreset();
        const globalName = globalPreset ? (globalPreset.name || '未命名预设') : '未选择';
        const selectedId = settings.presetId || '';

        const followCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdPresetFollowGlobalRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">跟随全局预设</div>
                        <div class="ctd-row-sub">当前全局：${escapeHtml(globalName)}</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${!selectedId ? 'checked' : ''}">${!selectedId ? SVG_CHECK : ''}</div>
                    </div>
                </div>
            </div>
        `;

        let listHtml = '';
        if (!presets.length) {
            listHtml = `<div class="ctd-empty-hint">暂无可用预设，请先在「预设」中添加</div>`;
        } else {
            const rowsHtml = presets.map(p => {
                const isSelected = selectedId === p.id;
                const count = Array.isArray(p.prompts) ? p.prompts.length : (Array.isArray(p.items) ? p.items.length : 0);
                const sub = count ? `包含 ${count} 条提示词` : '线上预设';
                return `
                    <div class="ctd-row ctd-preset-item-row" data-preset-id="${escapeHtml(p.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(p.name || '未命名预设')}</div>
                            <div class="ctd-row-sub">${escapeHtml(sub)}</div>
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${isSelected ? 'checked' : ''}">${isSelected ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            listHtml = `
                <div class="ctd-section-label">指定线上预设（单选）</div>
                <div class="ctd-card">${rowsHtml}</div>
            `;
        }

        scrollEl.innerHTML = followCardHtml + listHtml;
        bindAllPressed(scrollEl);

        document.getElementById('ctdPresetFollowGlobalRow').addEventListener('click', () => {
            updateThreadSettings(currentThreadId, { presetId: '' });
            renderPresetView();
            showToast('已恢复跟随全局预设');
        });

        scrollEl.querySelectorAll('.ctd-preset-item-row').forEach(row => {
            row.addEventListener('click', () => {
                const pid = row.dataset.presetId;
                if (!pid) return;
                updateThreadSettings(currentThreadId, { presetId: pid });
                renderPresetView();
                showToast('已指定当前对话预设');
            });
        });
    }

    /* ---------------- 单独挂载世界书页 ---------------- */
    function renderLoreView() {
        const scrollEl = document.getElementById('ctdLoreScroll');
        if (!scrollEl || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const books = getAvailableLorebooks();
        const selectedSet = new Set(Array.isArray(settings.loreIds) ? settings.loreIds : []);

        const toggleCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">启用单独挂载</div>
                        <div class="ctd-row-sub">开启后将覆盖全局配置，仅生效已选世界书</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.loreOverride ? 'on' : ''}" id="ctdLoreOverrideSwitch" aria-label="启用单独挂载"></button>
                    </div>
                </div>
            </div>
        `;

        let booksHtml = '';
        if (!books.length) {
            booksHtml = `<div class="ctd-empty-hint">暂无可用世界书，请先在「世界书」中添加</div>`;
        } else {
            const rowsHtml = books.map(b => {
                const checked = selectedSet.has(b.id);
                const entryCount = Array.isArray(b.entries) ? b.entries.length : 0;
                const sub = entryCount ? `共 ${entryCount} 条词条` : '世界书';
                return `
                    <div class="ctd-row ctd-lore-book-row" data-book-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || b.title || '未命名世界书')}</div>
                            <div class="ctd-row-sub">${escapeHtml(sub)}</div>
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            booksHtml = `
                <div class="ctd-section-label">选择世界书（可多选）</div>
                <div class="ctd-card" style="${settings.loreOverride ? '' : 'opacity:0.55;'}">${rowsHtml}</div>
            `;
        }

        scrollEl.innerHTML = toggleCardHtml + booksHtml;
        bindAllPressed(scrollEl);

        document.getElementById('ctdLoreOverrideSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { loreOverride: !cur.loreOverride });
            renderLoreView();
            showToast(next.loreOverride ? '已开启单独挂载世界书' : '已切换为跟随全局世界书');
        });

        scrollEl.querySelectorAll('.ctd-lore-book-row').forEach(row => {
            row.addEventListener('click', () => {
                const bid = row.dataset.bookId;
                if (!bid) return;
                const cur = getThreadSettings(currentThreadId);
                const set = new Set(Array.isArray(cur.loreIds) ? cur.loreIds : []);
                if (set.has(bid)) {
                    set.delete(bid);
                } else {
                    set.add(bid);
                }
                updateThreadSettings(currentThreadId, {
                    loreOverride: true,
                    loreIds: Array.from(set)
                });
                renderLoreView();
            });
        });
    }

    /* ---------------- 事件拦截与全局观察器 ---------------- */
    function setupObserversAndHooks() {
        // 1. 捕获点击列表项或发起私聊以记录当前 threadId
        document.addEventListener('click', (e) => {
            const moreBtn = e.target.closest('#ctRoomMoreBtn');
            if (moreBtn) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openDetails(resolveActiveThreadId());
                return;
            }

            const row = e.target.closest('#app-chat .ct-flat-list > *');
            if (row) {
                const tid = row.dataset.threadId || row.dataset.id || '';
                if (tid) {
                    currentThreadId = tid;
                } else {
                    const nameEl = row.querySelector('.ct-chat-name, .ct-name, [class*="name"]');
                    const rowName = nameEl ? nameEl.textContent.trim() : '';
                    const found = getThreads().find(t => (t.name || '').trim() === rowName);
                    if (found) currentThreadId = found.id;
                }
                setTimeout(() => {
                    syncMuteBellUI();
                    syncRoomBackgroundUI();
                }, 40);
            }
        }, true);

        // 2. 监听聊天主页列表与房间标题变化，自动同步置顶/免打扰铃铛/背景
        const appChat = document.getElementById('app-chat');
        if (appChat) {
            let syncQueued = false;
            const observer = new MutationObserver(() => {
                if (syncQueued) return;
                syncQueued = true;
                requestAnimationFrame(() => {
                    syncQueued = false;
                    syncHomePinnedUI();
                    syncMuteBellUI();
                });
            });
            observer.observe(appChat, { childList: true, subtree: true });
        }

        const roomBackBtn = document.getElementById('ctRoomBackBtn');
        if (roomBackBtn) {
            roomBackBtn.addEventListener('click', () => {
                setTimeout(() => {
                    syncHomePinnedUI();
                }, 60);
            });
        }
    }

    /* ---------------- 对外暴露接口 ---------------- */
    window.PhoneChatDetails = {
        open: openDetails,
        close: closeDetails,
        getSettings: getThreadSettings,
        getEffectivePreset: function (threadId) {
            const s = getThreadSettings(threadId || resolveActiveThreadId());
            return getPresetDisplayInfo(s).preset;
        },
        getEffectiveLorebookIds: function (threadId) {
            const s = getThreadSettings(threadId || resolveActiveThreadId());
            if (!s.loreOverride) return null;
            return Array.isArray(s.loreIds) ? s.loreIds : [];
        },
        getRealContext: async function (threadId) {
            const s = getThreadSettings(threadId || resolveActiveThreadId());
            const cache = getRealContextCache();
            if ((s.realWeather || s.realLocation) && (!cache.updatedAt || Date.now() - cache.updatedAt > 600000)) {
                try {
                    const fresh = await refreshRealContext(s.realLocation, s.realWeather);
                    return {
                        realTime: Boolean(s.realTime),
                        timeText: s.realTime ? new Date().toLocaleString('zh-CN', { hour12: false }) : '',
                        weatherText: s.realWeather ? (fresh.weatherText || '') : '',
                        locationText: s.realLocation ? (fresh.locationText || '') : ''
                    };
                } catch (e) {}
            }
            return {
                realTime: Boolean(s.realTime),
                timeText: s.realTime ? new Date().toLocaleString('zh-CN', { hour12: false }) : '',
                weatherText: s.realWeather ? (cache.weatherText || '') : '',
                locationText: s.realLocation ? (cache.locationText || '') : ''
            };
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupObserversAndHooks();
            sortThreadsByPin();
            syncMuteBellUI();
        });
    } else {
        setupObserversAndHooks();
        sortThreadsByPin();
        syncMuteBellUI();
    }
})();
