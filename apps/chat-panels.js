/* =========================================================
   Chat 输入扩展面板、发照片、转账、礼物 & 问小九模块 (apps/chat-panels.js)
   - 第 1 页固定 8 格：照片、转账、礼物、问小九、位置、收藏、个人名片、一起听
   - 第 2 页：文件
   - 「一起听」window 捕获级坐标命中直达 window.PhoneChatListen.openSongModal()
   - 「发送个人名片」独立挂载外层容器 + 贴底完整日夜样式 + window 捕获级坐标命中
   - 「位置」卡片极简布局：居中矢量地图 + 底部位置栏（自动适配日夜模式）
   - 接入 window.PhoneChatMe.getActiveAvatarDataUrl() 实时同步用户头像
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
  var SVG_BOOKMARK_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var SVG_DOC_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var SVG_DOC_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var SVG_ASK9_SM = '<svg width="13" height="10" viewBox="0 0 24 18" fill="currentColor"><ellipse cx="7" cy="9" rx="3" ry="3.8"/><ellipse cx="17" cy="9" rx="3" ry="3.8"/></svg>';

  var SVG_MINI_MAP =
    '<svg class="ctp-map-svg" viewBox="0 0 260 124" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect class="ctp-map-ground" width="260" height="124"/>' +
      '<path class="ctp-map-water" d="M 196 -8 C 190 24 218 44 208 78 C 200 102 222 116 248 132 L 268 132 L 268 -8 Z"/>' +
      '<path class="ctp-map-park" d="M -8 68 L 66 58 L 86 94 L 34 130 L -8 130 Z"/>' +
      '<path class="ctp-map-park" d="M 96 -6 L 156 -6 L 148 32 L 104 28 Z"/>' +
      '<rect class="ctp-map-block" x="18" y="14" width="38" height="24" rx="4"/>' +
      '<rect class="ctp-map-block" x="118" y="48" width="44" height="26" rx="4"/>' +
      '<rect class="ctp-map-block" x="110" y="90" width="52" height="22" rx="4"/>' +
      '<path class="ctp-map-road-sm" d="M -10 22 L 270 38 M 68 -10 L 58 134 M 166 -10 L 144 134 M -10 94 L 270 78"/>' +
      '<path class="ctp-map-road-lg" d="M -10 56 C 58 48 124 64 194 54 C 226 49 248 42 270 36"/>' +
      '<path class="ctp-map-road-lg" d="M 106 -10 C 100 38 114 74 98 134"/>' +
      '<path class="ctp-map-road-main" d="M -10 56 C 58 48 124 64 194 54 C 226 49 248 42 270 36"/>' +
      '<path class="ctp-map-road-main" d="M 106 -10 C 100 38 114 74 98 134"/>' +
    '</svg>' +
    '<div class="ctp-map-marker">' +
      '<span class="ctp-map-halo"></span>' +
      '<span class="ctp-map-shadow"></span>' +
      '<span class="ctp-map-pin-drop">' +
        '<svg width="26" height="32" viewBox="0 0 26 32" fill="none">' +
          '<path d="M13 1C6.925 1 2 5.925 2 12c0 7.4 9.5 17.6 10.35 18.48a.9.9 0 0 0 1.3 0C14.5 29.6 24 19.4 24 12 24 5.925 19.075 1 13 1Z" fill="#ff3b30"/>' +
          '<circle cx="13" cy="11.5" r="4.2" fill="#ffffff"/>' +
        '</svg>' +
      '</span>' +
    '</div>';

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
  var cachedMyAvatar = '';
  var cardOpenedAt = 0;

  function getRootContainer() {
    var appChat = document.getElementById('app-chat');
    if (appChat && appChat.parentElement) return appChat.parentElement;
    return document.body;
  }

  function bindFastTap(el, handler) {
    if (!el || typeof handler !== 'function') return;
    var sx = 0, sy = 0, moved = false, lastFire = 0;
    function fire(e) {
      var now = Date.now();
      if (now - lastFire < 350) return;
      lastFire = now;
      handler(e);
    }
    el.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
      moved = false;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - sx) > 14 || Math.abs(t.clientY - sy) > 14) {
        moved = true;
      }
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (moved) return;
      e.preventDefault();
      e.stopPropagation();
      fire(e);
    });
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      fire(e);
    });
  }

  function ensureGiftExtraStyles() {
    if (document.getElementById('ctpGiftExtraStyle')) return;
    var st = document.createElement('style');
    st.id = 'ctpGiftExtraStyle';
    st.textContent =
      /* 通用弹窗层级保障 */
      '.ctp-sheet-mask { cursor: pointer; }' +
      '.ctp-sheet-mask.open { z-index: 9990 !important; pointer-events: auto !important; }' +
      '.ctp-pick-row { width: 100%; text-align: left; font-family: inherit; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }' +

      /* 独立挂载的「发送个人名片」完整自包含贴底样式（浅色默认） */
      '#ctpCardMask {' +
        'display: none; position: absolute !important; inset: 0 !important; z-index: 9998 !important;' +
        'background: rgba(0, 0, 0, 0.44) !important;' +
        'flex-direction: row !important; align-items: flex-end !important; justify-content: center !important;' +
        'padding: 0 !important; margin: 0 !important;' +
        'font-family: var(--app-font, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif);' +
        'box-sizing: border-box;' +
      '}' +
      '#ctpCardMask.open { display: flex !important; opacity: 1 !important; pointer-events: auto !important; }' +
      '#ctpCardMask .ctp-sheet-panel {' +
        'width: 100% !important; max-width: none !important; max-height: 76%; margin: 0 !important;' +
        'display: flex; flex-direction: column;' +
        'background: #ffffff; color: #111111;' +
        'border-radius: 26px 26px 0 0;' +
        'box-shadow: 0 -10px 36px rgba(0, 0, 0, 0.16);' +
        'padding: 10px 16px calc(24px + env(safe-area-inset-bottom, 0px));' +
        'box-sizing: border-box; transform: none !important;' +
      '}' +
      '#ctpCardMask .ctp-sheet-grabber {' +
        'width: 36px; height: 4px; border-radius: 999px; background: rgba(0, 0, 0, 0.14);' +
        'margin: 0 auto 12px; flex-shrink: 0;' +
      '}' +
      '#ctpCardMask .ctp-sheet-head {' +
        'display: flex; align-items: center; justify-content: space-between;' +
        'margin-bottom: 14px; padding: 0 2px; flex-shrink: 0;' +
      '}' +
      '#ctpCardMask .ctp-sheet-title {' +
        'font-size: calc(var(--app-font-size, 15px) + 2px); font-weight: 700;' +
        'color: #111111; letter-spacing: -0.01em;' +
      '}' +
      '#ctpCardMask .ctp-sheet-close {' +
        'width: 32px; height: 32px; border-radius: 50%; border: none; padding: 0;' +
        'background: #f2f2f7; color: #3a3a3c;' +
        'display: flex; align-items: center; justify-content: center; cursor: pointer;' +
        '-webkit-tap-highlight-color: transparent;' +
        'transition: transform 0.18s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.16s ease;' +
      '}' +
      '#ctpCardMask .ctp-sheet-close.is-pressed { transform: scale(0.88); opacity: 0.75; }' +
      '#ctpCardMask .ctp-sheet-body {' +
        'display: flex; flex-direction: column; gap: 10px; overflow-y: auto;' +
        '-webkit-overflow-scrolling: touch; padding: 0 2px 4px;' +
      '}' +
      '#ctpCardMask .ctp-pick-row {' +
        'display: flex; align-items: center; gap: 12px; padding: 11px 13px;' +
        'border-radius: 18px; border: 1px solid rgba(0, 0, 0, 0.05);' +
        'background: #f5f5f7; color: #111111; box-sizing: border-box;' +
        'transition: transform 0.18s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.16s ease;' +
      '}' +
      '#ctpCardMask .ctp-pick-row.is-pressed { transform: scale(0.97); opacity: 0.84; }' +
      '#ctpCardMask .ctp-pick-av {' +
        'width: 44px; height: 44px; border-radius: 13px; overflow: hidden; flex-shrink: 0;' +
        'background: #e5e5ea; color: #111111;' +
        'display: flex; align-items: center; justify-content: center;' +
        'font-size: calc(var(--app-font-size, 15px) + 1px); font-weight: 700;' +
      '}' +
      '#ctpCardMask .ctp-pick-av img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
      '#ctpCardMask .ctp-pick-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }' +
      '#ctpCardMask .ctp-pick-title {' +
        'font-size: var(--app-font-size, 15px); font-weight: 600; color: #111111;' +
        'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' +
      '}' +
      '#ctpCardMask .ctp-pick-sub {' +
        'font-size: calc(var(--app-font-size, 15px) - 2.5px); color: #8e8e93;' +
        'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' +
      '}' +
      '#ctpCardMask .ctp-pick-pill {' +
        'flex-shrink: 0; padding: 7px 14px; border-radius: 999px;' +
        'background: #111111; color: #ffffff;' +
        'font-size: calc(var(--app-font-size, 15px) - 2px); font-weight: 600;' +
      '}' +
      '#ctpCardMask .ctp-empty-card {' +
        'padding: 24px 16px; border-radius: 16px; background: #f5f5f7;' +
        'color: #8e8e93; text-align: center; font-size: calc(var(--app-font-size, 15px) - 1px);' +
      '}' +

      /* 极简 Apple Maps 风格位置卡片（无顶部多余文字，地图居中对称 + 底部位置栏） */
      '.ctp-loc-card { padding: 0 !important; overflow: hidden !important; }' +
      '.ctp-loc-card .ctp-rc-map {' +
        'position: relative !important; height: 120px !important; margin: 10px 10px 0 !important;' +
        'border-radius: 13px !important; overflow: hidden !important;' +
        'background: #eef1f5 !important; background-image: none !important;' +
        'border: 1px solid rgba(0, 0, 0, 0.06) !important; box-sizing: border-box !important;' +
      '}' +
      '.ctp-loc-card .ctp-rc-foot {' +
        'margin-top: 0 !important; padding: 9px 12px 10px !important; border-top: none !important;' +
      '}' +
      '.ctp-rc-map::before, .ctp-rc-map::after { display: none !important; content: none !important; }' +
      '.ctp-map-svg { width: 100%; height: 100%; display: block; }' +
      '.ctp-map-ground { fill: #f1f3f6; }' +
      '.ctp-map-water { fill: #d6e9f8; }' +
      '.ctp-map-park { fill: #dceee0; }' +
      '.ctp-map-block { fill: #e6e9ef; }' +
      '.ctp-map-road-sm { fill: none; stroke: #ffffff; stroke-width: 3.5; stroke-linecap: round; opacity: 0.85; }' +
      '.ctp-map-road-lg { fill: none; stroke: #dde2ea; stroke-width: 9.5; stroke-linecap: round; }' +
      '.ctp-map-road-main { fill: none; stroke: #ffffff; stroke-width: 7; stroke-linecap: round; }' +
      '.ctp-map-marker {' +
        'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -62%);' +
        'display: flex; align-items: center; justify-content: center; pointer-events: none;' +
      '}' +
      '.ctp-map-halo {' +
        'position: absolute; bottom: -5px; width: 34px; height: 16px; border-radius: 50%;' +
        'background: rgba(255, 59, 48, 0.22);' +
      '}' +
      '.ctp-map-shadow {' +
        'position: absolute; bottom: -1px; width: 12px; height: 5px; border-radius: 50%;' +
        'background: rgba(0, 0, 0, 0.24); filter: blur(1.5px);' +
      '}' +
      '.ctp-map-pin-drop { position: relative; z-index: 2; display: flex; filter: drop-shadow(0 3px 6px rgba(255, 59, 48, 0.34)); }' +

      /* 礼物弹窗样式 */
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

      /* 深色模式（手动深色） */
      'html[data-theme="dark"] #ctpCardMask { background: rgba(0, 0, 0, 0.62) !important; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-sheet-panel { background: #1c1c1e; color: #f5f5f7; box-shadow: 0 -10px 36px rgba(0, 0, 0, 0.5); border-top: 0.5px solid rgba(255, 255, 255, 0.1); }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-sheet-grabber { background: rgba(255, 255, 255, 0.24); }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-sheet-title { color: #f5f5f7; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-sheet-close { background: #2c2c2e; color: #e5e5ea; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-pick-row { background: #262629; color: #f5f5f7; border-color: rgba(255, 255, 255, 0.06); }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-pick-av { background: #3a3a3c; color: #f5f5f7; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-pick-title { color: #f5f5f7; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-pick-sub { color: #98989d; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-pick-pill { background: #f5f5f7; color: #111111; }' +
      'html[data-theme="dark"] #ctpCardMask .ctp-empty-card { background: #262629; color: #98989d; }' +
      'html[data-theme="dark"] .ctp-loc-card .ctp-rc-map { background: #1a1c22 !important; border-color: rgba(255, 255, 255, 0.08) !important; }' +
      'html[data-theme="dark"] .ctp-map-ground { fill: #1b1d23; }' +
      'html[data-theme="dark"] .ctp-map-water { fill: #18293a; }' +
      'html[data-theme="dark"] .ctp-map-park { fill: #1d2e26; }' +
      'html[data-theme="dark"] .ctp-map-block { fill: #23262f; }' +
      'html[data-theme="dark"] .ctp-map-road-sm { stroke: #2b2f3a; }' +
      'html[data-theme="dark"] .ctp-map-road-lg { stroke: #14161b; }' +
      'html[data-theme="dark"] .ctp-map-road-main { stroke: #393e4c; }' +
      'html[data-theme="dark"] .ctp-map-halo { background: rgba(255, 69, 58, 0.28); }' +
      'html[data-theme="dark"] .ctp-gift-modal { background: #18181b; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-inp { background: #242429; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-btn.is-cancel { background: #25252b; color: #f5f5f7; }' +
      'html[data-theme="dark"] .ctp-gift-detail-item { color: #f5f5f7; }' +

      /* 深色模式（跟随系统） */
      '@media (prefers-color-scheme: dark) {' +
        'html:not([data-theme="light"]) #ctpCardMask { background: rgba(0, 0, 0, 0.62) !important; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-sheet-panel { background: #1c1c1e; color: #f5f5f7; box-shadow: 0 -10px 36px rgba(0, 0, 0, 0.5); border-top: 0.5px solid rgba(255, 255, 255, 0.1); }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-sheet-grabber { background: rgba(255, 255, 255, 0.24); }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-sheet-title { color: #f5f5f7; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-sheet-close { background: #2c2c2e; color: #e5e5ea; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-pick-row { background: #262629; color: #f5f5f7; border-color: rgba(255, 255, 255, 0.06); }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-pick-av { background: #3a3a3c; color: #f5f5f7; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-pick-title { color: #f5f5f7; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-pick-sub { color: #98989d; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-pick-pill { background: #f5f5f7; color: #111111; }' +
        'html:not([data-theme="light"]) #ctpCardMask .ctp-empty-card { background: #262629; color: #98989d; }' +
        'html:not([data-theme="light"]) .ctp-loc-card .ctp-rc-map { background: #1a1c22 !important; border-color: rgba(255, 255, 255, 0.08) !important; }' +
        'html:not([data-theme="light"]) .ctp-map-ground { fill: #1b1d23; }' +
        'html:not([data-theme="light"]) .ctp-map-water { fill: #18293a; }' +
        'html:not([data-theme="light"]) .ctp-map-park { fill: #1d2e26; }' +
        'html:not([data-theme="light"]) .ctp-map-block { fill: #23262f; }' +
        'html:not([data-theme="light"]) .ctp-map-road-sm { stroke: #2b2f3a; }' +
        'html:not([data-theme="light"]) .ctp-map-road-lg { stroke: #14161b; }' +
        'html:not([data-theme="light"]) .ctp-map-road-main { stroke: #393e4c; }' +
        'html:not([data-theme="light"]) .ctp-map-halo { background: rgba(255, 69, 58, 0.28); }' +
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

  function resolveMyAvatarAsync(cb) {
    var domImg = document.querySelector('#ctRoomMessages .ct-msg-row.me .ct-msg-avatar img');
    if (domImg && domImg.getAttribute('src')) {
      cachedMyAvatar = domImg.getAttribute('src');
      if (cb) cb(cachedMyAvatar);
      return;
    }
    if (cachedMyAvatar) {
      if (cb) cb(cachedMyAvatar);
      return;
    }
    if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAvatarDataUrl === 'function') {
      Promise.resolve(window.PhoneChatMe.getActiveAvatarDataUrl()).then(function (url) {
        if (url) cachedMyAvatar = url;
        if (cb) cb(url || '');
      }).catch(function () {
        if (cb) cb('');
      });
      return;
    }
    if (cb) cb('');
  }

  function resolveContactAvatar(cardId, cardName, fallbackAv) {
    if (cardId && window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      try {
        var av = window.PhoneArchive.getCharAvatar(cardId);
        if (av) return av;
      } catch (e) {}
    }
    if (fallbackAv) return fallbackAv;
    if (cardName === '水小九') return 'icons/IMG_0288.jpeg';
    return '';
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
    try {
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

      var myAvInner = cachedMyAvatar ? ('<img src="' + escapeHtml(cachedMyAvatar) + '" alt="">') : '我';

      var group = document.createElement('div');
      group.className = 'ct-msg-group me';
      group.setAttribute('data-msg-id', msgObj.id);
      group.setAttribute('data-sender-name', '我');
      group.innerHTML =
        '<div class="ct-msg-row me">' +
          '<div class="ct-msg-avatar">' + myAvInner + '</div>' +
          '<div class="ct-msg-bubble"></div>' +
        '</div>';
      box.appendChild(group);

      var avBox = group.querySelector('.ct-msg-avatar');
      if (!cachedMyAvatar && avBox) {
        resolveMyAvatarAsync(function (url) {
          if (url && avBox) avBox.innerHTML = '<img src="' + escapeHtml(url) + '" alt="">';
        });
      }

      renderBubbleEl(group.querySelector('.ct-msg-bubble'), msgObj);
      box.scrollTop = box.scrollHeight;
    } catch (err) {}
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
      bubble.classList.add('ctp-rich-card', 'ctp-loc-card');
      bubble.dataset.ctpRendered = '1';
      var locLabel = (msg.locTitle && msg.locTitle !== '我的位置' && msg.locTitle !== '我') ? msg.locTitle : '位置';
      bubble.innerHTML =
        '<div class="ctp-rc-map">' + SVG_MINI_MAP + '</div>' +
        '<div class="ctp-rc-foot">' +
          '<span class="ctp-rc-foot-tag">' + SVG_PIN_SM + '<span>' + escapeHtml(locLabel) + '</span></span>' +
          '<span class="ctp-rc-foot-chevron">' + SVG_CHEVRON_R + '</span>' +
        '</div>';
      return;
    }

    if (msg.type === 'contact_card') {
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-loc-card');
      bubble.classList.add('ctp-rich-card', 'ctp-contact-pill');
      bubble.dataset.ctpRendered = '1';
      var resolvedAv = resolveContactAvatar(msg.cardId, msg.cardName, msg.cardAvatar);
      var avHtml = resolvedAv
        ? '<img src="' + escapeHtml(resolvedAv) + '" alt="">'
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
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill', 'ctp-loc-card');
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
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill', 'ctp-loc-card');
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
      bubble.classList.remove('ctp-img-bubble', 'ctp-transfer-bubble', 'is-faded', 'ctp-gift-bubble', 'is-claimed', 'ctp-contact-pill', 'ctp-loc-card');
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

      bubble.classList.remove('ctp-img-bubble', '

http://googleusercontent.com/immersive_entry_chip/0

完整的 **`apps/chat-panels.js`** 已经准备好在右侧打开了，直接全选复制替换并把 `index.html` 里的 `?v=` 数字加 1 就行。

这次把两处一次修齐了：名片弹窗强制贴在屏幕最底边不再浮空，位置卡片去掉顶部文字，改成居中对称的矢量地图加底部「位置 >」栏（含日夜模式、动态字号和 `.is-pressed` 按压反馈）。