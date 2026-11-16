/* =========================================================
   Chat 聊天室长按消息菜单（独立模块，不改动 apps/chat.js / apps/chat.css）
   - 包含：复制 / 转发 / 收藏 / 删除 / 多选 / 引用 / 编辑 / 重roll / 隐藏
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
  var STORAGE_FAVS_KEY = 'chat_favorites_v1';

  var activeThreadId = '';
  var targetMsgId = '';
  var targetGroupEl = null;
  var multiSelectMode = false;
  var selectedIds = [];
  var pendingForwardMsgs = [];

  var SVG_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var ITEMS = [
    {
      id: 'copy',
      label: '复制',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="13" rx="2" fill="#ffffff"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'forward',
      label: '转发',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 5v4.2C7.8 9.8 4.4 13.6 3.5 19c2.2-3 5.5-4.4 10.5-4.4V19l7-7-7-7Z" fill="#ffffff"/></svg>'
    },
    {
      id: 'favorite',
      label: '收藏',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.4 20.5 7.2v9.6L12 21.6l-8.5-4.8V7.2L12 2.4Z" fill="#ffffff"/><path d="M3.5 7.2 12 12l8.5-4.8M12 12v9.6" stroke="#4c4c4c" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'delete',
      label: '删除',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 3.5h6l.8 1.5H20v2H4V5h4.2L9 3.5ZM6 8.5h12l-1 11.2a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19.7L6 8.5Z" fill="#ffffff"/><path d="M10 11.5v6M14 11.5v6" stroke="#4c4c4c" stroke-width="1.6" stroke-linecap="round"/></svg>'
    },
    {
      id: 'multiselect',
      label: '多选',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="14" y2="18"/><circle cx="4" cy="6" r="1" fill="#ffffff"/><circle cx="4" cy="12" r="1" fill="#ffffff"/><polyline points="16 17 18 19 21 15"/></svg>'
    },
    {
      id: 'quote',
      label: '引用',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ffffff"/><path d="M8.4 13.8c0-2 .9-3.4 2.4-4l.6 1.1c-.9.5-1.3 1.2-1.3 2h1.2v2.4H8.4v-1.5Zm4.8 0c0-2 .9-3.4 2.4-4l.6 1.1c-.9.5-1.3 1.2-1.3 2h1.2v2.4h-2.9v-1.5Z" fill="#4c4c4c"/></svg>'
    },
    {
      id: 'edit',
      label: '编辑',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M16.9 3.6a2.1 2.1 0 0 1 3 3l-.9.9-3-3 .9-.9Zm-2 2-10 10L4 20l4.4-.9 10-10-3.5-3.5Z" fill="#ffffff"/></svg>'
    },
    {
      id: 'reroll',
      label: '重roll',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4v5h-5"/><path d="M19.8 14.5A8.2 8.2 0 1 1 17.5 6.8L21 9"/></svg>'
    },
    {
      id: 'hide',
      label: '隐藏',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5.5c5.2 0 9.4 3.4 10.7 6.5-.5 1.3-1.5 2.7-2.9 3.9l-2.3-2.3a4.2 4.2 0 0 0-5.1-5.1L10 6.1c.6-.4 1.3-.6 2-.6Zm-8.2-1.8 16.5 16.5-1.4 1.4-2.8-2.8a11.3 11.3 0 0 1-4.1.7C6.8 19.5 2.6 16.1 1.3 13c.7-1.6 2-3.4 3.9-4.7L2.4 5.1l1.4-1.4Zm5 6.4 5.1 5.1a2.6 2.6 0 0 1-5.1-5.1Z" fill="#ffffff"/></svg>'
    }
  ];

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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    var el = document.getElementById('ctToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  function copyText(str) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(function () {
        showToast('已复制');
      }).catch(function () {
        fallbackCopy(str);
      });
      return;
    }
    fallbackCopy(str);
  }

  function fallbackCopy(str) {
    var ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    showToast('已复制');
  }

  function resolveCurrentThreadId() {
    if (activeThreadId) return activeThreadId;
    var titleEl = document.getElementById('ctRoomTitle');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var found = threads.find(function (t) { return (t.name || '').trim() === title; });
    if (found) {
      activeThreadId = found.id;
      return found.id;
    }
    return '';
  }

  function getThreadMsgs(tid) {
    if (!tid) return [];
    var arr = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveThreadMsgs(tid, msgs) {
    if (!tid) return;
    saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);
  }

  function getMsgPlainText(msg) {
    if (!msg) return '';
    return msg.type === 'voice'
      ? (msg.transcript || '[语音 ' + (msg.duration || 1) + '"]')
      : (msg.text || '');
  }

  function syncMessagesDom() {
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var msgs = getThreadMsgs(tid);
    var hiddenMap = {};
    msgs.forEach(function (m) {
      if (m.hidden) hiddenMap[m.id] = true;
    });
    document.querySelectorAll('#ctRoomMessages .ct-msg-group[data-msg-id]').forEach(function (el) {
      var mid = el.getAttribute('data-msg-id');
      el.classList.toggle('ctmu-is-hidden', !!hiddenMap[mid]);
      el.classList.toggle('ctmu-selected', selectedIds.indexOf(mid) !== -1);
      if (!el.querySelector('.ctmu-sel-box')) {
        var box = document.createElement('div');
        box.className = 'ctmu-sel-box';
        box.innerHTML = SVG_CHECK;
        el.appendChild(box);
      }
    });
  }

  function setMultiSelect(enabled, initialId) {
    multiSelectMode = !!enabled;
    selectedIds = (multiSelectMode && initialId) ? [initialId] : [];
    var room = document.getElementById('ctRoomView');
    if (room) room.classList.toggle('ctmu-multiselect', multiSelectMode);
    syncMessagesDom();
  }

  function ensureUI() {
    var room = document.getElementById('ctRoomView');
    if (!room || document.getElementById('ctmuBackdrop')) return;

    var gridHtml = ITEMS.map(function (it) {
      return '<button class="ctmu-item" data-ctmu-act="' + it.id + '">' +
        it.icon +
        '<span>' + it.label + '</span>' +
      '</button>';
    }).join('');

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="ctmu-backdrop" id="ctmuBackdrop">' +
        '<div class="ctmu-popover is-above" id="ctmuPopover">' +
          '<div class="ctmu-grid">' + gridHtml + '</div>' +
          '<div class="ctmu-arrow" id="ctmuArrow"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ctmu-multi-bar" id="ctmuMultiBar">' +
        '<button class="ctmu-multi-btn" id="ctmuMultiCancel">取消</button>' +
        '<button class="ctmu-multi-btn" id="ctmuMultiFwd">转发</button>' +
        '<button class="ctmu-multi-btn" id="ctmuMultiFav">收藏</button>' +
        '<button class="ctmu-multi-btn danger" id="ctmuMultiDel">删除</button>' +
      '</div>' +
      '<div class="ctmu-modal-mask" id="ctmuEditMask">' +
        '<div class="ctmu-modal">' +
          '<div class="ctmu-modal-head">' +
            '<div class="ctmu-modal-title">编辑消息</div>' +
            '<button class="ctmu-modal-close" data-ctmu-close="ctmuEditMask">×</button>' +
          '</div>' +
          '<textarea class="ctmu-edit-area" id="ctmuEditArea"></textarea>' +
          '<button class="ctmu-modal-save" id="ctmuEditSave">保存</button>' +
        '</div>' +
      '</div>' +
      '<div class="ctmu-modal-mask" id="ctmuFwdMask">' +
        '<div class="ctmu-modal">' +
          '<div class="ctmu-modal-head">' +
            '<div class="ctmu-modal-title">转发给</div>' +
            '<button class="ctmu-modal-close" data-ctmu-close="ctmuFwdMask">×</button>' +
          '</div>' +
          '<div class="ctmu-fwd-list" id="ctmuFwdList"></div>' +
        '</div>' +
      '</div>';

    while (wrap.firstChild) {
      room.appendChild(wrap.firstChild);
    }

    bindMenuEvents();
  }

  function closeMenu() {
    var bd = document.getElementById('ctmuBackdrop');
    if (bd) bd.classList.remove('open');
  }

  function openMenuForBubble(bubbleEl, groupEl) {
    if (multiSelectMode) return;
    ensureUI();
    var room = document.getElementById('ctRoomView');
    var bd = document.getElementById('ctmuBackdrop');
    var pop = document.getElementById('ctmuPopover');
    var arrow = document.getElementById('ctmuArrow');
    if (!room || !bd || !pop || !arrow) return;

    targetGroupEl = groupEl;
    targetMsgId = groupEl.getAttribute('data-msg-id') || '';

    bd.classList.add('open');

    var roomRect = room.getBoundingClientRect();
    var bRect = bubbleEl.getBoundingClientRect();
    var scale = room.offsetHeight ? (roomRect.height / room.offsetHeight) : 1;

    var popW = pop.offsetWidth || 280;
    var popH = pop.offsetHeight || 124;
    var bTop = (bRect.top - roomRect.top) / scale;
    var bBottom = (bRect.bottom - roomRect.top) / scale;
    var bCenterX = ((bRect.left + bRect.right) / 2 - roomRect.left) / scale;

    var left = Math.max(12, Math.min(room.offsetWidth - popW - 12, bCenterX - popW / 2));
    var top = bTop - popH - 10;
    var isAbove = true;
    if (top < 56) {
      top = bBottom + 10;
      isAbove = false;
    }

    pop.classList.toggle('is-above', isAbove);
    pop.classList.toggle('is-below', !isAbove);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    var arrowLeft = Math.max(16, Math.min(popW - 28, bCenterX - left - 6));
    arrow.style.left = arrowLeft + 'px';
  }

  function triggerNativeQuote(groupEl) {
    if (!groupEl) return;
    var isMe = groupEl.classList.contains('me');
    var sx = isMe ? 200 : 100;
    var ex = isMe ? 140 : 160;

    function fireTouch(name, x, y) {
      var ev = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
      groupEl.dispatchEvent(ev);
    }

    fireTouch('touchstart', sx, 200);
    fireTouch('touchmove', ex, 200);
    groupEl.dispatchEvent(new Event('touchend', { bubbles: true }));
  }

  function addFavorites(tid, msgList) {
    var favs = loadJSON(STORAGE_FAVS_KEY, []);
    var titleEl = document.getElementById('ctRoomTitle');
    var tName = titleEl ? titleEl.textContent : '';
    msgList.forEach(function (msg) {
      if (!favs.some(function (f) { return f.msgId === msg.id && f.threadId === tid; })) {
        var grp = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + msg.id + '"]');
        favs.unshift({
          id: 'fav-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          msgId: msg.id,
          threadId: tid,
          threadName: tName,
          senderName: (grp && grp.getAttribute('data-sender-name')) || '',
          text: getMsgPlainText(msg),
          time: msg.time || '',
          savedAt: Date.now()
        });
      }
    });
    saveJSON(STORAGE_FAVS_KEY, favs);
  }

  function updateThreadPreview(tid, msgs) {
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var tIdx = threads.findIndex(function (t) { return t.id === tid; });
    if (tIdx !== -1) {
      var lastVis = msgs.slice().reverse().find(function (m) { return !m.hidden; });
      threads[tIdx].lastMsg = lastVis ? getMsgPlainText(lastVis) : '';
      threads[tIdx].lastTime = lastVis ? (lastVis.time || '') : '';
      saveJSON(STORAGE_THREADS_KEY, threads);
    }
  }

  function handleAction(act) {
    var tid = resolveCurrentThreadId();
    var msgs = getThreadMsgs(tid);
    var idx = msgs.findIndex(function (m) { return m.id === targetMsgId; });
    var msg = idx !== -1 ? msgs[idx] : null;
    closeMenu();

    if (act === 'quote') {
      triggerNativeQuote(targetGroupEl);
      return;
    }

    if (act === 'multiselect') {
      setMultiSelect(true, targetMsgId);
      return;
    }

    if (!msg) return;

    if (act === 'copy') {
      copyText(getMsgPlainText(msg));
      return;
    }

    if (act === 'favorite') {
      addFavorites(tid, [msg]);
      showToast('已收藏');
      return;
    }

    if (act === 'edit') {
      var area = document.getElementById('ctmuEditArea');
      if (area) {
        area.value = msg.type === 'voice' ? (msg.transcript || '') : (msg.text || '');
      }
      document.getElementById('ctmuEditMask').classList.add('open');
      if (area) area.focus();
      return;
    }

    if (act === 'forward') {
      pendingForwardMsgs = [msg];
      renderForwardList();
      document.getElementById('ctmuFwdMask').classList.add('open');
      return;
    }

    if (act === 'reroll') {
      var ev = new CustomEvent('phone-chat-reroll', {
        cancelable: true,
        detail: { threadId: tid, msgId: msg.id, msg: msg }
      });
      var notHandled = window.dispatchEvent(ev);
      if (notHandled) {
        showToast('已触发重roll（待接入 AI 回复）');
      }
      return;
    }

    if (act === 'hide') {
      msg.hidden = true;
      msg.includeInContext = true;
      saveThreadMsgs(tid, msgs);
      if (targetGroupEl) targetGroupEl.classList.add('ctmu-is-hidden');
      showToast('已隐藏（仍计入上下文）');
      return;
    }

    if (act === 'delete') {
      msgs.splice(idx, 1);
      saveThreadMsgs(tid, msgs);
      if (targetGroupEl) targetGroupEl.remove();
      updateThreadPreview(tid, msgs);
      showToast('已删除（不计入上下文）');
    }
  }

  function renderForwardList() {
    var listEl = document.getElementById('ctmuFwdList');
    if (!listEl) return;
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var chars = (window.PhoneArchive && window.PhoneArchive.getChars) ? (window.PhoneArchive.getChars() || []) : [];

    if (!threads.length) {
      listEl.innerHTML = '<div style="text-align:center;color:#8e8e93;padding:24px 0;">暂无可转发的聊天</div>';
      return;
    }

    listEl.innerHTML = threads.map(function (t) {
      var cObj = t.type === 'dm' ? chars.find(function (c) { return c.id === t.charId; }) : null;
      var name = cObj ? (cObj.name || cObj.nickname || '未命名') : (t.name || '聊天');
      var av = (cObj && window.PhoneArchive && window.PhoneArchive.getCharAvatar) ? (window.PhoneArchive.getCharAvatar(cObj.id) || '') : '';
      var avHtml = av ? '<img src="' + escapeHtml(av) + '" alt="">' : escapeHtml(name.slice(0, 1));
      return '<div class="ctmu-fwd-row" data-fwd-tid="' + escapeHtml(t.id) + '">' +
        '<div class="ctmu-fwd-av">' + avHtml + '</div>' +
        '<div class="ctmu-fwd-name">' + escapeHtml(name) + '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.ctmu-fwd-row[data-fwd-tid]').forEach(function (row) {
      row.addEventListener('click', function () {
        var destTid = row.getAttribute('data-fwd-tid');
        var destMsgs = getThreadMsgs(destTid);
        var nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        var lastText = '';
        pendingForwardMsgs.forEach(function (m, i) {
          lastText = getMsgPlainText(m);
          destMsgs.push({
            id: 'm-' + Date.now() + '-' + i,
            sender: 'me',
            text: lastText,
            time: nowTime
          });
        });
        saveThreadMsgs(destTid, destMsgs);
        updateThreadPreview(destTid, destMsgs);
        document.getElementById('ctmuFwdMask').classList.remove('open');
        if (multiSelectMode) setMultiSelect(false);
        showToast('已转发');
      });
    });
  }

  function bindMenuEvents() {
    var bd = document.getElementById('ctmuBackdrop');
    bd.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ctmu-act]');
      if (btn) {
        handleAction(btn.getAttribute('data-ctmu-act'));
        return;
      }
      closeMenu();
    });

    document.querySelectorAll('[data-ctmu-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById(btn.getAttribute('data-ctmu-close')).classList.remove('open');
      });
    });

    document.getElementById('ctmuEditSave').addEventListener('click', function () {
      var tid = resolveCurrentThreadId();
      var msgs = getThreadMsgs(tid);
      var idx = msgs.findIndex(function (m) { return m.id === targetMsgId; });
      if (idx === -1) return;

      var newText = (document.getElementById('ctmuEditArea').value || '').trim();
      if (!newText) return;

      if (msgs[idx].type === 'voice') {
        msgs[idx].transcript = newText;
        msgs[idx].text = newText;
      } else {
        msgs[idx].text = newText;
      }
      saveThreadMsgs(tid, msgs);

      if (targetGroupEl) {
        var bubble = targetGroupEl.querySelector('.ct-msg-bubble:not(.is-voice-msg)');
        if (bubble) bubble.textContent = newText;
      }

      updateThreadPreview(tid, msgs);
      document.getElementById('ctmuEditMask').classList.remove('open');
      showToast('已保存');
    });

    document.getElementById('ctmuMultiCancel').addEventListener('click', function () {
      setMultiSelect(false);
    });

    document.getElementById('ctmuMultiFwd').addEventListener('click', function () {
      if (!selectedIds.length) { showToast('请先选择消息'); return; }
      var tid = resolveCurrentThreadId();
      var msgs = getThreadMsgs(tid);
      pendingForwardMsgs = msgs.filter(function (m) { return selectedIds.indexOf(m.id) !== -1; });
      renderForwardList();
      document.getElementById('ctmuFwdMask').classList.add('open');
    });

    document.getElementById('ctmuMultiFav').addEventListener('click', function () {
      if (!selectedIds.length) { showToast('请先选择消息'); return; }
      var tid = resolveCurrentThreadId();
      var msgs = getThreadMsgs(tid).filter(function (m) { return selectedIds.indexOf(m.id) !== -1; });
      addFavorites(tid, msgs);
      setMultiSelect(false);
      showToast('已收藏');
    });

    document.getElementById('ctmuMultiDel').addEventListener('click', function () {
      if (!selectedIds.length) { showToast('请先选择消息'); return; }
      var tid = resolveCurrentThreadId();
      var msgs = getThreadMsgs(tid).filter(function (m) { return selectedIds.indexOf(m.id) === -1; });
      saveThreadMsgs(tid, msgs);
      selectedIds.forEach(function (mid) {
        var el = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + mid + '"]');
        if (el) el.remove();
      });
      updateThreadPreview(tid, msgs);
      setMultiSelect(false);
      showToast('已删除');
    });
  }

  function bindLongPress() {
    var msgBox = document.getElementById('ctRoomMessages');
    if (!msgBox) return;

    var timer = null;
    var sx = 0;
    var sy = 0;

    function clearHold() {
      clearTimeout(timer);
      timer = null;
    }

    msgBox.addEventListener('click', function (e) {
      if (!multiSelectMode) return;
      var group = e.target.closest('.ct-msg-group[data-msg-id]');
      if (!group) return;
      e.stopPropagation();
      var mid = group.getAttribute('data-msg-id');
      var i = selectedIds.indexOf(mid);
      if (i === -1) selectedIds.push(mid);
      else selectedIds.splice(i, 1);
      syncMessagesDom();
    }, true);

    msgBox.addEventListener('touchstart', function (e) {
      if (multiSelectMode) return;
      var bubble = e.target.closest('.ct-msg-bubble');
      var group = e.target.closest('.ct-msg-group');
      if (!bubble || !group || !e.touches[0]) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      clearHold();
      timer = setTimeout(function () {
        timer = null;
        openMenuForBubble(bubble, group);
      }, 420);
    }, { passive: true });

    msgBox.addEventListener('touchmove', function (e) {
      if (!timer || !e.touches[0]) return;
      var dx = e.touches[0].clientX - sx;
      var dy = e.touches[0].clientY - sy;
      if (Math.hypot(dx, dy) > 10) clearHold();
    }, { passive: true });

    msgBox.addEventListener('touchend', clearHold);
    msgBox.addEventListener('touchcancel', clearHold);

    msgBox.addEventListener('contextmenu', function (e) {
      var bubble = e.target.closest('.ct-msg-bubble');
      var group = e.target.closest('.ct-msg-group');
      if (!bubble || !group) return;
      e.preventDefault();
      openMenuForBubble(bubble, group);
    });
  }

  function init() {
    ensureUI();
    bindLongPress();

    var roomBack = document.getElementById('ctRoomBackBtn');
    if (roomBack) {
      roomBack.addEventListener('click', function () {
        if (multiSelectMode) setMultiSelect(false);
        closeMenu();
      });
    }

    document.addEventListener('click', function (e) {
      var threadRow = e.target.closest('#ctMainScroll .ct-row[data-thread-id]');
      if (threadRow) {
        activeThreadId = threadRow.getAttribute('data-thread-id') || '';
        return;
      }
      var contactRow = e.target.closest('[data-contact-id], [data-ctc-id]');
      if (contactRow) {
        var cid = contactRow.getAttribute('data-contact-id') || contactRow.getAttribute('data-ctc-id');
        if (cid) activeThreadId = 'dm-' + cid;
      }
    }, true);

    var msgBox = document.getElementById('ctRoomMessages');
    if (msgBox) {
      var observer = new MutationObserver(syncMessagesDom);
      observer.observe(msgBox, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
