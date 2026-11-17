/* apps/offline.js - 线下 App 首页与 Threads 剧情流房间 */
(function () {
  'use strict';

  var STORAGE_KEY = 'offline_threads_v1';
  var MSGS_PREFIX = 'offline_msgs_v1_';
  var appEl = document.getElementById('app-offline');
  if (!appEl) return;

  var state = {
    activeTab: 'messages',
    keyword: '',
    threads: [],
    currentThreadId: null,
    isGenerating: false,
    editingMsgIndex: -1
  };

  var toastTimer = null;

  var THREADS_LOGO_SVG =
    '<svg width="12" height="12" viewBox="0 0 192 192" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round">' +
      '<path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195145 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/>' +
    '</svg>';

  function formatDeviceTime(ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return m + '-' + day + ' ' + hh + ':' + mm;
  }

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

  function loadMessages(threadId) {
    if (!threadId) return [];
    try {
      var raw = localStorage.getItem(MSGS_PREFIX + threadId);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessages(threadId, msgs) {
    if (!threadId) return;
    try {
      localStorage.setItem(MSGS_PREFIX + threadId, JSON.stringify(msgs));
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

  function formatParagraphsHtml(text) {
    var lines = String(text || '').split(/\n+/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line) {
        out.push('<p>' + escapeHtml(line) + '</p>');
      }
    }
    return out.join('');
  }

  function showToast(text) {
    var toastEl = document.getElementById('ofToast');
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1800);
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
    document.body.classList.remove('of-kb-lock');
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

  function resolveBio(thread, msgSignature) {
    if (msgSignature) return String(msgSignature).trim();
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

  function getActionIconsHtml(liked, likeCount, commentCount, repostCount, shareCount, heartBtnAttr) {
    var heartSvg = liked
      ? '<svg width="18.5" height="18.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.4c-.4 0-.7-.1-1-.4C6.6 16.5 3.3 13.4 3.3 9.2c0-2.8 2.1-5 4.8-5 1.6 0 3 .8 3.9 2 .9-1.2 2.3-2 3.9-2 2.7 0 4.8 2.2 4.8 5 0 4.2-3.3 7.3-7.7 10.8-.3.3-.6.4-1 .4z"/></svg>'
      : '<svg width="18.5" height="18.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2c-.3 0-.6-.1-.8-.3C7 16.5 3.6 13.4 3.6 9.3c0-2.7 2-4.8 4.6-4.8 1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.6 0 4.6 2.1 4.6 4.8 0 4.1-3.4 7.2-7.6 10.6-.2.2-.5.3-.8.3z"/></svg>';

    return (
      '<button class="of-act-btn' + (liked ? ' is-liked' : '') + '"' + (heartBtnAttr || '') + ' type="button">' +
        heartSvg +
        (likeCount !== '' && likeCount != null ? '<span>' + likeCount + '</span>' : '') +
      '</button>' +
      '<button class="of-act-btn" type="button">' +
        '<svg width="18.5" height="18.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 3.8c-4.7 0-8.4 3.5-8.4 8 0 4.5 3.7 8.1 8.4 8.1 1.5 0 2.9-.4 4.1-1l3.1.9c.4.1.8-.3.7-.7l-.9-3c.8-1.2 1.3-2.7 1.3-4.3 0-4.5-3.7-8-8.3-8z"/>' +
        '</svg>' +
        (commentCount !== '' && commentCount != null ? '<span>' + commentCount + '</span>' : '') +
      '</button>' +
      '<button class="of-act-btn" type="button">' +
        '<svg width="18.5" height="18.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M5.5 9.5C6.8 6.4 9.5 4.8 12.7 4.8c3.1 0 5.5 1.5 6.8 4.1"/>' +
          '<path d="M4.5 6.2l.8 3.5 3.4-.8"/>' +
          '<path d="M18.5 14.5c-1.3 3.1-4 4.7-7.2 4.7-3.1 0-5.5-1.5-6.8-4.1"/>' +
          '<path d="M19.5 17.8l-.8-3.5-3.4.8"/>' +
        '</svg>' +
        (repostCount !== '' && repostCount != null ? '<span>' + repostCount + '</span>' : '') +
      '</button>' +
      '<button class="of-act-btn" type="button">' +
        '<svg width="18.5" height="18.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M20.2 11.2L5.8 4.8c-.9-.4-1.8.5-1.4 1.4l1.9 4.9c.2.5.2 1.2 0 1.7l-1.9 4.9c-.4.9.5 1.8 1.4 1.4l14.4-6.4c.7-.3.7-1.2 0-1.5z"/>' +
          '<line x1="6.4" y1="12" x2="12.8" y2="12"/>' +
        '</svg>' +
        (shareCount !== '' && shareCount != null ? '<span>' + shareCount + '</span>' : '') +
      '</button>'
    );
  }

  function renderCharBlockHtml(thread, msgData, idx) {
    var ch = getArchiveChar(thread.charId);
    var name = (ch && ch.name) || thread.name || '未命名';
    var avatarUrl = resolveAvatar(thread.charId, thread.avatar);
    var avatarHtml = avatarUrl
      ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" decoding="async">'
      : escapeHtml(name.slice(0, 1));

    var ts = msgData ? msgData.createdAt : thread.createdAt;
    var timeText = formatDeviceTime(ts);
    var bio = resolveBio(thread, msgData && msgData.signature);
    var bioHtml = bio
      ? '<div class="of-post-bio">' + escapeHtml(bio) + '</div>'
      : '<div class="of-post-bio is-empty">暂无签文</div>';

    var liked = msgData ? !!msgData.liked : !!thread.liked;
    var likes = msgData
      ? (typeof msgData.likes === 'number' ? msgData.likes : 1314)
      : (typeof thread.likes === 'number' ? thread.likes : 1314);

    var heartAttr = msgData ? ' data-like-msg="' + idx + '"' : ' id="ofLikeBtn"';
    var storyHtml = '';
    if (msgData && msgData.content) {
      storyHtml = '<div class="of-story-body">' + formatParagraphsHtml(msgData.content) + '</div>';
    } else if (!msgData) {
      storyHtml = '<div class="of-story-waiting">点右下角 GIF 即可生成剧情</div>';
    }

    return (
      '<section class="of-char-block">' +
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
              THREADS_LOGO_SVG +
              '<span>threads</span>' +
            '</div>' +
          '</div>' +
          bioHtml +
          '<div class="of-post-actions">' +
            getActionIconsHtml(liked, likes, 520, 28, 335, heartAttr) +
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
        storyHtml +
      '</section>'
    );
  }

  function renderUserCommentHtml(msgData, idx) {
    var timeText = formatDeviceTime(msgData.createdAt);
    var liked = !!msgData.liked;
    var likeVal = typeof msgData.likes === 'number' && msgData.likes > 0 ? msgData.likes : '';
    return (
      '<div class="of-user-comment">' +
        '<div class="of-cmt-avatar">我</div>' +
        '<div class="of-cmt-main">' +
          '<div class="of-cmt-top">' +
            '<div class="of-cmt-meta">' +
              '<span class="of-cmt-name">我</span>' +
              '<span class="of-cmt-time">' + escapeHtml(timeText) + '</span>' +
            '</div>' +
            '<div class="of-cmt-right-tools">' +
              '<button class="of-cmt-tool-btn" data-edit-msg="' + idx + '" type="button" aria-label="编辑">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
                  '<path d="M14 6l4 4"/>' +
                '</svg>' +
              '</button>' +
              '<button class="of-cmt-tool-btn" data-more-msg="' + idx + '" type="button" aria-label="删除">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">' +
                  '<circle cx="5.5" cy="12" r="1.75"/>' +
                  '<circle cx="12" cy="12" r="1.75"/>' +
                  '<circle cx="18.5" cy="12" r="1.75"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="of-cmt-text">' + escapeHtml(msgData.content || '') + '</div>' +
          '<div class="of-cmt-actions">' +
            getActionIconsHtml(liked, likeVal, '', '', '', ' data-like-msg="' + idx + '"') +
          '</div>' +
        '</div>' +
      '</div>'
    );
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
      var time = item.createdAt ? formatDeviceTime(item.createdAt) : (item.time || '');
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

  function scrollRoomToBottom(smooth) {
    var bodyEl = document.getElementById('ofRoomScroll');
    if (!bodyEl) return;
    bodyEl.scrollTo({
      top: bodyEl.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function renderRoom(thread, scrollToEnd) {
    var bodyEl = document.getElementById('ofRoomScroll');
    if (!bodyEl || !thread) return;

    var msgs = loadMessages(thread.id);
    var html = '';

    var hasAssistant = false;
    for (var checkIdx = 0; checkIdx < msgs.length; checkIdx++) {
      if (msgs[checkIdx].role === 'assistant') {
        hasAssistant = true;
        break;
      }
    }

    if (!msgs.length) {
      html = renderCharBlockHtml(thread, null, -1);
    } else {
      if (!hasAssistant) {
        html += renderCharBlockHtml(thread, {
          role: 'assistant',
          signature: thread.bio || '',
          content: '',
          createdAt: thread.createdAt,
          likes: thread.likes,
          liked: thread.liked
        }, -1);
      }
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        if (m.role === 'user') {
          html += renderUserCommentHtml(m, i);
        } else {
          html += renderCharBlockHtml(thread, m, i);
        }
      }
    }

    if (state.isGenerating) {
      var ch = getArchiveChar(thread.charId);
      var cname = (ch && ch.name) || thread.name || '对方';
      html +=
        '<div class="of-typing-bar">' +
          '<span>' + escapeHtml(cname) + ' 正在书写</span>' +
          '<span class="of-typing-dots"><span></span><span></span><span></span></span>' +
        '</div>';
    }

    bodyEl.innerHTML = html;

    var singleLikeBtn = document.getElementById('ofLikeBtn');
    if (singleLikeBtn) {
      bindPress(singleLikeBtn, function () {
        thread.liked = !thread.liked;
        thread.likes = (typeof thread.likes === 'number' ? thread.likes : 1314) + (thread.liked ? 1 : -1);
        saveThreads();
        renderRoom(thread, false);
      });
    }

    var msgLikeBtns = bodyEl.querySelectorAll('[data-like-msg]');
    for (var j = 0; j < msgLikeBtns.length; j++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-like-msg'), 10);
          if (idx < 0) {
            thread.liked = !thread.liked;
            thread.likes = (typeof thread.likes === 'number' ? thread.likes : 1314) + (thread.liked ? 1 : -1);
            saveThreads();
            renderRoom(thread, false);
            return;
          }
          var list = loadMessages(thread.id);
          var item = list[idx];
          if (!item) return;
          item.liked = !item.liked;
          if (item.role === 'user') {
            item.likes = item.liked ? ((item.likes || 0) + 1) : Math.max(0, (item.likes || 1) - 1);
          } else {
            item.likes = (typeof item.likes === 'number' ? item.likes : 1314) + (item.liked ? 1 : -1);
          }
          saveMessages(thread.id, list);
          renderRoom(thread, false);
        });
      })(msgLikeBtns[j]);
    }

    var editBtns = bodyEl.querySelectorAll('[data-edit-msg]');
    for (var eIdx = 0; eIdx < editBtns.length; eIdx++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-edit-msg'), 10);
          var list = loadMessages(thread.id);
          if (!list[idx]) return;
          openExpandModal(idx, list[idx].content || '');
        });
      })(editBtns[eIdx]);
    }

    var moreBtns = bodyEl.querySelectorAll('[data-more-msg]');
    for (var mIdx = 0; mIdx < moreBtns.length; mIdx++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-more-msg'), 10);
          var list = loadMessages(thread.id);
          if (!list[idx]) return;
          if (window.confirm('删除这条回复？')) {
            list.splice(idx, 1);
            saveMessages(thread.id, list);
            renderRoom(thread, false);
          }
        });
      })(moreBtns[mIdx]);
    }

    var otherBtns = bodyEl.querySelectorAll('.of-act-btn:not(#ofLikeBtn):not([data-like-msg])');
    for (var k = 0; k < otherBtns.length; k++) {
      bindPress(otherBtns[k]);
    }

    if (scrollToEnd) {
      scrollRoomToBottom(true);
    }
  }

  function findThread(threadId) {
    for (var i = 0; i < state.threads.length; i++) {
      if (state.threads[i].id === threadId) return state.threads[i];
    }
    return null;
  }

  function openRoom(threadId) {
    var target = findThread(threadId);
    if (!target) return;
    state.currentThreadId = threadId;
    renderRoom(target, false);
    var appInner = appEl.querySelector('.of-app');
    if (appInner) appInner.classList.add('is-in-room');
    var roomEl = document.getElementById('ofRoom');
    if (roomEl) {
      roomEl.classList.add('is-open');
    }
  }

  function closeRoom() {
    var input = document.getElementById('ofReplyInput');
    if (input) input.blur();
    document.body.classList.remove('of-kb-lock');
    var appInner = appEl.querySelector('.of-app');
    if (appInner) appInner.classList.remove('is-in-room');
    var roomEl = document.getElementById('ofRoom');
    if (roomEl) {
      roomEl.classList.remove('is-open');
      roomEl.style.top = '';
      roomEl.style.bottom = '';
      roomEl.style.height = '';
    }
    state.currentThreadId = null;
  }

  function sendUserComment(text) {
    var content = String(text || '').trim();
    if (!content || !state.currentThreadId) return;
    var thread = findThread(state.currentThreadId);
    if (!thread) return;

    var msgs = loadMessages(thread.id);
    var now = Date.now();
    msgs.push({
      id: 'om_' + now + '_' + Math.random().toString(36).slice(2, 6),
      role: 'user',
      content: content,
      createdAt: now,
      likes: 0,
      liked: false
    });
    saveMessages(thread.id, msgs);

    thread.preview = content;
    thread.createdAt = now;
    saveThreads();
    renderList();
    renderRoom(thread, true);
  }

  function parseReplyWithSignature(rawText, fallbackSig) {
    var text = String(rawText || '').trim();
    var sig = fallbackSig || '';
    var body = text;

    var sigMatch = text.match(/\[签文\]([\s\S]*?)\[\/签文\]/);
    if (sigMatch && sigMatch[1]) {
      sig = sigMatch[1].trim();
      body = body.replace(sigMatch[0], '').trim();
    }
    var bodyMatch = body.match(/\[正文\]([\s\S]*?)\[\/正文\]/);
    if (bodyMatch && bodyMatch[1]) {
      body = bodyMatch[1].trim();
    }
    if (!body) body = text;
    return { signature: sig, content: body };
  }

  function buildCharSystemPrompt(thread, msgs) {
    var ch = getArchiveChar(thread.charId);
    var parts = [];
    if (ch) {
      parts.push('角色名：' + (ch.name || thread.name || ''));
      if (ch.personality) parts.push('性格：' + ch.personality);
      if (ch.desc || ch.bio || ch.intro) parts.push('背景：' + (ch.desc || ch.bio || ch.intro));
      if (ch.signature) parts.push('默认签名：' + ch.signature);
    }

    if (window.PhonePresets && typeof window.PhonePresets.getActivePreset === 'function') {
      try {
        var preset = window.PhonePresets.getActivePreset();
        if (preset && preset.prompt) {
          parts.push(preset.prompt);
        }
      } catch (e) {}
    }

    if (window.PhoneLorebook && typeof window.PhoneLorebook.matchContext === 'function') {
      try {
        var recentText = msgs.slice(-4).map(function (m) { return m.content || ''; }).join('\n');
        var lore = window.PhoneLorebook.matchContext(recentText, thread.charId);
        if (lore) {
          parts.push('相关设定：\n' + (typeof lore === 'string' ? lore : JSON.stringify(lore)));
        }
      } catch (e) {}
    }

    if (window.PhoneMemory && typeof window.PhoneMemory.search === 'function') {
      try {
        var lastUser = '';
        for (var i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'user') {
            lastUser = msgs[i].content;
            break;
          }
        }
        var mems = window.PhoneMemory.search(lastUser || (ch && ch.name) || '', 4);
        if (Array.isArray(mems) && mems.length) {
          parts.push('相关记忆：\n' + mems.map(function (m) { return m.content || m.text || m; }).join('\n'));
        }
      } catch (e) {}
    }

    parts.push(
      '现在是「线下」长文剧情模式（Threads 串文界面）。请以第一或第三人称沉浸式描写当下线下互动的长段正文剧情。\n' +
      '请严格按以下格式输出（只输出一次，不要多余解释）：\n' +
      '[签文]一句贴合此刻心境或状态的短签文[/签文]\n' +
      '[正文]\n' +
      '这里写细腻、有画面感的线下长段正文剧情。\n' +
      '[/正文]'
    );

    return parts.join('\n\n');
  }

  function triggerCharReply() {
    if (state.isGenerating || !state.currentThreadId) return;
    var thread = findThread(state.currentThreadId);
    if (!thread) return;

    if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
      showToast('请先在 API App 配置接口');
      return;
    }

    var cfg = window.PhoneAPI.getConfig() || {};
    var baseUrl = String(cfg.url || cfg.baseUrl || cfg.endpoint || '').trim().replace(/\/+$/, '');
    var apiKey = String(cfg.key || cfg.apiKey || '').trim();
    var model = String(cfg.model || '').trim();

    if (!baseUrl || !apiKey || !model) {
      showToast('请先在 API App 填好接口与模型');
      return;
    }

    var endpoint = /\/chat\/completions$/i.test(baseUrl)
      ? baseUrl
      : (/\/v1$/i.test(baseUrl) ? baseUrl + '/chat/completions' : baseUrl + '/v1/chat/completions');

    var msgs = loadMessages(thread.id);
    var systemPrompt = buildCharSystemPrompt(thread, msgs);
    var apiMsgs = [{ role: 'system', content: systemPrompt }];
    var recent = msgs.slice(-12);
    for (var i = 0; i < recent.length; i++) {
      apiMsgs.push({
        role: recent[i].role === 'user' ? 'user' : 'assistant',
        content: recent[i].content || ''
      });
    }
    if (apiMsgs.length === 1) {
      apiMsgs.push({ role: 'user', content: '请开始一段线下相遇的开场剧情。' });
    }

    state.isGenerating = true;
    var gifBtn = document.getElementById('ofGifBtn');
    if (gifBtn) gifBtn.classList.add('is-loading');
    renderRoom(thread, true);

    var reqStart = Date.now();
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: apiMsgs,
        temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.85
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!raw) throw new Error('返回内容为空');
        var ch = getArchiveChar(thread.charId);
        var parsed = parseReplyWithSignature(raw, (ch && ch.signature) || thread.bio || '');
        var now = Date.now();
        var latestMsgs = loadMessages(thread.id);
        latestMsgs.push({
          id: 'om_' + now + '_' + Math.random().toString(36).slice(2, 6),
          role: 'assistant',
          signature: parsed.signature,
          content: parsed.content,
          createdAt: now,
          likes: 1314,
          liked: false
        });
        saveMessages(thread.id, latestMsgs);

        thread.bio = parsed.signature || thread.bio;
        thread.preview = parsed.content.replace(/\s+/g, ' ').slice(0, 36);
        thread.createdAt = now;
        saveThreads();
        renderList();

        if (typeof window.PhoneAPI.addLog === 'function') {
          try {
            window.PhoneAPI.addLog({
              app: 'offline',
              model: model,
              duration: Date.now() - reqStart,
              status: 'ok'
            });
          } catch (e) {}
        }
      })
      .catch(function (err) {
        showToast('生成失败：' + (err && err.message ? err.message : '请检查 API'));
        if (typeof window.PhoneAPI.addLog === 'function') {
          try {
            window.PhoneAPI.addLog({
              app: 'offline',
              model: model,
              duration: Date.now() - reqStart,
              status: 'error',
              error: err && err.message ? err.message : 'error'
            });
          } catch (e) {}
        }
      })
      .finally(function () {
        state.isGenerating = false;
        if (gifBtn) gifBtn.classList.remove('is-loading');
        if (state.currentThreadId === thread.id) {
          renderRoom(thread, true);
        }
      });
  }

  function openExpandModal(editIdx, presetText) {
    var mask = document.getElementById('ofExpandMask');
    var sheet = document.getElementById('ofExpandSheet');
    var area = document.getElementById('ofExpandTextarea');
    var titleEl = document.getElementById('ofExpandTitle');
    var sendBtn = document.getElementById('ofExpandSend');
    var inlineInput = document.getElementById('ofReplyInput');
    if (!mask || !sheet || !area) return;

    if (typeof editIdx === 'number' && editIdx >= 0) {
      state.editingMsgIndex = editIdx;
      area.value = presetText || '';
      if (titleEl) titleEl.textContent = '编辑回复';
      if (sendBtn) sendBtn.textContent = '保存';
    } else {
      state.editingMsgIndex = -1;
      area.value = inlineInput ? (inlineInput.value || '') : '';
      if (titleEl) titleEl.textContent = '回复剧情';
      if (sendBtn) sendBtn.textContent = '发送';
    }

    mask.classList.add('is-open');
    sheet.classList.add('is-open');
    setTimeout(function () {
      area.focus();
    }, 220);
  }

  function closeExpandModal() {
    var mask = document.getElementById('ofExpandMask');
    var sheet = document.getElementById('ofExpandSheet');
    var area = document.getElementById('ofExpandTextarea');
    if (area) area.blur();
    if (mask) mask.classList.remove('is-open');
    if (sheet) sheet.classList.remove('is-open');
    state.editingMsgIndex = -1;
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
    var now = Date.now();
    var newThread = {
      id: 'of_' + now + '_' + Math.random().toString(36).slice(2, 6),
      charId: ch.id,
      name: ch.name || '未命名',
      avatar: resolveAvatar(ch.id, ch.avatar),
      bio: bio,
      preview: bio || '点击进入线下',
      createdAt: now,
      likes: 1314,
      liked: false
    };
    state.threads.unshift(newThread);
    saveThreads();
    renderList();
    openRoom(newThread.id);
  }

  function syncKeyboardViewport() {
    var roomEl = document.getElementById('ofRoom');
    if (!roomEl || !roomEl.classList.contains('is-open')) return;
    var vv = window.visualViewport;
    if (!vv) return;

    if (window.innerHeight - vv.height > 80) {
      document.body.classList.add('of-kb-lock');
      window.scrollTo(0, 0);
      var rect = appEl.getBoundingClientRect();
      var scale = rect.height > 0 && appEl.offsetHeight > 0 ? rect.height / appEl.offsetHeight : 1;
      var topOffset = vv.offsetTop || 0;
      var availH = (vv.height - Math.max(0, rect.top - topOffset)) / scale;
      roomEl.style.top = '0';
      roomEl.style.bottom = 'auto';
      roomEl.style.height = Math.max(220, Math.round(availH)) + 'px';
      scrollRoomToBottom(false);
    } else {
      document.body.classList.remove('of-kb-lock');
      roomEl.style.top = '';
      roomEl.style.bottom = '';
      roomEl.style.height = '';
    }
  }

  function setupKeyboardViewport() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', syncKeyboardViewport);
    window.visualViewport.addEventListener('scroll', function () {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      syncKeyboardViewport();
    });
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
                '<input class="of-reply-input" id="ofReplyInput" type="text" enterkeyhint="send" placeholder="添加回复..." autocomplete="off">' +
              '</div>' +
              '<div class="of-reply-icons">' +
                '<button class="of-reply-icon-btn" id="ofDecoImgBtn" type="button" aria-label="图片">' +
                  '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                    '<rect x="3" y="3" width="18" height="18" rx="5"/>' +
                    '<circle cx="8.3" cy="8.5" r="1.35" fill="currentColor" stroke="none"/>' +
                    '<path d="M3.2 15.8c1.8-1.5 4.2-1.5 6 0 2.5-3.4 6.8-4.5 11.6-2.4"/>' +
                  '</svg>' +
                '</button>' +
                '<button class="of-reply-icon-btn" id="ofDecoStickerBtn" type="button" aria-label="贴纸">' +
                  '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M13.2 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-5.2L13.2 3z"/>' +
                    '<path d="M13 3.2V8a3 3 0 0 0 3 3h4.8"/>' +
                    '<circle cx="8.6" cy="11.2" r="1.35" fill="currentColor" stroke="none"/>' +
                    '<path d="M8.5 15c1.3 1.7 4.5 1.7 5.8 0"/>' +
                  '</svg>' +
                '</button>' +
                '<button class="of-reply-icon-btn" id="ofGifBtn" type="button" aria-label="触发对方回复">' +
                  '<svg width="23" height="23" viewBox="0 0 24 24" fill="none">' +
                    '<rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" stroke-width="2.2"/>' +
                    '<path d="M9.6 10.2C9.6 8.8 8.8 8 7.5 8C6.2 8 5.5 8.9 5.5 10.4V13.6C5.5 15.1 6.2 16 7.5 16C8.8 16 9.6 15.1 9.6 13.7V11.8H7.5V13.1H8.2V13.7C8.2 14.3 8 14.7 7.5 14.7C7.1 14.7 6.9 14.3 6.9 13.6V10.4C6.9 9.7 7.1 9.3 7.5 9.3C7.9 9.3 8.1 9.6 8.2 10.2H9.6Z" fill="currentColor"/>' +
                    '<rect x="11.1" y="8" width="1.5" height="8" rx="0.6" fill="currentColor"/>' +
                    '<path d="M14.2 8H18V9.4H15.7V11.3H17.6V12.7H15.7V16H14.2V8Z" fill="currentColor"/>' +
                  '</svg>' +
                '</button>' +
                '<button class="of-reply-icon-btn" id="ofExpandBtn" type="button" aria-label="展开输入">' +
                  '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polyline points="14 3.8 20.2 3.8 20.2 10"/>' +
                    '<polyline points="10 20.2 3.8 20.2 3.8 14"/>' +
                    '<line x1="20.2" y1="3.8" x2="3.8" y2="20.2"/>' +
                  '</svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="of-expand-mask" id="ofExpandMask"></div>' +
        '<div class="of-expand-sheet" id="ofExpandSheet">' +
          '<div class="of-expand-header">' +
            '<button class="of-expand-cancel" id="ofExpandCancel" type="button">取消</button>' +
            '<span class="of-expand-title" id="ofExpandTitle">回复剧情</span>' +
            '<button class="of-expand-send" id="ofExpandSend" type="button">发送</button>' +
          '</div>' +
          '<textarea class="of-expand-textarea" id="ofExpandTextarea" placeholder="写下你的台词或行动..."></textarea>' +
        '</div>' +

        '<div class="of-sheet-mask" id="ofSheetMask"></div>' +
        '<div class="of-sheet" id="ofSheet">' +
          '<div class="of-sheet-header">' +
            '<span class="of-sheet-title">选择角色</span>' +
            '<button class="of-sheet-close" id="ofSheetClose" type="button">关闭</button>' +
          '</div>' +
          '<div class="of-sheet-body" id="ofSheetBody"></div>' +
        '</div>' +

        '<div class="of-toast" id="ofToast"></div>' +
      '</div>';

    var backBtn = document.getElementById('ofBackBtn');
    var composeBtn = document.getElementById('ofComposeBtn');
    var searchInput = document.getElementById('ofSearchInput');
    var searchClear = document.getElementById('ofSearchClear');
    var tabMessages = document.getElementById('ofTabMessages');
    var roomBackBtn = document.getElementById('ofRoomBackBtn');
    var roomMoreBtn = document.getElementById('ofRoomMoreBtn');
    var replyInput = document.getElementById('ofReplyInput');
    var decoImgBtn = document.getElementById('ofDecoImgBtn');
    var decoStickerBtn = document.getElementById('ofDecoStickerBtn');
    var gifBtn = document.getElementById('ofGifBtn');
    var expandBtn = document.getElementById('ofExpandBtn');
    var expandMask = document.getElementById('ofExpandMask');
    var expandCancel = document.getElementById('ofExpandCancel');
    var expandSend = document.getElementById('ofExpandSend');
    var expandArea = document.getElementById('ofExpandTextarea');
    var sheetMask = document.getElementById('ofSheetMask');
    var sheetClose = document.getElementById('ofSheetClose');

    bindPress(backBtn, closeOfflineApp);
    bindPress(composeBtn, openCharPicker);
    bindPress(roomBackBtn, closeRoom);
    bindPress(roomMoreBtn);
    bindPress(decoImgBtn);
    bindPress(decoStickerBtn);
    bindPress(gifBtn, triggerCharReply);
    bindPress(expandBtn, function () { openExpandModal(-1); });
    bindPress(expandCancel, closeExpandModal);
    bindPress(sheetClose, closeCharPicker);

    bindPress(expandSend, function () {
      if (!expandArea) return;
      var text = String(expandArea.value || '').trim();
      if (!text) return;
      if (state.editingMsgIndex >= 0 && state.currentThreadId) {
        var thread = findThread(state.currentThreadId);
        var list = loadMessages(state.currentThreadId);
        if (list[state.editingMsgIndex]) {
          list[state.editingMsgIndex].content = text;
          saveMessages(state.currentThreadId, list);
          closeExpandModal();
          if (thread) renderRoom(thread, false);
          return;
        }
      }
      if (replyInput) replyInput.value = '';
      closeExpandModal();
      sendUserComment(text);
    });

    if (expandMask) {
      expandMask.addEventListener('click', closeExpandModal);
    }

    if (sheetMask) {
      sheetMask.addEventListener('click', closeCharPicker);
    }

    if (replyInput) {
      replyInput.addEventListener('focus', function () {
        document.body.classList.add('of-kb-lock');
        setTimeout(syncKeyboardViewport, 60);
        setTimeout(syncKeyboardViewport, 280);
      });
      replyInput.addEventListener('blur', function () {
        setTimeout(syncKeyboardViewport, 80);
      });
      replyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          var val = replyInput.value;
          if (!String(val || '').trim()) return;
          replyInput.value = '';
          sendUserComment(val);
        }
      });
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
    setupKeyboardViewport();
  }

  var observer = new MutationObserver(function () {
    if (appEl.classList.contains('active')) {
      state.threads = loadThreads();
      renderList();
    } else {
      document.body.classList.remove('of-kb-lock');
    }
  });
  observer.observe(appEl, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('phone-archive-updated', function () {
    if (state.currentThreadId) {
      var thread = findThread(state.currentThreadId);
      if (thread) renderRoom(thread, false);
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
