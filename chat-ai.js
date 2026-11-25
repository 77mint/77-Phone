/* =========================================================
   Chat 完整 AI 对话引擎 (chat-ai.js)
   - 对接 PhoneAPI（主/备 API 重试 + 单聊独立 API 组 + 独立翻译 API + 日志）
   - 对接 PhonePresets（线上预设槽位编排 + Temperature）
   - 对接 PhoneLorebook（全局/局部 + 单聊单独挂载 + 前/后/深度插入）
   - 对接 PhoneMemory（相关记忆检索注入 + 周期自动总结归档）
   - 对接 PhoneChatDetails（真实时间/天气/地点、思维链、语言翻译、TTS语音、表情包）
   - 支持 群聊多角色轮流回复、重roll、特殊消息（转账/礼物/一起听/图片/语音）理解
   - 接入 reverse/takeover.js（[TAKEOVER:...]）及打字犹豫（[RETYPE] / [GIVEUP]）
   ========================================================= */

(function () {
    const STORAGE_THREADS_KEY = 'chat_threads_v1';
    const STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
    const STORAGE_CHAR_REMARKS = 'chat_char_user_remarks_v1';
    const STORAGE_TAKEOVER_CTX_PREFIX = 'chat_takeover_ctx_v1_';
    const STORAGE_STICKER_PACKS_KEY = 'chat_sticker_packs_v1';
    const STORAGE_CHAR_STOLEN_STICKERS = 'chat_char_stolen_stickers_v1';
    const STORAGE_MEM_SUM_IDX_PREFIX = 'chat_mem_sum_idx_v1_';
    const API_BUNDLES_KEY = 'phone_api_bundle_presets';
    const API_CONFIG_KEY = 'phone_api_config_v2';
    const DEFAULT_MAX_HISTORY = 24;

    const activeRuns = {};
    const runningThreads = new Set();

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

    function showAiToast(msg) {
        const el = document.getElementById('ctToast');
        if (!el || !msg) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(showAiToast._timer);
        showAiToast._timer = setTimeout(() => el.classList.remove('show'), 2400);
    }

    function setRoomTyping(threadId, isTyping) {
        if (window.PhoneChat && typeof window.PhoneChat.setTyping === 'function') {
            window.PhoneChat.setTyping(threadId, isTyping);
            return;
        }
        const titleEl = document.getElementById('ctRoomTitle');
        if (!titleEl) return;
        if (isTyping) {
            if (!titleEl.classList.contains('is-typing')) {
                titleEl.dataset.prevTitle = titleEl.textContent || '';
            }
            titleEl.classList.add('is-typing');
            titleEl.textContent = '对方正在输入中…';
        } else {
            titleEl.classList.remove('is-typing');
            if (titleEl.dataset.prevTitle) {
                titleEl.textContent = titleEl.dataset.prevTitle;
            }
        }
    }

    function getThreadDetails(threadId) {
        try {
            if (threadId && window.PhoneChatDetails && typeof window.PhoneChatDetails.getSettings === 'function') {
                return window.PhoneChatDetails.getSettings(threadId) || {};
            }
        } catch (e) {}
        return {};
    }

    function getArchiveChar(charId) {
        try {
            if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
                const list = window.PhoneArchive.getChars() || [];
                return list.find(c => c.id === charId) || null;
            }
        } catch (e) {}
        return null;
    }

    function getUserContext() {
        let name = '我';
        let persona = '';
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
                const acc = window.PhoneChatMe.getActiveAccount();
                if (acc) {
                    name = acc.name || name;
                    if (acc.signature) persona = acc.signature;
                    if (acc.maskId && window.PhoneMask) {
                        let mask = null;
                        if (typeof window.PhoneMask.getMaskById === 'function') {
                            mask = window.PhoneMask.getMaskById(acc.maskId);
                        } else if (typeof window.PhoneMask.getMasks === 'function') {
                            const masks = window.PhoneMask.getMasks() || [];
                            mask = masks.find(m => m.id === acc.maskId) || null;
                        }
                        if (mask) {
                            if (mask.name) name = mask.name;
                            const mDesc = mask.persona || mask.bio || mask.setting || mask.desc || '';
                            if (mDesc) persona = mDesc;
                        }
                    }
                }
            }
        } catch (e) {}
        return { name, persona };
    }

    function isCharPasscodeChangeAllowed() {
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getPrefs === 'function') {
                const prefs = window.PhoneChatMe.getPrefs() || {};
                if (typeof prefs.allowCharChangePasscode === 'boolean') {
                    return prefs.allowCharChangePasscode;
                }
            }
        } catch (e) {}
        return false;
    }

    function getCurrentRemark(charId) {
        const map = loadJSON(STORAGE_CHAR_REMARKS, {});
        return (map && map[charId]) || '';
    }

    function setCharRemark(charId, newRemark) {
        if (!charId || !newRemark) return;
        const map = loadJSON(STORAGE_CHAR_REMARKS, {});
        map[charId] = String(newRemark).trim().slice(0, 24);
        saveJSON(STORAGE_CHAR_REMARKS, map);
    }

    /* ---------------- 表情包工具 ---------------- */
    function getAllStickerPacks() {
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getStickerPacks === 'function') {
                return window.PhoneChatMe.getStickerPacks() || [];
            }
        } catch (e) {}
        return loadJSON(STORAGE_STICKER_PACKS_KEY, []);
    }

    function getMountedStickers(charId, details) {
        const out = [];
        const seen = new Set();

        if (details && details.stickerCharRead) {
            const packs = getAllStickerPacks();
            const packIds = Array.isArray(details.stickerPackIds) ? details.stickerPackIds : [];
            packs.forEach(pack => {
                if (!pack || (!packIds.includes(pack.id) && !packIds.includes(pack.name))) return;
                (pack.items || pack.stickers || []).forEach(st => {
                    if (!st || !st.name) return;
                    const key = st.id || st.dbKey || st.name;
                    if (seen.has(key)) return;
                    seen.add(key);
                    out.push({
                        id: st.id || '',
                        name: String(st.name).trim(),
                        tag: st.tag ? String(st.tag).trim() : '',
                        dbKey: st.dbKey || ''
                    });
                });
            });
        }

        if (charId && details && details.stickerAllowSteal) {
            const stolenMap = loadJSON(STORAGE_CHAR_STOLEN_STICKERS, {});
            const stolenList = Array.isArray(stolenMap[charId]) ? stolenMap[charId] : [];
            stolenList.forEach(st => {
                if (!st || !st.name) return;
                const key = st.id || st.dbKey || st.name;
                if (seen.has(key)) return;
                seen.add(key);
                out.push({
                    id: st.id || '',
                    name: String(st.name).trim(),
                    tag: st.tag ? String(st.tag).trim() : '',
                    dbKey: st.dbKey || ''
                });
            });
        }

        return out.slice(0, 80);
    }

    async function getStickerDataUrl(dbKey) {
        if (!dbKey) return '';
        try {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.getStickerImage === 'function') {
                return (await window.PhoneChatMe.getStickerImage(dbKey)) || '';
            }
            if (window.PhoneDB && typeof window.PhoneDB.get === 'function') {
                return (await window.PhoneDB.get(dbKey)) || '';
            }
        } catch (e) {}
        return '';
    }

    function parseDataUrl(dataUrl) {
        const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
        if (!m) return null;
        return {
            mimeType: m[1] || 'image/png',
            base64: m[2],
            dataUrl
        };
    }

    function stealLatestUserSticker(threadId, charId) {
        if (!threadId || !charId) return null;
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            if (m && m.sender === 'me' && m.type === 'sticker' && (m.stickerDbKey || m.stickerName)) {
                const stolenMap = loadJSON(STORAGE_CHAR_STOLEN_STICKERS, {});
                const list = Array.isArray(stolenMap[charId]) ? stolenMap[charId] : [];
                const exists = list.some(item =>
                    (m.stickerDbKey && item.dbKey === m.stickerDbKey) ||
                    (m.stickerId && item.id === m.stickerId)
                );
                if (!exists) {
                    list.unshift({
                        id: m.stickerId || ('st_' + Date.now()),
                        name: m.stickerName || '表情包',
                        tag: '',
                        dbKey: m.stickerDbKey || '',
                        stolenAt: Date.now()
                    });
                    stolenMap[charId] = list.slice(0, 60);
                    saveJSON(STORAGE_CHAR_STOLEN_STICKERS, stolenMap);
                }
                return {
                    name: m.stickerName || '表情包',
                    isNew: !exists
                };
            }
        }
        return null;
    }

    /* ---------------- 世界书 / 预设 / 记忆 / 真实环境采集 ---------------- */
    function matchLoreEntries(haystackText, charId, overrideBookIds) {
        const res = { before: [], after: [], depth: [] };
        if (!window.PhoneLorebook) return res;

        let matched = [];
        if (Array.isArray(overrideBookIds)) {
            if (!overrideBookIds.length) return res;
            const books = typeof window.PhoneLorebook.getBooks === 'function' ? window.PhoneLorebook.getBooks() : [];
            const haystack = String(haystackText || '').toLowerCase();
            books.forEach(b => {
                if (!b || !overrideBookIds.includes(b.id)) return;
                (b.entries || []).forEach(e => {
                    if (!e || !e.enabled || !e.content) return;
                    if (e.constant) {
                        matched.push(e);
                        return;
                    }
                    const keys = String(e.keys || '').split(/[,，\n]+/).map(k => k.trim().toLowerCase()).filter(Boolean);
                    if (keys.some(k => haystack.indexOf(k) !== -1)) matched.push(e);
                });
            });
        } else if (typeof window.PhoneLorebook.matchContext === 'function') {
            matched = window.PhoneLorebook.matchContext(haystackText, { charId: charId || '', scene: 'online' }) || [];
        }

        matched.forEach(e => {
            if (!e || !e.content) return;
            const pos = e.position || 'after';
            if (pos === 'before') res.before.push(e.content);
            else if (pos === 'depth') res.depth.push({ depth: Number(e.depth) || 4, content: e.content });
            else res.after.push(e.content);
        });
        return res;
    }

    function getEffectivePresetObj(threadId) {
        try {
            if (window.PhoneChatDetails && typeof window.PhoneChatDetails.getEffectivePreset === 'function') {
                const p = window.PhoneChatDetails.getEffectivePreset(threadId);
                if (p) return p;
            }
        } catch (e) {}
        try {
            if (window.PhonePresets && typeof window.PhonePresets.getActivePreset === 'function') {
                return window.PhonePresets.getActivePreset('online');
            }
        } catch (e) {}
        return null;
    }

    async function getRelevantMemoriesText(queryText, charId) {
        if (!window.PhoneMemory || typeof window.PhoneMemory.search !== 'function') return '';
        try {
            const cfg = typeof window.PhoneMemory.getConfig === 'function' ? window.PhoneMemory.getConfig() : {};
            const list = await window.PhoneMemory.search(queryText || '', {
                charId: charId || '',
                topK: Number(cfg.topK) || 4
            });
            if (!Array.isArray(list) || !list.length) return '';
            return '【长期记忆】\n' + list.map(m => `- ${m.content}`).join('\n');
        } catch (e) {
            return '';
        }
    }

    async function getRealEnvText(threadId, details) {
        if (!details || (!details.realTime && !details.realWeather && !details.realLocation)) return '';
        try {
            if (window.PhoneChatDetails && typeof window.PhoneChatDetails.getRealContext === 'function') {
                const ctx = await window.PhoneChatDetails.getRealContext(threadId);
                if (!ctx) return '';
                const lines = [];
                if (ctx.timeText) lines.push(`当前真实时间：${ctx.timeText}`);
                if (ctx.weatherText) lines.push(`当前真实天气：${ctx.weatherText}`);
                if (ctx.locationText) lines.push(`当前真实地点：${ctx.locationText}`);
                return lines.length ? ('【当前真实环境】\n' + lines.join('\n')) : '';
            }
        } catch (e) {}
        return '';
    }

    /* ---------------- 系统提示词构建 ---------------- */
    function buildCoreRules(isGroup, members, charObj, userCtx, details, mountedStickers, hasUserStickerInHistory, memoriesText, realEnvText, voiceLoreText) {
        const showCot = !!(details && details.cotShow);
        const customCot = (details && details.cotCustom) ? String(details.cotCustom).trim() : '';
        const outLang = (details && details.charOutputLang && details.charOutputLang !== '跟随预设') ? details.charOutputLang : '';
        const secLang = (details && details.charSecondLang && details.charSecondLang !== '无') ? details.charSecondLang : '';
        const transLang = (details && details.translateLang) || '简体中文';
        const transMode = (details && details.translateMode) || 'bundled';
        const voiceOn = !!(details && details.voiceEnabled);

        let block = '';
        if (isGroup) {
            const memberDescs = members.map(m => {
                const mName = m.name || m.nickname || '成员';
                const mPer = m.persona || m.bio || m.setting || '性格自然真实';
                return `- 成员「${mName}」：${mPer}`;
            }).join('\n');
            block +=
                `你正在一个微信群聊里和大家聊天。请完全沉浸在群聊成员的日常氛围中回复，绝对不要用 AI 助手腔调。\n\n` +
                `【群成员设定】\n${memberDescs}\n\n` +
                `【User（我方）信息】\n网名：${userCtx.name}` +
                (userCtx.persona ? `\n人设/身份：${userCtx.persona}` : '') + '\n\n';
        } else {
            const charName = (charObj && (charObj.name || charObj.nickname)) || '对方';
            const charPersona = (charObj && (charObj.persona || charObj.bio || charObj.setting)) || '性格自然真实、有自己生活节奏的普通人';
            const currentRemark = charObj ? getCurrentRemark(charObj.id) : '';
            block +=
                `你正在手机微信里和对方聊天。请完全以「${charName}」的身份自然回复，绝对不要跳出角色或用 AI 助手腔调说话。\n\n` +
                `【你的设定】\n姓名：${charName}\n人设：${charPersona}\n\n` +
                `【对方（User）信息】\n网名：${userCtx.name}` +
                (userCtx.persona ? `\n对方人设/身份：${userCtx.persona}` : '') +
                (currentRemark ? `\n你目前在微信里给对方的备注是：${currentRemark}` : '') + '\n\n';
        }

        if (memoriesText) block += memoriesText + '\n\n';
        if (realEnvText) block += realEnvText + '\n\n';
        if (voiceLoreText) block += `【语音语气参考】\n${voiceLoreText}\n\n`;

        block += `【聊天规则（务必遵守）】\n` +
            `1. 用真实微信聊天的口吻打字，不要写小说旁白或 *动作描写*。\n`;

        if (isGroup) {
            block += `2. 请让 1~3 位合适的群成员自然接话。每条消息开头必须标注发言人格式：[SPEAKER:成员精确姓名]台词内容，多条消息之间严格用 ||| 分隔。\n`;
        } else {
            block += `2. 根据你的人设和当下情绪决定一次发几条消息：话多、激动或碎碎念时可以连发多条短句，高冷或简短时发 1~2 条即可。多条消息之间请严格用 ||| 分隔（不要加编号）。\n`;
        }

        if (outLang) {
            block += `3. 输出语言要求：请主要使用「${outLang}」进行回复` +
                (secLang ? `，必要时可自然夹杂「${secLang}」` : '') + '。\n';
        } else if (secLang) {
            block += `3. 语言习惯：必要时可自然夹杂第二语言「${secLang}」。\n`;
        }

        if (transMode !== 'api') {
            block += `4. 如果某条台词主要是外语或方言，请在该条末尾紧接 [TRANS:对应的自然${transLang}翻译]，没有则不要加。\n`;
        }

        if (!isGroup) {
            block += `5. 如果你根据人设和两人当下关系变化，想悄悄修改你微信里对对方的备注，可在整段回复最后附带一行 [REMARK:新备注]。\n`;
            block += `6. 真实打字犹豫（平时正常聊天不要使用）：只有在你当下真的欲言又止、打了一半又删掉重打时，才在回复正文前加一个 [RETYPE]（或 [RETYPE:2]）；如果打完又全部删掉决定什么都不发，则只输出 [GIVEUP]。\n`;
            if (isCharPasscodeChangeAllowed()) {
                block += `7. 你的微信锁屏密码平时保持稳定；只有当你的人设性格或当前情绪/关系真的促使你想换密码时，才在最后附带一行 [PASSCODE:6到16位字母或数字]。\n`;
            }
            block += `8. 反向顶号（平时正常聊天不要随便用）：只有当你的性格与情绪真的促使你直接登录 User 的微信号把对方踢下线时，才在最后附带一行 [TAKEOVER:短句1|短句2|短句3|...]（6~12 句短句）。\n`;
        }

        if (mountedStickers && mountedStickers.length) {
            const listText = mountedStickers.map(s => (s.tag ? `${s.name}(${s.tag})` : s.name)).join('、');
            block += `• 发送表情包：你当前可用以下表情包【${listText}】。语气合适时可发 1 张，用 ||| 隔开并写 [STICKER:精确名称]（必须严格来自列表）。\n`;
        }

        if (!isGroup && details && details.stickerAllowSteal && hasUserStickerInHistory) {
            block += `• 偷表情包：如果你很喜欢对方刚发的表情包想存下来，可在最后附带一行 [STEAL_STICKER]。\n`;
        }

        if (voiceOn) {
            block += `• 发送语音条：当场景或情绪适合发语音时，可用 ||| 隔开并输出 [VOICE:想说的纯口语台词]` +
                (details.voiceEmotionTag ? `（可在句前加简短语气标签如 (轻笑)）` : '') + `。\n`;
        }

        if (showCot && !isGroup) {
            block +=
                `\n【通用思考过程格式（每一轮必须输出，不可省略）】\n` +
                (customCot
                    ? `回复的最开头必须先用 [COT]...[/COT] 写出你的内心思考（纯文本自然书写，禁止使用 **、# 等 Markdown 符号），要求：${customCot}\n`
                    : `回复的最开头必须先用 [COT]...[/COT] 写一段简短真实的第一人称内心想法（纯文本自然书写，禁止使用 **、# 等 Markdown 符号）。\n`) +
                `示例：\n[COT]她怎么突然这么问，有点开心又不想表现得太明显。[/COT]\n怎么啦|||突然问这个干嘛`;
        }

        return block;
    }

    function assembleSystemPromptWithPreset(preset, coreBlock, loreRes) {
        const beforeText = (loreRes && loreRes.before && loreRes.before.length) ? ('【世界设定（前置）】\n' + loreRes.before.join('\n\n')) : '';
        const afterText = (loreRes && loreRes.after && loreRes.after.length) ? ('【世界设定（补充）】\n' + loreRes.after.join('\n\n')) : '';

        if (!preset || !Array.isArray(preset.entries) || !preset.entries.some(e => e.enabled)) {
            return [beforeText, coreBlock, afterText].filter(Boolean).join('\n\n');
        }

        const preParts = [];
        const postParts = [];
        let seenHistory = false;
        let injectedChar = false;
        let injectedBefore = false;
        let injectedAfter = false;

        preset.entries.forEach(entry => {
            if (!entry || !entry.enabled) return;
            const target = seenHistory ? postParts : preParts;
            if (entry.slot === 'history') {
                seenHistory = true;
            } else if (entry.slot === 'char') {
                target.push(coreBlock);
                injectedChar = true;
            } else if (entry.slot === 'lore_before') {
                if (beforeText) target.push(beforeText);
                injectedBefore = true;
            } else if (entry.slot === 'lore_after') {
                if (afterText) target.push(afterText);
                injectedAfter = true;
            } else if (entry.slot === 'text' && entry.content) {
                target.push(entry.content);
            }
        });

        if (!injectedBefore && beforeText) preParts.unshift(beforeText);
        if (!injectedChar) preParts.push(coreBlock);
        if (!injectedAfter && afterText) preParts.push(afterText);
        if (postParts.length) preParts.push('【补充指令】\n' + postParts.join('\n\n'));

        return preParts.filter(Boolean).join('\n\n');
    }

    /* ---------------- 历史消息格式化（含转账/礼物/一起听/图片/语音） ---------------- */
    function formatMessageForAI(m, isGroup) {
        if (!m) return '';
        let text = '';
        if (m.type === 'voice') {
            text = m.transcript ? `[语音] ${m.transcript}` : `[语音 ${m.duration || 1}秒]`;
        } else if (m.type === 'sticker') {
            text = `[发送了表情包：${m.stickerName || '表情包'}]`;
        } else if (m.type === 'image') {
            text = m.text ? `[发送了图片：${m.text}]` : '[发送了图片]';
        } else if (m.type === 'transfer') {
            const amt = Number(m.amount || 0).toFixed(2);
            const st = m.status === 'accepted' ? '（已收款）' : (m.status === 'returned' ? '（已退回）' : '');
            text = `[转账 ¥${amt}${m.note ? '：' + m.note : ''}${st}]`;
        } else if (m.type === 'gift') {
            text = `[送出礼物：${m.title || m.text || '心意礼物'}]`;
        } else if (m.type === 'listen') {
            text = `[邀请一起听歌：${m.songTitle || m.text || '音乐'}]`;
        } else {
            text = m.text || '';
        }

        text = String(text).trim();
        if (!text) return '';

        if (m.quote && m.quote.text) {
            text = `[引用 ${m.quote.senderName || ''}：${m.quote.text}]\n${text}`;
        }

        if (isGroup && m.sender !== 'me' && m.charId) {
            const c = getArchiveChar(m.charId);
            const cName = (c && (c.name || c.nickname)) || '群成员';
            text = `[${cName}]：${text}`;
        }

        return text;
    }

    async function buildHistoryMessages(threadId, details, isGroup, depthEntries) {
        const raw = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        if (!Array.isArray(raw)) return { history: [], hasUserSticker: false, recentPlainText: '' };
        const limit = Math.max(8, Number((details && details.memoryContextLimit) || DEFAULT_MAX_HISTORY));
        const showCot = !!(details && details.cotShow);
        const allowVision = !!(details && details.stickerVision);
        const recent = raw.slice(-limit);
        const out = [];
        let hasUserSticker = false;
        const plainTexts = [];

        const visionIndices = new Set();
        let count = 0;
        for (let i = recent.length - 1; i >= 0 && count < 2; i--) {
            const m = recent[i];
            if (!m || m.sender !== 'me') continue;
            const isStickerVis = allowVision && m.type === 'sticker' && m.stickerDbKey;
            const isPhotoVis = m.type === 'image' && (m.imageDataUrl || m.dbKey);
            if (isStickerVis || isPhotoVis) {
                visionIndices.add(i);
                count++;
            }
        }

        for (let i = 0; i < recent.length; i++) {
            const m = recent[i];
            if (!m) continue;
            if (m.sender === 'me' && m.type === 'sticker') hasUserSticker = true;

            const text = formatMessageForAI(m, isGroup);
            if (!text) continue;
            if (i >= recent.length - 6) plainTexts.push(text);

            const role = m.sender === 'me' ? 'user' : 'assistant';
            let imgPayload = null;
            if (visionIndices.has(i)) {
                const rawUrl = m.imageDataUrl || await getStickerDataUrl(m.stickerDbKey || m.dbKey);
                imgPayload = parseDataUrl(rawUrl);
            }

            if (out.length && out[out.length - 1].role === role) {
                out[out.length - 1].content += (role === 'assistant' ? '\n|||\n' : '\n') + text;
                if (imgPayload) {
                    out[out.length - 1].images = out[out.length - 1].images || [];
                    out[out.length - 1].images.push(imgPayload);
                }
            } else {
                const item = { role, content: text };
                if (imgPayload) item.images = [imgPayload];
                out.push(item);
            }
        }

        // 将深度插入的世界书词条按安全方式注入到对应位置的消息前面
        if (Array.isArray(depthEntries) && depthEntries.length && out.length) {
            depthEntries.forEach(d => {
                const idx = Math.max(0, out.length - 1 - (Number(d.depth) || 4));
                out[idx].content = `【补充设定】${d.content}\n\n` + out[idx].content;
            });
        }

        if (!out.length) {
            out.push({ role: 'user', content: '（对方点开了聊天窗口，请你自然主动发一句开场白）' });
        } else if (out[out.length - 1].role === 'assistant') {
            out.push({ role: 'user', content: '（对方还没回消息，你可以顺着刚才的话题自然再继续说一两句）' });
        }

        const takeoverCtx = loadJSON(STORAGE_TAKEOVER_CTX_PREFIX + threadId, null);
        if (takeoverCtx && out.length && out[out.length - 1].role === 'user') {
            const summary = takeoverCtx.outcome === 'reclaimed'
                ? `（背景事件：刚刚你登录了 User 的账号把 User 踢下线，经过「${(takeoverCtx.clashHistory || []).join('；') || '重新登录博弈'}」，User 最终强行重新登录把你顶下了线，现在回到聊天窗口。）`
                : `（背景事件：刚刚你登录了 User 的账号把 User 踢下线，User 最终点了「退出」放弃抢号，现在重新回到聊天窗口。）`;
            out[out.length - 1].content += '\n\n' + summary;
        }

        if (showCot && !isGroup && out.length && out[out.length - 1].role === 'user') {
            out[out.length - 1].content += '\n\n(系统提醒：请在回复最开头先用 [COT]...[/COT] 写简短纯文本内心思考，不要用 Markdown 符号，再换行写微信回复正文)';
        }

        return { history: out, hasUserSticker, recentPlainText: plainTexts.join('\n') };
    }

    function stripImagesFromHistory(history) {
        return (history || []).map(h => ({ role: h.role, content: h.content }));
    }

    function cleanCotText(str) {
        return String(str || '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /* ---------------- LLM 请求（支持独立 API 配置组） ---------------- */
    function resolveBundleSlot(bundleId) {
        if (!bundleId) return null;
        let bundles = loadJSON(API_BUNDLES_KEY, []);
        if (!Array.isArray(bundles) || !bundles.length) {
            const rawCfg = loadJSON(API_CONFIG_KEY, null);
            bundles = (rawCfg && (rawCfg.bundles || rawCfg.presets)) || [];
        }
        const found = Array.isArray(bundles) ? bundles.find(b => b && b.id === bundleId) : null;
        if (!found) return null;
        const slot = found.primary || found.llm || found;
        if (slot && slot.url && slot.key && slot.model) {
            return {
                type: slot.type || 'openai',
                url: slot.url,
                key: slot.key,
                model: slot.model
            };
        }
        return null;
    }

    function normalizeBaseUrl(raw, type) {
        let u = String(raw || '').trim().replace(/\/+$/, '');
        if (!u) return '';
        if ((type === 'openai' || type === 'custom') && !/\/v\d+$/i.test(u) && u.indexOf('/v1/') === -1) {
            u += '/v1';
        }
        return u;
    }

    function readHttpError(r) {
        return r.text().then(txt => {
            const snippet = String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 180);
            return `HTTP ${r.status}${snippet ? ' - ' + snippet : ''}`;
        }).catch(() => `HTTP ${r.status}`);
    }

    async function callSingleSlot(slot, temperature, systemPrompt, history) {
        const base = normalizeBaseUrl(slot.url, slot.type);
        if (!base || !slot.key) throw new Error('尚未在「API配置」填写语言模型地址或 Key');
        if (!slot.model) throw new Error('尚未在「API配置」填写语言模型名称');

        if (slot.type === 'google') {
            const url = `${base.replace(/\/+$/, '')}/v1beta/models/${encodeURIComponent(slot.model)}:generateContent?key=${encodeURIComponent(slot.key)}`;
            const contents = history.map(h => {
                const parts = [{ text: h.content }];
                if (Array.isArray(h.images)) {
                    h.images.forEach(img => {
                        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
                    });
                }
                return { role: h.role === 'assistant' ? 'model' : 'user', parts };
            });
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: { temperature }
                })
            });
            if (!res.ok) throw new Error(await readHttpError(res));
            const data = await res.json();
            const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
            let text = '';
            let cot = '';
            parts.forEach(p => {
                if (p.thought === true) cot += (p.text || '');
                else if (typeof p.thought === 'string') cot += p.thought;
                else text += (p.text || '');
            });
            return { text: text.trim(), cot: cot.trim() };
        }

        if (slot.type === 'anthropic') {
            const url = `${base.replace(/\/+$/, '')}/v1/messages`;
            const formattedMessages = history.map(h => {
                if (Array.isArray(h.images) && h.images.length) {
                    const blocks = [{ type: 'text', text: h.content }];
                    h.images.forEach(img => {
                        blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
                    });
                    return { role: h.role, content: blocks };
                }
                return { role: h.role, content: h.content };
            });
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': slot.key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: slot.model,
                    max_tokens: 1536,
                    temperature,
                    system: systemPrompt,
                    messages: formattedMessages
                })
            });
            if (!res.ok) throw new Error(await readHttpError(res));
            const data = await res.json();
            const blocks = Array.isArray(data.content) ? data.content : [];
            let text = '';
            let cot = '';
            blocks.forEach(b => {
                if (b.type === 'thinking' || b.type === 'reasoning') cot += (b.thinking || b.reasoning || b.text || '');
                else if (b.type === 'text') text += (b.text || '');
            });
            return { text: text.trim(), cot: cot.trim() };
        }

        const url = `${base}/chat/completions`;
        const formattedMessages = history.map(h => {
            if (Array.isArray(h.images) && h.images.length) {
                const blocks = [{ type: 'text', text: h.content }];
                h.images.forEach(img => blocks.push({ type: 'image_url', image_url: { url: img.dataUrl } }));
                return { role: h.role, content: blocks };
            }
            return { role: h.role, content: h.content };
        });
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${slot.key}`
            },
            body: JSON.stringify({
                model: slot.model,
                messages: [{ role: 'system', content: systemPrompt }].concat(formattedMessages),
                temperature,
                stream: false
            })
        });
        if (!res.ok) throw new Error(await readHttpError(res));
        const data = await res.json();
        const choice = (data.choices && data.choices[0]) || {};
        const msg = choice.message || {};
        let text = '';
        let cot = String(msg.reasoning_content || msg.reasoning || msg.thinking || msg.thought || choice.reasoning_content || '').trim();
        if (Array.isArray(msg.content)) {
            msg.content.forEach(block => {
                if (!block) return;
                if (block.type === 'thinking' || block.type === 'reasoning') {
                    cot += (cot ? '\n' : '') + String(block.thinking || block.reasoning || block.text || '').trim();
                } else if (block.type === 'text' || typeof block.text === 'string') {
                    text += block.text || '';
                }
            });
        } else {
            text = String(msg.content || '');
        }
        return { text: text.trim(), cot: cot.trim() };
    }

    async function callWithVisionFallback(slot, temperature, systemPrompt, history) {
        const hasImages = Array.isArray(history) && history.some(h => Array.isArray(h.images) && h.images.length > 0);
        try {
            return await callSingleSlot(slot, temperature, systemPrompt, history);
        } catch (err) {
            if (hasImages) {
                return await callSingleSlot(slot, temperature, systemPrompt, stripImagesFromHistory(history));
            }
            throw err;
        }
    }

    async function requestLLM(systemPrompt, history, details, presetObj) {
        if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
            throw new Error('PhoneAPI 未就绪');
        }
        const cfg = window.PhoneAPI.getConfig('llm');
        const customPrimary = details && details.apiBundleId ? resolveBundleSlot(details.apiBundleId) : null;
        const primarySlot = customPrimary || (cfg && cfg.primary);

        if (!primarySlot) {
            window.PhoneAPI.addLog({ module: 'LLM', source: 'Chat 对话回复', ok: false, rawError: '未找到语言模型配置' });
            throw new Error('未找到语言模型配置');
        }

        const temp = (presetObj && typeof presetObj.temperature === 'number')
            ? presetObj.temperature
            : (cfg && typeof cfg.temperature === 'number' ? cfg.temperature : 0.8);

        try {
            const out = await callWithVisionFallback(primarySlot, temp, systemPrompt, history);
            return { out, model: primarySlot.model, retried: false, usedCustomBundle: !!customPrimary };
        } catch (err) {
            const hasBackup = cfg && cfg.backupEnabled && cfg.backup && cfg.backup.url && cfg.backup.key;
            if (cfg && cfg.autoRetry) {
                const retrySlot = hasBackup ? cfg.backup : primarySlot;
                try {
                    const out2 = await callWithVisionFallback(retrySlot, temp, systemPrompt, history);
                    return { out: out2, model: retrySlot.model, retried: true, usedBackup: hasBackup, usedCustomBundle: !!customPrimary };
                } catch (err2) {
                    window.PhoneAPI.addLog({ module: 'LLM', source: 'Chat 对话回复', ok: false, rawError: err2.message || String(err2) });
                    throw err2;
                }
            }
            window.PhoneAPI.addLog({ module: 'LLM', source: 'Chat 对话回复', ok: false, rawError: err.message || String(err) });
            throw err;
        }
    }

    /* ---------------- TTS 语音合成 ---------------- */
    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function hexToBytes(hex) {
        const clean = String(hex || '').trim();
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    async function synthesizeTTS(text, details) {
        if (!details || !details.voiceEnabled || !details.voiceApiUrl || !details.voiceApiKey) return '';
        const provider = details.voiceProvider || 'minimax';
        const speed = Math.min(2.0, Math.max(0.5, parseFloat(details.voiceSpeed || '1.0') || 1.0));
        const cleanText = String(text || '').trim();
        if (!cleanText) return '';

        try {
            if (provider === 'minimax') {
                const url = details.voiceGroupId
                    ? `${details.voiceApiUrl}${details.voiceApiUrl.includes('?') ? '&' : '?'}GroupId=${encodeURIComponent(details.voiceGroupId)}`
                    : details.voiceApiUrl;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${details.voiceApiKey}`
                    },
                    body: JSON.stringify({
                        model: details.voiceModel || 'speech-02-hd',
                        text: cleanText,
                        voice_setting: {
                            voice_id: details.voiceVoiceId || 'male-qn-qingse',
                            speed,
                            vol: 1,
                            pitch: 0
                        },
                        audio_setting: { format: 'mp3', sample_rate: 32000 }
                    })
                });
                if (!res.ok) return '';
                const data = await res.json();
                const hex = data && data.data && data.data.audio;
                if (!hex) return '';
                const blob = new Blob([hexToBytes(hex)], { type: 'audio/mpeg' });
                return await blobToDataUrl(blob);
            }

            if (provider === 'elevenlabs') {
                const voiceId = details.voiceVoiceId || '21m00Tcm4TlvDq8ikWAM';
                const url = String(details.voiceApiUrl).replace('{voice_id}', encodeURIComponent(voiceId));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': details.voiceApiKey
                    },
                    body: JSON.stringify({
                        text: cleanText,
                        model_id: details.voiceModel || 'eleven_multilingual_v2'
                    })
                });
                if (!res.ok) return '';
                return await blobToDataUrl(await res.blob());
            }

            if (provider === 'fish') {
                const res = await fetch(details.voiceApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${details.voiceApiKey}`
                    },
                    body: JSON.stringify({
                        text: cleanText,
                        reference_id: details.voiceVoiceId || undefined,
                        format: 'mp3'
                    })
                });
                if (!res.ok) return '';
                return await blobToDataUrl(await res.blob());
            }

            // openai / siliconflow / custom 通用格式
            const res = await fetch(details.voiceApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${details.voiceApiKey}`
                },
                body: JSON.stringify({
                    model: details.voiceModel || 'tts-1',
                    input: cleanText,
                    voice: details.voiceVoiceId || 'alloy',
                    speed
                })
            });
            if (!res.ok) return '';
            return await blobToDataUrl(await res.blob());
        } catch (e) {
            return '';
        }
    }

    /* ---------------- 回复解析 ---------------- */
    function matchStickerByName(rawName, mountedStickers) {
        const target = String(rawName || '').trim().toLowerCase();
        if (!target || !Array.isArray(mountedStickers) || !mountedStickers.length) return null;
        let hit = mountedStickers.find(s => s.name.toLowerCase() === target);
        if (hit) return hit;
        hit = mountedStickers.find(s => s.name.toLowerCase().includes(target) || target.includes(s.name.toLowerCase()));
        return hit || null;
    }

    function resolveMemberByName(rawName, members) {
        const target = String(rawName || '').trim().toLowerCase();
        if (!Array.isArray(members) || !members.length) return '';
        const hit = members.find(m =>
            (m.name && m.name.toLowerCase() === target) ||
            (m.nickname && m.nickname.toLowerCase() === target)
        ) || members.find(m =>
            (m.name && target.includes(m.name.toLowerCase())) ||
            (m.name && m.name.toLowerCase().includes(target))
        );
        return hit ? hit.id : members[0].id;
    }

    function parseReplyPayload(rawText, initialCot, charId, mountedStickers, isGroup, members) {
        let text = String(rawText || '').trim();
        const nativeCot = String(initialCot || '').trim();
        let tagCot = '';
        let retypeCount = 0;
        let giveUp = false;
        let takeover = false;
        let takeoverLines = [];
        let stealSticker = false;

        text = text.replace(/[\[【]COT[\]】]([\s\S]*?)[\[【]\s*[\/／]\s*COT[\]】]/gi, (_, inner) => {
            const clean = String(inner || '').trim();
            if (clean) tagCot = tagCot ? (tagCot + '\n' + clean) : clean;
            return '';
        }).trim();

        text = text.replace(/<(think|thinking|thought|cot)>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
            const clean = String(inner || '').trim();
            if (clean) tagCot = tagCot ? (tagCot + '\n' + clean) : clean;
            return '';
        }).trim();

        const orphanEnd = text.match(/^([\s\S]*?)(?:[\[【]\s*[\/／]\s*COT[\]】]|<\/(?:think|thinking|thought|cot)>)\s*/i);
        if (orphanEnd) {
            const clean = String(orphanEnd[1] || '').replace(/^[\[【]COT[\]】]/i, '').trim();
            if (clean) tagCot = tagCot ? (tagCot + '\n' + clean) : clean;
            text = text.slice(orphanEnd[0].length).trim();
        }

        if (/^[\[【]COT[\]】]/i.test(text)) {
            const nl = text.indexOf('\n');
            if (nl !== -1) {
                const head = text.slice(0, nl).replace(/^[\[【]COT[\]】]/i, '').trim();
                if (head) tagCot = tagCot ? (tagCot + '\n' + head) : head;
                text = text.slice(nl + 1).trim();
            } else {
                text = text.replace(/^[\[【]COT[\]】]/i, '').trim();
            }
        }

        const cot = cleanCotText(tagCot || nativeCot);

        text = text.replace(/\[RETYPE(?::(\d+))?\]/gi, (_, n) => {
            const add = n ? Math.min(3, Math.max(1, parseInt(n, 10) || 1)) : 1;
            retypeCount = Math.min(3, retypeCount + add);
            return '';
        });
        if (/\[GIVEUP\]/i.test(text)) {
            giveUp = true;
            text = text.replace(/\[GIVEUP\]/gi, '');
        }
        if (/\[STEAL_STICKER\]/i.test(text)) {
            stealSticker = true;
            text = text.replace(/\[STEAL_STICKER\]/gi, '');
        }
        text = text.replace(/\[TAKEOVER(?::([^\]]*))?\]/gi, (_, body) => {
            takeover = true;
            if (body) takeoverLines = String(body).split('|').map(s => s.trim()).filter(Boolean);
            return '';
        });
        text = text.replace(/\[REMARK:([^\]]+)\]/gi, (_, val) => {
            if (!isGroup && charId && val) setCharRemark(charId, val.trim());
            return '';
        });
        text = text.replace(/\[PASSCODE:([^\]]+)\]/gi, (_, val) => {
            const pwd = String(val || '').trim();
            if (!isGroup && charId && pwd && isCharPasscodeChangeAllowed() && window.PhoneChatMe && typeof window.PhoneChatMe.setCharPasscode === 'function') {
                window.PhoneChatMe.setCharPasscode(charId, pwd, true);
            }
            return '';
        });

        const parts = text.split('|||').map(s => s.trim()).filter(Boolean);
        const rawSegments = (parts.length ? parts : [text.trim()]).filter(Boolean);
        const bubbles = [];

        rawSegments.forEach(seg => {
            let speakerCharId = charId;
            if (isGroup) {
                const spMatch = seg.match(/^\[SPEAKER:([^\]]+)\]\s*/i);
                if (spMatch) {
                    speakerCharId = resolveMemberByName(spMatch[1], members);
                    seg = seg.slice(spMatch[0].length).trim();
                } else {
                    speakerCharId = members[0] ? members[0].id : charId;
                }
            }

            const voiceMatch = seg.match(/^\[VOICE:([\s\S]+?)\]$/i);
            if (voiceMatch) {
                const vText = String(voiceMatch[1] || '').trim();
                if (vText) {
                    bubbles.push({
                        type: 'voice',
                        charId: speakerCharId,
                        text: vText,
                        duration: Math.max(2, Math.min(60, Math.round(vText.length / 4)))
                    });
                }
                return;
            }

            const stickerRegex = /\[STICKER:([^\]]+)\]/gi;
            let lastIdx = 0;
            let match;
            let hasTag = false;

            while ((match = stickerRegex.exec(seg)) !== null) {
                hasTag = true;
                const before = seg.slice(lastIdx, match.index).trim();
                if (before) {
                    let tr = '';
                    const cleanBefore = before.replace(/\[TRANS:([^\]]+)\]/gi, (_, t) => {
                        tr = String(t || '').trim();
                        return '';
                    }).trim();
                    if (cleanBefore) bubbles.push({ type: 'text', charId: speakerCharId, text: cleanBefore, translation: tr });
                }
                const st = matchStickerByName(match[1], mountedStickers);
                if (st) {
                    bubbles.push({ type: 'sticker', charId: speakerCharId, sticker: st, text: `[表情:${st.name}]` });
                }
                lastIdx = match.index + match[0].length;
            }

            const tail = hasTag ? seg.slice(lastIdx).trim() : seg;
            if (tail) {
                let tr = '';
                const cleanTail = tail.replace(/\[TRANS:([^\]]+)\]/gi, (_, t) => {
                    tr = String(t || '').trim();
                    return '';
                }).trim();
                if (cleanTail) bubbles.push({ type: 'text', charId: speakerCharId, text: cleanTail, translation: tr });
            }
        });

        return { cot, bubbles, retypeCount, giveUp, takeover, takeoverLines, stealSticker };
    }

    /* ---------------- 气泡上屏与记忆自动归档 ---------------- */
    async function appendCharBubble(threadId, fallbackCharId, bubble, cotText, details) {
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const msgId = 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const msgObj = {
            id: msgId,
            sender: 'char',
            charId: bubble.charId || fallbackCharId,
            text: bubble.text,
            time: nowTime,
            ts: Date.now()
        };

        if (bubble.type === 'sticker' && bubble.sticker) {
            msgObj.type = 'sticker';
            msgObj.stickerId = bubble.sticker.id || '';
            msgObj.stickerName = bubble.sticker.name || '表情包';
            msgObj.stickerDbKey = bubble.sticker.dbKey || '';
            msgObj.text = `[表情:${msgObj.stickerName}]`;
        } else if (bubble.type === 'voice') {
            msgObj.type = 'voice';
            msgObj.transcript = bubble.text;
            msgObj.duration = bubble.duration || 3;
            const audioDataUrl = await synthesizeTTS(bubble.text, details);
            if (audioDataUrl && window.PhoneDB && typeof window.PhoneDB.set === 'function') {
                const dbKey = 'chat_voice_' + msgId;
                await window.PhoneDB.set(dbKey, audioDataUrl);
                msgObj.audioDbKey = dbKey;
            }
        } else {
            if (bubble.translation) {
                msgObj.translation = bubble.translation;
            } else if (details && details.translateMode === 'api' && window.PhoneAPI && typeof window.PhoneAPI.translate === 'function') {
                const hasForeign = /[a-zA-Z]{4,}|[\u3040-\u30ff\uac00-\ud7af]/.test(bubble.text);
                if (hasForeign) {
                    try {
                        const tr = await window.PhoneAPI.translate(bubble.text, details.translateLang || '简体中文');
                        if (tr) msgObj.translation = tr;
                    } catch (e) {}
                }
            }
        }

        if (cotText) msgObj.cot = cotText;

        msgs.push(msgObj);
        saveJSON(STORAGE_MSGS_PREFIX + threadId, msgs);

        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const idx = threads.findIndex(t => t.id === threadId);
        if (idx !== -1) {
            threads[idx].lastMsg = msgObj.type === 'voice' ? `[语音] ${msgObj.transcript}` : msgObj.text;
            threads[idx].lastTime = nowTime;
            saveJSON(STORAGE_THREADS_KEY, threads);
        }

        if (window.PhoneChat && window.PhoneChat.getCurrentThreadId && window.PhoneChat.getCurrentThreadId() === threadId) {
            if (typeof window.PhoneChat.refreshMessages === 'function') {
                window.PhoneChat.refreshMessages();
            }
        }
    }

    async function maybeAutoCaptureMemory(threadId, charId, charObj, details, isGroup) {
        if (isGroup || !window.PhoneMemory || typeof window.PhoneMemory.autoCapture !== 'function') return;
        const memCfg = typeof window.PhoneMemory.getConfig === 'function' ? window.PhoneMemory.getConfig() : {};
        const enabled = (details && details.memoryAutoSummary) || memCfg.autoEnabled;
        if (!enabled) return;

        const every = Number((details && details.memoryAutoSummary && details.memoryAutoEvery) || memCfg.autoEvery || 20);
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        const lastIdx = Number(localStorage.getItem(STORAGE_MEM_SUM_IDX_PREFIX + threadId) || '0') || 0;
        if (msgs.length - lastIdx < every) return;

        const slice = msgs.slice(lastIdx).map(m => ({
            role: m.sender === 'me' ? 'user' : 'assistant',
            content: formatMessageForAI(m, false)
        })).filter(m => m.content);

        if (!slice.length) return;
        try {
            localStorage.setItem(STORAGE_MEM_SUM_IDX_PREFIX + threadId, String(msgs.length));
            await window.PhoneMemory.autoCapture({
                charId,
                charName: (charObj && (charObj.name || charObj.nickname)) || '对方',
                messages: slice,
                callLLM: async (prompt) => {
                    const res = await requestLLM('你是精准提炼对话长期记忆的助手。', [{ role: 'user', content: prompt }], details, null);
                    return res.out.text;
                }
            });
        } catch (e) {}
    }

    function waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randRange(min, max) {
        return Math.round(min + Math.random() * (max - min));
    }

    /* ---------------- 主流程与重roll ---------------- */
    async function runReplyForThread(threadId) {
        if (!threadId || runningThreads.has(threadId)) return;

        if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
            const acc = window.PhoneChatMe.getActiveAccount();
            if (acc && acc.type === 'char') return;
        }

        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const t = threads.find(item => item.id === threadId);
        const isGroup = !!(t && t.type === 'group');
        let charId = '';
        let members = [];

        if (isGroup) {
            const memberIds = Array.isArray(t.memberIds) ? t.memberIds : [];
            members = memberIds.map(id => getArchiveChar(id)).filter(Boolean);
            if (!members.length) {
                showAiToast('群聊暂无角色成员');
                return;
            }
            charId = members[0].id;
        } else if (t) {
            charId = t.charId || '';
        } else if (threadId.indexOf('dm-') === 0) {
            charId = threadId.slice(3);
        }

        if (!charId) {
            showAiToast('未识别到聊天对象');
            return;
        }

        const runToken = Date.now() + '_' + Math.random();
        activeRuns[threadId] = runToken;
        runningThreads.add(threadId);

        setRoomTyping(threadId, true);

        try {
            const details = getThreadDetails(threadId);
            const charObj = isGroup ? null : getArchiveChar(charId);
            const userCtx = getUserContext();
            const mountedStickers = isGroup ? [] : getMountedStickers(charId, details);

            const overrideLoreIds = (window.PhoneChatDetails && typeof window.PhoneChatDetails.getEffectiveLorebookIds === 'function')
                ? window.PhoneChatDetails.getEffectiveLorebookIds(threadId)
                : null;
            const voiceLoreIds = (window.PhoneChatDetails && typeof window.PhoneChatDetails.getEffectiveVoiceLorebookIds === 'function')
                ? window.PhoneChatDetails.getEffectiveVoiceLorebookIds(threadId)
                : [];

            // 先拉取一次近期消息用于匹配世界书关键词与记忆搜索
            const rawMsgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
            const probeText = (Array.isArray(rawMsgs) ? rawMsgs.slice(-6) : []).map(m => formatMessageForAI(m, isGroup)).join('\n');

            const loreRes = matchLoreEntries(probeText, charId, overrideLoreIds);
            const voiceLoreRes = voiceLoreIds.length ? matchLoreEntries(probeText, charId, voiceLoreIds) : null;
            const voiceLoreText = voiceLoreRes
                ? [].concat(voiceLoreRes.before, voiceLoreRes.after, voiceLoreRes.depth.map(d => d.content)).join('\n')
                : '';

            const [histPack, memoriesText, realEnvText] = await Promise.all([
                buildHistoryMessages(threadId, details, isGroup, loreRes.depth),
                isGroup ? Promise.resolve('') : getRelevantMemoriesText(probeText, charId),
                getRealEnvText(threadId, details)
            ]);
            if (activeRuns[threadId] !== runToken) return;

            const presetObj = getEffectivePresetObj(threadId);
            const coreBlock = buildCoreRules(
                isGroup, members, charObj, userCtx, details, mountedStickers,
                histPack.hasUserSticker, memoriesText, realEnvText, voiceLoreText
            );
            const systemPrompt = assembleSystemPromptWithPreset(presetObj, coreBlock, loreRes);

            const req = await requestLLM(systemPrompt, histPack.history, details, presetObj);
            if (activeRuns[threadId] !== runToken) return;

            const parsed = parseReplyPayload(req.out.text, req.out.cot, charId, mountedStickers, isGroup, members);

            try { localStorage.removeItem(STORAGE_TAKEOVER_CTX_PREFIX + threadId); } catch (e) {}

            if (window.PhoneAPI && typeof window.PhoneAPI.addLog === 'function') {
                const cotTag = details.cotShow
                    ? (parsed.cot ? ' · 已提取思维链' : ' · 模型未返回思维链')
                    : ' · 思维链开关未开';
                window.PhoneAPI.addLog({
                    module: 'LLM',
                    source: req.retried
                        ? (req.usedBackup ? 'Chat 对话（副 API 重试）' : 'Chat 对话（自动重试）')
                        : (req.usedCustomBundle ? 'Chat 对话（独立 API）' : 'Chat 对话回复'),
                    ok: true,
                    rawError: `模型 ${req.model} 回复成功${cotTag}`
                });
            }

            if (!isGroup && parsed.stealSticker && details.stickerAllowSteal) {
                const stolen = stealLatestUserSticker(threadId, charId);
                if (stolen && stolen.isNew) {
                    showAiToast(`对方偷走了你的表情包「${stolen.name}」`);
                }
            }

            for (let r = 0; r < parsed.retypeCount; r++) {
                if (activeRuns[threadId] !== runToken) return;
                setRoomTyping(threadId, false);
                await waitMs(randRange(1100, 2300));
                if (activeRuns[threadId] !== runToken) return;
                setRoomTyping(threadId, true);
                await waitMs(randRange(950, 1950));
            }

            if (parsed.giveUp && !parsed.bubbles.length && !parsed.takeover) {
                setRoomTyping(threadId, false);
                return;
            }

            for (let i = 0; i < parsed.bubbles.length; i++) {
                if (activeRuns[threadId] !== runToken) break;
                if (i > 0) {
                    const pause = Math.min(1300, randRange(420, 680) + parsed.bubbles[i].text.length * 22);
                    await waitMs(pause);
                    if (activeRuns[threadId] !== runToken) break;
                }
                await appendCharBubble(threadId, charId, parsed.bubbles[i], (!isGroup && i === 0) ? parsed.cot : '', details);
            }

            maybeAutoCaptureMemory(threadId, charId, charObj, details, isGroup);

            if (!isGroup && parsed.takeover && window.PhoneChatTakeover && typeof window.PhoneChatTakeover.trigger === 'function') {
                setRoomTyping(threadId, false);
                await waitMs(280);
                window.PhoneChatTakeover.trigger({
                    charId,
                    threadId,
                    initialLines: parsed.takeoverLines
                });
            }
        } catch (err) {
            showAiToast(err.message || 'API 回复失败');
        } finally {
            runningThreads.delete(threadId);
            if (activeRuns[threadId] === runToken) {
                setRoomTyping(threadId, false);
            }
        }
    }

    async function rerollThread(threadId) {
        if (!threadId || runningThreads.has(threadId)) return;
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        if (!Array.isArray(msgs) || !msgs.length) return;

        // 撤回末尾连续一轮对方回复，再重新触发生成
        let removed = false;
        while (msgs.length && msgs[msgs.length - 1].sender === 'char') {
            msgs.pop();
            removed = true;
        }
        if (!removed) return;

        saveJSON(STORAGE_MSGS_PREFIX + threadId, msgs);
        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const idx = threads.findIndex(t => t.id === threadId);
        if (idx !== -1) {
            const last = msgs[msgs.length - 1];
            threads[idx].lastMsg = last ? (last.text || '') : '';
            threads[idx].lastTime = last ? (last.time || '') : '';
            saveJSON(STORAGE_THREADS_KEY, threads);
        }
        if (window.PhoneChat && typeof window.PhoneChat.refreshMessages === 'function') {
            window.PhoneChat.refreshMessages();
        }
        await runReplyForThread(threadId);
    }

    window.addEventListener('phone:chat-takeover-ended', (e) => {
        const d = (e && e.detail) || {};
        if (d.threadId) {
            saveJSON(STORAGE_TAKEOVER_CTX_PREFIX + d.threadId, {
                outcome: d.outcome || 'reclaimed',
                clashHistory: Array.isArray(d.clashHistory) ? d.clashHistory : [],
                lastModalText: d.lastModalText || '',
                at: Date.now()
            });
        }
    });

    window.addEventListener('phone:chat-request-reply', (e) => {
        const detail = (e && e.detail) || {};
        if (detail.threadId) runReplyForThread(detail.threadId);
    });

    window.addEventListener('phone:chat-reroll', (e) => {
        const detail = (e && e.detail) || {};
        const tid = detail.threadId || (window.PhoneChat && window.PhoneChat.getCurrentThreadId && window.PhoneChat.getCurrentThreadId());
        if (tid) rerollThread(tid);
    });

    window.PhoneChatAI = {
        triggerReply: runReplyForThread,
        reroll: rerollThread
    };
})();
