/* apps/chat-details.js - 微信 Chat 聊天室右上角「···」详情页（全局 #f2f2f7 + 纯白卡片） */
(function () {
  'use strict';

  var SETTINGS_KEY = 'chat_thread_settings_v1';
  var THREADS_KEY = 'chat_threads_v1';
  var MSGS_PREFIX = 'chat_msgs_v1_';

  var activeThreadId = null;
  var lastContactId = null;
  var detailsEl = null;
  var searchEl = null;

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function getAllSettings() {
    return loadJSON(SETTINGS_KEY, {});
  }

  function getThreadSettings(threadId) {
    var all = getAllSettings();
    return Object.assign({ pinned: false, muted: false, hasBg: false }, all[threadId] || {});
  }

  function setThreadSettings(threadId, patch) {
    if (!threadId) return;
    var all = getAllSettings();
    all[threadId] = Object.assign({ pinned: false, muted: false, hasBg: false }, all[threadId] || {}, patch);
    saveJSON(SETTINGS_KEY, all);
  }

  function getThreads() {
    if (window.PhoneChat && typeof window.PhoneChat.getThreads === 'function') {
      return window.PhoneChat.getThreads() || [];
    }
    return loadJSON(THREADS_KEY, []);
  }

  function getArchiveChars() {
    if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      return window.PhoneArchive.getChars() || [];
    }
    return [];
  }

  function getCharAvatar(charObj) {
    if (!charObj) return '';
    if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      return window.PhoneArchive.getCharAvatar(charObj.id) || charObj.avatar || '';
    }
    return charObj.avatar || '';
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
    var sx = 0, sy = 0, moved = false;
    el.addEventListener('touchstart', function (e) {
      moved = false;
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
    el.addEventListener('touchend', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });
    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });
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

  function resolveCurrentThread() {
    var threads = getThreads();
    if (activeThreadId) {
      var hit = threads.find(function (t) { return t.id === activeThreadId; });
      if (hit) return hit;
    }
    var titleEl = document.getElementById('ctRoomTitle');
    var titleText = titleEl ? titleEl.textContent.trim() : '';
    if (titleText) {
      var chars = getArchiveChars();
      var byTitle = threads.find(function (t) {
        if (t.type === 'dm') {
          var c = chars.find(function (item) { return item.id === t.charId; });
          var cname = c ? (c.name || c.nickname || '') : (t.name || '');
          return cname === titleText;
        }
        return (t.name || '') === titleText;
      });
      if (byTitle) {
        activeThreadId = byTitle.id;
        return byTitle;
      }
    }
    return null;
  }

  function applyRoomBackground(threadId) {
    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    if (!threadId || !window.PhoneDB) {
      box.style.backgroundImage = '';
      box.style.backgroundSize = '';
      box.style.backgroundPosition = '';
      return;
    }
    window.PhoneDB.get('chat_bg_' + threadId).then(function (url) {
      if (url) {
        box.style.backgroundImage = 'url("' + url + '")';
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
      } else {
        box.style.backgroundImage = '';
        box.style.backgroundSize = '';
        box.style.backgroundPosition = '';
      }
    });
  }

  function showChatToast(msg) {
    var el = document.getElementById('ctToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showChatToast._t);
    showChatToast._t = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  function ensureDOM() {
    var appContainer = document.querySelector('#app-chat .ct-app');
    if (!appContainer) return false;

    if (!document.getElementById('ctDetailsView')) {
      detailsEl = document.createElement('div');
      detailsEl.id = 'ctDetailsView';
      detailsEl.className = 'ct-details-view';
      detailsEl.innerHTML =
        '<div class="ct-details-topbar">' +
          '<div class="ct-details-topbar-left">' +
            '<button class="ct-details-back" id="ctDetailsBackBtn" type="button" aria-label="返回">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="ct-details-title">聊天详情</h1>' +
          '</div>' +
        '</div>' +
        '<div class="ct-details-scroll" id="ctDetailsScroll"></div>' +
        '<input type="file" id="ctDetailsBgFile" accept="image/*" style="display:none" />';
      appContainer.appendChild(detailsEl);

      bindPress(document.getElementById('ctDetailsBackBtn'), closeDetails);

      var bgInput = document.getElementById('ctDetailsBgFile');
      bgInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file || !activeThreadId) return;
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          if (window.PhoneDB && dataUrl) {
            window.PhoneDB.set('chat_bg_' + activeThreadId, dataUrl).then(function () {
              setThreadSettings(activeThreadId, { hasBg: true });
              applyRoomBackground(activeThreadId);
              renderDetailsBody();
              showChatToast('已更换聊天背景');
            });
          }
        };
        reader.readAsDataURL(file);
        bgInput.value = '';
      });
    } else {
      detailsEl = document.getElementById('ctDetailsView');
    }

    if (!document.getElementById('ctDetailsSearchView')) {
      searchEl = document.createElement('div');
      searchEl.id = 'ctDetailsSearchView';
      searchEl.className = 'ct-dt-search-view';
      searchEl.innerHTML =
        '<div class="ct-details-topbar">' +
          '<div class="ct-details-topbar-left">' +
            '<button class="ct-details-back" id="ctDtSearchBackBtn" type="button" aria-label="返回">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="ct-details-title">查找聊天记录</h1>' +
          '</div>' +
        '</div>' +
        '<div class="ct-dt-search-box-wrap">' +
          '<div class="ct-dt-search-box">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input class="ct-dt-search-input" id="ctDtSearchInput" type="search" placeholder="输入关键词搜索消息" autocomplete="off" />' +
          '</div>' +
        '</div>' +
        '<div class="ct-dt-search-list" id="ctDtSearchList"></div>';
      appContainer.appendChild(searchEl);

      bindPress(document.getElementById('ctDtSearchBackBtn'), function () {
        searchEl.classList.remove('is-open');
      });

      document.getElementById('ctDtSearchInput').addEventListener('input', renderSearchResults);
    } else {
      searchEl = document.getElementById('ctDetailsSearchView');
    }

    return true;
  }

  function renderDetailsBody() {
    var scroll = document.getElementById('ctDetailsScroll');
    if (!scroll) return;

    var thread = resolveCurrentThread();
    if (!thread) {
      scroll.innerHTML = '<div class="ct-dt-empty">未找到当前会话信息</div>';
      return;
    }

    var chars = getArchiveChars();
    var isGroup = thread.type === 'group';
    var settings = getThreadSettings(thread.id);

    var profileCardHtml = '';
    if (!isGroup) {
      var c = chars.find(function (item) { return item.id === thread.charId; });
      var cname = c ? (c.name || c.nickname || '未命名') : (thread.name || '未命名');
      var av = getCharAvatar(c);
      var bio = (c && (c.persona || c.bio || c.signature)) || '暂无简介';
      var avHtml = av ? '<img src="' + escapeHtml(av) + '" alt="" />' : escapeHtml(cname.slice(0, 1));
      profileCardHtml =
        '<div class="ct-dt-card">' +
          '<div class="ct-dt-profile">' +
            '<div class="ct-dt-avatar">' + avHtml + '</div>' +
            '<div class="ct-dt-profile-info">' +
              '<div class="ct-dt-name">' + escapeHtml(cname) + '</div>' +
              '<div class="ct-dt-bio">' + escapeHtml(bio) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    } else {
      var members = (thread.memberIds || []).map(function (id) {
        return chars.find(function (item) { return item.id === id; });
      }).filter(Boolean);
      var membersHtml = members.map(function (m) {
        var mName = m.name || m.nickname || '成员';
        var mAv = getCharAvatar(m);
        return (
          '<div class="ct-dt-member">' +
            '<div class="ct-dt-member-av">' + (mAv ? '<img src="' + escapeHtml(mAv) + '" alt="" />' : escapeHtml(mName.slice(0, 1))) + '</div>' +
            '<div class="ct-dt-member-name">' + escapeHtml(mName) + '</div>' +
          '</div>'
        );
      }).join('');

      profileCardHtml =
        '<div class="ct-dt-card">' +
          '<div class="ct-dt-row">' +
            '<div class="ct-dt-row-label">群聊名称</div>' +
            '<div style="flex:1;min-width:0;margin-left:12px;">' +
              '<input class="ct-dt-inline-input" id="ctDtGroupNameInput" type="text" value="' + escapeHtml(thread.name || '') + '" placeholder="输入群聊名称" />' +
            '</div>' +
          '</div>' +
          '<div class="ct-dt-members">' + membersHtml + '</div>' +
        '</div>';
    }

    var presetName = '未设置';
    if (window.PhonePresets && typeof window.PhonePresets.getActivePreset === 'function') {
      var p = window.PhonePresets.getActivePreset('online');
      if (p && p.name) presetName = p.name;
    }

    var chevronSvg = '<svg class="ct-dt-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';

    scroll.innerHTML =
      profileCardHtml +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtSearchRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">查找聊天记录</div></div>' +
          '<div class="ct-dt-row-right">' + chevronSvg + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtPinRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">置顶聊天</div></div>' +
          '<button class="ct-dt-switch' + (settings.pinned ? ' is-on' : '') + '" id="ctDtPinSwitch" type="button" aria-label="置顶聊天"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtMuteRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">消息免打扰</div></div>' +
          '<button class="ct-dt-switch' + (settings.muted ? ' is-on' : '') + '" id="ctDtMuteSwitch" type="button" aria-label="消息免打扰"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtBgRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">聊天背景</div>' +
            '<div class="ct-dt-row-sub">' + (settings.hasBg ? '已设置自定义背景' : '默认纯色背景') + '</div>' +
          '</div>' +
          '<div class="ct-dt-row-right">' + chevronSvg + '</div>' +
        '</div>' +
        (settings.hasBg ? (
          '<div class="ct-dt-row" id="ctDtResetBgRow">' +
            '<div class="ct-dt-row-left"><div class="ct-dt-row-label">恢复默认背景</div></div>' +
          '</div>'
        ) : '') +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">当前线上预设</div>' +
            '<div class="ct-dt-row-sub">在「预设」App 中切换</div>' +
          '</div>' +
          '<div class="ct-dt-row-right"><span>' + escapeHtml(presetName) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<button class="ct-dt-danger-btn" id="ctDtClearBtn" type="button">清空聊天记录</button>' +
      '</div>';

    var groupInput = document.getElementById('ctDtGroupNameInput');
    if (groupInput) {
      groupInput.addEventListener('change', function () {
        var nextName = groupInput.value.trim();
        if (!nextName) return;
        var list = loadJSON(THREADS_KEY, []);
        var idx = list.findIndex(function (t) { return t.id === thread.id; });
        if (idx !== -1) {
          list[idx].name = nextName;
          saveJSON(THREADS_KEY, list);
          var roomTitle = document.getElementById('ctRoomTitle');
          if (roomTitle) roomTitle.textContent = nextName;
          showChatToast('群聊名称已更新');
        }
      });
    }

    bindPress(document.getElementById('ctDtSearchRow'), function () {
      var inp = document.getElementById('ctDtSearchInput');
      if (inp) inp.value = '';
      renderSearchResults();
      searchEl.classList.add('is-open');
    });

    bindPress(document.getElementById('ctDtPinRow'), function () {
      var cur = getThreadSettings(thread.id);
      setThreadSettings(thread.id, { pinned: !cur.pinned });
      renderDetailsBody();
    });

    bindPress(document.getElementById('ctDtMuteRow'), function () {
      var cur = getThreadSettings(thread.id);
      setThreadSettings(thread.id, { muted: !cur.muted });
      renderDetailsBody();
    });

    bindPress(document.getElementById('ctDtBgRow'), function () {
      var f = document.getElementById('ctDetailsBgFile');
      if (f) f.click();
    });

    var resetBgRow = document.getElementById('ctDtResetBgRow');
    if (resetBgRow) {
      bindPress(resetBgRow, function () {
        if (window.PhoneDB) {
          window.PhoneDB.del('chat_bg_' + thread.id).then(function () {
            setThreadSettings(thread.id, { hasBg: false });
            applyRoomBackground(thread.id);
            renderDetailsBody();
            showChatToast('已恢复默认背景');
          });
        }
      });
    }

    bindPress(document.getElementById('ctDtClearBtn'), function () {
      if (!window.confirm('确定要清空这段聊天记录吗？')) return;
      saveJSON(MSGS_PREFIX + thread.id, []);
      var list = loadJSON(THREADS_KEY, []);
      var idx = list.findIndex(function (t) { return t.id === thread.id; });
      if (idx !== -1) {
        list[idx].lastMsg = '';
        list[idx].lastTime = '';
        saveJSON(THREADS_KEY, list);
      }
      var msgBox = document.getElementById('ctRoomMessages');
      if (msgBox) {
        msgBox.innerHTML = '<div class="ct-empty">发一句话开始聊天吧</div>';
      }
      showChatToast('已清空聊天记录');
      closeDetails();
    });
  }

  function renderSearchResults() {
    var listEl = document.getElementById('ctDtSearchList');
    var inp = document.getElementById('ctDtSearchInput');
    if (!listEl || !activeThreadId) return;

    var kw = inp ? inp.value.trim().toLowerCase() : '';
    var msgs = loadJSON(MSGS_PREFIX + activeThreadId, []);
    if (!Array.isArray(msgs)) msgs = [];

    var filtered = kw
      ? msgs.filter(function (m) {
          var txt = String(m.text || m.transcript || '').toLowerCase();
          return txt.indexOf(kw) !== -1;
        })
      : msgs.slice(-20).reverse();

    if (!filtered.length) {
      listEl.innerHTML = '<div class="ct-dt-empty">' + (kw ? '没有找到匹配的聊天记录' : '暂无聊天记录') + '</div>';
      return;
    }

    var chars = getArchiveChars();
    listEl.innerHTML = filtered.map(function (m) {
      var senderName = '我';
      if (m.sender !== 'me') {
        var c = chars.find(function (item) { return item.id === m.charId; });
        senderName = c ? (c.name || c.nickname || '对方') : '对方';
      }
      return (
        '<div class="ct-dt-search-item">' +
          '<div class="ct-dt-search-meta">' +
            '<span class="ct-dt-search-sender">' + escapeHtml(senderName) + '</span>' +
            '<span>' + escapeHtml(m.time || '') + '</span>' +
          '</div>' +
          '<div class="ct-dt-search-text">' + escapeHtml(m.text || m.transcript || '') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function openDetails() {
    if (!ensureDOM()) return;
    resolveCurrentThread();
    renderDetailsBody();
    detailsEl.classList.add('is-open');
  }

  function closeDetails() {
    if (searchEl) searchEl.classList.remove('is-open');
    if (detailsEl) detailsEl.classList.remove('is-open');
  }

  document.addEventListener('click', function (e) {
    var row = e.target.closest('.ct-row[data-thread-id]');
    if (row) {
      activeThreadId = row.dataset.threadId || null;
      setTimeout(function () { applyRoomBackground(activeThreadId); }, 30);
      return;
    }

    var contactRow = e.target.closest('.ct-row[data-contact-id]');
    if (contactRow) {
      lastContactId = contactRow.dataset.contactId || null;
      return;
    }

    if (e.target.closest('#ctProfileMsgBtn') && lastContactId) {
      activeThreadId = 'dm-' + lastContactId;
      setTimeout(function () { applyRoomBackground(activeThreadId); }, 30);
      return;
    }

    if (e.target.closest('#ctRoomBackBtn')) {
      closeDetails();
      activeThreadId = null;
      applyRoomBackground(null);
      return;
    }

    if (e.target.closest('#ctRoomMoreBtn')) {
      e.stopPropagation();
      e.preventDefault();
      openDetails();
    }
  }, true);

  window.PhoneChatDetails = {
    getSettings: getThreadSettings,
    open: openDetails,
    close: closeDetails
  };
})();
