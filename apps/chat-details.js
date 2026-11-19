/* =========================================================
   Chat 聊天详情页 (apps/chat-details.js)
   - 拦截 #ctRoomMoreBtn，不改动 apps/chat.js / apps/chat.css
   - 包含：资料设置（聊天独立备注/头像）、置顶/免打扰铃铛/聊天背景、
     查找聊天记录（无圆点黑色日期筛选）、天气/地点感知、独立API、
     专属思维链、专属预设、单独挂载世界书、语言与翻译、语音模型、
     聊天界面设定、记忆宫殿、拉黑（需确认）、导入导出、清空（含清空记忆勾选项）
   ========================================================= */

(function () {
    const SETTINGS_KEY = 'chat_thread_settings_v1';
    const REAL_CTX_CACHE_KEY = 'phone_real_context_cache_v1';
    const THREADS_KEY = 'chat_threads_v1';
    const MSGS_PREFIX = 'chat_msgs_v1_';
    const PRESETS_LIST_KEY = 'phone_presets_list_v1';
    const PRESETS_ONLINE_KEY = 'phone_presets_active_online_v1';
    const API_CONFIG_KEY = 'phone_api_config_v2';
    const API_BUNDLES_KEY = 'phone_api_bundle_presets';

    const LANG_OPTIONS = ['跟随预设', '中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语'];
    const SECOND_LANG_OPTIONS = ['无', '中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语'];
    const TRANS_LANG_OPTIONS = ['中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语'];

    let currentThreadId = null;
    let overlayEl = null;
    let rootPageEl = null;
    let subPages = {};
    let toastEl = null;
    let toastTimer = null;

    // 内存缓存聊天专属头像，避免频繁读取 IndexedDB 闪烁
    const customAvatarCache = new Map();

    // 查找聊天记录状态
    let searchKeyword = '';
    let selectedDateStr = '';
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();

    // SVG 图标
    const SVG_BACK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
    const SVG_CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
    const SVG_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`;
    const SVG_CLEAR = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    const SVG_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    const SVG_GROUP = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    // p2 样式免打扰小铃铛（100% 不透明实色，交叉无叠色暗点）
    const SVG_MUTE_BELL = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.4 5.2a1.6 1.6 0 0 1 3.2 0"/>
            <path d="M8.9 6.3A5.6 5.6 0 0 1 17.6 11v2.9c0 1.4.6 2.6 1.6 3.4H4.8c1-.8 1.6-2 1.6-3.4v-2.6"/>
            <path d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"/>
            <line x1="4.2" y1="4.2" x2="19.8" y2="19.8"/>
        </svg>`;

    /* ---------------- 基础工具 ---------------- */
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
        el.addEventListener('touchstart', () => el.classList.add('is-pressed'), { passive: true });
        el.addEventListener('touchmove', () => el.classList.remove('is-pressed'), { passive: true });
        el.addEventListener('touchend', () => el.classList.remove('is-pressed'), { passive: true });
        el.addEventListener('touchcancel', () => el.classList.remove('is-pressed'), { passive: true });
    }

    function bindAllPressed(root) {
        if (!root) return;
        root.querySelectorAll('.ctd-back-btn, .ctd-profile-card, .ctd-row:not(.ctd-row-static), .ctd-switch, .ctd-cal-nav-btn, .ctd-cal-day.has-msg, .ctd-date-pill-clear, .ctd-msg-item, .ctd-sheet-btn, .ctd-modal-btn, .ctd-primary-btn').forEach(bindPressed);
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
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
    }

    function getAllSettings() {
        return loadJSON(SETTINGS_KEY, {});
    }

    function getThreadSettings(threadId) {
        if (!threadId) return {};
        const all = getAllSettings();
        return Object.assign({
            remark: '',
            hasCustomAvatar: false,
            pinned: false,
            muted: false,
            realTime: false,
            realWeather: false,
            realLocation: false,
            apiBundleId: '',
            cotShow: false,
            cotCustom: '',
            presetId: '',
            loreOverride: false,
            loreIds: [],
            autoTranslate: false,
            charOutputLang: '跟随预设',
            charSecondLang: '无',
            translateLang: '中文',
            voiceEnabled: false,
            voiceAutoPlay: false,
            voiceEmotionTag: false,
            voiceVoiceId: '',
            voiceSpeed: '1.0',
            chatTheme: 'default',
            blocked: false,
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
        return getArchiveChars().find(c => c.id === charId) || null;
    }

    function getArchiveCharAvatar(charObj) {
        if (!charObj) return '';
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
                return window.PhoneArchive.getCharAvatar(charObj.id) || charObj.avatar || '';
            }
        } catch (e) {}
        return charObj.avatar || '';
    }

    async function loadCustomAvatar(threadId) {
        if (!threadId) return '';
        if (customAvatarCache.has(threadId)) return customAvatarCache.get(threadId);
        if (!window.PhoneDB || typeof window.PhoneDB.get !== 'function') return '';
        try {
            const val = await window.PhoneDB.get('chat_custom_avatar_' + threadId);
            customAvatarCache.set(threadId, val || '');
            return val || '';
        } catch (e) {
            return '';
        }
    }

    function getDisplayName(thread, settings) {
        if (settings && settings.remark) return settings.remark;
        if (thread && thread.name) return thread.name;
        const c = thread && thread.charId ? getCharById(thread.charId) : null;
        return (c && (c.name || c.nickname)) || '未命名';
    }

    function getThreadMessages(threadId) {
        const msgs = loadJSON(MSGS_PREFIX + threadId, []);
        return Array.isArray(msgs) ? msgs : [];
    }

    /* ---------------- 日期解析 ---------------- */
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
        if (msg && typeof msg.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(msg.date)) return msg.date;
        const ts = extractMsgTimestamp(msg);
        return ts ? toDateStr(new Date(ts)) : '';
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

    /* ---------------- API / 预设 / 世界书 / 记忆读取 ---------------- */
    function getAvailableApiBundles() {
        const bundles = loadJSON(API_BUNDLES_KEY, []);
        if (Array.isArray(bundles) && bundles.length) return bundles;
        const cfg = loadJSON(API_CONFIG_KEY, null);
        if (cfg && Array.isArray(cfg.bundles)) return cfg.bundles;
        if (cfg && Array.isArray(cfg.presets)) return cfg.presets;
        return [];
    }

    function getApiDisplayLabel(settings) {
        if (!settings || !settings.apiBundleId) return '跟随全局';
        const list = getAvailableApiBundles();
        const found = list.find(b => b.id === settings.apiBundleId);
        return found ? (found.name || '已指定配置') : '跟随全局';
    }

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
        return getAvailableOnlinePresets().find(p => p.id === activeId) || null;
    }

    function getPresetDisplayInfo(settings) {
        const list = getAvailableOnlinePresets();
        const globalPreset = getGlobalActivePreset();
        const globalName = globalPreset ? (globalPreset.name || '未命名预设') : '未选择';
        if (settings && settings.presetId) {
            const custom = list.find(p => p.id === settings.presetId);
            if (custom) {
                return { isCustom: true, preset: custom, label: custom.name || '未命名预设', globalName };
            }
        }
        return {
            isCustom: false,
            preset: globalPreset,
            label: globalPreset ? `跟随全局（${globalName}）` : '跟随全局',
            globalName
        };
    }

    function getAvailableLorebooks() {
        const candidates = [];
        try {
            if (window.PhoneLorebook) {
                if (typeof window.PhoneLorebook.getBooks === 'function') candidates.push(...(window.PhoneLorebook.getBooks() || []));
                else if (typeof window.PhoneLorebook.getAll === 'function') candidates.push(...(window.PhoneLorebook.getAll() || []));
                else if (typeof window.PhoneLorebook.getList === 'function') candidates.push(...(window.PhoneLorebook.getList() || []));
            }
        } catch (e) {}
        if (!candidates.length) {
            for (const k of ['phone_lorebooks_v1', 'phone_lorebook_books_v1', 'lorebooks_v1', 'phone_worldbooks_v1']) {
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
        return candidates.filter(b => b && b.id && !seen.has(b.id) && seen.add(b.id));
    }

    function getCharMemories(thread) {
        if (!thread) return [];
        const charId = thread.charId || '';
        const list = [];
        try {
            if (window.PhoneMemory && typeof window.PhoneMemory.getMemories === 'function') {
                const all = window.PhoneMemory.getMemories(charId) || [];
                if (Array.isArray(all)) list.push(...all);
            }
        } catch (e) {}
        if (!list.length) {
            const raw = loadJSON('phone_memories_v1', []);
            if (Array.isArray(raw)) {
                return raw.filter(m => !charId || m.charId === charId || m.targetId === charId);
            }
        }
        return list.filter(m => !charId || !m.charId || m.charId === charId);
    }

    function clearCharMemories(thread) {
        if (!thread) return;
        const charId = thread.charId || '';
        try {
            if (window.PhoneMemory && typeof window.PhoneMemory.clearMemories === 'function') {
                window.PhoneMemory.clearMemories(charId);
                return;
            }
        } catch (e) {}
        const raw = loadJSON('phone_memories_v1', null);
        if (Array.isArray(raw) && charId) {
            saveJSON('phone_memories_v1', raw.filter(m => m.charId !== charId && m.targetId !== charId));
        }
    }

    /* ---------------- 真实天气与地点感知 ---------------- */
    function weatherCodeToText(code) {
        const map = {
            0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴', 45: '雾', 48: '冻雾',
            51: '小毛毛雨', 53: '毛毛雨', 55: '浓毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
            71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '强阵雨', 82: '暴雨',
            95: '雷阵雨', 96: '雷阵雨伴冰雹'
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
                        enableHighAccuracy: false, timeout: 5500, maximumAge: 300000
                    });
                });
                return { lat: pos.coords.latitude, lon: pos.coords.longitude };
            } catch (e) {}
        }
        const resp = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!resp.ok) throw new Error('ip_geo_failed');
        const data = await resp.json();
        return {
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            city: data.city || '',
            region: data.region || ''
        };
    }

    async function refreshRealContext(needLocation, needWeather) {
        const cache = getRealContextCache();
        const coords = await fetchCoords();
        let locationText = cache.locationText || '';

        if (needLocation || !locationText) {
            try {
                const gRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=zh`);
                if (gRes.ok) {
                    const gData = await gRes.json();
                    const parts = [gData.principalSubdivision, gData.city, gData.locality].filter(Boolean);
                    locationText = [...new Set(parts)].join(' · ') || gData.countryName || '';
                }
            } catch (e) {}
            if (!locationText && (coords.city || coords.region)) {
                locationText = [coords.region, coords.city].filter(Boolean).join(' · ');
            }
        }

        let weatherText = cache.weatherText || '';
        if (needWeather) {
            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`);
            if (wRes.ok) {
                const wData = await wRes.json();
                if (wData && wData.current) {
                    weatherText = `${weatherCodeToText(wData.current.weather_code)} ${Math.round(wData.current.temperature_2m)}°C（湿度 ${wData.current.relative_humidity_2m}%）`;
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

    /* ---------------- 聊天界面同步（置顶 / 免打扰 / 备注 / 头像 / 背景） ---------------- */
    function sortThreadsByPin() {
        const allSettings = getAllSettings();
        const threads = loadJSON(THREADS_KEY, []);
        if (!Array.isArray(threads) || !threads.length) return;
        const pinned = [];
        const normal = [];
        threads.forEach(t => (allSettings[t.id] && allSettings[t.id].pinned) ? pinned.push(t) : normal.push(t));
        const sorted = pinned.concat(normal);
        if (sorted.some((t, i) => threads[i] && threads[i].id !== t.id)) {
            saveJSON(THREADS_KEY, sorted);
        }
        syncHomeListUI(sorted, allSettings);
    }

    async function syncHomeListUI(sortedThreads, allSettings) {
        const listEl = document.querySelector('#app-chat .ct-flat-list');
        if (!listEl) return;
        const settings = allSettings || getAllSettings();
        const threads = sortedThreads || getThreads();
        const rows = Array.from(listEl.children);
        if (!rows.length) return;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const tid = row.dataset.threadId || row.dataset.id || (threads[i] && threads[i].id) || '';
            const t = threads.find(item => item.id === tid) || threads[i];
            const st = t ? (settings[t.id] || {}) : {};

            row.classList.toggle('ctd-pinned-row', Boolean(st.pinned));

            if (t && st.remark) {
                const nameEl = row.querySelector('.ct-chat-name, .ct-name');
                if (nameEl && nameEl.textContent.trim() !== st.remark) {
                    nameEl.textContent = st.remark;
                }
            }

            if (t && st.hasCustomAvatar) {
                const avData = await loadCustomAvatar(t.id);
                const avBox = row.querySelector('.ct-avatar');
                if (avData && avBox) {
                    let img = avBox.querySelector('img');
                    if (!img) {
                        avBox.innerHTML = `<img src="${escapeHtml(avData)}" alt="">`;
                    } else if (img.src !== avData) {
                        img.src = avData;
                    }
                }
            }
        }

        const pinnedRows = rows.filter(r => r.classList.contains('ctd-pinned-row'));
        const normalRows = rows.filter(r => !r.classList.contains('ctd-pinned-row'));
        const reordered = pinnedRows.concat(normalRows);
        if (reordered.some((el, idx) => rows[idx] !== el)) {
            reordered.forEach(el => listEl.appendChild(el));
        }
    }

    function syncRoomTitleAndBellUI() {
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return;
        const tid = resolveActiveThreadId();
        if (!tid) return;
        const thread = getThreadById(tid);
        const settings = getThreadSettings(tid);

        const targetName = getDisplayName(thread, settings);
        let bell = titleEl.querySelector('#ctRoomMuteBell');
        const currentText = Array.from(titleEl.childNodes)
            .filter(n => n.nodeType === 3)
            .map(n => n.textContent)
            .join('')
            .trim();

        if (targetName && currentText !== targetName) {
            if (bell) bell.remove();
            titleEl.textContent = targetName;
            bell = null;
        }

        if (settings.muted) {
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

    async function syncRoomCustomAvatarsUI() {
        const msgBox = document.getElementById('ctRoomMessages');
        if (!msgBox) return;
        const tid = resolveActiveThreadId();
        if (!tid) return;
        const settings = getThreadSettings(tid);
        if (!settings.hasCustomAvatar) return;
        const avData = await loadCustomAvatar(tid);
        if (!avData) return;

        msgBox.querySelectorAll('.ct-msg-row:not(.me) .ct-msg-avatar').forEach(avBox => {
            let img = avBox.querySelector('img');
            if (!img) {
                avBox.innerHTML = `<img src="${escapeHtml(avData)}" alt="">`;
            } else if (img.src !== avData) {
                img.src = avData;
            }
        });
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

        const allSettings = getAllSettings();
        const threads = getThreads();
        const matched = threads.find(t => {
            const st = allSettings[t.id] || {};
            return (t.name || '').trim() === titleText || (st.remark || '').trim() === titleText;
        });
        if (matched) {
            currentThreadId = matched.id;
            return matched.id;
        }
        return null;
    }

    /* ---------------- 弹窗与动作菜单 ---------------- */
    function openActionSheet({ title, desc, checkboxLabel, actions }) {
        const backdrop = document.createElement('div');
        backdrop.className = 'ctd-sheet-backdrop';
        let isChecked = false;

        const actionsHtml = actions.map((a, idx) => `
            <button type="button" class="ctd-sheet-btn ${a.danger ? 'danger' : ''} ${a.selected ? 'selected' : ''}" data-idx="${idx}">${escapeHtml(a.label)}</button>
        `).join('');

        const checkHtml = checkboxLabel ? `
            <div class="ctd-sheet-check-row" id="ctdSheetCheckRow">
                <div class="ctd-sheet-check-box">${SVG_CHECK}</div>
                <span class="ctd-sheet-check-text">${escapeHtml(checkboxLabel)}</span>
            </div>
        ` : '';

        backdrop.innerHTML = `
            <div class="ctd-sheet-box">
                <div class="ctd-sheet-group">
                    ${title ? `
                        <div class="ctd-sheet-header">
                            <div class="ctd-sheet-title">${escapeHtml(title)}</div>
                            ${desc ? `<div class="ctd-sheet-desc">${escapeHtml(desc)}</div>` : ''}
                            ${checkHtml}
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

        const checkRow = backdrop.querySelector('#ctdSheetCheckRow');
        if (checkRow) {
            checkRow.addEventListener('click', (e) => {
                e.stopPropagation();
                isChecked = !isChecked;
                checkRow.classList.toggle('checked', isChecked);
            });
        }

        function close() {
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 260);
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.closest('[data-cancel="1"]')) {
                close();
                return;
            }
            const actBtn = e.target.closest('[data-idx]');
            if (actBtn) {
                const idx = Number(actBtn.dataset.idx);
                close();
                if (actions[idx] && typeof actions[idx].onClick === 'function') {
                    actions[idx].onClick(isChecked);
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
            if (btn.dataset.act === 'cancel') close();
            else {
                const val = input ? input.value.trim() : '';
                close();
                if (typeof onConfirm === 'function') onConfirm(val);
            }
        });
    }

    /* ---------------- DOM 构建与页面切换 ---------------- */
    function buildSubPage(id, title, scrollId) {
        return `
            <div class="ctd-page" id="${id}">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" data-sub-back="${id}">${SVG_BACK}</button>
                    <div class="ctd-title">${title}</div>
                </div>
                <div class="ctd-scroll" id="${scrollId}"></div>
            </div>
        `;
    }

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
            ${buildSubPage('ctDetailsProfileView', '资料设置', 'ctdProfileScroll')}
            ${buildSubPage('ctDetailsSearchView', '查找聊天记录', 'ctdSearchScroll')}
            ${buildSubPage('ctDetailsApiView', '独立 API', 'ctdApiScroll')}
            ${buildSubPage('ctDetailsCotView', '专属思维链', 'ctdCotScroll')}
            ${buildSubPage('ctDetailsPresetView', '专属预设', 'ctdPresetScroll')}
            ${buildSubPage('ctDetailsLoreView', '单独挂载世界书', 'ctdLoreScroll')}
            ${buildSubPage('ctDetailsVoiceView', '启用语音模型', 'ctdVoiceScroll')}
            ${buildSubPage('ctDetailsThemeView', '聊天界面设定', 'ctdThemeScroll')}
            ${buildSubPage('ctDetailsMemoryView', '记忆宫殿', 'ctdMemoryScroll')}
        `;
        mountParent.appendChild(overlayEl);

        rootPageEl = document.getElementById('ctDetailsMainView');
        [
            'ctDetailsProfileView', 'ctDetailsSearchView', 'ctDetailsApiView',
            'ctDetailsCotView', 'ctDetailsPresetView', 'ctDetailsLoreView',
            'ctDetailsVoiceView', 'ctDetailsThemeView', 'ctDetailsMemoryView'
        ].forEach(id => {
            subPages[id] = document.getElementById(id);
        });

        document.getElementById('ctdBackBtn').addEventListener('click', closeDetails);
        overlayEl.querySelectorAll('[data-sub-back]').forEach(btn => {
            btn.addEventListener('click', () => closeSubPage(subPages[btn.dataset.subBack]));
        });
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

    async function openDetails(threadId) {
        currentThreadId = threadId || resolveActiveThreadId();
        if (!currentThreadId) return;
        ensureOverlayDOM();
        Object.values(subPages).forEach(p => p.classList.remove('open'));
        rootPageEl.classList.remove('is-behind');
        await renderMainView();
        requestAnimationFrame(() => overlayEl.classList.add('open'));
    }

    function closeDetails() {
        if (!overlayEl) return;
        overlayEl.classList.remove('open');
        Object.values(subPages).forEach(p => p.classList.remove('open'));
        rootPageEl.classList.remove('is-behind');
    }

    /* ---------------- 主详情页渲染 ---------------- */
    async function renderMainView() {
        const scrollEl = document.getElementById('ctdMainScroll');
        if (!scrollEl || !currentThreadId) return;

        const thread = getThreadById(currentThreadId);
        const settings = getThreadSettings(currentThreadId);
        const cache = getRealContextCache();
        const isGroup = thread && thread.type === 'group';
        const displayName = getDisplayName(thread, settings);
        const customAv = settings.hasCustomAvatar ? await loadCustomAvatar(currentThreadId) : '';

        // 1. 资料卡（带 > 进二级页改备注、改头像）
        let profileHtml = '';
        if (isGroup) {
            const memberIds = Array.isArray(thread.memberIds) ? thread.memberIds : [];
            const membersHtml = memberIds.map(id => {
                const c = getCharById(id);
                const name = c ? (c.name || c.nickname || '未命名') : '成员';
                const av = getArchiveCharAvatar(c);
                return `
                    <div class="ctd-member-item">
                        <div class="ctd-member-av">${av ? `<img src="${escapeHtml(av)}" alt="">` : escapeHtml(name.slice(0, 1))}</div>
                        <div class="ctd-member-name">${escapeHtml(name)}</div>
                    </div>
                `;
            }).join('');

            profileHtml = `
                <div class="ctd-card ctd-profile-card" id="ctdProfileCardEntry">
                    <div class="ctd-profile-head">
                        <div class="ctd-avatar-lg">${customAv ? `<img src="${escapeHtml(customAv)}" alt="">` : SVG_GROUP}</div>
                        <div class="ctd-profile-info">
                            <div class="ctd-profile-name">${escapeHtml(displayName)}</div>
                            <div class="ctd-profile-sub">共 ${memberIds.length} 位成员 · 修改备注与头像</div>
                        </div>
                        <div class="ctd-chevron">${SVG_CHEVRON}</div>
                    </div>
                    ${membersHtml ? `<div class="ctd-group-members">${membersHtml}</div>` : ''}
                </div>
            `;
        } else {
            const c = thread ? getCharById(thread.charId) : null;
            const av = customAv || getArchiveCharAvatar(c);
            const fallbackChar = (c && c.id === 'assistant-shuixiaojiu') ? '九' : displayName.slice(0, 1);
            profileHtml = `
                <div class="ctd-card ctd-profile-card" id="ctdProfileCardEntry">
                    <div class="ctd-profile-head">
                        <div class="ctd-avatar-lg">${av ? `<img src="${escapeHtml(av)}" alt="">` : escapeHtml(fallbackChar)}</div>
                        <div class="ctd-profile-info">
                            <div class="ctd-profile-name">${escapeHtml(displayName)}</div>
                            <div class="ctd-profile-sub">${settings.remark ? '已设置聊天备注 · 点击编辑' : '点击修改聊天备注与头像'}</div>
                        </div>
                        <div class="ctd-chevron">${SVG_CHEVRON}</div>
                    </div>
                </div>
            `;
        }

        // 2. 基础设置卡
        const basicCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">置顶聊天</div></div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.pinned ? 'on' : ''}" id="ctdPinSwitch" aria-label="置顶聊天"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">消息免打扰</div></div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.muted ? 'on' : ''}" id="ctdMuteSwitch" aria-label="消息免打扰"></button>
                    </div>
                </div>
                <div class="ctd-row" id="ctdBgRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">聊天背景</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${settings.hasBg ? '已设置' : '默认'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 3. 查找聊天记录（位于感知真实天气上方）
        const searchCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSearchEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">查找聊天记录</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
        `;

        // 4. 感知真实天气 & 地点
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

        // 5. 独立 API（在真实天气下面）
        const apiCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdApiEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">独立 API</div>
                        <div class="ctd-row-sub">为当前对话单独指定模型接口方案</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(getApiDisplayLabel(settings))}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 6. 专属思维链 / 专属预设 / 单独挂载世界书
        const cotLabel = settings.cotShow ? '已开启显示' : (settings.cotCustom ? '已自定义' : '默认');
        const presetInfo = getPresetDisplayInfo(settings);
        const loreCount = Array.isArray(settings.loreIds) ? settings.loreIds.length : 0;
        const loreStatusText = settings.loreOverride ? `已选 ${loreCount} 本` : '跟随全局';

        const coreCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdCotEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">专属思维链</div>
                        <div class="ctd-row-sub">控制思维链展示与自定义思考引导</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(cotLabel)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdPresetEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">专属预设</div>
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

        // 7. 语言与翻译
        const langCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">自动展开翻译</div>
                        <div class="ctd-row-sub">收到外语消息时自动附带译文展示</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.autoTranslate ? 'on' : ''}" id="ctdAutoTransSwitch" aria-label="自动展开翻译"></button>
                    </div>
                </div>
                <div class="ctd-row" id="ctdOutLangRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">角色输出语言</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.charOutputLang || '跟随预设')}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdSecondLangRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">角色第二语言</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.charSecondLang || '无')}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdTransLangRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">翻译语言</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.translateLang || '中文')}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 8. 语音模型 & 聊天界面设定
        const voiceStatus = settings.voiceEnabled ? (settings.voiceAutoPlay ? '自动播放' : '已开启') : '未开启';
        const voiceUiCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdVoiceEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">启用语音模型</div>
                        <div class="ctd-row-sub">配置语音合成、自动播放与情绪标注</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(voiceStatus)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdThemeEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">聊天界面设定</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">默认</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 9. 记忆宫殿
        const memCount = getCharMemories(thread).length;
        const memoryCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdMemoryEntryRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">记忆宫殿</div>
                        <div class="ctd-row-sub">查看并管理该角色的长期记忆档案</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${memCount ? `${memCount} 条` : '暂无'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 10. 拉黑（位于导出入与清空之前）
        const blockCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ${settings.blocked ? 'ctd-row-center' : 'ctd-row-danger'}" id="ctdBlockRow">
                    <div class="ctd-row-title">${settings.blocked ? '已拉黑（点击解除）' : '拉黑'}</div>
                </div>
            </div>
        `;

        // 11. 导出 / 导入聊天记录
        const ioCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdExportRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">导出聊天记录</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
                <div class="ctd-row" id="ctdImportRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">导入聊天记录</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
        `;

        // 12. 清空聊天记录（最底下，弹窗附带清空记忆勾选项）
        const clearCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdClearChatRow">
                    <div class="ctd-row-title">清空聊天记录</div>
                </div>
            </div>
        `;

        scrollEl.innerHTML =
            profileHtml + basicCardHtml + searchCardHtml + realEnvCardHtml +
            apiCardHtml + coreCardHtml + langCardHtml + voiceUiCardHtml +
            memoryCardHtml + blockCardHtml + ioCardHtml + clearCardHtml;

        bindAllPressed(scrollEl);
        bindMainViewEvents(thread);
    }

    function bindMainViewEvents(thread) {
        document.getElementById('ctdProfileCardEntry').addEventListener('click', () => {
            renderProfileSubView();
            openSubPage(subPages.ctDetailsProfileView);
        });

        const pinSwitch = document.getElementById('ctdPinSwitch');
        pinSwitch.addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { pinned: !cur.pinned });
            pinSwitch.classList.toggle('on', next.pinned);
            sortThreadsByPin();
            showToast(next.pinned ? '已置顶该聊天' : '已取消置顶');
        });

        const muteSwitch = document.getElementById('ctdMuteSwitch');
        muteSwitch.addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { muted: !cur.muted });
            muteSwitch.classList.toggle('on', next.muted);
            syncRoomTitleAndBellUI();
            showToast(next.muted ? '已开启消息免打扰' : '已关闭消息免打扰');
        });

        document.getElementById('ctdBgRow').addEventListener('click', () => {
            openActionSheet({
                title: '设置聊天背景',
                actions: [
                    { label: '从相册选择背景图', onClick: () => pickChatBackground() },
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

        document.getElementById('ctdSearchEntryRow').addEventListener('click', () => {
            searchKeyword = '';
            selectedDateStr = '';
            const now = new Date();
            calYear = now.getFullYear();
            calMonth = now.getMonth();
            renderSearchView();
            openSubPage(subPages.ctDetailsSearchView);
        });

        const weatherSwitch = document.getElementById('ctdWeatherSwitch');
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

        const locationSwitch = document.getElementById('ctdLocationSwitch');
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

        document.getElementById('ctdApiEntryRow').addEventListener('click', () => {
            renderApiSubView();
            openSubPage(subPages.ctDetailsApiView);
        });

        document.getElementById('ctdCotEntryRow').addEventListener('click', () => {
            renderCotSubView();
            openSubPage(subPages.ctDetailsCotView);
        });

        document.getElementById('ctdPresetEntryRow').addEventListener('click', () => {
            renderPresetView();
            openSubPage(subPages.ctDetailsPresetView);
        });

        document.getElementById('ctdLoreEntryRow').addEventListener('click', () => {
            renderLoreView();
            openSubPage(subPages.ctDetailsLoreView);
        });

        const autoTransSwitch = document.getElementById('ctdAutoTransSwitch');
        autoTransSwitch.addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { autoTranslate: !cur.autoTranslate });
            autoTransSwitch.classList.toggle('on', next.autoTranslate);
            showToast(next.autoTranslate ? '已开启自动展开翻译' : '已关闭自动展开翻译');
        });

        document.getElementById('ctdOutLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openActionSheet({
                title: '选择角色输出语言',
                actions: LANG_OPTIONS.map(lang => ({
                    label: lang + (cur.charOutputLang === lang ? ' ✓' : ''),
                    selected: cur.charOutputLang === lang,
                    onClick: () => {
                        updateThreadSettings(currentThreadId, { charOutputLang: lang });
                        renderMainView();
                    }
                }))
            });
        });

        document.getElementById('ctdSecondLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openActionSheet({
                title: '选择角色第二语言',
                actions: SECOND_LANG_OPTIONS.map(lang => ({
                    label: lang + (cur.charSecondLang === lang ? ' ✓' : ''),
                    selected: cur.charSecondLang === lang,
                    onClick: () => {
                        updateThreadSettings(currentThreadId, { charSecondLang: lang });
                        renderMainView();
                    }
                }))
            });
        });

        document.getElementById('ctdTransLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openActionSheet({
                title: '选择翻译目标语言',
                actions: TRANS_LANG_OPTIONS.map(lang => ({
                    label: lang + (cur.translateLang === lang ? ' ✓' : ''),
                    selected: cur.translateLang === lang,
                    onClick: () => {
                        updateThreadSettings(currentThreadId, { translateLang: lang });
                        renderMainView();
                    }
                }))
            });
        });

        document.getElementById('ctdVoiceEntryRow').addEventListener('click', () => {
            renderVoiceSubView();
            openSubPage(subPages.ctDetailsVoiceView);
        });

        document.getElementById('ctdThemeEntryRow').addEventListener('click', () => {
            renderThemeSubView();
            openSubPage(subPages.ctDetailsThemeView);
        });

        document.getElementById('ctdMemoryEntryRow').addEventListener('click', () => {
            renderMemorySubView();
            openSubPage(subPages.ctDetailsMemoryView);
        });

        document.getElementById('ctdBlockRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            const name = getDisplayName(thread, cur);
            if (cur.blocked) {
                openActionSheet({
                    title: '解除拉黑',
                    desc: `确定将「${name}」移出黑名单吗？`,
                    actions: [{
                        label: '解除拉黑',
                        onClick: () => {
                            updateThreadSettings(currentThreadId, { blocked: false });
                            renderMainView();
                            showToast('已解除拉黑');
                        }
                    }]
                });
            } else {
                openActionSheet({
                    title: '拉黑联系人',
                    desc: `确定拉黑「${name}」吗？拉黑后将不再向其发送或接收消息。`,
                    actions: [{
                        label: '确认拉黑',
                        danger: true,
                        onClick: () => {
                            updateThreadSettings(currentThreadId, { blocked: true });
                            renderMainView();
                            showToast('已拉黑该联系人');
                        }
                    }]
                });
            }
        });

        document.getElementById('ctdExportRow').addEventListener('click', () => exportThreadMessages(thread));
        document.getElementById('ctdImportRow').addEventListener('click', () => importThreadMessages());

        document.getElementById('ctdClearChatRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            const name = getDisplayName(thread, cur);
            openActionSheet({
                title: '清空聊天记录',
                desc: `确定清空与「${name}」的全部聊天记录吗？此操作无法撤销。`,
                checkboxLabel: '同时清空该角色记忆',
                actions: [{
                    label: '清空聊天记录',
                    danger: true,
                    onClick: (alsoClearMemory) => {
                        clearThreadMessages();
                        if (alsoClearMemory) {
                            clearCharMemories(thread);
                            showToast('已清空聊天记录与角色记忆');
                        } else {
                            showToast('已清空聊天记录');
                        }
                        renderMainView();
                    }
                }]
            });
        });
    }

    /* ---------------- 二级页：资料设置（改备注 / 改头像） ---------------- */
    async function renderProfileSubView() {
        const scrollEl = document.getElementById('ctdProfileScroll');
        if (!scrollEl || !currentThreadId) return;
        const thread = getThreadById(currentThreadId);
        const settings = getThreadSettings(currentThreadId);
        const isGroup = thread && thread.type === 'group';
        const c = thread ? getCharById(thread.charId) : null;
        const customAv = settings.hasCustomAvatar ? await loadCustomAvatar(currentThreadId) : '';
        const av = customAv || getArchiveCharAvatar(c);
        const displayName = getDisplayName(thread, settings);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSubRemarkRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">${isGroup ? '群聊名称 / 备注' : '修改备注'}</div>
                        <div class="ctd-row-sub">仅在当前聊天界面生效，不影响档案原资料</div>
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.remark || displayName)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdSubAvatarRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">修改头像</div>
                        <div class="ctd-row-sub">仅在当前聊天界面生效</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-member-av" style="width:34px;height:34px;border-radius:9px;">
                            ${av ? `<img src="${escapeHtml(av)}" alt="">` : escapeHtml(displayName.slice(0, 1))}
                        </div>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;
        bindAllPressed(scrollEl);

        document.getElementById('ctdSubRemarkRow').addEventListener('click', () => {
            openInputModal({
                title: '修改聊天备注',
                value: settings.remark || '',
                placeholder: '留空则恢复默认名称',
                onConfirm: (val) => {
                    updateThreadSettings(currentThreadId, { remark: val });
                    syncRoomTitleAndBellUI();
                    syncHomeListUI();
                    renderProfileSubView();
                    showToast(val ? '聊天备注已更新' : '已恢复默认名称');
                }
            });
        });

        document.getElementById('ctdSubAvatarRow').addEventListener('click', () => {
            openActionSheet({
                title: '修改聊天头像',
                actions: [
                    {
                        label: '从相册选择头像',
                        onClick: () => pickCustomAvatar()
                    },
                    {
                        label: '恢复默认头像',
                        onClick: async () => {
                            if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
                                await window.PhoneDB.del('chat_custom_avatar_' + currentThreadId);
                            }
                            customAvatarCache.delete(currentThreadId);
                            updateThreadSettings(currentThreadId, { hasCustomAvatar: false });
                            syncHomeListUI();
                            renderProfileSubView();
                            showToast('已恢复默认头像');
                        }
                    }
                ]
            });
        });
    }

    function pickCustomAvatar() {
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
                if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
                    await window.PhoneDB.set('chat_custom_avatar_' + currentThreadId, dataUrl);
                }
                customAvatarCache.set(currentThreadId, dataUrl);
                updateThreadSettings(currentThreadId, { hasCustomAvatar: true });
                syncHomeListUI();
                syncRoomCustomAvatarsUI();
                renderProfileSubView();
                showToast('聊天头像已更新');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    /* ---------------- 二级页：独立 API ---------------- */
    function renderApiSubView() {
        const scrollEl = document.getElementById('ctdApiScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const bundles = getAvailableApiBundles();
        const selectedId = settings.apiBundleId || '';

        const followHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdApiFollowGlobalRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">跟随全局 API</div>
                        <div class="ctd-row-sub">默认使用「API」App 中的当前主力配置</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${!selectedId ? 'checked' : ''}">${!selectedId ? SVG_CHECK : ''}</div>
                    </div>
                </div>
            </div>
        `;

        let listHtml = '';
        if (!bundles.length) {
            listHtml = `<div class="ctd-empty-hint">暂无已保存的配置组，可在「API」App 中保存配置组后在此选择</div>`;
        } else {
            const rowsHtml = bundles.map(b => {
                const isSel = selectedId === b.id;
                return `
                    <div class="ctd-row ctd-api-bundle-row" data-bundle-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || '未命名配置')}</div>
                            <div class="ctd-row-sub">${escapeHtml(b.model || b.endpoint || '自定义接口方案')}</div>
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${isSel ? 'checked' : ''}">${isSel ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            listHtml = `
                <div class="ctd-section-label">指定独立配置（单选）</div>
                <div class="ctd-card">${rowsHtml}</div>
            `;
        }

        scrollEl.innerHTML = followHtml + listHtml;
        bindAllPressed(scrollEl);

        document.getElementById('ctdApiFollowGlobalRow').addEventListener('click', () => {
            updateThreadSettings(currentThreadId, { apiBundleId: '' });
            renderApiSubView();
            showToast('已恢复跟随全局 API');
        });

        scrollEl.querySelectorAll('.ctd-api-bundle-row').forEach(row => {
            row.addEventListener('click', () => {
                updateThreadSettings(currentThreadId, { apiBundleId: row.dataset.bundleId || '' });
                renderApiSubView();
                showToast('已指定当前对话 API');
            });
        });
    }

    /* ---------------- 二级页：专属思维链 ---------------- */
    function renderCotSubView() {
        const scrollEl = document.getElementById('ctdCotScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">显示思维链</div>
                        <div class="ctd-row-sub">开启后将在对话中展示模型的思考过程</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.cotShow ? 'on' : ''}" id="ctdCotShowSwitch" aria-label="显示思维链"></button>
                    </div>
                </div>
            </div>
            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">自定义思维链引导词</div>
                <div class="ctd-field-desc">为当前对话补充专属思考步骤要求，留空则跟随预设默认设置</div>
                <textarea class="ctd-textarea" id="ctdCotTextarea" placeholder="输入自定义思维链内容...">${escapeHtml(settings.cotCustom || '')}</textarea>
            </div>
            <button type="button" class="ctd-primary-btn" id="ctdCotSaveBtn">保存思维链设置</button>
        `;
        bindAllPressed(scrollEl);

        const sw = document.getElementById('ctdCotShowSwitch');
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { cotShow: !cur.cotShow });
            sw.classList.toggle('on', next.cotShow);
            showToast(next.cotShow ? '已开启显示思维链' : '已关闭显示思维链');
        });

        document.getElementById('ctdCotSaveBtn').addEventListener('click', () => {
            const val = document.getElementById('ctdCotTextarea').value.trim();
            updateThreadSettings(currentThreadId, { cotCustom: val });
            showToast('专属思维链已保存');
        });
    }

    /* ---------------- 二级页：启用语音模型 ---------------- */
    function renderVoiceSubView() {
        const scrollEl = document.getElementById('ctdVoiceScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">打开语音模型</div>
                        <div class="ctd-row-sub">开启后支持将角色回复合成为语音消息</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceEnabled ? 'on' : ''}" id="ctdVoiceEnableSw" aria-label="打开语音模型"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">自动播放</div>
                        <div class="ctd-row-sub">收到新语音时自动播放音频</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceAutoPlay ? 'on' : ''}" id="ctdVoiceAutoSw" aria-label="自动播放"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">自动标注情绪</div>
                        <div class="ctd-row-sub">合成前自动匹配语气与情绪标签</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceEmotionTag ? 'on' : ''}" id="ctdVoiceEmotionSw" aria-label="自动标注情绪"></button>
                    </div>
                </div>
            </div>
            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">语音模型配置</div>
                <div class="ctd-field-desc">填写当前角色专属音色 ID（Voice ID）与语速，接口密钥统一读取「API」App 中的 TTS 配置</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceIdInput" placeholder="音色 ID（留空使用全局默认）" value="${escapeHtml(settings.voiceVoiceId || '')}">
                <input type="text" class="ctd-input-clean" id="ctdVoiceSpeedInput" placeholder="语速（默认 1.0）" value="${escapeHtml(settings.voiceSpeed || '1.0')}">
            </div>
            <button type="button" class="ctd-primary-btn" id="ctdVoiceSaveBtn">保存语音配置</button>
        `;
        bindAllPressed(scrollEl);

        document.getElementById('ctdVoiceEnableSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { voiceEnabled: !cur.voiceEnabled });
            e.currentTarget.classList.toggle('on', next.voiceEnabled);
        });
        document.getElementById('ctdVoiceAutoSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { voiceAutoPlay: !cur.voiceAutoPlay });
            e.currentTarget.classList.toggle('on', next.voiceAutoPlay);
        });
        document.getElementById('ctdVoiceEmotionSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { voiceEmotionTag: !cur.voiceEmotionTag });
            e.currentTarget.classList.toggle('on', next.voiceEmotionTag);
        });
        document.getElementById('ctdVoiceSaveBtn').addEventListener('click', () => {
            const voiceVoiceId = document.getElementById('ctdVoiceIdInput').value.trim();
            const voiceSpeed = document.getElementById('ctdVoiceSpeedInput').value.trim() || '1.0';
            updateThreadSettings(currentThreadId, { voiceVoiceId, voiceSpeed });
            showToast('语音模型配置已保存');
        });
    }

    /* ---------------- 二级页：聊天界面设定 ---------------- */
    function renderThemeSubView() {
        const scrollEl = document.getElementById('ctdThemeScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdThemeDefaultRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">默认</div>
                        <div class="ctd-row-sub">采用系统标准聊天界面样式</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${(!settings.chatTheme || settings.chatTheme === 'default') ? 'checked' : ''}">${SVG_CHECK}</div>
                    </div>
                </div>
            </div>
        `;
        bindAllPressed(scrollEl);
        document.getElementById('ctdThemeDefaultRow').addEventListener('click', () => {
            updateThreadSettings(currentThreadId, { chatTheme: 'default' });
            showToast('当前已使用默认聊天界面');
        });
    }

    /* ---------------- 二级页：记忆宫殿 ---------------- */
    function renderMemorySubView() {
        const scrollEl = document.getElementById('ctdMemoryScroll');
        if (!scrollEl || !currentThreadId) return;
        const thread = getThreadById(currentThreadId);
        const memories = getCharMemories(thread);

        let listHtml = '';
        if (!memories.length) {
            listHtml = `<div class="ctd-empty-hint">当前角色暂无已记录的长期记忆</div>`;
        } else {
            listHtml = `<div class="ctd-msg-list">` + memories.map(m => `
                <div class="ctd-msg-item">
                    <div class="ctd-msg-meta">
                        <span class="ctd-msg-sender">${escapeHtml(m.category || '记忆片段')}</span>
                        <span class="ctd-msg-time">${escapeHtml(m.date || '')}</span>
                    </div>
                    <div class="ctd-msg-body">${escapeHtml(m.content || m.text || m.summary || '')}</div>
                </div>
            `).join('') + `</div>`;
        }

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdOpenMemoryAppRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">前往「记忆」App 管理</div>
                        <div class="ctd-row-sub">可在记忆中心进行新增、编辑与整理</div>
                    </div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
            ${listHtml}
        `;
        bindAllPressed(scrollEl);

        document.getElementById('ctdOpenMemoryAppRow').addEventListener('click', () => {
            closeDetails();
            if (typeof window.openApp === 'function') {
                window.openApp('memory');
            } else {
                const icon = document.querySelector('[data-app="memory"]');
                if (icon) icon.click();
            }
        });
    }

    /* ---------------- 二级页：查找聊天记录（无圆点黑色日期） ---------------- */
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
            for (let i = 0; i < firstDay; i++) daysHtml += `<div class="ctd-cal-day"></div>`;
            for (let day = 1; day <= daysInMonth; day++) {
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasMsg = msgDates.has(ds);
                daysHtml += `<div class="ctd-cal-day ${hasMsg ? 'has-msg' : ''}" ${hasMsg ? `data-date="${ds}"` : ''}>${day}</div>`;
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
                if (calMonth < 0) { calMonth = 11; calYear--; }
                renderSearchBody();
            });
            document.getElementById('ctdCalNext').addEventListener('click', () => {
                calMonth++;
                if (calMonth > 11) { calMonth = 0; calYear++; }
                renderSearchBody();
            });
            calSlot.querySelectorAll('.ctd-cal-day.has-msg').forEach(el => {
                el.addEventListener('click', () => {
                    selectedDateStr = el.dataset.date;
                    renderSearchBody();
                });
            });
        }

        if (realTimeOn && !selectedDateStr && !searchKeyword) {
            resultSlot.innerHTML = `<div class="ctd-empty-hint">点击黑色日期可查看当日记录</div>`;
            return;
        }

        let filtered = msgs.slice();
        if (realTimeOn && selectedDateStr) filtered = filtered.filter(m => getMsgDateStr(m) === selectedDateStr);
        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            filtered = filtered.filter(m => formatMsgPreview(m).toLowerCase().includes(kw));
        }

        if (!filtered.length) {
            resultSlot.innerHTML = `<div class="ctd-empty-hint">${selectedDateStr ? '该日期暂无聊天记录' : '未找到相关聊天记录'}</div>`;
            return;
        }

        const thread = getThreadById(currentThreadId);
        const listHtml = filtered.slice().reverse().map(m => {
            let senderName = '我';
            if (m.sender !== 'me') {
                const c = m.charId ? getCharById(m.charId) : (thread && thread.charId ? getCharById(thread.charId) : null);
                senderName = (c && (c.name || c.nickname)) || getDisplayName(thread, settings);
            }
            return `
                <div class="ctd-msg-item">
                    <div class="ctd-msg-meta">
                        <span class="ctd-msg-sender">${escapeHtml(senderName)}</span>
                        <span class="ctd-msg-time">${escapeHtml(formatMsgTimeLabel(m, realTimeOn))}</span>
                    </div>
                    <div class="ctd-msg-body">${escapeHtml(formatMsgPreview(m))}</div>
                </div>
            `;
        }).join('');

        resultSlot.innerHTML = `<div class="ctd-msg-list">${listHtml}</div>`;
        bindAllPressed(resultSlot);
    }

    /* ---------------- 二级页：专属预设单选 ---------------- */
    function renderPresetView() {
        const scrollEl = document.getElementById('ctdPresetScroll');
        if (!scrollEl || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const presets = getAvailableOnlinePresets();
        const globalPreset = getGlobalActivePreset();
        const globalName = globalPreset ? (globalPreset.name || '未命名预设') : '未选择';
        const selectedId = settings.presetId || '';

        const followHtml = `
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
                return `
                    <div class="ctd-row ctd-preset-item-row" data-preset-id="${escapeHtml(p.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(p.name || '未命名预设')}</div>
                            <div class="ctd-row-sub">${count ? `包含 ${count} 条提示词` : '线上预设'}</div>
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${isSelected ? 'checked' : ''}">${isSelected ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            listHtml = `<div class="ctd-section-label">指定专属预设（单选）</div><div class="ctd-card">${rowsHtml}</div>`;
        }

        scrollEl.innerHTML = followHtml + listHtml;
        bindAllPressed(scrollEl);

        document.getElementById('ctdPresetFollowGlobalRow').addEventListener('click', () => {
            updateThreadSettings(currentThreadId, { presetId: '' });
            renderPresetView();
            showToast('已恢复跟随全局预设');
        });
        scrollEl.querySelectorAll('.ctd-preset-item-row').forEach(row => {
            row.addEventListener('click', () => {
                updateThreadSettings(currentThreadId, { presetId: row.dataset.presetId || '' });
                renderPresetView();
                showToast('已指定专属预设');
            });
        });
    }

    /* ---------------- 二级页：单独挂载世界书 ---------------- */
    function renderLoreView() {
        const scrollEl = document.getElementById('ctdLoreScroll');
        if (!scrollEl || !currentThreadId) return;

        const settings = getThreadSettings(currentThreadId);
        const books = getAvailableLorebooks();
        const selectedSet = new Set(Array.isArray(settings.loreIds) ? settings.loreIds : []);

        const toggleHtml = `
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
                return `
                    <div class="ctd-row ctd-lore-book-row" data-book-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || b.title || '未命名世界书')}</div>
                            <div class="ctd-row-sub">${entryCount ? `共 ${entryCount} 条词条` : '世界书'}</div>
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            booksHtml = `<div class="ctd-section-label">选择世界书（可多选）</div><div class="ctd-card" style="${settings.loreOverride ? '' : 'opacity:0.55;'}">${rowsHtml}</div>`;
        }

        scrollEl.innerHTML = toggleHtml + booksHtml;
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
                if (set.has(bid)) set.delete(bid);
                else set.add(bid);
                updateThreadSettings(currentThreadId, { loreOverride: true, loreIds: Array.from(set) });
                renderLoreView();
            });
        });
    }

    /* ---------------- 背景 / 导入 / 导出 / 清空 ---------------- */
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

    function exportThreadMessages(thread) {
        if (!currentThreadId) return;
        const msgs = getThreadMessages(currentThreadId);
        const settings = getThreadSettings(currentThreadId);
        const name = getDisplayName(thread, settings);
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            threadId: currentThreadId,
            name,
            messages: msgs
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${name}_${toDateStr(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`已导出 ${msgs.length} 条聊天记录`);
    }

    function importThreadMessages() {
        if (!currentThreadId) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result);
                    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.messages) ? parsed.messages : null);
                    if (!arr) {
                        showToast('文件格式无效，请选择正确的导出文件');
                        return;
                    }
                    saveJSON(MSGS_PREFIX + currentThreadId, arr);
                    const threads = loadJSON(THREADS_KEY, []);
                    const idx = threads.findIndex(t => t.id === currentThreadId);
                    if (idx >= 0 && arr.length) {
                        const last = arr[arr.length - 1];
                        threads[idx].lastMsg = formatMsgPreview(last);
                        threads[idx].lastTime = formatMsgTimeLabel(last, false);
                        saveJSON(THREADS_KEY, threads);
                    }
                    showToast(`已导入 ${arr.length} 条聊天记录，重新进入对话即可查看`);
                } catch (e) {
                    showToast('解析导入文件失败');
                }
            };
            reader.readAsText(file);
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
    }

    /* ---------------- 事件拦截与观察器 ---------------- */
    function setupObserversAndHooks() {
        document.addEventListener('click', (e) => {
            const moreBtn = e.target.closest('#ctRoomMoreBtn');
            if (moreBtn) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openDetails(resolveActiveThreadId());
                return;
            }

            // 拉黑拦截发送
            const sendBtn = e.target.closest('#ctRoomSendBtn');
            if (sendBtn) {
                const tid = resolveActiveThreadId();
                const settings = getThreadSettings(tid);
                if (tid && settings.blocked) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    showToast('已拉黑该联系人，请先解除拉黑');
                    return;
                }
            }

            const row = e.target.closest('#app-chat .ct-flat-list > *');
            if (row) {
                const tid = row.dataset.threadId || row.dataset.id || '';
                if (tid) {
                    currentThreadId = tid;
                } else {
                    const nameEl = row.querySelector('.ct-chat-name, .ct-name');
                    const rowName = nameEl ? nameEl.textContent.trim() : '';
                    const allSettings = getAllSettings();
                    const found = getThreads().find(t => {
                        const st = allSettings[t.id] || {};
                        return (t.name || '').trim() === rowName || (st.remark || '').trim() === rowName;
                    });
                    if (found) currentThreadId = found.id;
                }
                setTimeout(() => {
                    syncRoomTitleAndBellUI();
                    syncRoomBackgroundUI();
                    syncRoomCustomAvatarsUI();
                }, 40);
            }
        }, true);

        const appChat = document.getElementById('app-chat');
        if (appChat) {
            let syncQueued = false;
            const observer = new MutationObserver(() => {
                if (syncQueued) return;
                syncQueued = true;
                requestAnimationFrame(() => {
                    syncQueued = false;
                    syncHomeListUI();
                    syncRoomTitleAndBellUI();
                    syncRoomCustomAvatarsUI();
                });
            });
            observer.observe(appChat, { childList: true, subtree: true });
        }

        const roomBackBtn = document.getElementById('ctRoomBackBtn');
        if (roomBackBtn) {
            roomBackBtn.addEventListener('click', () => {
                setTimeout(() => syncHomeListUI(), 60);
            });
        }
    }

    /* ---------------- 对外接口 ---------------- */
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
            syncRoomTitleAndBellUI();
        });
    } else {
        setupObserversAndHooks();
        sortThreadsByPin();
        syncRoomTitleAndBellUI();
    }
})();