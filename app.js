var phone = document.getElementById('phone');

function fitPhone() {
  if (window.navigator.standalone !== true) {
    phone.style.height = '';
    return;
  }
  var portrait = window.matchMedia('(orientation: portrait)').matches;
  var screenH = portrait
    ? Math.max(screen.width, screen.height)
    : Math.min(screen.width, screen.height);
  phone.style.height = Math.max(window.innerHeight, screenH) + 'px';
}

fitPhone();
window.addEventListener('resize', fitPhone);
window.addEventListener('orientationchange', fitPhone);
window.addEventListener('pageshow', fitPhone);
setTimeout(fitPhone, 300);
setTimeout(fitPhone, 1000);

window.PhoneDB = (function () {
  var dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open('XiaoShouJiDB', 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore('kv');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }
  return {
    get: function (key) {
      return open().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction('kv', 'readonly');
          var req = tx.objectStore('kv').get(key);
          req.onsuccess = function () { resolve(req.result || ''); };
          req.onerror = function () { resolve(''); };
        });
      }).catch(function () { return ''; });
    },
    set: function (key, val) {
      return open().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction('kv', 'readwrite');
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
          tx.objectStore('kv').put(val, key);
        });
      }).catch(function () {});
    },
    del: function (key) {
      return open().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction('kv', 'readwrite');
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
          tx.objectStore('kv').delete(key);
        });
      }).catch(function () {});
    }
  };
})();

window.applyHomeWallpaper = function (url) {
  var wp = document.getElementById('wallpaper');
  if (wp) wp.style.backgroundImage = url ? 'url("' + url + '")' : '';
};

window.applyLockWallpaper = function (url) {
  var lwp = document.getElementById('lockWallpaper');
  if (lwp) lwp.style.backgroundImage = url ? 'url("' + url + '")' : '';
};

window.applyCustomFont = function (buf, familyId) {
  if (!buf) {
    document.documentElement.style.removeProperty('--app-font');
    return;
  }
  var name = familyId || 'CustomUserFont';
  try {
    var face = new FontFace(name, buf);
    face.load().then(function (loaded) {
      document.fonts.add(loaded);
      document.documentElement.style.setProperty('--app-font', '"' + name + '", -apple-system, "PingFang SC", sans-serif');
    }).catch(function () {});
  } catch (e) {}
};

window.applyAppIcon = function (appId, url) {
  var icons = document.querySelectorAll('.app[data-app="' + appId + '"] .app-icon');
  icons.forEach(function (el) {
    var svg = el.querySelector('svg');
    if (url) {
      el.style.background = 'url("' + url + '") center/cover no-repeat';
      if (svg) svg.style.display = 'none';
      el.classList.add('has-custom-icon');
    } else {
      var def = el.getAttribute('data-default-icon') || '';
      if (def) {
        el.style.background = 'url("' + def + '") center/cover no-repeat';
        if (svg) svg.style.display = 'none';
        el.classList.add('has-custom-icon');
      } else {
        el.style.background = '#ffffff';
        if (svg) svg.style.display = '';
        el.classList.remove('has-custom-icon');
      }
    }
  });
};

window.applyHomeScreenIcon = function (url) {
  var link = document.querySelector('link[rel="apple-touch-icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    document.head.appendChild(link);
  }
  if (url) link.href = url;
  else link.removeAttribute('href');
};

(function initTheme() {
  var size = localStorage.getItem('phone_font_size');
  if (size) document.documentElement.style.setProperty('--app-font-size', size + 'px');
  PhoneDB.get('home_wallpaper').then(window.applyHomeWallpaper);
  PhoneDB.get('lock_wallpaper').then(window.applyLockWallpaper);
  PhoneDB.get('home_screen_icon').then(function (url) {
    if (url) window.applyHomeScreenIcon(url);
  });
  ['appearance', 'api', 'books', 'offline', 'archive', 'presets', 'lorebook', 'beautify', 'memory', 'takeout', 'appstore', 'games', 'shopping', 'chat', 'netflix', 'converter', 'imessage', 'photos', 'music', 'settings'].forEach(function (id) {
    PhoneDB.get('icon_' + id).then(function (url) {
      if (url) window.applyAppIcon(id, url);
    });
  });
  var activeFontId = localStorage.getItem('phone_active_font_id');
  if (activeFontId) {
    PhoneDB.get('font_' + activeFontId).then(function (buf) {
      if (buf) window.applyCustomFont(buf, activeFontId);
    });
  }
})();

