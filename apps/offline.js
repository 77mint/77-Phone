/* apps/offline.js - 线下 App 首页与 Threads 1:1 房间 */
(function () {
  'use strict';

  var STORAGE_KEY = 'offline_threads_v1';
  var appEl = document.getElementById('app-offline');
  if (!appEl) return;

  var state = {
    activeTab: 'messages',
    keyword: '',
    threads: [],
    currentThreadId: null
  };

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
    } catch (e) {}
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

  function getArchiveChar(charId) {
    if (!charId || !window.PhoneArchive) return null;
    if (typeof window.PhoneArchive.getCharById === 'function') {
      return window.PhoneArchive.getCharById(charId) || null;
    }
    if (typeof window.PhoneArchive.getChars === 'function') {
      var list = window.PhoneArchive.getChars() || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === charId) return list[i];
      }
    }
    return null;
  }

  function resolveAvatar(charId, fallbackUrl) {
    if (fallbackUrl) return fallbackUrl;
    if (charId && window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      return window.PhoneArchive.getCharAvatar(charId) || '';
    }
    var ch = getArchiveChar(charId);
    return ch && ch.avatar ? ch.avatar : '';
  }

  function resolveBio(thread) {
    var ch = getArchiveChar(thread.charId);
    var bio = '';
    if (ch) {
      bio = ch.signature || ch.bio || ch.intro || ch.desc || ch.personality || '';
    }
    if (!bio && thread.bio) {
      bio = thread.bio;
    }
    return String(bio || '').trim();
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
      var avatarUrl = resolveAvatar(item.charId, item.avatar);
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
      (function (row) {
        bindPress(row, function () {
          var id = row.getAttribute('data-id');
          openRoom(id);
        });
      })(rows[i]);
    }
  }

  function renderRoom(thread) {
    var bodyEl = document.getElementById('ofRoomScroll');
    if (!bodyEl || !thread) return;

    var ch = getArchiveChar(thread.charId);
    var name = (ch && ch.name) || thread.name || '未命名';
    var timeText = thread.time || '12小时';
    var avatarUrl = resolveAvatar(thread.charId, thread.avatar);
    var avatarHtml = avatarUrl
      ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" decoding="async">'
      : escapeHtml(name.slice(0, 1));

    var bio = resolveBio(thread);
    var bioHtml = bio
      ? '<div class="of-post-bio">' + escapeHtml(bio) + '</div>'
      : '<div class="of-post-bio is-empty">暂无签名</div>';

    var likeCount = typeof thread.likes === 'number' ? thread.likes : 1314;
    var likedClass = thread.liked ? ' is-liked' : '';
    var heartSvg = thread.liked
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    bodyEl.innerHTML =
      '<div class="of-post">' +
        '<div class="of-post-top">' +
          '<div class="of-post-author">' +
            '<div class="of-post-avatar">' + avatarHtml + '</div>' +
            '<div class="of-post-name-row">' +
              '<div class="of-post-name">' + escapeHtml(name) + '</div>' +
              '<div class="of-post-time">' + escapeHtml(timeText) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="of-post-brand">' +
            '<svg width="10.5" height="10.5" viewBox="0 0 192 192" fill="currentColor">' +
              '<path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195145 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/>' +
            '</svg>' +
            '<span>threads</span>' +
          '</div>' +
        '</div>' +
        bioHtml +
        '<div class="of-post-actions">' +
          '<button class="of-act-btn' + likedClass + '" id="ofLikeBtn" type="button">' +
            heartSvg +
            '<span>' + likeCount + '</span>' +
          '</button>' +
          '<button class="of-act-btn" type="button">' +
            /* 尾巴在右下角的 Threads 评论气泡 */
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M3 11.5a8.5 8.5 0 0 0 .9 3.8 8.5 8.5 0 0 0 7.6 4.7 8.4 8.4 0 0 0 3.8-.9L21 21l-1.9-5.7a8.4 8.4 0 0 0 .9-3.8 8.5 8.5 0 0 0-4.7-7.6 8.4 8.4 0 0 0-3.8-.9h-.5a8.5 8.5 0 0 0-8 8v.5z"/>' +
            '</svg>' +
            '<span>520</span>' +
          '</button>' +
          '<button class="of-act-btn" type="button">' +
            /* 上下圆弧旋转的 Threads 转发图标 */
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4.5 9.5A8 8 0 0 1 18.5 7"/>' +
              '<polyline points="4 4.5 4 9.5 9 9.5"/>' +
              '<path d="M19.5 14.5A8 8 0 0 1 5.5 17"/>' +
              '<polyline points="20 19.5 20 14.5 15 14.5"/>' +
            '</svg>' +
            '<span>28</span>' +
          '</button>' +
          '<button class="of-act-btn" type="button">' +
            /* 水平向右带中线的 Threads 纸飞机图标 */
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4.4 4.6l16.2 6.8a.7.7 0 0 1 0 1.2L4.4 19.4a.7.7 0 0 1-.9-.8L5.3 12 3.5 5.4a.7.7 0 0 1 .9-.8z"/>' +
              '<line x1="5.3" y1="12" x2="20.6" y2="12"/>' +
            '</svg>' +
            '<span>335</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="of-sort-bar">' +
        '<div class="of-sort-left">' +
          '<span>最相关</span>' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="of-sort-right">' +
          '<span>查看动态</span>' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="of-room-placeholder"></div>';

    var likeBtn = document.getElementById('ofLikeBtn');
    bindPress(likeBtn, function () {
      thread.liked = !thread.liked;
      thread.likes = (typeof thread.likes === 'number' ? thread.likes : 1314) + (thread.liked ? 1 : -1);
      saveThreads();
      renderRoom(thread);
    });

    var otherBtns = bodyEl.querySelectorAll('.of-act-btn:not(#ofLikeBtn)');
    for (var i = 0; i < otherBtns.length; i++) {
      bindPress(otherBtns[i]);
    }
  }

  function openRoom(threadId) {
    var target = null;
    for (var i = 0; i < state.threads.length; i++) {
      if (state.threads[i].id === threadId) {
        target = state.threads[i];
        break;
      }
    }
    if (!target) return;
    state.currentThreadId = threadId;
    renderRoom(target);
    var roomEl = document.getElementById('ofRoom');
    if (roomEl) {
      roomEl.classList.add('is-open');
    }
  }

  function closeRoom() {
    var roomEl = document.getElementById('ofRoom');
    if (roomEl) {
      roomEl.classList.remove('is-open');
    }
    state.currentThreadId = null;
  }

  function openCharPicker() {
    var mask = document.getElementById('ofSheetMask');
    var sheet = document.getElementById('ofSheet');
    var body = document.getElementById('ofSheetBody');
    if (!mask || !sheet || !body) return;

    var chars = [];
    if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      chars = window.PhoneArchive.getChars() || [];
    }

    if (!chars.length) {
      body.innerHTML = '<div class="of-sheet-empty">档案里还没有角色，先去档案添加吧</div>';
    } else {
      body.innerHTML = chars.map(function (ch) {
        var name = ch.name || '未命名';
        var bio = ch.signature || ch.bio || ch.intro || ch.desc || '';
        var avatarUrl = resolveAvatar(ch.id, ch.avatar);
        var avatarHtml = avatarUrl
          ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" decoding="async">'
          : escapeHtml(name.slice(0, 1));
        return (
          '<div class="of-pick-item" data-char-id="' + escapeHtml(ch.id) + '">' +
            '<div class="of-pick-avatar">' + avatarHtml + '</div>' +
            '<div class="of-pick-info">' +
              '<div class="of-pick-name">' + escapeHtml(name) + '</div>' +
              (bio ? '<div class="of-pick-bio">' + escapeHtml(bio) + '</div>' : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      var pickItems = body.querySelectorAll('.of-pick-item');
      for (var i = 0; i < pickItems.length; i++) {
        (function (el) {
          bindPress(el, function () {
            var charId = el.getAttribute('data-char-id');
            closeCharPicker();
            ensureThreadForChar(charId);
          });
        })(pickItems[i]);
      }
    }

    mask.classList.add('is-open');
    sheet.classList.add('is-open');
  }

  function closeCharPicker() {
    var mask = document.getElementById('ofSheetMask');
    var sheet = document.getElementById('ofSheet');
    if (mask) mask.classList.remove('is-open');
    if (sheet) sheet.classList.remove('is-open');
  }

  function ensureThreadForChar(charId) {
    for (var i = 0; i < state.threads.length; i++) {
      if (state.threads[i].charId === charId) {
        openRoom(state.threads[i].id);
        return;
      }
    }
    var ch = getArchiveChar(charId);
    if (!ch) return;
    var bio = ch.signature || ch.bio || ch.intro || ch.desc || '';
    var newThread = {
      id: 'of_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      charId: ch.id,
      name: ch.name || '未命名',
      avatar: resolveAvatar(ch.id, ch.avatar),
      bio: bio,
      preview: bio || '点击进入线下',
      time: '刚刚',
      likes: 1314,
      liked: false
    };
    state.threads.unshift(newThread);
    saveThreads();
    renderList();
    openRoom(newThread.id);
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
          '<button class="of-compose-btn" id="ofComposeBtn" type="button" aria-label="新建">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
              '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>' +
            '</svg>' +
          '</button>' +
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

        '<div class="of-room" id="ofRoom">' +
          '<header class="of-room-header">' +
            '<button class="of-room-circle-btn" id="ofRoomBackBtn" type="button" aria-label="返回">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="15 19 8 12 15 5"></polyline>' +
              '</svg>' +
            '</button>' +
            '<div class="of-room-center">' +
              '<div class="of-room-title">Threads</div>' +
              '<div class="of-room-views">11.2万次浏览</div>' +
            '</div>' +
            '<button class="of-room-circle-btn" id="ofRoomMoreBtn" type="button" aria-label="更多">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
                '<circle cx="5.5" cy="12" r="1.75"></circle>' +
                '<circle cx="12" cy="12" r="1.75"></circle>' +
                '<circle cx="18.5" cy="12" r="1.75"></circle>' +
              '</svg>' +
            '</button>' +
          '</header>' +
          '<div class="of-room-scroll" id="ofRoomScroll"></div>' +
          '<div class="of-room-footer">' +
            '<div class="of-reply-pill">' +
              '<div class="of-reply-left">' +
                '<div class="of-reply-avatar">我</div>' +
                '<span class="of-reply-hint">添加回复...</span>' +
              '</div>' +
              '<div class="of-reply-icons">' +
                /* 1:1 图库：圆角方框 + 左上实心圆点 + 左低右高双圆弧山峰 */
                '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="3" y="3" width="18" height="18" rx="5"/>' +
                  '<circle cx="8.3" cy="8.5" r="1.35" fill="currentColor" stroke="none"/>' +
                  '<path d="M3.2 15.8c1.8-1.5 4.2-1.5 6 0 2.5-3.4 6.8-4.5 11.6-2.4"/>' +
                '</svg>' +
                /* 1:1 贴纸：右上大折角 + 仅左侧单眼圆点 + 居中微笑弧线 */
                '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M13.2 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-5.2L13.2 3z"/>' +
                  '<path d="M13 3.2V8a3 3 0 0 0 3 3h4.8"/>' +
                  '<circle cx="8.6" cy="11.2" r="1.35" fill="currentColor" stroke="none"/>' +
                  '<path d="M8.5 15c1.3 1.7 4.5 1.7 5.8 0"/>' +
                '</svg>' +
                /* 1:1 GIF：圆角方框 + 高瘦粗体矢量 GIF 路径 */
                '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
                  '<rect x="3" y="3" width="18" height="18" rx="5" stroke-width="2.3"/>' +
                  '<path d="M10.1 10.1A2 2 0 0 0 6.5 11.4v1.2a2 2 0 0 0 3.6 0V12H8.6" stroke-width="1.85"/>' +
                  '<line x1="12.35" y1="9.3" x2="12.35" y2="14.7" stroke-width="1.85"/>' +
                  '<path d="M14.7 14.7V9.3h2.8M14.7 12h2.1" stroke-width="1.85"/>' +
                '</svg>' +
                /* 1:1 全屏斜向双箭头 */
                '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">' +
                  '<polyline points="14 3.8 20.2 3.8 20.2 10"/>' +
                  '<polyline points="10 20.2 3.8 20.2 3.8 14"/>' +
                  '<line x1="20.2" y1="3.8" x2="3.8" y2="20.2"/>' +
                '</svg>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="of-sheet-mask" id="ofSheetMask"></div>' +
        '<div class="of-sheet" id="ofSheet">' +
          '<div class="of-sheet-header">' +
            '<span class="of-sheet-title">选择角色</span>' +
            '<button class="of-sheet-close" id="ofSheetClose" type="button">关闭</button>' +
          '</div>' +
          '<div class="of-sheet-body" id="ofSheetBody"></div>' +
        '</div>' +
      '</div>';

    var backBtn = document.getElementById('ofBackBtn');
    var composeBtn = document.getElementById('ofComposeBtn');
    var searchInput = document.getElementById('ofSearchInput');
    var searchClear = document.getElementById('ofSearchClear');
    var tabMessages = document.getElementById('ofTabMessages');
    var roomBackBtn = document.getElementById('ofRoomBackBtn');
    var roomMoreBtn = document.getElementById('ofRoomMoreBtn');
    var sheetMask = document.getElementById('ofSheetMask');
    var sheetClose = document.getElementById('ofSheetClose');

    bindPress(backBtn, closeOfflineApp);
    bindPress(composeBtn, openCharPicker);
    bindPress(roomBackBtn, closeRoom);
    bindPress(roomMoreBtn);
    bindPress(sheetClose, closeCharPicker);

    if (sheetMask) {
      sheetMask.addEventListener('click', closeCharPicker);
    }

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

  window.addEventListener('phone-archive-updated', function () {
    if (state.currentThreadId) {
      for (var i = 0; i < state.threads.length; i++) {
        if (state.threads[i].id === state.currentThreadId) {
          renderRoom(state.threads[i]);
          break;
        }
      }
    }
  });

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