/* =========================================================
   Chat 基础 AI 对话引擎 (apps/chat-ai.js)
   - 对接 PhoneAPI（支持 OpenAI / Google / Anthropic / 自定义兼容 + 副 API 重试 + 日志）
   - 读取 PhoneArchive（Char 人设）+ PhoneChatMe / PhoneMask（当前账号与面具）
   - 支持 1.2s 防抖、顶部「对方正在输入中…」联动、按人设自然分段连发
   - 透传原生 CoT（<think> / reasoning_content）至气泡头顶胶囊
   - 支持人设自主改备注（chat_char_user_remarks_v1）与改密码（setCharPasscode）
   ========================================================= */

(function () {
    const STORAGE_THREADS_KEY = 'chat_threads_v1';
    const STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
    const STORAGE_CHAR_REMARKS = 'chat_char_user_remarks_v1';
    const DEBOUNCE_MS = 1200;
    const MAX_HISTORY = 24;

    const debounceTimers = {};
    const activeRuns = {};

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

    function buildSystemPrompt(charObj, userCtx) {
        const charName = (charObj && (charObj.name || charObj.nickname)) || '对方';
        const charPersona = (charObj && (charObj.persona || charObj.bio || charObj.setting)) || '性格自然真实、有自己生活节奏的普通人';
        const currentRemark = charObj ? getCurrentRemark(charObj.id) : '';
        const canChangePwd = isCharPasscodeChangeAllowed();

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
            `4. 如果你根据人设和两人当下关系变化，想悄悄修改你微信里对对方的备注，可在整段回复最后附带一行 [REMARK:新备注]。\n`;

        if (canChangePwd) {
            prompt += `5. 你的微信锁屏密码平时保持稳定；只有当你的人设性格或当前情绪/关系真的促使你想换密码时，才在最后附带一行 [PASSCODE:6到16位字母或数字]，平时不要随便乱改。\n`;
        }
        return prompt;
    }

    function buildHistoryMessages(threadId) {
        const raw = loadJSON(STORAGE_MSGS_PREFIX + threadId, []);
        if (!Array.isArray(raw)) return [];
        const recent = raw.slice(-MAX_HISTORY);
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
            if (out.length && out[out.length - 1].role === role) {
                out[out.length - 1].content += '\n' + text;
            } else {
                out.push({ role, content: text });
            }
        });
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
                if (p.thought) cot += (p.text || '');
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
                if (b.type === 'thinking') cot += (b.thinking || b.text || '');
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
        const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
        const text = String(msg.content || '').trim();
        const cot = String(msg.reasoning_content || msg.reasoning || '').trim();
        return { text, cot };
    }

    async function requestLLM(systemPrompt, history) {
        if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
            throw new Error('PhoneAPI 未就绪');
        }
        const cfg = window.PhoneAPI.getConfig('llm');
        if (!cfg || !cfg.primary) throw new Error('未找到语言模型配置');
        const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 0.8;

        try {
            const out = await callSingleSlot(cfg.primary, temp, systemPrompt, history);
            window.PhoneAPI.addLog({
                module: 'LLM',
                source: 'Chat 对话回复',
                ok: true,
                rawError: `模型 ${cfg.primary.model} 回复成功`
            });
            return out;
        } catch (err) {
            const hasBackup = cfg.backupEnabled && cfg.backup && cfg.backup.url && cfg.backup.key;
            if (cfg.autoRetry) {
                const retrySlot = hasBackup ? cfg.backup : cfg.primary;
                try {
                    const out2 = await callSingleSlot(retrySlot, temp, systemPrompt, history);
                    window.PhoneAPI.addLog({
                        module: 'LLM',
                        source: hasBackup ? 'Chat 对话（副 API 重试）' : 'Chat 对话（自动重试）',
                        ok: true,
                        rawError: `重试成功 · ${retrySlot.model}`
                    });
                    return out2;
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

        // 透传原生 <think>...</think>
        text = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
            const clean = String(inner || '').trim();
            if (clean) cot = cot ? (cot + '\n' + clean) : clean;
            return '';
        }).trim();

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

        // 按 ||| 分段
        const parts = text.split('|||').map(s => s.trim()).filter(Boolean);
        const bubbles = (parts.length ? parts : [text.trim()]).filter(Boolean).map(seg => {
            let translation = '';
            const cleanText = seg.replace(/\[TRANS:([^\]]+)\]/gi, (_, tr) => {
                translation = String(tr || '').trim();
                return '';
            }).trim();
            return { text: cleanText, translation };
        }).filter(b => b.text);

        return { cot, bubbles };
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

        if (window.PhoneChat) {
            if (window.PhoneChat.getCurrentThreadId && window.PhoneChat.getCurrentThreadId() === threadId) {
                if (typeof window.PhoneChat.refreshMessages === 'function') {
                    window.PhoneChat.refreshMessages();
                }
            }
        }
    }

    function waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function runReplyForThread(threadId) {
        const threads = loadJSON(STORAGE_THREADS_KEY, []);
        const t = threads.find(item => item.id === threadId);
        if (!t || t.type !== 'dm' || !t.charId) return;

        // Char 视角下不自动自言自语
        if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
            const acc = window.PhoneChatMe.getActiveAccount();
            if (acc && acc.type === 'char') return;
        }

        const runToken = Date.now() + '_' + Math.random();
        activeRuns[threadId] = runToken;

        const charObj = getArchiveChar(t.charId);
        const userCtx = getUserContext();
        const systemPrompt = buildSystemPrompt(charObj, userCtx);
        const history = buildHistoryMessages(threadId);
        if (!history.length) return;

        if (window.PhoneChat && typeof window.PhoneChat.setTyping === 'function') {
            window.PhoneChat.setTyping(threadId, true);
        }

        try {
            const result = await requestLLM(systemPrompt, history);
            if (activeRuns[threadId] !== runToken) return;

            const parsed = parseReplyPayload(result.text, result.cot, t.charId);
            if (!parsed.bubbles.length) return;

            for (let i = 0; i < parsed.bubbles.length; i++) {
                if (activeRuns[threadId] !== runToken) break;
                if (i > 0) {
                    const pause = Math.min(1100, 420 + parsed.bubbles[i].text.length * 24);
                    await waitMs(pause);
                    if (activeRuns[threadId] !== runToken) break;
                }
                appendCharBubble(threadId, t.charId, parsed.bubbles[i], i === 0 ? parsed.cot : '');
            }
        } catch (err) {
            const toastEl = document.getElementById('ctToast');
            if (toastEl) {
                toastEl.textContent = err.message || 'API 回复失败';
                toastEl.classList.add('show');
                clearTimeout(runReplyForThread._toastTimer);
                runReplyForThread._toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
            }
        } finally {
            if (activeRuns[threadId] === runToken && window.PhoneChat && typeof window.PhoneChat.setTyping === 'function') {
                window.PhoneChat.setTyping(threadId, false);
            }
        }
    }

    window.addEventListener('phone:chat-user-sent', (e) => {
        const detail = (e && e.detail) || {};
        const tid = detail.threadId;
        if (!tid) return;
        clearTimeout(debounceTimers[tid]);
        debounceTimers[tid] = setTimeout(() => {
            runReplyForThread(tid);
        }, DEBOUNCE_MS);
    });

    window.PhoneChatAI = {
        triggerReply: runReplyForThread
    };
})();
