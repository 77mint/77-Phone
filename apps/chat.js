/* =========================================================
   Chat 主页 & 聊天窗口 (apps/chat.js)
   - 100% 同步「档案」：所有联系人与群聊成员均严格来自 PhoneArchive
   - 微信小圆角头像 + 名字对齐头像上缘/预览对齐下缘 + 可点进聊天窗口
   - 适配 iOS visualViewport，原生键盘弹起不遮挡输入框
   - 支持 P1 长按流式转文字、P2 独占麦克风真录音（可回放）、默认展开转文字白卡、滑动引用
   - 支持 Char 视角切换（气泡左右互换、隐藏右上角复杂按钮、自动隐藏 CoT、预留关系备注接口）
   - 支持气泡头顶 CoT 思维链胶囊（每次回复首气泡均展示、点按顺滑展开）
   - 支持顶部备注位「对方正在输入中…」（停字立刻恢复备注名并保留免打扰铃铛）
   - 发送逻辑：回车 / 有字点 ↑ 仅上屏；空输入框再点 ↑ 才触发 AI 回复
   ========================================================= */

(function () {
    const STORAGE_CONTACTS_KEY = 'chat_contacts_v1';
    const STORAGE_THREADS_KEY = 'chat_threads_v1';
    const STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
    const STORAGE_CHAR_REMARKS = 'chat_char_user_remarks_v1';
    const STORAGE_CHAR_THREADS_PREFIX = 'chat_char_threads_v1_';
    const STORAGE_CHAR_CONTACTS_PREFIX = 'chat_char_contacts_v1_';
    const BUILTIN_ID = 'assistant-shuixiaojiu';

    const SVG_VOICE_CIRCLE = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="14" cy="14" r="11.5"/>
            <path d="M9.6 14l2.1-1.7v3.4L9.6 14z" fill="currentColor" stroke="none"/>
            <path d="M14.1 11.4a3.6 3.6 0 0 1 0 5.2"/>
            <path d="M16.7 9.4a6.4 6.4 0 0 1 0 9.2"/>
        </svg>`;

    const SVG_KEYBOARD_CIRCLE = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="14" cy="14" r="11.5"/>
            <rect x="8.5" y="10" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="11.5" y="10" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="14.5" y="10" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="17.5" y="10" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="8.5" y="13" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="11.5" y="13" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="14.5" y="13" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="17.5" y="13" width="2" height="2" rx="0.4" fill="currentColor" stroke="none"/>
            <rect x="10.5" y="16.2" width="7" height="1.8" rx="0.6" fill="currentColor" stroke="none"/>
        </svg>`;

    const SVG_EMOJI_CIRCLE = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="14" cy="14" r="11.5"/>
            <circle cx="10.8" cy="11.8" r="1.1" fill="currentColor" stroke="none"/>
            <circle cx="17.2" cy="11.8" r="1.1" fill="currentColor" stroke="none"/>
            <path d="M10.2 15.6c.9 1.7 2.2 2.5 3.8 2.5s2.9-.8 3.8-2.5"/>
        </svg>`;

    const SVG_VOICE_WAVE_ME = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
            <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <path class="ct-vw-arc1" d="M14.2 8.8a4.6 4.6 0 0 0 0 6.4"/>
            <path class="ct-vw-arc2" d="M10.8 6a8.6 8.6 0 0 0 0 12"/>
        </svg>`;

    const SVG_VOICE_WAVE_OTHER = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
            <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <path class="ct-vw-arc1" d="M9.8 8.8a4.6 4.6 0 0 1 0 6.4"/>
            <path class="ct-vw-arc2" d="M13.2 6a8.6 8.6 0 0 1 0 12"/>
        </svg>`;

    let activeTab = 'messages';
    let searchKeyword = '';
    let contactKeyword = '';
    let modalSearchKeyword = '';
    let groupSelectedIds = [];
    let currentThreadId = null;
    let currentRoomBaseTitle = '';
    let isVoiceMode = false;
    let pendingQuote = null;
    let currentPlayingAudio = null;
    let playAnimTimer = null;
    let userAvatarCache = {};
    let expandedCotIds = new Set();
    let typingThreads = new Set();

    // 长按录音 / 语音转文字状态
    let holdState = {
        active: false,
        mode: 'voice', // 'voice' | 'dictate'
        zone: 'send',  // 'send' | 'cancel' | 'alt'
        startTime: 0,
        finalTranscript: '',
        transcript: '',
        recognition: null,
        onRecEnd: null,
        recorder: null,
        stream: null,
        chunks: []
    };

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

    function getArchiveChars() {
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
                return window.PhoneArchive.getChars() || [];
            }
        } catch (e) {}
        return [];
    }

    function getCharDisplayName(c) {
        if (!c) return '未命名';
        return c.name || c.nickname || '未命名';
    }

    function getCharAvatar(c) {
        if (!c) return '';
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
                return window.PhoneArchive.getCharAvatar(c.id) || '';
            }
        } catch (e) {}
        return c.avatar || '';
    }

    /* ---------------- CoT 思维链开关与字段读取 ---------------- */
    function isCotEnabled() {
        try {
            if (currentThreadId && window.PhoneChatDetails && typeof window.PhoneChatDetails.getSettings === 'function') {
                const ds = window.PhoneChatDetails.getSettings(currentThreadId);
                if (ds && typeof ds.cotShow === 'boolean') return ds.cotShow;
            }
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getPrefs === 'function') {
                const prefs = window.PhoneChatMe.getPrefs() || {};
                if (typeof prefs.showCot === 'boolean') return prefs.showCot;
                if (typeof prefs.showCoT === 'boolean') return prefs.showCoT;
                if (typeof prefs.cot === 'boolean') return prefs.cot;
                if (typeof prefs.showThinking === 'boolean') return prefs.showThinking;
                if (typeof prefs.thinking === 'boolean') return prefs.thinking;
            }
        } catch (e) {}
        return true;
    }

    function getMsgCotText(m) {
        if (!m) return '';
        const raw = m.cot || m.thinking || m.thought || m.reasoning || '';
        return String(raw).trim();
    }

    /* ---------------- 当前视角辅助（User 视角 vs Char 视角） ---------------- */
    function getActivePov() {
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
                const acc = window.PhoneChatMe.getActiveAccount();
                if (acc && acc.type === 'char' && acc.charId) {
                    const chars = getArchiveChars();
                    const ch = chars.find(c => c.id === acc.charId) || null;
                    return { isChar: true, charId: acc.charId, charObj: ch, account: acc };
                }
                return { isChar: false, charId: '', charObj: null, account: acc };
            }
        } catch (e) {}
        return { isChar: false, charId: '', charObj: null, account: null };
    }

    function getUserSelfAccount() {
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getAccounts === 'function') {
                const list = window.PhoneChatMe.getAccounts() || [];
                const active = window.PhoneChatMe.getActiveAccount();
                if (active && active.type !== 'char') return active;
                return list.find(a => a.type !== 'char') || { id: 'acc_default', name: '我' };
            }
        } catch (e) {}
        return { id: 'acc_default', name: '我' };
    }

    function getCharRemarkForUser(charId) {
        const map = loadJSON(STORAGE_CHAR_REMARKS, {});
        if (map && map[charId]) return map[charId];
        const userAcc = getUserSelfAccount();
        return (userAcc && userAcc.name) || '我';
    }

    function resolveUserAvatarAsync(cb) {
        const acc = getUserSelfAccount();
        if (!acc) { cb(''); return; }
        const cacheKey = acc.avatarDbKey || (acc.maskId ? ('mask_' + acc.maskId) : '');
        if (cacheKey && userAvatarCache[cacheKey]) {
            cb(userAvatarCache[cacheKey]);
            return;
        }
        if (acc.avatarDbKey && window.PhoneDB && typeof window.PhoneDB.get === 'function') {
            Promise.resolve(window.PhoneDB.get(acc.avatarDbKey)).then(url => {
                if (url) {
                    userAvatarCache[cacheKey] = url;
                    cb(url);
                } else if (acc.maskId && window.PhoneMask && typeof window.PhoneMask.getMaskAvatar === 'function') {
                    Promise.resolve(window.PhoneMask.getMaskAvatar(acc.maskId)).then(mUrl => {
                        if (mUrl) userAvatarCache[cacheKey] = mUrl;
                        cb(mUrl || '');
                    }).catch(() => cb(''));
                } else {
                    cb('');
                }
            }).catch(() => cb(''));
            return;
        }
        if (acc.maskId && window.PhoneMask && typeof window.PhoneMask.getMaskAvatar === 'function') {
            Promise.resolve(window.PhoneMask.getMaskAvatar(acc.maskId)).then(mUrl => {
                if (mUrl) userAvatarCache[cacheKey] = mUrl;
                cb(mUrl || '');
            }).catch(() => cb(''));
            return;
        }
        cb('');
    }

    function hydrateUserAvatars(container) {
        if (!container) return;
        const els = container.querySelectorAll('[data-user-avatar-box]');
        if (!els.length) return;
        resolveUserAvatarAsync(url => {
            if (!url) return;
            els.forEach(el => {
                el.innerHTML = `<img src="${escapeHtml(url)}" alt="" />`;
            });
        });
    }

    function getContactIds() {
        const archiveChars = getArchiveChars();
        const validSet = new Set(archiveChars.map(c => c.id));
        const saved = loadJSON(STORAGE_CONTACTS_KEY, []).filter(id => validSet.has(id));
        if (validSet.has(BUILTIN_ID) && !saved.includes(BUILTIN_ID)) {
            saved.unshift(BUILTIN_ID);
            saveJSON(STORAGE_CONTACTS_KEY, saved);
        }
        return saved;
    }

    function getThreads() {
        const archiveChars = getArchiveChars();
        const validSet = new Set(archiveChars.map(c => c.id));
        let list = loadJSON(STORAGE_THREADS_KEY, []).filter(t => {
            if (t.type === 'dm') return validSet.has(t.charId);
            return true;
        });
        if (validSet.has(BUILTIN_ID) && !list.some(t => t.id === 'dm-' + BUILTIN_ID)) {
            const bot = archiveChars.find(c => c.id === BUILTIN_ID);
            list.unshift({
                id: 'dm-' + BUILTIN_ID,
                type: 'dm',
                charId: BUILTIN_ID,
                name: getCharDisplayName(bot),
                lastMsg: '你好呀，我是水小九，前端、美化、酒馆和小手机的事都可以问我。',
                lastTime: '在线'
            });
            saveJSON(STORAGE_THREADS_KEY, list);
        }
        return list;
    }

    function getCharPovThreads(povCharId) {
        const userName = getCharRemarkForUser(povCharId);
        const dmId = 'dm-' + povCharId;
        const userThreads = getThreads();
        const baseDm = userThreads.find(t => t.id === dmId);
        const msgs = getThreadMessages(dmId);
        const last = msgs.length ? msgs[msgs.length - 1] : null;
        const lastText = last
            ? (last.type === 'voice' ? `[语音 ${last.duration || 1}"]` : (last.text || ''))
            : ((baseDm && baseDm.lastMsg) || '点击开始聊天');
        const lastTime = (last && last.time) || (baseDm && baseDm.lastTime) || '';

        const mainUserThread = {
            id: dmId,
            type: 'dm-user',
            charId: povCharId,
            name: userName,
            lastMsg: lastText,
            lastTime: lastTime
        };

        const naturalLife = loadJSON(STORAGE_CHAR_THREADS_PREFIX + povCharId, []);
        const extra = Array.isArray(naturalLife) ? naturalLife : [];
        return [mainUserThread].concat(extra);
    }

    function getThreadMessages(threadId) {
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, null);
        if (Array.isArray(msgs)) return msgs;
        if (threadId === 'dm-' + BUILTIN_ID) {
            const init = [{
                id: 'm-welcome',
                sender: 'char',
                charId: BUILTIN_ID,
                text: '你好呀，我是水小九，前端、美化、酒馆和小手机的事都可以问我。',
                time: '在线'
            }];
            saveJSON(STORAGE_MSGS_PREFIX + threadId, init);
            return init;
        }
        return [];
    }

    function saveThreadMessages(threadId, msgs) {
        saveJSON(STORAGE_MSGS_PREFIX + threadId, msgs);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showToast(msg) {
        const el = document.getElementById('ctToast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => el.classList.remove('show'), 1800);
    }

    function renderAvatarHtml(charObj, isGroup, cls) {
        const boxCls = cls || 'ct-avatar';
        if (isGroup) {
            return `<div class="${boxCls}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>`;
        }
        const name = getCharDisplayName(charObj);
        const fallbackChar = (charObj && charObj.id === BUILTIN_ID) ? '九' : name.slice(0, 1);
        const av = getCharAvatar(charObj);
        if (av) {
            return `<div class="${boxCls}"><img src="${escapeHtml(av)}" onerror="this.parentNode.textContent='${escapeHtml(fallbackChar)}'" alt="" /></div>`;
        }
        return `<div class="${boxCls}">${escapeHtml(fallbackChar)}</div>`;
    }

    function renderUserAvatarHtml(displayName, cls) {
        const boxCls = cls || 'ct-avatar';
        const fallbackChar = (displayName || '我').slice(0, 1);
        return `<div class="${boxCls}" data-user-avatar-box="1">${escapeHtml(fallbackChar)}</div>`;
    }

    /* ---------------- 顶部备注位「对方正在输入中…」切换（停字恢复备注） ---------------- */
    function resolveRoomRemarkTitle() {
        const pov = getActivePov();
        if (!pov.isChar && currentThreadId && window.PhoneChatDetails && typeof window.PhoneChatDetails.getSettings === 'function') {
            try {
                const ds = window.PhoneChatDetails.getSettings(currentThreadId);
                if (ds && ds.remark) return ds.remark;
            } catch (e) {}
        }
        return currentRoomBaseTitle || '聊天';
    }

    function syncRoomTitle() {
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return;
        const pov = getActivePov();
        const isTyping = !pov.isChar && !!currentThreadId && typingThreads.has(currentThreadId);
        const existingBell = titleEl.querySelector('#ctRoomMuteBell');
        titleEl.classList.toggle('is-typing', isTyping);
        if (isTyping) {
            titleEl.textContent = '对方正在输入中…';
        } else {
            titleEl.textContent = resolveRoomRemarkTitle();
            if (existingBell) titleEl.appendChild(existingBell);
        }
    }

    function setThreadTyping(threadId, isTyping) {
        const tid = threadId || currentThreadId;
        if (!tid) return;
        if (isTyping) typingThreads.add(tid);
        else typingThreads.delete(tid);
        if (tid === currentThreadId) {
            syncRoomTitle();
        }
    }

    function isThreadTyping(threadId) {
        const tid = threadId || currentThreadId;
        return !!tid && typingThreads.has(tid);
    }

    function syncRoomViewport() {
        const room = document.getElementById('ctRoomView');
        const app = document.querySelector('#app-chat .ct-app');
        if (!room || !app || !room.classList.contains('open')) return;

        const vv = window.visualViewport;
        if (!vv) return;

        window.scrollTo(0, 0);

        const appRect = app.getBoundingClientRect();
        if (!appRect.height || !app.offsetHeight) return;
        const scale = appRect.height / app.offsetHeight;

        const kbHeight = window.innerHeight - vv.height;
        if (kbHeight > 80) {
            const availH = Math.max(220, (vv.height - Math.max(0, appRect.top)) / scale);
            room.style.top = '0px';
            room.style.bottom = 'auto';
            room.style.height = availH + 'px';
            room.classList.add('is-kb-open');

            const box = document.getElementById('ctRoomMessages');
            if (box) box.scrollTop = box.scrollHeight;
        } else {
            resetRoomViewport();
        }
    }

    function resetRoomViewport() {
        const room = document.getElementById('ctRoomView');
        if (!room) return;
        room.style.top = '0px';
        room.style.bottom = '0px';
        room.style.height = '';
        room.classList.remove('is-kb-open');
    }

    function syncTopButtonsVisibility() {
        const pov = getActivePov();
        const backBtn = document.getElementById('ctBackBtn');
        const plusBtn = document.getElementById('ctPlusBtn');
        if (backBtn) backBtn.classList.toggle('is-hidden', activeTab !== 'messages');
        if (plusBtn) plusBtn.classList.toggle('is-hidden', activeTab !== 'messages' || pov.isChar);
    }

    function bindTactilePress(root) {
        if (!root || root.dataset.tactileBound === '1') return;
        root.dataset.tactileBound = '1';
        const sel = '.ct-glass-circle, .ct-plus-item, .ct-row, .ct-tab-btn, .ct-room-icon-btn, .ct-pill-btn, .ct-primary-btn, .ct-modal-close, .ct-cot-pill, .ct-msg-bubble.ct-gift-bubble';
        let pressedEl = null;
        let sx = 0, sy = 0;

        root.addEventListener('touchstart', (e) => {
            const target = e.target.closest(sel);
            if (!target) return;
            pressedEl = target;
            if (e.touches[0]) {
                sx = e.touches[0].clientX;
                sy = e.touches[0].clientY;
            }
            target.classList.add('is-pressed');
        }, { passive: true });

        root.addEventListener('touchmove', (e) => {
            if (!pressedEl || !e.touches[0]) return;
            if (Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 10) {
                pressedEl.classList.remove('is-pressed');
                pressedEl = null;
            }
        }, { passive: true });

        const clearPress = () => {
            if (pressedEl) {
                pressedEl.classList.remove('is-pressed');
                pressedEl = null;
            }
        };
        root.addEventListener('touchend', clearPress, { passive: true });
        root.addEventListener('touchcancel', clearPress, { passive: true });
    }

    function mount() {
        const root = document.getElementById('app-chat');
        if (!root || root.dataset.mounted === '1') return;
        root.dataset.mounted = '1';

        root.innerHTML = `
            <div class="ct-app">
                <div class="ct-topbar">
                    <div class="ct-topbar-left">
                        <button class="ct-glass-circle" id="ctBackBtn" data-close-app aria-label="返回桌面">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div class="ct-title" id="ctTitle">讯息</div>
                    </div>
                    <button class="ct-glass-circle" id="ctPlusBtn" aria-label="更多操作">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>

                <div class="ct-plus-menu" id="ctPlusMenu">
                    <button class="ct-plus-item" id="ctMenuAddContact">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        <span>添加联系人</span>
                    </button>
                    <button class="ct-plus-item" id="ctMenuNewGroup">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>发起群聊</span>
                    </button>
                </div>

                <div class="ct-scroll" id="ctMainScroll"></div>

                <div class="ct-bottom-bar">
                    <button class="ct-tab-btn active" data-tab="messages">讯息</button>
                    <button class="ct-tab-btn" data-tab="contacts">联系人</button>
                    <button class="ct-tab-btn" data-tab="moments">朋友圈</button>
                    <button class="ct-tab-btn" data-tab="me">我的</button>
                </div>

                <!-- 全屏聊天窗口 -->
                <div class="ct-room" id="ctRoomView">
                    <div class="ct-room-head">
                        <button class="ct-glass-circle" id="ctRoomBackBtn" aria-label="返回讯息">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div class="ct-room-title" id="ctRoomTitle"></div>
                        <button class="ct-glass-circle" id="ctRoomMoreBtn" aria-label="聊天设置">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
                        </button>
                    </div>
                    <div class="ct-room-messages" id="ctRoomMessages"></div>
                    <div class="ct-room-footer" id="ctRoomFooter">
                        <div class="ct-room-input-bar">
                            <button class="ct-room-icon-btn" id="ctRoomPlusBtn" aria-label="更多">
                                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                                    <circle cx="14" cy="14" r="11.5"/>
                                    <line x1="14" y1="9" x2="14" y2="19"/>
                                    <line x1="9" y1="14" x2="19" y2="14"/>
                                </svg>
                            </button>
                            <input class="ct-room-input" id="ctRoomInput" placeholder="可按住 转文字" />
                            <button class="ct-hold-talk-btn" id="ctHoldTalkBtn">按住 说话</button>
                            <button class="ct-room-icon-btn" id="ctRoomVoiceBtn" aria-label="切换语音">${SVG_VOICE_CIRCLE}</button>
                            <button class="ct-room-icon-btn" id="ctRoomEmojiBtn" aria-label="表情">${SVG_EMOJI_CIRCLE}</button>
                            <button class="ct-room-icon-btn" id="ctRoomSendBtn" aria-label="发送">
                                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="14" cy="14" r="11.5"/>
                                    <line x1="14" y1="19" x2="14" y2="9.5"/>
                                    <polyline points="9.8 13.5 14 9.3 18.2 13.5"/>
                                </svg>
                            </button>
                        </div>
                        <div class="ct-quote-bar" id="ctQuoteBar">
                            <div class="ct-quote-bar-text" id="ctQuoteBarText"></div>
                            <button class="ct-quote-bar-close" id="ctQuoteBarClose" aria-label="取消引用">×</button>
                        </div>
                    </div>

                    <!-- 长按说话 / 转文字浮层 -->
                    <div class="ct-voice-overlay" id="ctVoiceOverlay">
                        <div class="ct-vo-center">
                            <div class="ct-vo-bubble" id="ctVoBubble"></div>
                            <div class="ct-vo-hint" id="ctVoHint"></div>
                        </div>
                        <div class="ct-vo-bottom">
                            <div class="ct-vo-actions">
                                <div class="ct-vo-pill left" id="ctVoCancelBtn">取消</div>
                                <div class="ct-vo-pill right" id="ctVoAltBtn"></div>
                            </div>
                            <div class="ct-vo-dome"></div>
                        </div>
                    </div>
                </div>

                <!-- 添加联系人弹窗 -->
                <div class="ct-modal-mask" id="ctAddContactModal">
                    <div class="ct-modal">
                        <div class="ct-modal-head">
                            <div class="ct-modal-title">添加联系人</div>
                            <button class="ct-modal-close" data-close-modal="ctAddContactModal">×</button>
                        </div>
                        <input class="ct-modal-input" id="ctAddSearchInput" placeholder="搜索档案里的角色名字..." />
                        <div class="ct-modal-list" id="ctAddContactList"></div>
                    </div>
                </div>

                <!-- 发起群聊弹窗 -->
                <div class="ct-modal-mask" id="ctGroupModal">
                    <div class="ct-modal">
                        <div class="ct-modal-head">
                            <div class="ct-modal-title">发起群聊</div>
                            <button class="ct-modal-close" data-close-modal="ctGroupModal">×</button>
                        </div>
                        <input class="ct-modal-input" id="ctGroupNameInput" placeholder="群聊名称（选填）" />
                        <input class="ct-modal-input" id="ctGroupSearchInput" placeholder="搜索要拉进群的角色..." />
                        <div class="ct-modal-list" id="ctGroupPickList"></div>
                        <button class="ct-primary-btn" id="ctCreateGroupBtn">发起群聊</button>
                    </div>
                </div>

                <!-- 联系人档案详情弹窗 -->
                <div class="ct-modal-mask" id="ctProfileModal">
                    <div class="ct-modal">
                        <div class="ct-modal-head">
                            <div class="ct-modal-title">详细资料</div>
                            <button class="ct-modal-close" data-close-modal="ctProfileModal">×</button>
                        </div>
                        <div id="ctProfileContent"></div>
                    </div>
                </div>

                <div class="ct-toast" id="ctToast"></div>
            </div>
        `;

        bindTactilePress(root);
        bindEvents();
        renderActiveTab();
    }

    function setVoiceMode(enabled) {
        isVoiceMode = !!enabled;
        const footer = document.getElementById('ctRoomFooter');
        const btn = document.getElementById('ctRoomVoiceBtn');
        const inp = document.getElementById('ctRoomInput');
        if (footer) footer.classList.toggle('is-voice-mode', isVoiceMode);
        if (btn) btn.innerHTML = isVoiceMode ? SVG_KEYBOARD_CIRCLE : SVG_VOICE_CIRCLE;
        if (isVoiceMode && inp) inp.blur();
    }

    function renderQuoteBar() {
        const bar = document.getElementById('ctQuoteBar');
        const txt = document.getElementById('ctQuoteBarText');
        if (!bar || !txt) return;
        if (!pendingQuote) {
            bar.classList.remove('show');
            txt.textContent = '';
            return;
        }
        txt.textContent = `${pendingQuote.senderName}：${pendingQuote.text}`;
        bar.classList.add('show');
    }

    function updateOverlayUI() {
        const bubble = document.getElementById('ctVoBubble');
        const hint = document.getElementById('ctVoHint');
        const cancelBtn = document.getElementById('ctVoCancelBtn');
        const altBtn = document.getElementById('ctVoAltBtn');
        if (!bubble || !hint || !cancelBtn || !altBtn) return;

        const isCancel = holdState.zone === 'cancel';
        const isAlt = holdState.zone === 'alt';

        cancelBtn.classList.toggle('active', isCancel);
        altBtn.classList.toggle('active', isAlt);
        bubble.classList.toggle('is-cancel', isCancel);

        if (holdState.mode === 'voice' && !isAlt) {
            bubble.classList.add('is-voice');
            bubble.innerHTML = '<div class="ct-vo-waves"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>';
            hint.textContent = isCancel ? '松手 取消发送' : '松手 发语音';
        } else {
            bubble.classList.remove('is-voice');
            bubble.textContent = holdState.transcript || '正在聆听...';
            if (isCancel) hint.textContent = '松手 取消';
            else if (isAlt && holdState.mode === 'dictate') hint.textContent = '松手 编辑文字';
            else hint.textContent = '松手 发送';
        }
    }

    function stopAllMedia() {
        if (holdState.recognition) {
            try { holdState.recognition.abort(); } catch (e) {
                try { holdState.recognition.stop(); } catch (e2) {}
            }
            holdState.recognition = null;
        }
        if (holdState.stream) {
            holdState.stream.getTracks().forEach(t => {
                try { t.stop(); } catch (e) {}
            });
            holdState.stream = null;
        }
    }

    function startSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec || holdState.recognition) return;

        const launch = () => {
            if (!holdState.active) return;
            try {
                const rec = new SpeechRec();
                rec.lang = 'zh-CN';
                rec.interimResults = true;
                rec.continuous = false;
                rec.maxAlternatives = 1;

                rec.onresult = (event) => {
                    let interim = '';
                    let sessionFinal = '';
                    for (let i = 0; i < event.results.length; i++) {
                        const res = event.results[i];
                        if (res.isFinal) {
                            sessionFinal += res[0].transcript;
                        } else {
                            interim += res[0].transcript;
                        }
                    }
                    if (sessionFinal) {
                        holdState.finalTranscript = (holdState.finalTranscript + sessionFinal).trim();
                    }
                    holdState.transcript = (holdState.finalTranscript + interim).trim();
                    if (holdState.active) updateOverlayUI();
                };

                rec.onerror = () => {};
                rec.onend = () => {
                    if (holdState.active) {
                        setTimeout(launch, 60);
                    } else if (holdState.onRecEnd) {
                        const cb = holdState.onRecEnd;
                        holdState.onRecEnd = null;
                        cb();
                    }
                };

                holdState.recognition = rec;
                rec.start();
            } catch (e) {}
        };

        launch();
    }

    async function startAudioRecorder() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!holdState.active) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            holdState.stream = stream;
            holdState.chunks = [];
            if (window.MediaRecorder) {
                const recorder = new MediaRecorder(stream);
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) holdState.chunks.push(e.data);
                };
                recorder.start(100);
                holdState.recorder = recorder;
            }
        } catch (e) {}
    }

    function startHoldOverlay(mode) {
        if (holdState.active) return;
        holdState.active = true;
        holdState.mode = mode;
        holdState.zone = 'send';
        holdState.startTime = Date.now();
        holdState.finalTranscript = '';
        holdState.transcript = '';
        holdState.recognition = null;
        holdState.onRecEnd = null;
        holdState.recorder = null;
        holdState.stream = null;
        holdState.chunks = [];

        const overlay = document.getElementById('ctVoiceOverlay');
        const altBtn = document.getElementById('ctVoAltBtn');
        altBtn.textContent = mode === 'voice' ? '滑到这里 转文字' : '编辑';

        updateOverlayUI();
        overlay.classList.add('open');

        if (mode === 'dictate') {
            startSpeechRecognition();
        } else {
            startAudioRecorder();
        }
    }

    function moveHoldOverlay(clientX, clientY) {
        if (!holdState.active) return;
        const cancelEl = document.getElementById('ctVoCancelBtn');
        const altEl = document.getElementById('ctVoAltBtn');
        if (!cancelEl || !altEl) return;

        const cRect = cancelEl.getBoundingClientRect();
        const aRect = altEl.getBoundingClientRect();

        let nextZone = 'send';
        if (clientY >= cRect.top - 24 && clientX <= cRect.right + 12) {
            nextZone = 'cancel';
        } else if (clientY >= aRect.top - 24 && clientX >= aRect.left - 12) {
            nextZone = 'alt';
        }
        if (nextZone !== holdState.zone) {
            holdState.zone = nextZone;
            if (holdState.mode === 'voice' && nextZone === 'alt' && !holdState.recognition) {
                if (holdState.recorder && holdState.recorder.state !== 'inactive') {
                    try { holdState.recorder.stop(); } catch (e) {}
                }
                if (holdState.stream) {
                    holdState.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
                    holdState.stream = null;
                }
                startSpeechRecognition();
            }
            updateOverlayUI();
        }
    }

    function finishHoldOverlay() {
        if (!holdState.active) return;
        holdState.active = false;
        const mode = holdState.mode;
        const zone = holdState.zone;
        const durationSec = Math.max(1, Math.round((Date.now() - holdState.startTime) / 1000));

        const overlay = document.getElementById('ctVoiceOverlay');
        if (overlay) overlay.classList.remove('open');
        const holdBtn = document.getElementById('ctHoldTalkBtn');
        if (holdBtn) holdBtn.classList.remove('pressing');

        const needTranscript = (mode === 'dictate' && zone !== 'cancel') || (mode === 'voice' && zone === 'alt');

        const waitRecEnd = () => new Promise((resolve) => {
            if (!holdState.recognition) { resolve(); return; }
            if (!needTranscript) {
                try { holdState.recognition.abort(); } catch (e) {}
                holdState.recognition = null;
                resolve();
                return;
            }
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                if (holdState.recognition) {
                    try { holdState.recognition.abort(); } catch (e) {}
                    holdState.recognition = null;
                }
                resolve();
            };
            holdState.onRecEnd = finish;
            try { holdState.recognition.stop(); } catch (e) { finish(); }
            setTimeout(finish, 240);
        });

        const finalizeAudio = () => new Promise((resolve) => {
            if (!holdState.recorder || holdState.recorder.state === 'inactive') {
                if (holdState.stream) {
                    holdState.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
                    holdState.stream = null;
                }
                resolve('');
                return;
            }
            let finished = false;
            const cleanupStream = () => {
                if (holdState.stream) {
                    holdState.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
                    holdState.stream = null;
                }
            };
            holdState.recorder.onstop = () => {
                if (finished) return;
                finished = true;
                cleanupStream();
                if (zone !== 'send' || !holdState.chunks.length) { resolve(''); return; }
                const mime = holdState.recorder.mimeType || 'audio/mp4';
                const blob = new Blob(holdState.chunks, { type: mime });
                const reader = new FileReader();
                reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                reader.readAsDataURL(blob);
            };
            try {
                holdState.recorder.stop();
            } catch (e) {
                cleanupStream();
                resolve('');
            }
            setTimeout(() => {
                cleanupStream();
                if (!finished) { finished = true; resolve(''); }
            }, 320);
        });

        Promise.all([waitRecEnd(), finalizeAudio()]).then(([, audioData]) => {
            stopAllMedia();
            if (zone === 'cancel') return;
            const transcript = holdState.transcript.trim();

            if (mode === 'dictate') {
                if (!transcript) return;
                if (zone === 'alt') {
                    const inp = document.getElementById('ctRoomInput');
                    if (inp) {
                        inp.value = (inp.value ? inp.value + ' ' : '') + transcript;
                        inp.focus();
                    }
                } else {
                    sendTextMessage(transcript);
                }
                return;
            }

            if (zone === 'alt') {
                if (!transcript) return;
                sendTextMessage(transcript);
            } else {
                sendVoiceMessage(durationSec, audioData, transcript);
            }
        });
    }

    function bindEvents() {
        const root = document.getElementById('app-chat');
        const plusBtn = document.getElementById('ctPlusBtn');
        const plusMenu = document.getElementById('ctPlusMenu');

        root.querySelectorAll('.ct-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                plusMenu.classList.remove('open');
                activeTab = btn.dataset.tab;
                root.querySelectorAll('.ct-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                const titles = { messages: '讯息', contacts: '联系人', moments: '朋友圈', me: '我的' };
                document.getElementById('ctTitle').textContent = titles[activeTab] || 'Chat';

                syncTopButtonsVisibility();
                renderActiveTab();
            });
        });

        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            plusMenu.classList.toggle('open');
        });

        root.addEventListener('click', (e) => {
            if (!e.target.closest('#ctPlusMenu') && !e.target.closest('#ctPlusBtn')) {
                plusMenu.classList.remove('open');
            }
        });

        document.getElementById('ctMenuAddContact').addEventListener('click', () => {
            plusMenu.classList.remove('open');
            modalSearchKeyword = '';
            document.getElementById('ctAddSearchInput').value = '';
            renderAddContactModal();
            document.getElementById('ctAddContactModal').classList.add('open');
        });

        document.getElementById('ctMenuNewGroup').addEventListener('click', () => {
            plusMenu.classList.remove('open');
            modalSearchKeyword = '';
            groupSelectedIds = [];
            document.getElementById('ctGroupNameInput').value = '';
            document.getElementById('ctGroupSearchInput').value = '';
            renderGroupPickModal();
            document.getElementById('ctGroupModal').classList.add('open');
        });

        root.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById(btn.dataset.closeModal).classList.remove('open');
            });
        });

        document.getElementById('ctAddSearchInput').addEventListener('input', (e) => {
            modalSearchKeyword = e.target.value.trim().toLowerCase();
            renderAddContactModal();
        });

        document.getElementById('ctGroupSearchInput').addEventListener('input', (e) => {
            modalSearchKeyword = e.target.value.trim().toLowerCase();
            renderGroupPickModal();
        });

        document.getElementById('ctCreateGroupBtn').addEventListener('click', createGroupChat);

        document.getElementById('ctRoomBackBtn').addEventListener('click', () => {
            const inp = document.getElementById('ctRoomInput');
            if (inp) inp.blur();
            stopPlayingVoiceUI();
            resetRoomViewport();
            pendingQuote = null;
            expandedCotIds.clear();
            renderQuoteBar();
            document.getElementById('ctRoomView').classList.remove('open');
            currentThreadId = null;
            currentRoomBaseTitle = '';
            renderMessagesTab();
        });

        const roomInput = document.getElementById('ctRoomInput');
        document.getElementById('ctRoomMoreBtn').addEventListener('click', () => showToast('聊天详情待接入'));
        // 发送键：有字则仅上屏；空输入框再点才触发 AI 回复
        document.getElementById('ctRoomSendBtn').addEventListener('click', handleSendButtonClick);
        document.getElementById('ctRoomPlusBtn').addEventListener('click', () => showToast('更多功能待接入'));
        document.getElementById('ctRoomEmojiBtn').addEventListener('click', () => showToast('表情面板待接入'));
        document.getElementById('ctRoomVoiceBtn').addEventListener('click', () => setVoiceMode(!isVoiceMode));
        document.getElementById('ctQuoteBarClose').addEventListener('click', () => {
            pendingQuote = null;
            renderQuoteBar();
        });

        // 键盘回车：仅把字发上屏，绝不触发 AI 回复
        roomInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendRoomMessageOnly();
            }
        });

        roomInput.addEventListener('focus', () => {
            setTimeout(syncRoomViewport, 60);
            setTimeout(syncRoomViewport, 300);
        });

        roomInput.addEventListener('blur', () => {
            setTimeout(syncRoomViewport, 80);
        });

        let dictateTimer = null;
        let dictateTriggered = false;
        let inputTouchMoved = false;
        let inputTouchX = 0;
        let inputTouchY = 0;

        roomInput.addEventListener('touchstart', (e) => {
            if (roomInput.value.trim().length > 0) return;
            if (e.cancelable) e.preventDefault();
            dictateTriggered = false;
            inputTouchMoved = false;
            if (e.touches[0]) {
                inputTouchX = e.touches[0].clientX;
                inputTouchY = e.touches[0].clientY;
            }
            clearTimeout(dictateTimer);
            dictateTimer = setTimeout(() => {
                dictateTriggered = true;
                roomInput.blur();
                startHoldOverlay('dictate');
            }, 240);
        }, { passive: false });

        roomInput.addEventListener('touchmove', (e) => {
            if (holdState.active || !e.touches[0]) return;
            const dx = e.touches[0].clientX - inputTouchX;
            const dy = e.touches[0].clientY - inputTouchY;
            if (Math.hypot(dx, dy) > 12) {
                inputTouchMoved = true;
                clearTimeout(dictateTimer);
            }
        }, { passive: true });

        roomInput.addEventListener('touchend', (e) => {
            if (roomInput.value.trim().length > 0 && !dictateTriggered) return;
            clearTimeout(dictateTimer);
            if (dictateTriggered && holdState.active) {
                if (e.cancelable) e.preventDefault();
                finishHoldOverlay();
                dictateTriggered = false;
                return;
            }
            if (!dictateTriggered && !inputTouchMoved) {
                roomInput.focus();
            }
            dictateTriggered = false;
        });

        roomInput.addEventListener('touchcancel', () => {
            clearTimeout(dictateTimer);
            dictateTriggered = false;
            if (holdState.active) finishHoldOverlay();
        });

        const holdBtn = document.getElementById('ctHoldTalkBtn');
        holdBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            holdBtn.classList.add('pressing');
            startHoldOverlay('voice');
        });
        holdBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            holdBtn.classList.add('pressing');
            startHoldOverlay('voice');
        });

        window.addEventListener('touchmove', (e) => {
            if (holdState.active && e.touches[0]) {
                moveHoldOverlay(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchend', () => {
            clearTimeout(dictateTimer);
            if (holdState.active) finishHoldOverlay();
        });
        window.addEventListener('touchcancel', () => {
            clearTimeout(dictateTimer);
            if (holdState.active) finishHoldOverlay();
        });

        window.addEventListener('mousemove', (e) => {
            if (holdState.active) moveHoldOverlay(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', () => {
            if (holdState.active) finishHoldOverlay();
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncRoomViewport);
            window.visualViewport.addEventListener('scroll', syncRoomViewport);
        }

        window.addEventListener('phone-archive-updated', () => {
            renderActiveTab();
        });

        // 外部触发输入状态（如 chat-ai.js 派发 phone:chat-typing 事件）
        window.addEventListener('phone:chat-typing', (e) => {
            const detail = (e && e.detail) || {};
            setThreadTyping(detail.threadId || currentThreadId, !!detail.typing);
        });

        // 切号（如切入 Char 视角 / 切回主号）时自动同步刷新
        window.addEventListener('phone:chat-account-changed', () => {
            userAvatarCache = {};
            expandedCotIds.clear();
            const room = document.getElementById('ctRoomView');
            if (room && room.classList.contains('open')) {
                room.classList.remove('open');
                currentThreadId = null;
                currentRoomBaseTitle = '';
            }
            syncTopButtonsVisibility();
            if (activeTab !== 'me') {
                renderActiveTab();
            }
        });
    }

    function renderActiveTab() {
        syncTopButtonsVisibility();
        const scroll = document.getElementById('ctMainScroll');
        if (scroll) {
            scroll.classList.toggle('is-gray', activeTab === 'moments' || activeTab === 'me');
        }
        if (activeTab === 'messages') renderMessagesTab();
        else if (activeTab === 'contacts') renderContactsTab();
        else if (activeTab === 'moments') renderMomentsTab();
        else renderMeTab();
    }

    function renderMessagesTab() {
        const scroll = document.getElementById('ctMainScroll');
        const pov = getActivePov();
        const chars = getArchiveChars();

        let threads = pov.isChar ? getCharPovThreads(pov.charId) : getThreads();
        threads = threads.filter(t => {
            if (!searchKeyword) return true;
            const charObj = t.type === 'dm' ? chars.find(c => c.id === t.charId) : null;
            const name = charObj ? getCharDisplayName(charObj) : (t.name || '');
            return name.toLowerCase().includes(searchKeyword);
        });

        let listHtml = '';
        if (threads.length === 0) {
            listHtml = pov.isChar
                ? '<div class="ct-empty">暂无聊天记录</div>'
                : '<div class="ct-empty">还没有匹配的聊天<br>点右上角 <b>+</b> 添加联系人或发起群聊</div>';
        } else {
            listHtml = '<div class="ct-flat-list">' + threads.map(t => {
                const isGroup = t.type === 'group';
                const isUserTarget = t.type === 'dm-user';
                const charObj = (!isGroup && !isUserTarget) ? chars.find(c => c.id === t.charId) : null;
                const displayName = isUserTarget
                    ? (t.name || '我')
                    : (charObj ? getCharDisplayName(charObj) : (t.name || '未命名聊天'));
                const avatarHtml = isUserTarget
                    ? renderUserAvatarHtml(displayName)
                    : renderAvatarHtml(charObj, isGroup);

                return `
                    <div class="ct-row ct-thread-row" data-thread-id="${escapeHtml(t.id)}">
                        ${avatarHtml}
                        <div class="ct-row-main">
                            <div class="ct-row-top">
                                <div class="ct-row-name">${escapeHtml(displayName)}</div>
                                <div class="ct-row-time">${escapeHtml(t.lastTime || '')}</div>
                            </div>
                            <div class="ct-row-sub">${escapeHtml(t.lastMsg || '点击开始聊天')}</div>
                        </div>
                    </div>
                `;
            }).join('') + '</div>';
        }

        scroll.innerHTML = `
            <div class="ct-search-bar">
                <div class="ct-search-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input class="ct-search-input" id="ctThreadSearch" placeholder="搜索" value="${escapeHtml(searchKeyword)}" />
                </div>
            </div>
            ${listHtml}
        `;

        hydrateUserAvatars(scroll);

        const input = document.getElementById('ctThreadSearch');
        input.addEventListener('input', (e) => {
            searchKeyword = e.target.value.trim().toLowerCase();
            renderMessagesTab();
            const again = document.getElementById('ctThreadSearch');
            if (again) {
                again.focus();
                again.setSelectionRange(again.value.length, again.value.length);
            }
        });

        scroll.querySelectorAll('.ct-row[data-thread-id]').forEach(row => {
            row.addEventListener('click', () => {
                openChatRoom(row.dataset.threadId);
            });
        });
    }

    function openChatRoom(threadId) {
        const pov = getActivePov();
        const threads = pov.isChar ? getCharPovThreads(pov.charId) : getThreads();
        const t = threads.find(item => item.id === threadId);
        if (!t) return;
        currentThreadId = threadId;
        pendingQuote = null;
        expandedCotIds.clear();
        renderQuoteBar();

        const chars = getArchiveChars();
        const charObj = t.type === 'dm' ? chars.find(c => c.id === t.charId) : null;
        currentRoomBaseTitle = t.type === 'dm-user'
            ? (t.name || '我')
            : (charObj ? getCharDisplayName(charObj) : (t.name || '聊天'));
        syncRoomTitle();

        // Char 视角下隐藏右上角复杂设置按钮
        const moreBtn = document.getElementById('ctRoomMoreBtn');
        if (moreBtn) moreBtn.style.visibility = pov.isChar ? 'hidden' : '';

        resetRoomViewport();
        renderRoomMessages();
        document.getElementById('ctRoomView').classList.add('open');
        syncRoomViewport();
    }

    function stopPlayingVoiceUI() {
        clearTimeout(playAnimTimer);
        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            currentPlayingAudio = null;
        }
        document.querySelectorAll('.ct-msg-bubble.is-playing').forEach(el => el.classList.remove('is-playing'));
    }

    function renderRoomMessages() {
        if (!currentThreadId) return;
        const box = document.getElementById('ctRoomMessages');
        const pov = getActivePov();
        const showCot = !pov.isChar && isCotEnabled();
        const threads = pov.isChar ? getCharPovThreads(pov.charId) : getThreads();
        const t = threads.find(item => item.id === currentThreadId);
        const chars = getArchiveChars();
        const defaultChar = pov.isChar
            ? pov.charObj
            : ((t && t.type === 'dm') ? chars.find(c => c.id === t.charId) : null);
        const msgs = getThreadMessages(currentThreadId);

        if (msgs.length === 0) {
            box.innerHTML = '<div class="ct-empty">发一句话开始聊天吧</div>';
            return;
        }

        const userRemark = pov.isChar ? getCharRemarkForUser(pov.charId) : '我';
        let lastShownTime = '';

        box.innerHTML = msgs.map((m) => {
            const isCharSender = m.sender === 'char' || (m.sender !== 'me' && !!m.charId);
            const isMe = pov.isChar ? (isCharSender && (!m.charId || m.charId === pov.charId)) : (m.sender === 'me');

            let senderName = '';
            let avHtml = '';
            if (pov.isChar) {
                if (isMe) {
                    senderName = getCharDisplayName(pov.charObj);
                    avHtml = renderAvatarHtml(pov.charObj, false, 'ct-msg-avatar');
                } else {
                    senderName = userRemark;
                    avHtml = renderUserAvatarHtml(userRemark, 'ct-msg-avatar');
                }
            } else {
                const cObj = isMe ? null : (chars.find(c => c.id === m.charId) || defaultChar);
                senderName = isMe ? '我' : getCharDisplayName(cObj);
                avHtml = isMe
                    ? '<div class="ct-msg-avatar">我</div>'
                    : renderAvatarHtml(cObj, false, 'ct-msg-avatar');
            }

            let timeHtml = '';
            if (m.time && m.time !== '在线' && m.time !== lastShownTime) {
                lastShownTime = m.time;
                timeHtml = `<div class="ct-msg-time">${escapeHtml(m.time)}</div>`;
            }

            // CoT 思维链：每次对方回复的首条气泡带 cot 即展示在气泡头顶
            let cotHtml = '';
            const cotText = getMsgCotText(m);
            if (showCot && !isMe && cotText) {
                const isOpen = expandedCotIds.has(m.id);
                const durVal = m.cotDuration || m.thinkingTime;
                const pillLabel = m.cotTitle
                    ? m.cotTitle
                    : (durVal ? `已思考 ${durVal}s` : '思考过程');
                cotHtml = `
                    <div class="ct-cot-wrap${isOpen ? ' open' : ''}" data-cot-id="${escapeHtml(m.id)}">
                        <button type="button" class="ct-cot-pill" aria-expanded="${isOpen ? 'true' : 'false'}">
                            <span class="ct-cot-label">${escapeHtml(pillLabel)}</span>
                            <svg class="ct-cot-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <div class="ct-cot-body">
                            <div class="ct-cot-inner">
                                <div class="ct-cot-card">${escapeHtml(cotText)}</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            const isVoice = m.type === 'voice';
            const dur = Math.max(1, Number(m.duration || 1));
            const voiceWidth = Math.min(200, 72 + dur * 7);
            const bubbleStyle = isVoice ? ` style="width:${voiceWidth}px;"` : '';
            const bubbleInner = isVoice
                ? (isMe
                    ? `<div class="ct-voice-bubble" data-play-msg="${escapeHtml(m.id)}">
                            <span class="ct-voice-sec">${escapeHtml(String(dur))}"</span>
                            ${SVG_VOICE_WAVE_ME}
                       </div>`
                    : `<div class="ct-voice-bubble" data-play-msg="${escapeHtml(m.id)}">
                            ${SVG_VOICE_WAVE_OTHER}
                            <span class="ct-voice-sec">${escapeHtml(String(dur))}"</span>
                       </div>`)
                : escapeHtml(m.text);

            const quoteHtml = m.quote
                ? `<div class="ct-msg-quote">${escapeHtml(m.quote.senderName)}：${escapeHtml(m.quote.text)}</div>`
                : '';

            let subcardHtml = '';
            if (isVoice && m.transcript) {
                subcardHtml = `
                    <div class="ct-msg-subcard">
                        <div>${escapeHtml(m.transcript)}</div>
                        ${m.translation ? `
                            <div class="ct-msg-subdivider"></div>
                            <div>${escapeHtml(m.translation)}</div>
                            <div class="ct-msg-trans-foot">
                                <span class="ct-msg-trans-check">✓</span>
                                <span>由 API 提供翻译支持</span>
                            </div>
                        ` : ''}
                    </div>`;
            } else if (!isVoice && m.translation) {
                subcardHtml = `
                    <div class="ct-msg-subcard">
                        <div>${escapeHtml(m.translation)}</div>
                        <div class="ct-msg-trans-foot">
                            <span class="ct-msg-trans-check">✓</span>
                            <span>由 API 提供翻译支持</span>
                        </div>
                    </div>`;
            }

            return `${timeHtml}
                <div class="ct-msg-group ${isMe ? 'me' : ''}" data-msg-id="${escapeHtml(m.id)}" data-sender-name="${escapeHtml(senderName)}">
                    ${cotHtml}
                    <div class="ct-msg-row ${isMe ? 'me' : ''}">
                        ${avHtml}
                        <div class="ct-msg-bubble ${isVoice ? 'is-voice-msg' : ''}"${bubbleStyle}>${bubbleInner}</div>
                    </div>
                    ${quoteHtml}
                    ${subcardHtml}
                </div>
            `;
        }).join('');

        hydrateUserAvatars(box);

        box.querySelectorAll('.ct-cot-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wrap = btn.closest('.ct-cot-wrap');
                if (!wrap) return;
                const cid = wrap.dataset.cotId;
                const nextOpen = !wrap.classList.contains('open');
                wrap.classList.toggle('open', nextOpen);
                btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                if (cid) {
                    if (nextOpen) expandedCotIds.add(cid);
                    else expandedCotIds.delete(cid);
                }
            });
        });

        box.querySelectorAll('.ct-msg-group').forEach(group => {
            const isMe = group.classList.contains('me');
            let sx = 0, sy = 0, swiping = false, triggered = false;

            group.addEventListener('touchstart', (e) => {
                if (!e.touches[0]) return;
                sx = e.touches[0].clientX;
                sy = e.touches[0].clientY;
                swiping = false;
                triggered = false;
                group.style.transition = 'none';
            }, { passive: true });

            group.addEventListener('touchmove', (e) => {
                if (!e.touches[0]) return;
                const dx = e.touches[0].clientX - sx;
                const dy = e.touches[0].clientY - sy;
                if (!swiping) {
                    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                        swiping = true;
                    } else {
                        return;
                    }
                }
                const validDir = isMe ? (dx < 0) : (dx > 0);
                if (!validDir) return;
                const offset = isMe ? Math.max(-52, dx * 0.55) : Math.min(52, dx * 0.55);
                group.style.transform = `translateX(${offset}px)`;
                if (Math.abs(dx) >= 42) triggered = true;
            }, { passive: true });

            const endSwipe = () => {
                group.style.transition = 'transform 0.18s ease';
                group.style.transform = 'translateX(0)';
                if (triggered) {
                    const mid = group.dataset.msgId;
                    const target = msgs.find(item => item.id === mid);
                    if (target) {
                        const qText = target.type === 'voice'
                            ? `[语音 ${target.duration || 1}"]`
                            : (target.text || '');
                        pendingQuote = {
                            senderName: group.dataset.senderName || '我',
                            text: qText
                        };
                        renderQuoteBar();
                    }
                }
                swiping = false;
                triggered = false;
            };

            group.addEventListener('touchend', endSwipe);
            group.addEventListener('touchcancel', endSwipe);
        });

        box.querySelectorAll('[data-play-msg]').forEach(el => {
            el.addEventListener('click', () => {
                const mid = el.dataset.playMsg;
                const target = msgs.find(item => item.id === mid);
                const bubbleEl = el.closest('.ct-msg-bubble');
                if (!target || !bubbleEl) return;

                const wasPlaying = bubbleEl.classList.contains('is-playing');
                stopPlayingVoiceUI();
                if (wasPlaying) return;

                bubbleEl.classList.add('is-playing');
                const durMs = Math.max(1000, Number(target.duration || 1) * 1000);

                if (target.audio) {
                    currentPlayingAudio = new Audio(target.audio);
                    currentPlayingAudio.onended = stopPlayingVoiceUI;
                    currentPlayingAudio.play().catch(() => {
                        playAnimTimer = setTimeout(stopPlayingVoiceUI, durMs);
                    });
                } else {
                    playAnimTimer = setTimeout(stopPlayingVoiceUI, durMs);
                }
            });
        });

        box.scrollTop = box.scrollHeight;
    }

    function sendTextMessage(text) {
        if (!currentThreadId || !text) return;
        const pov = getActivePov();
        const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const msgs = getThreadMessages(currentThreadId);
        const msgObj = {
            id: 'm-' + Date.now(),
            sender: pov.isChar ? 'char' : 'me',
            charId: pov.isChar ? pov.charId : undefined,
            text: text,
            time: nowTime
        };
        if (pendingQuote) {
            msgObj.quote = Object.assign({}, pendingQuote);
            pendingQuote = null;
            renderQuoteBar();
        }
        msgs.push(msgObj);
        saveThreadMessages(currentThreadId, msgs);

        const threads = getThreads();
        const idx = threads.findIndex(t => t.id === currentThreadId);
        if (idx !== -1) {
            threads[idx].lastMsg = text;
            threads[idx].lastTime = nowTime;
            saveJSON(STORAGE_THREADS_KEY, threads);
        }

        renderRoomMessages();
    }

    function sendVoiceMessage(duration, audioData, transcript) {
        if (!currentThreadId) return;
        const pov = getActivePov();
        const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const msgs = getThreadMessages(currentThreadId);
        const msgObj = {
            id: 'm-' + Date.now(),
            sender: pov.isChar ? 'char' : 'me',
            charId: pov.isChar ? pov.charId : undefined,
            type: 'voice',
            duration: duration,
            audio: audioData || '',
            transcript: transcript || '',
            text: transcript || `[语音 ${duration}"]`,
            time: nowTime
        };
        if (pendingQuote) {
            msgObj.quote = Object.assign({}, pendingQuote);
            pendingQuote = null;
            renderQuoteBar();
        }
        msgs.push(msgObj);
        saveThreadMessages(currentThreadId, msgs);

        const threads = getThreads();
        const idx = threads.findIndex(t => t.id === currentThreadId);
        if (idx !== -1) {
            threads[idx].lastMsg = `[语音 ${duration}"]`;
            threads[idx].lastTime = nowTime;
            saveJSON(STORAGE_THREADS_KEY, threads);
        }

        renderRoomMessages();
    }

    function sendRoomMessageOnly() {
        const inp = document.getElementById('ctRoomInput');
        if (!inp) return;
        const text = inp.value.trim();
        if (!text) return;
        inp.value = '';
        sendTextMessage(text);
    }

    // 点右下角 ↑：有字就只发上屏；输入框为空才触发 AI 回复
    function handleSendButtonClick() {
        const inp = document.getElementById('ctRoomInput');
        const text = inp ? inp.value.trim() : '';
        if (text) {
            inp.value = '';
            sendTextMessage(text);
            return;
        }
        if (!currentThreadId) return;
        const pov = getActivePov();
        if (pov.isChar) return;
        window.dispatchEvent(new CustomEvent('phone:chat-request-reply', {
            detail: { threadId: currentThreadId }
        }));
    }

    function renderContactsTab() {
        const scroll = document.getElementById('ctMainScroll');
        const pov = getActivePov();

        if (pov.isChar) {
            const userRemark = getCharRemarkForUser(pov.charId);
            const naturalContacts = loadJSON(STORAGE_CHAR_CONTACTS_PREFIX + pov.charId, []);
            const extraList = Array.isArray(naturalContacts) ? naturalContacts : [];

            const showUser = !contactKeyword || userRemark.toLowerCase().includes(contactKeyword);
            const rows = [];
            if (showUser) {
                rows.push(`
                    <div class="ct-row" data-pov-user-dm="dm-${escapeHtml(pov.charId)}">
                        ${renderUserAvatarHtml(userRemark)}
                        <div class="ct-row-main">
                            <div class="ct-row-name">${escapeHtml(userRemark)}</div>
                        </div>
                    </div>
                `);
            }
            extraList.forEach(nc => {
                const nm = nc && nc.name ? nc.name : '好友';
                if (contactKeyword && !nm.toLowerCase().includes(contactKeyword)) return;
                rows.push(`
                    <div class="ct-row">
                        <div class="ct-avatar">${escapeHtml(nm.slice(0, 1))}</div>
                        <div class="ct-row-main">
                            <div class="ct-row-name">${escapeHtml(nm)}</div>
                        </div>
                    </div>
                `);
            });

            scroll.innerHTML = `
                <div class="ct-search-bar">
                    <div class="ct-search-wrap">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="ct-search-input" id="ctContactSearch" placeholder="搜索联系人" value="${escapeHtml(contactKeyword)}" />
                    </div>
                </div>
                ${rows.length ? '<div class="ct-flat-list">' + rows.join('') + '</div>' : '<div class="ct-empty">暂无匹配的联系人</div>'}
            `;
            hydrateUserAvatars(scroll);
            const input = document.getElementById('ctContactSearch');
            input.addEventListener('input', (e) => {
                contactKeyword = e.target.value.trim().toLowerCase();
                renderContactsTab();
                const again = document.getElementById('ctContactSearch');
                if (again) {
                    again.focus();
                    again.setSelectionRange(again.value.length, again.value.length);
                }
            });
            scroll.querySelectorAll('[data-pov-user-dm]').forEach(row => {
                row.addEventListener('click', () => {
                    openChatRoom(row.dataset.povUserDm);
                });
            });
            return;
        }

        const chars = getArchiveChars();
        const addedIds = getContactIds();
        const list = chars.filter(c => addedIds.includes(c.id))
            .filter(c => !contactKeyword || getCharDisplayName(c).toLowerCase().includes(contactKeyword));

        let bodyHtml = '';
        if (list.length === 0) {
            bodyHtml = '<div class="ct-empty">暂无匹配的联系人</div>';
        } else {
            bodyHtml = '<div class="ct-flat-list">' + list.map(c => `
                <div class="ct-row" data-contact-id="${escapeHtml(c.id)}">
                    ${renderAvatarHtml(c, false)}
                    <div class="ct-row-main">
                        <div class="ct-row-name">${escapeHtml(getCharDisplayName(c))}</div>
                    </div>
                </div>
            `).join('') + '</div>';
        }

        scroll.innerHTML = `
            <div class="ct-search-bar">
                <div class="ct-search-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input class="ct-search-input" id="ctContactSearch" placeholder="搜索联系人" value="${escapeHtml(contactKeyword)}" />
                </div>
            </div>
            ${bodyHtml}
        `;

        const input = document.getElementById('ctContactSearch');
        input.addEventListener('input', (e) => {
            contactKeyword = e.target.value.trim().toLowerCase();
            renderContactsTab();
            const again = document.getElementById('ctContactSearch');
            if (again) {
                again.focus();
                again.setSelectionRange(again.value.length, again.value.length);
            }
        });

        scroll.querySelectorAll('.ct-row[data-contact-id]').forEach(row => {
            row.addEventListener('click', () => {
                const cid = row.dataset.contactId;
                const c = chars.find(item => item.id === cid);
                if (c) openProfileModal(c);
            });
        });
    }

    function openProfileModal(c) {
        const box = document.getElementById('ctProfileContent');
        const detailText = c.persona || c.bio || '暂无补充人设';
        box.innerHTML = `
            <div class="ct-profile-head">
                ${renderAvatarHtml(c, false)}
                <div class="ct-row-main">
                    <div class="ct-row-name">${escapeHtml(getCharDisplayName(c))}</div>
                    <div class="ct-row-sub">${escapeHtml(c.handle || c.group || 'Default')}</div>
                </div>
            </div>
            <div class="ct-profile-body">${escapeHtml(detailText)}</div>
            <button class="ct-primary-btn" id="ctProfileMsgBtn">发消息</button>
        `;
        document.getElementById('ctProfileMsgBtn').addEventListener('click', () => {
            const threads = getThreads();
            let tid = 'dm-' + c.id;
            if (!threads.some(t => t.id === tid)) {
                threads.unshift({
                    id: tid,
                    type: 'dm',
                    charId: c.id,
                    name: getCharDisplayName(c),
                    lastMsg: '',
                    lastTime: ''
                });
                saveJSON(STORAGE_THREADS_KEY, threads);
            }
            document.getElementById('ctProfileModal').classList.remove('open');
            openChatRoom(tid);
        });
        document.getElementById('ctProfileModal').classList.add('open');
    }

    function renderMomentsTab() {
        const scroll = document.getElementById('ctMainScroll');
        scroll.innerHTML = `
            <div class="ct-card">
                <div class="ct-empty">朋友圈主页已就绪<br>后续可以在这里看 Char 的动态、点赞和评论</div>
            </div>
        `;
    }

    function renderMeTab() {
        const scroll = document.getElementById('ctMainScroll');
        scroll.innerHTML = `
            <div class="ct-me-card">
                <div class="ct-me-avatar">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                    <div class="ct-me-name">我</div>
                    <div class="ct-me-bio">个人资料与聊天设置将在这里管理</div>
                </div>
            </div>
            <div class="ct-card">
                <div class="ct-row"><div class="ct-row-main"><div class="ct-row-name">收藏</div></div></div>
                <div class="ct-row"><div class="ct-row-main"><div class="ct-row-name">表情包</div></div></div>
                <div class="ct-row"><div class="ct-row-main"><div class="ct-row-name">聊天设置</div></div></div>
            </div>
        `;
    }

    function renderAddContactModal() {
        const listEl = document.getElementById('ctAddContactList');
        const chars = getArchiveChars();
        const addedIds = getContactIds();
        const filtered = chars.filter(c => !modalSearchKeyword || getCharDisplayName(c).toLowerCase().includes(modalSearchKeyword));

        if (chars.length === 0) {
            listEl.innerHTML = '<div class="ct-empty">档案里还没有角色，请先去「档案」App 创建 Char</div>';
            return;
        }
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="ct-empty">没有搜到匹配的角色</div>';
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const isAdded = addedIds.includes(c.id);
            return `
                <div class="ct-pick-row">
                    <div class="ct-pick-left">
                        ${renderAvatarHtml(c, false)}
                        <div class="ct-row-main">
                            <div class="ct-row-name">${escapeHtml(getCharDisplayName(c))}</div>
                            <div class="ct-row-sub">${escapeHtml(c.group || 'Default')}</div>
                        </div>
                    </div>
                    <button class="ct-pill-btn ${isAdded ? 'done' : ''}" data-add-char="${escapeHtml(c.id)}">${isAdded ? '已添加' : '添加'}</button>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('[data-add-char]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.dataset.addChar;
                const c = chars.find(item => item.id === cid);
                if (!c) return;

                const ids = getContactIds();
                if (!ids.includes(cid)) {
                    ids.push(cid);
                    saveJSON(STORAGE_CONTACTS_KEY, ids);
                }

                const threads = getThreads();
                if (!threads.some(t => t.type === 'dm' && t.charId === cid)) {
                    threads.unshift({
                        id: 'dm-' + cid,
                        type: 'dm',
                        charId: cid,
                        name: getCharDisplayName(c),
                        lastMsg: '已添加为联系人',
                        lastTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                    });
                    saveJSON(STORAGE_THREADS_KEY, threads);
                }

                renderAddContactModal();
                renderActiveTab();
                showToast('已添加 ' + getCharDisplayName(c));
            });
        });
    }

    function renderGroupPickModal() {
        const listEl = document.getElementById('ctGroupPickList');
        const chars = getArchiveChars();
        const filtered = chars.filter(c => !modalSearchKeyword || getCharDisplayName(c).toLowerCase().includes(modalSearchKeyword));

        if (chars.length === 0) {
            listEl.innerHTML = '<div class="ct-empty">档案里还没有角色，请先去「档案」App 创建 Char</div>';
            return;
        }
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="ct-empty">没有搜到匹配的角色</div>';
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const checked = groupSelectedIds.includes(c.id);
            return `
                <div class="ct-pick-row" data-pick-char="${escapeHtml(c.id)}" style="cursor:pointer;">
                    <div class="ct-pick-left">
                        ${renderAvatarHtml(c, false)}
                        <div class="ct-row-main">
                            <div class="ct-row-name">${escapeHtml(getCharDisplayName(c))}</div>
                            <div class="ct-row-sub">${escapeHtml(c.group || 'Default')}</div>
                        </div>
                    </div>
                    <div class="ct-check-circle ${checked ? 'checked' : ''}">
                        ${checked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('[data-pick-char]').forEach(row => {
            row.addEventListener('click', () => {
                const cid = row.dataset.pickChar;
                if (groupSelectedIds.includes(cid)) {
                    groupSelectedIds = groupSelectedIds.filter(id => id !== cid);
                } else {
                    groupSelectedIds.push(cid);
                }
                renderGroupPickModal();
            });
        });
    }

    function createGroupChat() {
        if (groupSelectedIds.length < 2) {
            showToast('请至少选择 2 位成员发起群聊');
            return;
        }
        const chars = getArchiveChars();
        const selectedChars = chars.filter(c => groupSelectedIds.includes(c.id));
        const customName = document.getElementById('ctGroupNameInput').value.trim();
        const groupName = customName || selectedChars.map(c => getCharDisplayName(c)).slice(0, 3).join('、') + (selectedChars.length > 3 ? '等' : '');

        const threads = getThreads();
        threads.unshift({
            id: 'grp-' + Date.now(),
            type: 'group',
            memberIds: groupSelectedIds.slice(),
            name: groupName,
            lastMsg: `群聊已创建（${selectedChars.length}人）`,
            lastTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        });
        saveJSON(STORAGE_THREADS_KEY, threads);

        document.getElementById('ctGroupModal').classList.remove('open');
        groupSelectedIds = [];
        renderActiveTab();
        showToast('已发起群聊');
    }

    window.PhoneChat = {
        getThreads: getThreads,
        getContactIds: getContactIds,
        getCurrentThreadId: () => currentThreadId,
        setTyping: setThreadTyping,
        isTyping: isThreadTyping,
        refreshMessages: renderRoomMessages
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
