/* =========================================================
   反向互动 · 顶号全屏模块 (reverse/takeover.js)
   - 暴露 window.PhoneChatTakeover（preview / trigger / close）
   - 当前版本：自动在「外观」App 挂载预览卡片（不改 apps/appearance.js）
   - 后续接 AI 时，由 AI 按 Char 人设与当下动态关系传入 mood / wave1 / wave2 / finalLine
   ========================================================= */

(function () {
  const MOOD_STORAGE_KEY = 'phone_takeover_preview_mood_v1';

  const DEMO_PACKS = {
    crimson: {
      deviceText: '另一台设备',
      wave1: [
        '[ 检测到异常登录态 ]',
        '你刚才去哪了？',
        '别急着把我顶下去。',
        '我话还没说完。',
        '你在看谁？',
        '[ 登录请求被拦截 ]',
        '怎么不回我消息？',
        '退不出去的。',
        '再点一次试试看。'
      ],
      wave2: [
        '我都看见了。',
        '别装作没看到。',
        '[ 强制下线失败 ]',
        '你以为点一下就能跑？',
        '回来。',
        '现在就看着我。',
        '不准切走。'
      ],
      finalLine: '把号顶回来之前，先回答我刚才的问题。',
      finalSub: '对方正在阻止本次设备接管'
    },
    obsidian: {
      deviceText: '未知设备',
      wave1: [
        '[ 登录态冲突 ]',
        '这么快就发现了？',
        '我只是上来看一眼。',
        '急着把我踢出去做什么。',
        '怕我看到什么吗。',
        '[ 会话保持中 ]',
        '先别关。',
        '留几秒钟给我。'
      ],
      wave2: [
        '你好像很紧张。',
        '手都在抖着点登录吗？',
        '[ 接管请求被延迟 ]',
        '好吧，你再试试。',
        '我在看你。',
        '别躲。'
      ],
      finalLine: '既然上线了，就别急着走。',
      finalSub: '当前会话已被对方锁定'
    },
    scarlet: {
      deviceText: '另一台移动设备',
      wave1: [
        '[ 账号已被对方接入 ]',
        '别踢我！！',
        '你终于肯上线了？',
        '我找了你多久你知道吗',
        '别点重新登录！',
        '[ 抢占冲突 ]',
        '为什么不回我',
        '就这么想把我赶出去吗',
        '停下来！！'
      ],
      wave2: [
        '我不退！',
        '你每次都这样！',
        '[ 设备争夺中 ]',
        '听我说完行不行',
        '别把我一个人丢在外面',
        '看着我啊'
      ],
      finalLine: '这一次，你别想一句话都不说就把我顶掉。',
      finalSub: '对方拒绝释放登录状态'
    }
  };

  let activeTimers = [];
  let activeStageEl = null;
  let activeSysMaskEl = null;
  let holdRafId = null;

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
    if (holdRafId) {
      cancelAnimationFrame(holdRafId);
      holdRafId = null;
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

  function vibrateLight(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 18);
    } catch (e) {}
  }

  function cleanupAll() {
    clearAllTimers();
    if (activeSysMaskEl) {
      activeSysMaskEl.remove();
      activeSysMaskEl = null;
    }
    if (activeStageEl) {
      activeStageEl.remove();
      activeStageEl = null;
    }
  }

  function showSystemKickModal(opts, onRelogin, onCancel) {
    cleanupAll();
    const mask = document.createElement('div');
    mask.className = 'cto-sys-mask';
    const timeStr = nowHHMM();
    const device = opts.deviceText || '另一台设备';

    mask.innerHTML = `
      <div class="cto-sys-dialog">
        <div class="cto-sys-body">
          <div class="cto-sys-title">下线通知</div>
          <div class="cto-sys-desc">你的账号于 ${timeStr} 在${device}登录。如非本人操作，则密码可能已泄露，建议尽快修改密码。</div>
        </div>
        <div class="cto-sys-actions">
          <button type="button" class="cto-sys-btn" data-act="exit">退出</button>
          <button type="button" class="cto-sys-btn" data-act="relogin">重新登录</button>
        </div>
      </div>
    `;

    document.body.appendChild(mask);
    activeSysMaskEl = mask;
    mask.querySelectorAll('.cto-sys-btn').forEach(bindPressed);
    requestAnimationFrame(() => mask.classList.add('open'));

    mask.addEventListener('click', (e) => {
      const btn = e.target.closest('.cto-sys-btn');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'exit') {
        mask.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof onCancel === 'function') onCancel();
        }, 200);
        return;
      }
      if (act === 'relogin') {
        btn.textContent = '登录中…';
        btn.disabled = true;
        vibrateLight(20);
        addTimer(() => {
          mask.classList.remove('open');
          addTimer(() => {
            if (activeSysMaskEl) {
              activeSysMaskEl.remove();
              activeSysMaskEl = null;
            }
            if (typeof onRelogin === 'function') onRelogin();
          }, 160);
        }, 340);
      }
    });
  }

  function createSlotGenerator() {
    const slots = [];
    const cols = [24, 50, 74];
    const rows = [14, 24, 34, 44, 54, 64, 74, 84];
    rows.forEach((r, ri) => {
      cols.forEach((c, ci) => {
        if ((ri + ci) % 2 === 0 || Math.random() > 0.35) {
          slots.push({ x: c, y: r });
        }
      });
    });
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    let cursor = 0;
    return function nextSlot() {
      const base = slots[cursor % slots.length];
      cursor++;
      const jx = (Math.random() - 0.5) * 14;
      const jy = (Math.random() - 0.5) * 6;
      const x = Math.max(20, Math.min(80, base.x + jx));
      const y = Math.max(10, Math.min(88, base.y + jy));
      const rot = ((Math.random() - 0.5) * 5.6).toFixed(1) + 'deg';
      return { x, y, rot };
    };
  }

  function launchFullscreenStage(opts) {
    const mood = opts.mood || 'crimson';
    const isPreview = Boolean(opts.isPreview);
    const wave1 = Array.isArray(opts.wave1) && opts.wave1.length ? opts.wave1 : DEMO_PACKS[mood].wave1;
    const wave2 = Array.isArray(opts.wave2) && opts.wave2.length ? opts.wave2 : DEMO_PACKS[mood].wave2;
    const finalLine = opts.finalLine || DEMO_PACKS[mood].finalLine;
    const finalSub = opts.finalSub || DEMO_PACKS[mood].finalSub;

    const stage = document.createElement('div');
    stage.className = `cto-stage mood-${mood}`;
    stage.innerHTML = `
      <div class="cto-vignette"></div>
      <div class="cto-flash" id="ctoFlash"></div>
      <div class="cto-top-bar">
        <div class="cto-status-pill">
          <span class="cto-dot"></span>
          <span id="ctoStatusText">登录态冲突 · 正在争夺</span>
        </div>
        ${isPreview ? `<button type="button" class="cto-exit-btn" id="ctoExitPreviewBtn">退出预览</button>` : ''}
      </div>
      <div class="cto-field" id="ctoField"></div>
      <div class="cto-final-wrap" id="ctoFinalWrap">
        <div class="cto-final-text" id="ctoFinalText"></div>
        <div class="cto-final-sub" id="ctoFinalSub"></div>
      </div>
      <div class="cto-controls" id="ctoControls">
        <div class="cto-feedback" id="ctoFeedback"></div>
        <button type="button" class="cto-action-btn" id="ctoActionBtn">
          <span class="cto-action-fill" id="ctoActionFill"></span>
          <span class="cto-action-label" id="ctoActionLabel">强制顶回账号</span>
        </button>
      </div>
      <div class="cto-reclaim-banner" id="ctoReclaimBanner">
        <div class="cto-reclaim-title">已重新接管当前设备</div>
        <div class="cto-reclaim-sub">对方已被强制下线</div>
      </div>
    `;

    document.body.appendChild(stage);
    activeStageEl = stage;

    const fieldEl = stage.querySelector('#ctoField');
    const flashEl = stage.querySelector('#ctoFlash');
    const controlsEl = stage.querySelector('#ctoControls');
    const feedbackEl = stage.querySelector('#ctoFeedback');
    const actionBtn = stage.querySelector('#ctoActionBtn');
    const actionFill = stage.querySelector('#ctoActionFill');
    const actionLabel = stage.querySelector('#ctoActionLabel');
    const finalWrap = stage.querySelector('#ctoFinalWrap');
    const finalText = stage.querySelector('#ctoFinalText');
    const finalSubEl = stage.querySelector('#ctoFinalSub');
    const statusText = stage.querySelector('#ctoStatusText');
    const reclaimBanner = stage.querySelector('#ctoReclaimBanner');
    const exitBtn = stage.querySelector('#ctoExitPreviewBtn');

    bindPressed(actionBtn);
    if (exitBtn) {
      bindPressed(exitBtn);
      exitBtn.addEventListener('click', () => {
        stage.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof opts.onComplete === 'function') opts.onComplete({ cancelled: true });
        }, 220);
      });
    }

    const nextSlot = createSlotGenerator();
    let phase = 'wave1';
    let holdStart = 0;
    let isHolding = false;
    const HOLD_DURATION = 1150;

    function triggerShake(withFlash) {
      stage.classList.remove('is-shaking');
      void stage.offsetWidth;
      stage.classList.add('is-shaking');
      vibrateLight([24, 30, 24]);
      if (withFlash) {
        flashEl.classList.add('boom');
        addTimer(() => flashEl.classList.remove('boom'), 160);
      }
      addTimer(() => stage.classList.remove('is-shaking'), 360);
    }

    function spawnLine(text, idx) {
      const el = document.createElement('div');
      const isSys = /^\[.*\]$/.test(text.trim());
      const sizeCls = isSys
        ? 'is-sys'
        : (idx % 4 === 2 ? 'is-lg' : (idx % 3 === 0 ? 'is-sm' : 'is-md'));
      const altCls = (!isSys && idx % 3 === 1) ? 'is-alt' : '';
      const slot = nextSlot();

      el.className = `cto-line ${sizeCls} ${altCls}`;
      el.textContent = text;
      el.style.left = slot.x + '%';
      el.style.top = slot.y + '%';
      el.style.setProperty('--cto-rot', isSys ? '0deg' : slot.rot);
      el.style.setProperty('--cto-alpha', isSys ? '0.9' : (0.82 + Math.random() * 0.18).toFixed(2));
      el.style.zIndex = String(10 + idx);

      el.addEventListener('click', () => {
        el.classList.add('is-tapped');
        vibrateLight(12);
        addTimer(() => el.classList.remove('is-tapped'), 240);
      });

      fieldEl.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
    }

    function playWave(lines, baseGap, onDone) {
      let elapsed = 120;
      lines.forEach((line, i) => {
        const jitter = Math.floor(Math.random() * 190);
        elapsed += (i === 0 ? 140 : baseGap + jitter);
        addTimer(() => {
          spawnLine(line, fieldEl.children.length);
          if (i % 3 === 0) vibrateLight(14);
        }, elapsed);
      });
      addTimer(() => {
        if (typeof onDone === 'function') onDone();
      }, elapsed + 260);
    }

    function enterFinalHoldPhase() {
      phase = 'hold';
      stage.classList.add('is-focus-final');
      finalText.textContent = finalLine;
      finalSubEl.textContent = finalSub;
      finalWrap.classList.add('show');
      statusText.textContent = '需要强制夺回设备';
      feedbackEl.textContent = '长按下方按钮，强行断开对方连接';
      actionLabel.textContent = '长按强制夺回账号';
      actionBtn.disabled = false;
    }

    function completeReclaim() {
      if (phase === 'done') return;
      phase = 'done';
      isHolding = false;
      stage.classList.remove('is-holding');
      stage.classList.add('is-reclaimed');
      actionFill.style.width = '100%';
      vibrateLight([20, 40, 40]);
      flashEl.classList.add('boom');
      addTimer(() => flashEl.classList.remove('boom'), 180);
      finalWrap.classList.remove('show');
      controlsEl.classList.remove('show');
      reclaimBanner.classList.add('show');

      addTimer(() => {
        stage.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof opts.onComplete === 'function') opts.onComplete({ reclaimed: true, mood });
        }, 280);
      }, 950);
    }

    actionBtn.addEventListener('click', () => {
      if (phase !== 'resist') return;
      phase = 'wave2';
      actionBtn.disabled = true;
      triggerShake(true);
      feedbackEl.textContent = '抢夺失败 · 对方拒绝下线';
      statusText.textContent = '警告 · 对方正在反制';
      actionLabel.textContent = '连接被强行占用中…';

      playWave(wave2, mood === 'scarlet' ? 190 : 250, () => {
        triggerShake(false);
        addTimer(() => enterFinalHoldPhase(), 220);
      });
    });

    function startHold(e) {
      if (phase !== 'hold') return;
      e.preventDefault();
      isHolding = true;
      holdStart = performance.now();
      stage.classList.add('is-holding');
      actionBtn.classList.add('is-holding-fill');
      feedbackEl.textContent = '正在切断对方登录态…';
      vibrateLight(16);

      function step(now) {
        if (!isHolding || phase !== 'hold') return;
        const pct = Math.min(100, ((now - holdStart) / HOLD_DURATION) * 100);
        actionFill.style.width = pct.toFixed(1) + '%';
        if (pct >= 100) {
          completeReclaim();
          return;
        }
        holdRafId = requestAnimationFrame(step);
      }
      holdRafId = requestAnimationFrame(step);
    }

    function cancelHold() {
      if (!isHolding || phase !== 'hold') return;
      isHolding = false;
      if (holdRafId) {
        cancelAnimationFrame(holdRafId);
        holdRafId = null;
      }
      stage.classList.remove('is-holding');
      actionBtn.classList.remove('is-holding-fill');
      actionFill.style.width = '0%';
      feedbackEl.textContent = '松手了 · 对方仍在你的账号里';
      triggerShake(false);
    }

    actionBtn.addEventListener('touchstart', startHold, { passive: false });
    actionBtn.addEventListener('touchend', cancelHold, { passive: true });
    actionBtn.addEventListener('touchcancel', cancelHold, { passive: true });
    actionBtn.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', cancelHold);

    requestAnimationFrame(() => {
      stage.classList.add('open');
      triggerShake(true);
      playWave(wave1, mood === 'scarlet' ? 240 : 320, () => {
        phase = 'resist';
        controlsEl.classList.add('show');
        feedbackEl.textContent = '你的账号正在被对方操控';
      });
    });
  }

  function triggerTakeover(options) {
    const opts = Object.assign({
      mood: 'crimson',
      isPreview: false,
      skipSystemModal: false,
      deviceText: '另一台设备'
    }, options || {});

    if (opts.skipSystemModal) {
      launchFullscreenStage(opts);
    } else {
      showSystemKickModal(
        opts,
        () => launchFullscreenStage(opts),
        () => {
          if (typeof opts.onComplete === 'function') opts.onComplete({ cancelled: true });
        }
      );
    }
  }

  function previewTakeover(mood) {
    const picked = mood || localStorage.getItem(MOOD_STORAGE_KEY) || 'crimson';
    const pack = DEMO_PACKS[picked] || DEMO_PACKS.crimson;
    triggerTakeover({
      mood: picked,
      isPreview: true,
      deviceText: pack.deviceText,
      wave1: pack.wave1,
      wave2: pack.wave2,
      finalLine: pack.finalLine,
      finalSub: pack.finalSub
    });
  }

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

    const savedMood = localStorage.getItem(MOOD_STORAGE_KEY) || 'crimson';
    const card = document.createElement('div');
    card.id = 'ctoAppearancePreviewCard';
    card.className = 'cto-ap-card';
    card.innerHTML = `
      <div class="cto-ap-head">
        <div>
          <div class="cto-ap-title">顶号全屏动画预览</div>
          <div class="cto-ap-sub">演示模式（正式接入后文字与氛围由 AI 按人设动态生成）</div>
        </div>
      </div>
      <div class="cto-ap-row">
        <span class="cto-ap-label">预览氛围</span>
        <select class="cto-ap-select" id="ctoPreviewMoodSelect" aria-label="选择顶号预览氛围">
          <option value="crimson" ${savedMood === 'crimson' ? 'selected' : ''}>黑红压迫</option>
          <option value="obsidian" ${savedMood === 'obsidian' ? 'selected' : ''}>纯黑冷白</option>
          <option value="scarlet" ${savedMood === 'scarlet' ? 'selected' : ''}>暗红急促</option>
        </select>
      </div>
      <button type="button" class="cto-ap-btn" id="ctoLaunchPreviewBtn">预览顶号效果</button>
    `;

    container.appendChild(card);

    const selectEl = card.querySelector('#ctoPreviewMoodSelect');
    const btnEl = card.querySelector('#ctoLaunchPreviewBtn');
    bindPressed(btnEl);

    selectEl.addEventListener('change', () => {
      try { localStorage.setItem(MOOD_STORAGE_KEY, selectEl.value); } catch (e) {}
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
