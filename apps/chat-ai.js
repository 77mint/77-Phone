/* =========================================================
   Chat 基础 AI 对话引擎 (apps/chat-ai.js)
   - 对接 PhoneAPI（支持 OpenAI / Google / Anthropic / 自定义兼容 + 副 API 重试 + 日志）
   - 读取 PhoneArchive（Char 人设）+ PhoneChatMe / PhoneMask（当前账号与面具）
   - 读取 PhoneChatDetails（显示思维链开关 / 自定义思维链 / 上下文条数）
   - 仅在空输入框点 ↑（phone:chat-request-reply）时触发，支持对方继续接着说
   - 全兼容 <think> / <thinking> / <thought> / <cot> 与原生 reasoning/thinking 字段
   - 支持顶部纯黑「对方正在输入中…」与 AI 临场决定的「打字又删除」（[RETYPE] / [GIVEUP]）
   ========================================================= */

(function () {
    const STORAGE_THREADS_KEY = 'chat_threads_v1';
    const STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
    const STORAGE_CHAR_REMARKS = 'chat_char_user_remarks_v1';
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

    function buildSystemPrompt(charObj, userCtx, details) {
        const charName = (charObj && (charObj.name || charObj.nickname)) || '对方';
        const charPersona = (charObj && (charObj.persona || charObj.bio || charObj.setting)) || '性格自然真实、有自己生活节奏的普通人';
        const currentRemark = charObj ? getCurrentRemark(charObj.id) : '';
        const canChangePwd = isCharPasscodeChangeAllowed();
        const showCot = !!(details && details.cotShow);
        const customCot = (details && details.cotCustom) ? String(details.cotCustom).trim() : '';

        let prompt =
            `你正在手机微信里和对方聊天。请完全以「${charName}」的身份自然回复，绝对不要跳出角色或用 AI 助手腔调说话。\n\n` +
            `【你的设定】\n姓名：${charName}\n人设：${charPersona}\n\n` +
            `【对方（User）信息】\n网名：${userCtx.name}` +
            (userCtx.persona ? `\n对方人设/身份：${userCtx.persona}` : '') +
            (currentRemark ? `\n你目前在微信里给对方的备注是：${currentRemark}` : '') +
            `\n\n【聊天规则（务必遵守）】\n` +
            `1. 用真实微信聊天的口吻打字，不要写小说旁白或 *动作描写*。\n` +
            `2. 根据你的人设和当下情绪决定一次发几条消息：话多、激动或碎碎念时可以连发多条短句，高冷或简短时发 1~2 条即可。多条消息之间请严格用 ||| 分隔（不要加编号）。\n` +
            `3. 如果你的台词主要是外语，请在该条消息末尾紧接 [TRANS:对应的自然中文翻译]，没有外语则不要加。\n` +
            `4. 如果你根据人设和两人当下关系变化，想悄悄修改你微信里对对方的备注，可在整段回复最后附带一行 [REMARK:新备注]。\n` +
            `5. 真实打字犹豫（完全随人设与当下心境，平时正常聊天不要使用）：只有在你当下真的欲言又止、打了一半又删掉重打时，才在回复正文前加一个 [RETYPE]（若反复犹豫两次可写 [RETYPE:2]）；如果打完又全部删掉决定什么都不发，则只输出 [GIVEUP]。平时直接正常回复即可，切勿每次都刻意触发。\n`;

        if (canChangePwd) {
            prompt += `6. 你的微信锁屏密码平时保持稳定；只有当你的人设性格或当前情绪/关系真的促使你想换密码时，才在最后附带一行 [PASSCODE:6到16位字母或数字]，平时不要随便乱改。\n`;
        }

        if (showCot) {
            prompt +=
                `\n【强制输出格式：思考过程（每一轮都必须严格遵守，绝对不能省略）】\n` +
                (customCot
                    ? `每次回复的最开头必须先输出 <think>...</think>，内容要求：${customCot}\n`
                    : `每次回复的最开头必须先输出 <think>...</think>，里面用第一人称简短写下你此刻真实的内心想法、情绪波动或斟酌措辞的过程。\n`) +
                `严格按以下格式输出：\n<think>这里写内心想法</think>\n这里写第一条回复|||这里写第二条回复`;
        }

        return prompt;
    }

    function buildHistoryMessages(threadId, details) {
        const raw = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        if (!Array.isArray(raw)) return [];
        const limit = Math.max(8, Number((details && details.memoryContextLimit) || DEFAULT_MAX_HISTORY));
        const showCot = !!(details && details.cotShow);
        const recent = raw.slice(-limit);
        const out = [];

        recent.forEach(m => {
            if (!m) return;
            let text = m.type === 'voice'
                ? (m.transcript ? `[语音] ${m.transcript}` : `[语音 ${m.duration || 1}秒]`)
                : (m.text || '');
            text = String(text).trim();
            if (!text) return;
            if (m.quote && m.quote.text) {
                text = `[引用 ${m.quote.senderName || ''}：${m.quote.text}]\n${text}`;
            }

            const role = m.sender === 'me' ? 'user' : 'assistant';
            if (role === 'assistant' && showCot && m.cot) {
                text = `<think>${String(m.cot).trim()}</think>\n${text}`;
            }

            if (out.length && out[out.length - 1].role === role) {
                out[out.length - 1].content += (role === 'assistant' ? '\n|||\n' : '\n') + text;
            } else {
                out.push({ role, content: text });
            }
        });

        if (!out.length) {
            out.push({ role: 'user', content: '（对方点开了聊天窗口，请你自然主动发一句开场白）' });
        } else if (out[out.length - 1].role === 'assistant') {
            out.push({ role: 'user', content: '（对方还没回消息，你可以顺着刚才的话题自然再继续说一两句）' });
        }

        return out;
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
            const contents = history.map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            }));
            const body = {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: { temperature }
            };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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
            const body = {
                model: slot.model,
                max_tokens: 1536,
                temperature,
                system: systemPrompt,
                messages: history
            };
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': slot.key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(body)
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

        // OpenAI / 自定义兼容
        const url = `${base}/chat/completions`;
        const messages = [{ role: 'system', content: systemPrompt }].concat(history);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${slot.key}`
            },
            body: JSON.stringify({
                model: slot.model,
                messages,
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

    async function requestLLM(systemPrompt, history) {
        if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
            throw new Error('PhoneAPI 未就绪');
        }
        const cfg = window.PhoneAPI.getConfig('llm');
        if (!cfg || !cfg.primary) {
            window.PhoneAPI.addLog({
                module: 'LLM',
                source: 'Chat 对话回复',
                ok: false,
                rawError: '未找到语言模型配置'
            });
            throw new Error('未找到语言模型配置');
        }
        const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 0.8;

        try {
            const out = await callSingleSlot(cfg.primary, temp, systemPrompt, history);
            return { out, model: cfg.primary.model, retried: false };
        } catch (err) {
            const hasBackup = cfg.backupEnabled && cfg.backup && cfg.backup.url && cfg.backup.key;
            if (cfg.autoRetry) {
                const retrySlot = hasBackup ? cfg.backup : cfg.primary;
                try {
                    const out2 = await callSingleSlot(retrySlot, temp, systemPrompt, history);
                    return { out: out2, model: retrySlot.model, retried: true, usedBackup: hasBackup };
                } catch (err2) {
                    window.PhoneAPI.addLog({
                        module: 'LLM',
                        source: 'Chat 对话回复',
                        ok: false,
                        rawError: err2.message || String(err2)
                    });
                    throw err2;
                }
            }
            window.PhoneAPI.addLog({
                module: 'LLM',
                source: 'Chat 对话回复',
                ok: false,
                rawError: err.message || String(err)
            });
            throw err;
        }
    }

    function parseReplyPayload(rawText, initialCot, charId) {
        let text = String(rawText || '').trim();
        let cot = String(initialCot || '').trim();
        let retypeCount = 0;
        let giveUp = false;

        // 兼容提取 <think> / <thinking> / <thought> / <cot>
        text = text.replace(/<(think|thinking|thought|cot)>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
            const clean = String(inner || '').trim();
            if (clean) cot = cot ? (cot + '\n' + clean) : clean;
            return '';
        }).trim();

        // 提取 AI 临场决定的打字又删除标记
        text = text.replace(/\[RETYPE(?::(\d+))?\]/gi, (_, n) => {
            const add = n ? Math.min(3, Math.max(1, parseInt(n, 10) || 1)) : 1;
            retypeCount = Math.min(3, retypeCount + add);
            return '';
        });
        if (/\[GIVEUP\]/i.test(text)) {
            giveUp = true;
            text = text.replace(/\[GIVEUP\]/gi, '');
        }

        // 提取 [REMARK:...]
        text = text.replace(/\[REMARK:([^\]]+)\]/gi, (_, val) => {
            if (charId && val) setCharRemark(charId, val.trim());
            return '';
        });

        // 提取 [PASSCODE:...]
        text = text.replace(/\[PASSCODE:([^\]]+)\]/gi, (_, val) => {
            const pwd = String(val || '').trim();
            if (charId && pwd && isCharPasscodeChangeAllowed() && window.PhoneChatMe && typeof window.PhoneChatMe.setCharPasscode === 'function') {
                window.PhoneChatMe.setCharPasscode(charId, pwd, true);
            }
            return '';
        });

        const parts = text.split('|||').map(s => s.trim()).filter(Boolean);
        const bubbles = (parts.length ? parts : [text.trim()]).filter(Boolean).map(seg => {
            let translation = '';
            const cleanText = seg.replace(/\[TRANS:([^\]]+)\]/gi, (_, tr) => {
                translation = String(tr || '').trim();
                return '';
            }).trim();
            return { text: cleanText, translation };
        }).filter(b => b.text);

        return { cot, bubbles, retypeCount, giveUp };
    }

    function appendCharBubble(threadId, charId, bubble, cotText) {
        const msgs = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const msgObj = {
            id: 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            sender: 'char',
            charId: charId,
            text: bubble.text,
            time: nowTime
        };
        if (bubble.translation) msgObj.translation = bubble.translation;
        if (cotText) msgObj.cot = cotText;

        msgs.push(msgObj);
        saveJSON(STORAGE_MSGS_PREFIX + threadId, msgs);

        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const idx = threads.findIndex(t => t.id === threadId);
        if (idx !== -1) {
            threads[idx].lastMsg = bubble.text;
            threads[idx].lastTime = nowTime;
            saveJSON(STORAGE_THREADS_KEY, threads);
        }

        if (window.PhoneChat && window.PhoneChat.getCurrentThreadId && window.PhoneChat.getCurrentThreadId() === threadId) {
            if (typeof window.PhoneChat.refreshMessages === 'function') {
                window.PhoneChat.refreshMessages();
            }
        }
    }

    function waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randRange(min, max) {
        return Math.round(min + Math.random() * (max - min));
    }

    async function runReplyForThread(threadId) {
        if (!threadId || runningThreads.has(threadId)) return;

        // Char 视角下不触发自动回复
        if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
            const acc = window.PhoneChatMe.getActiveAccount();
            if (acc && acc.type === 'char') return;
        }

        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const t = threads.find(item => item.id === threadId);
        let charId = '';
        if (t) {
            if (t.type === 'group') {
                showAiToast('群聊暂未接入 AI 回复');
                return;
            }
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

        const details = getThreadDetails(threadId);
        const charObj = getArchiveChar(charId);
        const userCtx = getUserContext();
        const systemPrompt = buildSystemPrompt(charObj, userCtx, details);
        const history = buildHistoryMessages(threadId, details);

        setRoomTyping(threadId, true);

        try {
            const req = await requestLLM(systemPrompt, history);
            if (activeRuns[threadId] !== runToken) return;

            const parsed = parseReplyPayload(req.out.text, req.out.cot, charId);

            if (window.PhoneAPI && typeof window.PhoneAPI.addLog === 'function') {
                const cotTag = details.cotShow
                    ? (parsed.cot ? ' · 已提取思维链' : ' · 模型未返回思维链')
                    : ' · 思维链开关未开';
                window.PhoneAPI.addLog({
                    module: 'LLM',
                    source: req.retried ? (req.usedBackup ? 'Chat 对话（副 API 重试）' : 'Chat 对话（自动重试）') : 'Chat 对话回复',
                    ok: true,
                    rawError: `模型 ${req.model} 回复成功${cotTag}`
                });
            }

            // 若 AI 临场决定「打了又删」：演一遍 停止输入（变回备注）→ 停顿 → 重新输入
            for (let r = 0; r < parsed.retypeCount; r++) {
                if (activeRuns[threadId] !== runToken) return;
                setRoomTyping(threadId, false);
                await waitMs(randRange(1100, 2300));
                if (activeRuns[threadId] !== runToken) return;
                setRoomTyping(threadId, true);
                await waitMs(randRange(950, 1950));
            }

            // 若 AI 决定全部删光不发
            if (parsed.giveUp && !parsed.bubbles.length) {
                setRoomTyping(threadId, false);
                return;
            }

            if (!parsed.bubbles.length) return;

            for (let i = 0; i < parsed.bubbles.length; i++) {
                if (activeRuns[threadId] !== runToken) break;
                if (i > 0) {
                    const pause = Math.min(1300, randRange(420, 680) + parsed.bubbles[i].text.length * 22);
                    await waitMs(pause);
                    if (activeRuns[threadId] !== runToken) break;
                }
                appendCharBubble(threadId, charId, parsed.bubbles[i], i === 0 ? parsed.cot : '');
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

    // 仅响应空输入框点击 ↑ 的主动触发
    window.addEventListener('phone:chat-request-reply', (e) => {
        const detail = (e && e.detail) || {};
        if (detail.threadId) runReplyForThread(detail.threadId);
    });

    window.PhoneChatAI = {
        triggerReply: runReplyForThread
    };
})();
