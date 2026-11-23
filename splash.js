/* splash.js — 77 Phone 巴洛克法阵 + 星纱破界 + 水晶风铃开屏动画 */
(function () {
  'use strict';

  var STORAGE_KEY = 'phone_splash_enabled';
  var ANGEL_SRC = 'icons/12F8689E-B660-4FB2-870D-B8E7F5869F2C.png';
  var LOGO_SRC = 'icons/56DEC4D0-9D53-4498-BC8A-BB30BFB4FF6A.png';

  // 与素材一致的低饱和雾感蓝紫 / 冰蓝调色盘
  var PALETTE = ['#8b9fd9', '#9cb3ea', '#b5c7f4', '#ccd9fa', '#c3ccf5', '#dce5fc'];

  var activeCleanup = null;
  var cachedSprites = null;

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

  // 原生 Web Audio 水晶风铃 / 八音盒合成器（零外部音频）
  function createChimeAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var ctx = null;
    var tapScale = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98];
    var tapIdx = 0;

    function ensure() {
      if (!AudioCtx) return null;
      if (!ctx) {
        try {
          ctx = new AudioCtx();
        } catch (e) {
          return null;
        }
      }
      if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
      }
      return ctx;
    }

    function playBell(freq, delay, duration, peakGain) {
      var ac = ensure();
      if (!ac || ac.state !== 'running') return;
      var t0 = ac.currentTime + (delay || 0);
      var dur = duration || 1.1;
      var vol = peakGain || 0.055;

      var osc1 = ac.createOscillator();
      var osc2 = ac.createOscillator();
      var gain = ac.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t0);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, t0);

      var subGain = ac.createGain();
      subGain.gain.setValueAtTime(0.18, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc1.connect(gain);
      osc2.connect(subGain);
      subGain.connect(gain);
      gain.connect(ac.destination);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + dur + 0.04);
      osc2.stop(t0 + dur + 0.04);
    }

    return {
      unlock: function () {
        ensure();
      },
      tapSparkle: function () {
        var freq = tapScale[tapIdx % tapScale.length];
        tapIdx++;
        playBell(freq, 0, 0.72, 0.042);
      },
      shoot: function () {
        playBell(1046.5, 0, 0.45, 0.032);
        playBell(1318.5, 0.055, 0.55, 0.028);
      },
      bloom: function () {
        playBell(783.99, 0, 1.25, 0.05);
        playBell(987.77, 0.07, 1.3, 0.045);
        playBell(1318.51, 0.14, 1.45, 0.05);
        playBell(1567.98, 0.22, 1.6, 0.038);
      },
      veilOpen: function () {
        playBell(1174.66, 0, 0.9, 0.032);
        playBell(1567.98, 0.09, 1.15, 0.036);
      },
      dispose: function () {
        if (ctx && ctx.close) {
          try { ctx.close(); } catch (e) {}
        }
        ctx = null;
      }
    };
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
      '  overflow: hidden;',
      '  touch-action: none;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '  -webkit-tap-highlight-color: transparent;',
      '}',
      '#phoneSplashOverlay.is-canvas-ready {',
      '  background: transparent;',
      '}',
      '#phoneSplashOverlay.is-revealing {',
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
      '.ps-skip-btn {',
      '  position: absolute;',
      '  top: calc(env(safe-area-inset-top, 12px) + 12px);',
      '  right: 16px;',
      '  z-index: 3;',
      '  padding: 6px 14px;',
      '  border-radius: 999px;',
      '  border: 1px solid rgba(156, 179, 234, 0.34);',
      '  background: rgba(255, 255, 255, 0.86);',
      '  color: #8b9fd9;',
      '  font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif);',
      '  font-size: calc(var(--app-font-size, 15px) * 0.87);',
      '  font-weight: 500;',
      '  letter-spacing: 0.04em;',
      '  line-height: 1.2;',
      '  cursor: pointer;',
      '  outline: none;',
      '  opacity: 1;',
      '  transform: scale(1);',
      '  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), background-color 0.2s ease, opacity 0.32s ease;',
      '}',
      '.ps-skip-btn.is-pressed {',
      '  transform: scale(0.91);',
      '  background: rgba(220, 229, 252, 0.58);',
      '  opacity: 0.82;',
      '}',
      '.ps-skip-btn.is-hidden {',
      '  opacity: 0;',
      '  pointer-events: none;',
      '}',
      '.ps-tap-hint {',
      '  position: absolute;',
      '  left: 50%;',
      '  bottom: calc(env(safe-area-inset-bottom, 16px) + 26px);',
      '  transform: translateX(-50%) translateY(6px);',
      '  color: rgba(139, 159, 217, 0.68);',
      '  font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif);',
      '  font-size: calc(var(--app-font-size, 15px) * 0.8);',
      '  letter-spacing: 0.12em;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 0.42s ease, transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);',
      '}',
      '.ps-tap-hint.is-visible {',
      '  opacity: 1;',
      '  transform: translateX(-50%) translateY(0);',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (img.decode) {
          img.decode().then(function () { resolve(img); }).catch(function () { resolve(img); });
        } else {
          resolve(img);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  // 离屏缩放 + 四边漫水抠除白底（保留内部白色头发、翅膀与文字）
  function bakeSprite(img, maxDim) {
    if (!img || !img.naturalWidth) return null;
    var natW = img.naturalWidth;
    var natH = img.naturalHeight;
    var scale = Math.min(1, maxDim / Math.max(natW, natH));
    var w = Math.max(1, Math.round(natW * scale));
    var h = Math.max(1, Math.round(natH * scale));

    var off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    var octx = off.getContext('2d', { willReadFrequently: true });
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, 0, 0, w, h);

    var keyed = false;
    try {
      var imgData = octx.getImageData(0, 0, w, h);
      var d = imgData.data;
      var total = w * h;
      var bgMask = new Uint8Array(total);
      var queue = new Int32Array(total);
      var head = 0;
      var tail = 0;

      function isNearWhite(idx) {
        var o = idx * 4;
        var r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3];
        if (a < 16) return true;
        var minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
        var maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
        return minC >= 238 && (maxC - minC) <= 18;
      }

      function enqueue(idx) {
        if (bgMask[idx]) return;
        if (isNearWhite(idx)) {
          bgMask[idx] = 1;
          queue[tail++] = idx;
        }
      }

      for (var x = 0; x < w; x++) {
        enqueue(x);
        enqueue((h - 1) * w + x);
      }
      for (var y = 1; y < h - 1; y++) {
        enqueue(y * w);
        enqueue(y * w + (w - 1));
      }

      while (head < tail) {
        var cur = queue[head++];
        var cx = cur % w;
        var cy = (cur - cx) / w;
        if (cx > 0) enqueue(cur - 1);
        if (cx < w - 1) enqueue(cur + 1);
        if (cy > 0) enqueue(cur - w);
        if (cy < h - 1) enqueue(cur + w);
      }

      for (var i = 0; i < total; i++) {
        if (bgMask[i]) {
          d[i * 4 + 3] = 0;
        } else {
          var px = i % w;
          var py = (i - px) / w;
          var touchBg =
            (px > 0 && bgMask[i - 1]) ||
            (px < w - 1 && bgMask[i + 1]) ||
            (py > 0 && bgMask[i - w]) ||
            (py < h - 1 && bgMask[i + w]);
          if (touchBg) {
            var o2 = i * 4;
            var lum = (d[o2] + d[o2 + 1] + d[o2 + 2]) / 3;
            if (lum > 224) {
              var factor = Math.max(0, (246 - lum) / 22);
              d[o2 + 3] = Math.round(d[o2 + 3] * factor);
            }
          }
        }
      }

      octx.putImageData(imgData, 0, 0);
      keyed = true;
    } catch (e) {
      keyed = false;
    }

    return {
      canvas: off,
      w: w,
      h: h,
      aspect: w / h,
      keyed: keyed
    };
  }

  function prepareSprites() {
    if (cachedSprites) return Promise.resolve(cachedSprites);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var angelMax = Math.round(Math.min(window.innerWidth * 0.48, 210) * dpr);
    var logoMax = Math.round(Math.min(window.innerWidth * 0.82, 340) * dpr);

    return Promise.all([loadImage(ANGEL_SRC), loadImage(LOGO_SRC)]).then(function (imgs) {
      cachedSprites = {
        angel: bakeSprite(imgs[0], Math.max(320, angelMax)),
        logo: bakeSprite(imgs[1], Math.max(460, logoMax))
      };
      return cachedSprites;
    });
  }

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function easeOutBack(t, s) {
    var c1 = s !== undefined ? s : 1.35;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function cubicBezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }
  function pickColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }

  var HEART_MAP = [
    '0110110',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
    '0001000'
  ];

  function drawPixelHeart(ctx, x, y, ps, color, alpha, glint) {
    ctx.globalAlpha = alpha;
    var ox = Math.round(x - 3.5 * ps);
    var oy = Math.round(y - 3 * ps);
    ctx.fillStyle = color;
    for (var r = 0; r < 6; r++) {
      var row = HEART_MAP[r];
      for (var c = 0; c < 7; c++) {
        if (row[c] === '1') {
          ctx.fillRect(ox + c * ps, oy + r * ps, ps + 0.3, ps + 0.3);
        }
      }
    }
    if (glint) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.78;
      ctx.fillRect(ox + ps, oy + ps, ps, ps);
    }
  }

  function drawSparkleStar(ctx, x, y, r, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
    ctx.fill();
  }

  function drawMiniCross(ctx, x, y, s, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var w = Math.max(1.2, s * 0.32);
    ctx.fillRect(x - w / 2, y - s, w, s * 2.35);
    ctx.fillRect(x - s * 0.75, y - s * 0.35, s * 1.5, w);
  }

  // 绘制旋转巴洛克星轨法阵
  function drawBaroqueCircle(ctx, cx, cy, baseR, angle, alpha, boost) {
    if (alpha <= 0.005) return;
    ctx.save();
    ctx.translate(cx, cy);

    // 外圈双细环
    ctx.rotate(angle);
    ctx.strokeStyle = '#b5c7f4';
    ctx.globalAlpha = alpha * (0.42 + boost * 0.35);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ccd9fa';
    ctx.globalAlpha = alpha * (0.38 + boost * 0.25);
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 0.89, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8 方位星芒刻度
    for (var i = 0; i < 8; i++) {
      var a = (Math.PI * 2 * i) / 8;
      var rx = Math.cos(a) * baseR;
      var ry = Math.sin(a) * baseR;
      drawSparkleStar(ctx, rx, ry, i % 2 === 0 ? 5.2 : 3.2, '#9cb3ea', alpha * (0.55 + boost * 0.35));
    }

    // 反向内圈几何八角星线
    ctx.rotate(-angle * 2.1);
    ctx.strokeStyle = '#c3ccf5';
    ctx.globalAlpha = alpha * (0.28 + boost * 0.32);
    ctx.lineWidth = 0.9;
    var rIn = baseR * 0.68;
    for (var sq = 0; sq < 2; sq++) {
      ctx.save();
      ctx.rotate((sq * Math.PI) / 4);
      ctx.strokeRect(-rIn * 0.707, -rIn * 0.707, rIn * 1.414, rIn * 1.414);
      ctx.restore();
    }

    // 内圈极细圆
    ctx.globalAlpha = alpha * (0.34 + boost * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 0.48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // 四角极细巴洛克星芒纹饰（纯图形无文字，命中后点亮）
  function drawCornerFiligree(ctx, W, H, alpha) {
    if (alpha <= 0.005) return;
    var padX = 22;
    var padTop = 54;
    var padBottom = 34;
    var len = Math.min(W * 0.11, 42);
    var corners = [
      { x: padX, y: padTop, dx: 1, dy: 1 },
      { x: W - padX, y: padTop, dx: -1, dy: 1 },
      { x: padX, y: H - padBottom, dx: 1, dy: -1 },
      { x: W - padX, y: H - padBottom, dx: -1, dy: -1 }
    ];

    ctx.save();
    ctx.strokeStyle = '#b5c7f4';
    ctx.lineWidth = 1;
    for (var i = 0; i < corners.length; i++) {
      var c = corners[i];
      ctx.globalAlpha = alpha * 0.52;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + c.dy * len);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x + c.dx * len, c.y);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.32;
      ctx.beginPath();
      ctx.moveTo(c.x + c.dx * 5, c.y + c.dy * (len * 0.65));
      ctx.lineTo(c.x + c.dx * 5, c.y + c.dy * 5);
      ctx.lineTo(c.x + c.dx * (len * 0.65), c.y + c.dy * 5);
      ctx.stroke();

      drawSparkleStar(ctx, c.x, c.y, 4.4, '#9cb3ea', alpha * 0.72);
    }
    ctx.restore();
  }

  // 飘落轻盈羽片
  function drawFeather(ctx, f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.globalAlpha = f.alpha;

    var len = f.size;
    var grad = ctx.createLinearGradient(-len, 0, len, 0);
    grad.addColorStop(0, 'rgba(204, 217, 250, 0.25)');
    grad.addColorStop(0.5, 'rgba(181, 199, 244, 0.62)');
    grad.addColorStop(1, 'rgba(156, 179, 234, 0.32)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(-len * 0.2, -len * 0.42, len, 0);
    ctx.quadraticCurveTo(-len * 0.1, len * 0.34, -len, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-len * 0.9, 0);
    ctx.lineTo(len * 0.85, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawLightArrow(ctx, x, y, angle, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    var tailGrad = ctx.createLinearGradient(-52, 0, 14, 0);
    tailGrad.addColorStop(0, 'rgba(181, 199, 244, 0)');
    tailGrad.addColorStop(0.5, 'rgba(156, 179, 234, 0.58)');
    tailGrad.addColorStop(1, 'rgba(139, 159, 217, 0.96)');
    ctx.strokeStyle = tailGrad;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-52, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();

    ctx.fillStyle = '#ccd9fa';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-29, -5.8);
    ctx.lineTo(-24.5, 0);
    ctx.lineTo(-29, 5.8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#8b9fd9';
    ctx.beginPath();
    ctx.moveTo(19.5, 0);
    ctx.bezierCurveTo(14.5, -5.8, 8.5, -5.8, 7, -1.6);
    ctx.lineTo(9.5, 0);
    ctx.lineTo(7, 1.6);
    ctx.bezierCurveTo(8.5, 5.8, 14.5, 5.8, 19.5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#eef3ff';
    ctx.beginPath();
    ctx.arc(12.5, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function play() {
    if (activeCleanup) {
      activeCleanup(true);
    }

    injectStyles();
    var audio = createChimeAudio();
    audio.unlock();

    var overlay = document.createElement('div');
    overlay.id = 'phoneSplashOverlay';

    var canvas = document.createElement('canvas');
    canvas.className = 'ps-canvas';

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ps-skip-btn';
    skipBtn.textContent = '跳过';

    var tapHint = document.createElement('div');
    tapHint.className = 'ps-tap-hint';
    tapHint.textContent = '轻触进入';

    overlay.appendChild(canvas);
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

    // 初始化 8 片慢飘羽片
    var feathers = [];
    for (var fi = 0; fi < 8; fi++) {
      feathers.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.85 - H * 0.15,
        vy: 18 + Math.random() * 20,
        swayAmp: 14 + Math.random() * 18,
        swayFreq: 1.2 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        rot: (Math.random() - 0.5) * 0.8,
        rotSpd: (Math.random() - 0.5) * 0.5,
        size: 10 + Math.random() * 7,
        alpha: 0.32 + Math.random() * 0.34
      });
    }

    var particles = [];
    var rings = [];
    var arrowTrail = [];
    var rafId = 0;
    var closed = false;
    var shotSoundPlayed = false;
    var hitTriggered = false;
    var revealStarted = false;
    var revealStartElapsed = 999;
    var elapsed = 0;
    var lastFrameTime = 0;
    var trailAcc = 0;
    var ambientAcc = 0;
    var rimAcc = 0;
    var canvasReadyMarked = false;

    function spawnParticle(x, y, opts) {
      opts = opts || {};
      var kinds = ['star', 'star', 'heart', 'cross', 'dot'];
      var kind = opts.kind || kinds[Math.floor(Math.random() * kinds.length)];
      var ang = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2;
      var spd = opts.speed !== undefined ? opts.speed : (45 + Math.random() * 145);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd + (opts.vyBias || 0),
        size: opts.size || (kind === 'heart' ? 2 + Math.random() * 1.1 : kind === 'star' ? 4 + Math.random() * 4.5 : 3 + Math.random() * 2.4),
        kind: kind,
        color: opts.color || pickColor(),
        life: 0,
        maxLife: opts.maxLife || (0.55 + Math.random() * 0.55),
        drag: opts.drag !== undefined ? opts.drag : 3.1,
        gravity: opts.gravity !== undefined ? opts.gravity : 46
      });
    }

    function spawnBurst(x, y, count, power) {
      var p = power || 1;
      for (var i = 0; i < count; i++) {
        var ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.42;
        spawnParticle(x, y, {
          angle: ang,
          speed: (65 + Math.random() * 215) * p,
          maxLife: 0.62 + Math.random() * 0.65,
          drag: 2.7,
          gravity: 50
        });
      }
      rings.push({ x: x, y: y, r: 8, maxR: 120 * p, life: 0, maxLife: 0.6, color: '#9cb3ea', width: 2.2 });
      rings.push({ x: x, y: y, r: 4, maxR: 175 * p, life: 0, maxLife: 0.78, color: '#ccd9fa', width: 1.3 });
    }

    function startReveal(fast) {
      if (revealStarted || closed) return;
      revealStarted = true;
      revealStartElapsed = elapsed;
      if (fast) {
        REVEAL_DUR = 0.54;
      }
      overlay.classList.add('is-revealing');
      skipBtn.classList.add('is-hidden');
      tapHint.classList.remove('is-visible');
      audio.veilOpen();
    }

    function finishCleanup(immediate) {
      if (closed) return;
      closed = true;
      window.removeEventListener('resize', resize);
      if (rafId) cancelAnimationFrame(rafId);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (immediate) {
        audio.dispose();
      } else {
        setTimeout(function () { audio.dispose(); }, 600);
      }
      if (activeCleanup === finishCleanup) activeCleanup = null;
    }

    activeCleanup = finishCleanup;

    // 跳过按钮触感反馈
    function setSkipPressed(pressed) {
      if (pressed) skipBtn.classList.add('is-pressed');
      else skipBtn.classList.remove('is-pressed');
    }
    skipBtn.addEventListener('touchstart', function (e) { e.stopPropagation(); setSkipPressed(true); audio.unlock(); }, { passive: true });
    skipBtn.addEventListener('touchend', function () { setSkipPressed(false); }, { passive: true });
    skipBtn.addEventListener('touchcancel', function () { setSkipPressed(false); }, { passive: true });
    skipBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); setSkipPressed(true); audio.unlock(); });
    skipBtn.addEventListener('mouseup', function () { setSkipPressed(false); });
    skipBtn.addEventListener('mouseleave', function () { setSkipPressed(false); });
    skipBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startReveal(true);
    });

    // 全屏指尖星尘 + 风铃互动 + 命中后轻触立即破开帷幕
    var lastTouchMove = 0;
    function onInteractTap(x, y) {
      if (closed || revealStarted) return;
      audio.unlock();
      audio.tapSparkle();
      spawnBurst(x, y, 10, 0.56);
      if (hitTriggered && elapsed > 1.72) {
        startReveal(false);
      }
    }
    overlay.addEventListener('touchstart', function (e) {
      if (e.target && e.target.closest('.ps-skip-btn')) return;
      var t = e.touches && e.touches[0];
      if (t) onInteractTap(t.clientX, t.clientY);
    }, { passive: true });
    overlay.addEventListener('touchmove', function (e) {
      if (revealStarted) return;
      var now = performance.now();
      if (now - lastTouchMove < 28) return;
      lastTouchMove = now;
      var t = e.touches && e.touches[0];
      if (t) {
        spawnParticle(t.clientX, t.clientY, {
          speed: 24 + Math.random() * 52,
          maxLife: 0.45 + Math.random() * 0.3,
          gravity: 14
        });
      }
    }, { passive: true });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target && e.target.closest('.ps-skip-btn')) return;
      onInteractTap(e.clientX, e.clientY);
    });

    window.addEventListener('resize', resize);

    // 动画时间轴（秒）
    var T_SWOOP = 0.76;
    var T_DRAW = 1.10;
    var T_HIT = 1.38;
    var T_PERCH = 2.04;
    var T_AUTO_REVEAL = 2.75;
    var REVEAL_DUR = 0.78;

    var sprites = null;

    function drawSprite(sp, x, y, drawW, rot, sx, sy, alpha) {
      if (!sp || alpha <= 0.004) return;
      var drawH = drawW / sp.aspect;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.globalAlpha = alpha;
      if (!sp.keyed) {
        ctx.globalCompositeOperation = 'multiply';
      }
      ctx.drawImage(sp.canvas, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    function tick(now) {
      if (closed) return;
      if (!lastFrameTime) lastFrameTime = now;
      var dt = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      elapsed += dt;

      if (!revealStarted && elapsed >= T_AUTO_REVEAL) {
        startReveal(false);
      }

      var revealP = 0;
      if (revealStarted) {
        revealP = clamp01((elapsed - revealStartElapsed) / REVEAL_DUR);
        if (revealP >= 1) {
          finishCleanup(false);
          return;
        }
      }

      ctx.clearRect(0, 0, W, H);

      // 纯白底色画在 Canvas 内，方便最后星纱圆环破开露出真实桌面
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      if (!canvasReadyMarked) {
        canvasReadyMarked = true;
        overlay.classList.add('is-canvas-ready');
      }

      var cx = W * 0.5;
      var cy = H * 0.5;
      var angelW = Math.min(W * 0.44, 188);
      var logoW = Math.min(W * 0.78, 326);
      var logoH = sprites && sprites.logo ? logoW / sprites.logo.aspect : logoW * 0.62;
      var logoY = cy + Math.min(H * 0.05, 34);
      var aimX = cx - Math.min(W * 0.21, 88);
      var aimY = cy - Math.min(H * 0.03, 20);
      var targetX = cx + Math.min(W * 0.24, 100);
      var targetY = cy + 6;
      var perchX = cx;
      var perchY = logoY - logoH * 0.54;

      var veilFade = revealStarted ? 1 - easeInOutCubic(clamp01(revealP * 1.45)) : 1;

      // 1) 巴洛克旋转星轨法阵（开屏渐显，拉弓时略微聚光，命中后点亮）
      var circleAppear = easeOutQuint(clamp01(elapsed / 0.65));
      var circleBoost = elapsed >= T_HIT
        ? easeOutQuint(clamp01((elapsed - T_HIT) / 0.45))
        : (elapsed >= T_SWOOP ? 0.35 * clamp01((elapsed - T_SWOOP) / (T_DRAW - T_SWOOP)) : 0);
      var circleR = Math.min(W * 0.42, 178) * (0.9 + 0.1 * circleAppear + 0.06 * circleBoost);
      drawBaroqueCircle(ctx, cx, logoY - 14, circleR, elapsed * 0.22, circleAppear * veilFade, circleBoost);

      // 2) 四角极细巴洛克星芒纹饰（命中后随圣光波纹一起点亮）
      if (elapsed >= T_HIT) {
        var cornerP = easeOutQuint(clamp01((elapsed - T_HIT) / 0.55));
        drawCornerFiligree(ctx, W, H, cornerP * veilFade);
      }

      // 3) 飘落的雾蓝轻羽
      for (var f = 0; f < feathers.length; f++) {
        var ftObj = feathers[f];
        ftObj.y += ftObj.vy * dt;
        ftObj.x += Math.cos(elapsed * ftObj.swayFreq + ftObj.phase) * ftObj.swayAmp * dt;
        ftObj.rot += ftObj.rotSpd * dt;
        if (ftObj.y > H + 30) {
          ftObj.y = -24;
          ftObj.x = Math.random() * W;
        }
        drawFeather(ctx, ftObj);
      }

      // 4) 命中后全屏冰蓝圣光波纹 & 中心柔光
      if (elapsed >= T_HIT) {
        var gp = easeOutQuint(clamp01((elapsed - T_HIT) / 0.65));
        var glowR = logoW * (0.46 + 0.36 * gp);
        var bgGrad = ctx.createRadialGradient(cx, logoY - 12, 8, cx, logoY - 12, glowR);
        bgGrad.addColorStop(0, 'rgba(181, 199, 244, ' + (0.28 * gp * veilFade) + ')');
        bgGrad.addColorStop(0.55, 'rgba(204, 217, 250, ' + (0.11 * gp * veilFade) + ')');
        bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, logoY - 12, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 圣光横扫全屏波纹
        var waveP = clamp01((elapsed - T_HIT) / 0.85);
        if (waveP < 1) {
          var wR = Math.hypot(W, H) * 0.65 * easeOutQuint(waveP);
          ctx.save();
          ctx.strokeStyle = 'rgba(181, 199, 244, ' + ((1 - waveP) * 0.42) + ')';
          ctx.lineWidth = (1 - waveP) * 14 + 1;
          ctx.beginPath();
          ctx.arc(targetX, targetY, wR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5) 右侧待射水晶爱心
      if (elapsed > 0.14 && elapsed < T_HIT) {
        var hp = easeOutBack(clamp01((elapsed - 0.14) / 0.4), 1.45);
        var breathe = 1 + Math.sin(elapsed * 7.2) * 0.075;
        var hs = hp * breathe;

        var hGrad = ctx.createRadialGradient(targetX, targetY, 2, targetX, targetY, 36 * hs);
        hGrad.addColorStop(0, 'rgba(181, 199, 244, 0.36)');
        hGrad.addColorStop(1, 'rgba(181, 199, 244, 0)');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 36 * hs, 0, Math.PI * 2);
        ctx.fill();

        drawPixelHeart(ctx, targetX, targetY, 3.6 * hs, '#9cb3ea', clamp01(hp) * 0.94, true);
        drawSparkleStar(ctx, targetX - 24, targetY - 15, 5.2, '#b5c7f4', 0.45 + 0.4 * Math.sin(elapsed * 8.5));
        drawSparkleStar(ctx, targetX + 22, targetY + 13, 4.2, '#ccd9fa', 0.45 + 0.4 * Math.cos(elapsed * 8.5));
      }

      // 6) 77 Phone 巴洛克丝带徽标
      if (elapsed >= T_HIT) {
        var lp = clamp01((elapsed - T_HIT) / 0.54);
        var logoScale = lerp(0.72, 1.0, easeOutBack(lp, 1.32)) * (1 + revealP * 0.08);
        var logoAlpha = easeOutQuint(clamp01((elapsed - T_HIT) / 0.32)) * veilFade;
        var logoFloat = (1 - easeOutQuint(lp)) * 16;
        drawSprite(sprites && sprites.logo, cx, logoY + logoFloat, logoW, 0, logoScale, logoScale, logoAlpha);
      }

      // 7) 小天使连续丝滑轨迹
      var ax = aimX;
      var ay = aimY;
      var aRot = 0;
      var aSx = 1;
      var aSy = 1;
      var aAlpha = veilFade;

      if (elapsed < T_SWOOP) {
        var u1 = clamp01(elapsed / T_SWOOP);
        var t1 = easeOutQuint(u1);
        var p0x = cx - W * 0.56, p0y = cy - H * 0.28;
        var p1x = cx - W * 0.36, p1y = cy - H * 0.20;
        var p2x = aimX - 28, p2y = aimY + 26;
        ax = cubicBezier(p0x, p1x, p2x, aimX, t1);
        ay = cubicBezier(p0y, p1y, p2y, aimY, t1);
        aRot = lerp(-0.22, 0.02, t1) + Math.sin(u1 * Math.PI) * 0.06;
        var stretch = 1 + Math.sin(u1 * Math.PI) * 0.04;
        aSx = lerp(0.84, 1, t1) * stretch;
        aSy = lerp(0.84, 1, t1) / Math.sqrt(stretch);
        aAlpha = clamp01(elapsed / 0.2) * veilFade;

        trailAcc += dt;
        if (trailAcc > 0.032) {
          trailAcc = 0;
          spawnParticle(ax - angelW * 0.2, ay + (Math.random() - 0.5) * 18, {
            kind: Math.random() > 0.35 ? 'star' : 'heart',
            angle: Math.PI + (Math.random() - 0.5) * 0.7,
            speed: 22 + Math.random() * 48,
            maxLife: 0.55 + Math.random() * 0.32,
            gravity: 14
          });
        }
      } else if (elapsed < T_DRAW) {
        var u2 = easeInOutSine(clamp01((elapsed - T_SWOOP) / (T_DRAW - T_SWOOP)));
        ax = aimX - u2 * 11;
        ay = aimY - u2 * 5;
        aRot = lerp(0.02, -0.09, u2);
        aSx = 1 - u2 * 0.025;
        aSy = 1 + u2 * 0.03;

        var bx = ax + angelW * 0.43;
        var by = ay + angelW * 0.1;
        var cGrad = ctx.createRadialGradient(bx, by, 1, bx, by, 20 * u2 + 4);
        cGrad.addColorStop(0, 'rgba(181, 199, 244, ' + (0.78 * u2) + ')');
        cGrad.addColorStop(1, 'rgba(181, 199, 244, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(bx, by, 20 * u2 + 4, 0, Math.PI * 2);
        ctx.fill();
        drawSparkleStar(ctx, bx, by, 5 + 8 * u2, '#9cb3ea', 0.42 + 0.58 * u2);
      } else if (elapsed < T_HIT) {
        if (!shotSoundPlayed) {
          shotSoundPlayed = true;
          audio.shoot();
        }
        var u3 = easeOutQuint(clamp01((elapsed - T_DRAW) / (T_HIT - T_DRAW)));
        ax = lerp(aimX - 11, aimX + 6, u3);
        ay = lerp(aimY - 5, aimY - 1, u3);
        aRot = lerp(-0.09, 0.05, u3);
        aSx = 1 + Math.sin(u3 * Math.PI) * 0.045;
        aSy = 1 - Math.sin(u3 * Math.PI) * 0.03;
      } else if (elapsed < T_PERCH) {
        var u4 = clamp01((elapsed - T_HIT) / (T_PERCH - T_HIT));
        var t4 = easeOutBack(u4, 0.72);
        var mX = (aimX + perchX) * 0.5 - 12;
        var mY = Math.min(aimY, perchY) - 44;
        ax = cubicBezier(aimX + 6, mX, perchX - 14, perchX, clamp01(t4));
        ay = cubicBezier(aimY - 1, mY, perchY - 18, perchY, t4);
        aRot = lerp(0.05, 0, easeOutQuint(u4)) - Math.sin(u4 * Math.PI) * 0.07;
        aSx = lerp(1, 0.94, easeOutQuint(u4));
        aSy = aSx;
      } else {
        var ft = elapsed - T_PERCH;
        ax = perchX;
        ay = perchY + Math.sin(ft * 2.8) * 4.5 - revealP * 14;
        aRot = Math.sin(ft * 2.0) * 0.022;
        aSx = 0.94 * (1 + revealP * 0.06);
        aSy = aSx;

        ambientAcc += dt;
        if (!revealStarted && ambientAcc > 0.13) {
          ambientAcc = 0;
          spawnParticle(
            cx + (Math.random() - 0.5) * logoW * 0.92,
            logoY + (Math.random() - 0.5) * logoH * 0.85,
            {
              kind: Math.random() > 0.35 ? 'star' : 'heart',
              speed: 12 + Math.random() * 24,
              vyBias: -24,
              maxLife: 0.7 + Math.random() * 0.45,
              gravity: -8
            }
          );
        }
      }

      drawSprite(sprites && sprites.angel, ax, ay, angelW, aRot, aSx, aSy, aAlpha);

      // 8) 丝带光箭飞行
      if (elapsed >= T_DRAW && elapsed <= T_HIT) {
        var ap = clamp01((elapsed - T_DRAW) / (T_HIT - T_DRAW));
        var ae = 1 - Math.pow(1 - ap, 2.4);
        var startBX = (aimX - 11) + angelW * 0.43;
        var startBY = (aimY - 5) + angelW * 0.1;

        var arX = lerp(startBX, targetX, ae);
        var arY = lerp(startBY, targetY, ae) - Math.sin(ae * Math.PI) * 18;
        var nextAe = clamp01(ae + 0.03);
        var nX = lerp(startBX, targetX, nextAe);
        var nY = lerp(startBY, targetY, nextAe) - Math.sin(nextAe * Math.PI) * 18;
        var arAngle = Math.atan2(nY - arY, nX - arX);

        arrowTrail.push({ x: arX, y: arY, life: 0, maxLife: 0.28 });
        spawnParticle(arX - Math.cos(arAngle) * 10, arY - Math.sin(arAngle) * 10, {
          kind: 'star',
          angle: arAngle + Math.PI + (Math.random() - 0.5) * 0.6,
          speed: 25 + Math.random() * 50,
          size: 3 + Math.random() * 2.5,
          maxLife: 0.34,
          gravity: 10
        });

        drawLightArrow(ctx, arX, arY, arAngle, 1.05, 1);
      }

      if (arrowTrail.length > 1) {
        for (var ti = arrowTrail.length - 1; ti >= 0; ti--) {
          arrowTrail[ti].life += dt;
          if (arrowTrail[ti].life >= arrowTrail[ti].maxLife) {
            arrowTrail.splice(ti, 1);
          }
        }
        if (arrowTrail.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          for (var tj = 1; tj < arrowTrail.length; tj++) {
            var prev = arrowTrail[tj - 1];
            var cur = arrowTrail[tj];
            var ta = 1 - cur.life / cur.maxLife;
            ctx.strokeStyle = 'rgba(181, 199, 244, ' + (ta * 0.55) + ')';
            ctx.lineWidth = ta * 3.5;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 9) 命中爆发
      if (!hitTriggered && elapsed >= T_HIT) {
        hitTriggered = true;
        audio.bloom();
        spawnBurst(targetX, targetY, 24, 1.15);
        spawnBurst(cx, logoY, 18, 0.95);
        setTimeout(function () {
          if (!closed && !revealStarted) tapHint.classList.add('is-visible');
        }, 380);
      }

      // 10) 扩散柔光环
      for (var ri = rings.length - 1; ri >= 0; ri--) {
        var ring = rings[ri];
        ring.life += dt;
        if (ring.life >= ring.maxLife) {
          rings.splice(ri, 1);
          continue;
        }
        var rp = easeOutQuint(ring.life / ring.maxLife);
        var curR = lerp(ring.r, ring.maxR, rp);
        ctx.save();
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = (1 - ring.life / ring.maxLife) * 0.58;
        ctx.lineWidth = ring.width * (1 - rp * 0.5);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, curR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 11) 破开星纱帷幕露出真实桌面（destination-out 柔边光圈）
      if (revealStarted && revealP > 0) {
        var easeRev = easeInOutCubic(revealP);
        var maxPortalR = Math.hypot(W, H) * 0.68;
        var holeR = maxPortalR * easeRev;
        var feather = 78;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        var holeGrad = ctx.createRadialGradient(cx, logoY, Math.max(0, holeR - feather), cx, logoY, holeR + 28);
        holeGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        holeGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0.92)');
        holeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = holeGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // 帷幕边缘雾蓝流光环 + 星尘
        var rimAlpha = Math.sin(revealP * Math.PI) * 0.72;
        if (rimAlpha > 0.01) {
          ctx.save();
          ctx.strokeStyle = 'rgba(181, 199, 244, ' + rimAlpha + ')';
          ctx.lineWidth = 4.5 * (1 - revealP * 0.5);
          ctx.beginPath();
          ctx.arc(cx, logoY, holeR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(220, 229, 252, ' + (rimAlpha * 0.8) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, logoY, holeR + 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          rimAcc += dt;
          if (rimAcc > 0.025) {
            rimAcc = 0;
            for (var k = 0; k < 2; k++) {
              var ra = Math.random() * Math.PI * 2;
              spawnParticle(cx + Math.cos(ra) * holeR, logoY + Math.sin(ra) * holeR, {
                kind: Math.random() > 0.35 ? 'star' : 'heart',
                angle: ra + (Math.random() - 0.5) * 0.4,
                speed: 24 + Math.random() * 60,
                size: 3 + Math.random() * 3,
                maxLife: 0.42,
                gravity: 6
              });
            }
          }
        }
      }

      // 12) 星尘、小爱心与十字星粒子（画在破界环之上，跨层飘散更有空间感）
      ctx.save();
      for (var i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        var damp = Math.exp(-pt.drag * dt);
        pt.vx *= damp;
        pt.vy = pt.vy * damp + pt.gravity * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;

        var rem = 1 - pt.life / pt.maxLife;
        var a = rem < 0.35 ? rem / 0.35 : 1;

        if (pt.kind === 'heart') {
          drawPixelHeart(ctx, pt.x, pt.y, pt.size, pt.color, a * 0.9, true);
        } else if (pt.kind === 'star') {
          drawSparkleStar(ctx, pt.x, pt.y, pt.size * (0.65 + 0.35 * rem), pt.color, a * 0.9);
        } else if (pt.kind === 'cross') {
          drawMiniCross(ctx, pt.x, pt.y, pt.size, pt.color, a * 0.82);
        } else {
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x, pt.y, pt.size * 0.7, pt.size * 0.7);
        }
      }
      ctx.restore();

      rafId = requestAnimationFrame(tick);
    }

    prepareSprites().then(function (ready) {
      if (closed) return;
      sprites = ready;
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(tick);
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