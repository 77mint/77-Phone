/* =========================================================
   Chat 聊天详情页 (apps/chat-details.js)
   - 拦截 #ctRoomMoreBtn，不改动 apps/chat.js / apps/chat.css
   - 修复 iOS Safari 键盘弹起遮挡输入框与卡死问题（visualViewport 实时适配）
   - 新增「语音模型世界书」（主界面紧接「启用语音模型」下方）
   - 内置 110+ 全球语言与各地方言（含简繁/粤语/沪语及别名搜索 + 自由输入）
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

    // 110+ 全球语言与中国各地方言（含别名关键词检索）
    const ALL_LANGUAGES = [
        // 中文与国内方言
        { name: '简体中文', alias: '普通话 国语 中文 简中 zh-cn' },
        { name: '繁体中文', alias: '正体中文 中文 繁中 港台 zh-tw zh-hk' },
        { name: '文言文', alias: '古文 古汉语 古代中文' },
        { name: '粤语', alias: '广东话 广府话 白话 香港粤语 港普 cantonese yue' },
        { name: '沪语', alias: '上海话 吴语 shanghainese' },
        { name: '吴语（苏州话）', alias: '苏白 苏州话 吴语' },
        { name: '吴语（杭州话）', alias: '杭州话 吴语' },
        { name: '吴语（宁波话）', alias: '宁波话 吴语' },
        { name: '温州话', alias: '瓯语 温州话 吴语' },
        { name: '四川话', alias: '川渝话 成都话 西南官话 椒盐普通话' },
        { name: '重庆话', alias: '渝语 川渝话 西南官话' },
        { name: '东北话', alias: '东北官话 沈阳话 哈尔滨话' },
        { name: '北京话', alias: '京片子 儿化音 北京官话' },
        { name: '天津话', alias: '卫嘴子 天津方言' },
        { name: '山东话', alias: '青岛话 济南话 胶辽官话 冀鲁官话' },
        { name: '河南话', alias: '中原官话 郑州话' },
        { name: '陕西话', alias: '关中话 西安话 秦腔' },
        { name: '山西话', alias: '晋语 太原话' },
        { name: '武汉话', alias: '湖北话 楚语 西南官话' },
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
        { name: '广西白话', alias: '南宁白话 桂柳话 粤语' },
        { name: '甘肃话', alias: '兰州话 西北方言' },
        { name: '青海话', alias: '西宁话 西北方言' },
        { name: '新疆话', alias: '乌鲁木齐话 兰银官话' },
        { name: '维吾尔语', alias: '维语 uyghur' },
        { name: '藏语', alias: '西藏话 tibetan' },
        { name: '蒙古语', alias: '蒙语 mongolian' },
        { name: '壮语', alias: '广西壮语 zhuang' },
        { name: '朝鲜语（延边）', alias: '延边话 朝语' },

        // 常见外语与地区变体
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

        // 欧洲其他语言
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

        // 南亚 / 中东 / 中亚 / 非洲 / 古语
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

    // 6 个语音模型配置预设
    const VOICE_PROVIDERS = [
        {
            id: 'minimax',
            label: 'MiniMax',
            cnUrl: 'https://api.minimax.chat/v1/t2a_v2',
            intlUrl: 'https://api.minimax.io/v1/t2a_v2',
            defaultModel: 'speech-02-hd',
            needGroupId: true,
            voicePlaceholder: '音色 ID（如 male-qn-qingse）'
        },
        {
            id: 'elevenlabs',
            label: 'ElevenLabs',
            defaultUrl: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
            defaultModel: 'eleven_multilingual_v2',
            needGroupId: false,
            voicePlaceholder: 'Voice ID'
        },
        {
            id: 'fish',
            label: 'Fish Audio',
            defaultUrl: 'https://api.fish.audio/v1/tts',
            defaultModel: 's2-pro',
            needGroupId: false,
            voicePlaceholder: 'Reference ID / 音色 ID'
        },
        {
            id: 'openai',
            label: 'OpenAI',
            defaultUrl: 'https://api.openai.com/v1/audio/speech',
            defaultModel: 'gpt-4o-mini-tts',
            needGroupId: false,
            voicePlaceholder: '音色名（如 coral / nova / alloy）'
        },
        {
            id: 'siliconflow',
            label: '硅基流动',
            defaultUrl: 'https://api.siliconflow.cn/v1/audio/speech',
            defaultModel: 'FunAudioLLM/CosyVoice2-0.5B',
            needGroupId: false,
            voicePlaceholder: '音色 URI 或系统音色名'
        },
        {
            id: 'custom',
            label: '第三方',
            defaultUrl: '',
            defaultModel: '',
            needGroupId: false,
            voicePlaceholder: '音色 ID / 名称'
        }
    ];

    let currentThreadId = null;
    let overlayEl = null;
    let rootPageEl = null;
    let subPages = {};
    let toastEl = null;
    let toastTimer = null;
    let activeInputEl = null;
    let blurResetTimer = null;

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

    const SVG_MUTE_BELL = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.4 5.2a1.6 1.6 0 0 1 3.2 0"/>
            <path d="M8.9 6.3A5.6 5.6 0 0 1 17.6 11v2.9c0 1.4.6 2.6 1.6 3.4H4.8c1-.8 1.6-2 1.6-3.4v-2.6"/>
            <path d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"/>
            <line x1="4.2" y1="4.2" x2="19.8" y2="19.8"/>
        </svg>`;

    /* ---------------- iOS Safari 键盘防遮挡与防卡死适配 ---------------- */
    function isCtdInput(el) {
        if (!el) return false;
        const tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
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
            setTimeout(() => {
                syncViewportForKeyboard();
                ensureInputVisibleInScroll(activeInputEl);
            }, 80);
            setTimeout(() => {
                syncViewportForKeyboard();
                ensureInputVisibleInScroll(activeInputEl);
            }, 300);
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
        root.querySelectorAll('.ctd-back-btn, .ctd-profile-card, .ctd-row:not(.ctd-row-static), .ctd-switch, .ctd-cal-nav-btn, .ctd-cal-day.has-msg, .ctd-date-pill-clear, .ctd-msg-item, .ctd-sheet-btn, .ctd-modal-btn, .ctd-primary-btn, .ctd-provider-pill, .ctd-region-btn').forEach(bindPressed);
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
        return found ? (found.name || '已指定') : '跟随全局';
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

    /* ---------------- 聊天界面同步 ---------------- */
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
                    if (!img) avBox.innerHTML = `<img src="${escapeHtml(avData)}" alt="">`;
                    else if (img.src !== avData) img.src = avData;
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

    /* ---------------- 弹窗与动作菜单（支持别名检索 + 自由选用 + 防键盘遮挡） ---------------- */
    function openActionSheet({ title, desc, checkboxLabel, searchable, allowCustomInput, onCustomSelect, actions }) {
        const backdrop = document.createElement('div');
        backdrop.className = 'ctd-sheet-backdrop';
        let isChecked = false;

        const checkHtml = checkboxLabel ? `
            <div class="ctd-sheet-check-row" id="ctdSheetCheckRow">
                <div class="ctd-sheet-check-box">${SVG_CHECK}</div>
                <span class="ctd-sheet-check-text">${escapeHtml(checkboxLabel)}</span>
            </div>
        ` : '';

        const searchHtml = searchable ? `
            <div class="ctd-sheet-search-wrap">
                <input type="text" class="ctd-sheet-search-input" id="ctdSheetSearchInput" placeholder="搜索任意语言或方言...">
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

        const listBox = backdrop.querySelector('#ctdSheetList');
        function renderList(filterText) {
            const rawKw = (filterText || '').trim();
            const kw = rawKw.toLowerCase();
            const items = actions
                .map((a, idx) => ({ a, idx }))
                .filter(({ a }) => {
                    if (!kw) return true;
                    const hay = ((a.label || '') + ' ' + (a.keywords || '')).toLowerCase();
                    return hay.includes(kw);
                });

            let html = items.map(({ a, idx }) => `
                <button type="button" class="ctd-sheet-btn ${a.danger ? 'danger' : ''} ${a.selected ? 'selected' : ''}" data-idx="${idx}">${escapeHtml(a.label)}</button>
            `).join('');

            const exactMatch = items.some(({ a }) => (a.rawName || a.label).toLowerCase() === kw);
            if (allowCustomInput && rawKw && !exactMatch) {
                html += `<button type="button" class="ctd-sheet-btn selected" data-custom-val="${escapeHtml(rawKw)}">使用「${escapeHtml(rawKw)}」</button>`;
            }

            if (!html) {
                html = `<div class="ctd-empty-hint" style="padding:16px;">无匹配项</div>`;
            }
            listBox.innerHTML = html;
            bindAllPressed(listBox);
        }

        renderList('');
        document.body.appendChild(backdrop);
        bindAllPressed(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('open'));

        const searchInput = backdrop.querySelector('#ctdSheetSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => renderList(searchInput.value));
        }

        const checkRow = backdrop.querySelector('#ctdSheetCheckRow');
        if (checkRow) {
            checkRow.addEventListener('click', (e) => {
                e.stopPropagation();
                isChecked = !isChecked;
                checkRow.classList.toggle('checked', isChecked);
            });
        }

        function close() {
            if (document.activeElement && backdrop.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            activeInputEl = null;
            resetViewportContainers();
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 240);
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop || e.target.closest('[data-cancel="1"]')) {
                close();
                return;
            }
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
                if (actions[idx] && typeof actions[idx].onClick === 'function') {
                    actions[idx].onClick(isChecked);
                }
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
            allowCustomInput: true,
            onCustomSelect: (val) => onSelect(val),
            actions: items
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
            ${buildSubPage('ctDetailsVoiceLoreView', '语音模型世界书', 'ctdVoiceLoreScroll')}
            ${buildSubPage('ctDetailsThemeView', '聊天界面设定', 'ctdThemeScroll')}
            ${buildSubPage('ctDetailsMemoryView', '记忆宫殿', 'ctdMemoryScroll')}
        `;
        mountParent.appendChild(overlayEl);

        rootPageEl = document.getElementById('ctDetailsMainView');
        [
            'ctDetailsProfileView', 'ctDetailsSearchView', 'ctDetailsApiView',
            'ctDetailsCotView', 'ctDetailsPresetView', 'ctDetailsLoreView',
            'ctDetailsVoiceView', 'ctDetailsVoiceLoreView', 'ctDetailsThemeView',
            'ctDetailsMemoryView'
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
        if (document.activeElement && pageEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        activeInputEl = null;
        resetViewportContainers();
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
        if (document.activeElement && overlayEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        activeInputEl = null;
        resetViewportContainers();
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

        // 1. 资料卡
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

        // 3. 查找聊天记录
        const searchCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdSearchEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">查找聊天记录</div></div>
                    <div class="ctd-row-right"><span class="ctd-chevron">${SVG_CHEVRON}</span></div>
                </div>
            </div>
        `;

        // 4. 感知真实天气 & 地点
        const weatherSub = settings.realWeather ? (cache.weatherText || '同步中...') : '';
        const locationSub = settings.realLocation ? (cache.locationText || '同步中...') : '';

        const realEnvCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实天气</div>
                        ${weatherSub ? `<div class="ctd-row-sub">${escapeHtml(weatherSub)}</div>` : ''}
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.realWeather ? 'on' : ''}" id="ctdWeatherSwitch" aria-label="感知真实天气"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left">
                        <div class="ctd-row-title">感知真实地点</div>
                        ${locationSub ? `<div class="ctd-row-sub">${escapeHtml(locationSub)}</div>` : ''}
                    </div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.realLocation ? 'on' : ''}" id="ctdLocationSwitch" aria-label="感知真实地点"></button>
                    </div>
                </div>
            </div>
        `;

        // 5. 独立 API
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

        // 6. 专属思维链 / 专属预设 / 单独挂载世界书
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

        // 7. 语言与翻译
        const langCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动展开翻译</div></div>
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
                        <span class="ctd-row-value">${escapeHtml(settings.translateLang || '简体中文')}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 8. 启用语音模型 + 语音模型世界书（主界面直接入口）
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

        // 9. 聊天界面设定（独立小卡片）
        const themeCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdThemeEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">聊天界面设定</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">默认</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 10. 记忆宫殿
        const memCount = getCharMemories(thread).length;
        const memoryCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row" id="ctdMemoryEntryRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">记忆宫殿</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${memCount ? `${memCount} 条` : '暂无'}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
            </div>
        `;

        // 11. 拉黑
        const blockCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ${settings.blocked ? 'ctd-row-center' : 'ctd-row-danger'}" id="ctdBlockRow">
                    <div class="ctd-row-title">${settings.blocked ? '已拉黑（点击解除）' : '拉黑'}</div>
                </div>
            </div>
        `;

        // 12. 导出 / 导入聊天记录（合卡居中红字）
        const ioCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdExportRow">
                    <div class="ctd-row-title">导出聊天记录</div>
                </div>
                <div class="ctd-row ctd-row-danger" id="ctdImportRow">
                    <div class="ctd-row-title">导入聊天记录</div>
                </div>
            </div>
        `;

        // 13. 清空聊天记录（最底下）
        const clearCardHtml = `
            <div class="ctd-card">
                <div class="ctd-row ctd-row-danger" id="ctdClearChatRow">
                    <div class="ctd-row-title">清空聊天记录</div>
                </div>
            </div>
        `;

        scrollEl.innerHTML =
            profileHtml + basicCardHtml + searchCardHtml + realEnvCardHtml +
            apiCardHtml + coreCardHtml + langCardHtml + voiceCardHtml +
            themeCardHtml + memoryCardHtml + blockCardHtml + ioCardHtml + clearCardHtml;

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
                    showToast('未能获取天气信息');
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
                    showToast('未能获取位置信息');
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
            openLanguagePicker({
                title: '选择角色输出语言',
                currentVal: cur.charOutputLang || '跟随预设',
                extraTopItem: '跟随预设',
                onSelect: (lang) => {
                    updateThreadSettings(currentThreadId, { charOutputLang: lang });
                    renderMainView();
                }
            });
        });

        document.getElementById('ctdSecondLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openLanguagePicker({
                title: '选择角色第二语言',
                currentVal: cur.charSecondLang || '无',
                extraTopItem: '无',
                onSelect: (lang) => {
                    updateThreadSettings(currentThreadId, { charSecondLang: lang });
                    renderMainView();
                }
            });
        });

        document.getElementById('ctdTransLangRow').addEventListener('click', () => {
            const cur = getThreadSettings(currentThreadId);
            openLanguagePicker({
                title: '选择翻译语言',
                currentVal: cur.translateLang || '简体中文',
                extraTopItem: null,
                onSelect: (lang) => {
                    updateThreadSettings(currentThreadId, { translateLang: lang });
                    renderMainView();
                }
            });
        });

        document.getElementById('ctdVoiceEntryRow').addEventListener('click', () => {
            renderVoiceSubView();
            openSubPage(subPages.ctDetailsVoiceView);
        });

        document.getElementById('ctdVoiceLoreEntryRow').addEventListener('click', () => {
            renderVoiceLoreView();
            openSubPage(subPages.ctDetailsVoiceLoreView);
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

    /* ---------------- 二级页：资料设置 ---------------- */
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
                    <div class="ctd-row-left"><div class="ctd-row-title">${isGroup ? '群聊备注' : '修改备注'}</div></div>
                    <div class="ctd-row-right">
                        <span class="ctd-row-value">${escapeHtml(settings.remark || displayName)}</span>
                        <span class="ctd-chevron">${SVG_CHEVRON}</span>
                    </div>
                </div>
                <div class="ctd-row" id="ctdSubAvatarRow">
                    <div class="ctd-row-left"><div class="ctd-row-title">修改头像</div></div>
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
                showToast('头像已更新');
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
                    <div class="ctd-row-left"><div class="ctd-row-title">跟随全局 API</div></div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${!selectedId ? 'checked' : ''}">${!selectedId ? SVG_CHECK : ''}</div>
                    </div>
                </div>
            </div>
        `;

        let listHtml = '';
        if (!bundles.length) {
            listHtml = `<div class="ctd-empty-hint">暂无已保存的配置组，请先在「API」中添加</div>`;
        } else {
            const rowsHtml = bundles.map(b => {
                const isSel = selectedId === b.id;
                return `
                    <div class="ctd-row ctd-api-bundle-row" data-bundle-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || '未命名配置')}</div>
                            ${b.model ? `<div class="ctd-row-sub">${escapeHtml(b.model)}</div>` : ''}
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${isSel ? 'checked' : ''}">${isSel ? SVG_CHECK : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
            listHtml = `<div class="ctd-section-label">独立配置（单选）</div><div class="ctd-card">${rowsHtml}</div>`;
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
                showToast('已指定独立 API');
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
                    <div class="ctd-row-left"><div class="ctd-row-title">显示思维链</div></div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.cotShow ? 'on' : ''}" id="ctdCotShowSwitch" aria-label="显示思维链"></button>
                    </div>
                </div>
            </div>
            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">自定义思维链</div>
                <textarea class="ctd-textarea" id="ctdCotTextarea" placeholder="输入自定义思维链内容...">${escapeHtml(settings.cotCustom || '')}</textarea>
            </div>
            <button type="button" class="ctd-primary-btn" id="ctdCotSaveBtn">保存</button>
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
            const ta = document.getElementById('ctdCotTextarea');
            const val = ta.value.trim();
            ta.blur();
            updateThreadSettings(currentThreadId, { cotCustom: val });
            showToast('已保存思维链设置');
        });
    }

    /* ---------------- 二级页：启用语音模型 ---------------- */
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
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceEnabled ? 'on' : ''}" id="ctdVoiceEnableSw" aria-label="允许发送语音"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动播放</div></div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceAutoPlay ? 'on' : ''}" id="ctdVoiceAutoSw" aria-label="自动播放"></button>
                    </div>
                </div>
                <div class="ctd-row ctd-row-static">
                    <div class="ctd-row-left"><div class="ctd-row-title">自动标注情绪</div></div>
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceEmotionTag ? 'on' : ''}" id="ctdVoiceEmotionSw" aria-label="自动标注情绪"></button>
                    </div>
                </div>
            </div>

            <div class="ctd-card ctd-field-card">
                <div class="ctd-field-label">模型配置</div>
                <div class="ctd-provider-grid">${providerGridHtml}</div>
                ${regionHtml}

                <div class="ctd-input-label">接口地址（支持直接修改为第三方中转）</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceUrlInput" placeholder="https://..." value="${escapeHtml(settings.voiceApiUrl || '')}">

                <div class="ctd-input-label">API Key</div>
                <input type="password" class="ctd-input-clean" id="ctdVoiceKeyInput" placeholder="输入 API Key" value="${escapeHtml(settings.voiceApiKey || '')}">

                ${groupIdHtml}

                <div class="ctd-input-label">模型名称</div>
                <input type="text" class="ctd-input-clean" id="ctdVoiceModelInput" placeholder="输入模型名" value="${escapeHtml(settings.voiceModel || '')}">

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
                if (pid === 'minimax') {
                    autoUrl = (cur.voiceMinimaxRegion === 'intl') ? meta.intlUrl : meta.cnUrl;
                }
                updateThreadSettings(currentThreadId, {
                    voiceProvider: pid,
                    voiceApiUrl: autoUrl,
                    voiceModel: meta.defaultModel || ''
                });
                renderVoiceSubView();
            });
        });

        scrollEl.querySelectorAll('.ctd-region-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reg = btn.dataset.mmRegion;
                const meta = getProviderMeta('minimax');
                updateThreadSettings(currentThreadId, {
                    voiceMinimaxRegion: reg,
                    voiceApiUrl: reg === 'intl' ? meta.intlUrl : meta.cnUrl
                });
                renderVoiceSubView();
            });
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

    /* ---------------- 二级页：语音模型世界书 ---------------- */
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
                    <div class="ctd-row-right">
                        <button type="button" class="ctd-switch ${settings.voiceLoreOverride ? 'on' : ''}" id="ctdVoiceLoreSwitch" aria-label="启用语音模型世界书"></button>
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
                    <div class="ctd-row ctd-vlore-book-row" data-book-id="${escapeHtml(b.id)}">
                        <div class="ctd-row-left">
                            <div class="ctd-row-title">${escapeHtml(b.name || b.title || '未命名世界书')}</div>
                            ${entryCount ? `<div class="ctd-row-sub">${entryCount} 条词条</div>` : ''}
                        </div>
                        <div class="ctd-row-right">
                            <div class="ctd-check-circle ${checked ? 'checked' : ''}">${checked ? SVG_CHECK : ''}</div>
                        </div>
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
                if (!bid) return;
                const cur = getThreadSettings(currentThreadId);
                const set = new Set(Array.isArray(cur.voiceLoreIds) ? cur.voiceLoreIds : []);
                if (set.has(bid)) set.delete(bid);
                else set.add(bid);
                updateThreadSettings(currentThreadId, { voiceLoreOverride: true, voiceLoreIds: Array.from(set) });
                renderVoiceLoreView();
            });
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
                    <div class="ctd-row-left"><div class="ctd-row-title">默认</div></div>
                    <div class="ctd-row-right">
                        <div class="ctd-check-circle ${(!settings.chatTheme || settings.chatTheme === 'default') ? 'checked' : ''}">${SVG_CHECK}</div>
                    </div>
                </div>
            </div>
        `;
        bindAllPressed(scrollEl);
        document.getElementById('ctdThemeDefaultRow').addEventListener('click', () => {
            updateThreadSettings(currentThreadId, { chatTheme: 'default' });
            showToast('当前已使用默认界面');
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
            listHtml = `<div class="ctd-empty-hint">当前角色暂无长期记忆</div>`;
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
                    <div class="ctd-row-left"><div class="ctd-row-title">前往「记忆」管理</div></div>
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

    /* ---------------- 二级页：查找聊天记录 ---------------- */
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
                            ${count ? `<div class="ctd-row-sub">${count} 条提示词</div>` : ''}
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
                    <div class="ctd-row-left"><div class="ctd-row-title">启用单独挂载</div></div>
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
                            ${entryCount ? `<div class="ctd-row-sub">${entryCount} 条词条</div>` : ''}
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
            showToast(next.loreOverride ? '已开启单独挂载' : '已切换为跟随全局');
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
                    showToast('背景保存失败');
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
                    if (!arr) {
                        showToast('文件格式无效');
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
                    showToast(`已导入 ${arr.length} 条记录`);
                } catch (e) {
                    showToast('导入文件解析失败');
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
        sortThreadsByPin();
        syncRoomTitleAndBellUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
