/* splash/splash.js - 纯白信纸双洞慢燃开屏（锐利焦边 + 幽蓝火芯 + 飘散灰烬） */
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
        'opacity: 1; transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);' +
        '-webkit-user-select: none; user-select: none;' +
      '}' +
      '.ph-splash-wrap.is-leaving { opacity: 0; pointer-events: none; }' +
      '.ph-splash-canvas {' +
        'position: absolute; inset: 0; width: 100%; height: 100%; display: block;' +
      '}' +
      '.ph-splash-ash {' +
        'position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; z-index: 2;' +
      '}' +
      '.ph-splash-skip {' +
        'position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); right: 16px; z-index: 4;' +
        'padding: 6px 10px; border: none; background: transparent;' +
        'color: rgba(110, 104, 98, 0.58);' +
        'font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif);' +
        'font-size: calc(var(--app-font-size, 15px) - 2px); font-weight: 500; letter-spacing: 0.04em;' +
        'cursor: pointer; -webkit-tap-highlight-color: transparent;' +
        'transition: transform 0.2s cubic-bezier(0.34, 1.46, 0.64, 1), opacity 0.16s ease;' +
      '}' +
      '.ph-splash-skip.is-pressed { transform: scale(0.86); opacity: 0.35; }';
    document.head.appendChild(st);
  }

  /* 生成纯净亮白信纸 + 居中极简英文排版（四角无字） */
  function createPaperCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');

    /* 纯净亮白纸面 */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    /* 极细腻、几乎不可见的纸张微纹理 */
    var step = Math.max(2, Math.round(w / 220));
    for (var y = 0; y < h; y += step * 3) {
      for (var x = 0; x < w; x += step * 3) {
        var r = Math.random();
        if (r > 0.84) {
          ctx.fillStyle = 'rgba(180, 175, 168, ' + ((r - 0.84) * 0.12).toFixed(3) + ')';
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    var scale = w / 390;
    var rootFs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-font-size')) || 15;
    var fs = rootFs * scale;

    var leftX = Math.round(w * 0.16);
    var startY = Math.round(h * 0.39);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    /* 标题：77 Phone */
    ctx.fillStyle = '#1f1d1b';
    ctx.font = 'italic 400 ' + Math.round(fs * 1.38) + 'px Georgia, "Times New Roman", "Songti SC", serif';
    ctx.fillText('77 Phone', leftX, startY);

    /* 正文（纤细清冷感） */
    ctx.fillStyle = 'rgba(68, 64, 60, 0.78)';
    ctx.font = '300 ' + Math.round(fs * 0.84) + 'px Georgia, "Times New Roman", "Songti SC", serif';
    var lineY = startY + Math.round(fs * 2.55);
    var lineGap = Math.round(fs * 1.65);
    ctx.fillText('A quiet pocket of the universe,', leftX, lineY);
    ctx.fillText('untouched by noise, lit only by your touch.', leftX, lineY + lineGap);

    /* 落款 */
    ctx.fillStyle = 'rgba(42, 39, 36, 0.84)';
    ctx.font = 'italic 400 ' + Math.round(fs * 0.9) + 'px Georgia, "Times New Roman", "Songti SC", serif';
    ctx.fillText('Welcome back.', leftX, lineY + lineGap * 2 + Math.round(fs * 0.85));

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

    var ashCanvas = document.createElement('canvas');
    ashCanvas.className = 'ph-splash-ash';
    ashCanvas.width = texW;
    ashCanvas.height = texH;
    wrap.appendChild(ashCanvas);
    var ashCtx = ashCanvas.getContext('2d');

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
        }, 400);
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

    /* 跳过按钮触摸手感 */
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

    /* 轻点纸面温和加速 */
    wrap.addEventListener('click', function () {
      speedBoost = Math.min(2.6, speedBoost + 0.9);
    });

    if (!gl) {
      var ctx2d = canvas.getContext('2d');
      if (ctx2d) ctx2d.drawImage(paperCanvas, 0, 0);
      setTimeout(function () { finish(false); }, 1100);
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
      'uniform float uProg1;' +
      'uniform float uProg2;' +
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
          'p = rot * p * 2.05;' +
          'a *= 0.5;' +
        '}' +
        'return v;' +
      '}' +

      'void main() {' +
        'vec2 uv = vec2(vUv.x, 1.0 - vUv.y);' +
        'vec4 paper = texture2D(uPaper, uv);' +
        'vec2 p = vec2(uv.x * uAspect, uv.y);' +

        /* 两个独立的小火洞中心（左上偏中 + 右下） */
        'vec2 c1 = vec2(0.36 * uAspect, 0.37);' +
        'vec2 c2 = vec2(0.68 * uAspect, 0.66);' +

        /* 细腻锯齿纸边噪声 */
        'float nBase = fbm(p * 5.2) - 0.5;' +
        'float nFine = fbm(p * 16.0) - 0.5;' +
        'float jagged = nBase * 0.22 + nFine * 0.055;' +

        'float e1 = length(p - c1) - jagged - uProg1;' +
        'float e2 = length(p - c2) - jagged - uProg2;' +
        'float edge = min(e1, e2);' +

        /* 向上轻窜的细火舌噪声 */
        'float flameNoise = fbm(vec2(p.x * 18.0, p.y * 6.5 + uTime * 3.4));' +
        'float wisp = (flameNoise - 0.38) * 0.024;' +

        /* 烧穿区域：在火线外缘保留极细一缕向上飘的透明火焰，其余完全透出桌面 */
        'if (edge < 0.0) {' +
          'float outerFlame = smoothstep(-0.022 - max(0.0, wisp), 0.0, edge);' +
          'if (outerFlame < 0.03) {' +
            'gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);' +
            'return;' +
          '}' +
          /* 火焰外缘：淡红橘 + 局部幽蓝火芯 */
          'float blueSpot = smoothstep(0.56, 0.82, fbm(p * 11.0 + vec2(0.0, uTime * 2.2)));' +
          'vec3 warmTip = mix(vec3(0.95, 0.34, 0.24), vec3(1.0, 0.72, 0.42), outerFlame);' +
          'vec3 blueTip = vec3(0.34, 0.68, 1.0);' +
          'vec3 tipCol = mix(warmTip, blueTip, blueSpot * 0.55);' +
          'gl_FragColor = vec4(tipCol, outerFlame * 0.62);' +
          'return;' +
        '}' +

        /* 纸面色带：纯白纸 -> 烤深微微发茶的烘烤带 -> 极细锐利焦褐炭边 -> 蓝芯+橙红火线 */
        'float toastBand = 1.0 - smoothstep(0.014, 0.058, edge);' +
        'float crispChar = 1.0 - smoothstep(0.004, 0.016, edge);' +
        'float emberLine = 1.0 - smoothstep(0.0, 0.0085, edge);' +

        'float flicker = 0.78 + 0.22 * sin(uTime * 14.0 + flameNoise * 16.0);' +
        'float blueCore = smoothstep(0.52, 0.80, fbm(p * 12.5 - vec2(uTime * 0.8, -uTime * 1.6)));' +

        'vec3 col = paper.rgb;' +
        /* 仅在烧烤边缘把纸微微烤深一点（暖茶浅褐） */
        'col = mix(col, vec3(0.91, 0.86, 0.80), toastBand * 0.65);' +
        /* 锐利纤细的焦褐炭边（不糊黑） */
        'col = mix(col, vec3(0.24, 0.14, 0.09), crispChar * 0.92);' +
        /* 灼热火线：橘红明黄 + 一点点幽蓝火芯 */
        'vec3 warmFire = mix(vec3(0.92, 0.28, 0.14), vec3(1.0, 0.82, 0.46), smoothstep(0.008, 0.001, edge));' +
        'vec3 blueFire = vec3(0.36, 0.72, 1.0);' +
        'vec3 fireCol = mix(warmFire, blueFire, blueCore * 0.48);' +
        'col = mix(col, fireCol * (1.12 * flicker), emberLine * 0.96);' +

        'gl_FragColor = vec4(col, 1.0);' +
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
    var uProg1 = gl.getUniformLocation(prog, 'uProg1');
    var uProg2 = gl.getUniformLocation(prog, 'uProg2');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uAspect = gl.getUniformLocation(prog, 'uAspect');
    var uSeed = gl.getUniformLocation(prog, 'uSeed');

    var aspect = cssW / cssH;
    gl.uniform1i(uPaper, 0);
    gl.uniform1f(uAspect, aspect);
    gl.uniform1f(uSeed, Math.random() * 60.0);
    gl.viewport(0, 0, texW, texH);
    gl.clearColor(0, 0, 0, 0);

    /* 飘散灰烬 & 火星粒子系统 */
    var particles = [];
    var c1x = 0.36 * texW;
    var c1y = 0.37 * texH;
    var c2x = 0.68 * texW;
    var c2y = 0.66 * texH;

    function spawnFromHole(cx, cy, normR, count) {
      if (normR < -0.04 || normR > 1.05) return;
      var pxR = Math.max(4, (normR + 0.04) * texH);
      for (var i = 0; i < count; i++) {
        var ang = Math.random() * Math.PI * 2;
        var jitter = (Math.random() - 0.5) * 18 * dpr;
        var sx = cx + Math.cos(ang) * (pxR + jitter);
        var sy = cy + Math.sin(ang) * (pxR + jitter);
        if (sx < -20 || sx > texW + 20 || sy < -20 || sy > texH + 20) continue;

        var isEmber = Math.random() < 0.28;
        var isBlue = isEmber && Math.random() < 0.34;
        particles.push({
          x: sx,
          y: sy,
          vx: (Math.random() - 0.45) * 26 * dpr,
          vy: isEmber ? -(22 + Math.random() * 44) * dpr : (14 + Math.random() * 34) * dpr,
          size: isEmber ? (1.2 + Math.random() * 1.8) * dpr : (1.8 + Math.random() * 3.6) * dpr,
          aspect: 0.45 + Math.random() * 0.65,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 3.8,
          life: 0,
          maxLife: isEmber ? (0.55 + Math.random() * 0.65) : (0.95 + Math.random() * 1.15),
          isEmber: isEmber,
          isBlue: isBlue
        });
      }
    }

    function updateAndDrawAsh(dt, p1, p2) {
      if (!ashCtx) return;
      ashCtx.clearRect(0, 0, texW, texH);

      if (p1 > -0.05 && p1 < 0.95) spawnFromHole(c1x, c1y, p1, 2);
      if (p2 > -0.05 && p2 < 0.95) spawnFromHole(c2x, c2y, p2, 2);
      if (particles.length > 130) particles.splice(0, particles.length - 130);

      for (var i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        var ratio = pt.life / pt.maxLife;
        var fade = ratio < 0.15 ? (ratio / 0.15) : (1 - (ratio - 0.15) / 0.85);
        pt.x += pt.vx * dt + Math.sin(pt.life * 5.0 + pt.rot) * 10 * dpr * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vrot * dt;

        ashCtx.save();
        ashCtx.translate(pt.x, pt.y);
        ashCtx.rotate(pt.rot);
        if (pt.isEmber) {
          ashCtx.fillStyle = pt.isBlue
            ? ('rgba(105, 190, 255, ' + (fade * 0.9).toFixed(3) + ')')
            : ('rgba(255, 138, 66, ' + (fade * 0.92).toFixed(3) + ')');
          ashCtx.beginPath();
          ashCtx.arc(0, 0, pt.size, 0, Math.PI * 2);
          ashCtx.fill();
        } else {
          /* 不规则焦黑/炭灰小纸屑 */
          ashCtx.fillStyle = 'rgba(54, 44, 38, ' + (fade * 0.68).toFixed(3) + ')';
          ashCtx.beginPath();
          ashCtx.ellipse(0, 0, pt.size, pt.size * pt.aspect, 0, 0, Math.PI * 2);
          ashCtx.fill();
        }
        ashCtx.restore();
      }
    }

    var lastTs = performance.now();
    var elapsed = 0;
    var holdSec = 0.55;
    var burnSec = 4.25;

    function easeBurn(t) {
      /* 前半段慢烧欣赏两个小洞，后半段丝滑化开 */
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t < 0.55
        ? Math.pow(t / 0.55, 1.55) * 0.36
        : 0.36 + Math.pow((t - 0.55) / 0.45, 1.35) * 0.64;
    }

    function frame(now) {
      if (finished || !gl) return;
      var dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      elapsed += dt * speedBoost;

      var t1 = Math.max(0, (elapsed - holdSec) / burnSec);
      var t2 = Math.max(0, (elapsed - (holdSec + 0.55)) / (burnSec - 0.35));

      var prog1 = -0.15 + easeBurn(t1) * 1.48;
      var prog2 = -0.15 + easeBurn(t2) * 1.48;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uProg1, prog1);
      gl.uniform1f(uProg2, prog2);
      gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      updateAndDrawAsh(dt, prog1, prog2);

      if (t1 >= 1.0 && t2 >= 1.0) {
        finish(false);
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