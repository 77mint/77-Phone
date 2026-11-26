/* =========================================================
   Chat 输入扩展面板、发照片、转账、礼物 & 问小九模块 (apps/chat-panels.js)
   - 第 1 页固定 8 格：照片、转账、礼物、问小九、位置、收藏、个人名片、一起听
   - 第 2 页：文件
   - 「一起听」防误吞快速轻点直达 window.PhoneChatListen.openSongModal()
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
  var STORAGE_WALLET_KEY = 'chat_wallet_balance_v1';
  var STORAGE_FAVS_KEY = 'chat_favorites_v1';

  var SVG_PHOTO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM6 17h12l-3.8-5-2.9 3.6-2-2.4L6 17zm2.5-7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';
  var SVG_TRANSFER_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-4-4"/><path d="M19 15H5l4 4"/></svg>';
  var SVG_GIFT_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 8 12 8s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
  var SVG_ASK9_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8.2" cy="12" rx="2.4" ry="3.3"/><ellipse cx="15.8" cy="12" rx="2.4" ry="3.3"/></svg>';
  var SVG_LOC_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  var SVG_FAV_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
  var SVG_CARD_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c0-3.8 3.3-6 7.5-6s7.5 2.2 7.5 6"/></svg>';
  var SVG_LISTEN_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
  var SVG_FILE_TILE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';

  var SVG_CLOSE_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var SVG_CROSSHAIR = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  var SVG_CHEVRON_R = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  var SVG_CHEVRON_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  var SVG_PIN_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var SVG_PIN_MD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var SVG_BOOKMARK_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var SVG_DOC_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var SVG_DOC_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var SVG_ASK9_SM = '<svg width="13" height="10" viewBox="0 0 24 18" fill="currentColor"><ellipse cx="7" cy="9" rx="3" ry="3.8"/><ellipse cx="17" cy="9" rx="3" ry="3.8"/></svg>';

  var SVG_GIFT_BOW = '<svg width="34" height="34" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19C17 12.5 12.2 10.5 9.2 12.5C6.5 14.3 7.2 18.8 11.2 19.6C14.2 20.2 17.5 19.6 20 19Z"/><path d="M20 19C23 12.5 27.8 10.5 30.8 12.5C33.5 14.3 32.8 18.8 28.8 19.6C25.8 20.2 22.5 19.6 20 19Z"/><path d="M20 19L10.5 30.5"/><path d="M20 19L29.5 30.5"/></svg>';
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
  var detailGiftMsgId = '';

  var lastAsk9Question = '';
  var lastAsk9Answer = '';
  var ask9Busy = false;

  function ensureGiftExtraStyles() {
    if (document.getElementById('ctpGiftExtraStyle')) return;
    var st = document.createElement('style');
    st.id = 'ctpGiftExtraStyle';
    st.textContent =
      '.ctp-gift-mask { position: absolute; inset: 0; z-index: 66; background: rgba(0, 0, 0, 0.42); display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; pointer-events: none; transition: opacity 0.24s cubic-bezier(0.32, 0.72, 0, 1); }' +
      '.ctp-gift-mask.open { opacity: 1; pointer-events: auto; }' +
      '.ctp-gift-modal { width: 100%; max-width: 312px; border-radius: 24px; overflow: hidden; background: #ffffff; color: #111111; box-shadow: 0 22px 48px rgba(0, 0, 0, 0.24); font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif); transform: translateY(14px) scale(0.92); transition: transform 0.3s cubic-bezier(0.34, 1.38, 0.64, 1); }' +
      '.ctp-gift-mask.open .ctp-gift-modal { transform: translateY(0) scale(1); }' +
      '.ctp-gift-banner { position: relative; padding: 22px 18px 16px; background-color: #16468a; background-image: radial-gradient(1.4px 1.4px at 14% 24%, rgba(255,255,255,0.85) 0, transparent 100%), linear-gradient(160deg, #1b4f99 0%, #144080 58%, #10366e 100%); color: #f4dfb4; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }' +
      '.ctp-gift-banner-bow { color: #ebd3a3; display: flex; align-items: center; justify-content: center; }' +
      '.ctp-gift-banner-title { font-size: calc(var(--app-font-size, 15px) + 2px); font-weight: 700; color: #f4dfb4; line-height: 1.3; word-break: break-word; }' +
      '.ctp-gift-banner-sub { font-size: calc(var(--app-font-size, 15px) - 3px); color: rgba(255,255,255,0.76); }' +
      '.ctp-gift-form { padding: 16px; display: flex; flex-direction: column; gap: 11px; }' +
      '.ctp-gift-field-label { font-size: calc(var(--app-font-size, 15px) - 2px); font-weight: 600; color: #8e8e93; margin-bottom: 4px; }' +
      '.ctp-gift-inp { width: 100%; box-sizing: border-box; border: none; outline: none; background: #f2f2f7; color: #111111; border-radius: 14px; padding: 11px 13px; font-family: inherit; font-size: max(16px, var(--app-font-size, 15px)); }' +
      '.ctp-gift-actions { display: flex; gap: 10px; padding: 4px 16px 16px; }' +
      '.ctp-gift-btn { flex: 1; min-height: 44px; border-radius: 14px; border: none; font-family: inherit; font-size: var(--app-font-size, 15px); font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.16s ease; }' +
      '.ctp-gift-btn.is-pressed { transform: scale(0.93); opacity: 0.86; }' +
      '.ctp-gift-btn.is-cancel { background: #f2f2f7; color: #111111; }' +
      '.ctp-gift-btn.is-send { background: linear-gradient(160deg, #1b4f99 0%, #123b78 100%); color: #f4dfb4; }' +
      '.ctp-gift-detail-body { padding: 18px 18px 8px; text-align: center; display: flex; flex-direction: column; gap: 6px; }' +
      '.ctp-gift-detail-item { font-size: calc(var(--app-font-size, 15px) + 1px); font-weight: 600; color: #111111; word-break: break-word; }' +
      '.ctp-gift-detail-meta { font-size: calc(var(--app-font-size, 15px) - 3px); color: #8e8e93; }' +
      'html[data-theme="dark"] .ctp-gift-modal { background: #18181b; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-inp { background: #242429; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-btn.is-cancel { background: #25252b; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-detail-item { color: #f5f5f7; }' +
      '@media (prefers-color-scheme: dark) {' +
        'html:not([data-theme="light"]) .ctp-gift-modal { background: #18181b; color: #f5f5f7; }' +
        'html:not([data-theme="light"]) .ctp-gift-inp { background: #242429; color: #f5f5f7; }' +
        'html:not([data-theme="light"]) .ctp-gift-btn.is-cancel { background: #25252b; color: #f5f5f7; }' +
        'html:not([data-theme="light"]) .ctp-gift-detail-item { color: #f5f5f7; }' +
      '}';
    document.head.appendChild(st);
  }

  function applyWechatSmileIcon() {
    var voiceBtn = document.getElementById('ctRoomVoiceBtn');
    var sendBtn = document.getElementById('ctRoomSendBtn');
    var plusBtn = document.getElementById('ctRoomPlusBtn');
    var emojiBtn =
      document.getElementById('ctRoomEmojiBtn') ||
      (voiceBtn && voiceBtn.nextElementSibling && voiceBtn.nextElementSibling.classList && voiceBtn.nextElementSibling.classList.contains('ct-room-icon-btn') ? voiceBtn.nextElementSibling : null) ||
      (sendBtn && sendBtn.previousElementSibling && sendBtn.previousElementSibling.classList && sendBtn.previousElementSibling.classList.contains('ct-room-icon-btn') ? sendBtn.previousElementSibling : null);
    if (!emojiBtn) return;

    var refSvg =
      (sendBtn && sendBtn.querySelector('svg')) ||
      (voiceBtn && voiceBtn.querySelector('svg')) ||
      (plusBtn && plusBtn.querySelector('svg'));

    var w = (refSvg && refSvg.getAttribute('width')) || '28';
    var h = (refSvg && refSvg.getAttribute('height')) || w;
    var vb = (refSvg && refSvg.getAttribute('viewBox')) || '0 0 24 24';
    var refCircle = refSvg ? refSvg.querySelector('circle') : null;
    var sw = (refCircle && refCircle.getAttribute('stroke-width')) || (refSvg && refSvg.getAttribute('stroke-width')) || '1.55';
    var cx = refCircle ? parseFloat(refCircle.getAttribute('cx')) : 12;
    var cy = refCircle ? parseFloat(refCircle.getAttribute('cy')) : 12;
    var r = refCircle ? parseFloat(refCircle.getAttribute('r')) : 10.2;
    if (isNaN(cx)) cx = 12;
    if (isNaN(cy)) cy = 12;
    if (isNaN(r) || r <= 0) r = 10.2;

    var exL = (cx - r * 0.32).toFixed(2);
    var exR = (cx + r * 0.32).toFixed(2);
    var ey = (cy - r * 0.23).toFixed(2);
    var er = (r * 0.13).toFixed(2);
    var mxL = (cx - r * 0.47).toFixed(2);
    var mxR = (cx + r * 0.47).toFixed(2);
    var myTop = (cy + r * 0.13).toFixed(2);
    var myBot = (cy + r * 0.58).toFixed(2);
    var mcL = (cx - r * 0.43).toFixed(2);
    var mcR = (cx + r * 0.43).toFixed(2);
    var mcL2 = (cx - r * 0.24).toFixed(2);
    var mcR2 = (cx + r * 0.24).toFixed(2);
    var myCtrl = (cy + r * 0.42).toFixed(2);

    emojiBtn.innerHTML =
      '<svg width="' + w + '" height="' + h + '" viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' +
        '<circle cx="' + exL + '" cy="' + ey + '" r="' + er + '" fill="currentColor" stroke="none"/>' +
        '<circle cx="' + exR + '" cy="' + ey + '" r="' + er + '" fill="currentColor" stroke="none"/>' +
        '<path d="M' + mxL + ' ' + myTop + 'H' + mxR + 'C' + mcR + ' ' + myCtrl + ' ' + mcR2 + ' ' + myBot + ' ' + cx + ' ' + myBot + 'C' + mcL2 + ' ' + myBot + ' ' + mcL + ' ' + myCtrl + ' ' + mxL + ' ' + myTop + 'Z"/>' +
      '</svg>';
  }

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

  function formatFileSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileExt(name) {
    var s = String(name || '').trim();
    var idx = s.lastIndexOf('.');
    if (idx <= 0 || idx === s.length - 1) return 'FILE';
    return s.slice(idx + 1).slice(0, 4).toUpperCase();
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
    container.addEventListener('touchmove', clear, { passive: true });
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
    if (window.PhoneChat && typeof window.PhoneChat.getCurrentThreadId === 'function') {
      var cid = window.PhoneChat.getCurrentThreadId();
      if (cid) { activeThreadId = cid; return cid; }
    }
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

    if (msg.type === 'transfer_tip' || msg.type === 'gift_tip') {
      var group = bubble.closest('.ct-msg-group');
      if (group) {
        group.innerHTML = '<div class="ctp-sys-tip">' + escapeHtml(msg.text || '') + '</div>';
      }
      return;
    }

    if (msg.type === 'location') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill');
      bubble.classList.add('ctp-rich-card');
      bubble.dataset.ctpRendered = '1';
      bubble.innerHTML =
        '<div class="ctp-rc-main">' +
          '<div class="ctp-rc-meta">' +
            '<div class="ctp-rc-title">' + escapeHtml(msg.locTitle || '位置') + '</div>' +
            '<div class="ctp-rc-sub">' + escapeHtml(msg.locAddr || '当前分享位置') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ctp-rc-map">' +
          '<div class="ctp-rc-pin">' + SVG_PIN_MD + '</div>' +
        '</div>' +
        '<div class="ctp-rc-foot">' +
          '<span class="ctp-rc-foot-tag">' + SVG_PIN_SM + '<span>位置</span></span>' +
          '<span class="ctp-rc-foot-chevron">' + SVG_CHEVRON_R + '</span>' +
        '</div>';
      return;
    }

    if (msg.type === 'contact_card') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed');
      bubble.classList.add('ctp-rich-card', 'ctp-contact-pill');
      bubble.dataset.ctpRendered = '1';
      var avHtml = msg.cardAvatar
        ? '<img src="' + escapeHtml(msg.cardAvatar) + '" alt="">'
        : escapeHtml((msg.cardName || '友').slice(0, 1));
      bubble.innerHTML =
        '<div class="ctp-cp-av">' + avHtml + '</div>' +
        '<div class="ctp-cp-meta">' +
          '<div class="ctp-cp-name">' + escapeHtml(msg.cardName || '联系人') + '</div>' +
          '<div class="ctp-cp-sub">' + escapeHtml(msg.cardSub || '') + '</div>' +
        '</div>' +
        '<div class="ctp-cp-arrow">' + SVG_CHEVRON_MD + '</div>';
      return;
    }

    if (msg.type === 'favorite') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill');
      bubble.classList.add('ctp-rich-card');
      bubble.dataset.ctpRendered = '1';
      bubble.innerHTML =
        '<div class="ctp-rc-main">' +
          '<div class="ctp-rc-title">收藏笔记</div>' +
          '<div class="ctp-rc-body">' + escapeHtml(msg.favText || msg.text || '') + '</div>' +
        '</div>' +
        '<div class="ctp-rc-foot">' +
          '<span class="ctp-rc-foot-tag">' + SVG_BOOKMARK_SM + '<span>我的收藏</span></span>' +
          '<span class="ctp-rc-foot-chevron">' + SVG_CHEVRON_R + '</span>' +
        '</div>';
      return;
    }

    if (msg.type === 'file') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill');
      bubble.classList.add('ctp-rich-card');
      bubble.dataset.ctpRendered = '1';
      var ext = getFileExt(msg.fileName);
      bubble.innerHTML =
        '<div class="ctp-rc-main">' +
          '<div class="ctp-rc-head">' +
            '<div class="ctp-rc-meta">' +
              '<div class="ctp-rc-title">' + escapeHtml(msg.fileName || '未命名文件') + '</div>' +
              '<div class="ctp-rc-sub">' + escapeHtml(msg.fileSize || '') + '</div>' +
            '</div>' +
            '<div class="ctp-rc-file-badge">' +
              SVG_DOC_MD +
              '<span class="ctp-rc-file-ext">' + escapeHtml(ext) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ctp-rc-foot">' +
          '<span class="ctp-rc-foot-tag">' + SVG_DOC_SM + '<span>文件</span></span>' +
          '<span class="ctp-rc-foot-chevron">' + SVG_CHEVRON_R + '</span>' +
        '</div>';
      return;
    }

    if (msg.type === 'ask9') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill');
      bubble.classList.add('ctp-rich-card');
      bubble.dataset.ctpRendered = '1';
      bubble.innerHTML =
        '<div class="ctp-rc-main">' +
          '<div class="ctp-rc-head">' +
            '<div class="ctp-rc-icon is-dark">' + SVG_ASK9_TILE + '</div>' +
            '<div class="ctp-rc-meta">' +
              '<div class="ctp-rc-title is-wrap">' + escapeHtml(msg.question || '问小九') + '</div>' +
              '<div class="ctp-rc-sub">水小九回答</div>' +
            '</div>' +
          '</div>' +
          '<div class="ctp-rc-body">' + escapeHtml(msg.answer || '') + '</div>' +
        '</div>' +
        '<div class="ctp-rc-foot">' +
          '<span class="ctp-rc-foot-tag">' + SVG_ASK9_SM + '<span>问小九</span></span>' +
          '<span class="ctp-rc-foot-chevron">' + SVG_CHEVRON_R + '</span>' +
        '</div>';
      return;
    }

    if (msg.type === 'gift') {
      var isClaimed = msg.status === 'claimed';
      var giftTitle = msg.title || '送你一份心意';
      var giftFoot = isClaimed ? '礼物 · 已领取' : '礼物';

      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-rich-card', 'ctp-contact-pill');
      bubble.classList.add('ctp-gift-bubble');
      bubble.classList.toggle('is-claimed', isClaimed);
      bubble.dataset.ctpRendered = '1';
      bubble.setAttribute('data-ctp-gift', msg.id);
      bubble.innerHTML =
        '<div class="ct-gift-main">' +
          '<div class="ct-gift-ribbon">' + SVG_GIFT_BOW + '</div>' +
          '<div class="ct-gift-text-wrap">' +
            '<div class="ct-gift-title">' + escapeHtml(giftTitle) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ct-gift-foot">' + escapeHtml(giftFoot) + '</div>';
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

      bubble.classList.remove('ctp-img-bubble', 'ctp-gift-bubble', 'is-claimed', 'ctp-rich-card', 'ctp-contact-pill');
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

    bubble.classList.remove('ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-rich-card', 'ctp-contact-pill');
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

    var richTypes = ['image', 'image_bundle', 'transfer', 'transfer_tip', 'gift', 'gift_tip', 'location', 'contact_card', 'favorite', 'file', 'ask9'];
    box.querySelectorAll('.ct-msg-group[data-msg-id]').forEach(function (group) {
      var mid = group.getAttribute('data-msg-id');
      var m = map[mid];
      if (!m || richTypes.indexOf(m.type) === -1) return;
      var bubble = group.querySelector('.ct-msg-bubble');
      if (bubble && bubble.dataset.ctpRendered !== '1') {
        renderBubbleEl(bubble, m);
      }
    });
  }

  /* ---------------- 问小九（默认私密 + 可选发进聊天） ---------------- */
  async function callAsk9LLM(question) {
    if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
      throw new Error('PhoneAPI 未就绪');
    }
    var cfg = window.PhoneAPI.getConfig('llm');
    var slot = cfg && cfg.primary;
    if (!slot || !slot.url || !slot.key || !slot.model) {
      throw new Error('请先在「API」中配置语言模型');
    }

    var tid = resolveCurrentThreadId();
    var msgs = tid ? loadJSON(STORAGE_MSGS_PREFIX + tid, []).slice(-14) : [];
    var peer = getPeerInfo();
    var contextLines = msgs.map(function (m) {
      var who = m.sender === 'me' ? 'User' : peer.name;
      return who + '：' + (m.transcript || m.text || '');
    }).filter(Boolean).join('\n');

    var sysPrompt =
      '你是手机微信里的智能小助手「水小九」，专门在私下帮 User 总结聊天、分析对方情绪、出主意或解答问题。' +
      '请用简短、自然、好懂的口语直接回答，不要长篇大论。如果 User 让你帮想一句回复，直接给 1~2 句最自然的话即可。';
    var userPrompt =
      (contextLines ? ('【当前聊天片段（对象：' + peer.name + '）】\n' + contextLines + '\n\n') : '') +
      '【User 的问题】\n' + question;

    var base = String(slot.url || '').trim().replace(/\/+$/, '');
    if (slot.type === 'google') {
      var gUrl = base + '/v1beta/models/' + encodeURIComponent(slot.model) + ':generateContent?key=' + encodeURIComponent(slot.key);
      var gRes = await fetch(gUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sysPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
      });
      if (!gRes.ok) throw new Error('HTTP ' + gRes.status);
      var gData = await gRes.json();
      var parts = (gData.candidates && gData.candidates[0] && gData.candidates[0].content && gData.candidates[0].content.parts) || [];
      return parts.filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ''; }).join('').trim();
    }

    if (slot.type === 'anthropic') {
      var aRes = await fetch(base + '/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': slot.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: slot.model,
          max_tokens: 800,
          system: sysPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (!aRes.ok) throw new Error('HTTP ' + aRes.status);
      var aData = await aRes.json();
      return (aData.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text || ''; }).join('').trim();
    }

    if ((slot.type === 'openai' || slot.type === 'custom') && !/\/v\d+$/i.test(base) && base.indexOf('/v1/') === -1) {
      base += '/v1';
    }
    var oRes = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + slot.key },
      body: JSON.stringify({
        model: slot.model,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!oRes.ok) throw new Error('HTTP ' + oRes.status);
    var oData = await oRes.json();
    return String((oData.choices && oData.choices[0] && oData.choices[0].message && oData.choices[0].message.content) || '').trim();
  }

  function openAsk9Modal() {
    setDrawerOpen(false);
    lastAsk9Question = '';
    lastAsk9Answer = '';
    document.getElementById('ctpAsk9Inp').value = '';
    document.getElementById('ctpAsk9AnsBox').style.display = 'none';
    document.getElementById('ctpAsk9AfterBtns').style.display = 'none';
    document.getElementById('ctpAsk9Mask').classList.add('open');
  }

  async function runAsk9Query(qText) {
    var q = String(qText || '').trim();
    if (!q || ask9Busy) return;
    ask9Busy = true;
    lastAsk9Question = q;
    var ansBox = document.getElementById('ctpAsk9AnsBox');
    var afterBtns = document.getElementById('ctpAsk9AfterBtns');
    ansBox.style.display = 'block';
    ansBox.textContent = '水小九思考中...';
    afterBtns.style.display = 'none';
    try {
      var ans = await callAsk9LLM(q);
      lastAsk9Answer = ans || '（暂无回复）';
      ansBox.textContent = lastAsk9Answer;
      afterBtns.style.display = 'flex';
    } catch (err) {
      ansBox.textContent = '出错了：' + (err.message || '请求失败');
    } finally {
      ask9Busy = false;
    }
  }

  /* ---------------- 位置 / 收藏 / 名片弹窗 ---------------- */
  function openLocationModal() {
    setDrawerOpen(false);
    document.getElementById('ctpLocTitleInp').value = '';
    document.getElementById('ctpLocAddrInp').value = '';
    document.getElementById('ctpLocGeoBtn').innerHTML = SVG_CROSSHAIR + '<span>获取当前真实定位</span>';
    document.getElementById('ctpLocMask').classList.add('open');
  }

  function openFavModal() {
    setDrawerOpen(false);
    renderFavList();
    document.getElementById('ctpFavMask').classList.add('open');
  }

  function renderFavList() {
    var list = loadJSON(STORAGE_FAVS_KEY, []);
    var box = document.getElementById('ctpFavList');
    if (!list.length) {
      box.innerHTML = '<div class="ctp-empty-card">暂无收藏内容，可以在下方直接新增一条并发送</div>';
      return;
    }
    box.innerHTML = list.map(function (item, idx) {
      return '<div class="ctp-pick-row" data-fav-idx="' + idx + '">' +
        '<div class="ctp-pick-info">' +
          '<div class="ctp-pick-title">' + escapeHtml(item.text || '') + '</div>' +
          '<div class="ctp-pick-sub">' + escapeHtml(item.time || '') + '</div>' +
        '</div>' +
        '<span class="ctp-pick-pill">发送</span>' +
      '</div>';
    }).join('');
  }

  function openCardModal() {
    setDrawerOpen(false);
    var chars = (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function')
      ? (window.PhoneArchive.getChars() || [])
      : [];
    var box = document.getElementById('ctpCardList');
    if (!chars.length) {
      box.innerHTML = '<div class="ctp-empty-card">暂无联系人，先去「档案」新建角色即可发送名片</div>';
    } else {
      box.innerHTML = chars.map(function (c) {
        var av = (window.PhoneArchive && window.PhoneArchive.getCharAvatar) ? (window.PhoneArchive.getCharAvatar(c.id) || '') : '';
        var name = c.name || c.nickname || '未命名';
        var sub = c.handle || c.id || '';
        return '<div class="ctp-pick-row" data-card-id="' + escapeHtml(c.id) + '" data-card-name="' + escapeHtml(name) + '" data-card-sub="' + escapeHtml(sub) + '" data-card-av="' + escapeHtml(av) + '">' +
          '<div class="ctp-pick-av">' + (av ? '<img src="' + escapeHtml(av) + '" alt="">' : escapeHtml(name.slice(0, 1))) + '</div>' +
          '<div class="ctp-pick-info">' +
            '<div class="ctp-pick-title">' + escapeHtml(name) + '</div>' +
            '<div class="ctp-pick-sub">' + escapeHtml(sub) + '</div>' +
          '</div>' +
          '<span class="ctp-pick-pill">发送</span>' +
        '</div>';
      }).join('');
    }
    document.getElementById('ctpCardMask').classList.add('open');
  }

  /* ---------------- 照片 / 礼物 / 转账 ---------------- */
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

  function openGiftSendModal() {
    setDrawerOpen(false);
    document.getElementById('ctpGiftTitleInp').value = '';
    document.getElementById('ctpGiftItemInp').value = '';
    document.getElementById('ctpGiftPreviewTitle').textContent = '送你一份心意';
    document.getElementById('ctpGiftSendMask').classList.add('open');
  }

  function openGiftDetailModal(msgId) {
    var tid = resolveCurrentThreadId();
    if (!tid) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var m = msgs.find(function (item) { return item.id === msgId; });
    if (!m) return;

    detailGiftMsgId = msgId;
    var isMe = m.sender === 'me';
    var isClaimed = m.status === 'claimed';
    document.getElementById('ctpGiftDetailTitle').textContent = m.title || '送你一份心意';
    document.getElementById('ctpGiftDetailSub').textContent = isClaimed
      ? (isMe ? '对方已收下这份心意' : '已收下这份心意')
      : (isMe ? '等待对方拆开礼物' : '对方送你了一份礼物');
    document.getElementById('ctpGiftDetailItem').textContent = m.giftName ? ('礼物内容：' + m.giftName) : '一份神秘心意';
    document.getElementById('ctpGiftDetailMeta').textContent = m.time ? ('送出时间：' + m.time) : '';

    var claimBtn = document.getElementById('ctpGiftClaimBtn');
    claimBtn.style.display = (!isMe && !isClaimed) ? '' : 'none';
    document.getElementById('ctpGiftDetailMask').classList.add('open');
  }

  function claimIncomingGift(msgId) {
    var tid = resolveCurrentThreadId();
    if (!tid || !msgId) return;
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var target = msgs.find(function (m) { return m.id === msgId; });
    if (!target || target.sender === 'me' || target.status === 'claimed') return;

    target.status = 'claimed';
    var tipText = '你收下了对方的礼物' + (target.giftName ? ('「' + target.giftName + '」') : '');
    var tipMsg = { id: 'm-gtip-' + Date.now(), sender: 'me', type: 'gift_tip', text: tipText, time: '' };
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

    document.getElementById('ctpGiftDetailMask').classList.remove('open');
    window.dispatchEvent(new CustomEvent('phone-chat-gift-action', {
      detail: { threadId: tid, msgId: msgId, action: 'claimed', giftName: target.giftName || '' }
    }));
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
    var tipMsg = { id: 'm-tip-' + Date.now(), sender: 'me', type: 'transfer_tip', text: tipText, time: '' };
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
    actionsEl.style.display = (!isMe && st === 'pending') ? 'flex' : 'none';
    timeEl.textContent = m.time ? ('转账时间：' + m.time) : '';

    document.getElementById('ctpTrDetailPage').classList.add('open');
  }

  function ensureUI() {
    var room = document.getElementById('ctRoomView');
    if (!room || document.getElementById('ctpDrawer')) return;
    ensureGiftExtraStyles();
    applyWechatSmileIcon();

    var drawer = document.createElement('div');
    drawer.className = 'ctp-drawer';
    drawer.id = 'ctpDrawer';
    drawer.innerHTML =
      '<div class="ctp-drawer-track" id="ctpDrawerTrack">' +
        '<div class="ctp-drawer-page">' +
          '<div class="ctp-grid" id="ctpGridPage1">' +
            '<button class="ctp-item" id="ctpBtnPhoto"><div class="ctp-item-icon">' + SVG_PHOTO + '</div><div class="ctp-item-label">照片</div></button>' +
            '<button class="ctp-item" id="ctpBtnTransfer"><div class="ctp-item-icon">' + SVG_TRANSFER_TILE + '</div><div class="ctp-item-label">转账</div></button>' +
            '<button class="ctp-item" id="ctpBtnGift"><div class="ctp-item-icon">' + SVG_GIFT_TILE + '</div><div class="ctp-item-label">礼物</div></button>' +
            '<button class="ctp-item" id="ctpBtnAsk9"><div class="ctp-item-icon">' + SVG_ASK9_TILE + '</div><div class="ctp-item-label">问小九</div></button>' +
            '<button class="ctp-item" id="ctpBtnLoc"><div class="ctp-item-icon">' + SVG_LOC_TILE + '</div><div class="ctp-item-label">位置</div></button>' +
            '<button class="ctp-item" id="ctpBtnFav"><div class="ctp-item-icon">' + SVG_FAV_TILE + '</div><div class="ctp-item-label">收藏</div></button>' +
            '<button class="ctp-item" id="ctpBtnCard"><div class="ctp-item-icon">' + SVG_CARD_TILE + '</div><div class="ctp-item-label">个人名片</div></button>' +
            '<button class="ctp-item" id="ctpBtnListen" data-ctl-listen="1"><div class="ctp-item-icon">' + SVG_LISTEN_TILE + '</div><div class="ctp-item-label">一起听</div></button>' +
          '</div>' +
        '</div>' +
        '<div class="ctp-drawer-page">' +
          '<div class="ctp-grid-fixed" id="ctpGridPage2">' +
            '<button class="ctp-item" id="ctpBtnFile"><div class="ctp-item-icon">' + SVG_FILE_TILE + '</div><div class="ctp-item-label">文件</div></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-drawer-dots">' +
        '<span class="ctp-drawer-dot active" id="ctpDot0"></span>' +
        '<span class="ctp-drawer-dot" id="ctpDot1"></span>' +
      '</div>';
    room.appendChild(drawer);

    var extra = document.createElement('div');
    extra.innerHTML =
      '<input type="file" id="ctpPhotoInput" accept="image/*" multiple style="display:none;">' +
      '<input type="file" id="ctpFileInput" style="display:none;">' +

      '<div class="ctp-sheet-mask" id="ctpAsk9Mask">' +
        '<div class="ctp-sheet-panel">' +
          '<div class="ctp-sheet-grabber"></div>' +
          '<div class="ctp-sheet-head">' +
            '<div class="ctp-sheet-title">' + SVG_ASK9_TILE + '<span>问小九</span><span class="ctp-sheet-badge">仅自己可见</span></div>' +
            '<button class="ctp-sheet-close" id="ctpAsk9Close" type="button" aria-label="关闭">' + SVG_CLOSE_X + '</button>' +
          '</div>' +
          '<div class="ctp-sheet-body">' +
            '<div class="ctp-chip-row">' +
              '<button class="ctp-chip-btn" data-ask9-q="帮我简单总结一下刚才的聊天内容" type="button">总结刚才聊天</button>' +
              '<button class="ctp-chip-btn" data-ask9-q="帮我想一句自然高情商的回复" type="button">帮我想回复</button>' +
              '<button class="ctp-chip-btn" data-ask9-q="分析一下对方现在大概是什么心情" type="button">分析对方心情</button>' +
            '</div>' +
            '<textarea class="ctp-sheet-ta" id="ctpAsk9Inp" placeholder="问水小九任何问题（默认仅自己可见）..."></textarea>' +
            '<button class="ctp-sheet-btn is-primary" id="ctpAsk9Submit" type="button">提问水小九</button>' +
            '<div class="ctp-ask9-ans" id="ctpAsk9AnsBox" style="display:none;"></div>' +
            '<div class="ctp-sheet-actions" id="ctpAsk9AfterBtns" style="display:none;">' +
              '<button class="ctp-sheet-btn" id="ctpAsk9FillBtn" type="button">填入输入框</button>' +
              '<button class="ctp-sheet-btn is-primary" id="ctpAsk9SendBtn" type="button">发卡片到聊天</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ctp-sheet-mask" id="ctpLocMask">' +
        '<div class="ctp-sheet-panel">' +
          '<div class="ctp-sheet-grabber"></div>' +
          '<div class="ctp-sheet-head">' +
            '<div class="ctp-sheet-title">发送位置</div>' +
            '<button class="ctp-sheet-close" id="ctpLocClose" type="button" aria-label="关闭">' + SVG_CLOSE_X + '</button>' +
          '</div>' +
          '<div class="ctp-sheet-body">' +
            '<button class="ctp-sheet-btn" id="ctpLocGeoBtn" type="button">' + SVG_CROSSHAIR + '<span>获取当前真实定位</span></button>' +
            '<input class="ctp-sheet-inp" id="ctpLocTitleInp" placeholder="地点名称（如：三里屯太古里）">' +
            '<input class="ctp-sheet-inp" id="ctpLocAddrInp" placeholder="详细地址（选填）">' +
            '<button class="ctp-sheet-btn is-primary" id="ctpLocSendBtn" type="button">发送位置</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ctp-sheet-mask" id="ctpFavMask">' +
        '<div class="ctp-sheet-panel">' +
          '<div class="ctp-sheet-grabber"></div>' +
          '<div class="ctp-sheet-head">' +
            '<div class="ctp-sheet-title">我的收藏</div>' +
            '<button class="ctp-sheet-close" id="ctpFavClose" type="button" aria-label="关闭">' + SVG_CLOSE_X + '</button>' +
          '</div>' +
          '<div class="ctp-sheet-body">' +
            '<div id="ctpFavList" style="display:flex;flex-direction:column;gap:8px;"></div>' +
            '<input class="ctp-sheet-inp" id="ctpFavNewInp" placeholder="记录一条新收藏并发送...">' +
            '<button class="ctp-sheet-btn is-primary" id="ctpFavAddSendBtn" type="button">保存并发送</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ctp-sheet-mask" id="ctpCardMask">' +
        '<div class="ctp-sheet-panel">' +
          '<div class="ctp-sheet-grabber"></div>' +
          '<div class="ctp-sheet-head">' +
            '<div class="ctp-sheet-title">发送个人名片</div>' +
            '<button class="ctp-sheet-close" id="ctpCardClose" type="button" aria-label="关闭">' + SVG_CLOSE_X + '</button>' +
          '</div>' +
          '<div class="ctp-sheet-body" id="ctpCardList"></div>' +
        '</div>' +
      '</div>' +

      '<div class="ctp-gift-mask" id="ctpGiftSendMask">' +
        '<div class="ctp-gift-modal">' +
          '<div class="ctp-gift-banner">' +
            '<div class="ctp-gift-banner-bow">' + SVG_GIFT_BOW + '</div>' +
            '<div class="ctp-gift-banner-title" id="ctpGiftPreviewTitle">送你一份心意</div>' +
            '<div class="ctp-gift-banner-sub">微信礼物</div>' +
          '</div>' +
          '<div class="ctp-gift-form">' +
            '<div><div class="ctp-gift-field-label">祝福语</div><input class="ctp-gift-inp" id="ctpGiftTitleInp" maxlength="20" placeholder="送你一份心意"></div>' +
            '<div><div class="ctp-gift-field-label">礼物内容（选填）</div><input class="ctp-gift-inp" id="ctpGiftItemInp" maxlength="30" placeholder="如：一束蓝玫瑰、限定手办"></div>' +
          '</div>' +
          '<div class="ctp-gift-actions">' +
            '<button class="ctp-gift-btn is-cancel" id="ctpGiftCancelBtn" type="button">取消</button>' +
            '<button class="ctp-gift-btn is-send" id="ctpGiftSendBtn" type="button">送出礼物</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-gift-mask" id="ctpGiftDetailMask">' +
        '<div class="ctp-gift-modal">' +
          '<div class="ctp-gift-banner">' +
            '<div class="ctp-gift-banner-bow">' + SVG_GIFT_BOW + '</div>' +
            '<div class="ctp-gift-banner-title" id="ctpGiftDetailTitle">送你一份心意</div>' +
            '<div class="ctp-gift-banner-sub" id="ctpGiftDetailSub">礼物</div>' +
          '</div>' +
          '<div class="ctp-gift-detail-body">' +
            '<div class="ctp-gift-detail-item" id="ctpGiftDetailItem"></div>' +
            '<div class="ctp-gift-detail-meta" id="ctpGiftDetailMeta"></div>' +
          '</div>' +
          '<div class="ctp-gift-actions">' +
            '<button class="ctp-gift-btn is-cancel" id="ctpGiftDetailCloseBtn" type="button">关闭</button>' +
            '<button class="ctp-gift-btn is-send" id="ctpGiftClaimBtn" type="button" style="display:none;">收下礼物</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-tr-page" id="ctpTrPage">' +
        '<div class="ctp-tr-nav"><button class="ctp-tr-back" id="ctpTrBack" aria-label="返回"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button></div>' +
        '<div class="ctp-tr-peer"><div class="ctp-tr-peer-text"><div class="ctp-tr-peer-name" id="ctpTrPeerName"></div><div class="ctp-tr-peer-id" id="ctpTrPeerId"></div></div><div class="ctp-tr-peer-av" id="ctpTrPeerAv"></div></div>' +
        '<div class="ctp-tr-card"><div class="ctp-tr-card-label">转账金额</div><div class="ctp-tr-amt-row"><span class="ctp-tr-yen">¥</span><span class="ctp-tr-val" id="ctpTrVal"></span><span class="ctp-tr-cursor"></span></div><button class="ctp-tr-note-btn" id="ctpTrNoteBtn">添加转账说明</button></div>' +
        '<div class="ctp-keypad" id="ctpKeypad">' +
          '<button class="ctp-key" data-key="1">1</button><button class="ctp-key" data-key="2">2</button><button class="ctp-key" data-key="3">3</button><button class="ctp-key" data-key="del" aria-label="删除">' + SVG_BACKSPACE + '</button>' +
          '<button class="ctp-key" data-key="4">4</button><button class="ctp-key" data-key="5">5</button><button class="ctp-key" data-key="6">6</button>' +
          '<button class="ctp-key" data-key="7">7</button><button class="ctp-key" data-key="8">8</button><button class="ctp-key" data-key="9">9</button>' +
          '<button class="ctp-key ctp-key-zero" data-key="0">0</button><button class="ctp-key" data-key=".">.</button><button class="ctp-key ctp-key-submit disabled" id="ctpTrSubmit">转账</button>' +
        '</div>' +
      '</div>' +
      '<div class="ctp-pay-hud" id="ctpPayHud"><div class="ctp-pay-hud-box"><svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.5 1.3 4.8 3.5 6.3L4.5 21l3.6-1.8c1.2.4 2.5.6 3.9.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3zm4.6 6.4l-5.3 5.3-3-3 1.2-1.2 1.8 1.8 4.1-4.1 1.2 1.2z"/></svg><div class="ctp-pay-hud-txt">微信支付</div><div class="ctp-pay-dots"><span></span><span></span><span></span></div></div></div>' +
      '<div class="ctp-wxpay-mask" id="ctpWxPayMask"><div class="ctp-wxpay-sheet" id="ctpWxPaySheet"><div class="ctp-wxpay-top"><div class="ctp-wxpay-bar"><button class="ctp-wxpay-x" id="ctpWxPayClose" aria-label="关闭">×</button><button class="ctp-wxpay-mode-btn" id="ctpWxPayModeBtn">使用面容</button></div><div class="ctp-wxpay-to" id="ctpWxPayTo"></div><div class="ctp-wxpay-amt" id="ctpWxPayAmt"></div><div class="ctp-wxpay-divider"></div><div class="ctp-wxpay-method-head"><span>付款方式</span><button class="ctp-wxpay-change" id="ctpWxPayChange">更改 ⌄</button></div><div class="ctp-wxpay-card" id="ctpWxPayCard"><div class="ctp-wxpay-card-left"><div class="ctp-pay-coin" id="ctpWxPayCardIco">¥</div><span id="ctpWxPayCardName">零钱</span></div><div class="ctp-pay-tick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div></div></div><div class="ctp-wxpay-face-area"><button class="ctp-wxpay-face-btn" id="ctpWxPayFaceBtn">支付</button></div><div class="ctp-wxpay-pwd-area"><div class="ctp-pwd-boxes" id="ctpPwdBoxes"><div class="ctp-pwd-cell"></div><div class="ctp-pwd-cell"></div><div class="ctp-pwd-cell"></div><div class="ctp-pwd-cell"></div><div class="ctp-pwd-cell"></div><div class="ctp-pwd-cell"></div></div><div class="ctp-pwd-pad" id="ctpPwdPad"><button class="ctp-pwd-key" data-pkey="1">1</button><button class="ctp-pwd-key" data-pkey="2">2</button><button class="ctp-pwd-key" data-pkey="3">3</button><button class="ctp-pwd-key" data-pkey="4">4</button><button class="ctp-pwd-key" data-pkey="5">5</button><button class="ctp-pwd-key" data-pkey="6">6</button><button class="ctp-pwd-key" data-pkey="7">7</button><button class="ctp-pwd-key" data-pkey="8">8</button><button class="ctp-pwd-key" data-pkey="9">9</button><div class="ctp-pwd-key is-muted"></div><button class="ctp-pwd-key" data-pkey="0">0</button><button class="ctp-pwd-key is-muted" data-pkey="del" aria-label="删除">' + SVG_BACKSPACE + '</button></div></div></div></div>' +
      '<div class="ctp-pay-mask" id="ctpPayMask"><div class="ctp-pay-sheet"><div class="ctp-pay-head"><button class="ctp-pay-close" id="ctpPayClose" aria-label="关闭"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button><div class="ctp-pay-title-wrap"><div class="ctp-pay-title">选择付款方式</div><div class="ctp-pay-sub" id="ctpPaySub"></div></div><div class="ctp-pay-combo">组合支付</div></div><div class="ctp-pay-row" id="ctpPayWalletRow"><div class="ctp-pay-row-left"><div class="ctp-pay-coin">¥</div><div><div class="ctp-pay-name" id="ctpPayWalletName">零钱</div><div class="ctp-pay-desc" id="ctpPayWalletDesc"></div></div></div><div class="ctp-pay-tick" id="ctpPayWalletTick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div></div><div class="ctp-pay-sec-label">银行卡</div><div class="ctp-pay-row" id="ctpPayBankRow"><div class="ctp-pay-row-left"><div class="ctp-pay-card-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><div><div class="ctp-pay-name">招商银行储蓄卡 (8888)</div><div class="ctp-pay-desc">单日限额 ¥50000</div></div></div><div class="ctp-pay-tick" id="ctpPayBankTick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div></div><div class="ctp-pay-legal">本服务由小手机本地模拟提供</div></div></div>' +
      '<div class="ctp-done-page" id="ctpDonePage"><div class="ctp-done-badge"><span class="ctp-done-circle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>支付成功</span></div><div class="ctp-done-to" id="ctpDoneTo"></div><div class="ctp-done-amt" id="ctpDoneAmt"></div><div class="ctp-done-row"><span>付款方式</span><span id="ctpDoneMethod"></span></div><button class="ctp-done-btn" id="ctpDoneBtn">完成</button></div>' +
      '<div class="ctp-tr-detail" id="ctpTrDetailPage"><div class="ctp-tr-nav"><button class="ctp-tr-back" id="ctpTrDetailBack" aria-label="返回"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button></div><div class="ctp-tr-detail-body"><div class="ctp-tr-detail-icon" id="ctpTrDetailIcon"></div><div class="ctp-tr-detail-state" id="ctpTrDetailState"></div><div class="ctp-tr-detail-amt" id="ctpTrDetailAmt"></div><div class="ctp-tr-detail-note" id="ctpTrDetailNote"></div><div class="ctp-tr-detail-actions" id="ctpTrDetailActions"><button class="ctp-tr-detail-btn" id="ctpTrDetailBtn">确认收款</button><button class="ctp-tr-detail-link" id="ctpTrRefundBtn">立即退还</button></div><div class="ctp-tr-detail-time" id="ctpTrDetailTime"></div></div></div>' +
      '<div class="ctp-note-mask" id="ctpNoteMask"><div class="ctp-note-box"><div class="ctp-note-head">添加转账说明</div><div class="ctp-note-inp-wrap"><input class="ctp-note-inp" id="ctpNoteInp" maxlength="20" placeholder="最多20个字"></div><div class="ctp-note-btns"><button class="ctp-note-btn" id="ctpNoteCancel">取消</button><button class="ctp-note-btn" id="ctpNoteOk">确定</button></div></div></div>' +
      '<div class="ctp-multi-mask" id="ctpMultiMask"><div class="ctp-multi-sheet"><div class="ctp-multi-thumbs" id="ctpMultiThumbs"></div><div class="ctp-multi-toggle" id="ctpMultiToggle"><div class="ctp-multi-check on" id="ctpMultiCheck">' + SVG_CHECK + '</div><span>发送后合并展示</span></div><div class="ctp-multi-foot"><button class="ctp-multi-cancel" id="ctpMultiCancel">取消</button><button class="ctp-multi-send" id="ctpMultiSend">发送</button></div></div></div>' +
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
    var track = document.getElementById('ctpDrawerTrack');

    bindPressFeedback(document.getElementById('ctpDrawer'), '.ctp-item');
    bindPressFeedback(document.getElementById('ctpKeypad'), '.ctp-key');
    bindPressFeedback(document.getElementById('ctpPwdPad'), '.ctp-pwd-key');
    bindPressFeedback(document.getElementById('ctpWxPaySheet'), '.ctp-wxpay-card, .ctp-wxpay-face-btn');
    bindPressFeedback(document.getElementById('ctpGiftSendMask'), '.ctp-gift-btn');
    bindPressFeedback(document.getElementById('ctpGiftDetailMask'), '.ctp-gift-btn');
    bindPressFeedback(room, '.ctp-chip-btn, .ctp-sheet-btn, .ctp-sheet-close, .ctp-pick-row');
    bindPressFeedback(msgBox, '.ctp-transfer-bubble, .ctp-gift-bubble, .ctp-rich-card, .ctp-expand-pill');

    if (track) {
      track.addEventListener('scroll', function () {
        var page = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        var d0 = document.getElementById('ctpDot0');
        var d1 = document.getElementById('ctpDot1');
        if (d0) d0.classList.toggle('active', page === 0);
        if (d1) d1.classList.toggle('active', page === 1);
      }, { passive: true });
    }

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

        var giftEl = e.target.closest('[data-ctp-gift]');
        if (giftEl) {
          e.stopPropagation();
          openGiftDetailModal(giftEl.getAttribute('data-ctp-gift'));
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

    // 一起听：防 iOS 边角滑动误吞 + 绕开旧捕获点击冲突，一按即开
    (function bindListenFastTap() {
      var listenBtn = document.getElementById('ctpBtnListen');
      if (!listenBtn) return;
      var sx = 0, sy = 0, moved = false, lastFire = 0;

      function triggerListen() {
        var now = Date.now();
        if (now - lastFire < 380) return;
        lastFire = now;
        setDrawerOpen(false);
        if (window.PhoneChatListen && typeof window.PhoneChatListen.openSongModal === 'function') {
          window.PhoneChatListen.openSongModal();
        }
      }

      listenBtn.addEventListener('touchstart', function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        sx = t.clientX;
        sy = t.clientY;
        moved = false;
      }, { passive: true });

      listenBtn.addEventListener('touchmove', function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - sx) > 14 || Math.abs(t.clientY - sy) > 14) {
          moved = true;
        }
      }, { passive: true });

      listenBtn.addEventListener('touchend', function (e) {
        if (moved) return;
        e.preventDefault();
        e.stopPropagation();
        triggerListen();
      });

      listenBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        triggerListen();
      });
    })();

    // 问小九事件
    document.getElementById('ctpBtnAsk9').addEventListener('click', openAsk9Modal);
    document.getElementById('ctpAsk9Close').addEventListener('click', function () {
      document.getElementById('ctpAsk9Mask').classList.remove('open');
    });
    document.getElementById('ctpAsk9Mask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
      var chip = e.target.closest('[data-ask9-q]');
      if (chip) {
        var q = chip.getAttribute('data-ask9-q');
        document.getElementById('ctpAsk9Inp').value = q;
        runAsk9Query(q);
      }
    });
    document.getElementById('ctpAsk9Submit').addEventListener('click', function () {
      runAsk9Query(document.getElementById('ctpAsk9Inp').value);
    });
    document.getElementById('ctpAsk9FillBtn').addEventListener('click', function () {
      var inp = document.getElementById('ctRoomInput');
      if (inp && lastAsk9Answer) {
        inp.value = lastAsk9Answer;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.getElementById('ctpAsk9Mask').classList.remove('open');
    });
    document.getElementById('ctpAsk9SendBtn').addEventListener('click', function () {
      if (!lastAsk9Answer) return;
      document.getElementById('ctpAsk9Mask').classList.remove('open');
      appendCustomMessage({
        type: 'ask9',
        question: lastAsk9Question,
        answer: lastAsk9Answer,
        text: '[问小九] ' + lastAsk9Question + '：' + lastAsk9Answer
      }, '[问小九] ' + lastAsk9Question);
    });

    // 位置事件
    document.getElementById('ctpBtnLoc').addEventListener('click', openLocationModal);
    document.getElementById('ctpLocClose').addEventListener('click', function () {
      document.getElementById('ctpLocMask').classList.remove('open');
    });
    document.getElementById('ctpLocMask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
    });
    document.getElementById('ctpLocGeoBtn').addEventListener('click', function () {
      var btn = this;
      btn.innerHTML = SVG_CROSSHAIR + '<span>定位中...</span>';
      if (!navigator.geolocation) {
        btn.innerHTML = SVG_CROSSHAIR + '<span>当前环境不支持定位，请手动输入</span>';
        return;
      }
      navigator.geolocation.getCurrentPosition(function (pos) {
        fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + pos.coords.latitude + '&longitude=' + pos.coords.longitude + '&localityLanguage=zh')
          .then(function (r) { return r.json(); })
          .then(function (g) {
            document.getElementById('ctpLocTitleInp').value = g.locality || g.city || '当前位置';
            document.getElementById('ctpLocAddrInp').value = [g.principalSubdivision, g.city, g.locality].filter(Boolean).join(' · ');
            btn.innerHTML = SVG_CROSSHAIR + '<span>已填入当前定位</span>';
          })
          .catch(function () {
            document.getElementById('ctpLocTitleInp').value = '当前位置';
            document.getElementById('ctpLocAddrInp').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
            btn.innerHTML = SVG_CROSSHAIR + '<span>已填入经纬度</span>';
          });
      }, function () {
        btn.innerHTML = SVG_CROSSHAIR + '<span>定位失败，请手动输入</span>';
      }, { timeout: 6000 });
    });
    document.getElementById('ctpLocSendBtn').addEventListener('click', function () {
      var title = (document.getElementById('ctpLocTitleInp').value || '').trim() || '我的位置';
      var addr = (document.getElementById('ctpLocAddrInp').value || '').trim();
      document.getElementById('ctpLocMask').classList.remove('open');
      appendCustomMessage({
        type: 'location',
        locTitle: title,
        locAddr: addr,
        text: '[位置] ' + title + (addr ? (' (' + addr + ')') : '')
      }, '[位置] ' + title);
    });

    // 收藏事件
    document.getElementById('ctpBtnFav').addEventListener('click', openFavModal);
    document.getElementById('ctpFavClose').addEventListener('click', function () {
      document.getElementById('ctpFavMask').classList.remove('open');
    });
    document.getElementById('ctpFavMask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
      var row = e.target.closest('[data-fav-idx]');
      if (row) {
        var list = loadJSON(STORAGE_FAVS_KEY, []);
        var item = list[Number(row.getAttribute('data-fav-idx'))];
        if (item && item.text) {
          document.getElementById('ctpFavMask').classList.remove('open');
          appendCustomMessage({
            type: 'favorite',
            favText: item.text,
            text: '[收藏] ' + item.text
          }, '[收藏] ' + item.text);
        }
      }
    });
    document.getElementById('ctpFavAddSendBtn').addEventListener('click', function () {
      var inp = document.getElementById('ctpFavNewInp');
      var txt = (inp.value || '').trim();
      if (!txt) return;
      var list = loadJSON(STORAGE_FAVS_KEY, []);
      list.unshift({ text: txt, time: new Date().toLocaleDateString('zh-CN') });
      saveJSON(STORAGE_FAVS_KEY, list.slice(0, 50));
      inp.value = '';
      document.getElementById('ctpFavMask').classList.remove('open');
      appendCustomMessage({
        type: 'favorite',
        favText: txt,
        text: '[收藏] ' + txt
      }, '[收藏] ' + txt);
    });

    // 个人名片事件
    document.getElementById('ctpBtnCard').addEventListener('click', openCardModal);
    document.getElementById('ctpCardClose').addEventListener('click', function () {
      document.getElementById('ctpCardMask').classList.remove('open');
    });
    document.getElementById('ctpCardMask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
      var row = e.target.closest('[data-card-id]');
      if (row) {
        var name = row.getAttribute('data-card-name') || '联系人';
        var sub = row.getAttribute('data-card-sub') || '';
        var av = row.getAttribute('data-card-av') || '';
        document.getElementById('ctpCardMask').classList.remove('open');
        appendCustomMessage({
          type: 'contact_card',
          cardName: name,
          cardSub: sub,
          cardAvatar: av,
          text: '[个人名片] ' + name
        }, '[个人名片] ' + name);
      }
    });

    // 文件事件（第 2 页）
    document.getElementById('ctpBtnFile').addEventListener('click', function () {
      setDrawerOpen(false);
      document.getElementById('ctpFileInput').click();
    });
    document.getElementById('ctpFileInput').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var sizeStr = formatFileSize(f.size);
      appendCustomMessage({
        type: 'file',
        fileName: f.name,
        fileSize: sizeStr,
        text: '[文件] ' + f.name + ' (' + sizeStr + ')'
      }, '[文件] ' + f.name);
    });

    // 礼物事件
    document.getElementById('ctpBtnGift').addEventListener('click', openGiftSendModal);
    document.getElementById('ctpGiftTitleInp').addEventListener('input', function () {
      document.getElementById('ctpGiftPreviewTitle').textContent = this.value.trim() || '送你一份心意';
    });
    document.getElementById('ctpGiftCancelBtn').addEventListener('click', function () {
      document.getElementById('ctpGiftSendMask').classList.remove('open');
    });
    document.getElementById('ctpGiftSendMask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
    });
    document.getElementById('ctpGiftSendBtn').addEventListener('click', function () {
      var title = (document.getElementById('ctpGiftTitleInp').value || '').trim() || '送你一份心意';
      var giftName = (document.getElementById('ctpGiftItemInp').value || '').trim();
      document.getElementById('ctpGiftSendMask').classList.remove('open');
      appendCustomMessage({
        type: 'gift',
        title: title,
        giftName: giftName,
        status: 'pending',
        text: '[礼物] ' + title
      }, '[礼物] ' + title);
    });
    document.getElementById('ctpGiftDetailCloseBtn').addEventListener('click', function () {
      document.getElementById('ctpGiftDetailMask').classList.remove('open');
    });
    document.getElementById('ctpGiftDetailMask').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
    });
    document.getElementById('ctpGiftClaimBtn').addEventListener('click', function () {
      claimIncomingGift(detailGiftMsgId);
    });

    // 照片事件
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

    // 转账事件
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

    document.getElementById('ctpTrDetailBack').addEventListener('click', function () {
      document.getElementById('ctpTrDetailPage').classList.remove('open');
    });

    document.getElementById('ctpTrDetailBtn').addEventListener('click', function () {
      updateIncomingTransfer(detailMsgId, 'received');
    });
    document.getElementById('ctpTrRefundBtn').addEventListener('click', function () {
      updateIncomingTransfer(detailMsgId, 'refunded');
    });

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
        if (room.classList.contains('open')) applyWechatSmileIcon();
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