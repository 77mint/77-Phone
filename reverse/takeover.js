/* =========================================================
   反向互动 · 顶号实时博弈模块 (reverse/takeover.js)
   - Canvas 单图层绘制暗血红宋体全屏叠字（丝滑 60fps、彻底解决 iOS Safari 爆显存刷新）
   - 渐进加速铺满：由少到多、越来越快直到吞没全屏
   - 100% 真实 AI 博弈：严格对齐 PhoneAPI.getConfig('llm')
   ========================================================= */

(function () {
  const SERIF_STACK = '"Songti SC", "STSong", "Noto Serif SC", "PingFang SC", Georgia, serif';

  let activeTimers = [];
  let activeStageEl = null;
  let activeRafId = null;

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
    if (activeRafId) {
      cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }
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

  function getBaseFontSize() {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-font-size');
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed) && parsed > 8) return parsed;
    } catch (e) {}
    return 15;
  }

  function cleanupAll() {
    clearAllTimers();
    if (activeStageEl) {
      activeStageEl.remove();
      activeStageEl = null;
    }
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

  async function callLlmSlot(slot, temperature, systemPrompt, userPrompt) {
    const type = slot.type || 'openai';
    const base = normalizeBaseUrl(slot.url, type);
    if (!base || !slot.key) throw new Error('尚未在「API配置」填写语言模型地址或 Key');
    if (!slot.model) throw new Error('尚未在「API配置」填写语言模型名称');

    if (type === 'google') {
      const url = `${base}/v1beta/models/${encodeURIComponent(slot.model)}:generateContent?key=${encodeURIComponent(slot.key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature }
        })
      });
      if (!res.ok) throw new Error(await readHttpError(res));
      const data = await res.json();
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      return parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
    }

    if (type === 'anthropic') {
      const url = `${base}/v1/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': slot.key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: slot.model,
          max_tokens: 768,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (!res.ok) throw new Error(await readHttpError(res));
      const data = await res.json();
      const blocks = Array.isArray(data.content) ? data.content : [];
      return blocks.filter(b => b.type === 'text').map(b => b.text || '').join('').trim();
    }

    const url = `${base}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slot.key}`
      },
      body: JSON.stringify({
        model: slot.model,
        temperature,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!res.ok) throw new Error(await readHttpError(res));
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    if (Array.isArray(msg.content)) {
      return msg.content.filter(b => b && (b.type === 'text' || typeof b.text === 'string')).map(b => b.text || '').join('').trim();
    }
    return String(msg.content || '').trim();
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
      ? [charObj.persona, charObj.personality, charObj.background, charObj.bio, charObj.setting].filter(Boolean).join('\n')
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
    if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
      throw new Error('PhoneAPI 未就绪');
    }
    const cfg = window.PhoneAPI.getConfig('llm');
    if (!cfg || !cfg.primary) {
      throw new Error('未找到语言模型配置');
    }
    const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 0.9;
    const isInitial = attemptNum === 0;

    const systemPrompt = [
      `你现在正在扮演「${ctx.charName}」。`,
      ctx.persona ? `【角色人设】\n${ctx.persona}` : '',
      ctx.recentLines.length ? `【最近聊天上下文】\n${ctx.recentLines.join('\n')}` : '',
      `【当前情境】`,
      isInitial
        ? `你刚刚主动登录了 User 的账号，把 User 踢下线了。现在 User 屏幕已经弹出「下线通知」。请结合你的人设、你们当下的关系以及刚才聊过的内容，现场写出 14~20 句此刻盘旋在你心头、将铺满 User 屏幕的暗红短句（lines，每句 2~12 字，完全符合你自己的口吻与情绪）。`
        : `你刚刚主动登录了 User 的账号，把 User 踢下线了，说明你此刻正有强烈的情绪或话想留住对方。现在 User 正在第 ${attemptNum} 次点击「重新登录」试图把你顶下去。没有任何预设次数限制，完全基于你此刻的人设、感情状态和刚才聊过的内容自己决定：\n1. 此刻是继续占着账号拦住 User（allow: false），还是确实心软/退让/被顶下线而放行（allow: true）？\n2. 弹窗提示语（modalText，25字以内，贴合你此刻对 User 说的话）。\n3. 若不放行，给出 12~18 句新铺上屏幕的短句（lines，每句 2~12 字）。`,
      `严格只输出 JSON，不要 markdown 代码块，格式：{"allow":false,"modalText":"...","lines":["..."]}`
    ].filter(Boolean).join('\n\n');

    const userPrompt = isInitial
      ? `你已接入 User 账号，请立即生成此刻铺满屏幕的短句。`
      : (clashHistory.length
        ? `前几轮顶号过程：\n${clashHistory.join('\n')}\n现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`
        : `现在 User 第 ${attemptNum} 次点击了「重新登录」。请立即做出真实反应。`);

    let rawText = '';
    let usedModel = cfg.primary.model;
    let retried = false;

    try {
      rawText = await callLlmSlot(cfg.primary, temp, systemPrompt, userPrompt);
    } catch (err) {
      const hasBackup = cfg.backupEnabled && cfg.backup && cfg.backup.url && cfg.backup.key;
      if (cfg.autoRetry) {
        const retrySlot = hasBackup ? cfg.backup : cfg.primary;
        usedModel = retrySlot.model;
        retried = true;
        try {
          rawText = await callLlmSlot(retrySlot, temp, systemPrompt, userPrompt);
        } catch (err2) {
          window.PhoneAPI.addLog({ module: 'LLM', source: '顶号实时对抗', ok: false, rawError: err2.message || String(err2) });
          throw err2;
        }
      } else {
        window.PhoneAPI.addLog({ module: 'LLM', source: '顶号实时对抗', ok: false, rawError: err.message || String(err) });
        throw err;
      }
    }

    try {
      window.PhoneAPI.addLog({
        module: 'LLM',
        source: retried ? '顶号实时对抗（重试）' : '顶号实时对抗',
        ok: true,
        rawError: `模型 ${usedModel} 第 ${attemptNum} 轮响应成功`
      });
    } catch (e) {}

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { allow: false, modalText: rawText.slice(0, 28) || '你别想把我顶下去。', lines: [] };
    }
    return JSON.parse(jsonMatch[0]);
  }

  /* ---------------- 轻量单层 Canvas 渐进叠字渲染器 ---------------- */
  function createCanvasWall(canvasEl) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    const baseFs = getBaseFontSize();

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
    }
    resize();

    const items = [];
    let hasInitialFlood = false;
    const ctx2d = canvasEl.getContext('2d');

    function addWord(text, level, xPct, yPct, appearAtMs) {
      const cfgMap = {
        under: { size: Math.max(11, baseFs - 2), weight: '500', color: 'rgba(96, 7, 14, 0.56)', blur: 2, alpha: 0.9 },
        bg:    { size: Math.max(11, baseFs - 2), weight: '500', color: 'rgba(122, 9, 18, 0.76)', blur: 3, alpha: 0.9 },
        mid:   { size: baseFs + 3,               weight: '600', color: 'rgba(156, 13, 24, 0.88)', blur: 5, alpha: 0.94 },
        top:   { size: baseFs + 10,              weight: '700', color: 'rgba(170, 15, 28, 0.96)', blur: 8, alpha: 0.98 },
        huge:  { size: baseFs + 18,              weight: '800', color: 'rgba(186, 17, 31, 0.98)', blur: 10, alpha: 1 }
      };
      const cfg = cfgMap[level] || cfgMap.mid;
      items.push({
        text,
        x: (xPct / 100) * width,
        y: (yPct / 100) * height,
        size: cfg.size,
        weight: cfg.weight,
        color: cfg.color,
        blur: cfg.blur,
        targetAlpha: cfg.alpha,
        appearAt: appearAtMs,
        fadeDur: level === 'under' ? 520 : 280
      });
    }

    function floodLines(lines) {
      const clean = (Array.isArray(lines) ? lines : []).map(s => String(s || '').trim()).filter(Boolean);
      if (!clean.length) return;
      const pick = () => clean[Math.floor(Math.random() * clean.length)];
      const now = performance.now();

      if (!hasInitialFlood) {
        hasInitialFlood = true;

        // 1. 前 10 句慢节奏浮出，让人清楚看到字在一条条多起来
        for (let i = 0; i < 10; i++) {
          const lv = i % 3 === 0 ? 'top' : 'mid';
          addWord(pick(), lv, 12 + Math.random() * 76, 10 + Math.random() * 78, now + 120 + i * 160);
        }

        // 2. 底层无缝密字逐行渗出（1.0s ~ 3.6s）
        const rowOrder = Array.from({ length: 42 }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (let r = 0; r < 42; r++) {
          const segs = [];
          for (let k = 0; k < 7; k++) segs.push(pick());
          const yPct = (r / 41) * 100;
          const xPct = 42 + (Math.random() - 0.5) * 24;
          addWord(segs.join(' '), 'under', xPct, yPct, now + 1000 + rowOrder[r] * 60);
        }

        // 3. 中/上/大字加速铺满全屏（1.1s ~ 4.2s）
        const pts = [];
        for (let r = 0; r < 16; r++) {
          for (let c = 0; c < 6; c++) {
            pts.push({
              x: 3 + c * 18.8 + (Math.random() - 0.5) * 10,
              y: 2 + r * 6.2 + (Math.random() - 0.5) * 3.5,
              lv: 'bg'
            });
          }
        }
        for (let i = 0; i < 95; i++) {
          const rnd = Math.random();
          pts.push({
            x: 5 + Math.random() * 90,
            y: 3 + Math.random() * 94,
            lv: rnd > 0.85 ? 'huge' : (rnd > 0.52 ? 'top' : 'mid')
          });
        }
        pts.sort(() => Math.random() - 0.5);

        pts.forEach((pt, idx) => {
          const p = idx / pts.length;
          const delay = 1100 + Math.pow(p, 0.72) * 3100;
          addWord(pick(), pt.lv, pt.x, pt.y, now + delay);
        });
      } else {
        // 每次「重新登录」被拦：继续渐进往上叠 24 句新词
        const count = Math.max(clean.length, 24);
        for (let i = 0; i < count; i++) {
          const txt = clean[i % clean.length];
          const lv = txt.length <= 4 ? 'huge' : (i % 3 === 0 ? 'top' : 'mid');
          addWord(txt, lv, 6 + Math.random() * 88, 4 + Math.random() * 92, now + 40 + i * 50);
        }
        if (items.length > 420) {
          items.splice(0, items.length - 420);
        }
      }
    }

    function renderFrame(now) {
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, width, height);
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (now < it.appearAt) continue;
        const t = Math.min(1, (now - it.appearAt) / it.fadeDur);
        const alpha = it.targetAlpha * t;
        const scale = 1.06 - 0.06 * t;

        ctx2d.save();
        ctx2d.globalAlpha = alpha;
        ctx2d.font = `${it.weight} ${Math.round(it.size * scale)}px ${SERIF_STACK}`;
        ctx2d.fillStyle = it.color;
        ctx2d.shadowColor = 'rgba(110, 4, 12, 0.65)';
        ctx2d.shadowBlur = it.blur;
        ctx2d.fillText(it.text, it.x, it.y);
        ctx2d.restore();
      }

      activeRafId = requestAnimationFrame(renderFrame);
    }

    activeRafId = requestAnimationFrame(renderFrame);
    return { floodLines, resize };
  }

  function launchTakeoverStage(opts) {
    cleanupAll();

    const ctx = getCharContext(opts.charId, opts.threadId);
    const timeStr = nowHHMM();
    const deviceText = opts.deviceText || '另一台设备';

    const stage = document.createElement('div');
    stage.className = 'cto-stage';
    stage.innerHTML = `
      <canvas class="cto-canvas" id="ctoCanvas"></canvas>
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

    const canvasEl = stage.querySelector('#ctoCanvas');
    const maskEl = stage.querySelector('#ctoSysMask');
    const dialogEl = stage.querySelector('#ctoSysDialog');
    const titleEl = stage.querySelector('#ctoSysTitle');
    const descEl = stage.querySelector('#ctoSysDesc');
    const exitBtn = stage.querySelector('#ctoExitBtn');
    const reloginBtn = stage.querySelector('#ctoReloginBtn');

    bindPressed(exitBtn);
    bindPressed(reloginBtn);

    const wall = createCanvasWall(canvasEl);

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

    if (Array.isArray(opts.initialLines) && opts.initialLines.length) {
      wall.floodLines(opts.initialLines);
      if (opts.initialModalText) descEl.textContent = opts.initialModalText;
    } else {
      requestTakeoverTurn(ctx, 0, []).then((initRes) => {
        if (!activeStageEl || activeStageEl !== stage) return;
        if (initRes && Array.isArray(initRes.lines) && initRes.lines.length) {
          wall.floodLines(initRes.lines);
        }
      }).catch(() => {});
    }

    exitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (busy) return;
      closeStage('taken');
    });

    reloginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
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
      } catch (err) {
        errMsg = err && err.message ? err.message : '请求失败';
      }

      if (errMsg || !result) {
        titleEl.textContent = '连接异常';
        descEl.textContent = `接口请求失败（${errMsg || '无响应'}），请检查 API 后重试或点「退出」。`;
        busy = false;
        reloginBtn.disabled = false;
        reloginBtn.textContent = '重新登录';
        return;
      }

      if (result.allow) {
        titleEl.textContent = '登录成功';
        if (result.modalText) descEl.textContent = result.modalText;
        vibrate([18, 30, 22]);
        addTimer(() => closeStage('reclaimed'), 1600);
        return;
      }

      vibrate([28, 22, 34]);
      stage.classList.remove('is-shaking');
      void stage.offsetWidth;
      stage.classList.add('is-shaking');
      dialogEl.classList.remove('is-shake');
      void dialogEl.offsetWidth;
      dialogEl.classList.add('is-shake');

      wall.floodLines(result.lines);
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
