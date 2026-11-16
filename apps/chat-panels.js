/* =========================================================
   Chat 输入扩展面板、发照片 & 转账模块（独立模块化，不修改 chat.js）
   - 照片：支持单张无框图 + 多张合并叠卡（展开后竖排一张一张显示）
   - 转账：严格复刻微信转账页、微信支付加载框、付款方式抽屉、6位支付密码弹窗、褪色气泡状态
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
  var STORAGE_WALLET_KEY = 'chat_wallet_balance_v1';

  var SVG_PHOTO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM6 17h12l-3.8-5-2.9 3.6-2-2.4L6 17zm2.5-7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';
  var SVG_TRANSFER_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-4-4"/><path d="M19 15H5l4 4"/></svg>';
  var SVG_TR_ARROWS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9h12l-3.5-3.5"/><path d="M18 15H6l3.5 3.5"/></svg>';
  var SVG_TR_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
  var SVG_TR_REFUND = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
  var SVG_TR_EXPIRED = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="7" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>';
  var SVG_BACKSPACE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-3.3 10.3-1.4 1.4L13.5 13.9l-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8 2.8 2.8z"/></svg>';
  var SVG_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var drawerOpen = false;
  var activeThreadId = '';
  var expandedBundles = {};
  var pendingPhotos = [];
  var mergePhotos = true;
  var photoBusy = false;

  var transferAmount = '';
  var transferNote = '';
  var pendingPayAmount = 0;
  var selectedPayMethod = 'wallet';
  var payPassword = '';
  var detailMsgId = '';

  function loadJSON(key, fb) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fb;
    } catch (e) {
      return fb;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function getWalletBalance() {
    var val = localStorage.getItem(STORAGE_WALLET_KEY);
    if (val === null) {
      localStorage.setItem(STORAGE_WALLET_KEY, '8888.00');
      return 8888.00;
    }
    var n = parseFloat(val);
    return isNaN(n) ? 8888.00 : n;
  }

  function setWalletBalance(num) {
    localStorage.setItem(STORAGE_WALLET_KEY, Number(Math.max(0, num)).toFixed(2));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function compressPhoto(file, maxSide, quality) {
    var limit = maxSide || 900;
    var q = quality || 0.8;
    return new Promise(function (resolve) {
      var objUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(objUrl);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (w > limit || h > limit) {
          if (w >= h) { h = Math.round(h * limit / w); w = limit; }
          else { w = Math.round(w * limit / h); h = limit; }
        }
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.onerror = function () {
        URL.revokeObjectURL(objUrl);
        resolve('');
      };
      img.src = objUrl;
    });
  }

  function resolveCurrentThreadId() {
    if (activeThreadId) return activeThreadId;
    var box = document.getElementById('ctRoomMessages');
    var firstGroup = box && box.querySelector('.ct-msg-group[data-msg-id]');
    var mid = firstGroup ? firstGroup.getAttribute('data-msg-id') : '';
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    if (mid) {
      for (var i = 0; i < threads.length; i++) {
        var list = loadJSON(STORAGE_MSGS_PREFIX + threads[i].id, []);
        if (list.some(function (m) { return m.id === mid; })) {
          activeThreadId = threads[i].id;
          return activeThreadId;
        }
      }
    }
    var titleEl = document.getElementById('ctRoomTitle');
    var title = titleEl ? titleEl.textContent.trim() : '';
    if (title) {
      var found = threads.find(function (t) { return t.name === title; });
      if (found) {
        activeThreadId = found.id;
        return activeThreadId;
      }
    }
    return '';
  }

  function getPeerInfo() {
    var tid = resolveCurrentThreadId();
    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var t = threads.find(function (item) { return item.id === tid; });
    var titleEl = document.getElementById('ctRoomTitle');
    var name = (titleEl && titleEl.textContent.trim()) || (t && t.name) || '联系人';
    var charId = (t && t.charId) || tid || 'chat_user';
    var avatar = '';
    var wxid = charId;
    try {
      if (window.PhoneArchive && t && t.charId) {
        var c = typeof window.PhoneArchive.getCharById === 'function'
          ? window.PhoneArchive.getCharById(t.charId)
          : (window.PhoneArchive.getChars() || []).find(function (item) { return item.id === t.charId; });
        if (c) {
          name = c.name || c.nickname || name;
          wxid = c.handle || c.id || wxid;
        }
        if (typeof window.PhoneArchive.getCharAvatar === 'function') {
          avatar = window.PhoneArchive.getCharAvatar(t.charId) || '';
        }
      }
    } catch (e) {}
    return { name: name, wxid: wxid, avatar: avatar };
  }

  function setDrawerOpen(open) {
    drawerOpen = !!open;
    var drawer = document.getElementById('ctpDrawer');
    if (drawer) drawer.classList.toggle('open', drawerOpen);
    if (drawerOpen) {
      var inp = document.getElementById('ctRoomInput');
      if (inp) inp.blur();
      var box = document.getElementById('ctRoomMessages');
      if (box) setTimeout(function () { box.scrollTop = box.scrollHeight; }, 120);
    }
  }

  function appendCustomMessage(msgObj, previewText) {
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    msgObj.id = msgObj.id || ('m-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    msgObj.sender = msgObj.sender || 'me';
    msgObj.time = msgObj.time || nowTime;

    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    msgs.push(msgObj);
    saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);

    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var idx = threads.findIndex(function (t) { return t.id === tid; });
    if (idx !== -1) {
      threads[idx].lastMsg = previewText || msgObj.text || '';
      threads[idx].lastTime = nowTime;
      saveJSON(STORAGE_THREADS_KEY, threads);
    }

    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    var empty = box.querySelector('.ct-empty');
    if (empty) empty.remove();

    var group = document.createElement('div');
    group.className = 'ct-msg-group me';
    group.setAttribute('data-msg-id', msgObj.id);
    group.setAttribute('data-sender-name', '我');
    group.innerHTML =
      '<div class="ct-msg-row me">' +
        '<div class="ct-msg-avatar">我</div>' +
