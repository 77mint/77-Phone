/* apps/splash.js - 纸张燃烧消散开屏动画（WebGL 实时噪声着色器 + 焦边火星 + 自动释放） */
(function () {
  var ENABLED_KEY = 'phone_splash_enabled';

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
      '.ph-splash-wrap {' +
        'position: absolute; inset: 0; z-index: 9999;' +
        'overflow: hidden; pointer-events: auto;' +
        'opacity: 1; transition: opacity 0.36s cubic-bezier(0.32, 0.72, 0, 1);' +
        '-webkit-user-select: none; user-select: none;' +
      '}' +
      '.ph-splash-wrap.is-leaving { opacity: 0; pointer-events: none; }' +
      '.ph-splash-canvas {' +
        'position: absolute; inset: 0; width: 100%; height: 100%; display: block;' +
      '}' +
      '.ph-splash-skip {' +
        'position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); right: 16px; z-index: 3;' +
        'padding: 6px 13px; border-radius: 999px;' +
        'border: 1px solid rgba(255, 255, 255, 0.92);' +
        'background: linear-gradient(145deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.32) 100%);' +
        'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95);' +
        'color: #4a433d; font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif);' +
        'font-size: calc(var(--app-font-size, 15px) - 3px); font-weight: 600;' +
        'cursor: pointer; -webkit-tap-highlight-color: transparent;' +
        'transition: transform 0.2s cubic-bezier(0.34, 1.46, 0.64, 1), opacity 0.2s ease;' +
      '}' +
      '.ph-splash-skip.is-pressed { transform: scale(0.88); opacity: 0.75; }';
    document.head.appendChild(st);
  }

  /* 生成细腻纸张纹理 + 极简信笺排版作为燃烧底图 */
  function createPaperCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');

    /* 暖白纸底 */
    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#fcfaf7');
    bg.addColorStop(0.55, '#f9f6f0');
    bg.addColorStop(1, '#f4efe7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* 细腻纸张纤维微噪点 */
    var step = Math.max(2, Math.round(w / 180));
    for (var y = 0; y < h; y += step * 2) {
      for (var x = 0; x < w; x += step * 2) {
        var r = Math.random();
        if (r > 0.72) {
          ctx.fillStyle = 'rgba(130, 112, 92, ' + ((r - 0.72) * 0.14).toFixed(3) + ')';
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    var scale = w / 390;
    var rootFs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-font-size')) || 15;
    var fs = rootFs * scale;

    /* 顶部极细角标 */
    ctx.fillStyle = 'rgba(92, 82, 74, 0.52)';
    ctx.font = '500 ' + Math.round(fs * 0.68) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('( 77 · PHONE )', Math.round(22 * scale), Math.round(62 * scale));
    ctx.textAlign = 'right';
    ctx.fillText('( READY )', w - Math.round(22 * scale), Math.round(62 * scale));

    /* 中央信笺文字 */
    var leftX = Math.round(w * 0.16);
    var startY = Math.round(h * 0.36);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#2c2623';
    ctx.font = 'italic 500 ' + Math.round(fs * 1.45) + 'px Georgia, "Songti SC", serif';
    ctx.fillText('Lift the latch.', leftX, startY);

    ctx.fillStyle = 'rgba(56, 48, 43, 0.76)';
    ctx.font = '400 ' + Math.round(fs * 0.96) + 'px Georgia, "Songti SC", serif';
    var lines = [
      'The little lamp beside your pillow',
      'is still warm in the quiet dark.',
      'Whenever you reach for the screen,',
      'someone is already waiting here.'
    ];
    var lineH = Math.round(fs * 1.72);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], leftX, startY + Math.round(fs * 2.5) + i * lineH);
    }

    ctx.fillStyle = 'rgba(44, 38, 35, 0.85)';
    ctx.font = 'italic 400 ' + Math.round(fs * 1.05) + 'px Georgia, "Songti SC", serif';
    ctx.fillText('With hope, always.', leftX, startY + Math.round(fs * 2.5) + lines.length * lineH + Math.round(fs * 0.9));

    /* 底部极细落款 */
    ctx.fillStyle = 'rgba(92, 82, 74, 0.44)';
    ctx.font = '500 ' + Math.round(fs * 0.65) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('77MINT / PHONE', Math.round(22 * scale), h - Math.round(44 * scale));
    ctx.textAlign = 'right';
    ctx.fillText('TAP TO IGNITE', w - Math.round(22 * scale), h - Math.round(44 * scale));

    return c;
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
    var texW = Math.round(cssW * dpr);
    var texH = Math.round(cssH * dpr);

    var wrap = document.createElement('div');
    wrap.className = 'ph-splash-wrap';
    wrap.id = 'phoneSplashOverlay';

    var canvas = document.createElement('canvas');
    canvas.className = 'ph-splash-canvas';
    canvas.width = texW;
    canvas.height = texH;
    wrap.appendChild(canvas);

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ph-splash-skip';
    skipBtn.textContent = '跳过';
    wrap.appendChild(skipBtn);

    mount.appendChild(wrap);

    var paperCanvas = createPaperCanvas(texW, texH);
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false }) ||
             canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, antialias: false });

    var rafId = 0;
    var finished = false;
    var speedBoost = 1.0;

    function finish(immediate) {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      activeCleanup = null;
      if (immediate) {
        releaseGL();
        wrap.remove();
      } else {
        wrap.classList.add('is-leaving');
        setTimeout(function () {
          releaseGL();
          wrap.remove();
        }, 360);
      }
    }

    function releaseGL() {
      if (!gl) return;
      try {
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (e) {}
      gl = null;
    }

    activeCleanup = function () { finish(true); };

    /* 跳过按钮手感绑定 */
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

    /* 轻点纸面加速燃烧 */
    wrap.addEventListener('click', function () {
      speedBoost = 2.4;
    });

    if (!gl) {
      /* 无 WebGL 时优雅降级为淡出 */
      var ctx2d = canvas.getContext('2d');
      if (ctx2d) ctx2d.drawImage(paperCanvas, 0, 0);
      setTimeout(function () { finish(false); }, 950);
      return;
    }

    var vsSrc =
      'attribute vec2 aPos;' +
      'varying vec2 vUv;' +
      'void main() {' +
        'vUv = aPos * 0.5 + 0.5;' +
        'gl_Position = vec4(aPos, 0.0, 1.0);' +
      '}';

    var fsSrc =
      '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
      'varying vec2 vUv;' +
      'uniform sampler2D uPaper;' +
      'uniform float uProgress;' +
      'uniform float uTime;' +
      'uniform float uAspect;' +
      'uniform float uSeed;' +

      'float hash(vec2 p) {' +
        'return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);' +
      '}' +

      'float noise(vec2 p) {' +
        'vec2 i = floor(p);' +
        'vec2 f = fract(p);' +
        'vec2 u = f * f * (3.0 - 2.0 * f);' +
        'return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),' +
                   'mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);' +
      '}' +

      'float fbm(vec2 p) {' +
        'float v = 0.0;' +
        'float a = 0.5;' +
        'mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);' +
        'for (int i = 0; i < 5; i++) {' +
          'v += a * noise(p);' +
          'p = rot * p * 2.04;' +
          'a *= 0.5;' +
        '}' +
        'return v;' +
      '}' +

      'void main() {' +
        'vec2 uv = vec2(vUv.x, 1.0 - vUv.y);' +
        'vec4 paper = texture2D(uPaper, uv);' +

        'vec2 p = vec2(uv.x * uAspect, uv.y);' +
        /* 双点火中心：中上偏左 + 右下，复刻真实纸张不规则烧穿 */
        'vec2 c1 = vec2(0.42 * uAspect, 0.37);' +
        'vec2 c2 = vec2(0.72 * uAspect, 0.72);' +
        'float d1 = length(p - c1);' +
        'float d2 = length(p - c2) + 0.14;' +
        'float dist = min(d1, d2);' +

        /* 锯齿纸张边缘噪声 */
        'float n = fbm(p * 4.2 + vec2(0.0, uTime * 0.06));' +
        'float nFine = fbm(p * 13.5 - vec2(uTime * 0.12, 0.0));' +
        'float field = dist - (n * 0.32 + nFine * 0.085);' +

        'float edge = field - uProgress;' +

        /* 已烧穿区域完全透明，直接透出底层小手机 */
        'if (edge < 0.0) {' +
          'gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);' +
          'return;' +
        '}' +

        /* 纸张卷边烤黄 -> 焦褐 -> 黑炭 -> 灼热橙红火星 */
        'float scorch = 1.0 - smoothstep(0.018, 0.115, edge);' +
        'float charMask = 1.0 - smoothstep(0.008, 0.044, edge);' +
        'float emberBand = 1.0 - smoothstep(0.0, 0.022, edge);' +
        'float flicker = 0.72 + 0.28 * sin(uTime * 16.0 + nFine * 18.0);' +

        'vec3 col = paper.rgb;' +
        /* 焦黄过渡 */
        'col = mix(col, vec3(0.76, 0.56, 0.36), scorch * 0.52);' +
        /* 焦黑炭边 */
        'col = mix(col, vec3(0.11, 0.07, 0.05), charMask * 0.94);' +
        /* 炽热火星光晕（红橙 -> 明黄） */
        'vec3 emberCol = mix(vec3(0.95, 0.24, 0.06), vec3(1.0, 0.78, 0.32), smoothstep(0.016, 0.001, edge));' +
        'col = mix(col, emberCol * (1.15 * flicker), emberBand * 0.96);' +

        'float alpha = smoothstep(0.0, 0.006, edge);' +
        'gl_FragColor = vec4(col, alpha);' +
      '}';

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      finish(false);
      return;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      finish(false);
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var locPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paperCanvas);

    var uPaper = gl.getUniformLocation(prog, 'uPaper');
    var uProgress = gl.getUniformLocation(prog, 'uProgress');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uAspect = gl.getUniformLocation(prog, 'uAspect');
    var uSeed = gl.getUniformLocation(prog, 'uSeed');

    gl.uniform1i(uPaper, 0);
    gl.uniform1f(uAspect, cssW / cssH);
    gl.uniform1f(uSeed, Math.random() * 50.0);
    gl.viewport(0, 0, texW, texH);
    gl.clearColor(0, 0, 0, 0);

    var startTs = performance.now();
    var lastTs = startTs;
    var elapsed = 0;
    var holdSec = 0.36;
    var burnSec = 2.05;

    function frame(now) {
      if (finished || !gl) return;
      var dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      elapsed += dt * speedBoost;

      var t = Math.max(0, (elapsed - holdSec) / burnSec);
      /* 缓起快收的自然燃烧曲线 */
      var eased = t < 1 ? (t * t * (2.2 - 1.2 * t)) : 1.0;
      var progress = -0.34 + eased * 1.72;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (t >= 1.0) {
        finish(true);
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
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
