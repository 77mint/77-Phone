/* =========================================================
   Chat 输入扩展面板、发照片 & 转账模块（独立模块化，不修改 chat.js）
   - 照片：支持单张无框图 + 多张合并叠卡（展开后竖排一张一张显示）
   - 转账：默认 6 位密码支付（任意 6 位数字）、双方交互收款/退还、褪色气泡、iOS 按键手感
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
  var isPwdMode = true;
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

  function bindPressFeedback(container, selector) {
    if (!container) return;
    var activeEl = null;
    function clear() {
      if (activeEl) {
        activeEl.classList.remove('is-pressed');
        activeEl = null;
      }
    }
    container.addEventListener('touchstart', function (e) {
      var el = e.target.closest(selector);
      clear();
      if (el) {
        activeEl = el;
        el.classList.add('is-pressed');
      }
    }, { passive: true });
    container.addEventListener('touchend', clear, { passive: true });
    container.addEventListener('touchcancel', clear, { passive: true });
    container.addEventListener('mousedown', function (e) {
      var el = e.target.closest(selector);
      clear();
      if (el) {
        activeEl = el;
        el.classList.add('is-pressed');
      }
    });
    window.addEventListener('mouseup', clear);
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
        '<div class="ct-msg-bubble"></div>' +
      '</div>';
    box.appendChild(group);
    renderBubbleEl(group.querySelector('.ct-msg-bubble'), msgObj);
    box.scrollTop = box.scrollHeight;
  }

  function renderBubbleEl(bubble, msg) {
    if (!bubble || !msg) return;

    if (msg.type === 'transfer_tip') {
      var group = bubble.closest('.ct-msg-group');
      if (group) {
        group.innerHTML = '<div class="ctp-sys-tip">' + escapeHtml(msg.text || '') + '</div>';
      }
      return;
    }

    if (msg.type === 'transfer') {
      var st = msg.status || 'pending';
      var isFaded = (st === 'received' || st === 'refunded' || st === 'expired');
      var isMe = msg.sender === 'me';
      var amtStr = Number(msg.amount || 0).toFixed(2);
      var statusText = '';
      var iconSvg = SVG_TR_ARROWS;

      if (st === 'received') {
        statusText = isMe ? '已被接收' : '已收款';
        iconSvg = SVG_TR_CHECK;
      } else if (st === 'refunded') {
        statusText = '已退还';
        iconSvg = SVG_TR_REFUND;
      } else if (st === 'expired') {
        statusText = '已过期';
        iconSvg = SVG_TR_EXPIRED;
      } else {
        statusText = msg.note ? msg.note : (isMe ? '你发起了一笔转账' : '请收款');
        iconSvg = SVG_TR_ARROWS;
      }

      bubble.classList.remove('ctp-img-bubble');
      bubble.classList.add('ctp-transfer-bubble');
      bubble.classList.toggle('is-faded', isFaded);
      bubble.dataset.ctpRendered = '1';
      bubble.setAttribute('data-ctp-transfer', msg.id);
      bubble.innerHTML =
        '<span class="ctp-tr-tail"></span>' +
        '<div class="ctp-tr-top">' +
          '<div class="ctp-tr-circle">' + iconSvg + '</div>' +
          '<div class="ctp-tr-info">' +
            '<div class="ctp-tr-amt">¥' + escapeHtml(amtStr) + '</div>' +
            '<div class="ctp-tr-status">' + escapeHtml(statusText) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ctp-tr-foot">转账</div>';
      return;
    }

    var imgs = Array.isArray(msg.images) ? msg.images : [];
    if (!imgs.length) return;

    bubble.classList.remove('ctp-transfer-bubble', 'is-faded');
    bubble.classList.add('ctp-img-bubble');
    bubble.dataset.ctpRendered = '1';

    if (msg.type === 'image' || imgs.length === 1) {
      bubble.innerHTML =
        '<img class="ctp-single-img" decoding="async" data-ctp-preview="' + escapeHtml(imgs[0]) + '" src="' + escapeHtml(imgs[0]) + '" alt="">';
      return;
    }

    var isExpanded = !!expandedBundles[msg.id];
    if (!isExpanded) {
      var layers = imgs.slice(0, 3);
      var stackHtml = layers.map(function (src, idx) {
        return '<div class="ctp-stack-card layer-' + idx + '" data-ctp-preview="' + escapeHtml(src) + '">' +
          '<img decoding="async" src="' + escapeHtml(src) + '" alt="">' +
        '</div>';
      }).join('');
      bubble.innerHTML =
        '<div class="ctp-bundle-row">' +
          '<button class="ctp-expand-pill" data-ctp-toggle="' + escapeHtml(msg.id) + '">展开 ' + imgs.length + '</button>' +
          '<div class="ctp-stack">' + stackHtml + '</div>' +
        '</div>';
    } else {
      var listHtml = imgs.map(function (src, idx) {
        var imgTag = '<img class="ctp-expanded-img" decoding="async" data-ctp-preview="' + escapeHtml(src) + '" src="' + escapeHtml(src) + '" alt="">';
        if (idx === 0) {
          return '<div class="ctp-expanded-first">' +
            '<button class="ctp-expand-pill" data-ctp-toggle="' + escapeHtml(msg.id) + '">收起</button>' +
            imgTag +
          '</div>';
        }
        return imgTag;
      }).join('');
      bubble.innerHTML = '<div class="ctp-expanded-wrap">' + listHtml + '</div>';
    }
  }

  function decorateRoomMessages() {
    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    if (!msgs.length) return;

    var map = {};
    msgs.forEach(function (m) { map[m.id] = m; });

    box.querySelectorAll('.ct-msg-group[data-msg-id]').forEach(function (group) {
      var mid = group.getAttribute('data-msg-id');
      var m = map[mid];
      if (!m || (m.type !== 'image' && m.type !== 'image_bundle' && m.type !== 'transfer' && m.type !== 'transfer_tip')) return;
      var bubble = group.querySelector('.ct-msg-bubble');
      if (bubble && bubble.dataset.ctpRendered !== '1') {
        renderBubbleEl(bubble, m);
      }
    });
  }

  function openMultiSheet(urls) {
    pendingPhotos = urls.slice();
    mergePhotos = true;
    var thumbsEl = document.getElementById('ctpMultiThumbs');
    var checkEl = document.getElementById('ctpMultiCheck');
    var sendEl = document.getElementById('ctpMultiSend');
    if (thumbsEl) {
      thumbsEl.innerHTML = pendingPhotos.map(function (src) {
        return '<img class="ctp-multi-thumb" src="' + escapeHtml(src) + '" alt="">';
      }).join('');
    }
    if (checkEl) {
      checkEl.classList.add('on');
      checkEl.innerHTML = SVG_CHECK;
    }
    if (sendEl) sendEl.textContent = '发送 (' + pendingPhotos.length + ')';
    document.getElementById('ctpMultiMask').classList.add('open');
  }

  function syncTransferUI() {
    var valEl = document.getElementById('ctpTrVal');
    var submitEl = document.getElementById('ctpTrSubmit');
    var noteEl = document.getElementById('ctpTrNoteBtn');
    if (valEl) valEl.textContent = transferAmount;
    var num = parseFloat(transferAmount);
    if (submitEl) submitEl.classList.toggle('disabled', !num || num <= 0);
    if (noteEl) {
      if (transferNote) {
        noteEl.classList.add('has-note');
        noteEl.innerHTML = escapeHtml(transferNote) + '<span>修改</span>';
      } else {
        noteEl.classList.remove('has-note');
        noteEl.textContent = '添加转账说明';
      }
    }
  }

  function openTransferPage() {
    setDrawerOpen(false);
    transferAmount = '';
    transferNote = '';
    var peer = getPeerInfo();
    document.getElementById('ctpTrPeerName').textContent = '转账给 ' + peer.name;
    document.getElementById('ctpTrPeerId').textContent = '微信号: ' + peer.wxid;
    var avEl = document.getElementById('ctpTrPeerAv');
    if (peer.avatar) {
      avEl.innerHTML = '<img src="' + escapeHtml(peer.avatar) + '" onerror="this.parentNode.textContent=\'' + escapeHtml(peer.name.slice(0, 1)) + '\'" alt="">';
    } else {
      avEl.textContent = peer.name.slice(0, 1);
    }
    syncTransferUI();
    document.getElementById('ctpTrPage').classList.add('open');
  }

  function syncWxPaySheet() {
    var peer = getPeerInfo();
    var sheet = document.getElementById('ctpWxPaySheet');
    var modeBtn = document.getElementById('ctpWxPayModeBtn');
    var cardIco = document.getElementById('ctpWxPayCardIco');
    var cardName = document.getElementById('ctpWxPayCardName');

    document.getElementById('ctpWxPayTo').textContent = '向 ' + peer.name + ' 转账';
    document.getElementById('ctpWxPayAmt').textContent = '¥ ' + pendingPayAmount.toFixed(2);
    sheet.classList.toggle('is-pwd', isPwdMode);
    modeBtn.textContent = isPwdMode ? '使用面容' : '使用密码';

    if (selectedPayMethod === 'wallet') {
      cardIco.className = 'ctp-pay-coin';
      cardIco.textContent = '¥';
      cardName.textContent = '零钱';
    } else {
      cardIco.className = 'ctp-pay-card-ico';
      cardIco.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
      cardName.textContent = '招商银行储蓄卡 (8888)';
    }
    syncPwdDots();
  }

  function openWxPaySheet(amt) {
    pendingPayAmount = amt;
    var bal = getWalletBalance();
    selectedPayMethod = bal >= amt ? 'wallet' : 'bank';
    isPwdMode = true;
    payPassword = '';

    document.getElementById('ctpPayHud').classList.add('open');
    setTimeout(function () {
      document.getElementById('ctpPayHud').classList.remove('open');
      syncWxPaySheet();
      document.getElementById('ctpWxPayMask').classList.add('open');
    }, 380);
  }

  function openPayMethodDrawer() {
    var bal = getWalletBalance();
    var enough = bal >= pendingPayAmount;
    document.getElementById('ctpPaySub').textContent = '微信转账 ¥' + pendingPayAmount.toFixed(2);
    document.getElementById('ctpPayWalletName').textContent = '零钱 (剩余 ¥' + bal.toFixed(2) + ')';
    document.getElementById('ctpPayWalletDesc').textContent = enough ? '优先使用零钱支付' : ('零钱不足，剩余 ' + bal.toFixed(2) + '元');
    document.getElementById('ctpPayWalletRow').style.opacity = enough ? '1' : '0.45';
    document.getElementById('ctpPayWalletTick').style.visibility = selectedPayMethod === 'wallet' ? 'visible' : 'hidden';
    document.getElementById('ctpPayBankTick').style.visibility = selectedPayMethod === 'bank' ? 'visible' : 'hidden';
    document.getElementById('ctpPayMask').classList.add('open');
  }

  function syncPwdDots() {
    var cells = document.querySelectorAll('#ctpPwdBoxes .ctp-pwd-cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].innerHTML = i < payPassword.length ? '<span class="ctp-pwd-dot"></span>' : '';
    }
  }

  function completeTransferPayment() {
    var amtFixed = pendingPayAmount;
    if (!amtFixed || amtFixed <= 0) return;
    if (selectedPayMethod === 'wallet') {
      setWalletBalance(getWalletBalance() - amtFixed);
    }
    var peer = getPeerInfo();
    document.getElementById('ctpWxPayMask').classList.remove('open');
    document.getElementById('ctpPayHud').classList.add('open');
    setTimeout(function () {
      document.getElementById('ctpPayHud').classList.remove('open');
      document.getElementById('ctpDoneTo').textContent = '向 ' + peer.name + ' 转账';
      document.getElementById('ctpDoneAmt').textContent = '¥' + amtFixed.toFixed(2);
      document.getElementById('ctpDoneMethod').textContent = selectedPayMethod === 'wallet' ? '零钱' : '招商银行储蓄卡 (8888)';
      document.getElementById('ctpDonePage').classList.add('open');
    }, 340);
  }

  function updateIncomingTransfer(msgId, nextStatus) {
    var tid = resolveCurrentThreadId();
    if (!tid || !msgId) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var target = msgs.find(function (m) { return m.id === msgId; });
    if (!target || target.sender === 'me' || target.status !== 'pending') return;

    target.status = nextStatus;
    if (nextStatus === 'received') {
      setWalletBalance(getWalletBalance() + Number(target.amount || 0));
    }

    var tipText = nextStatus === 'received'
      ? ('你已收款 ¥' + Number(target.amount || 0).toFixed(2))
      : ('你已退还对方的转账 ¥' + Number(target.amount || 0).toFixed(2));
    var tipMsg = {
      id: 'm-tip-' + Date.now(),
      sender: 'me',
      type: 'transfer_tip',
      text: tipText,
      time: ''
    };
    msgs.push(tipMsg);
    saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);

    var bubble = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + msgId + '"] .ct-msg-bubble');
    if (bubble) {
      bubble.dataset.ctpRendered = '';
      renderBubbleEl(bubble, target);
    }

    var box = document.getElementById('ctRoomMessages');
    if (box) {
      var tipEl = document.createElement('div');
      tipEl.className = 'ct-msg-group me';
      tipEl.setAttribute('data-msg-id', tipMsg.id);
      tipEl.innerHTML = '<div class="ctp-sys-tip">' + escapeHtml(tipText) + '</div>';
      box.appendChild(tipEl);
      box.scrollTop = box.scrollHeight;
    }

    document.getElementById('ctpTrDetailPage').classList.remove('open');
    window.dispatchEvent(new CustomEvent('phone-chat-transfer-action', {
      detail: { threadId: tid, msgId: msgId, action: nextStatus, amount: Number(target.amount || 0) }
    }));
  }

  function openTransferDetail(msgId) {
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var m = msgs.find(function (item) { return item.id === msgId; });
    if (!m) return;

    detailMsgId = msgId;
    var st = m.status || 'pending';
    var isMe = m.sender === 'me';
    var iconEl = document.getElementById('ctpTrDetailIcon');
    var stateEl = document.getElementById('ctpTrDetailState');
    var amtEl = document.getElementById('ctpTrDetailAmt');
    var noteEl = document.getElementById('ctpTrDetailNote');
    var actionsEl = document.getElementById('ctpTrDetailActions');
    var timeEl = document.getElementById('ctpTrDetailTime');

    iconEl.classList.remove('done', 'faded');
    if (st === 'received') {
      iconEl.classList.add('done');
      iconEl.innerHTML = SVG_TR_CHECK;
      stateEl.textContent = isMe ? '对方已收款' : '已收款，已存入零钱';
    } else if (st === 'refunded') {
      iconEl.classList.add('faded');
      iconEl.innerHTML = SVG_TR_REFUND;
      stateEl.textContent = '已退还';
    } else if (st === 'expired') {
      iconEl.classList.add('faded');
      iconEl.innerHTML = SVG_TR_EXPIRED;
      stateEl.textContent = '转账已过期';
    } else {
      iconEl.innerHTML = SVG_TR_ARROWS;
      stateEl.textContent = isMe ? '待对方确认收款' : '待你收款';
    }

    amtEl.textContent = '¥' + Number(m.amount || 0).toFixed(2);
    noteEl.textContent = m.note || '';
    noteEl.style.display = m.note ? 'block' : 'none';
    // 我发出的不能由我手动标记对方已收款；只有对方发来的待收款才能点收款/退还
    actionsEl.style.display = (!isMe && st === 'pending') ? 'flex' : 'none';
    timeEl.textContent = m.time ? ('转账时间：' + m.time) : '';

    document.getElementById('ctpTrDetailPage').classList.add('open');
  }

  function ensureUI() {
    var room = document.getElementById('ctRoomView');
    if (!room || document.getElementById('ctpDrawer')) return;

    var drawer = document.createElement('div');
    drawer.className = 'ctp-drawer';
    drawer.id = 'ctpDrawer';
    drawer.innerHTML =
      '<div class="ctp-grid">' +
        '<button class="ctp-item" id="ctpBtnPhoto">' +
          '<div class="ctp-item-icon">' + SVG_PHOTO + '</div>' +
          '<div class="ctp-item-label">照片</div>' +
        '</button>' +
        '<button class="ctp-item" id="ctpBtnTransfer">' +
          '<div class="ctp-item-icon">' + SVG_TRANSFER_TILE + '</div>' +
          '<div class="ctp-item-label">转账</div>' +
        '</button>' +
      '</div>';
    room.appendChild(drawer);

    var extra = document.createElement('div');
    extra.innerHTML =
      '<input type="file" id="ctpPhotoInput" accept="image/*" multiple style="display:none;">' +
      '<div class="ctp-tr-page" id="ctpTrPage">' +
        '<div class="ctp-tr-nav">' +
          '<button class="ctp-tr-back" id="ctpTrBack" aria-label="返回">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ctp-tr-peer">' +
          '<div class="ctp-tr-peer-text">' +
            '<div class="ctp-tr-peer-name" id="ctpTrPeerName"></div>' +
            '<div class="ctp-tr-peer-id" id="ctpTrPeerId"></div>' +
          '</div>' +
          '<div class="ctp-tr-peer-av" id="ctpTrPeerAv"></div>' +
        '</div>' +
        '<div class="ctp-tr-card">' +
          '<div class="ctp-tr-card-label">转账金额</div>' +
          '<div class="ctp-tr-amt-row">' +
            '<span class="ctp-tr-yen">¥</span>' +
            '<span class="ctp-tr-val" id="ctpTrVal"></span>' +
            '<span class="ctp-tr-cursor"></span>' +
          '</div>' +
          '<button class="ctp-tr-note-btn" id="ctpTrNoteBtn">添加转账说明</button>' +
        '</div>' +
        '<div class="ctp-keypad" id="ctpKeypad">' +
          '<button class="ctp-key" data-key="1">1</button>' +
          '<button class="ctp-key" data-key="2">2</button>' +
          '<button class="ctp-key" data-key="3">3</button>' +
          '<button class="ctp-key" data-key="del" aria-label="删除">' + SVG_BACKSPACE + '</button>' +
          '<button class="ctp-key" data-key="4">4</button>' +
          '<button class="ctp-key" data-key="5">5</button>' +
          '<button class="ctp-key" data-key="6">6</button>' +
          '<button class="ctp-key" data-key="7">7</button>' +
          '<button class="ctp-key" data-key="8">8</button>' +
          '<button class="ctp-key" data-key="9">9</button>' +
          '<button class="ctp-key ctp-key-zero" data-key="0">0</button>' +
          '<button class="ctp-key" data-key=".">.</button>' +
          '<button class="ctp-key ctp-key-submit disabled" id="ctpTrSubmit">转账</button>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-pay-hud" id="ctpPayHud">' +
        '<div class="ctp-pay-hud-box">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.5 1.3 4.8 3.5 6.3L4.5 21l3.6-1.8c1.2.4 2.5.6 3.9.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3zm4.6 6.4l-5.3 5.3-3-3 1.2-1.2 1.8 1.8 4.1-4.1 1.2 1.2z"/></svg>' +
          '<div class="ctp-pay-hud-txt">微信支付</div>' +
          '<div class="ctp-pay-dots"><span></span><span></span><span></span></div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-wxpay-mask" id="ctpWxPayMask">' +
        '<div class="ctp-wxpay-sheet" id="ctpWxPaySheet">' +
          '<div class="ctp-wxpay-top">' +
            '<div class="ctp-wxpay-bar">' +
              '<button class="ctp-wxpay-x" id="ctpWxPayClose" aria-label="关闭">×</button>' +
              '<button class="ctp-wxpay-mode-btn" id="ctpWxPayModeBtn">使用面容</button>' +
            '</div>' +
            '<div class="ctp-wxpay-to" id="ctpWxPayTo"></div>' +
            '<div class="ctp-wxpay-amt" id="ctpWxPayAmt"></div>' +
            '<div class="ctp-wxpay-divider"></div>' +
            '<div class="ctp-wxpay-method-head">' +
              '<span>付款方式</span>' +
              '<button class="ctp-wxpay-change" id="ctpWxPayChange">更改 ⌄</button>' +
            '</div>' +
            '<div class="ctp-wxpay-card" id="ctpWxPayCard">' +
              '<div class="ctp-wxpay-card-left">' +
                '<div class="ctp-pay-coin" id="ctpWxPayCardIco">¥</div>' +
                '<span id="ctpWxPayCardName">零钱</span>' +
              '</div>' +
              '<div class="ctp-pay-tick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
            '</div>' +
          '</div>' +
          '<div class="ctp-wxpay-face-area">' +
            '<button class="ctp-wxpay-face-btn" id="ctpWxPayFaceBtn">支付</button>' +
          '</div>' +
          '<div class="ctp-wxpay-pwd-area">' +
            '<div class="ctp-pwd-boxes" id="ctpPwdBoxes">' +
              '<div class="ctp-pwd-cell"></div>' +
              '<div class="ctp-pwd-cell"></div>' +
              '<div class="ctp-pwd-cell"></div>' +
              '<div class="ctp-pwd-cell"></div>' +
              '<div class="ctp-pwd-cell"></div>' +
              '<div class="ctp-pwd-cell"></div>' +
            '</div>' +
            '<div class="ctp-pwd-pad" id="ctpPwdPad">' +
              '<button class="ctp-pwd-key" data-pkey="1">1</button>' +
              '<button class="ctp-pwd-key" data-pkey="2">2</button>' +
              '<button class="ctp-pwd-key" data-pkey="3">3</button>' +
              '<button class="ctp-pwd-key" data-pkey="4">4</button>' +
              '<button class="ctp-pwd-key" data-pkey="5">5</button>' +
              '<button class="ctp-pwd-key" data-pkey="6">6</button>' +
              '<button class="ctp-pwd-key" data-pkey="7">7</button>' +
              '<button class="ctp-pwd-key" data-pkey="8">8</button>' +
              '<button class="ctp-pwd-key" data-pkey="9">9</button>' +
              '<div class="ctp-pwd-key is-muted"></div>' +
              '<button class="ctp-pwd-key" data-pkey="0">0</button>' +
              '<button class="ctp-pwd-key is-muted" data-pkey="del" aria-label="删除">' + SVG_BACKSPACE + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-pay-mask" id="ctpPayMask">' +
        '<div class="ctp-pay-sheet">' +
          '<div class="ctp-pay-head">' +
            '<button class="ctp-pay-close" id="ctpPayClose" aria-label="关闭">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
            '</button>' +
            '<div class="ctp-pay-title-wrap">' +
              '<div class="ctp-pay-title">选择付款方式</div>' +
              '<div class="ctp-pay-sub" id="ctpPaySub"></div>' +
            '</div>' +
            '<div class="ctp-pay-combo">组合支付</div>' +
          '</div>' +
          '<div class="ctp-pay-row" id="ctpPayWalletRow">' +
            '<div class="ctp-pay-row-left">' +
              '<div class="ctp-pay-coin">¥</div>' +
              '<div>' +
                '<div class="ctp-pay-name" id="ctpPayWalletName">零钱</div>' +
                '<div class="ctp-pay-desc" id="ctpPayWalletDesc"></div>' +
              '</div>' +
            '</div>' +
            '<div class="ctp-pay-tick" id="ctpPayWalletTick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
          '</div>' +
          '<div class="ctp-pay-sec-label">银行卡</div>' +
          '<div class="ctp-pay-row" id="ctpPayBankRow">' +
            '<div class="ctp-pay-row-left">' +
              '<div class="ctp-pay-card-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>' +
              '<div>' +
                '<div class="ctp-pay-name">招商银行储蓄卡 (8888)</div>' +
                '<div class="ctp-pay-desc">单日限额 ¥50000</div>' +
              '</div>' +
            '</div>' +
            '<div class="ctp-pay-tick" id="ctpPayBankTick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
          '</div>' +
          '<div class="ctp-pay-legal">本服务由小手机本地模拟提供</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-done-page" id="ctpDonePage">' +
        '<div class="ctp-done-badge">' +
          '<span class="ctp-done-circle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
          '<span>支付成功</span>' +
        '</div>' +
        '<div class="ctp-done-to" id="ctpDoneTo"></div>' +
        '<div class="ctp-done-amt" id="ctpDoneAmt"></div>' +
        '<div class="ctp-done-row"><span>付款方式</span><span id="ctpDoneMethod"></span></div>' +
        '<button class="ctp-done-btn" id="ctpDoneBtn">完成</button>' +
      '</div>' +
      '<div class="ctp-tr-detail" id="ctpTrDetailPage">' +
        '<div class="ctp-tr-nav">' +
          '<button class="ctp-tr-back" id="ctpTrDetailBack" aria-label="返回">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ctp-tr-detail-body">' +
          '<div class="ctp-tr-detail-icon" id="ctpTrDetailIcon"></div>' +
          '<div class="ctp-tr-detail-state" id="ctpTrDetailState"></div>' +
          '<div class="ctp-tr-detail-amt" id="ctpTrDetailAmt"></div>' +
          '<div class="ctp-tr-detail-note" id="ctpTrDetailNote"></div>' +
          '<div class="ctp-tr-detail-actions" id="ctpTrDetailActions">' +
            '<button class="ctp-tr-detail-btn" id="ctpTrDetailBtn">确认收款</button>' +
            '<button class="ctp-tr-detail-link" id="ctpTrRefundBtn">立即退还</button>' +
          '</div>' +
          '<div class="ctp-tr-detail-time" id="ctpTrDetailTime"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-note-mask" id="ctpNoteMask">' +
        '<div class="ctp-note-box">' +
          '<div class="ctp-note-head">添加转账说明</div>' +
          '<div class="ctp-note-inp-wrap"><input class="ctp-note-inp" id="ctpNoteInp" maxlength="20" placeholder="最多20个字"></div>' +
          '<div class="ctp-note-btns">' +
            '<button class="ctp-note-btn" id="ctpNoteCancel">取消</button>' +
            '<button class="ctp-note-btn" id="ctpNoteOk">确定</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-multi-mask" id="ctpMultiMask">' +
        '<div class="ctp-multi-sheet">' +
          '<div class="ctp-multi-thumbs" id="ctpMultiThumbs"></div>' +
          '<div class="ctp-multi-toggle" id="ctpMultiToggle">' +
            '<div class="ctp-multi-check on" id="ctpMultiCheck">' + SVG_CHECK + '</div>' +
            '<span>发送后合并展示</span>' +
          '</div>' +
          '<div class="ctp-multi-foot">' +
            '<button class="ctp-multi-cancel" id="ctpMultiCancel">取消</button>' +
            '<button class="ctp-multi-send" id="ctpMultiSend">发送</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-lightbox" id="ctpLightbox"><img id="ctpLightboxImg" src="" alt=""></div>';
    while (extra.firstChild) room.appendChild(extra.firstChild);

    bindEvents();
  }

  function bindEvents() {
    var room = document.getElementById('ctRoomView');
    var plusBtn = document.getElementById('ctRoomPlusBtn');
    var inputEl = document.getElementById('ctRoomInput');
    var voiceBtn = document.getElementById('ctRoomVoiceBtn');
    var backBtn = document.getElementById('ctRoomBackBtn');
    var msgBox = document.getElementById('ctRoomMessages');
    var mainScroll = document.getElementById('ctMainScroll');

    // 统一给手机端按键和卡片加上实时按压手感
    bindPressFeedback(document.getElementById('ctpDrawer'), '.ctp-item');
    bindPressFeedback(document.getElementById('ctpKeypad'), '.ctp-key');
    bindPressFeedback(document.getElementById('ctpPwdPad'), '.ctp-pwd-key');
    bindPressFeedback(document.getElementById('ctpWxPaySheet'), '.ctp-wxpay-card, .ctp-wxpay-face-btn');
    bindPressFeedback(msgBox, '.ctp-transfer-bubble, .ctp-expand-pill');

    if (mainScroll) {
      mainScroll.addEventListener('click', function (e) {
        var row = e.target.closest('.ct-row[data-thread-id]');
        if (row) activeThreadId = row.getAttribute('data-thread-id') || '';
      }, true);
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        setDrawerOpen(!drawerOpen);
      }, true);
    }

    if (inputEl) {
      inputEl.addEventListener('focus', function () {
        if (drawerOpen) setDrawerOpen(false);
      });
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        if (drawerOpen) setDrawerOpen(false);
      }, true);
    }

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        setDrawerOpen(false);
        activeThreadId = '';
      }, true);
    }

    if (msgBox) {
      msgBox.addEventListener('click', function (e) {
        var toggleBtn = e.target.closest('[data-ctp-toggle]');
        if (toggleBtn) {
          e.stopPropagation();
          var mid = toggleBtn.getAttribute('data-ctp-toggle');
          expandedBundles[mid] = !expandedBundles[mid];
          var group = toggleBtn.closest('.ct-msg-group');
          var bubble = group && group.querySelector('.ct-msg-bubble');
          var tid = resolveCurrentThreadId();
          var msgs = tid ? loadJSON(STORAGE_MSGS_PREFIX + tid, []) : [];
          var target = msgs.find(function (m) { return m.id === mid; });
          if (bubble && target) {
            bubble.dataset.ctpRendered = '';
            renderBubbleEl(bubble, target);
          }
          return;
        }

        var trEl = e.target.closest('[data-ctp-transfer]');
        if (trEl) {
          e.stopPropagation();
          openTransferDetail(trEl.getAttribute('data-ctp-transfer'));
          return;
        }

        var previewEl = e.target.closest('[data-ctp-preview]');
        if (previewEl) {
          e.stopPropagation();
          var src = previewEl.getAttribute('data-ctp-preview');
          if (src) {
            document.getElementById('ctpLightboxImg').src = src;
            document.getElementById('ctpLightbox').classList.add('open');
          }
          return;
        }

        if (drawerOpen) setDrawerOpen(false);
      });

      var observer = new MutationObserver(decorateRoomMessages);
      observer.observe(msgBox, { childList: true });
    }

    // 照片
    document.getElementById('ctpBtnPhoto').addEventListener('click', function () {
      if (photoBusy) return;
      photoBusy = true;
      setTimeout(function () { photoBusy = false; }, 1200);
      document.getElementById('ctpPhotoInput').click();
    });

    document.getElementById('ctpPhotoInput').addEventListener('change', function () {
      var fileInput = this;
      var files = Array.prototype.slice.call(fileInput.files || []).slice(0, 9);
      if (!files.length) {
        fileInput.value = '';
        photoBusy = false;
        return;
      }
      setTimeout(function () {
        Promise.all(files.map(function (f) { return compressPhoto(f, 900, 0.8); })).then(function (urls) {
          fileInput.value = '';
          photoBusy = false;
          var valid = urls.filter(Boolean);
          if (!valid.length) return;
          if (valid.length === 1) {
            appendCustomMessage({ type: 'image', images: valid, text: '[图片]' }, '[图片]');
          } else {
            openMultiSheet(valid);
          }
        });
      }, 320);
    });

    // 转账入口与键盘
    document.getElementById('ctpBtnTransfer').addEventListener('click', openTransferPage);
    document.getElementById('ctpTrBack').addEventListener('click', function () {
      document.getElementById('ctpTrPage').classList.remove('open');
    });

    document.getElementById('ctpKeypad').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-key]');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      if (k === 'del') {
        transferAmount = transferAmount.slice(0, -1);
      } else if (k === '.') {
        if (transferAmount.indexOf('.') !== -1) return;
        transferAmount = transferAmount ? (transferAmount + '.') : '0.';
      } else {
        var dotIdx = transferAmount.indexOf('.');
        if (dotIdx !== -1 && transferAmount.length - dotIdx > 2) return;
        if (transferAmount === '0') {
          transferAmount = k;
        } else {
          if (transferAmount.replace('.', '').length >= 8) return;
          transferAmount += k;
        }
      }
      syncTransferUI();
    });

    // 点绿色「转账」→ 微信支付 HUD → 默认进入 6 位密码支付弹窗
    document.getElementById('ctpTrSubmit').addEventListener('click', function () {
      var num = parseFloat(transferAmount);
      if (!num || num <= 0) return;
      openWxPaySheet(Number(num.toFixed(2)));
    });

    document.getElementById('ctpWxPayClose').addEventListener('click', function () {
      document.getElementById('ctpWxPayMask').classList.remove('open');
    });

    document.getElementById('ctpWxPayModeBtn').addEventListener('click', function () {
      isPwdMode = !isPwdMode;
      payPassword = '';
      syncWxPaySheet();
    });

    document.getElementById('ctpWxPayChange').addEventListener('click', openPayMethodDrawer);
    document.getElementById('ctpWxPayCard').addEventListener('click', openPayMethodDrawer);

    document.getElementById('ctpWxPayFaceBtn').addEventListener('click', completeTransferPayment);

    document.getElementById('ctpPwdPad').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pkey]');
      if (!btn) return;
      var k = btn.getAttribute('data-pkey');
      if (k === 'del') {
        payPassword = payPassword.slice(0, -1);
        syncPwdDots();
        return;
      }
      if (payPassword.length >= 6) return;
      payPassword += k;
      syncPwdDots();
      if (payPassword.length === 6) {
        setTimeout(completeTransferPayment, 160);
      }
    });

    // 选择付款方式抽屉
    document.getElementById('ctpPayClose').addEventListener('click', function () {
      document.getElementById('ctpPayMask').classList.remove('open');
    });

    document.getElementById('ctpPayWalletRow').addEventListener('click', function () {
      if (getWalletBalance() < pendingPayAmount) return;
      selectedPayMethod = 'wallet';
      document.getElementById('ctpPayMask').classList.remove('open');
      syncWxPaySheet();
    });

    document.getElementById('ctpPayBankRow').addEventListener('click', function () {
      selectedPayMethod = 'bank';
      document.getElementById('ctpPayMask').classList.remove('open');
      syncWxPaySheet();
    });

    // 支付成功完成页 → 点完成发进聊天
    document.getElementById('ctpDoneBtn').addEventListener('click', function () {
      var amtFixed = pendingPayAmount;
      document.getElementById('ctpDonePage').classList.remove('open');
      document.getElementById('ctpTrPage').classList.remove('open');
      if (!amtFixed || amtFixed <= 0) return;
      appendCustomMessage({
        type: 'transfer',
        amount: amtFixed,
        note: transferNote,
        status: 'pending',
        text: '[转账] ¥' + amtFixed.toFixed(2)
      }, '[转账] ¥' + amtFixed.toFixed(2));
    });

    document.getElementById('ctpTrNoteBtn').addEventListener('click', function () {
      var inp = document.getElementById('ctpNoteInp');
      inp.value = transferNote;
      document.getElementById('ctpNoteMask').classList.add('open');
      setTimeout(function () { inp.focus(); }, 80);
    });

    document.getElementById('ctpNoteCancel').addEventListener('click', function () {
      document.getElementById('ctpNoteMask').classList.remove('open');
    });

    document.getElementById('ctpNoteOk').addEventListener('click', function () {
      transferNote = (document.getElementById('ctpNoteInp').value || '').trim();
      document.getElementById('ctpNoteMask').classList.remove('open');
      syncTransferUI();
    });

    // 对方发来的转账详情交互（收款 / 退还）
    document.getElementById('ctpTrDetailBack').addEventListener('click', function () {
      document.getElementById('ctpTrDetailPage').classList.remove('open');
    });

    document.getElementById('ctpTrDetailBtn').addEventListener('click', function () {
      updateIncomingTransfer(detailMsgId, 'received');
    });
    document.getElementById('ctpTrRefundBtn').addEventListener('click', function () {
      updateIncomingTransfer(detailMsgId, 'refunded');
    });

    // 多图合并发送确认
    document.getElementById('ctpMultiToggle').addEventListener('click', function () {
      mergePhotos = !mergePhotos;
      document.getElementById('ctpMultiCheck').classList.toggle('on', mergePhotos);
      document.getElementById('ctpMultiCheck').innerHTML = mergePhotos ? SVG_CHECK : '';
    });

    document.getElementById('ctpMultiCancel').addEventListener('click', function () {
      pendingPhotos = [];
      document.getElementById('ctpMultiMask').classList.remove('open');
    });

    document.getElementById('ctpMultiSend').addEventListener('click', function () {
      var list = pendingPhotos.slice();
      pendingPhotos = [];
      document.getElementById('ctpMultiMask').classList.remove('open');
      if (!list.length) return;
      if (mergePhotos && list.length > 1) {
        appendCustomMessage({ type: 'image_bundle', images: list, text: '[图片]' }, '[图片]');
      } else {
        list.forEach(function (src) {
          appendCustomMessage({ type: 'image', images: [src], text: '[图片]' }, '[图片]');
        });
      }
    });

    document.getElementById('ctpLightbox').addEventListener('click', function () {
      this.classList.remove('open');
    });

    if (room) {
      var roomObs = new MutationObserver(function () {
        if (!room.classList.contains('open') && drawerOpen) setDrawerOpen(false);
      });
      roomObs.observe(room, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUI);
  } else {
    ensureUI();
  }
})();