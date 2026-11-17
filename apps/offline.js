/* apps/offline.js - 线下 App 首页逻辑 */
(function () {
  'use strict';

  var STORAGE_KEY = 'offline_threads_v1';
  var appEl = document.getElementById('app-offline');
  if (!appEl) return;

  var state = {
    activeTab: 'messages',
    keyword: '',
    threads: []
  };

  var toastTimer = null;

  function loadThreads() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveThreads() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.threads));
      return true;
    } catch (e) {
      return false;
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bindPress(el, onTap) {
    if (!el) return;
    var pressed = false;
    var moved = false;
    var startX = 0;
    var startY = 0;

    el.addEventListener('touchstart', function (e) {
      pressed = true;
      moved = false;
      if (e.touches && e.touches[0]) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
      el.classList.add('is-pressed');
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!pressed || !e.touches || !e.touches[0]) return;
      var dx = Math.abs(e.touches[0].clientX - startX);
      var dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 8 || dy > 8) {
        moved = true;
        el.classList.remove('is-pressed');
      }
    }, { passive: true });

    el.addEventListener('touchend', function () {
      el.classList.remove('is-pressed');
      pressed = false;
    }, { passive: true });

    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
      pressed = false;
    }, { passive: true });

    el.addEventListener('mousedown', function () {
      el.classList.add('is-pressed');
    });
    el.addEventListener('mouseup', function () {
      el.classList.remove('is-pressed');
    });
    el.addEventListener('mouseleave', function () {
      el.classList.remove('is-pressed');
    });

    if (typeof onTap === 'function') {
      el.addEventListener('click', function (e) {
        if (moved) {
          moved = false;
          return;
        }
        onTap(e);
      });
    }
  }

  function showToast(text) {
    var toastEl = document.getElementById('ofToast');
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1500);
  }

  function closeOfflineApp() {
    if (typeof window.closeApp === 'function') {
      window.closeApp();
      return;
    }
    if (typeof window.goHome === 'function') {
      window.goHome();
      return;
    }
    appEl.classList.remove('active', 'open', 'show');
    var homeEl = document.getElementById('home');
    if (homeEl) {
      homeEl.classList.remove('hidden');
    }
  }

  function getDisplayThreads() {
    var list = state.threads;
    var kw = state.keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(function (item) {
      var name = String(item.name || '').toLowerCase();
      var preview = String(item.preview || '').toLowerCase();
      return name.indexOf(kw) !== -1 || preview.indexOf(kw) !== -1;
    });
  }

  function renderList() {
    var listEl = document.getElementById('ofListScroll');
    if (!listEl) return;

    var items = getDisplayThreads();
    if (!items.length) {
      var emptyText = state.keyword.trim() ? '没有找到相关记录' : '暂无私信';
      listEl.innerHTML =
        '<div class="of-empty">' +
          '<div class="of-empty-text">' + escapeHtml(emptyText) + '</div>' +
        '</div>';
      return;
    }

    var html = items.map(function (item) {
      var name = item.name || '未命名';
      var preview = item.preview || '';
      var time = item.time || '';
      var avatarUrl = item.avatar || '';
      if (!avatarUrl && item.charId && window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
        avatarUrl = window.PhoneArchive.getCharAvatar(item.charId) || '';
      }
      var avatarHtml = avatarUrl
        ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" decoding="async">'
        : escapeHtml(name.slice(0, 1));

      var metaHtml = '';
      if (preview && time) {
        metaHtml = '<span class="of-thread-preview">' + escapeHtml(preview) + '</span><span class="of-thread-time">· ' + escapeHtml(time) + '</span>';
      } else if (preview) {
        metaHtml = '<span class="of-thread-preview">' + escapeHtml(preview) + '</span>';
      } else if (time) {
        metaHtml = '<span class="of-thread-time">' + escapeHtml(time) + '</span>';
      }

      return (
        '<div class="of-thread-item" data-id="' + escapeHtml(item.id || '') + '">' +
          '<div class="of-avatar">' + avatarHtml + '</div>' +
          '<div class="of-thread-body">' +
            '<div class="of-thread-name">' + escapeHtml(name) + '</div>' +
            '<div class="of-thread-meta">' + metaHtml + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    listEl.innerHTML = html;

    var rows = listEl.querySelectorAll('.of-thread-item');
    for (var i = 0; i < rows.length; i++) {
      bindPress(rows[i]);
    }
  }

  function renderApp() {
    appEl.innerHTML =
      '<div class="of-app">' +
        '<header class="of-header">' +
          '<div class="of-header-left">' +
            '<button class="of-back-btn" id="ofBackBtn" type="button" aria-label="返回">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="15 18 9 12 15 6"></polyline>' +
              '</svg>' +
            '</button>' +
            '<h1 class="of-title">线下</h1>' +
          '</div>' +
          '<button class="of-save-btn" id="ofSaveBtn" type="button">保存</button>' +
        '</header>' +

        '<div class="of-search-wrap">' +
          '<div class="of-search-box">' +
            '<span class="of-search-icon">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="11" cy="11" r="8"></circle>' +
                '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
              '</svg>' +
            '</span>' +
            '<input class="of-search-input" id="ofSearchInput" type="search" placeholder="搜索" autocomplete="off">' +
            '<button class="of-search-clear" id="ofSearchClear" type="button" aria-label="清空搜索">×</button>' +
          '</div>' +
        '</div>' +

        '<main class="of-list-scroll" id="ofListScroll"></main>' +

        '<div class="of-tabbar-wrap">' +
          '<nav class="of-tabbar" id="ofTabbar" aria-label="线下导航">' +
            '<button class="of-tab-btn is-active" id="ofTabMessages" data-tab="messages" type="button" aria-label="私信">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">' +
                '<path d="M21.92 3.62a1.45 1.45 0 0 0-1.57-.26L3.1 10.67a1.45 1.45 0 0 0 .06 2.68l6.15 2.41 2.41 6.15a1.45 1.45 0 0 0 1.35.92h.03a1.45 1.45 0 0 0 1.33-.87l7.31-17.25a1.45 1.45 0 0 0-.82-1.09Z"></path>' +
              '</svg>' +
            '</button>' +
          '</nav>' +
        '</div>' +

        '<div class="of-toast" id="ofToast"></div>' +
      '</div>';

    var backBtn = document.getElementById('ofBackBtn');
    var saveBtn = document.getElementById('ofSaveBtn');
    var searchInput = document.getElementById('ofSearchInput');
    var searchClear = document.getElementById('ofSearchClear');
    var tabMessages = document.getElementById('ofTabMessages');

    bindPress(backBtn, closeOfflineApp);

    bindPress(saveBtn, function () {
      if (saveThreads()) {
        showToast('已保存');
      } else {
        showToast('保存失败');
      }
    });

    bindPress(tabMessages, function () {
      var tabs = document.querySelectorAll('#ofTabbar .of-tab-btn');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('is-active');
      }
      tabMessages.classList.add('is-active');
      state.activeTab = 'messages';
    });

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.keyword = searchInput.value || '';
        if (searchClear) {
          searchClear.classList.toggle('is-visible', state.keyword.length > 0);
        }
        renderList();
      });
    }

    bindPress(searchClear, function () {
      if (searchInput) searchInput.value = '';
      state.keyword = '';
      searchClear.classList.remove('is-visible');
      renderList();
    });

    renderList();
  }

  function init() {
    state.threads = loadThreads();
    renderApp();
  }

  var observer = new MutationObserver(function () {
    if (appEl.classList.contains('active')) {
      state.threads = loadThreads();
      renderList();
    }
  });
  observer.observe(appEl, { attributes: true, attributeFilter: ['class'] });

  window.PhoneOffline = {
    getThreads: function () {
      return state.threads.slice();
    },
    refresh: function () {
      state.threads = loadThreads();
      renderList();
    }
  };

  init();
})();
