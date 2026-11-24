/* =========================================================
   反向互动 · 顶号实时抢夺模块 (reverse/takeover.js)
   - 暴露 window.PhoneChatTakeover（preview / trigger / close）
   - 实时拔河抢夺（点按钮 / 戳碎红字墙 / 对方实时反扑与劫持按钮）
   - 双结局：硬抢夺回 / 抢输或放弃被接管（纯黑宋体 + 竖排低语 + 猩红关键字）
   - 当前为外观页演示预览，正式接入 AI 后由 AI 按 Char 人设与当下动态关系生成文本
   ========================================================= */

(function () {
  const MOOD_STORAGE_KEY = 'phone_takeover_preview_mood_v1';

  const DEMO_PACKS = {
    crimson: {
      deviceText: '另一台设备',
      wallPhrases: [
        '你只能是我的',
        '别急着把我顶下去',
        '你在看谁的聊天记录',
        '不准退出来',
        '看着我',
        '我话还没说完'
      ],
      hijackTexts: ['不准退', '留下来', '别点了'],
      typo: {
        lines: [
          { text: '把号顶回去之前，', offset: -14 },
          { text: '先看着', kw: '我', after: '。', big: true, offset: 12 },
          { text: '你刚才到底在', kw: '躲', after: '什么？', sub: true, offset: -6 }
        ],
        whispers: ['别把门关上', '我都看见了', '再跑一次试试']
      },
      winTypo: {
        lines: [
          { text: '已切断对方连接。', offset: 0 },
          { text: '下一次，不会这么轻易松手。', sub: true, offset: 0 }
        ],
        whispers: ['强制下线完成', '已重新接管']
      }
    },
    obsidian: {
      deviceText: '未知设备',
      wallPhrases: [
        '这么急着把我踢出去吗',
        '怕我看到什么',
        '先别关',
        '我在看你',
        '手在抖什么'
      ],
      hijackTexts: ['别躲', '再留一会儿', '看着屏幕'],
      typo: {
        lines: [
          { text: '说', kw: '不在意', after: '的时候，', offset: -10 },
          { text: '你自己信吗？', big: true, offset: 14 },
          { text: '账号我先替你', kw: '收着', after: '了。', sub: true, offset: -4 }
        ],
        whispers: ['何必这么紧张', '只是看一眼而已', '你逃不掉的']
      },
      winTypo: {
        lines: [
          { text: '对方已被顶下线。', offset: 0 },
          { text: '刚才的痕迹，已经留在这里了。', sub: true, offset: 0 }
        ],
        whispers: ['会话已收回', '当前设备在线']
      }
    },
    scarlet: {
      deviceText: '另一台移动设备',
      wallPhrases: [
        '别踢我',
        '为什么不回我消息',
        '听我说完行不行',
        '我不退',
        '看着我啊'
      ],
      hijackTexts: ['不许踢我', '别走', '回我一句'],
      typo: {
        lines: [
          { text: '每次都是这样，', offset: -12 },
          { text: '一句话不说就想', kw: '逃', after: '。', big: true, offset: 10 },
          { text: '这一次，', kw: '不准', after: '走。', sub: true, offset: -8 }
        ],
        whispers: ['你到底在哪', '别把我丢在外面', '求你别关掉']
      },
      winTypo: {
        lines: [
          { text: '你把对方顶下线了。', offset: 0 },
          { text: '聊天框里，对方正在重新输入。', sub: true, offset: 0 }
        ],
        whispers: ['连接已强行断开', '设备已恢复']
      }
    }
  };

  let activeTimers = [];
  let tugInterval = null;
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

  function clearAllLoops() {
    activeTimers.forEach(id => clearTimeout(id));
    activeTimers = [];
    if (tugInterval) {
      clearInterval(tugInterval);
      tugInterval = null;
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function cleanupAll() {
    clearAllLoops();
    if (activeSysMaskEl) {
      activeSysMaskEl.remove();
      activeSysMaskEl = null;
    }
    if (activeStageEl) {
      activeStageEl.remove();
      activeStageEl = null;
    }
  }

  /* ---------------- 阶段 0：仿系统下线弹窗 ---------------- */
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
      if (btn.dataset.act === 'exit') {
        mask.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof onCancel === 'function') onCancel();
        }, 200);
        return;
      }
      if (btn.dataset.act === 'relogin') {
        btn.textContent = '登录中…';
        btn.disabled = true;
        vibrate(18);
        addTimer(() => {
          mask.classList.remove('open');
          addTimer(() => {
            if (activeSysMaskEl) {
              activeSysMaskEl.remove();
              activeSysMaskEl = null;
            }
            if (typeof onRelogin === 'function') onRelogin();
          }, 150);
        }, 300);
      }
    });
  }

  /* ---------------- 构建阴湿宋体错落排版 HTML ---------------- */
  function buildTypoHtml(typoData) {
    const lines = (typoData && Array.isArray(typoData.lines)) ? typoData.lines : [];
    const whispers = (typoData && Array.isArray(typoData.whispers)) ? typoData.whispers : [];

    const vColsHtml = [
      whispers[0] ? `<div class="cto-vcol left">${escapeHtml(whispers[0])}</div>` : '',
      whispers[1] ? `<div class="cto-vcol right">${escapeHtml(whispers[1])}</div>` : '',
      whispers[2] ? `<div class="cto-vcol mid">${escapeHtml(whispers[2])}</div>` : ''
    ].join('');

    const linesHtml = lines.map((item) => {
      const cls = ['cto-tline'];
      if (item.big) cls.push('is-big');
      if (item.sub) cls.push('is-sub');
      const tx = typeof item.offset === 'number' ? item.offset : 0;
      const body = item.kw
        ? `${escapeHtml(item.text || '')}<span class="cto-kw">${escapeHtml(item.kw)}</span>${escapeHtml(item.after || '')}`
        : escapeHtml(item.text || '');
      return `<div class="${cls.join(' ')}" style="--cto-tx:${tx}px;">${body}</div>`;
    }).join('');

    return `<div class="cto-typo-box">${vColsHtml}${linesHtml}</div>`;
  }

  /* ---------------- 阶段 1：实时抢夺全屏舞台 ---------------- */
  function launchRealtimeStage(opts) {
    const mood = opts.mood || 'crimson';
    const pack = DEMO_PACKS[mood] || DEMO_PACKS.crimson;
    const isPreview = Boolean(opts.isPreview);
    const wallPhrases = (Array.isArray(opts.wallPhrases) && opts.wallPhrases.length) ? opts.wallPhrases : pack.wallPhrases;
    const hijackTexts = (Array.isArray(opts.hijackTexts) && opts.hijackTexts.length) ? opts.hijackTexts : pack.hijackTexts;
    const loseTypo = opts.typo || pack.typo;
    const winTypo = opts.winTypo || pack.winTypo;

    const stage = document.createElement('div');
    stage.className = `cto-stage mood-${mood}`;
    stage.innerHTML = `
      <div class="cto-tug-track"><div class="cto-tug-enemy" id="ctoTugEnemy"></div></div>
      ${isPreview ? `<button type="button" class="cto-preview-x" id="ctoPreviewClose" aria-label="退出预览">×</button>` : ''}
      <div class="cto-flash" id="ctoFlash"></div>
      <div class="cto-wall" id="ctoWall"></div>
      <div class="cto-typo" id="ctoTypo"></div>
      <div class="cto-bottom" id="ctoBottom">
        <div class="cto-whisper" id="ctoWhisper">连点「夺回」或直接戳碎红字</div>
        <button type="button" class="cto-fight-btn" id="ctoFightBtn">夺 回 账 号</button>
        <button type="button" class="cto-yield-btn" id="ctoYieldBtn">算了，不抢了</button>
        <div class="cto-end-actions" id="ctoEndActions">
          <button type="button" class="cto-end-btn" id="ctoEndCloseBtn">返回</button>
        </div>
      </div>
    `;

    document.body.appendChild(stage);
    activeStageEl = stage;

    const tugEnemyEl = stage.querySelector('#ctoTugEnemy');
    const flashEl = stage.querySelector('#ctoFlash');
    const wallEl = stage.querySelector('#ctoWall');
    const typoEl = stage.querySelector('#ctoTypo');
    const whisperEl = stage.querySelector('#ctoWhisper');
    const fightBtn = stage.querySelector('#ctoFightBtn');
    const yieldBtn = stage.querySelector('#ctoYieldBtn');
    const endActions = stage.querySelector('#ctoEndActions');
    const endCloseBtn = stage.querySelector('#ctoEndCloseBtn');
    const previewCloseBtn = stage.querySelector('#ctoPreviewClose');

    bindPressed(fightBtn);
    bindPressed(yieldBtn);
    bindPressed(endCloseBtn);
    if (previewCloseBtn) bindPressed(previewCloseBtn);

    /* 构建铺满屏幕的密字墙行（约 22 行，铺满整屏无留白） */
    const TOTAL_ROWS = 22;
    const rowEls = [];
    for (let i = 0; i < TOTAL_ROWS; i++) {
      const row = document.createElement('div');
      row.className = 'cto-wall-row';
      const phrase = wallPhrases[i % wallPhrases.length];
      const sep = ' ';
      row.textContent = Array(7).fill(phrase).join(sep);
      const shift = Math.round((Math.random() - 0.5) * 44);
      row.style.setProperty('--cto-shift', shift + 'px');
      wallEl.appendChild(row);
      rowEls.push(row);
    }

    let userControl = 36; // 0 = 对方完全接管, 100 = 你彻底抢回
    let ended = false;
    let hijacked = false;
    let hijackUsed = false;
    let flashTypoShown = false;

    function triggerShake(flashType) {
      stage.classList.remove('is-shaking');
      void stage.offsetWidth;
      stage.classList.add('is-shaking');
      if (flashType) {
        flashEl.classList.remove('is-red', 'is-white');
        flashEl.classList.add(flashType === 'white' ? 'is-white' : 'is-red');
        addTimer(() => flashEl.classList.remove('is-red', 'is-white'), 150);
      }
      addTimer(() => stage.classList.remove('is-shaking'), 300);
    }

    function syncVisualByControl() {
      const enemyPct = Math.max(0, Math.min(100, 100 - userControl));
      tugEnemyEl.style.width = enemyPct.toFixed(1) + '%';

      const visibleCount = Math.round((enemyPct / 100) * TOTAL_ROWS);
      rowEls.forEach((row, idx) => {
        if (idx < visibleCount) {
          row.classList.remove('is-cracked');
          row.classList.add('show');
          row.classList.toggle('is-dim', idx % 3 === 2 && userControl > 45);
        } else {
          row.classList.add('is-cracked');
        }
      });
    }

    function showTypoSequence(typoData) {
      typoEl.innerHTML = buildTypoHtml(typoData);
      requestAnimationFrame(() => {
        typoEl.classList.add('show');
        const lines = typoEl.querySelectorAll('.cto-tline');
        lines.forEach((ln, i) => {
          addTimer(() => ln.classList.add('show'), 140 + i * 240);
        });
      });
    }

    function finishFight(outcome) {
      if (ended) return;
      ended = true;
      clearAllLoops();
      stage.classList.add('is-ended');
      fightBtn.style.display = 'none';
      yieldBtn.style.display = 'none';
      fightBtn.style.transform = '';

      if (outcome === 'reclaimed') {
        vibrate([20, 30, 45]);
        triggerShake('white');
        whisperEl.classList.remove('is-danger');
        whisperEl.textContent = '已重新夺回当前设备';
        showTypoSequence(winTypo);
      } else {
        vibrate([45, 35, 65]);
        triggerShake('red');
        whisperEl.classList.add('is-danger');
        whisperEl.textContent = '账号已被对方接管';
        showTypoSequence(loseTypo);
      }

      addTimer(() => {
        endActions.classList.add('show');
      }, 650);

      endCloseBtn.onclick = () => {
        stage.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof opts.onComplete === 'function') {
            opts.onComplete({ outcome, mood });
          }
        }, 220);
      };
    }

    function triggerHijackSabotage() {
      if (hijackUsed || ended) return;
      hijackUsed = true;
      hijacked = true;
      vibrate([30, 25, 35]);
      triggerShake('red');
      userControl = Math.max(24, userControl - 20);
      syncVisualByControl();

      const word = hijackTexts[Math.floor(Math.random() * hijackTexts.length)] || '不准退';
      fightBtn.classList.add('is-hijacked');
      fightBtn.textContent = word;
      const dodgeX = (Math.random() > 0.5 ? 1 : -1) * 18;
      fightBtn.style.transform = `translateX(${dodgeX}px)`;
      whisperEl.classList.add('is-danger');
      whisperEl.textContent = '对方拦住了你的操作';

      addTimer(() => {
        if (ended) return;
        hijacked = false;
        fightBtn.classList.remove('is-hijacked');
        fightBtn.textContent = '夺 回 账 号';
        fightBtn.style.transform = '';
        whisperEl.classList.remove('is-danger');
        whisperEl.textContent = '继续顶回去！';
      }, 1050);
    }

    function pulseFlashTypo() {
      if (flashTypoShown || ended) return;
      flashTypoShown = true;
      stage.classList.add('is-typo-focus');
      showTypoSequence(loseTypo);
      addTimer(() => {
        if (ended) return;
        typoEl.classList.remove('show');
        stage.classList.remove('is-typo-focus');
      }, 1350);
    }

    /* 交互 1：戳碎红字墙任意一行 */
    rowEls.forEach((row) => {
      row.addEventListener('click', () => {
        if (ended || row.classList.contains('is-cracked')) return;
        row.classList.add('is-cracked');
        vibrate(12);
        userControl = Math.min(100, userControl + 5.5);
        syncVisualByControl();
        if (userControl >= 100) finishFight('reclaimed');
      });
    });

    /* 交互 2：连点「夺回账号」按钮 */
    fightBtn.addEventListener('click', () => {
      if (ended) return;
      if (hijacked) {
        triggerShake('red');
        vibrate(25);
        userControl = Math.max(10, userControl - 4);
        syncVisualByControl();
        return;
      }

      vibrate(14);
      userControl = Math.min(100, userControl + 8.5);
      syncVisualByControl();

      const randRow = rowEls[Math.floor(Math.random() * rowEls.length)];
      if (randRow && !randRow.classList.contains('is-cracked')) {
        randRow.classList.add('is-glitch');
        addTimer(() => randRow.classList.remove('is-glitch'), 140);
      }

      if (userControl >= 68 && !hijackUsed) {
        triggerHijackSabotage();
        return;
      }

      if (userControl >= 100) {
        finishFight('reclaimed');
      }
    });

    /* 交互 3：主动放弃 -> 进入对方接管结局 */
    yieldBtn.addEventListener('click', () => {
      if (ended) return;
      userControl = 0;
      syncVisualByControl();
      finishFight('taken');
    });

    if (previewCloseBtn) {
      previewCloseBtn.addEventListener('click', () => {
        stage.classList.remove('open');
        addTimer(() => {
          cleanupAll();
          if (typeof opts.onComplete === 'function') opts.onComplete({ cancelled: true });
        }, 200);
      });
    }

    /* 入场：密字墙快速瀑布式铺满 + 启动实时反扑循环 */
    requestAnimationFrame(() => {
      stage.classList.add('open');
      triggerShake('red');

      rowEls.forEach((row, idx) => {
        addTimer(() => {
          if (ended) return;
          row.classList.add('show');
          if (idx % 4 === 0) vibrate(10);
        }, idx * 36);
      });

      addTimer(() => {
        if (ended) return;
        syncVisualByControl();

        tugInterval = setInterval(() => {
          if (ended) return;
          const pull = mood === 'scarlet' ? (3.2 + Math.random() * 2.8) : (2.4 + Math.random() * 2.4);
          userControl = Math.max(0, userControl - pull);
          syncVisualByControl();

          const activeRows = rowEls.filter(r => !r.classList.contains('is-cracked'));
          if (activeRows.length) {
            const pick = activeRows[Math.floor(Math.random() * activeRows.length)];
            pick.classList.add('is-glitch');
            addTimer(() => pick.classList.remove('is-glitch'), 130);
          }

          if (userControl <= 22 && !flashTypoShown) {
            pulseFlashTypo();
          }

          if (userControl <= 0) {
            finishFight('taken');
          }
        }, 320);
      }, 680);
    });
  }

  /* ---------------- 对外统一入口 ---------------- */
  function triggerTakeover(options) {
    const opts = Object.assign({
      mood: 'crimson',
      isPreview: false,
      skipSystemModal: false,
      deviceText: '另一台设备'
    }, options || {});

    if (opts.skipSystemModal) {
      launchRealtimeStage(opts);
    } else {
      showSystemKickModal(
        opts,
        () => launchRealtimeStage(opts),
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
      wallPhrases: pack.wallPhrases,
      hijackTexts: pack.hijackTexts,
      typo: pack.typo,
      winTypo: pack.winTypo
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

    const savedMood = localStorage.getItem(MOOD_STORAGE_KEY) || 'crimson';
    const card = document.createElement('div');
    card.id = 'ctoAppearancePreviewCard';
    card.className = 'cto-ap-card';
    card.innerHTML = `
      <div class="cto-ap-head">
        <div class="cto-ap-title">顶号实时抢夺预览</div>
        <div class="cto-ap-sub">演示模式 · 可硬抢夺回，也可停手/放弃看被接管结局</div>
      </div>
      <div class="cto-ap-row">
        <span class="cto-ap-label">预览氛围</span>
        <select class="cto-ap-select" id="ctoPreviewMoodSelect" aria-label="选择顶号预览氛围">
          <option value="crimson" ${savedMood === 'crimson' ? 'selected' : ''}>黑红密字</option>
          <option value="obsidian" ${savedMood === 'obsidian' ? 'selected' : ''}>纯黑冷白</option>
          <option value="scarlet" ${savedMood === 'scarlet' ? 'selected' : ''}>暗红失控</option>
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
