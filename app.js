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

(function initHomeDragSort() {
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
      '.home-pages.is-dragging-lock { overflow-x: hidden !important; }' +
      '.app.is-drag-hidden { opacity: 0.2; transform: scale(0.92); transition: transform 0.18s cubic-bezier(0.32,0.72,0,1), opacity 0.18s ease; }' +
      '.app-drag-ghost { position: fixed; z-index: 9999; pointer-events: none; transform: scale(1.14); filter: drop-shadow(0 14px 24px rgba(0,0,0,0.26)); transition: transform 0.18s cubic-bezier(0.32,0.72,0,1); }' +
      '.dock .app-name { display: none; }';
    document.head.appendChild(st);
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

  function getContainers() {
    return [grids[0], grids[1], dockEl];
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

  var holdTimer = null;
  var edgeTimer = null;
  var dragEl = null;
  var ghostEl = null;
  var startX = 0;
  var startY = 0;
  var offsetX = 0;
  var offsetY = 0;
  var suppressClick = false;
  var currentEdge = 0;

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

    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
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
    var appEl = e.target.closest('.app[data-app]');
    if (!appEl) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    clearTimers();
    holdTimer = setTimeout(function () {
      startDrag(appEl, startX, startY);
    }, 360);
  }, { passive: true });

  homeEl.addEventListener('touchmove', function (e) {
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
