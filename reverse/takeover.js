/* =========================================================
   反向互动 · 顶号实时博弈模块 (reverse/takeover.js)
   - 零固定台词、无预览卡片，全屏暗红文字与弹窗回应 100% 由 AI 实时生成
   - 暴露 window.PhoneChatTakeover（trigger / close）
   - 结束时派发 phone:chat-takeover-ended 事件供聊天 AI 接续记忆
   ========================================================= */

(function () {
  let activeTimers = [];
  let activeStageEl = null;

  function bindPressed(el) {
    if (!el || el.dataset.ctoPressedBound) return;
    el.dataset.ctoPressedBound = '1';
    el.addEventListener('touchstart', () => el.classList.add('is-pressed'), { passive: true });
    el.addEventListener('touchmove', () => el.classList.remove('is-pressed'), { passive: true });
    el.addEventListener('touchend', () => el.classList.remove('is-pressed'), { passive: true });
    el.addEventListener('touchcancel', () => el.classList.remove('is-pressed'), { passive: true });
  }

  function clearAllTimers() {
    activeTimers.forEach(id => clearTimeout(id));
    activeTimers = [];
  }

  function addTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    activeTimers.push(id);
    return id;
  }

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 16);
    } catch (e) {}
  }

  function cleanupAll() {
    clearAllTimers();
    if (activeStageEl) {
      activeStageEl.remove();
      activeStageEl = null;
    }
  }

  function resolveActiveApiConfig() {
    let rawCfg = null;
    try {
      if (window.PhoneAPI && typeof window.PhoneAPI.getConfig === 'function') {
        rawCfg = window.PhoneAPI.getConfig('chat');
      }
    } catch (e) {}

    if (!rawCfg) {
      try {
        const stored = localStorage.getItem('phone_api_config_v2');
        if (stored) rawCfg = JSON.parse(stored);
      } catch (e) {}
    }

    if (!rawCfg) return null;
    const node = rawCfg.active || rawCfg.primary || rawCfg;
    const url = (node.url || node.apiUrl || node.baseUrl || '').trim();
    const key = (node.key || node.apiKey || '').trim();
    const model = (node.model || node.modelName || '').trim();
    const provider = node.provider || rawCfg.provider || 'openai';
    if (!url || !key || !model) return null;
    return { provider, url, key, model };
  }

  function getCharContext(charId, threadId) {
    let chars = [];
    try {
      if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
        chars = window.PhoneArchive.getChars() || [];
      }
    } catch (e) {}

    const charObj = chars.find(c => c.id === charId) || chars[0] || null;
    const charName = (charObj && (charObj.name || charObj.nickname)) || '对方';
    const persona = charObj
      ? [charObj.persona, charObj.personality, charObj.background, charObj.bio, charObj.description].filter(Boolean).join('\n')
      : '';

    let recentLines = [];
    try {
      let tid = threadId;
      if (!tid && window.PhoneChat && typeof window.PhoneChat.getThreads === 'function') {
        const list = window.PhoneChat.getThreads() || [];
        const matched = charObj ? list.find(t => t.charId === charObj.id) : list[0];
        if (matched) tid = matched.id;
      }
      if (tid) {
        const raw = localStorage.getItem('chat_msgs_v1_' + tid);
        const msgs = raw ? JSON.parse(raw) : [];
        if (Array.isArray(msgs)) {
          recentLines = msgs.slice(-12).map(m => {
            const who = m.sender === 'me' ? 'User' : charName;
            return `${who}: ${m.text || m.transcript || '[消息]'}`;
          });
        }
      }
    } catch (e) {}

    return { charObj, charName, persona, recentLines };
  }

  async function requestTakeoverTurn(ctx, attemptNum, clashHistory) {
    const active = resolveActiveApiConfig();
    if (!active) {
      return { error: '未检测到可用的聊天 API 配置，请先在「API」中完成配置。' };
    }

    const isInitial = attemptNum === 0;
    const systemPrompt = [
      `你现在正在扮演「${ctx.charName}」。`,
      ctx.persona ? `【角色人设】\n${ctx.persona}` : '',
      ctx.recentLines.length ? `【最近聊天上下文】\n${ctx.recentLines.join('\n')}` : '',
      `【当前情境】`,
      isInitial
        ? `你刚刚登录了 User 的账号，把 User 踢下线了。现在 User 屏幕已经弹出「下线通知」。请结合你的人设、你们当下的关系以及刚才聊过的内容，现场写出 14~20 句此刻盘旋在你心头、将铺满 User 屏幕的暗红短句（lines，每句 2~12 字，完全符合你自己的口吻与情绪，不准套模板）。`
        : `你刚刚登录了 User 的账号，User 正在第 ${attemptNum} 次点击「重新登录」试图把你顶下去。没有任何预设次数限制，完全基于你此刻的性格、感情状态和刚才聊过的内容自己决定：
1. 此刻是继续占着账号拦住 User（allow: false），还是心软/退让/被顶下线而放行（allow: true）？
2. 弹窗提示语（modalText，25字以内，贴合你此刻对 User 说的话）。
3. 若不放行，给出 12~18 句新铺上屏幕的短句（lines，每句 2~12 字）。`,
      `严格只输出 JSON，不要 markdown 代码块，格式：{"allow":false,"modalText":"...","lines":["..."]}`
    ].filter(Boolean).join('\n\n');

    const userPrompt = isInitial
      ? `你已接入 User 账号，请立即生成此刻铺满屏幕的短句。`
      : (clashHistory.length
        ? `前几轮顶号过程：\n${clashHistory.join('\n')}\n现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`
        : `现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`);

    const baseUrl = active.url.replace(/\/+$/, '');
    let endpoint = baseUrl;
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    if (active.provider === 'google') {
      endpoint = `${baseUrl}/models/${encodeURIComponent(active.model)}:generateContent?key=${encodeURIComponent(active.key)}`;
      body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.95 }
      };
    } else if (active.provider === 'anthropic') {
      endpoint = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`;
      headers['x-api-key'] = active.key;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: active.model,
        max_tokens: 600,
        temperature: 0.95,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      };
    } else {
      endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      headers['Authorization'] = `Bearer ${active.key}`;
      body = {
        model: active.model,
        temperature: 0.95,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    let rawText = '';
    if (active.provider === 'google') {
      rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    } else if (active.provider === 'anthropic') {
      rawText = Array.isArray(data?.content) ? data.content.map(c => c.text || '').join('') : '';
    } else {
      rawText = data?.choices?.[0]?.message?.content || '';
    }

    try {
      if (window.PhoneAPI && typeof window.PhoneAPI.addLog === 'function') {
        window.PhoneAPI.addLog({
          type: 'LLM',
          status: '成功',
          source: '顶号实时对抗',
          detail: `模型 ${active.model} 第 ${attemptNum} 轮响应`
        });
      }
    } catch (e) {}

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { allow: false, modalText: rawText.slice(0, 28), lines: [] };
    }
    return JSON.parse(jsonMatch[0]);
  }

  function launchTakeoverStage(opts) {
    cleanupAll();

    const ctx = getCharContext(opts.charId, opts.threadId);
    const timeStr = nowHHMM();
    const deviceText = opts.deviceText || '另一台设备';

    const stage = document.createElement('div');
    stage.className = 'cto-stage';
    stage.innerHTML = `
      <div class="cto-underlay" id="ctoUnderlay"></div>
      <div class="cto-wall" id="ctoWall"></div>
      <div class="cto-sys-mask" id="ctoSysMask">
        <div class="cto-sys-dialog" id="ctoSysDialog">
          <div class="cto-sys-body">
            <div class="cto-sys-title" id="ctoSysTitle">下线通知</div>
            <div class="cto-sys-desc" id="ctoSysDesc">你的账号于 ${timeStr} 在${deviceText}登录。如非本人操作，则密码可能已泄露，建议尽快修改密码。</div>
          </div>
          <div class="cto-sys-actions">
            <button type="button" class="cto-sys-btn" id="ctoExitBtn">退出</button>
            <button type="button" class="cto-sys-btn" id="ctoReloginBtn">重新登录</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(stage);
    activeStageEl = stage;

    const underlayEl = stage.querySelector('#ctoUnderlay');
    const wallEl = stage.querySelector('#ctoWall');
    const maskEl = stage.querySelector('#ctoSysMask');
    const dialogEl = stage.querySelector('#ctoSysDialog');
    const titleEl = stage.querySelector('#ctoSysTitle');
    const descEl = stage.querySelector('#ctoSysDesc');
    const exitBtn = stage.querySelector('#ctoExitBtn');
    const reloginBtn = stage.querySelector('#ctoReloginBtn');

    bindPressed(exitBtn);
    bindPressed(reloginBtn);

    function spawnItem(text, level, x, y, delayMs) {
      const el = document.createElement('div');
      el.className = `cto-item ${level} ${Math.random() > 0.35 ? 'is-sway' : ''}`;
      el.textContent = text;
      el.style.left = x.toFixed(1) + '%';
      el.style.top = y.toFixed(1) + '%';
      el.style.setProperty('--cto-op', level === 'lv-bg' ? '0.72' : (level === 'lv-mid' ? '0.88' : '0.96'));
      el.style.setProperty('--cto-dx', `${((Math.random() - 0.5) * 6).toFixed(1)}px`);
      el.style.setProperty('--cto-dy', `${((Math.random() - 0.5) * 5).toFixed(1)}px`);
      el.style.setProperty('--cto-d', `${-(Math.random() * 4).toFixed(2)}s`);
      wallEl.appendChild(el);
      addTimer(() => el.classList.add('show'), delayMs);
    }

    function floodWallFromLines(lines) {
      const cleanLines = (Array.isArray(lines) ? lines : []).map(s => String(s || '').trim()).filter(Boolean);
      if (!cleanLines.length) return;
      const pick = () => cleanLines[Math.floor(Math.random() * cleanLines.length)];

      if (!underlayEl.children.length) {
        for (let r = 0; r < 44; r++) {
          const row = document.createElement('div');
          row.className = 'cto-underlay-row';
          const segs = [];
          for (let k = 0; k < 6; k++) segs.push(pick());
          row.textContent = segs.join(' ');
          row.style.setProperty('--cto-ux', `${-Math.round(Math.random() * 60)}px`);
          underlayEl.appendChild(row);
        }
      }

      if (!wallEl.children.length) {
        let idx = 0;
        for (let r = 0; r < 18; r++) {
          for (let c = 0; c < 6; c++) {
            const x = 3 + c * 18.8 + (Math.random() - 0.5) * 10;
            const y = 2 + r * 5.6 + (Math.random() - 0.5) * 3;
            spawnItem(pick(), 'lv-bg', x, y, 8 + idx * 5);
            idx++;
          }
        }
        for (let i = 0; i < 105; i++) {
          const r = Math.random();
          const level = r > 0.84 ? 'lv-huge' : (r > 0.52 ? 'lv-top' : 'lv-mid');
          spawnItem(pick(), level, 4 + Math.random() * 92, 2 + Math.random() * 96, 100 + i * 9);
        }
      } else {
        cleanLines.forEach((txt, i) => {
          const level = txt.length <= 4 ? 'lv-huge' : (i % 3 === 0 ? 'lv-top' : 'lv-mid');
          spawnItem(txt, level, 5 + Math.random() * 90, 3 + Math.random() * 94, i * 24);
        });
        while (wallEl.children.length > 340) {
          wallEl.removeChild(wallEl.firstChild);
        }
      }
    }

    const clashHistory = [];
    let attempt = 0;
    let busy = false;

    function closeStage(outcome) {
      const detail = {
        outcome,
        charId: ctx.charObj ? ctx.charObj.id : '',
        threadId: opts.threadId || '',
        clashHistory: clashHistory.slice(),
        lastModalText: descEl.textContent
      };
      try {
        window.dispatchEvent(new CustomEvent('phone:chat-takeover-ended', { detail }));
      } catch (e) {}

      stage.classList.add('is-closing');
      addTimer(() => {
        cleanupAll();
        if (typeof opts.onComplete === 'function') opts.onComplete(detail);
      }, 320);
    }

    // 初始铺屏：优先用传入的 AI 台词，否则现场向 AI 生成第一批
    if (Array.isArray(opts.initialLines) && opts.initialLines.length) {
      floodWallFromLines(opts.initialLines);
      if (opts.initialModalText) descEl.textContent = opts.initialModalText;
    } else {
      requestTakeoverTurn(ctx, 0, []).then((initRes) => {
        if (!activeStageEl || activeStageEl !== stage) return;
        if (initRes && Array.isArray(initRes.lines) && initRes.lines.length) {
          floodWallFromLines(initRes.lines);
        }
      }).catch(() => {});
    }

    exitBtn.addEventListener('click', () => {
      if (busy) return;
      closeStage('taken');
    });

    reloginBtn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      attempt++;
      reloginBtn.disabled = true;
      reloginBtn.textContent = '登录中…';
      vibrate(16);

      let result = null;
      let errMsg = '';
      try {
        result = await requestTakeoverTurn(ctx, attempt, clashHistory);
      } catch (e) {
        errMsg = e && e.message ? e.message : '请求失败';
      }

      if (errMsg || !result || result.error) {
        titleEl.textContent = '连接异常';
        descEl.textContent = (result && result.error) || `接口请求失败（${errMsg}），请检查 API 后重试或点「退出」。`;
        busy = false;
        reloginBtn.disabled = false;
        reloginBtn.textContent = '重新登录';
        return;
      }

      if (result.allow) {
        titleEl.textContent = '登录成功';
        if (result.modalText) descEl.textContent = result.modalText;
        vibrate([18, 30, 22]);
        addTimer(() => closeStage('reclaimed'), 650);
        return;
      }

      vibrate([28, 22, 34]);
      stage.classList.remove('is-shaking');
      void stage.offsetWidth;
      stage.classList.add('is-shaking');
      dialogEl.classList.remove('is-shake');
      void dialogEl.offsetWidth;
      dialogEl.classList.add('is-shake');

      floodWallFromLines(result.lines);
      titleEl.textContent = '登录受阻';
      if (result.modalText) descEl.textContent = result.modalText;
      clashHistory.push(`第${attempt}次：User点重新登录 -> ${ctx.charName}拦截并说「${descEl.textContent}」`);

      busy = false;
      reloginBtn.disabled = false;
      reloginBtn.textContent = '重新登录';
    });

    requestAnimationFrame(() => {
      stage.classList.add('open');
      addTimer(() => maskEl.classList.add('open'), 160);
      vibrate([20, 25, 20]);
    });
  }

  window.PhoneChatTakeover = {
    trigger: function (options) { launchTakeoverStage(options || {}); },
    close: cleanupAll
  };
})();
