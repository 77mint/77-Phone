/* =========================================================
   Chat 聊天室长按消息菜单 & 微信同款多选 / 逐条合并转发 / 删除确认 / 重roll弹窗
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
  var multiSearchKw = '';

  var pendingForwardMsgs = [];
  var forwardMode = 'single';
  var fwdMultiDest = false;
  var fwdDestIds = [];
  var fwdSearchKw = '';

  var pendingDeleteIds = [];
  var rerollMsg = null;

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
    var msgMap = {};
    msgs.forEach(function (m) { msgMap[m.id] = m; });

    document.querySelectorAll('#ctRoomMessages .ct-msg-group[data-msg-id]').forEach(function (el) {
      var mid = el.getAttribute('data-msg-id');
      var m = msgMap[mid];
      var isHidden = !!(m && m.hidden);
      var filteredOut = false;
      if (multiSelectMode && multiSearchKw && m) {
        filteredOut = getMsgPlainText(m).toLowerCase().indexOf(multiSearchKw) === -1;
      }
      el.classList.toggle('ctmu-is-hidden', isHidden || filteredOut);
      el.classList.toggle('ctmu-selected', selectedIds.indexOf(mid) !== -1);

      if (!el.querySelector('.ctmu-sel-box')) {
        var box = document.createElement('div');
        box.className = 'ctmu-sel-box';
        box.innerHTML = SVG_CHECK;
        el.appendChild(box);
      }

      if (m && m.type === 'forward_bundle' && Array.isArray(m.items)) {
        var bubble = el.querySelector('.ct-msg-bubble');
        if (bubble && !bubble.querySelector('.ctmu-bundle-card')) {
          var lines = m.items.slice(0, 3).map(function (it) {
            return '<div class="ctmu-bundle-line">' + escapeHtml((it.senderName || '我') + '：' + (it.text || '')) + '</div>';
          }).join('');
          bubble.style.background = '#ffffff';
          bubble.style.color = '#111111';
          bubble.innerHTML =
            '<div class="ctmu-bundle-card">' +
              '<div class="ctmu-bundle-title">' + escapeHtml(m.bundleTitle || '聊天记录') + '</div>' +
              lines +
              '<div class="ctmu-bundle-foot">聊天记录</div>' +
            '</div>';
        }
      }
    });

    var countEl = document.getElementById('ctmuMultiCount');
    if (countEl) {
      countEl.textContent = '已选择 ' + selectedIds.length + ' 条消息';
    }
  }

  function setMultiSelect(enabled, initialId) {
    multiSelectMode = !!enabled;
    selectedIds = (multiSelectMode && initialId) ? [initialId] : [];
    multiSearchKw = '';
    var sInp = document.getElementById('ctmuMultiSearchInput');
    if (sInp) sInp.value = '';
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

      '<div class="ctmu-multi-head" id="ctmuMultiHead">' +
        '<div class="ctmu-multi-top">' +
          '<button class="ctmu-multi-cancel" id="ctmuMultiCancel">取消</button>' +
          '<div class="ctmu-multi-count" id="ctmuMultiCount">已选择 0 条消息</div>' +
        '</div>' +
        '<div class="ctmu-multi-search">' +
          '<div class="ctmu-multi-search-box">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input id="ctmuMultiSearchInput" placeholder="搜索">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctmu-multi-bar" id="ctmuMultiBar">' +
        '<button class="ctmu-multi-icon-btn" id="ctmuMultiFwd" aria-label="转发">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>' +
        '</button>' +
        '<button class="ctmu-multi-icon-btn" id="ctmuMultiCopy" aria-label="复制">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
        '</button>' +
        '<button class="ctmu-multi-icon-btn" id="ctmuMultiFav" aria-label="收藏">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3Z"/><path d="M3.5 7.3 12 12l8.5-4.7"/><path d="M12 12v9.5"/></svg>' +
        '</button>' +
        '<button class="ctmu-multi-icon-btn" id="ctmuMultiDel" aria-label="删除">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="ctmu-sheet-mask" id="ctmuFwdModeMask">' +
        '<div class="ctmu-sheet">' +
          '<button class="ctmu-sheet-btn" id="ctmuSheetSingleFwd">逐条转发</button>' +
          '<button class="ctmu-sheet-btn" id="ctmuSheetMergedFwd">合并转发</button>' +
          '<div class="ctmu-sheet-gap"></div>' +
          '<button class="ctmu-sheet-btn" id="ctmuSheetFwdCancel">取消</button>' +
        '</div>' +
      '</div>' +

      '<div class="ctmu-sheet-mask" id="ctmuDelConfirmMask">' +
        '<div class="ctmu-sheet">' +
          '<button class="ctmu-sheet-btn danger" id="ctmuSheetDelConfirm">删除</button>' +
          '<div class="ctmu-sheet-gap"></div>' +
          '<button class="ctmu-sheet-btn" id="ctmuSheetDelCancel">取消</button>' +
        '</div>' +
      '</div>' +

      '<div class="ctmu-fwd-page" id="ctmuFwdPage">' +
        '<div class="ctmu-fwd-head">' +
          '<button class="ctmu-fwd-head-btn left" id="ctmuFwdClose">关闭</button>' +
          '<div class="ctmu-fwd-head-title">选择聊天</div>' +
          '<button class="ctmu-fwd-head-btn right" id="ctmuFwdToggleMulti">多选</button>' +
        '</div>' +
        '<div class="ctmu-fwd-search">' +
          '<div class="ctmu-fwd-search-box" id="ctmuFwdSearchBox">' +
            '<div class="ctmu-fwd-search-ph">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
              '<span>搜索</span>' +
            '</div>' +
            '<input id="ctmuFwdSearchInput">' +
          '</div>' +
        '</div>' +
        '<div class="ctmu-fwd-scroll" id="ctmuFwdScroll"></div>' +
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

      '<div class="ctmu-modal-mask" id="ctmuRerollMask">' +
        '<div class="ctmu-modal">' +
          '<div class="ctmu-modal-head">' +
            '<div class="ctmu-modal-title">重新生成</div>' +
            '<button class="ctmu-modal-close" data-ctmu-close="ctmuRerollMask">×</button>' +
          '</div>' +
          '<textarea class="ctmu-edit-area" id="ctmuRerollArea" placeholder="希望怎么重新生成？（可不填，直接点重新生成）"></textarea>' +
          '<div class="ctmu-modal-btns">' +
            '<button class="ctmu-modal-cancel" data-ctmu-close="ctmuRerollMask">取消</button>' +
            '<button class="ctmu-modal-save" id="ctmuRerollConfirm">重新生成</button>' +
          '</div>' +
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

    bd.classList.add('open');
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

  function confirmDeleteIds(ids) {
    if (!ids || !ids.length) return;
    pendingDeleteIds = ids.slice();
    document.getElementById('ctmuDelConfirmMask').classList.add('open');
  }

  function executePendingDelete() {
    var tid = resolveCurrentThreadId();
    var msgs = getThreadMsgs(tid).filter(function (m) {
      return pendingDeleteIds.indexOf(m.id) === -1;
    });
    saveThreadMsgs(tid, msgs);
    pendingDeleteIds.forEach(function (mid) {
      var el = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + mid + '"]');
      if (el) el.remove();
    });
    updateThreadPreview(tid, msgs);
    pendingDeleteIds = [];
    document.getElementById('ctmuDelConfirmMask').classList.remove('open');
    if (multiSelectMode) setMultiSelect(false);
    showToast('已删除（不计入上下文）');
  }

  function openForwardPage(mode) {
    forwardMode = mode || 'single';
    fwdMultiDest = false;
    fwdDestIds = [];
    fwdSearchKw = '';
    var sInp = document.getElementById('ctmuFwdSearchInput');
    var sBox = document.getElementById('ctmuFwdSearchBox');
    if (sInp) sInp.value = '';
    if (sBox) sBox.classList.remove('has-val', 'is-focus');
    syncFwdHeaderBtn();
    renderForwardPage();
    document.getElementById('ctmuFwdPage').classList.add('open');
  }

  function syncFwdHeaderBtn() {
    var page = document.getElementById('ctmuFwdPage');
    var btn = document.getElementById('ctmuFwdToggleMulti');
    if (!page || !btn) return;
    page.classList.toggle('is-multi-dest', fwdMultiDest);
    if (!fwdMultiDest) {
      btn.textContent = '多选';
      btn.classList.remove('send-ready');
    } else if (fwdDestIds.length > 0) {
      btn.textContent = '发送(' + fwdDestIds.length + ')';
      btn.classList.add('send-ready');
    } else {
      btn.textContent = '完成';
      btn.classList.remove('send-ready');
    }
  }

  function sendForwardToTargets(targetTids) {
    if (!targetTids.length || !pendingForwardMsgs.length) return;
    var nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    var curTitleEl = document.getElementById('ctRoomTitle');
    var curTitle = (curTitleEl ? curTitleEl.textContent : '') || '聊天';

    targetTids.forEach(function (destTid) {
      var destMsgs = getThreadMsgs(destTid);
      if (forwardMode === 'merged' && pendingForwardMsgs.length > 1) {
        var items = pendingForwardMsgs.map(function (m) {
          var grp = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + m.id + '"]');
          var sName = (grp && grp.getAttribute('data-sender-name')) || (m.sender === 'me' ? '我' : curTitle);
          return { senderName: sName, text: getMsgPlainText(m) };
        });
        destMsgs.push({
          id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
          sender: 'me',
          type: 'forward_bundle',
          bundleTitle: curTitle + '的聊天记录',
          items: items,
          text: '[聊天记录]',
          time: nowTime
        });
      } else {
        pendingForwardMsgs.forEach(function (m, i) {
          destMsgs.push({
            id: 'm-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 4),
            sender: 'me',
            text: getMsgPlainText(m),
            time: nowTime
          });
        });
      }
      saveThreadMsgs(destTid, destMsgs);
      updateThreadPreview(destTid, destMsgs);
    });

    document.getElementById('ctmuFwdPage').classList.remove('open');
    if (multiSelectMode) setMultiSelect(false);
    showToast('已转发');
  }

  function renderForwardPage() {
    var scrollEl = document.getElementById('ctmuFwdScroll');
    if (!scrollEl) return;

    var curTid = resolveCurrentThreadId();
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var chars = (window.PhoneArchive && window.PhoneArchive.getChars) ? (window.PhoneArchive.getChars() || []) : [];

    var items = threads.map(function (t) {
      var isGroup = t.type === 'group';
      var cObj = !isGroup ? chars.find(function (c) { return c.id === t.charId; }) : null;
      var name = cObj ? (cObj.name || cObj.nickname || '未命名') : (t.name || '聊天');
      var av = (cObj && window.PhoneArchive && window.PhoneArchive.getCharAvatar) ? (window.PhoneArchive.getCharAvatar(cObj.id) || '') : '';
      var countText = isGroup && Array.isArray(t.memberIds) ? ' (' + t.memberIds.length + '人)' : '';
      return {
        id: t.id,
        name: name,
        countText: countText,
        av: av,
        isCurrent: t.id === curTid
      };
    }).filter(function (it) {
      if (!fwdSearchKw) return true;
      return it.name.toLowerCase().indexOf(fwdSearchKw) !== -1;
    });

    var recentHtml = '';
    if (!fwdSearchKw && items.length) {
      recentHtml =
        '<div class="ctmu-fwd-sec">' +
          '<div class="ctmu-fwd-sec-title">最近转发</div>' +
          '<div class="ctmu-fwd-recent-row">' +
            items.slice(0, 8).map(function (it) {
              var avHtml = it.av ? '<img src="' + escapeHtml(it.av) + '" alt="">' : escapeHtml(it.name.slice(0, 1));
              return '<div class="ctmu-fwd-recent-item" data-fwd-pick="' + escapeHtml(it.id) + '">' +
                '<div class="ctmu-fwd-recent-av">' + avHtml + '</div>' +
                '<div class="ctmu-fwd-recent-name">' + escapeHtml(it.name) + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="ctmu-fwd-gap"></div>';
    }

    var listRowsHtml = items.length ? items.map(function (it) {
      var avHtml = it.av ? '<img src="' + escapeHtml(it.av) + '" alt="">' : escapeHtml(it.name.slice(0, 1));
      var picked = fwdDestIds.indexOf(it.id) !== -1;
      return '<div class="ctmu-fwd-row ' + (picked ? 'picked' : '') + '" data-fwd-pick="' + escapeHtml(it.id) + '">' +
        '<div class="ctmu-fwd-check">' + (picked ? SVG_CHECK : '') + '</div>' +
        '<div class="ctmu-fwd-av">' + avHtml + '</div>' +
        '<div class="ctmu-fwd-name">' + escapeHtml(it.name) + (it.countText ? '<span style="color:#8e8e93;">' + escapeHtml(it.countText) + '</span>' : '') + '</div>' +
        (it.isCurrent ? '<div class="ctmu-fwd-tag">当前聊天</div>' : '') +
      '</div>';
    }).join('') : '<div style="text-align:center;color:#8e8e93;padding:40px 0;">暂无匹配的聊天</div>';

    scrollEl.innerHTML =
      recentHtml +
      '<div class="ctmu-fwd-list-head">' +
        '<div class="ctmu-fwd-list-title">最近聊天</div>' +
        '<button class="ctmu-fwd-new-btn" id="ctmuFwdCreateBtn">创建聊天</button>' +
      '</div>' +
      listRowsHtml;

    scrollEl.querySelectorAll('[data-fwd-pick]').forEach(function (el) {
      el.addEventListener('click', function () {
        var tid = el.getAttribute('data-fwd-pick');
        if (!fwdMultiDest) {
          sendForwardToTargets([tid]);
        } else {
          var i = fwdDestIds.indexOf(tid);
          if (i === -1) fwdDestIds.push(tid);
          else fwdDestIds.splice(i, 1);
          syncFwdHeaderBtn();
          renderForwardPage();
        }
      });
    });

    var createBtn = document.getElementById('ctmuFwdCreateBtn');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var trigger = document.getElementById('ctMenuNewGroup');
        if (trigger) trigger.click();
      });
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
      openForwardPage('single');
      return;
    }

    if (act === 'reroll') {
      rerollMsg = msg;
      var rArea = document.getElementById('ctmuRerollArea');
      if (rArea) rArea.value = '';
      document.getElementById('ctmuRerollMask').classList.add('open');
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
      confirmDeleteIds([msg.id]);
    }
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

    document.getElementById('ctmuRerollConfirm').addEventListener('click', function () {
      var tid = resolveCurrentThreadId();
      var promptText = (document.getElementById('ctmuRerollArea').value || '').trim();
      document.getElementById('ctmuRerollMask').classList.remove('open');
      var ev = new CustomEvent('phone-chat-reroll', {
        cancelable: true,
        detail: {
          threadId: tid,
          msgId: rerollMsg ? rerollMsg.id : targetMsgId,
          msg: rerollMsg,
          prompt: promptText
        }
      });
      var notHandled = window.dispatchEvent(ev);
      if (notHandled) {
        showToast('已记录重roll需求（待接入 AI 回复）');
      }
    });

    document.getElementById('ctmuMultiCancel').addEventListener('click', function () {
      setMultiSelect(false);
    });

    document.getElementById('ctmuMultiSearchInput').addEventListener('input', function (e) {
      multiSearchKw = (e.target.value || '').trim().toLowerCase();
      syncMessagesDom();
    });

    document.getElementById('ctmuMultiFwd').addEventListener('click', function () {
      if (!selectedIds.length) { showToast('请先选择消息'); return; }
      var tid = resolveCurrentThreadId();
      pendingForwardMsgs = getThreadMsgs(tid).filter(function (m) { return selectedIds.indexOf(m.id) !== -1; });
      document.getElementById('ctmuFwdModeMask').classList.add('open');
    });

    document.getElementById('ctmuMultiCopy').addEventListener('click', function () {
      if (!selectedIds.length) { showToast('请先选择消息'); return; }
      var tid = resolveCurrentThreadId();
      var msgs = getThreadMsgs(tid).filter(function (m) { return selectedIds.indexOf(m.id) !== -1; });
      copyText(msgs.map(getMsgPlainText).join('\n'));
      setMultiSelect(false);
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
      confirmDeleteIds(selectedIds);
    });

    document.getElementById('ctmuSheetSingleFwd').addEventListener('click', function () {
      document.getElementById('ctmuFwdModeMask').classList.remove('open');
      openForwardPage('single');
    });
    document.getElementById('ctmuSheetMergedFwd').addEventListener('click', function () {
      document.getElementById('ctmuFwdModeMask').classList.remove('open');
      openForwardPage('merged');
    });
    document.getElementById('ctmuSheetFwdCancel').addEventListener('click', function () {
      document.getElementById('ctmuFwdModeMask').classList.remove('open');
    });
    document.getElementById('ctmuFwdModeMask').addEventListener('click', function (e) {
      if (e.target.id === 'ctmuFwdModeMask') e.target.classList.remove('open');
    });

    document.getElementById('ctmuSheetDelConfirm').addEventListener('click', executePendingDelete);
    document.getElementById('ctmuSheetDelCancel').addEventListener('click', function () {
      pendingDeleteIds = [];
      document.getElementById('ctmuDelConfirmMask').classList.remove('open');
    });
    document.getElementById('ctmuDelConfirmMask').addEventListener('click', function (e) {
      if (e.target.id === 'ctmuDelConfirmMask') {
        pendingDeleteIds = [];
        e.target.classList.remove('open');
      }
    });

    document.getElementById('ctmuFwdClose').addEventListener('click', function () {
      document.getElementById('ctmuFwdPage').classList.remove('open');
    });
    document.getElementById('ctmuFwdToggleMulti').addEventListener('click', function () {
      if (fwdMultiDest && fwdDestIds.length > 0) {
        sendForwardToTargets(fwdDestIds);
        return;
      }
      fwdMultiDest = !fwdMultiDest;
      fwdDestIds = [];
      syncFwdHeaderBtn();
      renderForwardPage();
    });

    var fwdSearchInput = document.getElementById('ctmuFwdSearchInput');
    var fwdSearchBox = document.getElementById('ctmuFwdSearchBox');
    fwdSearchInput.addEventListener('focus', function () {
      fwdSearchBox.classList.add('is-focus');
    });
    fwdSearchInput.addEventListener('blur', function () {
      fwdSearchBox.classList.remove('is-focus');
    });
    fwdSearchInput.addEventListener('input', function (e) {
      fwdSearchKw = (e.target.value || '').trim().toLowerCase();
      fwdSearchBox.classList.toggle('has-val', fwdSearchKw.length > 0);
      renderForwardPage();
    });
  }

  function bindLongPress() {
    var msgBox = document.getElementById('ctRoomMessages');
    if (!msgBox) return;

    var timer = null;
    var pressingBubble = null;
    var sx = 0;
    var sy = 0;

    function clearHold() {
      clearTimeout(timer);
      timer = null;
      if (pressingBubble) {
        pressingBubble.classList.remove('ctmu-pressing');
        pressingBubble = null;
      }
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
      pressingBubble = bubble;
      bubble.classList.add('ctmu-pressing');
      timer = setTimeout(function () {
        timer = null;
        if (pressingBubble) {
          pressingBubble.classList.remove('ctmu-pressing');
          pressingBubble = null;
        }
        openMenuForBubble(bubble, group);
      }, 400);
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
