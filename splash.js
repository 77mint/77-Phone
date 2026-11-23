/* splash.js - 77 Phone 像素天使拉弓射箭开屏动画（纯白无缝 + 冰蓝像素粒子 + 指尖星芒互动） */
(function () {
  var ENABLED_KEY = 'phone_splash_enabled';
  var ANGEL_IMG_SRC = 'icons/2AFEB7A1-6243-47EA-8A30-18F69AEB801B.png';

  function isSplashEnabled() {
    var v = localStorage.getItem(ENABLED_KEY);
    return v === null || v === '1' || v === 'true';
  }

  function setSplashEnabled(flag) {
    localStorage.setItem(ENABLED_KEY, flag ? '1' : '0');
  }

  function ensureStyles() {
    if (document.getElementById('phoneSplashStyle')) return;
    var st = document.createElement('style');
    st.id = 'phoneSplashStyle';
    st.textContent =
      '.ph-sp-wrap {' +
        'position: absolute; inset: 0; z-index: 9999;' +
        'background: #ffffff; overflow: hidden;' +
        '-webkit-user-select: none; user-select: none;' +
        'opacity: 1;' +
        'transition: opacity 0.62s cubic-bezier(0.32, 0.72, 0, 1), transform 0.62s cubic-bezier(0.32, 0.72, 0, 1);' +
      '}' +
      '.ph-sp-wrap.is-leaving {' +
        'opacity: 0; transform: scale(1.04); pointer-events: none;' +
      '}' +
      '.ph-sp-glow {' +
        'position: absolute; left: 50%; top: 44%; width: 280px; height: 280px;' +
        'transform: translate(-50%, -50%) scale(0.7); border-radius: 50%;' +
        'background: radial-gradient(circle, rgba(164, 206, 255, 0.26) 0%, rgba(195, 224, 255, 0.1) 46%, rgba(255, 255, 255, 0) 74%);' +
        'opacity: 0; pointer-events: none;' +
        'transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.32, 0.72, 0, 1);' +
      '}' +
      '.ph-sp-glow.is-on { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }' +
      '.ph-sp-canvas {' +
        'position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; z-index: 2;' +
      '}' +
      '.ph-sp-angel {' +
        'position: absolute; left: 31%; top: 40%; width: 158px; height: 158px;' +
        'margin-left: -79px; margin-top: -79px; z-index: 3; pointer-events: none;' +
        'transform: translate3d(-150px, -110px, 0) scale(0.68) rotate(-14deg);' +
        'opacity: 0; will-change: transform, opacity;' +
        'transition: transform 0.92s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease;' +
      '}' +
      '.ph-sp-angel img {' +
        'width: 100%; height: 100%; object-fit: contain; display: block;' +
        'mix-blend-mode: multiply;' +
      '}' +
      '.ph-sp-angel.is-arrived {' +
        'opacity: 1;' +
        'transform: translate3d(0, 0, 0) scale(1) rotate(0deg);' +
      '}' +
      '.ph-sp-angel.is-drawing {' +
        'opacity: 1;' +
        'transform: translate3d(-8px, -3px, 0) scale(1.02) rotate(-6deg);' +
        'transition: transform 0.58s cubic-bezier(0.32, 0.72, 0, 1);' +
      '}' +
      '.ph-sp-angel.is-shot {' +
        'opacity: 1;' +
        'transform: translate3d(6px, -6px, 0) scale(1.03) rotate(3deg);' +
        'transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);' +
      '}' +
      '.ph-sp-angel.is-hover {' +
        'opacity: 1;' +
        'transform: translate3d(0, -4px, 0) scale(1) rotate(0deg);' +
        'transition: transform 0.7s ease-in-out;' +
      '}' +
      '.ph-sp-title {' +
        'position: absolute; left: 0; right: 0; top: 60%; z-index: 4; text-align: center; pointer-events: none;' +
        'opacity: 0; transform: translateY(10px) scale(0.95);' +
        'transition: opacity 0.55s cubic-bezier(0.32, 0.72, 0, 1), transform 0.55s cubic-bezier(0.32, 0.72, 0, 1);' +
      '}' +
      '.ph-sp-title.is-show { opacity: 1; transform: translateY(0) scale(1); }' +
      '.ph-sp-title-main {' +
        'font-family: Georgia, "Times New Roman", "Songti SC", serif;' +
        'font-style: italic; font-weight: 400;' +
        'font-size: calc(var(--app-font-size, 15px) + 11px);' +
        'letter-spacing: 0.06em; color: #5f86c2;' +
        'text-shadow: 0 2px 14px rgba(135, 182, 245, 0.35);' +
      '}' +
      '.ph-sp-title-sub {' +
        'margin-top: 6px;' +
        'font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif);' +
        'font-size: calc(var(--app-font-size, 15px) - 3px);' +
        'letter-spacing: 0.14em; color: rgba(122, 150, 194, 0.72);' +
      '}' +
      '.ph-sp-skip {' +
        'position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); right: 16px; z-index: 5;' +
        'padding: 6px 10px; border: none; background: transparent;' +
        'color: rgba(122, 148, 188, 0.62);' +
        'font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif);' +
        'font-size: calc(var(--app-font-size, 15px) - 2px); font-weight: 500;' +
        'cursor: pointer; -webkit-tap-highlight-color: transparent;' +
        'transition: transform 0.2s cubic-bezier(0.34, 1.46, 0.64, 1), opacity 0.16s ease;' +
      '}' +
      '.ph-sp-skip.is-pressed { transform: scale(0.86); opacity: 0.35; }';
    document.head.appendChild(st);
  }

  /* 像素小图案绘制（冰蓝爱心 / 像素四角星 / 迷你十字架 / 爱心箭） */
  function drawPixelHeart(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var p = s;
    var grid = [
      [0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0]
    ];
    var ox = x - (7 * p) / 2;
    var oy = y - (6 * p) / 2;
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) {
          ctx.fillRect(Math.round(ox + c * p), Math.round(oy + r * p), Math.ceil(p), Math.ceil(p));
        }
      }
    }
    /* 像素高光点 */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ox + 1.5 * p), Math.round(oy + 1.2 * p), Math.ceil(p), Math.ceil(p));
    ctx.restore();
  }

  function drawPixelStar(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var p = s;
    ctx.fillRect(Math.round(x - p * 0.5), Math.round(y - p * 2.5), Math.ceil(p), Math.ceil(p * 5));
    ctx.fillRect(Math.round(x - p * 2.5), Math.round(y - p * 0.5), Math.ceil(p * 5), Math.ceil(p));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - p * 0.5), Math.round(y - p * 0.5), Math.ceil(p), Math.ceil(p));
    ctx.restore();
  }

  function drawPixelCross(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var p = s;
    ctx.fillRect(Math.round(x - p * 0.5), Math.round(y - p * 2.2), Math.ceil(p), Math.ceil(p * 5.2));
    ctx.fillRect(Math.round(x - p * 1.8), Math.round(y - p * 0.8), Math.ceil(p * 3.6), Math.ceil(p));
    ctx.restore();
  }

  function drawPixelArrow(ctx, x, y, angle, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    var p = scale;
    /* 箭杆 */
    ctx.fillStyle = '#89b4f0';
    ctx.fillRect(-14 * p, -0.8 * p, 24 * p, 1.6 * p);
    /* 箭尾羽毛 */
    ctx.fillStyle = '#b9d6ff';
    ctx.fillRect(-16 * p, -3 * p, 4 * p, 1.6 * p);
    ctx.fillRect(-16 * p, 1.4 * p, 4 * p, 1.6 * p);
    ctx.fillRect(-13 * p, -2 * p, 3 * p, 1.4 * p);
    ctx.fillRect(-13 * p, 0.8 * p, 3 * p, 1.4 * p);
    /* 爱心箭头 */
    ctx.fillStyle = '#6da0eb';
    ctx.fillRect(9 * p, -3.2 * p, 2.4 * p, 6.4 * p);
    ctx.fillRect(11.2 * p, -2.2 * p, 2.2 * p, 4.4 * p);
    ctx.fillRect(13.2 * p, -1.1 * p, 2.0 * p, 2.2 * p);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10 * p, -1.6 * p, 1.4 * p, 1.4 * p);
    ctx.restore();
  }

  var activeCleanup = null;

  function playSplash() {
    if (activeCleanup) activeCleanup();
    ensureStyles();

    var mount = document.getElementById('phone') || document.body;
    var rect = mount.getBoundingClientRect();
    var cssW = Math.max(320, Math.round(rect.width || window.innerWidth));
    var cssH = Math.max(568, Math.round(rect.height || window.innerHeight));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var wrap = document.createElement('div');
    wrap.className = 'ph-sp-wrap';
    wrap.id = 'phoneSplashOverlay';

    var glow = document.createElement('div');
    glow.className = 'ph-sp-glow';
    wrap.appendChild(glow);

    var canvas = document.createElement('canvas');
    canvas.className = 'ph-sp-canvas';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    wrap.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var angelBox = document.createElement('div');
    angelBox.className = 'ph-sp-angel';
    var angelImg = document.createElement('img');
    angelImg.src = ANGEL_IMG_SRC;
    angelImg.alt = '';
    angelBox.appendChild(angelImg);
    wrap.appendChild(angelBox);

    var titleBox = document.createElement('div');
    titleBox.className = 'ph-sp-title';
    titleBox.innerHTML =
      '<div class="ph-sp-title-main">77 Phone</div>' +
      '<div class="ph-sp-title-sub">✦ WELCOME BACK ✦</div>';
    wrap.appendChild(titleBox);

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ph-sp-skip';
    skipBtn.textContent = '跳过';
    wrap.appendChild(skipBtn);

    mount.appendChild(wrap);

    var rafId = 0;
    var timers = [];
    var finished = false;
    var arrowHit = false;

    /* 坐标锚点（像素空间） */
    var W = canvas.width;
    var H = canvas.height;
    var bowX = W * 0.44;
    var bowY = H * 0.42;
    var targetX = W * 0.74;
    var targetY = H * 0.44;

    var particles = [];
    var palette = ['#8cb8f5', '#a9cdfa', '#c9e1ff', '#719ee6', '#b7c7f5'];

    function spawnBurst(x, y, count, speedScale) {
      var sp = speedScale || 1;
      for (var i = 0; i < count; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = (26 + Math.random() * 88) * dpr * sp;
        var kindRoll = Math.random();
        var kind = kindRoll < 0.46 ? 'heart' : (kindRoll < 0.82 ? 'star' : 'cross');
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 12 * dpr,
          size: (kind === 'heart' ? (1.4 + Math.random() * 1.4) : (1.5 + Math.random() * 1.5)) * dpr,
          color: palette[Math.floor(Math.random() * palette.length)],
          kind: kind,
          life: 0,
          maxLife: 0.65 + Math.random() * 0.65
        });
      }
    }

    function spawnAmbient(x, y) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 18 * dpr,
        vy: -(12 + Math.random() * 24) * dpr,
        size: (1.2 + Math.random() * 1.1) * dpr,
        color: palette[Math.floor(Math.random() * palette.length)],
        kind: Math.random() < 0.55 ? 'star' : 'heart',
        life: 0,
        maxLife: 0.6 + Math.random() * 0.5
      });
    }

    function finish(immediate) {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      timers.forEach(function (id) { clearTimeout(id); });
      timers = [];
      activeCleanup = null;
      if (immediate) {
        wrap.remove();
      } else {
        wrap.classList.add('is-leaving');
        setTimeout(function () { wrap.remove(); }, 620);
      }
    }

    activeCleanup = function () { finish(true); };

    /* 跳过按钮手感 */
    skipBtn.addEventListener('touchstart', function () { skipBtn.classList.add('is-pressed'); }, { passive: true });
    skipBtn.addEventListener('touchend', function (e) {
      skipBtn.classList.remove('is-pressed');
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }, { passive: false });
    skipBtn.addEventListener('touchcancel', function () { skipBtn.classList.remove('is-pressed'); }, { passive: true });
    skipBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      finish(false);
    });

    /* 指尖互动：点或划屏幕迸出冰蓝像素爱心与星芒；射中后轻点立刻进入 */
    function handlePointer(clientX, clientY, isTap) {
      var r = wrap.getBoundingClientRect();
      var px = (clientX - r.left) * dpr;
      var py = (clientY - r.top) * dpr;
      spawnBurst(px, py, isTap ? 8 : 2, isTap ? 0.85 : 0.45);
      if (isTap && arrowHit) {
        finish(false);
      }
    }

    wrap.addEventListener('touchstart', function (e) {
      if (e.target === skipBtn) return;
      if (e.touches && e.touches[0]) {
        handlePointer(e.touches[0].clientX, e.touches[0].clientY, true);
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) {
        handlePointer(e.touches[0].clientX, e.touches[0].clientY, false);
      }
    }, { passive: true });

    wrap.addEventListener('click', function (e) {
      if (e.target === skipBtn) return;
      handlePointer(e.clientX, e.clientY, true);
    });

    /* 动画时间轴 */
    requestAnimationFrame(function () {
      angelBox.classList.add('is-arrived');
      glow.classList.add('is-on');
    });

    /* 0.85s：小天使自己向后拉弓蓄力 */
    timers.push(setTimeout(function () {
      angelBox.classList.remove('is-arrived');
      angelBox.classList.add('is-drawing');
    }, 850));

    /* 1.45s：放箭后坐力 */
    timers.push(setTimeout(function () {
      angelBox.classList.remove('is-drawing');
      angelBox.classList.add('is-shot');
    }, 1450));

    /* 1.82s：命中水晶心，绽开 77 Phone */
    timers.push(setTimeout(function () {
      arrowHit = true;
      angelBox.classList.remove('is-shot');
      angelBox.classList.add('is-hover');
      titleBox.classList.add('is-show');
      spawnBurst(targetX, targetY, 26, 1.15);
    }, 1820));

    /* 2.85s：柔和散开进桌面 */
    timers.push(setTimeout(function () {
      finish(false);
    }, 2850));

    var startTs = performance.now();
    var lastTs = startTs;
    var trailAcc = 0;

    function tick(now) {
      if (finished) return;
      var dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      var t = (now - startTs) / 1000;

      ctx.clearRect(0, 0, W, H);

      /* 飞入阶段的尾迹星芒 */
      if (t > 0.08 && t < 0.82) {
        trailAcc += dt;
        if (trailAcc > 0.065) {
          trailAcc = 0;
          var p = t / 0.82;
          var fx = W * (0.04 + 0.28 * p) + (Math.random() - 0.5) * 24 * dpr;
          var fy = H * (0.24 + 0.16 * p) + (Math.random() - 0.5) * 24 * dpr;
          spawnAmbient(fx, fy);
        }
      }

      /* 右侧待射中的冰蓝像素水晶爱心（0.45s 浮现，1.82s 被射碎） */
      if (t > 0.45 && !arrowHit) {
        var appear = Math.min(1, (t - 0.45) / 0.45);
        var pulse = 1 + Math.sin(t * 6.5) * 0.08;
        var heartScale = 3.2 * dpr * appear * pulse;

        /* 外围轻闪四角星 */
        var starAlpha = appear * (0.55 + 0.35 * Math.sin(t * 8));
        drawPixelStar(ctx, targetX - 24 * dpr, targetY - 18 * dpr, 1.6 * dpr, '#9bc3fa', starAlpha);
        drawPixelStar(ctx, targetX + 24 * dpr, targetY + 14 * dpr, 1.4 * dpr, '#b5d4ff', starAlpha);

        drawPixelHeart(ctx, targetX, targetY, heartScale, '#8cb8f5', appear * 0.94);
      }

      /* 0.85s - 1.45s：自己拉弓蓄力，箭身慢慢后拉并聚光 */
      if (t >= 0.85 && t < 1.45) {
        var dp = (t - 0.85) / 0.6;
        var easedPull = 1 - Math.pow(1 - dp, 2);
        var pullBack = easedPull * 16 * dpr;
        var ang = Math.atan2(targetY - bowY, targetX - bowX);
        drawPixelArrow(ctx, bowX - pullBack, bowY + 2 * dpr, ang, 1.35 * dpr, Math.min(1, dp * 2.2));

        /* 箭尖蓄力微光星芒 */
        if (Math.random() < 0.35) {
          spawnAmbient(bowX + 14 * dpr - pullBack + (Math.random() - 0.5) * 14 * dpr, bowY + (Math.random() - 0.5) * 14 * dpr);
        }
      }

      /* 1.45s - 1.82s：像素爱心箭高速飞向右侧水晶心 */
      if (t >= 1.45 && t < 1.82) {
        var fp = (t - 1.45) / 0.37;
        var easedFly = fp * fp * (3 - 2 * fp);
        var ax = bowX - 16 * dpr + (targetX - (bowX - 16 * dpr)) * easedFly;
        var ay = bowY + (targetY - bowY) * easedFly - Math.sin(fp * Math.PI) * 12 * dpr;
        var ang2 = Math.atan2(targetY - bowY, targetX - bowX);
        drawPixelArrow(ctx, ax, ay, ang2, 1.4 * dpr, 1);

        if (Math.random() < 0.75) {
          spawnAmbient(ax - 8 * dpr, ay + (Math.random() - 0.5) * 6 * dpr);
        }
      }

      /* 命中瞬间冰蓝扩散光环 */
      if (arrowHit && t < 2.55) {
        var rp = (t - 1.82) / 0.73;
        var ringR = rp * 115 * dpr;
        ctx.save();
        ctx.strokeStyle = 'rgba(138, 184, 245, ' + ((1 - rp) * 0.55).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, (2.4 * (1 - rp)) * dpr);
        ctx.beginPath();
        ctx.arc(targetX, targetY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      /* 更新并绘制所有像素爱心 / 星芒 / 十字架粒子 */
      if (particles.length > 140) particles.splice(0, particles.length - 140);
      for (var i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        var lr = pt.life / pt.maxLife;
        var alpha = lr < 0.18 ? (lr / 0.18) : (1 - (lr - 0.18) / 0.82);
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy += 26 * dpr * dt;

        if (pt.kind === 'heart') drawPixelHeart(ctx, pt.x, pt.y, pt.size, pt.color, alpha);
        else if (pt.kind === 'cross') drawPixelCross(ctx, pt.x, pt.y, pt.size, pt.color, alpha);
        else drawPixelStar(ctx, pt.x, pt.y, pt.size, pt.color, alpha);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  }

  window.PhoneSplash = {
    play: playSplash,
    skip: function () { if (activeCleanup) activeCleanup(); },
    isEnabled: isSplashEnabled,
    setEnabled: setSplashEnabled
  };

  function boot() {
    if (isSplashEnabled()) playSplash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
