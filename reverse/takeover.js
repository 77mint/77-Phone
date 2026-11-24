/* =========================================================
   反向互动 · 顶号实时博弈模块 (reverse/takeover.js)
   - 单一纯正视觉：无缝暗红底墙 + 210+ 条暗血红宋体全屏叠压
   - 100% 真实 AI 博弈：无固定次数脚本，每次点「重新登录」实时请求 AI 决定
   - 暴露 window.PhoneChatTakeover（preview / trigger / close）
   ========================================================= */

(function () {
  const PREVIEW_CHAR_KEY = 'phone_takeover_preview_char_v1';

  const BASE_BG = [
    '为什么不回我消息', '我一直在看着你', '你在和谁说话',
    '别想甩掉我', '不要丢下我', '只能看着我', '我什么都可以做',
    '别关掉', '把手机给我', '你只能看见我', '为什么不理我',
    '你刚才去哪里了', '别装作没看到', '永远别想逃走'
  ];

  const BASE_MID = [
    '为什么不来找我', '别不要我', '你在看什么？',
    '你别想甩掉我', '快说你爱我', '永远在一起',
    '别想从我身边逃走', '我就在你身后', '还要点几次重新登录？'
  ];

  const BASE_TOP = [
    '我在你家楼下', '一直都在看着你', '别想逃', '你在和谁聊天',
    '现在就看着我', '不准切出去', '你以为能顶掉我吗'
  ];

  const BASE_HUGE = ['看着我', '别走', '只有我', '我爱你'];

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

  /* ---------------- 兼容读取 API 配置 ---------------- */
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

  /* ---------------- 读取 Char 人设与最近聊天上下文 ---------------- */
  function getCharsList() {
    try {
      if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
        return window.PhoneArchive.getChars() || [];
      }
    } catch (e) {}
    return [];
  }

  function getCharContext(charId, threadId) {
    const chars = getCharsList();
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
          recentLines = msgs.slice(-10).map(m => {
            const who = m.sender === 'me' ? 'User' : charName;
            return `${who}: ${m.text || m.transcript || '[消息]'}`;
          });
        }
      }
    } catch (e) {}

    return { charObj, charName, persona, recentLines };
  }

  /* ---------------- 实时请求 AI 决定「重新登录」结果（无固定次数） ---------------- */
  async function requestTakeoverTurn(ctx, attemptNum, clashHistory) {
    const active = resolveActiveApiConfig();
    if (!active) {
      return { error: '未检测到可用的聊天 API 配置，请先在「API」中填写接口地址、Key 和模型。' };
    }

    const systemPrompt = [
      `你现在正在扮演「${ctx.charName}」。`,
      ctx.persona ? `【角色人设】\n${ctx.persona}` : '【角色人设】与 User 有深层羁绊和复杂情绪的角色。',
      ctx.recentLines.length ? `【最近聊天上下文】\n${ctx.recentLines.join('\n')}` : '',
      `【当前情境】`,
      `你刚刚登录了 User 的账号，把 User 踢下线了。现在 User 屏幕弹出系统「下线通知」弹窗，正在第 ${attemptNum} 次点击「重新登录」试图把你顶下去。`,
      `没有任何预设次数限制，完全基于你此刻的性格、感情状态和刚才聊过的内容自己决定：`,
      `1. 你此刻是继续占着账号不让 User 登回去（allow: false），还是心软/退让/被顶下线而放行让 User 登回来（allow: true）？`,
      `2. 如果不放行，给出弹窗里显示的短句（modalText，25字以内，贴合你此刻语气），以及 12~16 句铺上屏幕的暗红执念/情绪短句（lines，每句 2~10 字）。`,
      `3. 如果放行（allow: true），给出弹窗最后闪过的一句话（modalText，18字以内）。`,
      `严格只输出 JSON，不要 markdown 代码块，格式：{"allow":false,"modalText":"...","lines":["...","..."]}`
    ].filter(Boolean).join('\n\n');

    const userPrompt = clashHistory.length
      ? `前几轮顶号过程：\n${clashHistory.join('\n')}\n现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`
      : `现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`;

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
        max_tokens: 512,
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

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
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
          detail: `模型 ${active.model} 第 ${attemptNum} 次响应`
        });
      }
    } catch (e) {}

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { allow: false, modalText: rawText.slice(0, 28) || '你别想把我顶下去。', lines: [] };
    }
    return JSON.parse(jsonMatch[0]);
  }

  /* ---------------- 暗红全屏主舞台 + 真实双键弹窗 ---------------- */
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

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)] || '看着我';
    }

    /* 1. 底层无缝铺满 44 行暗红密字，彻底消除黑缝 */
    for (let r = 0; r < 44; r++) {
      const row = document.createElement('div');
      row.className = 'cto-underlay-row';
      const segs = [];
      for (let k = 0; k < 6; k++) segs.push(pick(BASE_BG));
      row.textContent = segs.join(' ');
      row.style.setProperty('--cto-ux', `${-Math.round(Math.random() * 60)}px`);
      underlayEl.appendChild(row);
    }

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

    /* 2. 中层 + 顶层叠压 210 条暗红字，全屏无死角 */
    let idx = 0;
    for (let r = 0; r < 18; r++) {
      for (let c = 0; c < 6; c++) {
        const x = 3 + c * 18.8 + (Math.random() - 0.5) * 10;
        const y = 2 + r * 5.6 + (Math.random() - 0.5) * 3;
        spawnItem(pick(BASE_BG), 'lv-bg', x, y, 8 + idx * 5);
        idx++;
      }
    }
    for (let i = 0; i < 105; i++) {
      const r = Math.random();
      let level = 'lv-mid';
      let pool = BASE_MID;
      if (r > 0.85) { level = 'lv-huge'; pool = BASE_HUGE; }
      else if (r > 0.52) { level = 'lv-top'; pool = BASE_TOP; }
      spawnItem(pick(pool), level, 4 + Math.random() * 92, 2 + Math.random() * 96, 120 + i * 10);
    }

    function pileExtraLines(lines) {
      const arr = (Array.isArray(lines) && lines.length) ? lines : BASE_TOP;
      arr.forEach((txt, i) => {
        const clean = String(txt || '').trim();
        if (!clean) return;
        const level = clean.length <= 4 ? 'lv-huge' : (i % 3 === 0 ? 'lv-top' : 'lv-mid');
        spawnItem(clean, level, 5 + Math.random() * 90, 3 + Math.random() * 94, i * 26);
      });
      while (wallEl.children.length > 340) {
        wallEl.removeChild(wallEl.firstChild);
      }
    }

    function closeStage(outcome) {
      stage.classList.add('is-closing');
      addTimer(() => {
        cleanupAll();
        if (typeof opts.onComplete === 'function') {
          opts.onComplete({ outcome, charId: ctx.charObj ? ctx.charObj.id : '' });
        }
      }, 320);
    }

    let attempt = 0;
    let busy = false;
    const clashHistory = [];

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

      if (errMsg || (result && result.error)) {
        titleEl.textContent = '连接异常';
        descEl.textContent = (result && result.error) || `接口请求失败（${errMsg}），请检查 API 设置后重试，或点「退出」。`;
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

      pileExtraLines(result.lines);
      titleEl.textContent = '登录受阻';
      descEl.textContent = result.modalText || '对方拒绝释放当前登录状态。';
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

  /* ---------------- 对外统一入口 ---------------- */
  function triggerTakeover(options) {
    launchTakeoverStage(options || {});
  }

  function previewTakeover(charId) {
    const picked = charId || localStorage.getItem(PREVIEW_CHAR_KEY) || '';
    triggerTakeover({
      charId: picked,
      isPreview: true,
      deviceText: '另一台设备'
    });
  }

  /* ---------------- 自动挂载预览卡片到「外观」App ---------------- */
  function findAppearanceMountContainer() {
    const appEl = document.getElementById('app-appearance');
    if (!appEl) return null;
    const known = appEl.querySelector('.ap-scroll, .ap-content, .ap-body, .ap-main, .ap-list');
    if (known) return known;
    const divs = appEl.querySelectorAll('div');
    for (let i = 0; i < divs.length; i++) {
      const style = window.getComputedStyle(divs[i]);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return divs[i];
    }
    return appEl;
  }

  function mountPreviewCardInAppearance() {
    const container = findAppearanceMountContainer();
    if (!container || container.querySelector('#ctoAppearancePreviewCard')) return;

    const chars = getCharsList();
    const savedCharId = localStorage.getItem(PREVIEW_CHAR_KEY) || (chars[0] ? chars[0].id : '');
    const optionsHtml = chars.length
      ? chars.map(c => `<option value="${c.id}" ${c.id === savedCharId ? 'selected' : ''}>${c.name || c.nickname || '未命名角色'}</option>`).join('')
      : `<option value="">默认演示（未建角色）</option>`;

    const card = document.createElement('div');
    card.id = 'ctoAppearancePreviewCard';
    card.className = 'cto-ap-card';
    card.innerHTML = `
      <div class="cto-ap-head">
        <div class="cto-ap-title">顶号实时博弈预览</div>
        <div class="cto-ap-sub">暗红宋体铺满全屏，每次点「重新登录」实时请求 AI 决定是否放行</div>
      </div>
      <div class="cto-ap-row">
        <span class="cto-ap-label">测试角色</span>
        <select class="cto-ap-select" id="ctoPreviewCharSelect" aria-label="选择顶号测试角色">${optionsHtml}</select>
      </div>
      <button type="button" class="cto-ap-btn" id="ctoLaunchPreviewBtn">预览顶号效果</button>
    `;

    container.appendChild(card);

    const selectEl = card.querySelector('#ctoPreviewCharSelect');
    const btnEl = card.querySelector('#ctoLaunchPreviewBtn');
    bindPressed(btnEl);

    selectEl.addEventListener('change', () => {
      try { localStorage.setItem(PREVIEW_CHAR_KEY, selectEl.value); } catch (e) {}
    });

    btnEl.addEventListener('click', () => {
      previewTakeover(selectEl.value);
    });
  }

  function initAppearanceHook() {
    const appEl = document.getElementById('app-appearance');
    if (!appEl) return;
    mountPreviewCardInAppearance();
    const obs = new MutationObserver(() => {
      if (!appEl.querySelector('#ctoAppearancePreviewCard')) {
        mountPreviewCardInAppearance();
      }
    });
    obs.observe(appEl, { childList: true, subtree: true });
  }

  window.PhoneChatTakeover = {
    preview: previewTakeover,
    trigger: triggerTakeover,
    close: cleanupAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppearanceHook);
  } else {
    initAppearanceHook();
  }
})();
