/* =========================================================
   反向互动 · 顶号全屏模块 (reverse/takeover.js)
   - 三套独立视觉：p1(眩晕密字墙) / p2(红字叠满屏) / p3(阴湿宋体排版)
   - 零游戏感 UI：纯上滑手势挣脱 + 真实暗黑系统「下线通知」弹窗互顶
   - 暴露 window.PhoneChatTakeover（preview / trigger / close）
   ========================================================= */

(function () {
  const STYLE_STORAGE_KEY = 'phone_takeover_preview_style_v2';

  const DEMO_PACKS = {
    p1: {
      deviceText: '另一台设备',
      phrase: '你只能是我的',
      hijackTexts: ['别点', '留下来', '不准退']
    },
    p2: {
      deviceText: '另一台设备',
      bgPhrases: [
        '为什么不回我消息', '我一直在看着你', '你在和谁说话',
        '别想甩掉我', '不要丢下我', '只能看着我', '我什么都可以做'
      ],
      midPhrases: [
        '为什么不来找我', '别不要我', '你在看什么？',
        '你别想甩掉我', '快说你爱我', '永远在一起'
      ],
      topPhrases: [
        '我在你家楼下', '一直都在看着你', '别想逃', '你在和谁聊天'
      ],
      hugeWords: ['看着我', '别走', '只有我'],
      hijackTexts: ['不许退', '看着我', '别关掉']
    },
    p3: {
      deviceText: '未知设备',
      lines: [
        { text: '说', kw: '爱', after: '这个词，', offset: -12 },
        { text: '不觉得', sub: true, offset: 6 },
        { text: '嘴里有', kw: '血腥', after: '味吗？', big: true, offset: 0 }
      ],
      whispers: [
        { text: '你刚才在看谁', pos: 'pos-left' },
        { text: '为什么不说话', pos: 'pos-right' },
        { text: '装作不在吗', pos: 'pos-mid' },
        { text: '感觉不到吗', pos: 'pos-low' }
      ],
      extraWhispers: [
        '手还在发抖吗', '别急着关掉', '我就在这里'
      ],
      hijackTexts: ['别躲', '回答我', '不准走']
    }
  };

  let activeTimers = [];
  let activeStageEl = null;
  let activeSysMaskEl = null;

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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  /* ---------------- 真实系统「下线通知」弹窗 ---------------- */
  function showSystemAlert(opts) {
    if (activeSysMaskEl) {
      activeSysMaskEl.remove();
      activeSysMaskEl = null;
    }

    const mask = document.createElement('div');
    mask.className = `cto-sys-mask ${opts.dark ? 'is-dark' : ''}`;
    const timeStr = nowHHMM();
    const device = opts.deviceText || '另一台设备';
    const titleText = opts.title || '下线通知';
    const descText = opts.desc || `你的账号于 ${timeStr} 在${device}登录。如非本人操作，则密码可能已泄露，建议尽快修改密码。`;
    const leftText = opts.leftText || '退出';
    const rightText = opts.rightText || '重新登录';

    mask.innerHTML = `
      <div class="cto-sys-dialog">
        <div class="cto-sys-body">
          <div class="cto-sys-title">${escapeHtml(titleText)}</div>
          <div class="cto-sys-desc">${escapeHtml(descText)}</div>
        </div>
        <div class="cto-sys-actions">
          <button type="button" class="cto-sys-btn" data-act="left">${escapeHtml(leftText)}</button>
          <button type="button" class="cto-sys-btn" data-act="right">${escapeHtml(rightText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(mask);
    activeSysMaskEl = mask;
    const dialog = mask.querySelector('.cto-sys-dialog');
    const rightBtn = mask.querySelector('[data-act="right"]');
    mask.querySelectorAll('.cto-sys-btn').forEach(bindPressed);

    requestAnimationFrame(() => mask.classList.add('open'));

    function closeSelf(cb) {
      mask.classList.remove('open');
      addTimer(() => {
        if (activeSysMaskEl === mask) {
          mask.remove();
          activeSysMaskEl = null;
        }
        if (typeof cb === 'function') cb();
      }, 170);
    }

    mask.addEventListener('click', (e) => {
      const btn = e.target.closest('.cto-sys-btn');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'left') {
        closeSelf(() => {
          if (typeof opts.onExit === 'function') opts.onExit();
        });
        return;
      }
      if (act === 'right') {
        if (typeof opts.onRelogin === 'function') {
          opts.onRelogin({
            btn: rightBtn,
            dialog,
            close: closeSelf
          });
        }
      }
    });
  }

  /* ---------------- 风格 P1：魔怔眩晕密字墙 ---------------- */
  function mountStyleP1(container, pack) {
    const wrap = document.createElement('div');
    wrap.className = 'cto-p1-wrap';
    const phrase = pack.phrase || '你只能是我的';
    const lineText = Array(8).fill(phrase).join(' ');
    const rows = 28;

    for (let i = 0; i < rows; i++) {
      const row = document.createElement('div');
      row.className = 'cto-p1-row';
      row.textContent = lineText;
      row.dataset.txt = lineText;
      row.style.setProperty('--cto-x', `${Math.round((Math.random() - 0.5) * 46)}px`);
      row.style.setProperty('--cto-dx', `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 5) * 2)}px`);
      row.style.setProperty('--cto-sk', `${i % 2 === 0 ? -2.4 : 2.4}deg`);
      row.style.setProperty('--cto-d', `${-(i * 0.14).toFixed(2)}s`);
      wrap.appendChild(row);
    }

    container.appendChild(wrap);
    return {
      intensify() {
        wrap.classList.add('is-intense');
      }
    };
  }

  /* ---------------- 风格 P2：红字叠红字 · 层层淹没 ---------------- */
  function mountStyleP2(container, pack) {
    const wrap = document.createElement('div');
    wrap.className = 'cto-p2-wrap';
    container.appendChild(wrap);

    function spawnOne(text, level, delayMs) {
      const el = document.createElement('div');
      el.className = `cto-p2-item ${level} ${Math.random() > 0.35 ? 'is-sway' : ''}`;
      el.textContent = text;
      const x = 10 + Math.random() * 80;
      const y = 8 + Math.random() * 82;
      el.style.left = x.toFixed(1) + '%';
      el.style.top = y.toFixed(1) + '%';
      el.style.setProperty('--cto-op', level === 'lv-bg' ? '0.68' : (level === 'lv-mid' ? '0.88' : '0.96'));
      el.style.setProperty('--cto-dx', `${((Math.random() - 0.5) * 8).toFixed(1)}px`);
      el.style.setProperty('--cto-dy', `${((Math.random() - 0.5) * 6).toFixed(1)}px`);
      el.style.setProperty('--cto-d', `${-(Math.random() * 3).toFixed(2)}s`);
      wrap.appendChild(el);
      addTimer(() => el.classList.add('show'), delayMs);
    }

    function spawnBurst(count, baseDelay) {
      const bg = pack.bgPhrases || [];
      const mid = pack.midPhrases || [];
      const top = pack.topPhrases || [];
      const huge = pack.hugeWords || [];

      for (let i = 0; i < count; i++) {
        const r = Math.random();
        let level = 'lv-bg';
        let pool = bg;
        if (r > 0.86 && huge.length) { level = 'lv-huge'; pool = huge; }
        else if (r > 0.64 && top.length) { level = 'lv-top'; pool = top; }
        else if (r > 0.32 && mid.length) { level = 'lv-mid'; pool = mid; }
        const text = pool[Math.floor(Math.random() * pool.length)] || '看着我';
        spawnOne(text, level, baseDelay + i * 55);
      }
    }

    spawnBurst(28, 80);

    return {
      intensify() {
        spawnBurst(10, 20);
      }
    };
  }

  /* ---------------- 风格 P3：阴湿宋体艺术排版 ---------------- */
  function mountStyleP3(container, pack) {
    const wrap = document.createElement('div');
    wrap.className = 'cto-p3-wrap';
    const box = document.createElement('div');
    box.className = 'cto-p3-box';

    const whispers = Array.isArray(pack.whispers) ? pack.whispers : [];
    whispers.forEach((w, idx) => {
      const v = document.createElement('div');
      v.className = `cto-p3-vcol ${w.pos || 'pos-left'}`;
      v.textContent = w.text || '';
      box.appendChild(v);
      addTimer(() => v.classList.add('show'), 260 + idx * 180);
    });

    const lines = Array.isArray(pack.lines) ? pack.lines : [];
    lines.forEach((item, idx) => {
      const ln = document.createElement('div');
      ln.className = 'cto-p3-line' + (item.big ? ' is-big' : '') + (item.sub ? ' is-sub' : '');
      ln.style.setProperty('--cto-tx', `${typeof item.offset === 'number' ? item.offset : 0}px`);
      ln.innerHTML = item.kw
        ? `${escapeHtml(item.text || '')}<span class="cto-p3-kw">${escapeHtml(item.kw)}</span>${escapeHtml(item.after || '')}`
        : escapeHtml(item.text || '');
      box.appendChild(ln);
      addTimer(() => ln.classList.add('show'), 140 + idx * 240);
    });

    wrap.appendChild(box);
    container.appendChild(wrap);

    let extraIdx = 0;
    return {
      intensify() {
        const extras = pack.extraWhispers || [];
        if (!extras.length) return;
        const txt = extras[extraIdx % extras.length];
        extraIdx++;
        const v = document.createElement('div');
        v.className = 'cto-p3-vcol';
        v.style.left = `${14 + Math.random() * 68}%`;
        v.style.top = `${10 + Math.random() * 55}%`;
        v.style.color = 'rgba(200, 14, 28, 0.62)';
        v.textContent = txt;
        box.appendChild(v);
        requestAnimationFrame(() => v.classList.add('show'));
      }
    };
  }

  /* ---------------- 全屏舞台 + 纯手势与暗黑系统弹窗对抗 ---------------- */
  function launchFullscreenStage(opts) {
    const styleId = (opts.style && DEMO_PACKS[opts.style]) ? opts.style : 'p1';
    const pack = Object.assign({}, DEMO_PACKS[styleId], opts.customPack || {});
    const isPreview = Boolean(opts.isPreview);

    const stage = document.createElement('div');
    stage.className = 'cto-stage';
    stage.innerHTML = `
      <div class="cto-visual-slot" id="ctoVisualSlot" style="position:absolute;inset:0;"></div>
      <div class="cto-flash" id="ctoFlash"></div>
      ${isPreview ? `<button type="button" class="cto-preview-x" id="ctoPreviewClose" aria-label="退出预览">×</button>` : ''}
      <div class="cto-home-area">
        <div class="cto-subtle-tip" id="ctoSubtleTip">上滑或轻点屏幕</div>
        <div class="cto-home-bar"></div>
      </div>
    `;

    document.body.appendChild(stage);
    activeStageEl = stage;

    const visualSlot = stage.querySelector('#ctoVisualSlot');
    const flashEl = stage.querySelector('#ctoFlash');
    const tipEl = stage.querySelector('#ctoSubtleTip');
    const previewClose = stage.querySelector('#ctoPreviewClose');

    let visualCtrl = null;
    if (styleId === 'p1') visualCtrl = mountStyleP1(visualSlot, pack);
    else if (styleId === 'p2') visualCtrl = mountStyleP2(visualSlot, pack);
    else visualCtrl = mountStyleP3(visualSlot, pack);

    if (previewClose) {
      bindPressed(previewClose);
      previewClose.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissStage('cancelled');
      });
    }

    let struggleCount = 0;
    const NEED_STRUGGLES = 3;
    let settled = false;
    let alertOpen = false;

    function pulseRedShake() {
      vibrate([25, 25, 30]);
      stage.classList.remove('is-snapped');
      void stage.offsetWidth;
      stage.classList.add('is-snapped');
      flashEl.classList.add('is-red');
      addTimer(() => flashEl.classList.remove('is-red'), 150);
      addTimer(() => stage.classList.remove('is-snapped'), 340);
      if (visualCtrl && typeof visualCtrl.intensify === 'function') {
        visualCtrl.intensify();
      }
    }

    function dismissStage(outcome) {
      if (settled) return;
      settled = true;
      stage.classList.add('is-dismissing');
      addTimer(() => {
        cleanupAll();
        if (typeof opts.onComplete === 'function') {
          opts.onComplete({ outcome, style: styleId });
        }
      }, 300);
    }

    function openDarkClashModal() {
      if (settled || alertOpen) return;
      alertOpen = true;
      tipEl.classList.add('is-hidden');

      showSystemAlert({
        dark: true,
        title: struggleCount === 0 ? '登录态冲突' : '重新登录失败',
        desc: struggleCount === 0
          ? '当前账号仍在另一台设备保持在线。'
          : '对方正在阻止本次设备接管，是否继续强行登录？',
        leftText: '退出',
        rightText: '重新登录',
        deviceText: pack.deviceText,
        onExit: () => {
          alertOpen = false;
          // 主动放弃 -> 真正被对方接管定格
          pulseRedShake();
          tipEl.textContent = '已由对方接管';
          tipEl.classList.remove('is-hidden');
        },
        onRelogin: ({ btn, dialog, close }) => {
          struggleCount++;
          if (struggleCount < NEED_STRUGGLES) {
            vibrate([30, 20, 40]);
            const hijackList = pack.hijackTexts || ['别点', '留下来'];
            const word = hijackList[(struggleCount - 1) % hijackList.length];
            btn.classList.add('is-hijacked');
            btn.textContent = word;
            dialog.classList.remove('is-shake');
            void dialog.offsetWidth;
            dialog.classList.add('is-shake');

            addTimer(() => {
              close(() => {
                alertOpen = false;
                pulseRedShake();
              });
            }, 620);
          } else {
            btn.textContent = '登录中…';
            btn.disabled = true;
            vibrate([20, 35, 25]);
            addTimer(() => {
              close(() => {
                alertOpen = false;
                dismissStage('reclaimed');
              });
            }, 340);
          }
        }
      });
    }

    /* 纯手势：本能上滑挣脱 / 轻点唤出系统弹窗 */
    let touchStartY = 0;
    let touchStartX = 0;
    let touchMoved = false;
    let lastDeltaY = 0;

    stage.addEventListener('touchstart', (e) => {
      if (settled || alertOpen) return;
      if (e.target.closest('#ctoPreviewClose')) return;
      const t = e.touches[0];
      touchStartY = t.clientY;
      touchStartX = t.clientX;
      touchMoved = false;
      lastDeltaY = 0;
      stage.classList.add('is-dragging');
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (settled || alertOpen) return;
      const t = e.touches[0];
      const dy = t.clientY - touchStartY;
      const dx = Math.abs(t.clientX - touchStartX);
      if (Math.abs(dy) > 8 || dx > 8) touchMoved = true;

      if (dy < 0) {
        // 阻尼感：上滑越高阻力越大
        const resisted = Math.max(-220, dy * 0.62);
        lastDeltaY = dy;
        stage.style.transform = `translate3d(0, ${resisted.toFixed(1)}px, 0)`;
      }
    }, { passive: true });

    stage.addEventListener('touchend', () => {
      if (settled || alertOpen) return;
      stage.classList.remove('is-dragging');
      stage.style.transform = '';

      if (!touchMoved) {
        openDarkClashModal();
        return;
      }

      if (lastDeltaY < -68) {
        struggleCount++;
        if (struggleCount >= NEED_STRUGGLES) {
          vibrate([20, 35, 30]);
          dismissStage('reclaimed');
        } else {
          pulseRedShake();
          if (struggleCount === 2) {
            addTimer(() => openDarkClashModal(), 260);
          }
        }
      }
    }, { passive: true });

    stage.addEventListener('touchcancel', () => {
      stage.classList.remove('is-dragging');
      stage.style.transform = '';
    }, { passive: true });

    // 桌面端点击调试兼容
    stage.addEventListener('click', (e) => {
      if (settled || alertOpen) return;
      if (e.target.closest('#ctoPreviewClose')) return;
      if ('ontouchstart' in window) return;
      openDarkClashModal();
    });

    requestAnimationFrame(() => {
      stage.classList.add('open');
      vibrate([25, 30, 25]);
      addTimer(() => tipEl.classList.add('is-hidden'), 3600);
    });
  }

  /* ---------------- 对外统一入口 ---------------- */
  function triggerTakeover(options) {
    const opts = Object.assign({
      style: 'p1',
      isPreview: false,
      skipSystemModal: false,
      deviceText: '另一台设备'
    }, options || {});

    if (opts.skipSystemModal) {
      launchFullscreenStage(opts);
    } else {
      showSystemAlert({
        dark: false,
        title: '下线通知',
        deviceText: opts.deviceText,
        onExit: () => {
          if (typeof opts.onComplete === 'function') opts.onComplete({ outcome: 'cancelled' });
        },
        onRelogin: ({ btn, close }) => {
          btn.textContent = '登录中…';
          btn.disabled = true;
          vibrate(18);
          addTimer(() => {
            close(() => launchFullscreenStage(opts));
          }, 300);
        }
      });
    }
  }

  function previewTakeover(style) {
    const raw = style || localStorage.getItem(STYLE_STORAGE_KEY) || 'p1';
    const normalized = DEMO_PACKS[raw] ? raw : 'p1';
    triggerTakeover({
      style: normalized,
      isPreview: true,
      deviceText: DEMO_PACKS[normalized].deviceText
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

    const rawSaved = localStorage.getItem(STYLE_STORAGE_KEY) || 'p1';
    const savedStyle = DEMO_PACKS[rawSaved] ? rawSaved : 'p1';
    const card = document.createElement('div');
    card.id = 'ctoAppearancePreviewCard';
    card.className = 'cto-ap-card';
    card.innerHTML = `
      <div class="cto-ap-head">
        <div class="cto-ap-title">顶号全屏效果预览</div>
        <div class="cto-ap-sub">进全屏后可上滑挣脱，或轻点屏幕唤出系统弹窗硬顶</div>
      </div>
      <div class="cto-ap-row">
        <span class="cto-ap-label">视觉风格</span>
        <select class="cto-ap-select" id="ctoPreviewMoodSelect" aria-label="选择顶号视觉风格">
          <option value="p1" ${savedStyle === 'p1' ? 'selected' : ''}>P1 · 魔怔眩晕密字</option>
          <option value="p2" ${savedStyle === 'p2' ? 'selected' : ''}>P2 · 红字叠满屏</option>
          <option value="p3" ${savedStyle === 'p3' ? 'selected' : ''}>P3 · 阴湿宋体排版</option>
        </select>
      </div>
      <button type="button" class="cto-ap-btn" id="ctoLaunchPreviewBtn">预览顶号效果</button>
    `;

    container.appendChild(card);

    const selectEl = card.querySelector('#ctoPreviewMoodSelect');
    const btnEl = card.querySelector('#ctoLaunchPreviewBtn');
    bindPressed(btnEl);

    selectEl.addEventListener('change', () => {
      try { localStorage.setItem(STYLE_STORAGE_KEY, selectEl.value); } catch (e) {}
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
