/* =========================================================
   Chat 聊天室长按消息菜单（独立模块，不改动 apps/chat.js / apps/chat.css）
   - 包含：引用 / 转发 / 收藏 / 编辑 / 重roll / 隐藏（计入上下文）/ 删除（不计入上下文）
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
  var STORAGE_FAVS_KEY = 'chat_favorites_v1';

  var activeThreadId = '';
  var targetMsgId = '';
  var targetGroupEl = null;

  var ITEMS = [
    {
      id: 'quote',
      label: '引用',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 10.5c0-1 .8-1.5 1.5-1.5s1 .5 1 1.2c0 1-1 1.8-1.5 2.8"/><path d="M13.5 10.5c0-1 .8-1.5 1.5-1.5s1 .5 1 1.2c0 1-1 1.8-1.5 2.8"/></svg>'
    },
    {
      id: 'forward',
      label: '转发',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>'
    },
    {
      id: 'favorite',
      label: '收藏',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3Z"/><path d="M3.5 7.3 12 12l8.5-4.7"/><path d="M12 12v9.5"/></svg>'
    },
    {
      id: 'edit',
      label: '编辑',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>'
    },
    {
      id: 'reroll',
      label: '重roll',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
    },
    {
      id: 'hide',
      label: '隐藏',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    },
    {
      id: 'delete',
      label: '删除',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
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

  function syncHiddenDom() {
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
    });
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

    var popW = pop.offsetWidth || 248;
    var popH = pop.offsetHeight || 130;
    var bTop = (bRect.top - roomRect.top) / scale;
    var bBottom = (bRect.bottom - roomRect.top) / scale;
    var bCenterX = ((bRect.left + bRect.right) / 2 - roomRect.left) / scale;

    var left = Math.max(12, Math.min(room.offsetWidth - popW - 12, bCenterX - popW / 2));
    var top = bTop - popH - 12;
    var isAbove = true;
    if (top < 56) {
      top = bBottom + 12;
      isAbove = false;
    }

    pop.classList.toggle('is-above', isAbove);
    pop.classList.toggle('is-below', !isAbove);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    var arrowLeft = Math.max(18, Math.min(popW - 32, bCenterX - left - 7));
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

    if (!msg) return;

    if (act === 'favorite') {
      var favs = loadJSON(STORAGE_FAVS_KEY, []);
      if (!favs.some(function (f) { return f.msgId === msg.id && f.threadId === tid; })) {
        var titleEl = document.getElementById('ctRoomTitle');
        favs.unshift({
          id: 'fav-' + Date.now(),
          msgId: msg.id,
          threadId: tid,
          threadName: titleEl ? titleEl.textContent : '',
          senderName: (targetGroupEl && targetGroupEl.getAttribute('data-sender-name')) || '',
          text: msg.type === 'voice' ? (msg.transcript || '[语音 ' + (msg.duration || 1) + '"]') : (msg.text || ''),
          time: msg.time || '',
          savedAt: Date.now()
        });
        saveJSON(STORAGE_FAVS_KEY, favs);
      }
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
      renderForwardList(msg);
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
      // 隐藏：默认计入上下文
      msg.hidden = true;
      msg.includeInContext = true;
      saveThreadMsgs(tid, msgs);
      if (targetGroupEl) targetGroupEl.classList.add('ctmu-is-hidden');
      showToast('已隐藏（仍计入上下文）');
      return;
    }

    if (act === 'delete') {
      // 删除：默认不计入上下文
      msgs.splice(idx, 1);
      saveThreadMsgs(tid, msgs);
      if (targetGroupEl) targetGroupEl.remove();

      var threads = loadJSON(STORAGE_THREADS_KEY, []);
      var tIdx = threads.findIndex(function (t) { return t.id === tid; });
      if (tIdx !== -1) {
        var lastVis = msgs.slice().reverse().find(function (m) { return !m.hidden; });
        threads[tIdx].lastMsg = lastVis ? (lastVis.type === 'voice' ? '[语音 ' + (lastVis.duration || 1) + '"]' : (lastVis.text || '')) : '';
        threads[tIdx].lastTime = lastVis ? (lastVis.time || '') : '';
        saveJSON(STORAGE_THREADS_KEY, threads);
      }
      showToast('已删除（不计入上下文）');
    }
  }

  function renderForwardList(msg) {
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
        var fwdText = msg.type === 'voice' ? (msg.transcript || '[语音 ' + (msg.duration || 1) + '"]') : (msg.text || '');
        destMsgs.push({
          id: 'm-' + Date.now(),
          sender: 'me',
          text: fwdText,
          time: nowTime
        });
        saveThreadMsgs(destTid, destMsgs);

        var allThreads = loadJSON(STORAGE_THREADS_KEY, []);
        var tIdx = allThreads.findIndex(function (t) { return t.id === destTid; });
        if (tIdx !== -1) {
          allThreads[tIdx].lastMsg = fwdText;
          allThreads[tIdx].lastTime = nowTime;
          saveJSON(STORAGE_THREADS_KEY, allThreads);
        }

        document.getElementById('ctmuFwdMask').classList.remove('open');
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

      if (idx === msgs.length - 1) {
        var threads = loadJSON(STORAGE_THREADS_KEY, []);
        var tIdx = threads.findIndex(function (t) { return t.id === tid; });
        if (tIdx !== -1) {
          threads[tIdx].lastMsg = newText;
          saveJSON(STORAGE_THREADS_KEY, threads);
        }
      }

      document.getElementById('ctmuEditMask').classList.remove('open');
      showToast('已保存');
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

    msgBox.addEventListener('touchstart', function (e) {
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

    // 跟踪当前打开的会话 ID
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
      var observer = new MutationObserver(syncHiddenDom);
      observer.observe(msgBox, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
