/* =========================================================
   Chat 聊天详情页 (apps/chat-details.js)
   - 拦截 #ctRoomMoreBtn，不改动 apps/chat.js
   - 聊天界面设定：优先以主题为主，想改的再单独改；「显示头像」开关与主题完全独立
   - 修复 .ct-msg-bubble 选择器，使气泡缩放、配色、字体、气泡图精准生效
   - 保护 .is-typing 状态，不覆盖顶部「对方正在输入中…」
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
    const UPLOADED_FONTS_KEY = 'phone_chat_uploaded_fonts_v1';
    const SAVED_THEMES_KEY = 'phone_chat_saved_themes_v1';

    const ALL_LANGUAGES = [
        { name: '简体中文', alias: '普通话 国语 中文 简中 zh-cn' },
        { name: '繁体中文', alias: '正体中文 中文 繁中 港台 zh-tw zh-hk' },
        { name: '文言文', alias: '古文 古汉语 古代中文' },
        { name: '粤语', alias: '广东话 广府话 白话 香港粤语 cantonese yue' },
        { name: '沪语', alias: '上海话 吴语 shanghainese' },
        { name: '吴语（苏州话）', alias: '苏白 苏州话 吴语' },
        { name: '吴语（杭州话）', alias: '杭州话 吴语' },
        { name: '吴语（宁波话）', alias: '宁波话 吴语' },
        { name: '温州话', alias: '瓯语 温州话 吴语' },
        { name: '四川话', alias: '川渝话 成都话 西南官话' },
        { name: '重庆话', alias: '渝语 川渝话 西南官话' },
        { name: '东北话', alias: '东北官话 沈阳话 哈尔滨话' },
        { name: '北京话', alias: '京片子 儿化音 北京官话' },
        { name: '天津话', alias: '卫嘴子 天津方言' },
        { name: '山东话', alias: '青岛话 济南话 胶辽官话' },
        { name: '河南话', alias: '中原官话 郑州话' },
        { name: '陕西话', alias: '关中话 西安话' },
        { name: '山西话', alias: '晋语 太原话' },
        { name: '武汉话', alias: '湖北话 楚语' },
        { name: '南京话', alias: '江淮官话 南京方言' },
        { name: '长沙话', alias: '湖南话 湘语' },
        { name: '南昌话', alias: '江西话 赣语' },
        { name: '闽南语（台语）', alias: '台语 福建话 泉漳话 厦门话 hokkien minnan' },
        { name: '潮汕话', alias: '潮州话 汕头话 闽南语' },
        { name: '福州话', alias: '闽东语 福建话' },
        { name: '莆仙话', alias: '兴化话 莆田话' },
        { name: '海南话', alias: '琼语 海南闽语' },
        { name: '客家话', alias: '客语 梅州话 hakka' },
        { name: '徽语', alias: '徽州话 安徽方言' },
        { name: '云南话', alias: '昆明话 西南官话' },
        { name: '贵州话', alias: '贵阳话 西南官话' },
        { name: '广西白话', alias: '南宁白话 桂柳话' },
        { name: '甘肃话', alias: '兰州话 西北方言' },
        { name: '青海话', alias: '西宁话 西北方言' },
        { name: '新疆话', alias: '乌鲁木齐话 兰银官话' },
        { name: '维吾尔语', alias: '维语 uyghur' },
        { name: '藏语', alias: '西藏话 tibetan' },
        { name: '蒙古语', alias: '蒙语 mongolian' },
        { name: '壮语', alias: '广西壮语 zhuang' },
        { name: '朝鲜语（延边）', alias: '延边话 朝语' },
        { name: '英语', alias: '英文 美式英语 english en' },
        { name: '英语（英式）', alias: '英音 英国英语 british uk en-gb' },
        { name: '英语（美式）', alias: '美音 美国英语 american us en-us' },
        { name: '英语（澳式）', alias: '澳音 澳洲英语 australian' },
        { name: '日语', alias: '日文 东京话 japanese ja jp' },
        { name: '日语（关西腔）', alias: '大阪话 京都话 关西弁 kansai' },
        { name: '韩语', alias: '韩文 首尔话 韩国语 korean ko kr' },
        { name: '韩语（釜山方言）', alias: '庆尚道方言 釜山话 busan' },
        { name: '法语', alias: '法文 french fr' },
        { name: '法语（魁北克）', alias: '加拿大法语 quebec' },
        { name: '德语', alias: '德文 german de' },
        { name: '德语（奥地利/瑞士）', alias: '瑞士德语 奥地利德语' },
        { name: '西班牙语', alias: '西语 spanish es' },
        { name: '西班牙语（拉美）', alias: '墨西哥西语 拉丁美洲' },
        { name: '俄语', alias: '俄文 russian ru' },
        { name: '意大利语', alias: '意语 italian it' },
        { name: '葡萄牙语', alias: '葡语 portuguese pt' },
        { name: '葡萄牙语（巴西）', alias: '巴西葡语 pt-br' },
        { name: '泰语', alias: '泰国话 thai th' },
        { name: '越南语', alias: '越语 vietnamese vi' },
        { name: '阿拉伯语', alias: '阿语 arabic ar' },
        { name: '印尼语', alias: '印度尼西亚语 indonesian id' },
        { name: '马来语', alias: '马来西亚语 malay ms' },
        { name: '菲律宾语', alias: '他加禄语 tagalog filipino' },
        { name: '缅甸语', alias: 'burmese myanmar' },
        { name: '高棉语', alias: '柬埔寨语 khmer' },
        { name: '老挝语', alias: '寮语 lao' },
        { name: '荷兰语', alias: 'dutch nl' },
        { name: '土耳其语', alias: 'turkish tr' },
        { name: '波兰语', alias: 'polish pl' },
        { name: '瑞典语', alias: 'swedish sv' },
        { name: '挪威语', alias: 'norwegian no' },
        { name: '丹麦语', alias: 'danish da' },
        { name: '芬兰语', alias: 'finnish fi' },
        { name: '冰岛语', alias: 'icelandic is' },
        { name: '希腊语', alias: 'greek el' },
        { name: '捷克语', alias: 'czech cs' },
        { name: '斯洛伐克语', alias: 'slovak sk' },
        { name: '匈牙利语', alias: 'hungarian hu' },
        { name: '罗马尼亚语', alias: 'romanian ro' },
        { name: '保加利亚语', alias: 'bulgarian bg' },
        { name: '乌克兰语', alias: 'ukrainian uk' },
        { name: '白俄罗斯语', alias: 'belarusian be' },
        { name: '塞尔维亚语', alias: 'serbian sr' },
        { name: '克罗地亚语', alias: 'croatian hr' },
        { name: '斯洛文尼亚语', alias: 'slovenian sl' },
        { name: '立陶宛语', alias: 'lithuanian lt' },
        { name: '拉脱维亚语', alias: 'latvian lv' },
        { name: '爱沙尼亚语', alias: 'estonian et' },
        { name: '爱尔兰语', alias: 'irish ga' },
        { name: '苏格兰盖尔语', alias: 'scottish gaelic' },
        { name: '威尔士语', alias: 'welsh cy' },
        { name: '加泰罗尼亚语', alias: 'catalan ca' },
        { name: '巴斯克语', alias: 'basque eu' },
        { name: '加利西亚语', alias: 'galician gl' },
        { name: '阿尔巴尼亚语', alias: 'albanian sq' },
        { name: '马耳他语', alias: 'maltese mt' },
        { name: '印地语', alias: '印度语 hindi hi' },
        { name: '乌尔都语', alias: '巴基斯坦语 urdu ur' },
        { name: '孟加拉语', alias: 'bengali bn' },
        { name: '泰米尔语', alias: 'tamil ta' },
        { name: '泰卢固语', alias: 'telugu te' },
        { name: '旁遮普语', alias: 'punjabi pa' },
        { name: '尼泊尔语', alias: 'nepali ne' },
        { name: '僧伽罗语', alias: '斯里兰卡语 sinhala' },
        { name: '波斯语', alias: '伊朗语 persian farsi fa' },
        { name: '希伯来语', alias: '以色列语 hebrew he' },
        { name: '哈萨克语', alias: 'kazakh kk' },
        { name: '乌兹别克语', alias: 'uzbek uz' },
        { name: '格鲁吉亚语', alias: 'georgian ka' },
        { name: '亚美尼亚语', alias: 'armenian hy' },
        { name: '阿塞拜疆语', alias: 'azerbaijani az' },
        { name: '斯瓦希里语', alias: 'swahili sw' },
        { name: '阿姆哈拉语', alias: '埃塞俄比亚语 amharic' },
        { name: '南非荷兰语', alias: 'afrikaans af' },
        { name: '豪萨语', alias: 'hausa' },
        { name: '约鲁巴语', alias: 'yoruba' },
        { name: '拉丁语', alias: '拉丁文 latin la' },
        { name: '古希腊语', alias: 'ancient greek' },
        { name: '梵语', alias: 'sanskrit' },
        { name: '世界语', alias: 'esperanto eo' },
        { name: '毛利语', alias: 'maori' },
        { name: '夏威夷语', alias: 'hawaiian' }
    ];

    const VOICE_PROVIDERS = [
        {
            id: 'minimax',
            label: 'MiniMax',
            cnUrl: 'https://api.minimax.chat/v1/t2a_v2',
            intlUrl: 'https://api.minimax.io/v1/t2a_v2',
            defaultModel: 'speech-02-hd',
            fallbackModels: ['speech-02-hd', 'speech-02-turbo', 'speech-2.6-hd', 'speech-2.6-turbo', 'speech-01-hd', 'speech-01-turbo'],
            needGroupId: true,
            voicePlaceholder: '音色 ID（如 male-qn-qingse）'
        },
        {
            id: 'elevenlabs',
            label: 'ElevenLabs',
            defaultUrl: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
            modelsUrl: 'https://api.elevenlabs.io/v1/models',
            defaultModel: 'eleven_multilingual_v2',
            fallbackModels: ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3'],
            needGroupId: false,
            voicePlaceholder: 'Voice ID'
        },
        {
            id: 'fish',
            label: 'Fish Audio',
            defaultUrl: 'https://api.fish.audio/v1/tts',
            defaultModel: 's2-pro',
            fallbackModels: ['s2-pro', 'speech-1.6', 'speech-1.5'],
            needGroupId: false,
            voicePlaceholder: 'Reference ID / 音色 ID'
        },
        {
            id: 'openai',
            label: 'OpenAI',
            defaultUrl: 'https://api.openai.com/v1/audio/speech',
            modelsUrl: 'https://api.openai.com/v1/models',
            defaultModel: 'gpt-4o-mini-tts',
            fallbackModels: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
            needGroupId: false,
            voicePlaceholder: '音色名（如 coral / nova / alloy）'
        },
        {
            id: 'siliconflow',
            label: '硅基流动',
            defaultUrl: 'https://api.siliconflow.cn/v1/audio/speech',
            modelsUrl: 'https://api.siliconflow.cn/v1/models?type=audio&sub_type=text-to-speech',
            defaultModel: 'FunAudioLLM/CosyVoice2-0.5B',
            fallbackModels: ['FunAudioLLM/CosyVoice2-0.5B', 'IndexTeam/IndexTTS-2', 'fishaudio/fish-speech-1.5'],
            needGroupId: false,
            voicePlaceholder: '音色 URI 或系统音色名'
        },
        {
            id: 'custom',
            label: '第三方',
            defaultUrl: '',
            defaultModel: '',
            fallbackModels: [],
            needGroupId: false,
            voicePlaceholder: '音色 ID / 名称'
        }
    ];

    let currentThreadId = null;
    let overlayEl = null;
    let rootPageEl = null;
    let subPages = {};
    let pageStack = [];
    let toastEl = null;
    let toastTimer = null;
    let activeInputEl = null;
    let blurResetTimer = null;

    const customAvatarCache = new Map();
    const avatarFrameCache = new Map();
    const bubbleImgCache = new Map();
    const loadedFontFamilies = new Set();

    let mainSearchQuery = '';
    let searchKeyword = '';
    let selectedDateStr = '';
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();

    const SVG_BACK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
    const SVG_CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
    const SVG_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`;
    const SVG_CLEAR = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    const SVG_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    const SVG_MORE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
    const SVG_GROUP = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

    const SVG_MUTE_BELL = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.4 5.2a1.6 1.6 0 0 1 3.2 0"/>
            <path d="M8.9 6.3A5.6 5.6 0 0 1 17.6 11v2.9c0 1.4.6 2.6 1.6 3.4H4.8c1-.8 1.6-2 1.6-3.4v-2.6"/>
            <path d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"/>
            <line x1="4.2" y1="4.2" x2="19.8" y2="19.8"/>
        </svg>`;

    /* ---------------- iOS Safari 键盘防遮挡与防卡死 ---------------- */
    function isCtdInput(el) {
        if (!el) return false;
        const tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
        if (el.type === 'color' || el.type === 'range') return false;
        return Boolean(el.closest('#ctDetailsOverlay, .ctd-sheet-backdrop, .ctd-modal-backdrop'));
    }

    function syncViewportForKeyboard() {
        const vv = window.visualViewport;
        const h = vv ? vv.height : window.innerHeight;
        const isKeyboardLikelyOpen = vv ? (window.innerHeight - vv.height > 90) : false;

        if (activeInputEl && isKeyboardLikelyOpen) {
            window.scrollTo(0, 0);
            if (overlayEl && overlayEl.classList.contains('open')) {
                overlayEl.style.top = '0px';
                overlayEl.style.bottom = 'auto';
                overlayEl.style.height = h + 'px';
            }
            document.querySelectorAll('.ctd-sheet-backdrop.open, .ctd-modal-backdrop.open').forEach(el => {
                el.style.top = '0px';
                el.style.height = h + 'px';
            });
            ensureInputVisibleInScroll(activeInputEl);
        } else if (!activeInputEl) {
            resetViewportContainers();
        }
    }

    function resetViewportContainers() {
        if (overlayEl) {
            overlayEl.style.top = '';
            overlayEl.style.bottom = '';
            overlayEl.style.height = '';
        }
        document.querySelectorAll('.ctd-sheet-backdrop, .ctd-modal-backdrop').forEach(el => {
            el.style.top = '';
            el.style.height = '';
        });
        window.scrollTo(0, 0);
    }

    function ensureInputVisibleInScroll(inputEl) {
        if (!inputEl) return;
        const scrollEl = inputEl.closest('.ctd-scroll');
        if (!scrollEl) return;
        requestAnimationFrame(() => {
            const containerRect = scrollEl.getBoundingClientRect();
            const inputRect = inputEl.getBoundingClientRect();
            const margin = 24;
            if (inputRect.bottom > containerRect.bottom - margin || inputRect.top < containerRect.top + margin) {
                const targetTop = scrollEl.scrollTop + (inputRect.top - containerRect.top) - Math.max(24, (containerRect.height - inputRect.height) * 0.35);
                scrollEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            }
        });
    }

    function setupKeyboardViewportFix() {
        document.addEventListener('focusin', (e) => {
            if (!isCtdInput(e.target)) return;
            clearTimeout(blurResetTimer);
            activeInputEl = e.target;
            setTimeout(() => { syncViewportForKeyboard(); ensureInputVisibleInScroll(activeInputEl); }, 80);
            setTimeout(() => { syncViewportForKeyboard(); ensureInputVisibleInScroll(activeInputEl); }, 300);
        });

        document.addEventListener('focusout', (e) => {
            if (!isCtdInput(e.target)) return;
            clearTimeout(blurResetTimer);
            blurResetTimer = setTimeout(() => {
                if (!isCtdInput(document.activeElement)) {
                    activeInputEl = null;
                    resetViewportContainers();
                }
            }, 140);
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncViewportForKeyboard);
            window.visualViewport.addEventListener('scroll', () => {
                if (activeInputEl) {
                    window.scrollTo(0, 0);
                    syncViewportForKeyboard();
                }
            });
        }
    }

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
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
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
        root.querySelectorAll('.ctd-back-btn, .ctd-top-action-btn, .ctd-icon-more-btn, .ctd-mini-reset, .ctd-profile-card, .ctd-row:not(.ctd-row-static), .ctd-switch, .ctd-cal-nav-btn, .ctd-cal-day.has-msg, .ctd-date-pill-clear, .ctd-msg-item, .ctd-sheet-btn, .ctd-modal-btn, .ctd-primary-btn, .ctd-provider-pill, .ctd-region-btn, .ctd-fetch-btn').forEach(bindPressed);
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
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
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
            translateMode: 'bundled',
            charOutputLang: '跟随预设',
            charSecondLang: '无',
            translateLang: '简体中文',
            voiceEnabled: false,
            voiceAutoPlay: false,
            voiceEmotionTag: false,
            voiceProvider: 'minimax',
            voiceMinimaxRegion: 'cn',
            voiceApiUrl: 'https://api.minimax.chat/v1/t2a_v2',
            voiceApiKey: '',
            voiceGroupId: '',
            voiceModel: 'speech-02-hd',
            voiceVoiceId: '',
            voiceSpeed: '1.0',
            voiceLoreOverride: false,
            voiceLoreIds: [],
            uiShowAvatar: true,
            uiAvatarShape: 'squircle',
            uiAvatarSize: 40,
            uiHasAvatarFrame: false,
            uiBubbleScale: 100,
            uiBubbleFontOther: '',
            uiBubbleFontMe: '',
            uiBubbleFontSize: 0,
            uiBubbleBgOther: '',
            uiBubbleTextOther: '',
            uiBubbleBgMe: '',
            uiBubbleTextMe: '',
            uiHasBubbleImg: false,
            uiActiveThemeId: '',
            stickerAssocSearch: false,
            stickerPackIds: [],
            stickerCharRead: false,
            stickerVision: false,
            stickerAllowSteal: false,
            memoryContextLimit: 30,
            memoryAutoSummary: false,
            memoryAutoEvery: 30,
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

    function getProviderMeta(id) {
        return VOICE_PROVIDERS.find(p => p.id === id) || VOICE_PROVIDERS[0];
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

    async function loadDBAsset(key, cacheMap) {
        if (!key) return '';
        if (cacheMap && cacheMap.has(key)) return cacheMap.get(key);
        if (!window.PhoneDB || typeof window.PhoneDB.get !== 'function') return '';
        try {
            const val = await window.PhoneDB.get(key);
            if (cacheMap) cacheMap.set(key, val || '');
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

    /* ---------------- 已保存 / 已导入的主题库（优先以主题为主，显示头像完全独立） ---------------- */
    function getSavedThemes() {
        const list = loadJSON(SAVED_THEMES_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function saveThemesList(list) {
        saveJSON(SAVED_THEMES_KEY, list);
    }

    function buildThemeSummary(t) {
        const parts = [];
        parts.push(`${t.uiAvatarShape === 'circle' ? '圆形' : '方圆'} ${t.uiAvatarSize || 40}px`);
        parts.push(`气泡 ${t.uiBubbleScale || 100}%`);
        if (t.uiBubbleBgOther || t.uiBubbleBgMe) parts.push('自定义配色');
        if (t.hasFrame) parts.push('含头像框');
        if (t.hasBubbleImg) parts.push('含气泡图');
        return parts.join(' · ');
    }

    async function saveCurrentAsTheme(name) {
        if (!currentThreadId) return;
        const s = getThreadSettings(currentThreadId);
        const themeId = 'theme_' + Date.now();
        const frameUrl = s.uiHasAvatarFrame ? await loadDBAsset('chat_avatar_frame_' + currentThreadId, avatarFrameCache) : '';
        const bubbleUrl = s.uiHasBubbleImg ? await loadDBAsset('chat_bubble_img_' + currentThreadId, bubbleImgCache) : '';

        if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
            if (frameUrl) await window.PhoneDB.set('chat_theme_frame_' + themeId, frameUrl);
            if (bubbleUrl) await window.PhoneDB.set('chat_theme_bubble_' + themeId, bubbleUrl);
        }

        const item = {
            id: themeId,
            name: name || '未命名主题',
            createdAt: Date.now(),
            uiAvatarShape: s.uiAvatarShape || 'squircle',
            uiAvatarSize: Number(s.uiAvatarSize) || 40,
            uiBubbleScale: Number(s.uiBubbleScale) || 100,
            uiBubbleFontOther: s.uiBubbleFontOther || '',
            uiBubbleFontMe: s.uiBubbleFontMe || '',
            uiBubbleFontSize: Number(s.uiBubbleFontSize) || 0,
            uiBubbleBgOther: s.uiBubbleBgOther || '',
            uiBubbleTextOther: s.uiBubbleTextOther || '',
            uiBubbleBgMe: s.uiBubbleBgMe || '',
            uiBubbleTextMe: s.uiBubbleTextMe || '',
            hasFrame: Boolean(frameUrl),
            hasBubbleImg: Boolean(bubbleUrl)
        };

        const list = getSavedThemes();
        list.unshift(item);
        saveThemesList(list);
        updateThreadSettings(currentThreadId, { uiActiveThemeId: themeId });
        renderThemeSubView();
        showToast(`已保存主题「${item.name}」`);
    }

    async function applySavedTheme(theme) {
        if (!currentThreadId || !theme) return;
        const frameKey = 'chat_avatar_frame_' + currentThreadId;
        const bubbleKey = 'chat_bubble_img_' + currentThreadId;

        if (window.PhoneDB && typeof window.PhoneDB.get === 'function') {
            if (theme.hasFrame) {
                const fData = await window.PhoneDB.get('chat_theme_frame_' + theme.id);
                if (fData) { await window.PhoneDB.set(frameKey, fData); avatarFrameCache.set(frameKey, fData); }
            } else {
                await window.PhoneDB.del(frameKey); avatarFrameCache.delete(frameKey);
            }
            if (theme.hasBubbleImg) {
                const bData = await window.PhoneDB.get('chat_theme_bubble_' + theme.id);
                if (bData) { await window.PhoneDB.set(bubbleKey, bData); bubbleImgCache.set(bubbleKey, bData); }
            } else {
                await window.PhoneDB.del(bubbleKey); bubbleImgCache.delete(bubbleKey);
            }
        }

        // 优先以主题为主，但不覆盖独立的「显示头像」开关
        updateThreadSettings(currentThreadId, {
            uiAvatarShape: theme.uiAvatarShape || 'squircle',
            uiAvatarSize: Number(theme.uiAvatarSize) || 40,
            uiHasAvatarFrame: Boolean(theme.hasFrame),
            uiBubbleScale: Number(theme.uiBubbleScale) || 100,
            uiBubbleFontOther: theme.uiBubbleFontOther || '',
            uiBubbleFontMe: theme.uiBubbleFontMe || '',
            uiBubbleFontSize: Number(theme.uiBubbleFontSize) || 0,
            uiBubbleBgOther: theme.uiBubbleBgOther || '',
            uiBubbleTextOther: theme.uiBubbleTextOther || '',
            uiBubbleBgMe: theme.uiBubbleBgMe || '',
            uiBubbleTextMe: theme.uiBubbleTextMe || '',
            uiHasBubbleImg: Boolean(theme.hasBubbleImg),
            uiActiveThemeId: theme.id
        });
        await applyRoomThemeStyle(currentThreadId);
        renderThemeSubView();
        showToast(`已应用主题「${theme.name}」`);
    }

    async function applyDefaultTheme() {
        if (!currentThreadId) return;
        const frameKey = 'chat_avatar_frame_' + currentThreadId;
        const bubbleKey = 'chat_bubble_img_' + currentThreadId;
        if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
            await window.PhoneDB.del(frameKey);
            await window.PhoneDB.del(bubbleKey);
        }
        avatarFrameCache.delete(frameKey);
        bubbleImgCache.delete(bubbleKey);
        // 恢复默认主题时保留独立的「显示头像」开关状态
        updateThreadSettings(currentThreadId, {
            uiAvatarShape: 'squircle',
            uiAvatarSize: 40,
            uiHasAvatarFrame: false,
            uiBubbleScale: 100,
            uiBubbleFontOther: '',
            uiBubbleFontMe: '',
            uiBubbleFontSize: 0,
            uiBubbleBgOther: '',
            uiBubbleTextOther: '',
            uiBubbleBgMe: '',
            uiBubbleTextMe: '',
            uiHasBubbleImg: false,
            uiActiveThemeId: ''
        });
        await applyRoomThemeStyle(currentThreadId);
        renderThemeSubView();
        showToast('已切换为默认主题');
    }

    async function exportSavedThemeJson(theme) {
        let frameDataUrl = '';
        let bubbleDataUrl = '';
        if (window.PhoneDB && typeof window.PhoneDB.get === 'function') {
            if (theme.hasFrame) frameDataUrl = (await window.PhoneDB.get('chat_theme_frame_' + theme.id)) || '';
            if (theme.hasBubbleImg) bubbleDataUrl = (await window.PhoneDB.get('chat_theme_bubble_' + theme.id)) || '';
        }
        const payload = Object.assign({ version: 1 }, theme, { frameDataUrl, bubbleDataUrl });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theme_${theme.name || 'chat'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('已导出主题配置');
    }

    /* ---------------- 持久化自定义字体 + 同步外观已导入字体 + 长按删除 ---------------- */
    function getUploadedFonts() {
        const list = loadJSON(UPLOADED_FONTS_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function getAppearanceFonts() {
        const result = [];
        const seen = new Set();
        const uploadedSet = new Set(getUploadedFonts().map(f => f.family));
        try {
            if (document.fonts && typeof document.fonts.forEach === 'function') {
                document.fonts.forEach(ff => {
                    const fam = (ff.family || '').replace(/^['"]|['"]$/g, '').trim();
                    if (!fam || fam.startsWith('CtdFont_') || uploadedSet.has(fam) || seen.has(fam)) return;
                    seen.add(fam);
                    result.push({ name: fam, family: fam, source: 'appearance' });
                });
            }
        } catch (e) {}
        return result;
    }

    async function ensureFontFaceLoaded(fontItem) {
        if (!fontItem || !fontItem.family || loadedFontFamilies.has(fontItem.family)) return;
        if (!window.PhoneDB || typeof window.PhoneDB.get !== 'function') return;
        try {
            const dataUrl = await window.PhoneDB.get('chat_uploaded_font_' + fontItem.id);
            if (!dataUrl) return;
            const style = document.createElement('style');
            style.textContent = `@font-face { font-family: "${fontItem.family}"; src: url("${dataUrl}"); font-display: swap; }`;
            document.head.appendChild(style);
            loadedFontFamilies.add(fontItem.family);
        } catch (e) {}
    }

    async function loadAllUploadedFonts() {
        const list = getUploadedFonts();
        for (const item of list) await ensureFontFaceLoaded(item);
    }

    function getFontLabel(val) {
        if (!val) return '跟随全局';
        const up = getUploadedFonts().find(f => f.family === val);
        if (up) return up.name;
        const ap = getAppearanceFonts().find(f => f.family === val);
        if (ap) return ap.name;
        return val;
    }

    function uploadCustomFontFile(onUploaded) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                if (!dataUrl) return;
                const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || '自定义字体';
                const id = 'uf_' + Date.now();
                const family = 'CtdFont_' + id;
                if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
                    await window.PhoneDB.set('chat_uploaded_font_' + id, dataUrl);
                }
                const list = getUploadedFonts();
                const item = { id, name: cleanName, family };
                list.unshift(item);
                saveJSON(UPLOADED_FONTS_KEY, list);
                await ensureFontFaceLoaded(item);
                showToast(`已上传字体「${cleanName}」`);
                if (typeof onUploaded === 'function') onUploaded(item);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    async function deleteUploadedFont(fontItem) {
        if (!fontItem || !fontItem.id) return;
        if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
            await window.PhoneDB.del('chat_uploaded_font_' + fontItem.id);
        }
        saveJSON(UPLOADED_FONTS_KEY, getUploadedFonts().filter(f => f.id !== fontItem.id));
        const cur = getThreadSettings(currentThreadId);
        const patch = {};
        if (cur.uiBubbleFontOther === fontItem.family) patch.uiBubbleFontOther = '';
        if (cur.uiBubbleFontMe === fontItem.family) patch.uiBubbleFontMe = '';
        if (Object.keys(patch).length) {
            updateThreadSettings(currentThreadId, patch);
            await applyRoomThemeStyle(currentThreadId);
        }
        renderThemeSubView();
        showToast(`已删除字体「${fontItem.name}」`);
    }

    /* ---------------- 表情包分组读取 ---------------- */
    function getAvailableStickerPacks() {
        const candidates = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || (!k.includes('sticker') && !k.includes('emoji') && !k.includes('meme'))) continue;
                const parsed = loadJSON(k, null);
                if (Array.isArray(parsed) && parsed.length && parsed[0] && (parsed[0].name || parsed[0].title)) {
                    candidates.push(...parsed);
                }
            }
        } catch (e) {}
        const seen = new Set();
        return candidates.filter(p => p && (p.id || p.name) && !seen.has(p.id || p.name) && seen.add(p.id || p.name));
    }

    /* ---------------- 实时应用聊天界面美化样式（精准命中 .ct-msg-bubble） ---------------- */
    async function applyRoomThemeStyle(threadId) {
        const tid = threadId || resolveActiveThreadId();
        let styleEl = document.getElementById('ctdRoomThemeStyle');
        if (!tid) {
            if (styleEl) styleEl.textContent = '';
            return;
        }
        await loadAllUploadedFonts();
        const s = getThreadSettings(tid);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'ctdRoomThemeStyle';
            document.head.appendChild(styleEl);
        }

        const avSize = Number(s.uiAvatarSize) || 40;
        const avRadius = s.uiAvatarShape === 'circle' ? '50%' : '5px';
        const scale = (Number(s.uiBubbleScale) || 100) / 100;
        const padV = Math.round(9 * scale);
        const padH = Math.round(12 * scale);
        const minH = Math.round(40 * scale);
        const tailTop = Math.max(10, Math.round(minH / 2 - 5));
        const maxW = Math.min(84, Math.max(58, Math.round(70 * scale)));
        const fontSizeRule = s.uiBubbleFontSize > 0 ? `font-size: ${s.uiBubbleFontSize}px !important;` : '';
        const fontOtherRule = s.uiBubbleFontOther ? `font-family: "${s.uiBubbleFontOther}", sans-serif !important;` : '';
        const fontMeRule = s.uiBubbleFontMe ? `font-family: "${s.uiBubbleFontMe}", sans-serif !important;` : '';

        const frameUrl = s.uiHasAvatarFrame ? await loadDBAsset('chat_avatar_frame_' + tid, avatarFrameCache) : '';
        const bubbleImgUrl = s.uiHasBubbleImg ? await loadDBAsset('chat_bubble_img_' + tid, bubbleImgCache) : '';

        let css = '';
        if (!s.uiShowAvatar) {
            css += `#app-chat #ctRoomMessages .ct-msg-avatar { display: none !important; }\n`;
            css += `#app-chat #ctRoomMessages .ct-msg-quote, #app-chat #ctRoomMessages .ct-msg-subcard { margin-left: 0 !important; margin-right: 0 !important; }\n`;
            css += `#app-chat #ctRoomMessages .ct-msg-bubble::before, #app-chat #ctRoomMessages .ct-msg-bubble::after { display: none !important; content: none !important; border: none !important; }\n`;
        } else {
            css += `#app-chat #ctRoomMessages .ct-msg-avatar { width: ${avSize}px !important; height: ${avSize}px !important; border-radius: ${avRadius} !important; position: relative !important; overflow: visible !important; }\n`;
            css += `#app-chat #ctRoomMessages .ct-msg-avatar img { border-radius: ${avRadius} !important; }\n`;
            if (frameUrl) {
                css += `#app-chat #ctRoomMessages .ct-msg-avatar::after { content: ""; position: absolute; inset: -14%; background: url("${frameUrl}") center/contain no-repeat; pointer-events: none; z-index: 3; }\n`;
            }
        }

        const bubbleSel = `#app-chat #ctRoomMessages .ct-msg-bubble:not(.ctp-img-bubble):not(.ctp-transfer-bubble):not(.ct-gift-bubble):not(.ctp-gift-bubble)`;
        const otherSel = `#app-chat #ctRoomMessages .ct-msg-row:not(.me) .ct-msg-bubble:not(.ctp-img-bubble):not(.ctp-transfer-bubble):not(.ct-gift-bubble):not(.ctp-gift-bubble)`;
        const meSel = `#app-chat #ctRoomMessages .ct-msg-row.me .ct-msg-bubble:not(.ctp-img-bubble):not(.ctp-transfer-bubble):not(.ct-gift-bubble):not(.ctp-gift-bubble)`;

        css += `${bubbleSel} { padding: ${padV}px ${padH}px !important; min-height: ${minH}px !important; max-width: ${maxW}% !important; ${fontSizeRule} }\n`;
        if (s.uiShowAvatar) {
            css += `${bubbleSel}::before { top: ${tailTop}px !important; }\n`;
        }
        if (fontOtherRule) css += `${otherSel} { ${fontOtherRule} }\n`;
        if (fontMeRule) css += `${meSel} { ${fontMeRule} }\n`;

        if (s.uiBubbleBgOther) {
            css += `${otherSel} { background-color: ${s.uiBubbleBgOther} !important; }\n`;
            if (s.uiShowAvatar) css += `${otherSel}::before { border-right-color: ${s.uiBubbleBgOther} !important; }\n`;
        }
        if (s.uiBubbleTextOther) {
            css += `${otherSel} { color: ${s.uiBubbleTextOther} !important; }\n`;
        }
        if (s.uiBubbleBgMe) {
            css += `${meSel} { background-color: ${s.uiBubbleBgMe} !important; }\n`;
            if (s.uiShowAvatar) css += `${meSel}::before, ${meSel}::after { border-left-color: ${s.uiBubbleBgMe} !important; }\n`;
        }
        if (s.uiBubbleTextMe) {
            css += `${meSel} { color: ${s.uiBubbleTextMe} !important; }\n`;
        }

        if (bubbleImgUrl) {
            css += `${bubbleSel} { background-image: url("${bubbleImgUrl}") !important; background-size: cover !important; background-position: center !important; }\n`;
            css += `${bubbleSel}::before, ${bubbleSel}::after { display: none !important; content: none !important; border: none !important; }\n`;
        }

        styleEl.textContent = css;
    }

    /* ---------------- 语音模型拉取 ---------------- */
    async function fetchVoiceModelsList(providerId, apiUrl, apiKey) {
        const meta = getProviderMeta(providerId);
        let modelsEndpoint = '';

        if (providerId === 'elevenlabs') {
            if (apiUrl && !apiUrl.includes('api.elevenlabs.io')) {
                try { modelsEndpoint = `${new URL(apiUrl).origin}/v1/models`; } catch (e) {}
            } else {
                modelsEndpoint = meta.modelsUrl;
            }
        } else if (providerId === 'openai' || providerId === 'siliconflow' || providerId === 'custom') {
            if (apiUrl) {
                try {
                    const u = new URL(apiUrl);
                    modelsEndpoint = (providerId === 'siliconflow' && u.hostname.includes('siliconflow'))
                        ? meta.modelsUrl
                        : `${u.origin}/v1/models`;
                } catch (e) {}
            } else if (meta.modelsUrl) {
                modelsEndpoint = meta.modelsUrl;
            }
        }

        if (modelsEndpoint && apiKey) {
            try {
                const headers = providerId === 'elevenlabs'
                    ? { 'xi-api-key': apiKey }
                    : { 'Authorization': `Bearer ${apiKey}` };
                const res = await fetch(modelsEndpoint, { method: 'GET', headers });
                if (res.ok) {
                    const data = await res.json();
                    let list = [];
                    if (Array.isArray(data)) list = data.map(item => item.model_id || item.id || item.name).filter(Boolean);
                    else if (data && Array.isArray(data.data)) list = data.data.map(item => item.id || item.model_id || item.name).filter(Boolean);
                    else if (data && Array.isArray(data.models)) list = data.models.map(item => item.id || item.model_id || item.name).filter(Boolean);
                    if (list.length) return { models: [...new Set(list)], source: 'remote' };
                }
            } catch (e) {}
        }

        if (meta.fallbackModels && meta.fallbackModels.length) {
            return { models: meta.fallbackModels.slice(), source: 'preset' };
        }
        return { models: [], source: 'empty' };
    }

    /* ---------------- 日期与数据读取 ---------------- */
    function toDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            return withDate ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}` : `${hh}:${mm}`;
        }
        return msg && msg.time ? msg.time : '';
    }

    function formatMsgPreview(msg) {
        if (!msg) return '';
        if (msg.type === 'image') return '[图片]';
        if (msg.type === 'voice') return msg.transcript ? `[语音] ${msg.transcript}` : '[语音消息]';
        if (msg.type === 'transfer') return `[转账] ¥${Number(msg.amount || 0).toFixed(2)}`;
        if (msg.type === 'gift') return `[礼物] ${msg.title || '送你一份心意'}`;
        if (msg.type === 'listen') return `[一起听] ${msg.songTitle || msg.text || ''}`;
        return msg.text || '';
    }

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
        const found = getAvailableApiBundles().find(b => b.id === settings.apiBundleId);
        return found ? (found.name || '已指定') : '跟随全局';
    }

    function getAvailableOnlinePresets() {
        let list = [];
        try {
            if (window.PhonePresets && typeof window.PhonePresets.getPresets === 'function') {
                list = window.PhonePresets.getPresets() || [];
            }
        } catch (e) {}
        if (!Array.isArray(list) || !list.length) list = loadJSON(PRESETS_LIST_KEY, []);
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
            if (custom) return { isCustom: true, preset: custom, label: custom.name || '未命名预设', globalName };
        }
        return { isCustom: false, preset: globalPreset, label: globalPreset ? `跟随全局（${globalName}）` : '跟随全局', globalName };
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
                if (Array.isArray(arr) && arr.length) { candidates.push(...arr); break; }
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
            if (Array.isArray(raw)) return raw.filter(m => !charId || m.charId === charId || m.targetId === charId);
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
        return { lat: Number(data.latitude), lon: Number(data.longitude), city: data.city || '', region: data.region || '' };
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
            lat: coords.lat, lon: coords.lon,
            locationText: locationText || cache.locationText || '',
            weatherText: weatherText || cache.weatherText || '',
            updatedAt: Date.now()
        };
        saveJSON(REAL_CTX_CACHE_KEY, nextCache);
        return nextCache;
    }

    /* ---------------- 聊天界面同步 ---------------- */
    function sortThreadsByPin() {
        const allSettings = getAllSettings();
        const threads = loadJSON(THREADS_KEY, []);
        if (!Array.isArray(threads) || !threads.length) return;
        const pinned = [];
        const normal = [];
        threads.forEach(t => (allSettings[t.id] && allSettings[t.id].pinned) ? pinned.push(t) : normal.push(t));
        const sorted = pinned.concat(normal);
        if (sorted.some((t, i) => threads[i] && threads[i].id !== t.id)) saveJSON(THREADS_KEY, sorted);
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
                if (nameEl && nameEl.textContent.trim() !== st.remark) nameEl.textContent = st.remark;
            }
            if (t && st.hasCustomAvatar) {
                const avData = await loadDBAsset('chat_custom_avatar_' + t.id, customAvatarCache);
                const avBox = row.querySelector('.ct-avatar');
                if (avData && avBox) {
                    let img = avBox.querySelector('img');
                    if (!img) avBox.innerHTML = `<img src="${escapeHtml(avData)}" alt="">`;
                    else if (img.src !== avData) img.src = avData;
                }
            }
        }

        const pinnedRows = rows.filter(r => r.classList.contains('ctd-pinned-row'));
        const normalRows = rows.filter(r => !r.classList.contains('ctd-pinned-row'));
        const reordered = pinnedRows.concat(normalRows);
        if (reordered.some((el, idx) => rows[idx] !== el)) reordered.forEach(el => listEl.appendChild(el));
    }

    function syncRoomTitleAndBellUI() {
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return;
        if (titleEl.classList.contains('is-typing')) return;
        const tid = resolveActiveThreadId();
        if (!tid) return;
        const thread = getThreadById(tid);
        const settings = getThreadSettings(tid);

        const targetName = getDisplayName(thread, settings);
        let bell = titleEl.querySelector('#ctRoomMuteBell');
        const currentText = Array.from(titleEl.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();

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
        const avData = await loadDBAsset('chat_custom_avatar_' + tid, customAvatarCache);
        if (!avData) return;

        msgBox.querySelectorAll('.ct-msg-row:not(.me) .ct-msg-avatar').forEach(avBox => {
            let img = avBox.querySelector('img');
            if (!img) avBox.innerHTML = `<img src="${escapeHtml(avData)}" alt="">`;
            else if (img.src !== avData) img.src = avData;
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
        if (titleEl.classList.contains('is-typing')) return null;
        const clone = titleEl.cloneNode(true);
        const bell = clone.querySelector('#ctRoomMuteBell');
        if (bell) bell.remove();
        const titleText = clone.textContent.trim();
        if (!titleText) return null;

        const allSettings = getAllSettings();
        const matched = getThreads().find(t => {
            const st = allSettings[t.id] || {};
            return (t.name || '').trim() === titleText || (st.remark || '').trim() === titleText;
        });
        if (matched) {
            currentThreadId = matched.id;
            return matched.id;
        }
        return null;
    }

    /* ---------------- 跳转并平滑滚动定位到聊天室对应消息 ---------------- */
    function jumpToMessageInRoom(msgId, msgIndex) {
        closeDetails();
        setTimeout(() => {
            const msgBox = document.getElementById('ctRoomMessages');
            if (!msgBox) return;
            let targetEl = null;
            if (msgId) {
                targetEl = msgBox.querySelector(`[data-msg-id="${CSS.escape(String(msgId))}"]`) || msgBox.querySelector(`[data-id="${CSS.escape(String(msgId))}"]`);
            }
            if (!targetEl && typeof msgIndex === 'number') {
                const rows = msgBox.querySelectorAll('.ct-msg-row');
                if (rows[msgIndex]) targetEl = rows[msgIndex];
            }
            if (!targetEl) {
                showToast('未在当前窗口找到该条消息');
                return;
            }
            const boxRect = msgBox.getBoundingClientRect();
            const elRect = targetEl.getBoundingClientRect();
            const targetTop = msgBox.scrollTop + (elRect.top - boxRect.top) - Math.max(40, (boxRect.height - elRect.height) * 0.35);
            msgBox.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            targetEl.classList.remove('ctd-msg-flash');
            void targetEl.offsetWidth;
            targetEl.classList.add('ctd-msg-flash');
            setTimeout(() => targetEl.classList.remove('ctd-msg-flash'), 1600);
        }, 260);
    }

    /* ---------------- 弹窗与动作菜单（支持长按回调） ---------------- */
    function openActionSheet({ title, desc, checkboxLabel, searchable, searchPlaceholder, allowCustomInput, onCustomSelect, actions }) {
        const backdrop = document.createElement('div');
        backdrop.className = 'ctd-sheet-backdrop';
        let isChecked = false;
        let longPressFired = false;

        const checkHtml = checkboxLabel ? `
            <div class="ctd-sheet-check-row" id="ctdSheetCheckRow">
                <div class="ctd-sheet-check-box">${SVG_CHECK}</div>
                <span class="ctd-sheet-check-text">${escapeHtml(checkboxLabel)}</span>
            </div>
        ` : '';

        const searchHtml = searchable ? `
            <div class="ctd-sheet-search-wrap">
                <input type="text" class="ctd-sheet-search-input" id="ctdSheetSearchInput" placeholder="${escapeHtml(searchPlaceholder || '搜索...')}">
            </div>
        ` : '';

        backdrop.innerHTML = `
            <div class="ctd-sheet-box">
                <div class="ctd-sheet-group ctd-sheet-main">
                    ${title ? `
                        <div class="ctd-sheet-header">
                            <div class="ctd-sheet-title">${escapeHtml(title)}</div>
                            ${desc ? `<div class="ctd-sheet-desc">${escapeHtml(desc)}</div>` : ''}
                            ${checkHtml}
                        </div>
                    ` : ''}
                    ${searchHtml}
                    <div class="ctd-sheet-list" id="ctdSheetList"></div>
                </div>
                <div class="ctd-sheet-group ctd-sheet-cancel">
                    <button type="button" class="ctd-sheet-btn cancel" data-cancel="1">取消</button>
                </div>
            </div>
        `;

        function close() {
            if (document.activeElement && backdrop.contains(document.activeElement)) document.activeElement.blur();
            activeInputEl = null;
            resetViewportContainers();
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 240);
        }

        const listBox = backdrop.querySelector('#ctdSheetList');
        function renderList(filterText) {
            const rawKw = (filterText || '').trim();
            const kw = rawKw.toLowerCase();
            const items = actions
                .map((a, idx) => ({ a, idx }))
                .filter(({ a }) => !kw || ((a.label || '') + ' ' + (a.keywords || '')).toLowerCase().includes(kw));

            let html = items.map(({ a, idx }) => `
                <button type="button" class="ctd-sheet-btn ${a.danger ? 'danger' : ''} ${a.selected ? 'selected' : ''}" data-idx="${idx}">${escapeHtml(a.label)}</button>
            `).join('');

            const exactMatch = items.some(({ a }) => (a.rawName || a.label).toLowerCase() === kw);
            if (allowCustomInput && rawKw && !exactMatch) {
                html += `<button type="button" class="ctd-sheet-btn selected" data-custom-val="${escapeHtml(rawKw)}">使用「${escapeHtml(rawKw)}」</button>`;
            }
            if (!html) html = `<div class="ctd-empty-hint" style="padding:16px;">无匹配项</div>`;
            listBox.innerHTML = html;
            bindAllPressed(listBox);

            listBox.querySelectorAll('[data-idx]').forEach(btn => {
                const idx = Number(btn.dataset.idx);
                const act = actions[idx];
                if (!act || typeof act.onLongPress !== 'function') return;
                let lpTimer = null;
                btn.addEventListener('touchstart', () => {
                    longPressFired = false;
                    lpTimer = setTimeout(() => {
                        longPressFired = true;
                        close();
                        act.onLongPress();
                    }, 420);
                }, { passive: true });
                const cancelLP = () => clearTimeout(lpTimer);
                btn.addEventListener('touchmove', cancelLP, { passive: true });
                btn.addEventListener('touchend', cancelLP, { passive: true });
                btn.addEventListener('touchcancel', cancelLP, { passive: true });
                btn.addEventListener('contextmenu', (ev) => {
                    ev.preventDefault();
                    close();
                    act.onLongPress();
                });
            });
        }

        renderList('');
        document.body.appendChild(backdrop);
        bindAllPressed(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('open'));

        const searchInput = backdrop.querySelector('#ctdSheetSearchInput');
        if (searchInput) searchInput.addEventListener('input', () => renderList(searchInput.value));

        const checkRow = backdrop.querySelector('#ctdSheetCheckRow');
        if (checkRow) {
            checkRow.addEventListener('click', (e) => {
                e.stopPropagation();
                isChecked = !isChecked;
                checkRow.classList.toggle('checked', isChecked);
            });
        }

        backdrop.addEventListener('click', (e) => {
            if (longPressFired) { longPressFired = false; return; }
            if (e.target === backdrop || e.target.closest('[data-cancel="1"]')) { close(); return; }
            const customBtn = e.target.closest('[data-custom-val]');
            if (customBtn) {
                const val = customBtn.dataset.customVal;
                close();
                if (typeof onCustomSelect === 'function') onCustomSelect(val);
                return;
            }
            const actBtn = e.target.closest('[data-idx]');
            if (actBtn) {
                const idx = Number(actBtn.dataset.idx);
                close();
                if (actions[idx] && typeof actions[idx].onClick === 'function') actions[idx].onClick(isChecked);
            }
        });
    }

    function openLanguagePicker({ title, currentVal, extraTopItem, onSelect }) {
        const items = [];
        if (extraTopItem) {
            items.push({
                rawName: extraTopItem,
                label: extraTopItem + (currentVal === extraTopItem ? ' ✓' : ''),
                keywords: extraTopItem,
                selected: currentVal === extraTopItem,
                onClick: () => onSelect(extraTopItem)
            });
        }
        ALL_LANGUAGES.forEach(lang => {
            items.push({
                rawName: lang.name,
                label: lang.name + (currentVal === lang.name ? ' ✓' : ''),
                keywords: lang.alias || '',
                selected: currentVal === lang.name,
                onClick: () => onSelect(lang.name)
            });
        });

        openActionSheet({
            title,
            searchable: true,
            searchPlaceholder: '搜索任意语言或方言...',
            allowCustomInput: true,
            onCustomSelect: (val) => onSelect(val),
            actions: items
        });
    }

    function openBubbleFontPicker(fieldKey, title) {
        const cur = getThreadSettings(currentThreadId);
        const currentFamily = cur[fieldKey] || '';
        const uploaded = getUploadedFonts();
        const appearanceFonts = getAppearanceFonts();

        const actions = [
            {
                label: '跟随全局' + (!currentFamily ? ' ✓' : ''),
                selected: !currentFamily,
                onClick: async () => {
                    updateThreadSettings(currentThreadId, { [fieldKey]: '' });
                    await applyRoomThemeStyle(currentThreadId);
                    renderThemeSubView();
                }
            }
        ];

        appearanceFonts.forEach(f => {
            actions.push({
                label: `${f.name}（外观）` + (currentFamily === f.family ? ' ✓' : ''),
                selected: currentFamily === f.family,
                onClick: async () => {
                    updateThreadSettings(currentThreadId, { [fieldKey]: f.family });
                    await applyRoomThemeStyle(currentThreadId);
                    renderThemeSubView();
                }
            });
        });

        uploaded.forEach(f => {
            actions.push({
                label: f.name + (currentFamily === f.family ? ' ✓' : ''),
                selected: currentFamily === f.family,
                onClick: async () => {
                    await ensureFontFaceLoaded(f);
                    updateThreadSettings(currentThreadId, { [fieldKey]: f.family });
                    await applyRoomThemeStyle(currentThreadId);
                    renderThemeSubView();
                },
                onLongPress: () => {
                    openActionSheet({
                        title: `删除字体「${f.name}」`,
                        desc: '删除后不可恢复，使用该字体的气泡将恢复跟随全局。',
                        actions: [{
                            label: '确认删除',
                            danger: true,
                            onClick: () => deleteUploadedFont(f)
                        }]
                    });
                }
            });
        });

        actions.push({
            label: '+ 上传字体文件（.ttf / .otf / .woff2）',
            onClick: () => {
                uploadCustomFontFile(async (newFont) => {
                    updateThreadSettings(currentThreadId, { [fieldKey]: newFont.family });
                    await applyRoomThemeStyle(currentThreadId);
                    renderThemeSubView();
                });
            }
        });

        openActionSheet({
            title,
            desc: uploaded.length ? '长按已上传字体可删除' : '',
            actions
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
            if (input) input.blur();
            activeInputEl = null;
            resetViewportContainers();
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

    /* ---------------- DOM 构建与多级页面栈 ---------------- */
    function buildSubPage(id, title, scrollId, rightActionHtml) {
        return `
            <div class="ctd-page" id="${id}">
                <div class="ctd-topbar">
                    <button type="button" class="ctd-back-btn" data-sub-back="${id}">${SVG_BACK}</button>
                    <div class="ctd-title">${title}</div>
                    ${rightActionHtml || ''}
                </div>
                <div class="ctd-scroll" id="${scrollId}"></div>
            </div>
        `;
    }

    function ensureOverlayDOM() {
        if (overlayEl) return;
        const appChat = document.getElementById('app-chat');
        const mountParent = (appChat && appChat.parentElement) ? appChat.parentElement : document.body;

        const themeRightHtml = `
            <div class="ctd-top-actions">
                <button type="button" class="ctd-top-action-btn" id="ctdThemeImportBtn">导入</button>
                <button type="button" class="ctd-top-action-btn primary" id="ctdThemeSaveBtn">保存</button>
            </div>
        `;

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
            ${buildSubPage('ctDetailsVoiceLoreView', '语音模型世界书', 'ctdVoiceLoreScroll')}
            ${buildSubPage('ctDetailsStickerView', '表情包', 'ctdStickerScroll')}
            ${buildSubPage('ctDetailsStickerPackView', '挂载表情包', 'ctdStickerPackScroll')}
            ${buildSubPage('ctDetailsThemeView', '聊天界面设定', 'ctdThemeScroll', themeRightHtml)}
            ${buildSubPage('ctDetailsMemoryView', '记忆宫殿', 'ctdMemoryScroll')}
        `;
        mountParent.appendChild(overlayEl);

        rootPageEl = document.getElementById('ctDetailsMainView');
        [
            'ctDetailsProfileView', 'ctDetailsSearchView', 'ctDetailsApiView',
            'ctDetailsCotView', 'ctDetailsPresetView', 'ctDetailsLoreView',
            'ctDetailsVoiceView', 'ctDetailsVoiceLoreView', 'ctDetailsStickerView',
            'ctDetailsStickerPackView', 'ctDetailsThemeView', 'ctDetailsMemoryView'
        ].forEach(id => {
            subPages[id] = document.getElementById(id);
        });

        document.getElementById('ctdBackBtn').addEventListener('click', closeDetails);
        overlayEl.querySelectorAll('[data-sub-back]').forEach(btn => {
            btn.addEventListener('click', () => popSubPage());
        });
        document.getElementById('ctdThemeImportBtn').addEventListener('click', () => openThemeImportMenu());
        document.getElementById('ctdThemeSaveBtn').addEventListener('click', () => {
            openInputModal({
                title: '保存当前主题',
                value: '',
                placeholder: '输入主题名称',
                onConfirm: (name) => {
                    if (!name) return;
                    saveCurrentAsTheme(name);
                }
            });
        });
        bindAllPressed(overlayEl);
    }

    function pushSubPage(pageEl) {
        if (!pageEl) return;
        const prevTop = pageStack.length ? pageStack[pageStack.length - 1] : rootPageEl;
        if (prevTop) prevTop.classList.add('is-behind');
        pageEl.classList.remove('is-behind');
        pageEl.classList.add('open');
        pageStack.push(pageEl);
    }

    function popSubPage() {
        if (!pageStack.length) return;
        const top = pageStack.pop();
        if (document.activeElement && top.contains(document.activeElement)) document.activeElement.blur();
        activeInputEl = null;
        resetViewportContainers();
        top.classList.remove('open');
        const nextTop = pageStack.length ? pageStack[pageStack.length - 1] : rootPageEl;
        if (nextTop) nextTop.classList.remove('is-behind');
        if (nextTop === rootPageEl) renderMainView();
        else if (nextTop === subPages.ctDetailsStickerView) renderStickerSubView();
    }

    async function openDetails(threadId) {
        currentThreadId = threadId || resolveActiveThreadId();
        if (!currentThreadId) return;
        ensureOverlayDOM();
        mainSearchQuery = '';
        pageStack = [];
        Object.values(subPages).forEach(p => { p.classList.remove('open'); p.classList.remove('is-behind'); });
        rootPageEl.classList.remove('is-behind');
        await renderMainView();
        requestAnimationFrame(() => overlayEl.classList.add('open'));
    }

    function closeDetails() {
        if (!overlayEl) return;
        if (document.activeElement && overlayEl.contains(document.activeElement)) document.activeElement.blur();
        activeInputEl = null;
        resetViewportContainers();
        overlayEl.classList.remove('open');
        pageStack = [];
        Object.values(subPages).forEach(p => { p.classList.remove('open'); p.classList.remove('is-behind'); });
        rootPageEl.classList.remove('is-behind');
    }

    /* ---------------- 主详情页渲染 ---------------- */
    function buildSearchableIndex(thread, settings) {
        return [
            { title: '资料设置（修改备注 / 修改头像）', kw: '备注 头像 资料 群名', action: () => { renderProfileSubView(); pushSubPage(subPages.ctDetailsProfileView); } },
            { title: '置顶聊天', kw: '置顶 排序', action: () => { const n = updateThreadSettings(currentThreadId, { pinned: !settings.pinned }); sortThreadsByPin(); showToast(n.pinned ? '已置顶该聊天' : '已取消置顶'); renderMainBody(); } },
            { title: '消息免打扰', kw: '免打扰 静音 铃铛', action: () => { const n = updateThreadSettings(currentThreadId, { muted: !settings.muted }); syncRoomTitleAndBellUI(); showToast(n.muted ? '已开启消息免打扰' : '已关闭消息免打扰'); renderMainBody(); } },
            { title: '聊天背景', kw: '背景 壁纸 图片', action: () => pickChatBackground() },
            { title: '查找聊天记录 / 感知真实时间', kw: '查找 搜索 记录 历史 日历 真实时间', action: () => { searchKeyword = ''; selectedDateStr = ''; renderSearchView(); pushSubPage(subPages.ctDetailsSearchView); } },
            { title: '感知真实天气 / 感知真实地点', kw: '天气 地点 位置 定位 实时', action: () => { mainSearchQuery = ''; renderMainView(); } },
            { title: '独立 API', kw: 'api 接口 模型 独立', action: () => { renderApiSubView(); pushSubPage(subPages.ctDetailsApiView); } },
            { title: '专属思维链', kw: '思维链 cot 思考', action: () => { renderCotSubView(); pushSubPage(subPages.ctDetailsCotView); } },
            { title: '专属预设', kw: '预设 提示词 prompt', action: () => { renderPresetView(); pushSubPage(subPages.ctDetailsPresetView); } },
            { title: '单独挂载世界书', kw: '世界书 设定集 lorebook', action: () => { renderLoreView(); pushSubPage(subPages.ctDetailsLoreView); } },
            { title: '语言与翻译', kw: '翻译 模式 独立翻译 语言 简中 繁中 粤语 沪语 方言', action: () => { mainSearchQuery = ''; renderMainView(); } },
            { title: '启用语音模型', kw: '语音 tts minimax elevenlabs fish openai 硅基 播放 情绪', action: () => { renderVoiceSubView(); pushSubPage(subPages.ctDetailsVoiceView); } },
            { title: '语音模型世界书', kw: '语音 世界书 音色', action: () => { renderVoiceLoreView(); pushSubPage(subPages.ctDetailsVoiceLoreView); } },
            { title: '表情包（联想搜图 / 挂载 / 识取 / 读取 / 偷表情包）', kw: '表情包 搜图 挂载 识取 读取 偷', action: () => { renderStickerSubView(); pushSubPage(subPages.ctDetailsStickerView); } },
            { title: '聊天界面设定（头像 / 颜色 / 气泡 / 字体 / 主题）', kw: '界面 设定 美化 气泡 颜色 底色 字色 头像 头像框 字体 导入 保存 主题 png', action: () => { renderThemeSubView(); pushSubPage(subPages.ctDetailsThemeView); } },
            { title: '记忆宫殿（上下文条数 / 自动总结 / 长期记忆）', kw: '记忆 宫殿 上下文 轮数 总结 长期记忆', action: () => { renderMemorySubView(); pushSubPage(subPages.ctDetailsMemoryView); } },
            { title: '拉黑', kw: '拉黑 黑名单 屏蔽', action: () => triggerBlockSheet(thread) },
            { title: '导出聊天记录', kw: '导出 备份 json', action: () => exportThreadMessages(thread) },
            { title: '导入聊天记录', kw: '导入 恢复 json', action: () => importThreadMessages() },
            { title: '清空聊天记录', kw: '清空 删除 聊天记录 记忆', action: () => triggerClearSheet(thread) }
        ];
    }

    async function renderMainView() {
        const scrollEl = document.getElementById('ctdMainScroll');
        if (!scrollEl || !currentThreadId) return;

        scrollEl.innerHTML = `
            <div class="ctd-search-box">
                <span class="ctd-search-icon">${SVG_SEARCH}</span>
                <input type="text" class="ctd-search-input" id="ctdMainSearchInput" placeholder="搜索详情设置项..." value="${escapeHtml(mainSearchQuery)}">
                <button type="button" class="ctd-search-clear ${mainSearchQuery ? 'visible' : ''}" id="ctdMainSearchClear">${SVG_CLEAR}</button>
            </div>
            <div id="ctdMainBodySlot" style="display:flex;flex-direction:column;gap:16px;"></div>
        `;

        const inputEl = document.getElementById('ctdMainSearchInput');
        const clearBtn = document.getElementById('ctdMainSearchClear');
        inputEl.addEventListener('input', () => {
            mainSearchQuery = inputEl.value.trim();
            clearBtn.classList.toggle('visible', Boolean(mainSearchQuery));
            renderMainBody();
        });
        clearBtn.addEventListener('click', () => {
            mainSearchQuery = '';
            inputEl.value = '';
            clearBtn.classList.remove('visible');
            renderMainBody();
        });

        await renderMainBody();
    }

    async function renderMainBody() {
        const bodySlot = document.getElementById('ctdMainBodySlot');
        if (!bodySlot || !currentThreadId) return;

        const thread = getThreadById(currentThreadId);
        const settings = getThreadSettings(currentThreadId);

        if (mainSearchQuery) {
            const kw = mainSearchQuery.toLowerCase();
            const index = buildSearchableIndex(thread, settings);
            const matched = index.filter(item => (item.title + ' ' + item.kw).toLowerCase().includes(kw));
            if (!matched.length) {
                bodySlot.innerHTML = `<div class="ctd-empty-hint">未找到相关设置项</div>`;
                return;
            }
            bodySlot.innerHTML = `<div class="ctd-card">` + matched.map((item, i) => `
                <div class="ctd-row ctd-main-hit" data-hit-idx="${i}">
                    <div class="ctd-row-left"><div class="ctd-row-title">${escapeHtml(item.title)}</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            `).join('') + `</div>`;
            bindAllPressed(bodySlot);
            bodySlot.querySelectorAll('.ctd-main-hit').forEach(row => {
                row.addEventListener('click', () => {
                    const hit = matched[Number(row.dataset.hitIdx)];
                    if (hit && typeof hit.action === 'function') hit.action();
                });
            });
            return;
        }

        const cache = getRealContextCache();
        const isGroup = thread && thread.type === 'group';
        const displayName = getDisplayName(thread, settings);
        const customAv = settings.hasCustomAvatar ? await loadDBAsset('chat_custom_avatar_' + currentThreadId, customAvatarCache) : '';

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
                            <div class="ctd-profile-sub">共 ${memberIds.length} 位成员</div>
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
                            <div class="ctd-profile-sub">备注与头像</div>
                        </div>
                        <div class="ctd-chevron">${SVG_CHEVRON}</div>
                    </div>
                </div>
            `;
        }

        const basicCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">置顶聊天</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.pinned ? 'on' : ''}" id="ctdPinSwitch" aria-label="置顶聊天"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">消息免打扰</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.muted ? 'on' : ''}" id="ctdMuteSwitch" aria-label="消息免打扰"></button></div>
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

        const searchCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSearchEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">查找聊天记录</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
        `;

        const weatherSub = settings.realWeather ? (cache.weatherText || '同步中...') : '';
        const locationSub = settings.realLocation ? (cache.locationText || '同步中...') : '';
        const realEnvCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实天气</div>
                        ${weatherSub ? `<div class="ctd-row-sub">${escapeHtml(weatherSub)}</div>` : ''}
                    </div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.realWeather ? 'on' : ''}" id="ctdWeatherSwitch" aria-label="感知真实天气"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实地点</div>
                        ${locationSub ? `<div class="ctd-row-sub">${escapeHtml(locationSub)}</div>` : ''}
                    </div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.realLocation ? 'on' : ''}" id="ctdLocationSwitch" aria-label="感知真实地点"></button></div>
                </div>
            </div>
        `;

        const apiCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdApiEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">独立 API</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(getApiDisplayLabel(settings))}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const cotLabel = settings.cotShow ? '已开启' : (settings.cotCustom ? '已自定义' : '默认');
        const presetInfo = getPresetDisplayInfo(settings);
        const loreCount = Array.isArray(settings.loreIds) ? settings.loreIds.length : 0;
        const loreStatusText = settings.loreOverride ? `已选 ${loreCount} 本` : '跟随全局';
        const coreCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdCotEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">专属思维链</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(cotLabel)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdPresetEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">专属预设</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(presetInfo.label)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdLoreEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">单独挂载世界书</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(loreStatusText)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const isApiTrans = settings.translateMode === 'api';
        const langCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动展开翻译</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.autoTranslate ? 'on' : ''}" id="ctdAutoTransSwitch" aria-label="自动展开翻译"></button></div>
                </div>
                <div class="ctd-row" id="ctdTransModeRow">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">翻译方式</div>
                        ${isApiTrans ? `<div class="ctd-token-note">使用独立翻译接口将额外发起一次调用，将产生额外 Token 消耗</div>` : ''}
                    </div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${isApiTrans ? '独立翻译 API' : '随主回复生成'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
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
                        <span class="ctd-row-value">${escapeHtml(settings.translateLang || '简体中文')}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const providerMeta = getProviderMeta(settings.voiceProvider);
        const voiceStatus = settings.voiceEnabled ? providerMeta.label : '未开启';
        const voiceLoreCount = Array.isArray(settings.voiceLoreIds) ? settings.voiceLoreIds.length : 0;
        const voiceLoreStatus = settings.voiceLoreOverride ? `已选 ${voiceLoreCount} 本` : '未挂载';
        const voiceCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdVoiceEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">启用语音模型</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(voiceStatus)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdVoiceLoreEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">语音模型世界书</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(voiceLoreStatus)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const packCount = Array.isArray(settings.stickerPackIds) ? settings.stickerPackIds.length : 0;
        const stickerSummary = packCount ? `已挂载 ${packCount} 组` : (settings.stickerAssocSearch || settings.stickerVision ? '已启用' : '默认');
        const stickerEntryCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdStickerEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">表情包</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(stickerSummary)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const activeThemeObj = settings.uiActiveThemeId ? getSavedThemes().find(t => t.id === settings.uiActiveThemeId) : null;
        const hasCustomUi = settings.uiHasAvatarFrame || settings.uiHasBubbleImg || settings.uiBubbleFontOther || settings.uiBubbleFontMe || settings.uiBubbleBgOther || settings.uiBubbleBgMe;
        const themeLabel = activeThemeObj ? activeThemeObj.name : (hasCustomUi ? '已自定义' : '默认');
        const themeCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdThemeEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">聊天界面设定</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(themeLabel)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const memCount = getCharMemories(thread).length;
        const memSummary = memCount ? `${memCount} 条` : (settings.memoryAutoSummary ? '自动总结' : '暂无');
        const memoryCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdMemoryEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">记忆宫殿</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(memSummary)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        const blockCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ${settings.blocked ? 'ctd-row-center' : 'ctd-row-danger'}" id="ctdBlockRow">
                    <div class="ctd-row-title">${settings.blocked ? '已拉黑（点击解除）' : '拉黑'}</div>
                </div>
            </div>
        `;

        const ioCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdExportRow"><div class="ctd-row-title">导出聊天记录</div></div>
                <div class="ctd-row ctd-row-danger" id="ctdImportRow"><div class="ctd-row-title">导入聊天记录</div></div>
            </div>
        `;

        const clearCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdClearChatRow"><div class="ctd-row-title">清空聊天记录</div></div>
            </div>
        `;

        bodySlot.innerHTML =
            profileHtml + basicCardHtml + searchCardHtml + realEnvCardHtml +
            apiCardHtml + coreCardHtml + langCardHtml + voiceCardHtml +
            stickerEntryCardHtml + themeCardHtml + memoryCardHtml + blockCardHtml +
            ioCardHtml + clearCardHtml;

        bindAllPressed(bodySlot);
        bindMainViewEvents(thread);
    }

    function triggerBlockSheet(thread) {
        const cur = getThreadSettings(currentThreadId);
        const name = getDisplayName(thread, cur);
        if (cur.blocked) {
            openActionSheet({
                title: '解除拉黑',
                desc: `确定将「${name}」移出黑名单吗？`,
                actions: [{ label: '解除拉黑', onClick: () => { updateThreadSettings(currentThreadId, { blocked: false }); renderMainBody(); showToast('已解除拉黑'); } }]
            });
        } else {
            openActionSheet({
                title: '拉黑联系人',
                desc: `确定拉黑「${name}」吗？拉黑后将不再向其发送或接收消息。`,
                actions: [{ label: '确认拉黑', danger: true, onClick: () => { updateThreadSettings(currentThreadId, { blocked: true }); renderMainBody(); showToast('已拉黑该联系人'); } }]
            });
        }
    }

    function triggerClearSheet(thread) {
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
                    if (alsoClearMemory) { clearCharMemories(thread); showToast('已清空聊天记录与角色记忆'); }
                    else showToast('已清空聊天记录');
                    renderMainBody();
                }
            }]
        });
    }

    function bindMainViewEvents(thread) {
        document.getElementById('ctdProfileCardEntry').addEventListener('click', () => { renderProfileSubView(); pushSubPage(subPages.ctDetailsProfileView); });
        document.getElementById('ctdPinSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { pinned: !cur.pinned });
            e.currentTarget.classList.toggle('on', next.pinned);
            sortThreadsByPin();
            showToast(next.pinned ? '已置顶该聊天' : '已取消置顶');
        });
        document.getElementById('ctdMuteSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { muted: !cur.muted });
            e.currentTarget.classList.toggle('on', next.muted);
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
                            if (window.PhoneDB && typeof window.PhoneDB.del === 'function') await window.PhoneDB.del('chat_bg_' + currentThreadId);
                            updateThreadSettings(currentThreadId, { hasBg: false });
                            await syncRoomBackgroundUI();
                            renderMainBody();
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
            pushSubPage(subPages.ctDetailsSearchView);
        });
        document.getElementById('ctdWeatherSwitch').addEventListener('click', async (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const enable = !cur.realWeather;
            updateThreadSettings(currentThreadId, { realWeather: enable });
            e.currentTarget.classList.toggle('on', enable);
            renderMainBody();
            if (enable) {
                try { await refreshRealContext(cur.realLocation, true); renderMainBody(); showToast('已开启实时天气感知'); }
                catch (err) { showToast('未能获取天气信息'); }
            } else showToast('已关闭实时天气感知');
        });
        document.getElementById('ctdLocationSwitch').addEventListener('click', async (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const enable = !cur.realLocation;
            updateThreadSettings(currentThreadId, { realLocation: enable });
            e.currentTarget.classList.toggle('on', enable);
            renderMainBody();
            if (enable) {
                try { await refreshRealContext(true, cur.realWeather); renderMainBody(); showToast('已开启实时地点感知'); }
                catch (err) { showToast('未能获取位置信息'); }
            } else showToast('已关闭实时地点感知');
        });

        document.getElementById('ctdApiEntryRow').addEventListener('click', () => { renderApiSubView(); pushSubPage(subPages.ctDetailsApiView); });
        document.getElementById('ctdCotEntryRow').addEventListener('click', () => { renderCotSubView(); pushSubPage(subPages.ctDetailsCotView); });
        document.getElementById('ctdPresetEntryRow').addEventListener('click', () => { renderPresetView(); pushSubPage(subPages.ctDetailsPresetView); });
        document.getElementById('ctdLoreEntryRow').addEventListener('click', () => { renderLoreView(); pushSubPage(subPages.ctDetailsLoreView); });

        document.getElementById('ctdAutoTransSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { autoTranslate: !cur.autoTranslate });
            e.currentTarget.classList.toggle('on', next.autoTranslate);
            showToast(next.autoTranslate ? '已开启自动展开翻译' : '已关闭自动展开翻译');
        });
        document.getElementById('ctdTransModeRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openActionSheet({
                title: '选择翻译方式',
                actions: [
                    {
                        label: '随主回复生成（不额外调用）' + (cur.translateMode !== 'api' ? ' ✓' : ''),
                        selected: cur.translateMode !== 'api',
                        onClick: () => { updateThreadSettings(currentThreadId, { translateMode: 'bundled' }); renderMainBody(); }
                    },
                    {
                        label: '独立翻译 API（读取「API」翻译配置）' + (cur.translateMode === 'api' ? ' ✓' : ''),
                        selected: cur.translateMode === 'api',
                        onClick: () => { updateThreadSettings(currentThreadId, { translateMode: 'api' }); renderMainBody(); }
                    }
                ]
            });
        });
        document.getElementById('ctdOutLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openLanguagePicker({
                title: '选择角色输出语言',
                currentVal: cur.charOutputLang || '跟随预设',
                extraTopItem: '跟随预设',
                onSelect: (lang) => { updateThreadSettings(currentThreadId, { charOutputLang: lang }); renderMainBody(); }
            });
        });
        document.getElementById('ctdSecondLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openLanguagePicker({
                title: '选择角色第二语言',
                currentVal: cur.charSecondLang || '无',
                extraTopItem: '无',
                onSelect: (lang) => { updateThreadSettings(currentThreadId, { charSecondLang: lang }); renderMainBody(); }
            });
        });
        document.getElementById('ctdTransLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openLanguagePicker({
                title: '选择翻译语言',
                currentVal: cur.translateLang || '简体中文',
                extraTopItem: null,
                onSelect: (lang) => { updateThreadSettings(currentThreadId, { translateLang: lang }); renderMainBody(); }
            });
        });

        document.getElementById('ctdVoiceEntryRow').addEventListener('click', () => { renderVoiceSubView(); pushSubPage(subPages.ctDetailsVoiceView); });
        document.getElementById('ctdVoiceLoreEntryRow').addEventListener('click', () => { renderVoiceLoreView(); pushSubPage(subPages.ctDetailsVoiceLoreView); });
        document.getElementById('ctdStickerEntryRow').addEventListener('click', () => { renderStickerSubView(); pushSubPage(subPages.ctDetailsStickerView); });
        document.getElementById('ctdThemeEntryRow').addEventListener('click', () => { renderThemeSubView(); pushSubPage(subPages.ctDetailsThemeView); });
        document.getElementById('ctdMemoryEntryRow').addEventListener('click', () => { renderMemorySubView(); pushSubPage(subPages.ctDetailsMemoryView); });
        document.getElementById('ctdBlockRow').addEventListener('click', () => triggerBlockSheet(thread));
        document.getElementById('ctdExportRow').addEventListener('click', () => exportThreadMessages(thread));
        document.getElementById('ctdImportRow').addEventListener('click', () => importThreadMessages());
        document.getElementById('ctdClearChatRow').addEventListener('click', () => triggerClearSheet(thread));
    }

    /* ---------------- 二级页：记忆宫殿 ---------------- */
    function renderMemorySubView() {
        const scrollEl = document.getElementById('ctdMemoryScroll');
        if (!scrollEl || !currentThreadId) return;
        const thread = getThreadById(currentThreadId);
        const s = getThreadSettings(currentThreadId);
        const memories = getCharMemories(thread);
        const ctxLimit = Number(s.memoryContextLimit) || 30;
        const autoEvery = Number(s.memoryAutoEvery) || 30;

        let listHtml = '';
        if (!memories.length) {
            listHtml = `<div class="ctd-empty-hint">当前角色暂无已归档的长期记忆</div>`;
        } else {
            listHtml = `<div class="ctd-section-label">已归档长期记忆（${memories.length} 条）</div><div class="ctd-msg-list">` + memories.map(m => `
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
                <div class="ctd-slider-row">
                    <div class="ctd-slider-head">
                        <span class="ctd-row-title">携带上下文条数</span>
                        <span class="ctd-row-value" id="ctdCtxLimitVal">${ctxLimit} 条</span>
                    </div>
                    <input type="range" class="ctd-range" id="ctdCtxLimitRange" min="10" max="200" step="10" value="${ctxLimit}">
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">自动总结进记忆宫殿</div>
                        <div class="ctd-token-note">达到设定条数时将额外发起一次总结调用，将产生额外 Token 消耗</div>
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${s.memoryAutoSummary ? 'on' : ''}" id="ctdMemAutoSw" aria-label="自动总结进记忆宫殿"></button>
                    </div>
                </div>
                ${s.memoryAutoSummary ? `
                    <div class="ctd-row" id="ctdMemEveryRow">
                        <div class="ctd-row-left"><div class="ctd-row-title">自动总结频率</div></div>
                        <div class="ctd-row-right">
                            <span class="ctd-row-value">每满 ${autoEvery} 条</span>
                            <span class="ctd-chevron">${SVG_CHEVRON}</span>
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="ctd-card">
                <div class="ctd-row" id="ctdOpenMemoryAppRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">前往「记忆」管理</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
            ${listHtml}
        `;
        bindAllPressed(scrollEl);

        const ctxRange = document.getElementById('ctdCtxLimitRange');
        ctxRange.addEventListener('input', () => { document.getElementById('ctdCtxLimitVal').textContent = ctxRange.value + ' 条'; });
        ctxRange.addEventListener('change', () => {
            updateThreadSettings(currentThreadId, { memoryContextLimit: Number(ctxRange.value) });
        });

        document.getElementById('ctdMemAutoSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            updateThreadSettings(currentThreadId, { memoryAutoSummary: !cur.memoryAutoSummary });
            renderMemorySubView();
        });

        const everyRow = document.getElementById('ctdMemEveryRow');
        if (everyRow) {
            everyRow.addEventListener('click', () => {
                const cur = getThreadSettings(currentThreadId);
                const opts = [20, 30, 50, 80, 100];
                openActionSheet({
                    title: '选择自动总结频率',
                    actions: opts.map(n => ({
                        label: `每满 ${n} 条消息` + (cur.memoryAutoEvery === n ? ' ✓' : ''),
                        selected: cur.memoryAutoEvery === n,
                        onClick: () => {
                            updateThreadSettings(currentThreadId, { memoryAutoEvery: n });
                            renderMemorySubView();
                        }
                    }))
                });
            });
        }

        document.getElementById('ctdOpenMemoryAppRow').addEventListener('click', () => {
            closeDetails();
            if (typeof window.openApp === 'function') window.openApp('memory');
            else { const icon = document.querySelector('[data-app="memory"]'); if (icon) icon.click(); }
        });
    }

    /* ---------------- 二级页：表情包 ---------------- */
    function renderStickerSubView() {
        const scrollEl = document.getElementById('ctdStickerScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const packCount = Array.isArray(settings.stickerPackIds) ? settings.stickerPackIds.length : 0;

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">联想搜图</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.stickerAssocSearch ? 'on' : ''}" id="ctdSubStickerAssocSw" aria-label="联想搜图"></button></div>
                </div>
                <div class="ctd-row" id="ctdSubStickerPackRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">挂载表情包</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${packCount ? `已选 ${packCount} 组` : '未挂载'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">表情包识取</div>
                        <div class="ctd-token-note">调用视觉模型识别并理解表情包图片内容，需额外发起一次调用，将产生额外 Token 消耗</div>
                    </div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.stickerVision ? 'on' : ''}" id="ctdSubStickerVisionSw" aria-label="表情包识取"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">角色读取挂载的表情包</div>
                        <div class="ctd-row-sub">仅读取已挂载表情包的名称与标签清单供角色选用，不解析图片画面</div>
                    </div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.stickerCharRead ? 'on' : ''}" id="ctdSubStickerReadSw" aria-label="角色读取挂载的表情包"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">允许偷我的表情包</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.stickerAllowSteal ? 'on' : ''}" id="ctdSubStickerStealSw" aria-label="允许偷我的表情包"></button></div>
                </div>
            </div>
        `;
        bindAllPressed(scrollEl);

        document.getElementById('ctdSubStickerAssocSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { stickerAssocSearch: !cur.stickerAssocSearch });
            e.currentTarget.classList.toggle('on', next.stickerAssocSearch);
        });
        document.getElementById('ctdSubStickerPackRow').addEventListener('click', () => { renderStickerPackSubView(); pushSubPage(subPages.ctDetailsStickerPackView); });
        document.getElementById('ctdSubStickerVisionSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { stickerVision: !cur.stickerVision });
            e.currentTarget.classList.toggle('on', next.stickerVision);
        });
        document.getElementById('ctdSubStickerReadSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { stickerCharRead: !cur.stickerCharRead });
            e.currentTarget.classList.toggle('on', next.stickerCharRead);
        });
        document.getElementById('ctdSubStickerStealSw').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { stickerAllowSteal: !cur.stickerAllowSteal });
            e.currentTarget.classList.toggle('on', next.stickerAllowSteal);
        });
    }

    function renderStickerPackSubView() {
        const scrollEl = document.getElementById('ctdStickerPackScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const packs = getAvailableStickerPacks();
        const selectedSet = new Set(Array.isArray(settings.stickerPackIds) ? settings.stickerPackIds : []);

        if (!packs.length) { scrollEl.innerHTML = `<div class="ctd-empty-hint">暂无已创建的表情包分组</div>`; return; }

        const rowsHtml = packs.map(p => {
            const pid = p.id || p.name;
            const checked = selectedSet.has(pid);
            const count = Array.isArray(p.items) ? p.items.length : (Array.isArray(p.stickers) ? p.stickers.length : 0);
            return `
                <div class="ctd-row ctd-spack-row" data-pack-id="${escapeHtml(pid)}">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">${escapeHtml(p.name || p.title || '表情包')}</div>
                        ${count ? `<div class="ctd-row-sub">${count} 张表情</div>` : ''}
                    </div>
                    <div class="ctd-row-right"><div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div></div>
                </div>
            `;
        }).join('');

        scrollEl.innerHTML = `<div class="ctd-section-label">选择挂载的表情包分组（可多选）</div><div class="ctd-card">${rowsHtml}</div>`;
        bindAllPressed(scrollEl);
        scrollEl.querySelectorAll('.ctd-spack-row').forEach(row => {
            row.addEventListener('click', () => {
                const pid = row.dataset.packId;
                const cur = getThreadSettings(currentThreadId);
                const set = new Set(Array.isArray(cur.stickerPackIds) ? cur.stickerPackIds : []);
                if (set.has(pid)) set.delete(pid); else set.add(pid);
                updateThreadSettings(currentThreadId, { stickerPackIds: Array.from(set) });
                renderStickerPackSubView();
            });
        });
    }

    /* ---------------- 二级页：聊天界面设定 ---------------- */
    function openThemeImportMenu() {
        openActionSheet({
            title: '导入界面素材',
            desc: '支持 PNG / WebP / JPG 素材或 JSON 主题包',
            actions: [
                { label: '导入头像框（PNG / WebP）', onClick: () => pickThemeImageAsset('frame') },
                { label: '导入气泡贴图（PNG / WebP / JPG）', onClick: () => pickThemeImageAsset('bubble') },
                { label: '导入主题配置文件（JSON）', onClick: () => importThemeConfigJson() },
                { label: '恢复全部默认界面设置', danger: true, onClick: () => applyDefaultTheme() }
            ]
        });
    }

    function pickThemeImageAsset(kind) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/webp,image/jpeg,image/gif,image/*';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                if (!dataUrl) return;
                if (kind === 'frame') {
                    const key = 'chat_avatar_frame_' + currentThreadId;
                    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') await window.PhoneDB.set(key, dataUrl);
                    avatarFrameCache.set(key, dataUrl);
                    updateThreadSettings(currentThreadId, { uiHasAvatarFrame: true });
                    showToast('已导入头像框');
                } else {
                    const key = 'chat_bubble_img_' + currentThreadId;
                    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') await window.PhoneDB.set(key, dataUrl);
                    bubbleImgCache.set(key, dataUrl);
                    updateThreadSettings(currentThreadId, { uiHasBubbleImg: true });
                    showToast('已导入气泡贴图');
                }
                await applyRoomThemeStyle(currentThreadId);
                renderThemeSubView();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    function importThemeConfigJson() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const cfg = JSON.parse(reader.result);
                    const themeId = 'theme_' + Date.now();
                    const themeName = (cfg && cfg.name) || file.name.replace(/\.json$/i, '') || '导入的主题';

                    let hasFrame = false;
                    let hasBubbleImg = false;
                    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
                        if (cfg && cfg.frameDataUrl) {
                            await window.PhoneDB.set('chat_theme_frame_' + themeId, cfg.frameDataUrl);
                            hasFrame = true;
                        }
                        if (cfg && cfg.bubbleDataUrl) {
                            await window.PhoneDB.set('chat_theme_bubble_' + themeId, cfg.bubbleDataUrl);
                            hasBubbleImg = true;
                        }
                    }

                    const newTheme = {
                        id: themeId,
                        name: themeName,
                        createdAt: Date.now(),
                        uiAvatarShape: cfg.uiAvatarShape || 'squircle',
                        uiAvatarSize: Number(cfg.uiAvatarSize) || 40,
                        uiBubbleScale: Number(cfg.uiBubbleScale) || 100,
                        uiBubbleFontOther: cfg.uiBubbleFontOther || '',
                        uiBubbleFontMe: cfg.uiBubbleFontMe || '',
                        uiBubbleFontSize: Number(cfg.uiBubbleFontSize) || 0,
                        uiBubbleBgOther: cfg.uiBubbleBgOther || '',
                        uiBubbleTextOther: cfg.uiBubbleTextOther || '',
                        uiBubbleBgMe: cfg.uiBubbleBgMe || '',
                        uiBubbleTextMe: cfg.uiBubbleTextMe || '',
                        hasFrame,
                        hasBubbleImg
                    };

                    const list = getSavedThemes();
                    list.unshift(newTheme);
                    saveThemesList(list);
                    await applySavedTheme(newTheme);
                } catch (e) {
                    showToast('主题文件解析失败');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function renderThemeSubView() {
        const scrollEl = document.getElementById('ctdThemeScroll');
        if (!scrollEl || !currentThreadId) return;
        await loadAllUploadedFonts();

        const thread = getThreadById(currentThreadId);
        const s = getThreadSettings(currentThreadId);
        const c = thread ? getCharById(thread.charId) : null;
        const customAv = s.hasCustomAvatar ? await loadDBAsset('chat_custom_avatar_' + currentThreadId, customAvatarCache) : '';
        const otherAv = customAv || getArchiveCharAvatar(c);
        const otherInitial = getDisplayName(thread, s).slice(0, 1);

        const frameUrl = s.uiHasAvatarFrame ? await loadDBAsset('chat_avatar_frame_' + currentThreadId, avatarFrameCache) : '';
        const bubbleImgUrl = s.uiHasBubbleImg ? await loadDBAsset('chat_bubble_img_' + currentThreadId, bubbleImgCache) : '';

        const avSize = Number(s.uiAvatarSize) || 40;
        const avRadius = s.uiAvatarShape === 'circle' ? '50%' : '5px';
        const scale = (Number(s.uiBubbleScale) || 100) / 100;
        const padV = Math.round(9 * scale);
        const padH = Math.round(12 * scale);
        const bFontSize = s.uiBubbleFontSize > 0 ? `${s.uiBubbleFontSize}px` : 'var(--app-font-size, 15px)';
        const bgImgStyle = bubbleImgUrl ? `background-image:url('${bubbleImgUrl}');background-size:cover;background-position:center;` : '';
        const imgCls = (bubbleImgUrl || !s.uiShowAvatar) ? 'has-img' : '';

        const otherBg = s.uiBubbleBgOther || '#ffffff';
        const otherColor = s.uiBubbleTextOther || '#1c1c1e';
        const meBg = s.uiBubbleBgMe || '#95ec69';
        const meColor = s.uiBubbleTextMe || '#1c1c1e';

        const previewHtml = `
            <div class="ctd-theme-preview">
                <div class="ctd-prev-row">
                    ${s.uiShowAvatar ? `
                        <div class="ctd-prev-av-wrap">
                            <div class="ctd-prev-av" style="width:${avSize}px;height:${avSize}px;border-radius:${avRadius};">
                                ${otherAv ? `<img src="${escapeHtml(otherAv)}" alt="">` : escapeHtml(otherInitial)}
                            </div>
                            ${frameUrl ? `<img class="ctd-prev-frame" src="${escapeHtml(frameUrl)}" alt="">` : ''}
                        </div>
                    ` : ''}
                    <div class="ctd-prev-bubble ${imgCls}" style="--ctd-prev-bg:${otherBg};--ctd-prev-color:${otherColor};padding:${padV}px ${padH}px;font-size:${bFontSize};${s.uiBubbleFontOther ? `font-family:'${s.uiBubbleFontOther}',sans-serif;` : ''}${bgImgStyle}">对方气泡样式预览</div>
                </div>
                <div class="ctd-prev-row me">
                    ${s.uiShowAvatar ? `
                        <div class="ctd-prev-av-wrap">
                            <div class="ctd-prev-av" style="width:${avSize}px;height:${avSize}px;border-radius:${avRadius};">我</div>
                            ${frameUrl ? `<img class="ctd-prev-frame" src="${escapeHtml(frameUrl)}" alt="">` : ''}
                        </div>
                    ` : ''}
                    <div class="ctd-prev-bubble ${imgCls}" style="--ctd-prev-bg:${meBg};--ctd-prev-color:${meColor};padding:${padV}px ${padH}px;font-size:${bFontSize};${s.uiBubbleFontMe ? `font-family:'${s.uiBubbleFontMe}',sans-serif;` : ''}${bgImgStyle}">hi</div>
                </div>
            </div>
        `;

        const avatarSettingsHtml = s.uiShowAvatar ? `
            <div class="ctd-row ctd-row-static">
                <div class="ctd-row-left"><div class="ctd-row-title">头像形状</div></div>
                <div class="ctd-row-right">
                    <div class="ctd-region-bar" style="width:136px;">
                        <button type="button" class="ctd-region-btn ${s.uiAvatarShape !== 'circle' ? 'active' : ''}" data-av-shape="squircle">方圆</button>
                        <button type="button" class="ctd-region-btn ${s.uiAvatarShape === 'circle' ? 'active' : ''}" data-av-shape="circle">圆形</button>
                    </div>
                </div>
            </div>
            <div class="ctd-slider-row">
                <div class="ctd-slider-head">
                    <span class="ctd-row-title">头像大小</span>
                    <span class="ctd-row-value" id="ctdAvSizeVal">${avSize} px</span>
                </div>
                <input type="range" class="ctd-range" id="ctdAvSizeRange" min="32" max="56" step="2" value="${avSize}">
            </div>
            <div class="ctd-row" id="ctdAvFrameRow">
                <div class="ctd-row-left"><div class="ctd-row-title">头像框</div></div>
                <div class="ctd-row-right">
                    <span class="ctd-row-value">${s.uiHasAvatarFrame ? '已设置' : '未设置'}</span>
                    <span class="ctd-chevron">${SVG_CHEVRON}</span>
                </div>
            </div>
        ` : '';

        const savedThemes = getSavedThemes();
        const activeThemeId = s.uiActiveThemeId || '';
        const savedRowsHtml = savedThemes.map(t => {
            const isActive = activeThemeId === t.id;
            return `
                <div class="ctd-row ctd-saved-theme-row" data-theme-id="${escapeHtml(t.id)}">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">${escapeHtml(t.name)}</div>
                        <div class="ctd-row-sub">${escapeHtml(buildThemeSummary(t))}</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${isActive ? 'checked' : ''}">${isActive ? SVG_CHECK : ''}</div>
                        <button type="button" class="ctd-icon-more-btn ctd-theme-more-btn" data-theme-more="${escapeHtml(t.id)}" aria-label="更多">${SVG_MORE}</button>
                    </div>
                </div>
            `;
        }).join('');

        const isPureDefault = !activeThemeId && !s.uiHasAvatarFrame && !s.uiHasBubbleImg && !s.uiBubbleBgOther && !s.uiBubbleBgMe;
        const importedThemesHtml = `
            <div class="ctd-section-label">已导入的主题</div>
            <div class="ctd-card">
                <div class="ctd-row" id="ctdThemeDefaultItem">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">默认主题</div>
                        <div class="ctd-row-sub">恢复系统标准气泡与头像框（保留头像显示开关）</div>
                    </div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${isPureDefault ? 'checked' : ''}">${isPureDefault ? SVG_CHECK : ''}</div>
                    </div>
                </div>
                ${savedRowsHtml}
            </div>
        `;

        scrollEl.innerHTML = `
            ${previewHtml}
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">显示头像</div>
                        <div class="ctd-row-sub">独立于主题，切换主题时保持当前开关状态</div>
                    </div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${s.uiShowAvatar ? 'on' : ''}" id="ctdShowAvatarSw" aria-label="显示头像"></button></div>
                </div>
                ${avatarSettingsHtml}
            </div>

            <div class="ctd-card">
                <div class="ctd-slider-row">
                    <div class="ctd-slider-head">
                        <span class="ctd-row-title">气泡大小</span>
                        <span class="ctd-row-value" id="ctdBubbleScaleVal">${s.uiBubbleScale}%</span>
                    </div>
                    <input type="range" class="ctd-range" id="ctdBubbleScaleRange" min="85" max="120" step="5" value="${s.uiBubbleScale}">
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">对方气泡底色</div></div>
                    <div class="ctd-row-right">
                        ${s.uiBubbleBgOther ? `<button type="button" class="ctd-mini-reset" data-color-reset="uiBubbleBgOther">恢复</button>` : ''}
                        <input type="color" class="ctd-color-picker" data-color-key="uiBubbleBgOther" value="${otherBg}">
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">对方文字颜色</div></div>
                    <div class="ctd-row-right">
                        ${s.uiBubbleTextOther ? `<button type="button" class="ctd-mini-reset" data-color-reset="uiBubbleTextOther">恢复</button>` : ''}
                        <input type="color" class="ctd-color-picker" data-color-key="uiBubbleTextOther" value="${otherColor}">
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">我方气泡底色</div></div>
                    <div class="ctd-row-right">
                        ${s.uiBubbleBgMe ? `<button type="button" class="ctd-mini-reset" data-color-reset="uiBubbleBgMe">恢复</button>` : ''}
                        <input type="color" class="ctd-color-picker" data-color-key="uiBubbleBgMe" value="${meBg}">
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">我方文字颜色</div></div>
                    <div class="ctd-row-right">
                        ${s.uiBubbleTextMe ? `<button type="button" class="ctd-mini-reset" data-color-reset="uiBubbleTextMe">恢复</button>` : ''}
                        <input type="color" class="ctd-color-picker" data-color-key="uiBubbleTextMe" value="${meColor}">
                    </div>
                </div>
                <div class="ctd-row" id="ctdFontOtherRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">对方气泡字体</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(getFontLabel(s.uiBubbleFontOther))}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdFontMeRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">我方气泡字体</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(getFontLabel(s.uiBubbleFontMe))}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-slider-row">
                    <div class="ctd-slider-head">
                        <span class="ctd-row-title">气泡字体大小</span>
                        <span class="ctd-row-value" id="ctdBubbleFsVal">${s.uiBubbleFontSize > 0 ? s.uiBubbleFontSize + ' px' : '跟随全局'}</span>
                    </div>
                    <input type="range" class="ctd-range" id="ctdBubbleFsRange" min="0" max="22" step="1" value="${s.uiBubbleFontSize}">
                </div>
            </div>

            ${importedThemesHtml}
        `;
        bindAllPressed(scrollEl);

        // 独立控制显示头像，不影响当前已选主题
        document.getElementById('ctdShowAvatarSw').addEventListener('click', async (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            updateThreadSettings(currentThreadId, { uiShowAvatar: !cur.uiShowAvatar });
            await applyRoomThemeStyle(currentThreadId);
            renderThemeSubView();
        });

        scrollEl.querySelectorAll('[data-av-shape]').forEach(btn => {
            btn.addEventListener('click', async () => {
                updateThreadSettings(currentThreadId, { uiAvatarShape: btn.dataset.avShape });
                await applyRoomThemeStyle(currentThreadId);
                renderThemeSubView();
            });
        });

        const avRange = document.getElementById('ctdAvSizeRange');
        if (avRange) {
            avRange.addEventListener('input', () => { document.getElementById('ctdAvSizeVal').textContent = avRange.value + ' px'; });
            avRange.addEventListener('change', async () => {
                updateThreadSettings(currentThreadId, { uiAvatarSize: Number(avRange.value) });
                await applyRoomThemeStyle(currentThreadId);
                renderThemeSubView();
            });
        }

        const avFrameRow = document.getElementById('ctdAvFrameRow');
        if (avFrameRow) {
            avFrameRow.addEventListener('click', () => {
                openActionSheet({
                    title: '设置头像框',
                    actions: [
                        { label: '导入透明底 PNG 头像框', onClick: () => pickThemeImageAsset('frame') },
                        {
                            label: '清除头像框',
                            danger: true,
                            onClick: async () => {
                                const key = 'chat_avatar_frame_' + currentThreadId;
                                if (window.PhoneDB && typeof window.PhoneDB.del === 'function') await window.PhoneDB.del(key);
                                avatarFrameCache.delete(key);
                                updateThreadSettings(currentThreadId, { uiHasAvatarFrame: false });
                                await applyRoomThemeStyle(currentThreadId);
                                renderThemeSubView();
                                showToast('已清除头像框');
                            }
                        }
                    ]
                });
            });
        }

        const scaleRange = document.getElementById('ctdBubbleScaleRange');
        scaleRange.addEventListener('input', () => { document.getElementById('ctdBubbleScaleVal').textContent = scaleRange.value + '%'; });
        scaleRange.addEventListener('change', async () => {
            updateThreadSettings(currentThreadId, { uiBubbleScale: Number(scaleRange.value) });
            await applyRoomThemeStyle(currentThreadId);
            renderThemeSubView();
        });

        scrollEl.querySelectorAll('[data-color-key]').forEach(picker => {
            picker.addEventListener('change', async () => {
                updateThreadSettings(currentThreadId, { [picker.dataset.colorKey]: picker.value });
                await applyRoomThemeStyle(currentThreadId);
                renderThemeSubView();
            });
        });

        scrollEl.querySelectorAll('[data-color-reset]').forEach(btn => {
            btn.addEventListener('click', async () => {
                updateThreadSettings(currentThreadId, { [btn.dataset.colorReset]: '' });
                await applyRoomThemeStyle(currentThreadId);
                renderThemeSubView();
            });
        });

        document.getElementById('ctdFontOtherRow').addEventListener('click', () => openBubbleFontPicker('uiBubbleFontOther', '选择对方气泡字体'));
        document.getElementById('ctdFontMeRow').addEventListener('click', () => openBubbleFontPicker('uiBubbleFontMe', '选择我方气泡字体'));

        const fsRange = document.getElementById('ctdBubbleFsRange');
        fsRange.addEventListener('input', () => {
            const v = Number(fsRange.value);
            document.getElementById('ctdBubbleFsVal').textContent = v > 0 ? `${Math.max(12, v)} px` : '跟随全局';
        });
        fsRange.addEventListener('change', async () => {
            const v = Number(fsRange.value);
            updateThreadSettings(currentThreadId, { uiBubbleFontSize: v > 0 ? Math.max(12, v) : 0 });
            await applyRoomThemeStyle(currentThreadId);
            renderThemeSubView();
        });

        document.getElementById('ctdThemeDefaultItem').addEventListener('click', () => applyDefaultTheme());

        scrollEl.querySelectorAll('.ctd-saved-theme-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.ctd-theme-more-btn')) return;
                const tid = row.dataset.themeId;
                const target = getSavedThemes().find(item => item.id === tid);
                if (target) applySavedTheme(target);
            });
        });

        scrollEl.querySelectorAll('.ctd-theme-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tid = btn.dataset.themeMore;
                const target = getSavedThemes().find(item => item.id === tid);
                if (!target) return;
                openActionSheet({
                    title: target.name,
                    actions: [
                        { label: '导出主题（JSON）', onClick: () => exportSavedThemeJson(target) },
                        {
                            label: '重命名',
                            onClick: () => {
                                openInputModal({
                                    title: '重命名主题',
                                    value: target.name,
                                    placeholder: '输入新的主题名称',
                                    onConfirm: (newName) => {
                                        if (!newName) return;
                                        const list = getSavedThemes();
                                        const idx = list.findIndex(x => x.id === tid);
                                        if (idx >= 0) { list[idx].name = newName; saveThemesList(list); }
                                        renderThemeSubView();
                                        showToast('已重命名主题');
                                    }
                                });
                            }
                        },
                        {
                            label: '删除主题',
                            danger: true,
                            onClick: async () => {
                                if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
                                    await window.PhoneDB.del('chat_theme_frame_' + tid);
                                    await window.PhoneDB.del('chat_theme_bubble_' + tid);
                                }
                                saveThemesList(getSavedThemes().filter(x => x.id !== tid));
                                if (getThreadSettings(currentThreadId).uiActiveThemeId === tid) {
                                    updateThreadSettings(currentThreadId, { uiActiveThemeId: '' });
                                }
                                renderThemeSubView();
                                showToast('已删除主题');
                            }
                        }
                    ]
                });
            });
        });
    }

    /* ---------------- 其余二级页 ---------------- */
    async function renderProfileSubView() {
        const scrollEl = document.getElementById('ctdProfileScroll');
        if (!scrollEl || !currentThreadId) return;
        const thread = getThreadById(currentThreadId);
        const settings = getThreadSettings(currentThreadId);
        const isGroup = thread && thread.type === 'group';
        const c = thread ? getCharById(thread.charId) : null;
        const customAv = settings.hasCustomAvatar ? await loadDBAsset('chat_custom_avatar_' + currentThreadId, customAvatarCache) : '';
        const av = customAv || getArchiveCharAvatar(c);
        const displayName = getDisplayName(thread, settings);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSubRemarkRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">${isGroup ? '群聊备注' : '修改备注'}</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.remark || displayName)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdSubAvatarRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">修改头像</div></div>
                    <div class="ctd-row-right">
                        <div class="ctd-member-av" style="width:34px;height:34px;border-radius:6px;">
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
                    showToast(val ? '备注已更新' : '已恢复默认名称');
                }
            });
        });
        document.getElementById('ctdSubAvatarRow').addEventListener('click', () => {
            openActionSheet({
                title: '修改聊天头像',
                actions: [
                    { label: '从相册选择头像', onClick: () => pickCustomAvatar() },
                    {
                        label: '恢复默认头像',
                        onClick: async () => {
                            const key = 'chat_custom_avatar_' + currentThreadId;
                            if (window.PhoneDB && typeof window.PhoneDB.del === 'function') await window.PhoneDB.del(key);
                            customAvatarCache.delete(key);
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
                const key = 'chat_custom_avatar_' + currentThreadId;
                if (window.PhoneDB && typeof window.PhoneDB.set === 'function') await window.PhoneDB.set(key, dataUrl);
                customAvatarCache.set(key, dataUrl);
                updateThreadSettings(currentThreadId, { hasCustomAvatar: true });
                syncHomeListUI();
                syncRoomCustomAvatarsUI();
                renderProfileSubView();
                showToast('头像已更新');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    function renderApiSubView() {
        const scrollEl = document.getElementById('ctdApiScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const bundles = getAvailableApiBundles();
        const selectedId = settings.apiBundleId || '';

        const followHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdApiFollowGlobalRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">跟随全局 API</div></div>
                    <div class="ctd-row-right"><div class="ctd-check-circle ${!selectedId ? 'checked' : ''}">${!selectedId ? SVG_CHECK : ''}</div></div>
                </div>
            </div>
        `;

        let listHtml = '';
        if (!bundles.length) listHtml = `<div class="ctd-empty-hint">暂无已保存的配置组，请先在「API」中添加</div>`;
        else {
            const rowsHtml = bundles.map(b => {
                const isSel = selectedId === b.id;
                return `
                    <div class="ctd-row ctd-api-bundle-row" data-bundle-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || '未命名配置')}</div>
                            ${b.model ? `<div class="ctd-row-sub">${escapeHtml(b.model)}</div>` : ''}
                        </div>
                        <div class="ctd-row-right"><div class="ctd-check-circle ${isSel ? 'checked' : ''}">${isSel ? SVG_CHECK : ''}</div></div>
                    </div>
                `;
            }).join('');
            listHtml = `<div class="ctd-section-label">独立配置（单选）</div><div class="ctd-card">${rowsHtml}</div>`;
        }

        scrollEl.innerHTML = followHtml + listHtml;
        bindAllPressed(scrollEl);
        document.getElementById('ctdApiFollowGlobalRow').addEventListener('click', () => { updateThreadSettings(currentThreadId, { apiBundleId: '' }); renderApiSubView(); showToast('已恢复跟随全局 API'); });
        scrollEl.querySelectorAll('.ctd-api-bundle-row').forEach(row => {
            row.addEventListener('click', () => { updateThreadSettings(currentThreadId, { apiBundleId: row.dataset.bundleId || '' }); renderApiSubView(); showToast('已指定独立 API'); });
        });
    }

    function renderCotSubView() {
        const scrollEl = document.getElementById('ctdCotScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">显示思维链</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.cotShow ? 'on' : ''}" id="ctdCotShowSwitch" aria-label="显示思维链"></button></div>
                </div>
            </div>
            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">自定义思维链</div>
                <textarea class="ctd-textarea" id="ctdCotTextarea" placeholder="输入自定义思维链内容...">${escapeHtml(settings.cotCustom || '')}</textarea>
            </div>
            <button type="button" class="ctd-primary-btn" id="ctdCotSaveBtn">保存</button>
        `;
        bindAllPressed(scrollEl);
        document.getElementById('ctdCotShowSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { cotShow: !cur.cotShow });
            e.currentTarget.classList.toggle('on', next.cotShow);
            showToast(next.cotShow ? '已开启显示思维链' : '已关闭显示思维链');
        });
        document.getElementById('ctdCotSaveBtn').addEventListener('click', () => {
            const ta = document.getElementById('ctdCotTextarea');
            const val = ta.value.trim();
            ta.blur();
            updateThreadSettings(currentThreadId, { cotCustom: val });
            showToast('已保存思维链设置');
        });
    }

    function renderVoiceSubView() {
        const scrollEl = document.getElementById('ctdVoiceScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const provider = getProviderMeta(settings.voiceProvider);
        const region = settings.voiceMinimaxRegion || 'cn';

        const providerGridHtml = VOICE_PROVIDERS.map(p => `
            <button type="button" class="ctd-provider-pill ${p.id === provider.id ? 'active' : ''}" data-provider="${p.id}">${escapeHtml(p.label)}</button>
        `).join('');

        const regionHtml = provider.id === 'minimax' ? `
            <div class="ctd-region-bar">
                <button type="button" class="ctd-region-btn ${region === 'cn' ? 'active' : ''}" data-mm-region="cn">国内站</button>
                <button type="button" class="ctd-region-btn ${region === 'intl' ? 'active' : ''}" data-mm-region="intl">国际站</button>
            </div>
        ` : '';

        const groupIdHtml = provider.needGroupId ? `
            <div class="ctd-input-label">Group ID</div>
            <input type="text" class="ctd-input-clean" id="ctdVoiceGroupInput" placeholder="输入 MiniMax Group ID" value="${escapeHtml(settings.voiceGroupId || '')}">
        ` : '';

        scrollEl.innerHTML = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">允许发送语音</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.voiceEnabled ? 'on' : ''}" id="ctdVoiceEnableSw" aria-label="允许发送语音"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动播放</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.voiceAutoPlay ? 'on' : ''}" id="ctdVoiceAutoSw" aria-label="自动播放"></button></div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动标注情绪</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.voiceEmotionTag ? 'on' : ''}" id="ctdVoiceEmotionSw" aria-label="自动标注情绪"></button></div>
                </div>
            </div>

            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">模型配置</div>
                <div class="ctd-provider-grid">${providerGridHtml}</div>
                ${regionHtml}
                <div class="ctd-input-label">接口地址（支持修改为第三方中转）</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceUrlInput" placeholder="https://..." value="${escapeHtml(settings.voiceApiUrl || '')}">
                <div class="ctd-input-label">API Key</div>
                <input type="password" class="ctd-input-clean" id="ctdVoiceKeyInput" placeholder="输入 API Key" value="${escapeHtml(settings.voiceApiKey || '')}">
                ${groupIdHtml}
                <div class="ctd-input-label">模型名称</div>
                <div class="ctd-inline-input-row">
                    <input type="text" class="ctd-input-clean" id="ctdVoiceModelInput" placeholder="输入或拉取模型名" value="${escapeHtml(settings.voiceModel || '')}">
                    <button type="button" class="ctd-fetch-btn" id="ctdVoiceFetchBtn">拉取</button>
                </div>
                <div class="ctd-input-label">音色 ID</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceIdInput" placeholder="${escapeHtml(provider.voicePlaceholder)}" value="${escapeHtml(settings.voiceVoiceId || '')}">
                <div class="ctd-input-label">语速</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceSpeedInput" placeholder="1.0" value="${escapeHtml(settings.voiceSpeed || '1.0')}">
            </div>

            <button type="button" class="ctd-primary-btn" id="ctdVoiceSaveBtn">保存配置</button>
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

        scrollEl.querySelectorAll('.ctd-provider-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.provider;
                const meta = getProviderMeta(pid);
                const cur = getThreadSettings(currentThreadId);
                let autoUrl = meta.defaultUrl || '';
                if (pid === 'minimax') autoUrl = (cur.voiceMinimaxRegion === 'intl') ? meta.intlUrl : meta.cnUrl;
                updateThreadSettings(currentThreadId, { voiceProvider: pid, voiceApiUrl: autoUrl, voiceModel: meta.defaultModel || '' });
                renderVoiceSubView();
            });
        });

        scrollEl.querySelectorAll('.ctd-region-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reg = btn.dataset.mmRegion;
                const meta = getProviderMeta('minimax');
                updateThreadSettings(currentThreadId, { voiceMinimaxRegion: reg, voiceApiUrl: reg === 'intl' ? meta.intlUrl : meta.cnUrl });
                renderVoiceSubView();
            });
        });

        const fetchBtn = document.getElementById('ctdVoiceFetchBtn');
        fetchBtn.addEventListener('click', async () => {
            if (document.activeElement) document.activeElement.blur();
            const curUrl = document.getElementById('ctdVoiceUrlInput').value.trim();
            const curKey = document.getElementById('ctdVoiceKeyInput').value.trim();
            const curModel = document.getElementById('ctdVoiceModelInput').value.trim();
            fetchBtn.textContent = '拉取中...';
            fetchBtn.disabled = true;
            try {
                const { models, source } = await fetchVoiceModelsList(provider.id, curUrl, curKey);
                if (!models.length) { showToast('未拉取到模型，请核对接口地址与 API Key'); return; }
                openActionSheet({
                    title: source === 'remote' ? '选择拉取的模型' : '选择官方常用模型',
                    searchable: models.length > 6,
                    searchPlaceholder: '搜索模型名称...',
                    actions: models.map(m => ({
                        label: m + (curModel === m ? ' ✓' : ''),
                        selected: curModel === m,
                        onClick: () => {
                            document.getElementById('ctdVoiceModelInput').value = m;
                            updateThreadSettings(currentThreadId, { voiceModel: m });
                            showToast('已选择模型');
                        }
                    }))
                });
            } finally {
                fetchBtn.textContent = '拉取';
                fetchBtn.disabled = false;
            }
        });

        document.getElementById('ctdVoiceSaveBtn').addEventListener('click', () => {
            if (document.activeElement) document.activeElement.blur();
            const groupInput = document.getElementById('ctdVoiceGroupInput');
            updateThreadSettings(currentThreadId, {
                voiceApiUrl: document.getElementById('ctdVoiceUrlInput').value.trim(),
                voiceApiKey: document.getElementById('ctdVoiceKeyInput').value.trim(),
                voiceGroupId: groupInput ? groupInput.value.trim() : '',
                voiceModel: document.getElementById('ctdVoiceModelInput').value.trim(),
                voiceVoiceId: document.getElementById('ctdVoiceIdInput').value.trim(),
                voiceSpeed: document.getElementById('ctdVoiceSpeedInput').value.trim() || '1.0'
            });
            showToast('语音模型配置已保存');
        });
    }

    function renderVoiceLoreView() {
        const scrollEl = document.getElementById('ctdVoiceLoreScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const books = getAvailableLorebooks();
        const selectedSet = new Set(Array.isArray(settings.voiceLoreIds) ? settings.voiceLoreIds : []);

        const toggleHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">启用语音模型世界书</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.voiceLoreOverride ? 'on' : ''}" id="ctdVoiceLoreSwitch" aria-label="启用语音模型世界书"></button></div>
                </div>
            </div>
        `;

        let booksHtml = '';
        if (!books.length) booksHtml = `<div class="ctd-empty-hint">暂无可用世界书，请先在「世界书」中添加</div>`;
        else {
            const rowsHtml = books.map(b => {
                const checked = selectedSet.has(b.id);
                const entryCount = Array.isArray(b.entries) ? b.entries.length : 0;
                return `
                    <div class="ctd-row ctd-vlore-book-row" data-book-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || b.title || '未命名世界书')}</div>
                            ${entryCount ? `<div class="ctd-row-sub">${entryCount} 条词条</div>` : ''}
                        </div>
                        <div class="ctd-row-right"><div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div></div>
                    </div>
                `;
            }).join('');
            booksHtml = `<div class="ctd-section-label">选择语音专属世界书（可多选）</div><div class="ctd-card" style="${settings.voiceLoreOverride ? '' : 'opacity:0.55;'}">${rowsHtml}</div>`;
        }

        scrollEl.innerHTML = toggleHtml + booksHtml;
        bindAllPressed(scrollEl);
        document.getElementById('ctdVoiceLoreSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { voiceLoreOverride: !cur.voiceLoreOverride });
            renderVoiceLoreView();
            showToast(next.voiceLoreOverride ? '已启用语音模型世界书' : '已关闭语音模型世界书');
        });
        scrollEl.querySelectorAll('.ctd-vlore-book-row').forEach(row => {
            row.addEventListener('click', () => {
                const bid = row.dataset.bookId;
                const cur = getThreadSettings(currentThreadId);
                const set = new Set(Array.isArray(cur.voiceLoreIds) ? cur.voiceLoreIds : []);
                if (set.has(bid)) set.delete(bid); else set.add(bid);
                updateThreadSettings(currentThreadId, { voiceLoreOverride: true, voiceLoreIds: Array.from(set) });
                renderVoiceLoreView();
            });
        });
    }

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
                    <div class="ctd-row-left"><div class="ctd-row-title">感知真实时间</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${realTimeOn ? 'on' : ''}" id="ctdRealTimeSwitch" aria-label="感知真实时间"></button></div>
                </div>
            </div>
            <div class="ctd-calendar-wrap" id="ctdCalendarSlot"></div>
            <div id="ctdSearchResultSlot"></div>
        `;
        bindAllPressed(scrollEl);

        const inputEl = document.getElementById('ctdSearchInput');
        const clearBtn = document.getElementById('ctdSearchClear');
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
        document.getElementById('ctdRealTimeSwitch').addEventListener('click', (e) => {
            e.stopPropagation();
            const cur = getThreadSettings(currentThreadId);
            const next = updateThreadSettings(currentThreadId, { realTime: !cur.realTime });
            e.currentTarget.classList.toggle('on', next.realTime);
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
            document.getElementById('ctdClearDateBtn').addEventListener('click', () => { selectedDateStr = ''; renderSearchBody(); });
        } else {
            const msgDates = new Set();
            msgs.forEach(m => { const ds = getMsgDateStr(m); if (ds) msgDates.add(ds); });
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
                        <span class="ctd-cal-weekday">日</span><span class="ctd-cal-weekday">一</span><span class="ctd-cal-weekday">二</span>
                        <span class="ctd-cal-weekday">三</span><span class="ctd-cal-weekday">四</span><span class="ctd-cal-weekday">五</span><span class="ctd-cal-weekday">六</span>
                    </div>
                    <div class="ctd-cal-grid">${daysHtml}</div>
                </div>
            `;
            bindAllPressed(calSlot);
            document.getElementById('ctdCalPrev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderSearchBody(); });
            document.getElementById('ctdCalNext').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderSearchBody(); });
            calSlot.querySelectorAll('.ctd-cal-day.has-msg').forEach(el => {
                el.addEventListener('click', () => { selectedDateStr = el.dataset.date; renderSearchBody(); });
            });
        }

        if (realTimeOn && !selectedDateStr && !searchKeyword) {
            resultSlot.innerHTML = `<div class="ctd-empty-hint">点击黑色日期可查看当日记录</div>`;
            return;
        }

        let indexed = msgs.map((m, origIdx) => ({ m, origIdx }));
        if (realTimeOn && selectedDateStr) indexed = indexed.filter(x => getMsgDateStr(x.m) === selectedDateStr);
        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            indexed = indexed.filter(x => formatMsgPreview(x.m).toLowerCase().includes(kw));
        }

        if (!indexed.length) {
            resultSlot.innerHTML = `<div class="ctd-empty-hint">${selectedDateStr ? '该日期暂无聊天记录' : '未找到相关聊天记录'}</div>`;
            return;
        }

        const thread = getThreadById(currentThreadId);
        const listHtml = indexed.slice().reverse().map(({ m, origIdx }) => {
            let senderName = '我';
            if (m.sender !== 'me') {
                const c = m.charId ? getCharById(m.charId) : (thread && thread.charId ? getCharById(thread.charId) : null);
                senderName = (c && (c.name || c.nickname)) || getDisplayName(thread, settings);
            }
            return `
                <div class="ctd-msg-item ctd-search-jump-item" data-jump-id="${escapeHtml(m.id || '')}" data-jump-idx="${origIdx}">
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
        resultSlot.querySelectorAll('.ctd-search-jump-item').forEach(item => {
            item.addEventListener('click', () => {
                jumpToMessageInRoom(item.dataset.jumpId, Number(item.dataset.jumpIdx));
            });
        });
    }

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
                    <div class="ctd-row-right"><div class="ctd-check-circle ${!selectedId ? 'checked' : ''}">${!selectedId ? SVG_CHECK : ''}</div></div>
                </div>
            </div>
        `;

        let listHtml = '';
        if (!presets.length) listHtml = `<div class="ctd-empty-hint">暂无可用预设，请先在「预设」中添加</div>`;
        else {
            const rowsHtml = presets.map(p => {
                const isSelected = selectedId === p.id;
                const count = Array.isArray(p.prompts) ? p.prompts.length : (Array.isArray(p.items) ? p.items.length : 0);
                return `
                    <div class="ctd-row ctd-preset-item-row" data-preset-id="${escapeHtml(p.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(p.name || '未命名预设')}</div>
                            ${count ? `<div class="ctd-row-sub">${count} 条提示词</div>` : ''}
                        </div>
                        <div class="ctd-row-right"><div class="ctd-check-circle ${isSelected ? 'checked' : ''}">${isSelected ? SVG_CHECK : ''}</div></div>
                    </div>
                `;
            }).join('');
            listHtml = `<div class="ctd-section-label">指定专属预设（单选）</div><div class="ctd-card">${rowsHtml}</div>`;
        }

        scrollEl.innerHTML = followHtml + listHtml;
        bindAllPressed(scrollEl);
        document.getElementById('ctdPresetFollowGlobalRow').addEventListener('click', () => { updateThreadSettings(currentThreadId, { presetId: '' }); renderPresetView(); showToast('已恢复跟随全局预设'); });
        scrollEl.querySelectorAll('.ctd-preset-item-row').forEach(row => {
            row.addEventListener('click', () => { updateThreadSettings(currentThreadId, { presetId: row.dataset.presetId || '' }); renderPresetView(); showToast('已指定专属预设'); });
        });
    }

    function renderLoreView() {
        const scrollEl = document.getElementById('ctdLoreScroll');
        if (!scrollEl || !currentThreadId) return;
        const settings = getThreadSettings(currentThreadId);
        const books = getAvailableLorebooks();
        const selectedSet = new Set(Array.isArray(settings.loreIds) ? settings.loreIds : []);

        const toggleHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">启用单独挂载</div></div>
                    <div class="ctd-row-right"><button type="button" class="ctd-switch ${settings.loreOverride ? 'on' : ''}" id="ctdLoreOverrideSwitch" aria-label="启用单独挂载"></button></div>
                </div>
            </div>
        `;

        let booksHtml = '';
        if (!books.length) booksHtml = `<div class="ctd-empty-hint">暂无可用世界书，请先在「世界书」中添加</div>`;
        else {
            const rowsHtml = books.map(b => {
                const checked = selectedSet.has(b.id);
                const entryCount = Array.isArray(b.entries) ? b.entries.length : 0;
                return `
                    <div class="ctd-row ctd-lore-book-row" data-book-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || b.title || '未命名世界书')}</div>
                            ${entryCount ? `<div class="ctd-row-sub">${entryCount} 条词条</div>` : ''}
                        </div>
                        <div class="ctd-row-right"><div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div></div>
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
            showToast(next.loreOverride ? '已开启单独挂载' : '已切换为跟随全局');
        });
        scrollEl.querySelectorAll('.ctd-lore-book-row').forEach(row => {
            row.addEventListener('click', () => {
                const bid = row.dataset.bookId;
                const cur = getThreadSettings(currentThreadId);
                const set = new Set(Array.isArray(cur.loreIds) ? cur.loreIds : []);
                if (set.has(bid)) set.delete(bid); else set.add(bid);
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
                    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') await window.PhoneDB.set('chat_bg_' + currentThreadId, dataUrl);
                    updateThreadSettings(currentThreadId, { hasBg: true });
                    await syncRoomBackgroundUI();
                    renderMainBody();
                    showToast('已更新聊天背景');
                } catch (e) { showToast('背景保存失败'); }
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
        const payload = { version: 1, exportedAt: new Date().toISOString(), threadId: currentThreadId, name, messages: msgs };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${name}_${toDateStr(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`已导出 ${msgs.length} 条记录`);
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
                    if (!arr) { showToast('文件格式无效'); return; }
                    saveJSON(MSGS_PREFIX + currentThreadId, arr);
                    const threads = loadJSON(THREADS_KEY, []);
                    const idx = threads.findIndex(t => t.id === currentThreadId);
                    if (idx >= 0 && arr.length) {
                        const last = arr[arr.length - 1];
                        threads[idx].lastMsg = formatMsgPreview(last);
                        threads[idx].lastTime = formatMsgTimeLabel(last, false);
                        saveJSON(THREADS_KEY, threads);
                    }
                    showToast(`已导入 ${arr.length} 条记录`);
                } catch (e) { showToast('导入文件解析失败'); }
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
                if (tid) currentThreadId = tid;
                else {
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
                    applyRoomThemeStyle(currentThreadId);
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
            roomBackBtn.addEventListener('click', () => setTimeout(() => syncHomeListUI(), 60));
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
        getEffectiveVoiceLorebookIds: function (threadId) {
            const s = getThreadSettings(threadId || resolveActiveThreadId());
            if (!s.voiceLoreOverride) return [];
            return Array.isArray(s.voiceLoreIds) ? s.voiceLoreIds : [];
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

    function init() {
        setupKeyboardViewportFix();
        setupObserversAndHooks();
        loadAllUploadedFonts();
        sortThreadsByPin();
        syncRoomTitleAndBellUI();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