(function initHomePages() {
  var pages = document.getElementById('homePages');
  var dots = document.querySelectorAll('#pageDots .page-dot');
  if (!pages || !dots.length) return;

  function syncDots() {
    var w = pages.clientWidth || 1;
    var idx = Math.round(pages.scrollLeft / w);
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
  }

  pages.addEventListener('scroll', syncDots, { passive: true });
  dots.forEach(function (d) {
    d.addEventListener('click', function () {
      var idx = parseInt(d.getAttribute('data-page'), 10) || 0;
      pages.scrollTo({ left: idx * (pages.clientWidth || 0), behavior: 'smooth' });
    });
  });
})();

(function initHomeJiggleAndDrag() {
  var LAYOUT_KEY = 'phone_home_layout_v1';
  var pagesEl = document.getElementById('homePages');
  var homeEl = document.getElementById('home');
  var dockEl = document.querySelector('.dock');
  if (!pagesEl || !homeEl || !dockEl) return;

  var grids = pagesEl.querySelectorAll('.home-page .grid');
  if (grids.length < 2) return;

  var APP_NAMES = {
    api: 'API',
    books: '图书',
    music: '音乐',
    archive: '档案',
    presets: '预设',
    lorebook: '世界书',
    memory: '记忆',
    takeout: '小团外卖',
    converter: '转换器',
    offline: '线下',
    beautify: '美化',
    photos: '照片',
    appstore: 'App Store',
    games: '游戏',
    shopping: '购物',
    chat: 'Chat',
    netflix: 'Netflix',
    settings: '设置',
    appearance: '外观',
    imessage: 'iMessage'
  };

  if (!document.getElementById('phone-drag-style')) {
    var st = document.createElement('style');
    st.id = 'phone-drag-style';
    st.textContent =
      '@keyframes phoneJiggleA {' +
        '0% { transform: rotate(-1.5deg) translateY(0px); }' +
        '50% { transform: rotate(1.5deg) translateY(-0.5px); }' +
        '100% { transform: rotate(-1.5deg) translateY(0px); }' +
      '}' +
      '@keyframes phoneJiggleB {' +
        '0% { transform: rotate(1.4deg) translateY(-0.5px); }' +
        '50% { transform: rotate(-1.4deg) translateY(0.5px); }' +
        '100% { transform: rotate(1.4deg) translateY(-0.5px); }' +
      '}' +
      '.home-pages { transition: padding-top 0.28s cubic-bezier(0.32,0.72,0,1); }' +
      '.home.is-editing .home-pages { padding-top: 26px; }' +
      '.home-pages.is-dragging-lock { overflow-x: hidden !important; }' +
      '.home .app { position: relative; transition: transform 0.2s cubic-bezier(0.32,0.72,0,1); }' +
      '.home.is-editing .app:nth-child(odd) { animation: phoneJiggleA 0.28s infinite ease-in-out; }' +
      '.home.is-editing .app:nth-child(even) { animation: phoneJiggleB 0.3s infinite ease-in-out -0.12s; }' +
      '.home.is-editing .app.is-drag-hidden { animation: none !important; opacity: 0.18; transform: scale(0.92); }' +
      '.app-minus-badge {' +
        'position: absolute; top: -5px; left: -5px; z-index: 6;' +
        'width: 20px; height: 20px; border-radius: 50%; border: none; padding: 0;' +
        'background: rgba(255, 255, 255, 0.92); color: #6e6e73;' +
        'box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);' +
        'display: flex; align-items: center; justify-content: center;' +
        'opacity: 0; pointer-events: none; transform: scale(0.4);' +
        'transition: transform 0.22s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease;' +
      '}' +
      '.home.is-editing .app-minus-badge { opacity: 1; pointer-events: auto; transform: scale(1); }' +
      '.app-minus-badge.is-pressed { transform: scale(0.82) !important; }' +
      '.home-edit-bar {' +
        'position: absolute; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 16px; right: 16px;' +
        'z-index: 40; display: flex; align-items: center; justify-content: space-between;' +
        'opacity: 0; pointer-events: none; transform: translateY(-8px) scale(0.95);' +
        'transition: transform 0.26s cubic-bezier(0.32,0.72,0,1), opacity 0.22s ease;' +
      '}' +
      '.home.is-editing .home-edit-bar { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }' +
      '.home-edit-pill {' +
        'width: 54px; height: 26px; padding: 0; border-radius: 999px;' +
        'border: 1px solid rgba(255,255,255,0.85);' +
        'background: linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.24) 100%);' +
        'box-shadow: 0 3px 10px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.85);' +
        'color: #ffffff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.22));' +
        'display: inline-flex; align-items: center; justify-content: center;' +
        'cursor: pointer; transition: transform 0.2s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease;' +
      '}' +
      '.home-edit-pill.is-pressed { transform: scale(0.88); opacity: 0.78; }' +
      '.home-edit-menu {' +
        'position: absolute; top: calc(env(safe-area-inset-top, 0px) + 36px); left: 16px; width: 216px;' +
        'z-index: 42; border-radius: 22px; overflow: hidden;' +
        'border: 1px solid rgba(255,255,255,0.88);' +
        'background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,245,248,0.88) 100%);' +
        'box-shadow: 0 16px 36px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.95);' +
        'transform-origin: top left; transform: scale(0.84); opacity: 0; pointer-events: none;' +
        'transition: transform 0.26s cubic-bezier(0.32,0.72,0,1), opacity 0.22s ease;' +
      '}' +
      '.home-edit-menu.is-open { transform: scale(1); opacity: 1; pointer-events: auto; }' +
      '.home-edit-menu-item {' +
        'width: 100%; height: 45px; padding: 0 16px; border: none;' +
        'border-bottom: 1px solid rgba(0,0,0,0.06); background: transparent;' +
        'color: #111111; font-family: inherit; font-size: 14.5px; font-weight: 500;' +
        'display: flex; align-items: center; gap: 12px; cursor: pointer;' +
        'transition: background-color 0.16s ease;' +
      '}' +
      '.home-edit-menu-item:last-child { border-bottom: none; }' +
      '.home-edit-menu-item.is-pressed { background: rgba(0,0,0,0.06); }' +
      '.home-toast {' +
        'position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 46px);' +
        'transform: translateX(-50%) translateY(-8px) scale(0.95);' +
        'padding: 8px 16px; border-radius: 999px; background: rgba(17,17,17,0.88); color: #ffffff;' +
        'font-size: 13px; font-weight: 500; z-index: 9999; opacity: 0; pointer-events: none;' +
        'transition: transform 0.24s cubic-bezier(0.32,0.72,0,1), opacity 0.24s ease;' +
      '}' +
      '.home-toast.is-show { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }' +
      '.app-drag-ghost { position: fixed; z-index: 9999; pointer-events: none; transform: scale(1.14); filter: drop-shadow(0 14px 24px rgba(0,0,0,0.26)); transition: transform 0.18s cubic-bezier(0.32,0.72,0,1); }' +
      '.dock .app-name { display: none; }';
    document.head.appendChild(st);
  }

  var editBar = document.createElement('div');
  editBar.className = 'home-edit-bar';
  editBar.innerHTML =
    '<button class="home-edit-pill" id="homeEditLeftBtn" type="button" aria-label="自定义">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M19.8 2.6a1.9 1.9 0 0 1 1.6 3.1l-7.2 7.2-3.1-3.1 7.2-7.2c.4-.4.9-.6 1.5 0zM9.9 11l3.1 3.1c-.4 1.6-1.4 3-2.9 3.9-1.7 1-3.7 1.1-5.6.9-.4 0-.7-.5-.4-.9.7-.9 1.2-2 1.2-3.1 0-1.9 1.7-3.6 4.6-3.9z"/>' +
      '</svg>' +
    '</button>' +
    '<button class="home-edit-pill" id="homeEditDoneBtn" type="button" aria-label="完成">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
    '</button>';
  homeEl.appendChild(editBar);

  var editMenu = document.createElement('div');
  editMenu.className = 'home-edit-menu';
  editMenu.id = 'homeEditMenu';
  editMenu.innerHTML =
    '<button class="home-edit-menu-item" data-edit-act="widget" type="button">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' +
      '<span>添加小组件</span>' +
    '</button>' +
    '<button class="home-edit-menu-item" data-edit-act="custom" type="button">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="9" y1="18" x2="15" y2="18"/></svg>' +
      '<span>自定义</span>' +
    '</button>' +
    '<button class="home-edit-menu-item" data-edit-act="wallpaper" type="button">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>' +
      '<span>编辑墙纸</span>' +
    '</button>' +
    '<button class="home-edit-menu-item" data-edit-act="pages" type="button">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="11" height="16" rx="2"/><path d="M19 8v10a2 2 0 0 1-2 2H9"/></svg>' +
      '<span>编辑页面</span>' +
    '</button>';
  homeEl.appendChild(editMenu);

  var toastEl = document.createElement('div');
  toastEl.className = 'home-toast';
  document.body.appendChild(toastEl);
  var toastTimer = null;

  function showHomeToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1600);
  }

  function bindBtnTap(el, onTap) {
    if (!el) return;
    var sx = 0;
    var sy = 0;
    var moved = false;
    var handledTouch = false;

    el.addEventListener('touchstart', function (e) {
      moved = false;
      handledTouch = false;
      if (e.touches && e.touches[0]) {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }
      el.classList.add('is-pressed');
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) {
        moved = true;
        el.classList.remove('is-pressed');
      }
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      el.classList.remove('is-pressed');
      if (!moved && typeof onTap === 'function') {
        handledTouch = true;
        e.preventDefault();
        e.stopPropagation();
        onTap(e);
      }
    }, { passive: false });

    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });

    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (handledTouch) {
        handledTouch = false;
        return;
      }
      if (typeof onTap === 'function') onTap(e);
    });
  }

  function ensureMinusBadges() {
    homeEl.querySelectorAll('.app[data-app]').forEach(function (appEl) {
      if (appEl.querySelector('.app-minus-badge')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-minus-badge';
      btn.setAttribute('aria-label', '移除');
      btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      bindBtnTap(btn, function () {
        var name = APP_NAMES[appEl.getAttribute('data-app')] || '应用';
        showHomeToast('「' + name + '」暂不支持移除');
      });
      appEl.appendChild(btn);
    });
  }

  function syncAppNameVisibility(appEl) {
    var id = appEl.getAttribute('data-app');
    var inDock = !!appEl.closest('.dock');
    var nameEl = appEl.querySelector('.app-name');
    if (inDock) {
      if (nameEl) nameEl.style.display = 'none';
    } else {
      if (!nameEl && APP_NAMES[id]) {
        nameEl = document.createElement('div');
        nameEl.className = 'app-name';
        nameEl.textContent = APP_NAMES[id];
        appEl.appendChild(nameEl);
      }
      if (nameEl) nameEl.style.display = '';
    }
  }

  function saveLayout() {
    try {
      var data = {
        page0: Array.from(grids[0].querySelectorAll('.app[data-app]')).map(function (el) { return el.getAttribute('data-app'); }),
        page1: Array.from(grids[1].querySelectorAll('.app[data-app]')).map(function (el) { return el.getAttribute('data-app'); }),
        dock: Array.from(dockEl.querySelectorAll('.app[data-app]')).map(function (el) { return el.getAttribute('data-app'); })
      };
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function applySavedLayout() {
    var raw = '';
    try {
      raw = localStorage.getItem(LAYOUT_KEY) || '';
    } catch (e) {}
    if (!raw) return;

    var data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!data || !Array.isArray(data.page0) || !Array.isArray(data.page1) || !Array.isArray(data.dock)) return;

    var allMap = {};
    homeEl.querySelectorAll('.app[data-app]').forEach(function (el) {
      allMap[el.getAttribute('data-app')] = el;
    });

    var used = {};
    function placeList(list, target) {
      list.forEach(function (id) {
        var el = allMap[id];
        if (el && !used[id]) {
          used[id] = true;
          target.appendChild(el);
          syncAppNameVisibility(el);
        }
      });
    }

    placeList(data.page0, grids[0]);
    placeList(data.page1, grids[1]);
    placeList(data.dock, dockEl);

    Object.keys(allMap).forEach(function (id) {
      if (!used[id]) {
        grids[1].appendChild(allMap[id]);
        syncAppNameVisibility(allMap[id]);
      }
    });
  }

  applySavedLayout();
  ensureMinusBadges();

  var isEditing = false;
  var holdTimer = null;
  var edgeTimer = null;
  var dragEl = null;
  var pendingDragEl = null;
  var ghostEl = null;
  var startX = 0;
  var startY = 0;
  var offsetX = 0;
  var offsetY = 0;
  var suppressClick = false;
  var currentEdge = 0;

  function enterEditMode() {
    if (isEditing) return;
    isEditing = true;
    homeEl.classList.add('is-editing');
    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
  }

  function exitEditMode() {
    isEditing = false;
    editMenu.classList.remove('is-open');
    homeEl.classList.remove('is-editing');
  }

  var leftEditBtn = document.getElementById('homeEditLeftBtn');
  var doneEditBtn = document.getElementById('homeEditDoneBtn');

  bindBtnTap(leftEditBtn, function () {
    editMenu.classList.toggle('is-open');
  });

  bindBtnTap(doneEditBtn, function () {
    exitEditMode();
  });

  editMenu.querySelectorAll('.home-edit-menu-item').forEach(function (btn) {
    bindBtnTap(btn, function () {
      var act = btn.getAttribute('data-edit-act');
      editMenu.classList.remove('is-open');
      if (act === 'widget') {
        showHomeToast('小组件功能敬请期待');
      } else if (act === 'custom' || act === 'wallpaper') {
        exitEditMode();
        var appScreen = document.getElementById('app-appearance');
        if (appScreen && appScreen.children.length > 0) {
          appScreen.classList.add('open');
        }
      } else if (act === 'pages') {
        showHomeToast('当前共 2 页桌面');
      }
    });
  });

  function clearTimers() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (edgeTimer) {
      clearTimeout(edgeTimer);
      edgeTimer = null;
    }
    currentEdge = 0;
  }

  function currentPageGrid() {
    var w = pagesEl.clientWidth || 1;
    var idx = Math.round(pagesEl.scrollLeft / w);
    return idx === 1 ? grids[1] : grids[0];
  }

  function startDrag(appEl, touchX, touchY) {
    dragEl = appEl;
    suppressClick = true;

    var rect = appEl.getBoundingClientRect();
    offsetX = touchX - rect.left;
    offsetY = touchY - rect.top;

    ghostEl = appEl.cloneNode(true);
    ghostEl.className = 'app app-drag-ghost';
    ghostEl.style.width = rect.width + 'px';
    ghostEl.style.left = rect.left + 'px';
    ghostEl.style.top = rect.top + 'px';
    document.body.appendChild(ghostEl);

    appEl.classList.add('is-drag-hidden');
    pagesEl.classList.add('is-dragging-lock');
  }

  function checkEdgeFlip(x) {
    var phoneRect = phone ? phone.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    var edge = 0;
    if (x < phoneRect.left + 32) edge = -1;
    else if (x > phoneRect.right - 32) edge = 1;

    if (edge === currentEdge) return;
    currentEdge = edge;
    if (edgeTimer) {
      clearTimeout(edgeTimer);
      edgeTimer = null;
    }
    if (edge !== 0) {
      edgeTimer = setTimeout(function () {
        if (!dragEl) return;
        var w = pagesEl.clientWidth || 0;
        var targetLeft = edge > 0 ? w : 0;
        pagesEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
        var targetGrid = edge > 0 ? grids[1] : grids[0];
        if (dragEl.parentElement !== targetGrid) {
          targetGrid.appendChild(dragEl);
          syncAppNameVisibility(dragEl);
        }
        currentEdge = 0;
      }, 420);
    }
  }

  function moveDrag(x, y) {
    if (!dragEl || !ghostEl) return;
    ghostEl.style.left = (x - offsetX) + 'px';
    ghostEl.style.top = (y - offsetY) + 'px';

    checkEdgeFlip(x);

    var dockRect = dockEl.getBoundingClientRect();
    var inDockArea = y >= dockRect.top - 12 && y <= dockRect.bottom + 20;
    var targetContainer = inDockArea ? dockEl : currentPageGrid();

    if (inDockArea && dragEl.parentElement !== dockEl && dockEl.querySelectorAll('.app[data-app]').length >= 4) {
      targetContainer = currentPageGrid();
    }

    if (dragEl.parentElement !== targetContainer) {
      targetContainer.appendChild(dragEl);
      syncAppNameVisibility(dragEl);
    }

    var items = Array.from(targetContainer.querySelectorAll('.app[data-app]')).filter(function (el) {
      return el !== dragEl;
    });

    var closest = null;
    var minDist = Infinity;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var d = Math.hypot(x - cx, y - cy);
      if (d < minDist) {
        minDist = d;
        closest = items[i];
      }
    }

    if (closest && minDist < 48) {
      var cr = closest.getBoundingClientRect();
      var before = x < (cr.left + cr.width / 2);
      if (before) {
        if (closest.previousElementSibling !== dragEl) {
          targetContainer.insertBefore(dragEl, closest);
        }
      } else {
        if (closest.nextElementSibling !== dragEl) {
          targetContainer.insertBefore(dragEl, closest.nextElementSibling);
        }
      }
    }
  }

  function endDrag() {
    clearTimers();
    pendingDragEl = null;
    if (dragEl) {
      dragEl.classList.remove('is-drag-hidden');
      syncAppNameVisibility(dragEl);
      dragEl = null;
      saveLayout();
    }
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
    pagesEl.classList.remove('is-dragging-lock');
    setTimeout(function () {
      suppressClick = false;
    }, 120);
  }

  homeEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    if (e.target.closest('.home-edit-bar') || e.target.closest('.home-edit-menu') || e.target.closest('.app-minus-badge')) {
      return;
    }
    editMenu.classList.remove('is-open');

    var appEl = e.target.closest('.app[data-app]');
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;

    if (isEditing && appEl) {
      pendingDragEl = appEl;
      return;
    }

    if (!isEditing && appEl) {
      clearTimers();
      holdTimer = setTimeout(function () {
        enterEditMode();
        startDrag(appEl, startX, startY);
      }, 360);
    }
  }, { passive: true });

  homeEl.addEventListener('touchmove', function (e) {
    if (pendingDragEl && !dragEl && e.touches.length === 1) {
      var dx1 = Math.abs(e.touches[0].clientX - startX);
      var dy1 = Math.abs(e.touches[0].clientY - startY);
      if (dx1 > 6 || dy1 > 6) {
        startDrag(pendingDragEl, e.touches[0].clientX, e.touches[0].clientY);
        pendingDragEl = null;
      }
    }

    if (!dragEl) {
      if (holdTimer && e.touches.length === 1) {
        var dx = Math.abs(e.touches[0].clientX - startX);
        var dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 8 || dy > 8) clearTimers();
      }
      return;
    }
    if (e.cancelable) e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  homeEl.addEventListener('touchend', endDrag);
  homeEl.addEventListener('touchcancel', endDrag);

  homeEl.addEventListener('click', function (e) {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (isEditing) {
      if (e.target.closest('.home-edit-bar') || e.target.closest('.home-edit-menu') || e.target.closest('.app-minus-badge')) {
        return;
      }
      if (!e.target.closest('.app[data-app]')) {
        exitEditMode();
      } else {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }, true);
})();

document.addEventListener('click', function (e) {
  var appBtn = e.target.closest('.app[data-app]');
  if (appBtn) {
    var id = 'app-' + appBtn.getAttribute('data-app');
    var screen = document.getElementById(id);
    if (screen && screen.children.length > 0) screen.classList.add('open');
    return;
  }
  var closeBtn = e.target.closest('[data-close-app]');
  if (closeBtn) {
    var parent = closeBtn.closest('.app-screen');
    if (parent) parent.classList.remove('open');
  }
});

(function initLockScreen() {
  var lock = document.getElementById('lockScreen');
  if (!lock) return;
  var lockTime = document.getElementById('lockTime');
  var lockDate = document.getElementById('lockDate');
  var weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function updateClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    lockTime.textContent = hh + ':' + mm;
    lockDate.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weeks[d.getDay()];
  }
  updateClock();
  setInterval(updateClock, 10000);

  window.showLockScreen = function () {
    updateClock();
    lock.style.transform = '';
    lock.classList.add('active');
  };

  if (localStorage.getItem('phone_lock_enabled') === '1') {
    window.showLockScreen();
  }

  var startY = 0;
  var dy = 0;
  lock.addEventListener('touchstart', function (e) {
    startY = e.touches[0].clientY;
    dy = 0;
    lock.style.transition = 'none';
  }, { passive: true });

  lock.addEventListener('touchmove', function (e) {
    dy = e.touches[0].clientY - startY;
    if (dy < 0) lock.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });

  lock.addEventListener('touchend', function () {
    lock.style.transition = 'transform 0.28s ease';
    if (dy < -70) {
      lock.style.transform = 'translateY(-100%)';
      setTimeout(function () {
        lock.classList.remove('active');
        lock.style.transform = '';
      }, 280);
    } else {
      lock.style.transform = '';
    }
  });
})();
