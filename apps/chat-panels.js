/* =========================================================
   Chat 输入扩展面板、发照片 & 转账模块（独立模块化，不修改 chat.js）
   - 照片：支持单张无框图 + 多张合并叠卡（展开后竖排一张一张显示）
   - 转账：严格复刻微信转账输入页、4x4数字键盘、橙色转账气泡与收款状态
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';

  var SVG_PHOTO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM6 17h12l-3.8-5-2.9 3.6-2-2.4L6 17zm2.5-7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';
  var SVG_TRANSFER_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-4-4"/><path d="M19 15H5l4 4"/></svg>';
  var SVG_TR_ARROWS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9h12l-3.5-3.5"/><path d="M18 15H6l3.5 3.5"/></svg>';
  var SVG_TR_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
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
        '<div class="ct-msg-bubble"></div>' +
      '</div>';
    box.appendChild(group);
    renderBubbleEl(group.querySelector('.ct-msg-bubble'), msgObj);
    box.scrollTop = box.scrollHeight;
  }

  function renderBubbleEl(bubble, msg) {
    if (!bubble || !msg) return;

    if (msg.type === 'transfer') {
      var isDone = msg.status === 'received';
      var isMe = msg.sender === 'me';
      var amtStr = Number(msg.amount || 0).toFixed(2);
      var statusText = isDone
        ? (isMe ? '已被接收' : '已收款')
        : (msg.note ? msg.note : (isMe ? '你发起了一笔转账' : '请收款'));

      bubble.classList.remove('ctp-img-bubble');
      bubble.classList.add('ctp-transfer-bubble');
      bubble.classList.toggle('is-done', isDone);
      bubble.dataset.ctpRendered = '1';
      bubble.setAttribute('data-ctp-transfer', msg.id);
      bubble.innerHTML =
        '<div class="ctp-tr-top">' +
          '<div class="ctp-tr-circle">' + (isDone ? SVG_TR_CHECK : SVG_TR_ARROWS) + '</div>' +
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

    bubble.classList.remove('ctp-transfer-bubble', 'is-done');
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
      // 展开后变成一张一张竖排
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
      if (!m || (m.type !== 'image' && m.type !== 'image_bundle' && m.type !== 'transfer')) return;
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

  function openTransferDetail(msgId) {
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var m = msgs.find(function (item) { return item.id === msgId; });
    if (!m) return;

    detailMsgId = msgId;
    var isDone = m.status === 'received';
    var isMe = m.sender === 'me';
    var iconEl = document.getElementById('ctpTrDetailIcon');
    var stateEl = document.getElementById('ctpTrDetailState');
    var amtEl = document.getElementById('ctpTrDetailAmt');
    var noteEl = document.getElementById('ctpTrDetailNote');
    var btnEl = document.getElementById('ctpTrDetailBtn');
    var timeEl = document.getElementById('ctpTrDetailTime');

    iconEl.classList.toggle('done', isDone);
    iconEl.innerHTML = isDone ? SVG_TR_CHECK : SVG_TR_ARROWS;
    stateEl.textContent = isDone
      ? (isMe ? '对方已收款' : '已收款')
      : (isMe ? '待对方确认收款' : '待你收款');
    amtEl.textContent = '¥' + Number(m.amount || 0).toFixed(2);
    noteEl.textContent = m.note || '';
    noteEl.style.display = m.note ? 'block' : 'none';
    btnEl.style.display = isDone ? 'none' : 'block';
    btnEl.textContent = isMe ? '标记对方已收款' : '确认收款';
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
          '<button class="ctp-tr-detail-btn" id="ctpTrDetailBtn">确认收款</button>' +
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

    document.getElementById('ctpTrSubmit').addEventListener('click', function () {
      var num = parseFloat(transferAmount);
      if (!num || num <= 0) return;
      var amtFixed = Number(num.toFixed(2));
      document.getElementById('ctpTrPage').classList.remove('open');
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

    // 转账详情
    document.getElementById('ctpTrDetailBack').addEventListener('click', function () {
      document.getElementById('ctpTrDetailPage').classList.remove('open');
    });

    document.getElementById('ctpTrDetailBtn').addEventListener('click', function () {
      var tid = resolveCurrentThreadId();
      if (!tid || !detailMsgId) return;
      var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
      var target = msgs.find(function (m) { return m.id === detailMsgId; });
      if (!target) return;
      target.status = 'received';
      saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);

      var bubble = document.querySelector('#ctRoomMessages .ct-msg-group[data-msg-id="' + detailMsgId + '"] .ct-msg-bubble');
      if (bubble) {
        bubble.dataset.ctpRendered = '';
        renderBubbleEl(bubble, target);
      }
      document.getElementById('ctpTrDetailPage').classList.remove('open');
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