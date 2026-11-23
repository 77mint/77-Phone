/* splash.js — 77 Phone 纯白丘比特射箭开屏动画 */
(function () {
  'use strict';

  var STORAGE_KEY = 'phone_splash_enabled';
  var ANGEL_SRC = 'icons/12F8689E-B660-4FB2-870D-B8E7F5869F2C.png';
  var LOGO_SRC = 'icons/56DEC4D0-9D53-4498-BC8A-BB30BFB4FF6A.png';

  // 与素材一致的低饱和雾感蓝紫 / 冰蓝调色盘
  var PALETTE = ['#8b9fd9', '#9cb3ea', '#b5c7f4', '#ccd9fa', '#c3ccf5', '#dce5fc'];

  var activeCleanup = null;

  function isEnabled() {
    try {
      var val = localStorage.getItem(STORAGE_KEY);
      return val !== '0' && val !== 'false';
    } catch (e) {
      return true;
    }
  }

  function setEnabled(flag) {
    try {
      localStorage.setItem(STORAGE_KEY, flag ? '1' : '0');
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('phoneSplashStyles')) return;
    var style = document.createElement('style');
    style.id = 'phoneSplashStyles';
    style.textContent = [
      '#phoneSplashOverlay {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 99999;',
      '  background: #ffffff;',
      '  isolation: isolate;',
      '  overflow: hidden;',
      '  touch-action: none;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '  -webkit-tap-highlight-color: transparent;',
      '  opacity: 1;',
      '  transform: scale(1);',
      '  transition: opacity 0.62s cubic-bezier(0.32, 0.72, 0, 1), transform 0.62s cubic-bezier(0.32, 0.72, 0, 1);',
      '}',
      '#phoneSplashOverlay.is-closing {',
      '  opacity: 0;',
      '  transform: scale(1.025);',
      '  pointer-events: none;',
      '}',
      '.ps-canvas {',
      '  position: absolute;',
      '  inset: 0;',
      '  width: 100%;',
      '  height: 100%;',
      '  display: block;',
      '  pointer-events: none;',
      '}',
      '.ps-stage {',
      '  position: absolute;',
      '  inset: 0;',
      '  pointer-events: none;',
      '}',
      '.ps-glow {',
      '  position: absolute;',
      '  left: 50%;',
      '  top: 52%;',
      '  width: min(84vw, 360px);',
      '  height: min(84vw, 360px);',
      '  transform: translate(-50%, -50%) scale(0.5);',
      '  border-radius: 50%;',
      '  background: radial-gradient(circle, rgba(181, 199, 244, 0.34) 0%, rgba(204, 217, 250, 0.14) 45%, rgba(255, 255, 255, 0) 72%);',
      '  opacity: 0;',
      '  transition: opacity 0.7s cubic-bezier(0.32, 0.72, 0, 1), transform 0.85s cubic-bezier(0.34, 1.32, 0.64, 1);',
      '}',
      '.ps-glow.is-visible {',
      '  opacity: 1;',
      '  transform: translate(-50%, -50%) scale(1.05);',
      '}',
      '.ps-logo-wrap {',
      '  position: absolute;',
      '  left: 50%;',
      '  top: 55%;',
      '  width: min(78vw, 326px);',
      '  transform: translate(-50%, -50%) scale(0.68);',
      '  opacity: 0;',
      '  will-change: transform, opacity;',
      '  transition: opacity 0.68s cubic-bezier(0.32, 0.72, 0, 1), transform 0.78s cubic-bezier(0.34, 1.42, 0.64, 1);',
      '}',
      '.ps-logo-wrap.is-visible {',
      '  opacity: 1;',
      '  transform: translate(-50%, -50%) scale(1);',
      '}',
      '.ps-logo-img {',
      '  width: 100%;',
      '  height: auto;',
      '  display: block;',
      '  mix-blend-mode: multiply;',
      '  filter: brightness(1.02) contrast(1.03);',
      '  pointer-events: none;',
      '  -webkit-user-drag: none;',
      '}',
      '.ps-angel-wrap {',
      '  position: absolute;',
      '  left: 50%;',
      '  top: 50%;',
      '  width: min(45vw, 192px);',
      '  opacity: 0;',
      '  will-change: transform, opacity;',
      '  pointer-events: none;',
      '}',
      '.ps-angel-img {',
      '  width: 100%;',
      '  height: auto;',
      '  display: block;',
      '  mix-blend-mode: multiply;',
      '  filter: brightness(1.02) contrast(1.03);',
      '  pointer-events: none;',
      '  -webkit-user-drag: none;',
      '}',
      '.ps-skip-btn {',
      '  position: absolute;',
      '  top: calc(env(safe-area-inset-top, 12px) + 12px);',
      '  right: 16px;',
      '  z-index: 3;',
      '  padding: 6px 14px;',
      '  border-radius: 999px;',
      '  border: 1px solid rgba(156, 179, 234, 0.36);',
      '  background: rgba(255, 255, 255, 0.82);',
      '  color: #8b9fd9;',
      '  font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif);',
      '  font-size: calc(var(--app-font-size, 15px) * 0.87);',
      '  font-weight: 500;',
      '  letter-spacing: 0.04em;',
      '  line-height: 1.2;',
      '  cursor: pointer;',
      '  outline: none;',
      '  transform: scale(1);',
      '  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), background-color 0.2s ease, opacity 0.2s ease;',
      '}',
      '.ps-skip-btn.is-pressed {',
      '  transform: scale(0.91);',
      '  background: rgba(220, 229, 252, 0.55);',
      '  opacity: 0.82;',
      '}',
      '.ps-tap-hint {',
      '  position: absolute;',
      '  left: 50%;',
      '  bottom: calc(env(safe-area-inset-bottom, 16px) + 26px);',
      '  transform: translateX(-50%) translateY(6px);',
      '  color: rgba(139, 159, 217, 0.72);',
      '  font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif);',
      '  font-size: calc(var(--app-font-size, 15px) * 0.8);',
      '  letter-spacing: 0.1em;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.32, 0.72, 0, 1);',
      '}',
      '.ps-tap-hint.is-visible {',
      '  opacity: 1;',
      '  transform: translateX(-50%) translateY(0);',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function preloadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve();
      }
      img.onload = finish;
      img.onerror = finish;
      img.src = src;
      setTimeout(finish, 480);
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutBack(t) {
    var c1 = 1.45;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pickColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }

  // 像素图形绘制工具
  var HEART_MAP = [
    '0110110',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
    '0001000'
  ];

  function drawPixelHeart(ctx, x, y, pixelSize, color, alpha, highlight) {
    ctx.save();
    ctx.globalAlpha = alpha;
    var w = HEART_MAP[0].length * pixelSize;
    var h = HEART_MAP.length * pixelSize;
    var ox = Math.round(x - w / 2);
    var oy = Math.round(y - h / 2);
    ctx.fillStyle = color;
    for (var r = 0; r < HEART_MAP.length; r++) {
      var row = HEART_MAP[r];
      for (var c = 0; c < row.length; c++) {
        if (row[c] === '1') {
          ctx.fillRect(ox + c * pixelSize, oy + r * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    if (highlight) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.72;
      ctx.fillRect(ox + pixelSize, oy + pixelSize, pixelSize, pixelSize);
    }
    ctx.restore();
  }

  function drawPixelStar(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var s = Math.max(1.5, size);
    var cx = Math.round(x);
    var cy = Math.round(y);
    ctx.fillRect(cx - s / 2, cy - s * 2.2, s, s * 4.4);
    ctx.fillRect(cx - s * 2.2, cy - s / 2, s * 4.4, s);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
  }

  function drawPixelCross(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var s = Math.max(1.5, size);
    var cx = Math.round(x);
    var cy = Math.round(y);
    ctx.fillRect(cx - s / 2, cy - s * 2.2, s, s * 5.2);
    ctx.fillRect(cx - s * 1.9, cy - s * 0.9, s * 3.8, s);
    ctx.restore();
  }

  function drawPixelArrow(ctx, x, y, angle, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    var p = 2.6 * scale;

    // 箭尾淡蓝羽翼
    ctx.fillStyle = '#ccd9fa';
    ctx.fillRect(-10 * p, -2 * p, 3 * p, p);
    ctx.fillRect(-10 * p, 1 * p, 3 * p, p);
    ctx.fillStyle = '#b5c7f4';
    ctx.fillRect(-8 * p, -1 * p, 2 * p, 2 * p);

    // 纤细箭杆
    ctx.fillStyle = '#9cb3ea';
    ctx.fillRect(-7 * p, -0.5 * p, 14 * p, p);
    ctx.fillStyle = '#dce5fc';
    ctx.fillRect(-6 * p, -0.5 * p, 12 * p, 0.5 * p);

    // 像素爱心箭头
    ctx.fillStyle = '#8b9fd9';
    ctx.fillRect(6 * p, -2 * p, 2 * p, 4 * p);
    ctx.fillRect(8 * p, -1.5 * p, 1.5 * p, 3 * p);
    ctx.fillRect(9.5 * p, -0.5 * p, 1.5 * p, p);
    ctx.fillStyle = '#ccd9fa';
    ctx.fillRect(7 * p, -1 * p, p, p);

    ctx.restore();
  }

  function play() {
    if (activeCleanup) {
      activeCleanup(true);
    }

    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = 'phoneSplashOverlay';

    var canvas = document.createElement('canvas');
    canvas.className = 'ps-canvas';

    var stage = document.createElement('div');
    stage.className = 'ps-stage';

    var glow = document.createElement('div');
    glow.className = 'ps-glow';

    var logoWrap = document.createElement('div');
    logoWrap.className = 'ps-logo-wrap';
    var logoImg = document.createElement('img');
    logoImg.className = 'ps-logo-img';
    logoImg.src = LOGO_SRC;
    logoImg.alt = '77 Phone';
    logoWrap.appendChild(logoImg);

    var angelWrap = document.createElement('div');
    angelWrap.className = 'ps-angel-wrap';
    var angelImg = document.createElement('img');
    angelImg.className = 'ps-angel-img';
    angelImg.src = ANGEL_SRC;
    angelImg.alt = 'Cupid Angel';
    angelWrap.appendChild(angelImg);

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ps-skip-btn';
    skipBtn.textContent = '跳过';

    var tapHint = document.createElement('div');
    tapHint.className = 'ps-tap-hint';
    tapHint.textContent = '轻触进入';

    stage.appendChild(glow);
    stage.appendChild(logoWrap);
    stage.appendChild(angelWrap);

    overlay.appendChild(canvas);
    overlay.appendChild(stage);
    overlay.appendChild(skipBtn);
    overlay.appendChild(tapHint);

    document.body.appendChild(overlay);

    var ctx = canvas.getContext('2d');
    var W = window.innerWidth;
    var H = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    var particles = [];
    var rings = [];
    var rafId = 0;
    var closed = false;
    var hitTriggered = false;
    var startTime = 0;
    var lastTrailTime = 0;
    var lastAmbientTime = 0;
    var autoCloseTimer = 0;

    function spawnParticle(x, y, opts) {
      opts = opts || {};
      var kindPool = ['heart', 'star', 'star', 'cross', 'dot'];
      var kind = opts.kind || kindPool[Math.floor(Math.random() * kindPool.length)];
      var angle = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2;
      var speed = opts.speed !== undefined ? opts.speed : (0.5 + Math.random() * 2.2);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (opts.vyBias || 0),
        size: opts.size || (kind === 'heart' ? 2 + Math.random() * 1.4 : 1.6 + Math.random() * 1.5),
        kind: kind,
        color: opts.color || pickColor(),
        alpha: 1,
        life: 0,
        maxLife: opts.maxLife || (580 + Math.random() * 520),
        drag: opts.drag || 0.968,
        gravity: opts.gravity !== undefined ? opts.gravity : 0.015
      });
    }

    function spawnBurst(x, y, count, power) {
      for (var i = 0; i < count; i++) {
        var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
        var speed = (1.2 + Math.random() * 3.4) * (power || 1);
        spawnParticle(x, y, {
          angle: angle,
          speed: speed,
          maxLife: 700 + Math.random() * 680,
          gravity: 0.018
        });
      }
      rings.push({
        x: x,
        y: y,
        r: 8,
        maxR: 92 * (power || 1),
        alpha: 0.65,
        color: '#9cb3ea',
        width: 2.2
      });
      rings.push({
        x: x,
        y: y,
        r: 4,
        maxR: 138 * (power || 1),
        alpha: 0.42,
        color: '#ccd9fa',
        width: 1.4
      });
    }

    function closeSplash(immediate) {
      if (closed) return;
      closed = true;
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      window.removeEventListener('resize', resize);

      if (immediate) {
        if (rafId) cancelAnimationFrame(rafId);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (activeCleanup === closeSplash) activeCleanup = null;
        return;
      }

      overlay.classList.add('is-closing');
      setTimeout(function () {
        if (rafId) cancelAnimationFrame(rafId);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (activeCleanup === closeSplash) activeCleanup = null;
      }, 640);
    }

    activeCleanup = closeSplash;

    // 跳过按钮触感反馈
    function setSkipPressed(pressed) {
      if (pressed) skipBtn.classList.add('is-pressed');
      else skipBtn.classList.remove('is-pressed');
    }
    skipBtn.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      setSkipPressed(true);
    }, { passive: true });
    skipBtn.addEventListener('touchend', function () {
      setSkipPressed(false);
    }, { passive: true });
    skipBtn.addEventListener('touchcancel', function () {
      setSkipPressed(false);
    }, { passive: true });
    skipBtn.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      setSkipPressed(true);
    });
    skipBtn.addEventListener('mouseup', function () {
      setSkipPressed(false);
    });
    skipBtn.addEventListener('mouseleave', function () {
      setSkipPressed(false);
    });
    skipBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeSplash(false);
    });

    // 全屏指尖像素星尘互动 + 射中后轻触进入
    function handleTapOrBurst(clientX, clientY, isTap) {
      if (closed) return;
      spawnBurst(clientX, clientY, isTap ? 12 : 3, isTap ? 0.65 : 0.35);
      if (isTap && hitTriggered && performance.now() - startTime > 2050) {
        closeSplash(false);
      }
    }

    var lastMoveSpawn = 0;
    overlay.addEventListener('touchstart', function (e) {
      if (e.target && e.target.closest('.ps-skip-btn')) return;
      var t = e.touches && e.touches[0];
      if (t) handleTapOrBurst(t.clientX, t.clientY, true);
    }, { passive: true });

    overlay.addEventListener('touchmove', function (e) {
      var now = performance.now();
      if (now - lastMoveSpawn < 36) return;
      lastMoveSpawn = now;
      var t = e.touches && e.touches[0];
      if (t) {
        spawnParticle(t.clientX, t.clientY, {
          speed: 0.4 + Math.random() * 1.1,
          maxLife: 520 + Math.random() * 340,
          gravity: 0.01
        });
      }
    }, { passive: true });

    overlay.addEventListener('mousedown', function (e) {
      if (e.target && e.target.closest('.ps-skip-btn')) return;
      handleTapOrBurst(e.clientX, e.clientY, true);
    });

    window.addEventListener('resize', resize);

    // 动画时间轴节点 (ms)
    var T_FLY_END = 950;
    var T_DRAW_END = 1380;
    var T_ARROW_HIT = 1760;
    var T_PERCH_END = 2620;
    var T_AUTO_CLOSE = 3950;

    function tick(now) {
      if (closed && !overlay.parentNode) return;
      if (!startTime) startTime = now;
      var elapsed = now - startTime;

      ctx.clearRect(0, 0, W, H);

      var angelW = Math.min(W * 0.45, 192);
      var logoW = Math.min(W * 0.78, 326);

      // 关键锚点坐标（相对屏幕中心）
      var startX = -W * 0.46;
      var startY = -H * 0.24;

      var aimX = -Math.min(W * 0.21, 90);
      var aimY = -Math.min(H * 0.04, 24);

      var perchX = 0;
      var perchY = -Math.min(logoW * 0.39, 128);

      // 右侧目标水晶爱心坐标
      var targetX = W * 0.5 + Math.min(W * 0.24, 102);
      var targetY = H * 0.52;

      var curAngelX = aimX;
      var curAngelY = aimY;
      var curAngelRot = 0;
      var curAngelScale = 1;
      var curAngelOpacity = 1;

      if (elapsed < T_FLY_END) {
        // 阶段1：小天使从左上方翩然飞入
        var p1 = easeOutCubic(clamp01(elapsed / T_FLY_END));
        curAngelX = lerp(startX, aimX, p1);
        curAngelY = lerp(startY, aimY, p1) - Math.sin(p1 * Math.PI) * 26;
        curAngelRot = lerp(-14, 0, p1);
        curAngelScale = lerp(0.84, 1, p1);
        curAngelOpacity = clamp01(elapsed / 260);

        if (now - lastTrailTime > 48) {
          lastTrailTime = now;
          spawnParticle(
            W * 0.5 + curAngelX - angelW * 0.22 + (Math.random() - 0.5) * 18,
            H * 0.5 + curAngelY + (Math.random() - 0.5) * 18,
            {
              angle: Math.PI + (Math.random() - 0.5) * 0.8,
              speed: 0.4 + Math.random() * 0.9,
              maxLife: 620 + Math.random() * 380,
              gravity: 0.008
            }
          );
        }
      } else if (elapsed < T_DRAW_END) {
        // 阶段2：小天使微倾蓄力拉弓
        var p2 = easeInOutCubic(clamp01((elapsed - T_FLY_END) / (T_DRAW_END - T_FLY_END)));
        curAngelX = aimX - p2 * 9;
        curAngelY = aimY - p2 * 4;
        curAngelRot = -p2 * 4.5;
        curAngelScale = 1 + p2 * 0.035;

        // 弓尖聚光星尘
        var chargeX = W * 0.5 + curAngelX + angelW * 0.43;
        var chargeY = H * 0.5 + curAngelY + angelW * 0.1;
        var glowR = 6 + p2 * 12;
        var grad = ctx.createRadialGradient(chargeX, chargeY, 1, chargeX, chargeY, glowR * 1.8);
        grad.addColorStop(0, 'rgba(204, 217, 250, ' + (0.7 * p2) + ')');
        grad.addColorStop(1, 'rgba(204, 217, 250, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(chargeX, chargeY, glowR * 1.8, 0, Math.PI * 2);
        ctx.fill();

        drawPixelStar(ctx, chargeX, chargeY, 1.8 + p2 * 1.6, '#9cb3ea', 0.5 + 0.5 * p2);
      } else if (elapsed < T_ARROW_HIT) {
        // 阶段3：放箭瞬间轻微回弹
        var p3 = easeOutCubic(clamp01((elapsed - T_DRAW_END) / (T_ARROW_HIT - T_DRAW_END)));
        curAngelX = aimX - 9 + p3 * 13;
        curAngelY = aimY - 4 + p3 * 3;
        curAngelRot = -4.5 + p3 * 6.5;
        curAngelScale = 1.035 - p3 * 0.035;
      } else if (elapsed < T_PERCH_END) {
        // 阶段4：射中后优雅飞回 77 Phone 正上方落位
        var p4 = easeInOutCubic(clamp01((elapsed - T_ARROW_HIT) / (T_PERCH_END - T_ARROW_HIT)));
        curAngelX = lerp(aimX + 4, perchX, p4);
        curAngelY = lerp(aimY - 1, perchY, p4) - Math.sin(p4 * Math.PI) * 20;
        curAngelRot = lerp(2, 0, p4);
        curAngelScale = lerp(1, 0.96, p4);
      } else {
        // 阶段5：停驻在 77 Phone 上方轻柔呼吸悬浮
        var floatT = (elapsed - T_PERCH_END) / 1000;
        curAngelX = perchX;
        curAngelY = perchY + Math.sin(floatT * 2.6) * 5;
        curAngelRot = Math.sin(floatT * 1.8) * 1.2;
        curAngelScale = 0.96;

        if (now - lastAmbientTime > 180) {
          lastAmbientTime = now;
          spawnParticle(
            W * 0.5 + (Math.random() - 0.5) * logoW * 0.92,
            H * 0.52 + (Math.random() - 0.5) * logoW * 0.58,
            {
              kind: Math.random() > 0.4 ? 'star' : 'heart',
              speed: 0.2 + Math.random() * 0.45,
              vyBias: -0.35,
              maxLife: 780 + Math.random() * 480,
              gravity: -0.004
            }
          );
        }
      }

      angelWrap.style.opacity = String(curAngelOpacity);
      angelWrap.style.transform =
        'translate(-50%, -50%) translate3d(' +
        curAngelX.toFixed(2) + 'px, ' +
        curAngelY.toFixed(2) + 'px, 0) rotate(' +
        curAngelRot.toFixed(2) + 'deg) scale(' +
        curAngelScale.toFixed(3) + ')';

      // 绘制右侧待射中的水晶像素爱心（射中前）
      if (elapsed > 220 && elapsed < T_ARROW_HIT) {
        var heartAppear = easeOutBack(clamp01((elapsed - 220) / 480));
        var pulse = 1 + Math.sin(elapsed * 0.008) * 0.08;
        var hScale = heartAppear * pulse;

        // 柔和冰蓝光晕
        var hGrad = ctx.createRadialGradient(targetX, targetY, 2, targetX, targetY, 34 * hScale);
        hGrad.addColorStop(0, 'rgba(181, 199, 244, 0.36)');
        hGrad.addColorStop(1, 'rgba(181, 199, 244, 0)');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 34 * hScale, 0, Math.PI * 2);
        ctx.fill();

        drawPixelHeart(ctx, targetX, targetY, 3.6 * hScale, '#9cb3ea', 0.95, true);
        drawPixelStar(ctx, targetX - 24, targetY - 14, 1.5, '#b5c7f4', 0.55 + 0.35 * Math.sin(elapsed * 0.009));
        drawPixelStar(ctx, targetX + 22, targetY + 12, 1.3, '#ccd9fa', 0.55 + 0.35 * Math.cos(elapsed * 0.009));
      }

      // 绘制飞行中的像素爱心箭
      if (elapsed >= T_DRAW_END && elapsed <= T_ARROW_HIT) {
        var ap = clamp01((elapsed - T_DRAW_END) / (T_ARROW_HIT - T_DRAW_END));
        var arrowEase = easeOutCubic(ap);
        var bowX = W * 0.5 + (aimX - 9) + angelW * 0.43;
        var bowY = H * 0.5 + (aimY - 4) + angelW * 0.1;

        var ax = lerp(bowX, targetX, arrowEase);
        var ay = lerp(bowY, targetY, arrowEase) - Math.sin(arrowEase * Math.PI) * 16;

        // 计算切线角度
        var nextP = clamp01(arrowEase + 0.02);
        var nx = lerp(bowX, targetX, nextP);
        var ny = lerp(bowY, targetY, nextP) - Math.sin(nextP * Math.PI) * 16;
        var angle = Math.atan2(ny - ay, nx - ax);

        // 尾迹丝带星光
        spawnParticle(ax - Math.cos(angle) * 12, ay - Math.sin(angle) * 12, {
          kind: Math.random() > 0.35 ? 'star' : 'dot',
          angle: angle + Math.PI + (Math.random() - 0.5) * 0.6,
          speed: 0.4 + Math.random() * 0.9,
          size: 1.5 + Math.random() * 1.1,
          maxLife: 380 + Math.random() * 240,
          gravity: 0.005
        });

        drawPixelArrow(ctx, ax, ay, angle, 1.08, 1);
      }

      // 命中触发：爱心炸裂 + 77 Phone 绽放
      if (!hitTriggered && elapsed >= T_ARROW_HIT) {
        hitTriggered = true;
        spawnBurst(targetX, targetY, 26, 1.15);
        spawnBurst(W * 0.5, H * 0.54, 18, 0.95);
        glow.classList.add('is-visible');
        logoWrap.classList.add('is-visible');
        setTimeout(function () {
          if (!closed) tapHint.classList.add('is-visible');
        }, 520);
      }

      // 更新并绘制扩散光环
      for (var ri = rings.length - 1; ri >= 0; ri--) {
        var ring = rings[ri];
        ring.r += (ring.maxR - ring.r) * 0.085;
        ring.alpha *= 0.93;
        if (ring.alpha < 0.02) {
          rings.splice(ri, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = ring.alpha;
        ctx.lineWidth = ring.width;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 更新并绘制像素粒子
      for (var i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.life += 16.6;
        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        pt.vx *= pt.drag;
        pt.vy = pt.vy * pt.drag + pt.gravity;
        pt.x += pt.vx;
        pt.y += pt.vy;

        var remain = 1 - pt.life / pt.maxLife;
        var a = remain < 0.3 ? remain / 0.3 : 1;

        if (pt.kind === 'heart') {
          drawPixelHeart(ctx, pt.x, pt.y, pt.size, pt.color, a * 0.92, true);
        } else if (pt.kind === 'star') {
          drawPixelStar(ctx, pt.x, pt.y, pt.size, pt.color, a * 0.9);
        } else if (pt.kind === 'cross') {
          drawPixelCross(ctx, pt.x, pt.y, pt.size * 0.9, pt.color, a * 0.85);
        } else {
          ctx.save();
          ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = pt.color;
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size * 1.4, pt.size * 1.4);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    // 预加载两张图后再起飞，避免首帧闪白框
    Promise.all([preloadImage(ANGEL_SRC), preloadImage(LOGO_SRC)]).then(function () {
      if (closed) return;
      rafId = requestAnimationFrame(tick);
      autoCloseTimer = setTimeout(function () {
        closeSplash(false);
      }, T_AUTO_CLOSE);
    });
  }

  window.PhoneSplash = {
    play: play,
    skip: function () {
      if (activeCleanup) activeCleanup(false);
    },
    isEnabled: isEnabled,
    setEnabled: setEnabled
  };

  function boot() {
    if (isEnabled()) {
      play();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
