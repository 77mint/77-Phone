/* =========================================================
   Chat 我的页（仿微信「我」独立模块 + 全套二级子页）
   - 不改动 apps/chat.js / apps/chat.css，独立接管我的 tab
   - 功能：个人资料 / 钱包 / 收藏 / 表情包（支持图片/JSON/Word .docx 导入） / 朋友圈 / 设置 / 切换账号
   - 支持：主号、小号（均可绑定不同「面具」）、硬核带锁 Char 账号（偷看 / 正常登录，不可手动重锁）
   ========================================================= */
(function () {
  var rendering = false;
  var pageStack = [];
  var overlayEl = null;
  var modalBackdropEl = null;
  var toastEl = null;
  var toastTimer = null;
  var avatarCache = {};
  var stickerImgCache = {};
  var coverCache = {};

  var KEY_ACCOUNTS = 'chat_user_accounts_v1';
  var KEY_ACTIVE_ACC = 'chat_active_account_id_v1';
  var KEY_WALLET_BAL = 'chat_wallet_balance_v1';
  var KEY_WALLET_LOGS = 'chat_wallet_logs_v1';
  var KEY_FAVORITES = 'chat_favorites_v1';
  var KEY_STICKERS = 'chat_sticker_packs_v1';
  var KEY_PREFS = 'chat_me_prefs_v1';
  var KEY_CHAR_PASSCODES = 'chat_char_passcodes_v1';

  var MAIN_ITEMS = [
    {
      id: 'wallet',
      label: '钱包',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#07c160" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>'
    },
    {
      id: 'favorites',
      label: '收藏',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3Z" stroke="#f5a623"/><path d="M3.5 7.3 12 12l8.5-4.7" stroke="#ff4d4f"/><path d="M12 12v9.5" stroke="#2d8cf0"/></svg>'
    },
    {
      id: 'stickers',
      label: '表情包',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M8.2 13.8c.9 1.6 2.2 2.4 3.8 2.4s2.9-.8 3.8-2.4"/><circle cx="9" cy="9.5" r="1" fill="#f5a623" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="#f5a623" stroke="none"/></svg>'
    },
    {
      id: 'moments',
      label: '朋友圈',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#2d8cf0" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="M21 16.5l-4.8-4.8a1.2 1.2 0 0 0-1.7 0L7.5 18.7"/></svg>'
    }
  ];

  var SETTINGS_ITEM = {
    id: 'settings',
    label: '设置',
    icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#2d8cf0" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  var SVG_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var SVG_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  var SVG_USER = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var SVG_SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var SVG_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var SVG_EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  /* ---------------- 基础存储工具 ---------------- */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  }

  /* ---------------- PhoneDB 封装 ---------------- */
  function dbGet(key) {
    if (!key) return Promise.resolve('');
    if (window.PhoneDB && typeof window.PhoneDB.get === 'function') {
      return Promise.resolve(window.PhoneDB.get(key)).catch(function () { return ''; });
    }
    try {
      return Promise.resolve(localStorage.getItem('phonedb_fb_' + key) || '');
    } catch (e) {
      return Promise.resolve('');
    }
  }

  function dbSet(key, val) {
    if (!key) return Promise.resolve();
    if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
      return Promise.resolve(window.PhoneDB.set(key, val)).catch(function () {});
    }
    try {
      localStorage.setItem('phonedb_fb_' + key, val);
    } catch (e) {}
    return Promise.resolve();
  }

  function dbRemove(key) {
    if (!key) return Promise.resolve();
    if (window.PhoneDB) {
      if (typeof window.PhoneDB.del === 'function') {
        return Promise.resolve(window.PhoneDB.del(key)).catch(function () {});
      }
      if (typeof window.PhoneDB.remove === 'function') {
        return Promise.resolve(window.PhoneDB.remove(key)).catch(function () {});
      }
      if (typeof window.PhoneDB.delete === 'function') {
        return Promise.resolve(window.PhoneDB.delete(key)).catch(function () {});
      }
    }
    try {
      localStorage.removeItem('phonedb_fb_' + key);
    } catch (e) {}
    return Promise.resolve();
  }

  /* ---------------- 图片读取与压缩 ---------------- */
  function fileToDataUrl(file, maxEdge, keepGif) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read_failed')); };
      reader.onload = function () {
        var rawUrl = reader.result;
        if (keepGif && file.type === 'image/gif') {
          resolve(rawUrl);
          return;
        }
        var img = new Image();
        img.onerror = function () { resolve(rawUrl); };
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var limit = maxEdge || 512;
          if (!w || !h || (w <= limit && h <= limit && file.size < 320 * 1024)) {
            resolve(rawUrl);
            return;
          }
          var ratio = Math.min(limit / w, limit / h, 1);
          var cw = Math.max(1, Math.round(w * ratio));
          var ch = Math.max(1, Math.round(h * ratio));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var isPng = file.type === 'image/png' || file.type === 'image/webp';
          try {
            var out = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);
            resolve(out);
          } catch (e) {
            resolve(rawUrl);
          }
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function bytesToDataUrl(uint8, mime) {
    return new Promise(function (resolve) {
      var blob = new Blob([uint8], { type: mime || 'image/png' });
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result || ''); };
      reader.onerror = function () { resolve(''); };
      reader.readAsDataURL(blob);
    });
  }

  function guessImageMime(path) {
    var lower = String(path || '').toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/png';
  }

  /* ---------------- 纯本地 ZIP / Word (.docx) 解析器 ---------------- */
  function readUint16LE(view, off) { return view.getUint16(off, true); }
  function readUint32LE(view, off) { return view.getUint32(off, true); }

  function unzipDocxEntries(buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var eocdOffset = -1;
    var minOff = Math.max(0, bytes.length - 65558);

    for (var i = bytes.length - 22; i >= minOff; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) return Promise.reject(new Error('not_zip'));

    var totalEntries = readUint16LE(view, eocdOffset + 10);
    var cdOffset = readUint32LE(view, eocdOffset + 16);
    var dec = new TextDecoder('utf-8');
    var entries = {};
    var tasks = [];
    var ptr = cdOffset;

    for (var idx = 0; idx < totalEntries && ptr + 46 <= bytes.length; idx++) {
      if (readUint32LE(view, ptr) !== 0x02014b50) break;
      var method = readUint16LE(view, ptr + 10);
      var compSize = readUint32LE(view, ptr + 20);
      var nameLen = readUint16LE(view, ptr + 28);
      var extraLen = readUint16LE(view, ptr + 30);
      var commentLen = readUint16LE(view, ptr + 32);
      var localOff = readUint32LE(view, ptr + 42);
      var entryName = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      if (!entryName || entryName.endsWith('/')) continue;
      if (localOff + 30 > bytes.length) continue;

      var lhNameLen = readUint16LE(view, localOff + 26);
      var lhExtraLen = readUint16LE(view, localOff + 28);
      var dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      var compSlice = bytes.subarray(dataStart, dataStart + compSize);

      (function (name, m, slice) {
        if (m === 0) {
          entries[name] = slice;
        } else if (m === 8 && typeof DecompressionStream === 'function') {
          tasks.push(
            new Response(new Blob([slice]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
              .arrayBuffer()
              .then(function (ab) { entries[name] = new Uint8Array(ab); })
              .catch(function () {})
          );
        }
      })(entryName, method, compSlice);
    }

    return Promise.all(tasks).then(function () { return entries; });
  }

  /* ---------------- 外部人设与档案读取（面具 + Char） ---------------- */
  function getMasksSafe() {
    if (window.PhoneMask && typeof window.PhoneMask.getMasks === 'function') {
      try {
        var list = window.PhoneMask.getMasks();
        return Array.isArray(list) ? list : [];
      } catch (e) {}
    }
    var raw = readJSON('phone_masks_v1', []);
    return Array.isArray(raw) ? raw : [];
  }

  function getMaskAvatarSafe(maskId) {
    if (!maskId) return Promise.resolve('');
    if (window.PhoneMask && typeof window.PhoneMask.getMaskAvatar === 'function') {
      return Promise.resolve(window.PhoneMask.getMaskAvatar(maskId)).catch(function () { return ''; });
    }
    return dbGet('mask_avatar_' + maskId);
  }

  function getCharsSafe() {
    if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      try {
        var list = window.PhoneArchive.getChars();
        return Array.isArray(list) ? list : [];
      } catch (e) {}
    }
    return [];
  }

  function getCharAvatarSafe(charId) {
    if (!charId) return Promise.resolve('');
    if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      return Promise.resolve(window.PhoneArchive.getCharAvatar(charId)).catch(function () { return ''; });
    }
    return Promise.resolve('');
  }

  /* ---------------- 账号、面具绑定与 Char 硬核密码锁 ---------------- */
  function getAccounts() {
    var list = readJSON(KEY_ACCOUNTS, null);
    if (!Array.isArray(list) || !list.length) {
      list = [{
        id: 'acc_default',
        type: 'main',
        maskId: '',
        charId: '',
        name: '我',
        chatId: '',
        signature: '',
        avatarDbKey: ''
      }];
      writeJSON(KEY_ACCOUNTS, list);
      localStorage.setItem(KEY_ACTIVE_ACC, 'acc_default');
    }
    return list;
  }

  function saveAccounts(list) {
    writeJSON(KEY_ACCOUNTS, list);
  }

  function getActiveAccount() {
    var list = getAccounts();
    var activeId = localStorage.getItem(KEY_ACTIVE_ACC) || list[0].id;
    var found = list.find(function (a) { return a.id === activeId; });
    if (!found) {
      found = list[0];
      localStorage.setItem(KEY_ACTIVE_ACC, found.id);
    }
    return found;
  }

  function setActiveAccount(id) {
    var list = getAccounts();
    var found = list.find(function (a) { return a.id === id; });
    if (!found) return false;
    localStorage.setItem(KEY_ACTIVE_ACC, found.id);
    try {
      window.dispatchEvent(new CustomEvent('phone:chat-account-changed', { detail: found }));
    } catch (e) {}
    return true;
  }

  function getCharPasscodeStore() {
    var map = readJSON(KEY_CHAR_PASSCODES, {});
    return (map && typeof map === 'object') ? map : {};
  }

  function saveCharPasscodeStore(map) {
    writeJSON(KEY_CHAR_PASSCODES, map);
  }

  function isShuixiaojiu(charId, charName) {
    return charId === 'assistant-shuixiaojiu' || charName === '水小九';
  }

  function generateRandomPasscode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function getCharPasscode(charId, charName) {
    if (!charId) return '';
    var map = getCharPasscodeStore();
    if (!map[charId] || !map[charId].code) {
      map[charId] = {
        code: isShuixiaojiu(charId, charName) ? 'shuixiaojiu009' : generateRandomPasscode(),
        unlocked: false,
        resetAllowed: false,
        loginMode: 'stealth',
        changedByChar: false,
        updatedAt: Date.now()
      };
      saveCharPasscodeStore(map);
    } else if (isShuixiaojiu(charId, charName) && !map[charId].changedByChar && !map[charId].unlocked && map[charId].code !== 'shuixiaojiu009') {
      map[charId].code = 'shuixiaojiu009';
      saveCharPasscodeStore(map);
    }
    return map[charId].code;
  }

  function isCharUnlocked(charId) {
    if (!charId) return false;
    var map = getCharPasscodeStore();
    return !!(map[charId] && map[charId].unlocked);
  }

  function getCharLoginMode(charId) {
    if (!charId) return 'stealth';
    var map = getCharPasscodeStore();
    return (map[charId] && map[charId].loginMode === 'normal') ? 'normal' : 'stealth';
  }

  function isCharResetAllowed(charId) {
    if (!charId) return false;
    var map = getCharPasscodeStore();
    return !!(map[charId] && map[charId].resetAllowed);
  }

  function setCharResetAllowed(charId, allowed) {
    if (!charId) return false;
    getCharPasscode(charId);
    var map = getCharPasscodeStore();
    map[charId].resetAllowed = !!allowed;
    saveCharPasscodeStore(map);
    return true;
  }

  function verifyCharPasscode(charId, charName, inputCode, loginMode) {
    if (!charId) return false;
    var realCode = getCharPasscode(charId, charName);
    if (String(inputCode || '').trim() === String(realCode).trim()) {
      var map = getCharPasscodeStore();
      map[charId].unlocked = true;
      map[charId].loginMode = loginMode === 'normal' ? 'normal' : 'stealth';
      map[charId].lastLoginAt = Date.now();
      saveCharPasscodeStore(map);
      return true;
    }
    return false;
  }

  function setCharPasscode(charId, newCode, relock) {
    var prefs = getPrefs();
    if (!prefs.allowCharChangePasscode) return false;
    var clean = String(newCode || '').trim();
    if (!clean) return false;
    getCharPasscode(charId);
    var map = getCharPasscodeStore();
    map[charId].code = clean;
    map[charId].unlocked = relock === false ? !!map[charId].unlocked : false;
    map[charId].updatedAt = Date.now();
    map[charId].changedByChar = true;
    saveCharPasscodeStore(map);

    if (relock !== false) {
      var active = getActiveAccount();
      if (active && active.type === 'char' && active.charId === charId) {
        var fallback = getAccounts().find(function (a) { return a.type !== 'char'; });
        if (fallback) setActiveAccount(fallback.id);
        showToast((active.name || '对方') + ' 偷偷改掉了密码，已重新上锁');
      }
    }
    return true;
  }

  function forceResetCharPasscode(charId, newCode) {
    if (!charId || !isCharResetAllowed(charId)) return false;
    var clean = String(newCode || '').trim();
    if (!clean) return false;
    getCharPasscode(charId);
    var map = getCharPasscodeStore();
    map[charId].code = clean;
    map[charId].unlocked = true;
    map[charId].updatedAt = Date.now();
    map[charId].changedByChar = true;
    saveCharPasscodeStore(map);
    return true;
  }

  function getOrCreateCharAccount(ch) {
    var list = getAccounts();
    var existing = list.find(function (a) { return a.type === 'char' && a.charId === ch.id; });
    if (existing) return existing;
    var created = {
      id: 'acc_char_' + ch.id,
      type: 'char',
      maskId: '',
      charId: ch.id,
      name: ch.name || 'Char',
      chatId: '',
      signature: ch.tagline || '',
      avatarDbKey: ''
    };
    list.push(created);
    saveAccounts(list);
    return created;
  }

  /* ---------------- 账号数据隔离 ---------------- */
  function scopedKey(baseKey, accountId) {
    var id = accountId || getActiveAccount().id;
    if (!id || id === 'acc_default') return baseKey;
    return baseKey + '_' + id;
  }

  function getWalletBalance() {
    var raw = localStorage.getItem(scopedKey(KEY_WALLET_BAL));
    var num = parseFloat(raw);
    return isFinite(num) ? num : 0;
  }

  function setWalletBalance(val) {
    var n = Math.max(0, Math.round((parseFloat(val) || 0) * 100) / 100);
    localStorage.setItem(scopedKey(KEY_WALLET_BAL), n.toFixed(2));
    return n;
  }

  function getWalletLogs() {
    var logs = readJSON(scopedKey(KEY_WALLET_LOGS), []);
    return Array.isArray(logs) ? logs : [];
  }

  function addWalletLog(type, amount, title) {
    var key = scopedKey(KEY_WALLET_LOGS);
    var logs = readJSON(key, []);
    if (!Array.isArray(logs)) logs = [];
    logs.unshift({
      id: genId('bill'),
      type: type === 'out' ? 'out' : 'in',
      amount: Math.abs(parseFloat(amount) || 0),
      title: title || (type === 'out' ? '支出' : '入账'),
      createdAt: Date.now()
    });
    if (logs.length > 200) logs = logs.slice(0, 200);
    writeJSON(key, logs);
  }

  function getFavorites() {
    var list = readJSON(scopedKey(KEY_FAVORITES), []);
    return Array.isArray(list) ? list : [];
  }

  function saveFavorites(list) {
    writeJSON(scopedKey(KEY_FAVORITES), list);
  }

  function getStickerPacks() {
    var list = readJSON(KEY_STICKERS, []);
    return Array.isArray(list) ? list : [];
  }

  function saveStickerPacks(list) {
    writeJSON(KEY_STICKERS, list);
  }

  function getPrefs() {
    var p = readJSON(KEY_PREFS, {});
    return Object.assign({
      enterToSend: false,
      notifySound: true,
      showWalletBalance: true,
      allowCharChangePasscode: true
    }, p || {});
  }

  function savePrefs(p) {
    writeJSON(KEY_PREFS, p);
  }

  /* ---------------- 交互反馈 ---------------- */
  var PRESS_SELECTOR = '.ctme-row, .ctme-profile, .ctme-back-btn, .ctme-pill-btn, .ctme-item, .ctme-btn, .ctme-wallet-btn, .ctme-fav-card, .ctme-pack-row, .ctme-sticker-cell, .ctme-action-btn, .ctme-mini-pill, .ctme-quick-amt, .ctme-mask-quick, .ctme-chip, .ctme-acc-top, .ctme-switch, .ctme-avatar-lg, .ctme-album-cover, .ctme-pwd-eye, .ctme-sheet-close';

  function bindPressFeedback(root) {
    if (!root || root._ctmePressDelegated) return;
    root._ctmePressDelegated = true;
    var activePressed = null;

    function clearPressed() {
      if (activePressed) {
        activePressed.classList.remove('is-pressed');
        activePressed = null;
      }
    }

    root.addEventListener('touchstart', function (e) {
      var target = e.target && e.target.closest ? e.target.closest(PRESS_SELECTOR) : null;
      if (target) {
        clearPressed();
        activePressed = target;
        activePressed.classList.add('is-pressed');
      }
    }, { passive: true });
    root.addEventListener('touchmove', clearPressed, { passive: true });
    root.addEventListener('touchend', clearPressed, { passive: true });
    root.addEventListener('touchcancel', clearPressed, { passive: true });
  }

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ctme-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1900);
  }

  function syncViewportHeight() {
    var vv = window.visualViewport;
    if (!vv) return;
    if (modalBackdropEl && modalBackdropEl.classList.contains('is-open')) {
      modalBackdropEl.style.height = vv.height + 'px';
      modalBackdropEl.style.top = '0px';
      window.scrollTo(0, 0);
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewportHeight);
    window.visualViewport.addEventListener('scroll', syncViewportHeight);
  }

  function keepInputVisible(container) {
    if (!container) return;
    container.querySelectorAll('input, textarea').forEach(function (inp) {
      if (inp._ctmeFocusBound) return;
      inp._ctmeFocusBound = true;
      inp.addEventListener('focus', function () {
        setTimeout(function () {
          syncViewportHeight();
          var scroller = inp.closest('.ctme-sheet-body, .ctme-sub-scroll');
          if (!scroller) return;
          var sRect = scroller.getBoundingClientRect();
          var iRect = inp.getBoundingClientRect();
          if (iRect.bottom > sRect.bottom - 18) {
            scroller.scrollTop += (iRect.bottom - sRect.bottom + 28);
          } else if (iRect.top < sRect.top + 12) {
            scroller.scrollTop -= (sRect.top - iRect.top + 20);
          }
        }, 260);
      });
    });
  }

  /* ---------------- 底部 Sheet 弹窗 ---------------- */
  function ensureModal() {
    if (modalBackdropEl) return modalBackdropEl;
    modalBackdropEl = document.createElement('div');
    modalBackdropEl.className = 'ctme-modal-backdrop';
    modalBackdropEl.innerHTML =
      '<div class="ctme-sheet" role="dialog">' +
        '<div class="ctme-sheet-head">' +
          '<div class="ctme-sheet-title" id="ctmeSheetTitle"></div>' +
          '<button type="button" class="ctme-sheet-close" id="ctmeSheetClose" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="ctme-sheet-body" id="ctmeSheetBody"></div>' +
      '</div>';
    document.body.appendChild(modalBackdropEl);

    bindPressFeedback(modalBackdropEl);
    modalBackdropEl.addEventListener('click', function (e) {
      if (e.target === modalBackdropEl) closeSheet();
    });
    modalBackdropEl.querySelector('#ctmeSheetClose').addEventListener('click', closeSheet);
    return modalBackdropEl;
  }

  function openSheet(title, bodyHtml, onReady) {
    var bd = ensureModal();
    bd.querySelector('#ctmeSheetTitle').textContent = title || '';
    var body = bd.querySelector('#ctmeSheetBody');
    body.innerHTML = bodyHtml || '';
    body.scrollTop = 0;
    bd.style.height = (window.visualViewport ? window.visualViewport.height + 'px' : '100%');
    bd.style.top = '0px';
    requestAnimationFrame(function () {
      bd.classList.add('is-open');
    });
    keepInputVisible(body);
    if (typeof onReady === 'function') onReady(body);
  }

  function closeSheet() {
    if (!modalBackdropEl) return;
    modalBackdropEl.classList.remove('is-open');
  }

  function openConfirm(title, message, confirmLabel, onConfirm) {
    openSheet(title,
      '<div style="font-size:var(--app-font-size,15px);color:#3a3a3c;line-height:1.5;padding:4px 2px 6px;">' + esc(message) + '</div>' +
      '<button type="button" class="ctme-action-btn is-danger" id="ctmeConfirmYes">' + esc(confirmLabel || '确认') + '</button>' +
      '<button type="button" class="ctme-action-btn" id="ctmeConfirmNo">取消</button>',
      function (body) {
        body.querySelector('#ctmeConfirmYes').addEventListener('click', function () {
          closeSheet();
          if (typeof onConfirm === 'function') onConfirm();
        });
        body.querySelector('#ctmeConfirmNo').addEventListener('click', closeSheet);
      }
    );
  }

  /* ---------------- 子页浮层导航栈 ---------------- */
  function ensureOverlay() {
    var appEl = document.querySelector('#app-chat .ct-app');
    if (!appEl) return null;
    if (overlayEl && appEl.contains(overlayEl)) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'ctme-overlay';
    overlayEl.id = 'ctmeOverlay';
    appEl.appendChild(overlayEl);
    bindPressFeedback(overlayEl);
    return overlayEl;
  }

  function pushPage(page) {
    pageStack.push(page);
    renderTopPage();
  }

  function popPage() {
    pageStack.pop();
    if (!pageStack.length) {
      if (overlayEl) overlayEl.classList.remove('is-open');
      renderMePage();
      return;
    }
    renderTopPage();
  }

  function closeAllPages() {
    pageStack = [];
    if (overlayEl) overlayEl.classList.remove('is-open');
  }

  function renderSubShell(title, rightHtml, bodyHtml) {
    var ov = ensureOverlay();
    if (!ov) return null;
    ov.innerHTML =
      '<div class="ctme-sub-header">' +
        '<div class="ctme-sub-header-left">' +
          '<button type="button" class="ctme-back-btn" id="ctmeSubBack" aria-label="返回">' + SVG_BACK + '</button>' +
          '<div class="ctme-sub-title">' + esc(title) + '</div>' +
        '</div>' +
        '<div class="ctme-sub-header-right">' + (rightHtml || '') + '</div>' +
      '</div>' +
      '<div class="ctme-sub-scroll" id="ctmeSubScroll">' + (bodyHtml || '') + '</div>';

    ov.querySelector('#ctmeSubBack').addEventListener('click', popPage);
    requestAnimationFrame(function () {
      ov.classList.add('is-open');
    });
    keepInputVisible(ov);
    return ov;
  }

  function renderTopPage() {
    if (!pageStack.length) return;
    var cur = pageStack[pageStack.length - 1];
    if (cur.id === 'profile') renderProfilePage(cur.accountId);
    else if (cur.id === 'wallet') renderWalletPage(cur.filter || 'all');
    else if (cur.id === 'favorites') renderFavoritesPage(cur.query || '');
    else if (cur.id === 'stickers') renderStickersPage();
    else if (cur.id === 'sticker-pack') renderStickerPackDetail(cur.packId);
    else if (cur.id === 'moments') renderMomentsAlbumPage();
    else if (cur.id === 'settings') renderSettingsPage();
    else if (cur.id === 'accounts') renderAccountsPage();
    else if (cur.id === 'blocklist') renderBlocklistPage();
  }

  /* ---------------- 头像加载辅助 ---------------- */
  function resolveAccountAvatar(acc) {
    if (!acc) return Promise.resolve('');
    if (acc.avatarDbKey) {
      if (avatarCache[acc.avatarDbKey]) return Promise.resolve(avatarCache[acc.avatarDbKey]);
      return dbGet(acc.avatarDbKey).then(function (u) {
        if (u) {
          avatarCache[acc.avatarDbKey] = u;
          return u;
        }
        return resolveLinkedAvatar(acc);
      });
    }
    return resolveLinkedAvatar(acc);
  }

  function resolveLinkedAvatar(acc) {
    if (acc.maskId) return getMaskAvatarSafe(acc.maskId);
    if (acc.charId) return getCharAvatarSafe(acc.charId);
    return Promise.resolve('');
  }

  function loadAccountAvatarInto(acc, containerEl) {
    if (!acc || !containerEl) return;
    resolveAccountAvatar(acc).then(function (url) {
      if (url && containerEl) {
        containerEl.innerHTML = '<img src="' + url + '" alt="' + esc(acc.name || '') + '">';
      }
    });
  }

  /* ---------------- 1. 个人资料子页 ---------------- */
  function renderProfilePage(targetAccountId) {
    var accounts = getAccounts();
    var acc = targetAccountId
      ? (accounts.find(function (a) { return a.id === targetAccountId; }) || getActiveAccount())
      : getActiveAccount();

    var masks = getMasksSafe();
    var pendingAvatarUrl = null;
    var clearAvatarFlag = false;
    var isCharAcc = acc.type === 'char';

    var maskSelectHtml = !isCharAcc
      ? '<div class="ctme-field">' +
          '<label class="ctme-field-label">所属「面具」角色卡</label>' +
          '<select class="ctme-select" id="ctmeProfMaskSelect">' +
            '<option value="">不绑定面具（默认）</option>' +
            masks.map(function (m) {
              return '<option value="' + esc(m.id) + '" ' + (acc.maskId === m.id ? 'selected' : '') + '>' + esc(m.name || '未命名面具') + '</option>';
            }).join('') +
          '</select>' +
        '</div>'
      : '';

    var ov = renderSubShell(
      targetAccountId && targetAccountId !== getActiveAccount().id ? '编辑账号资料' : '个人资料',
      '<button type="button" class="ctme-pill-btn is-primary" id="ctmeProfileSave">保存</button>',
      '<div class="ctme-card">' +
        '<div class="ctme-profile-edit-head">' +
          '<div class="ctme-avatar-lg" id="ctmeProfileAvaPreview">' + SVG_USER + '</div>' +
          '<div class="ctme-avatar-actions">' +
            '<button type="button" class="ctme-mini-pill" id="ctmeProfileUploadAva">更换头像</button>' +
            '<button type="button" class="ctme-mini-pill is-danger" id="ctmeProfileClearAva">清除头像</button>' +
          '</div>' +
          '<input type="file" id="ctmeProfileAvaInput" accept="image/*" style="display:none;">' +
        '</div>' +
      '</div>' +
      '<div class="ctme-card ctme-card-pad">' +
        maskSelectHtml +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">网名</label>' +
          '<input type="text" class="ctme-input" id="ctmeProfName" value="' + esc(acc.name) + '" placeholder="输入网名">' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">Chat ID</label>' +
          '<input type="text" class="ctme-input" id="ctmeProfChatId" value="' + esc(acc.chatId) + '" placeholder="例如：mint_77">' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">个性签名</label>' +
          '<input type="text" class="ctme-input" id="ctmeProfSig" value="' + esc(acc.signature) + '" placeholder="写一句简短的签名">' +
        '</div>' +
      '</div>'
    );
    if (!ov) return;

    var preview = ov.querySelector('#ctmeProfileAvaPreview');
    loadAccountAvatarInto(acc, preview);

    var maskSel = ov.querySelector('#ctmeProfMaskSelect');
    if (maskSel) {
      maskSel.addEventListener('change', function () {
        var mid = maskSel.value;
        if (!mid) return;
        var m = masks.find(function (x) { return x.id === mid; });
        if (m) {
          var nameInp = ov.querySelector('#ctmeProfName');
          if (nameInp && (!nameInp.value || nameInp.value === '我')) nameInp.value = m.name || '我';
          if (!pendingAvatarUrl && !acc.avatarDbKey) {
            getMaskAvatarSafe(mid).then(function (u) {
              if (u) preview.innerHTML = '<img src="' + u + '" alt="avatar">';
            });
          }
        }
      });
    }

    var fileInput = ov.querySelector('#ctmeProfileAvaInput');
    var triggerUpload = function () { fileInput.click(); };
    preview.addEventListener('click', triggerUpload);
    ov.querySelector('#ctmeProfileUploadAva').addEventListener('click', triggerUpload);
    ov.querySelector('#ctmeProfileClearAva').addEventListener('click', function () {
      pendingAvatarUrl = null;
      clearAvatarFlag = true;
      preview.innerHTML = SVG_USER;
    });

    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      fileToDataUrl(f, 480, false).then(function (dataUrl) {
        pendingAvatarUrl = dataUrl;
        clearAvatarFlag = false;
        preview.innerHTML = '<img src="' + dataUrl + '" alt="avatar">';
      }).catch(function () {
        showToast('图片读取失败');
      });
      fileInput.value = '';
    });

    ov.querySelector('#ctmeProfileSave').addEventListener('click', function () {
      var newName = (ov.querySelector('#ctmeProfName').value || '').trim() || '我';
      var newChatId = (ov.querySelector('#ctmeProfChatId').value || '').trim();
      var newSig = (ov.querySelector('#ctmeProfSig').value || '').trim();
      var newMaskId = maskSel ? maskSel.value : (acc.maskId || '');

      var list = getAccounts();
      var idx = list.findIndex(function (a) { return a.id === acc.id; });
      if (idx < 0) return;

      var saveRest = function (avatarDbKey) {
        list[idx] = Object.assign({}, list[idx], {
          maskId: newMaskId,
          name: newName,
          chatId: newChatId,
          signature: newSig,
          avatarDbKey: avatarDbKey
        });
        saveAccounts(list);
        if (list[idx].id === getActiveAccount().id) {
          try {
            window.dispatchEvent(new CustomEvent('phone:chat-account-changed', { detail: list[idx] }));
          } catch (e) {}
        }
        showToast('资料已保存');
        popPage();
      };

      if (pendingAvatarUrl) {
        var key = 'chat_me_avatar_' + acc.id;
        avatarCache[key] = pendingAvatarUrl;
        dbSet(key, pendingAvatarUrl).then(function () { saveRest(key); });
      } else if (clearAvatarFlag && acc.avatarDbKey) {
        delete avatarCache[acc.avatarDbKey];
        dbRemove(acc.avatarDbKey).then(function () { saveRest(''); });
      } else {
        saveRest(acc.avatarDbKey || '');
      }
    });
  }

  /* ---------------- 2. 钱包子页 ---------------- */
  function renderWalletPage(filter) {
    var bal = getWalletBalance();
    var logs = getWalletLogs();
    var filtered = logs.filter(function (item) {
      if (filter === 'in') return item.type === 'in';
      if (filter === 'out') return item.type === 'out';
      return true;
    });

    var billsHtml = filtered.length
      ? filtered.map(function (b) {
          var sign = b.type === 'out' ? '-' : '+';
          return '<div class="ctme-bill-row">' +
            '<div>' +
              '<div class="ctme-bill-title">' + esc(b.title) + '</div>' +
              '<div class="ctme-bill-time">' + esc(formatTime(b.createdAt)) + '</div>' +
            '</div>' +
            '<div class="ctme-bill-val ' + (b.type === 'out' ? 'is-out' : 'is-in') + '">' +
              sign + '¥' + (Number(b.amount) || 0).toFixed(2) +
            '</div>' +
          '</div>';
        }).join('')
      : '<div class="ctme-empty">暂无账单记录</div>';

    var ov = renderSubShell('钱包', '',
      '<div class="ctme-wallet-hero">' +
        '<div>' +
          '<div class="ctme-wallet-label">我的零钱</div>' +
          '<div class="ctme-wallet-amount">¥' + bal.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="ctme-wallet-actions">' +
          '<button type="button" class="ctme-wallet-btn is-white" id="ctmeWalletTopup">充值</button>' +
          '<button type="button" class="ctme-wallet-btn is-ghost" id="ctmeWalletWithdraw">提现</button>' +
        '</div>' +
      '</div>' +
      '<div class="ctme-section-label">账单明细</div>' +
      '<div class="ctme-chip-bar">' +
        '<button type="button" class="ctme-chip ' + (filter === 'all' ? 'is-active' : '') + '" data-wfilter="all">全部</button>' +
        '<button type="button" class="ctme-chip ' + (filter === 'in' ? 'is-active' : '') + '" data-wfilter="in">收入</button>' +
        '<button type="button" class="ctme-chip ' + (filter === 'out' ? 'is-active' : '') + '" data-wfilter="out">支出</button>' +
      '</div>' +
      '<div class="ctme-card">' + billsHtml + '</div>'
    );
    if (!ov) return;

    ov.querySelectorAll('[data-wfilter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pageStack[pageStack.length - 1].filter = btn.getAttribute('data-wfilter');
        renderTopPage();
      });
    });

    ov.querySelector('#ctmeWalletTopup').addEventListener('click', function () {
      openSheet('零钱充值',
        '<div class="ctme-quick-grid">' +
          '<button type="button" class="ctme-quick-amt" data-amt="50">¥50</button>' +
          '<button type="button" class="ctme-quick-amt" data-amt="100">¥100</button>' +
          '<button type="button" class="ctme-quick-amt" data-amt="500">¥500</button>' +
          '<button type="button" class="ctme-quick-amt" data-amt="1000">¥1000</button>' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">充值金额（元）</label>' +
          '<input type="number" step="0.01" min="0.01" class="ctme-input" id="ctmeTopupAmt" placeholder="输入金额">' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">备注（可选）</label>' +
          '<input type="text" class="ctme-input" id="ctmeTopupNote" placeholder="默认：零钱充值">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeTopupConfirm">确认充值</button>',
        function (body) {
          var amtInput = body.querySelector('#ctmeTopupAmt');
          body.querySelectorAll('.ctme-quick-amt').forEach(function (b) {
            b.addEventListener('click', function () {
              amtInput.value = b.getAttribute('data-amt');
            });
          });
          body.querySelector('#ctmeTopupConfirm').addEventListener('click', function () {
            var val = parseFloat(amtInput.value);
            if (!isFinite(val) || val <= 0) {
              showToast('请输入有效金额');
              return;
            }
            var note = (body.querySelector('#ctmeTopupNote').value || '').trim() || '零钱充值';
            setWalletBalance(getWalletBalance() + val);
            addWalletLog('in', val, note);
            closeSheet();
            showToast('已充值 ¥' + val.toFixed(2));
            renderTopPage();
          });
        }
      );
    });

    ov.querySelector('#ctmeWalletWithdraw').addEventListener('click', function () {
      openSheet('零钱提现',
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">提现金额（当前可用 ¥' + getWalletBalance().toFixed(2) + '）</label>' +
          '<input type="number" step="0.01" min="0.01" class="ctme-input" id="ctmeWdAmt" placeholder="输入提现金额">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeWdConfirm">确认提现</button>',
        function (body) {
          body.querySelector('#ctmeWdConfirm').addEventListener('click', function () {
            var val = parseFloat(body.querySelector('#ctmeWdAmt').value);
            var curBal = getWalletBalance();
            if (!isFinite(val) || val <= 0) {
              showToast('请输入有效金额');
              return;
            }
            if (val > curBal) {
              showToast('零钱余额不足');
              return;
            }
            setWalletBalance(curBal - val);
            addWalletLog('out', val, '零钱提现');
            closeSheet();
            showToast('已提现 ¥' + val.toFixed(2));
            renderTopPage();
          });
        }
      );
    });
  }

  /* ---------------- 3. 收藏子页 ---------------- */
  function renderFavoritesPage(query) {
    var list = getFavorites();
    var q = (query || '').trim().toLowerCase();
    var filtered = list.filter(function (it) {
      if (!q) return true;
      return (it.title || '').toLowerCase().indexOf(q) !== -1 ||
        (it.content || '').toLowerCase().indexOf(q) !== -1 ||
        (it.tag || '').toLowerCase().indexOf(q) !== -1;
    });

    var cardsHtml = filtered.length
      ? filtered.map(function (it) {
          return '<div class="ctme-fav-card" data-fav-id="' + esc(it.id) + '">' +
            (it.title ? '<div class="ctme-fav-title">' + esc(it.title) + '</div>' : '') +
            '<div class="ctme-fav-body">' + esc(it.content) + '</div>' +
            '<div class="ctme-fav-foot">' +
              '<span>' + esc(it.source || it.tag || '笔记') + '</span>' +
              '<span>' + esc(formatTime(it.createdAt)) + '</span>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<div class="ctme-card"><div class="ctme-empty">' + (q ? '没有匹配的收藏内容' : '暂无收藏内容，点右上角可新建笔记') + '</div></div>';

    var ov = renderSubShell('收藏',
      '<button type="button" class="ctme-pill-btn is-primary" id="ctmeFavAdd">新建</button>',
      '<div class="ctme-search-box">' +
        SVG_SEARCH +
        '<input type="search" class="ctme-search-input" id="ctmeFavSearch" value="' + esc(query) + '" placeholder="搜索收藏内容或标签">' +
      '</div>' +
      cardsHtml
    );
    if (!ov) return;

    var searchInput = ov.querySelector('#ctmeFavSearch');
    searchInput.addEventListener('input', function () {
      pageStack[pageStack.length - 1].query = searchInput.value;
      var cursorPos = searchInput.selectionStart;
      renderTopPage();
      var nextInput = overlayEl && overlayEl.querySelector('#ctmeFavSearch');
      if (nextInput) {
        nextInput.focus();
        try { nextInput.setSelectionRange(cursorPos, cursorPos); } catch (e) {}
      }
    });

    ov.querySelector('#ctmeFavAdd').addEventListener('click', function () {
      openSheet('新建收藏笔记',
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">标题（可选）</label>' +
          '<input type="text" class="ctme-input" id="ctmeFavNewTitle" placeholder="给这条收藏起个标题">' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">内容</label>' +
          '<textarea class="ctme-textarea" id="ctmeFavNewBody" placeholder="写下你想保存的句子、灵感或摘录"></textarea>' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">标签（可选）</label>' +
          '<input type="text" class="ctme-input" id="ctmeFavNewTag" placeholder="例如：语录 / 备忘">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeFavNewSave">保存到收藏</button>',
        function (body) {
          body.querySelector('#ctmeFavNewSave').addEventListener('click', function () {
            var content = (body.querySelector('#ctmeFavNewBody').value || '').trim();
            if (!content) {
              showToast('请输入收藏内容');
              return;
            }
            var cur = getFavorites();
            cur.unshift({
              id: genId('fav'),
              title: (body.querySelector('#ctmeFavNewTitle').value || '').trim(),
              content: content,
              tag: (body.querySelector('#ctmeFavNewTag').value || '').trim() || '笔记',
              source: getActiveAccount().name,
              createdAt: Date.now()
            });
            saveFavorites(cur);
            closeSheet();
            showToast('已添加到收藏');
            renderTopPage();
          });
        }
      );
    });

    ov.querySelectorAll('.ctme-fav-card[data-fav-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-fav-id');
        var item = getFavorites().find(function (x) { return x.id === id; });
        if (!item) return;
        openSheet(item.title || '收藏详情',
          '<div style="font-size:var(--app-font-size,15px);color:#111;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:#f7f7fa;padding:14px;border-radius:14px;">' + esc(item.content) + '</div>' +
          '<div style="font-size:calc(var(--app-font-size,15px) - 3px);color:#8e8e93;">来源：' + esc(item.source || '笔记') + ' · ' + esc(formatTime(item.createdAt)) + '</div>' +
          '<button type="button" class="ctme-action-btn" id="ctmeFavCopy">复制全文</button>' +
          '<button type="button" class="ctme-action-btn is-danger" id="ctmeFavDel">删除此收藏</button>',
          function (body) {
            body.querySelector('#ctmeFavCopy').addEventListener('click', function () {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(item.content).then(function () {
                  showToast('已复制到剪贴板');
                }).catch(function () { showToast('复制失败'); });
              } else {
                showToast('当前环境不支持自动复制');
              }
              closeSheet();
            });
            body.querySelector('#ctmeFavDel').addEventListener('click', function () {
              var next = getFavorites().filter(function (x) { return x.id !== id; });
              saveFavorites(next);
              closeSheet();
              showToast('已删除');
              renderTopPage();
            });
          }
        );
      });
    });
  }

  /* ---------------- 4. 表情包管理（图片 / JSON / Word .docx 导入） ---------------- */
  function loadStickerImage(dbKey, imgEl) {
    if (!dbKey || !imgEl) return;
    if (stickerImgCache[dbKey]) {
      imgEl.src = stickerImgCache[dbKey];
      return;
    }
    dbGet(dbKey).then(function (url) {
      if (url) {
        stickerImgCache[dbKey] = url;
        imgEl.src = url;
      }
    });
  }

  function renderStickersPage() {
    var packs = getStickerPacks();
    var totalCount = packs.reduce(function (sum, p) { return sum + (Array.isArray(p.items) ? p.items.length : 0); }, 0);

    var listHtml = packs.length
      ? '<div class="ctme-card">' + packs.map(function (p) {
          var items = Array.isArray(p.items) ? p.items : [];
          var firstKey = items[0] && items[0].dbKey ? items[0].dbKey : '';
          return '<div class="ctme-pack-row" data-pack-id="' + esc(p.id) + '">' +
            '<div class="ctme-pack-thumb">' +
              (firstKey
                ? '<img data-sticker-key="' + esc(firstKey) + '" alt="">'
                : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2"/><circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>') +
            '</div>' +
            '<div class="ctme-pack-info">' +
              '<div class="ctme-pack-name">' + esc(p.name) + '</div>' +
              '<div class="ctme-pack-count">共 ' + items.length + ' 张表情</div>' +
            '</div>' +
            '<span class="ctme-row-arrow">' + SVG_ARROW + '</span>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="ctme-card"><div class="ctme-empty">还没有表情包<br>点击右上角「导入」批量上传图片、JSON 或 Word 文档</div></div>';

    var ov = renderSubShell('表情包',
      '<button type="button" class="ctme-pill-btn is-primary" id="ctmeStickerImportBtn">导入</button>',
      '<div class="ctme-section-label">已安装分组（' + packs.length + ' 组 · 共 ' + totalCount + ' 张）</div>' +
      listHtml +
      '<input type="file" id="ctmeStickerBatchFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none;">' +
      '<input type="file" id="ctmeStickerJsonFile" accept=".json,application/json" style="display:none;">' +
      '<input type="file" id="ctmeStickerDocxFile" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none;">'
    );
    if (!ov) return;

    ov.querySelectorAll('img[data-sticker-key]').forEach(function (img) {
      loadStickerImage(img.getAttribute('data-sticker-key'), img);
    });

    ov.querySelectorAll('.ctme-pack-row[data-pack-id]').forEach(function (row) {
      row.addEventListener('click', function () {
        pushPage({ id: 'sticker-pack', packId: row.getAttribute('data-pack-id') });
      });
    });

    var batchInput = ov.querySelector('#ctmeStickerBatchFile');
    var jsonInput = ov.querySelector('#ctmeStickerJsonFile');
    var docxInput = ov.querySelector('#ctmeStickerDocxFile');
    var targetPackForImport = null;

    batchInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(batchInput.files || []);
      batchInput.value = '';
      if (!files.length) return;
      importImageFilesToPack(files, targetPackForImport);
    });

    jsonInput.addEventListener('change', function () {
      var f = jsonInput.files && jsonInput.files[0];
      jsonInput.value = '';
      if (!f) return;
      importStickerJsonFile(f);
    });

    docxInput.addEventListener('change', function () {
      var f = docxInput.files && docxInput.files[0];
      docxInput.value = '';
      if (!f) return;
      importStickerDocxFile(f, targetPackForImport);
    });

    ov.querySelector('#ctmeStickerImportBtn').addEventListener('click', function () {
      var curPacks = getStickerPacks();
      var packOptions = curPacks.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + '（' + (p.items ? p.items.length : 0) + ' 张）</option>';
      }).join('');

      openSheet('导入表情包',
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">导入到分组</label>' +
          '<select class="ctme-select" id="ctmeImportTargetPack">' +
            '<option value="__new__">+ 新建分组</option>' +
            packOptions +
          '</select>' +
        '</div>' +
        '<div class="ctme-field" id="ctmeNewPackNameWrap">' +
          '<label class="ctme-field-label">新分组名称</label>' +
          '<input type="text" class="ctme-input" id="ctmeNewPackNameInput" placeholder="例如：猫猫日常（留空默认「我的表情包」）">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeDoBatchImg">批量选择图片导入（PNG / JPG / GIF / WebP）</button>' +
        '<button type="button" class="ctme-action-btn" id="ctmeDoImportDocx">导入 Word 文档 (.docx)</button>' +
        '<button type="button" class="ctme-action-btn" id="ctmeDoImportJson">导入表情包 JSON 文件</button>' +
        '<button type="button" class="ctme-action-btn" id="ctmeDoCreateEmptyPack">仅新建空白分组</button>',
        function (body) {
          var sel = body.querySelector('#ctmeImportTargetPack');
          var newWrap = body.querySelector('#ctmeNewPackNameWrap');
          var newInp = body.querySelector('#ctmeNewPackNameInput');

          if (curPacks.length) {
            sel.value = curPacks[0].id;
            newWrap.style.display = 'none';
          }
          sel.addEventListener('change', function () {
            newWrap.style.display = sel.value === '__new__' ? '' : 'none';
          });

          function readTarget(defaultName) {
            if (sel.value === '__new__') {
              return { createNew: true, name: (newInp.value || '').trim() || defaultName || '' };
            }
            return { createNew: false, packId: sel.value };
          }

          body.querySelector('#ctmeDoBatchImg').addEventListener('click', function () {
            targetPackForImport = readTarget('我的表情包');
            closeSheet();
            batchInput.click();
          });

          body.querySelector('#ctmeDoImportDocx').addEventListener('click', function () {
            targetPackForImport = readTarget('');
            closeSheet();
            docxInput.click();
          });

          body.querySelector('#ctmeDoImportJson').addEventListener('click', function () {
            closeSheet();
            jsonInput.click();
          });

          body.querySelector('#ctmeDoCreateEmptyPack').addEventListener('click', function () {
            var name = (newInp.value || '').trim();
            if (!name) {
              sel.value = '__new__';
              newWrap.style.display = '';
              newInp.focus();
              showToast('请先输入分组名称');
              return;
            }
            var all = getStickerPacks();
            all.unshift({ id: genId('pack'), name: name, createdAt: Date.now(), items: [] });
            saveStickerPacks(all);
            closeSheet();
            showToast('已创建分组「' + name + '」');
            renderTopPage();
          });
        }
      );
    });
  }

  function importImageFilesToPack(files, target) {
    showToast('正在导入 ' + files.length + ' 张表情...');
    var packs = getStickerPacks();
    var pack = null;

    if (target && !target.createNew && target.packId) {
      pack = packs.find(function (p) { return p.id === target.packId; });
    }
    if (!pack) {
      pack = {
        id: genId('pack'),
        name: (target && target.name) || '我的表情包',
        createdAt: Date.now(),
        items: []
      };
      packs.unshift(pack);
    }
    if (!Array.isArray(pack.items)) pack.items = [];

    var tasks = files.map(function (file) {
      return fileToDataUrl(file, 420, true).then(function (dataUrl) {
        var sid = genId('stk');
        var dbKey = 'chat_sticker_img_' + sid;
        var baseName = (file.name || '表情').replace(/\.[^.]+$/, '').trim() || '表情';
        stickerImgCache[dbKey] = dataUrl;
        return dbSet(dbKey, dataUrl).then(function () {
          pack.items.push({
            id: sid,
            name: baseName,
            tag: baseName,
            dbKey: dbKey,
            createdAt: Date.now()
          });
        });
      }).catch(function () {});
    });

    Promise.all(tasks).then(function () {
      saveStickerPacks(packs);
      showToast('已导入 ' + files.length + ' 张表情到「' + pack.name + '」');
      renderTopPage();
    });
  }

  function importStickerDocxFile(file, target) {
    showToast('正在解析 Word 文档...');
    var docTitle = (file.name || 'Word表情包').replace(/\.docx$/i, '').trim() || 'Word表情包';
    var reader = new FileReader();
    reader.onerror = function () { showToast('Word 文件读取失败'); };
    reader.onload = function () {
      unzipDocxEntries(reader.result).then(function (entries) {
        var dec = new TextDecoder('utf-8');
        var relsMap = {};
        if (entries['word/_rels/document.xml.rels']) {
          var relsXml = new DOMParser().parseFromString(dec.decode(entries['word/_rels/document.xml.rels']), 'application/xml');
          relsXml.querySelectorAll('Relationship').forEach(function (rel) {
            var id = rel.getAttribute('Id');
            var tgt = rel.getAttribute('Target') || '';
            if (id && tgt) {
              var fullPath = tgt.startsWith('/') ? tgt.slice(1) : ('word/' + tgt.replace(/^\.\//, ''));
              relsMap[id] = { path: fullPath, target: tgt };
            }
          });
        }

        var collected = []; // { name, dataUrl, mediaPath }
        var seenMedia = {};

        if (entries['word/document.xml']) {
          var docXml = new DOMParser().parseFromString(dec.decode(entries['word/document.xml']), 'application/xml');
          var paragraphs = Array.prototype.slice.call(docXml.getElementsByTagNameNS('*', 'p'));

          function getParaText(pEl) {
            var texts = [];
            var ts = pEl.getElementsByTagNameNS('*', 't');
            for (var i = 0; i < ts.length; i++) texts.push(ts[i].textContent || '');
            return texts.join('').trim();
          }

          function getParaRids(pEl) {
            var rids = [];
            var blips = pEl.getElementsByTagNameNS('*', 'blip');
            for (var i = 0; i < blips.length; i++) {
              var emb = blips[i].getAttribute('r:embed') || blips[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
              if (emb) rids.push(emb);
            }
            var imgDatas = pEl.getElementsByTagNameNS('*', 'imagedata');
            for (var j = 0; j < imgDatas.length; j++) {
              var rid = imgDatas[j].getAttribute('r:id') || imgDatas[j].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
              if (rid) rids.push(rid);
            }
            return rids;
          }

          for (var pi = 0; pi < paragraphs.length; pi++) {
            var p = paragraphs[pi];
            var pText = getParaText(p);
            var rids = getParaRids(p);

            if (rids.length) {
              var nextText = (!pText && paragraphs[pi + 1] && !getParaRids(paragraphs[pi + 1]).length)
                ? getParaText(paragraphs[pi + 1])
                : '';
              var label = pText || (nextText && nextText.length <= 24 ? nextText : '');
              rids.forEach(function (rid) {
                var relInfo = relsMap[rid];
                if (relInfo && entries[relInfo.path] && !seenMedia[relInfo.path]) {
                  seenMedia[relInfo.path] = true;
                  collected.push({ name: label, bytes: entries[relInfo.path], path: relInfo.path });
                }
              });
            }

            // 兼容文本里的图片链接（如「表情名：https://...」）
            if (pText && /https?:\/\/\S+/i.test(pText)) {
              var mUrl = pText.match(/(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?)/i);
              if (mUrl) {
                var urlStr = mUrl[1];
                var urlLabel = pText.replace(urlStr, '').replace(/[:：\-\s]+$/g, '').replace(/^[:：\-\s]+/g, '').trim();
                collected.push({ name: urlLabel || '表情', dataUrl: urlStr });
              }
            }
          }
        }

        // 兜底：补充 word/media/ 下未被正文引用的图片
        Object.keys(entries).forEach(function (k) {
          if (/^word\/media\/.+\.(png|jpe?g|gif|webp)$/i.test(k) && !seenMedia[k]) {
            seenMedia[k] = true;
            var fn = k.split('/').pop().replace(/\.[^.]+$/, '');
            collected.push({ name: fn, bytes: entries[k], path: k });
          }
        });

        if (!collected.length) {
          showToast('Word 中未找到图片或表情链接');
          return;
        }

        var packs = getStickerPacks();
        var pack = null;
        if (target && !target.createNew && target.packId) {
          pack = packs.find(function (p) { return p.id === target.packId; });
        }
        if (!pack) {
          pack = {
            id: genId('pack'),
            name: (target && target.name) || docTitle,
            createdAt: Date.now(),
            items: []
          };
          packs.unshift(pack);
        }
        if (!Array.isArray(pack.items)) pack.items = [];

        var saveTasks = collected.map(function (item, idx) {
          var prep = item.dataUrl
            ? Promise.resolve(item.dataUrl)
            : bytesToDataUrl(item.bytes, guessImageMime(item.path));
          return prep.then(function (src) {
            if (!src) return;
            var sid = genId('stk');
            var dbKey = 'chat_sticker_img_' + sid;
            var nm = (item.name || ('表情' + (idx + 1))).slice(0, 24);
            stickerImgCache[dbKey] = src;
            return dbSet(dbKey, src).then(function () {
              pack.items.push({
                id: sid,
                name: nm,
                tag: nm,
                dbKey: dbKey,
                createdAt: Date.now()
              });
            });
          });
        });

        Promise.all(saveTasks).then(function () {
          saveStickerPacks(packs);
          showToast('已从 Word 导入 ' + collected.length + ' 张表情到「' + pack.name + '」');
          renderTopPage();
        });
      }).catch(function () {
        showToast('仅支持标准 .docx 格式的 Word 文档');
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function importStickerJsonFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incomingPacks = Array.isArray(data) ? data : [data];
        var existing = getStickerPacks();
        var tasks = [];
        var importedCount = 0;

        incomingPacks.forEach(function (rawPack) {
          if (!rawPack || typeof rawPack !== 'object') return;
          var rawItems = Array.isArray(rawPack.items) ? rawPack.items
            : (Array.isArray(rawPack.stickers) ? rawPack.stickers : []);
          var newPack = {
            id: genId('pack'),
            name: String(rawPack.name || rawPack.title || '导入的表情包'),
            createdAt: Date.now(),
            items: []
          };
          rawItems.forEach(function (it) {
            if (!it) return;
            var src = it.dataUrl || it.url || it.src || '';
            if (!src) return;
            var sid = genId('stk');
            var dbKey = 'chat_sticker_img_' + sid;
            var nm = String(it.name || it.tag || '表情');
            stickerImgCache[dbKey] = src;
            importedCount += 1;
            tasks.push(dbSet(dbKey, src).then(function () {
              newPack.items.push({
                id: sid,
                name: nm,
                tag: String(it.tag || nm),
                dbKey: dbKey,
                createdAt: Date.now()
              });
            }));
          });
          existing.unshift(newPack);
        });

        Promise.all(tasks).then(function () {
          saveStickerPacks(existing);
          showToast('JSON 导入完成，共 ' + importedCount + ' 张表情');
          renderTopPage();
        });
      } catch (e) {
        showToast('JSON 格式无法解析');
      }
    };
    reader.readAsText(file);
  }

  function renderStickerPackDetail(packId) {
    var packs = getStickerPacks();
    var pack = packs.find(function (p) { return p.id === packId; });
    if (!pack) {
      popPage();
      return;
    }
    var items = Array.isArray(pack.items) ? pack.items : [];

    var gridHtml = items.length
      ? '<div class="ctme-card"><div class="ctme-sticker-grid">' + items.map(function (st) {
          return '<div class="ctme-sticker-cell" data-stk-id="' + esc(st.id) + '">' +
            '<div class="ctme-sticker-img-wrap">' +
              '<img data-sticker-key="' + esc(st.dbKey) + '" alt="' + esc(st.name) + '">' +
            '</div>' +
            '<div class="ctme-sticker-label">' + esc(st.name || '表情') + '</div>' +
          '</div>';
        }).join('') + '</div></div>'
      : '<div class="ctme-card"><div class="ctme-empty">这个分组里还没有表情，点右上角「导入」添加图片</div></div>';

    var ov = renderSubShell(pack.name,
      '<button type="button" class="ctme-pill-btn is-primary" id="ctmePackImportHere">导入</button>',
      '<div class="ctme-pack-toolbar">' +
        '<button type="button" class="ctme-mini-pill" id="ctmePackRename">重命名分组</button>' +
        '<button type="button" class="ctme-mini-pill" id="ctmePackExport">导出 JSON</button>' +
        '<button type="button" class="ctme-mini-pill is-danger" id="ctmePackDelete">删除分组</button>' +
      '</div>' +
      gridHtml +
      '<input type="file" id="ctmePackDirectFile" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none;">'
    );
    if (!ov) return;

    ov.querySelectorAll('img[data-sticker-key]').forEach(function (img) {
      loadStickerImage(img.getAttribute('data-sticker-key'), img);
    });

    var directFile = ov.querySelector('#ctmePackDirectFile');
    ov.querySelector('#ctmePackImportHere').addEventListener('click', function () {
      directFile.click();
    });
    directFile.addEventListener('change', function () {
      var files = Array.prototype.slice.call(directFile.files || []);
      directFile.value = '';
      if (files.length) importImageFilesToPack(files, { createNew: false, packId: pack.id });
    });

    ov.querySelector('#ctmePackRename').addEventListener('click', function () {
      openSheet('重命名分组',
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">分组名称</label>' +
          '<input type="text" class="ctme-input" id="ctmeRenameVal" value="' + esc(pack.name) + '">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeRenameOk">保存</button>',
        function (body) {
          body.querySelector('#ctmeRenameOk').addEventListener('click', function () {
            var n = (body.querySelector('#ctmeRenameVal').value || '').trim();
            if (!n) return;
            var all = getStickerPacks();
            var target = all.find(function (p) { return p.id === pack.id; });
            if (target) target.name = n;
            saveStickerPacks(all);
            closeSheet();
            renderTopPage();
          });
        }
      );
    });

    ov.querySelector('#ctmePackExport').addEventListener('click', function () {
      showToast('正在打包导出...');
      var promises = items.map(function (st) {
        return dbGet(st.dbKey).then(function (url) {
          return { name: st.name, tag: st.tag || st.name, dataUrl: url || '' };
        });
      });
      Promise.all(promises).then(function (exportedItems) {
        var payload = { name: pack.name, exportedAt: Date.now(), items: exportedItems };
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (pack.name || 'stickers') + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1200);
        showToast('已导出 JSON');
      });
    });

    ov.querySelector('#ctmePackDelete').addEventListener('click', function () {
      openConfirm('删除表情包分组', '将删除「' + pack.name + '」及其中的 ' + items.length + ' 张表情，操作不可恢复。', '确认删除', function () {
        items.forEach(function (st) {
          delete stickerImgCache[st.dbKey];
          dbRemove(st.dbKey);
        });
        var next = getStickerPacks().filter(function (p) { return p.id !== pack.id; });
        saveStickerPacks(next);
        showToast('已删除分组');
        popPage();
      });
    });

    ov.querySelectorAll('.ctme-sticker-cell[data-stk-id]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var sid = cell.getAttribute('data-stk-id');
        var st = items.find(function (x) { return x.id === sid; });
        if (!st) return;
        openSheet('编辑表情',
          '<div class="ctme-sticker-preview-box"><img id="ctmeStkEditImg" alt=""></div>' +
          '<div class="ctme-field">' +
            '<label class="ctme-field-label">表情名称 / 含义标注（供角色读取与联想搜图）</label>' +
            '<input type="text" class="ctme-input" id="ctmeStkNameInp" value="' + esc(st.name || '') + '" placeholder="例如：无语 / 贴贴 / 晚安">' +
          '</div>' +
          '<button type="button" class="ctme-action-btn is-primary" id="ctmeStkSave">保存标注</button>' +
          '<button type="button" class="ctme-action-btn is-danger" id="ctmeStkDel">删除这张表情</button>',
          function (body) {
            loadStickerImage(st.dbKey, body.querySelector('#ctmeStkEditImg'));
            body.querySelector('#ctmeStkSave').addEventListener('click', function () {
              var v = (body.querySelector('#ctmeStkNameInp').value || '').trim() || '表情';
              var all = getStickerPacks();
              var p = all.find(function (x) { return x.id === pack.id; });
              var target = p && p.items.find(function (x) { return x.id === sid; });
              if (target) {
                target.name = v;
                target.tag = v;
                saveStickerPacks(all);
              }
              closeSheet();
              showToast('已更新标注');
              renderTopPage();
            });
            body.querySelector('#ctmeStkDel').addEventListener('click', function () {
              var all = getStickerPacks();
              var p = all.find(function (x) { return x.id === pack.id; });
              if (p) {
                p.items = p.items.filter(function (x) { return x.id !== sid; });
                saveStickerPacks(all);
              }
              delete stickerImgCache[st.dbKey];
              dbRemove(st.dbKey);
              closeSheet();
              showToast('已删除表情');
              renderTopPage();
            });
          }
        );
      });
    });
  }

  /* ---------------- 5. 朋友圈我的相册子页 ---------------- */
  function renderMomentsAlbumPage() {
    var acc = getActiveAccount();
    var coverKey = 'chat_me_moments_cover_' + acc.id;

    var allMoments = readJSON('chat_moments_v1', []);
    if (!Array.isArray(allMoments)) allMoments = [];
    var myMoments = allMoments.filter(function (m) {
      return m && (m.isSelf || m.author === '我' || m.author === acc.name || m.accountId === acc.id);
    });

    var postsHtml = myMoments.length
      ? '<div class="ctme-card">' + myMoments.map(function (m) {
          return '<div class="ctme-moment-row">' +
            '<div class="ctme-moment-text">' + esc(m.text || m.content || '') + '</div>' +
            '<div class="ctme-moment-time">' + esc(m.time || formatTime(m.createdAt)) + '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="ctme-card"><div class="ctme-empty">当前账号还没有发布过朋友圈动态</div></div>';

    var ov = renderSubShell('我的朋友圈',
      '<button type="button" class="ctme-pill-btn" id="ctmeJumpMoments">全部动态</button>',
      '<div class="ctme-album-cover" id="ctmeAlbumCover">' +
        '<img id="ctmeAlbumCoverImg" style="display:none;" alt="">' +
        '<div class="ctme-album-cover-mask">' +
          '<div class="ctme-album-user">' +
            '<div class="ctme-album-ava" id="ctmeAlbumAva">' + esc((acc.name || '我').slice(0, 1)) + '</div>' +
            '<div>' +
              '<div style="font-weight:700;font-size:calc(var(--app-font-size,15px) + 2px);">' + esc(acc.name) + '</div>' +
              (acc.signature ? '<div style="font-size:calc(var(--app-font-size,15px) - 3px);opacity:0.85;">' + esc(acc.signature) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<span class="ctme-album-hint">点击换封面</span>' +
        '</div>' +
      '</div>' +
      '<input type="file" id="ctmeCoverFile" accept="image/*" style="display:none;">' +
      '<div class="ctme-section-label">我的动态（' + myMoments.length + '）</div>' +
      postsHtml
    );
    if (!ov) return;

    loadAccountAvatarInto(acc, ov.querySelector('#ctmeAlbumAva'));

    var coverImg = ov.querySelector('#ctmeAlbumCoverImg');
    var applyCover = function (url) {
      if (!url) return;
      coverImg.src = url;
      coverImg.style.display = 'block';
    };
    if (coverCache[coverKey]) {
      applyCover(coverCache[coverKey]);
    } else {
      dbGet(coverKey).then(function (url) {
        if (url) {
          coverCache[coverKey] = url;
          applyCover(url);
        }
      });
    }

    var coverFile = ov.querySelector('#ctmeCoverFile');
    ov.querySelector('#ctmeAlbumCover').addEventListener('click', function () {
      coverFile.click();
    });
    coverFile.addEventListener('change', function () {
      var f = coverFile.files && coverFile.files[0];
      coverFile.value = '';
      if (!f) return;
      fileToDataUrl(f, 960, false).then(function (url) {
        coverCache[coverKey] = url;
        dbSet(coverKey, url);
        applyCover(url);
        showToast('已更新相册封面');
      });
    });

    ov.querySelector('#ctmeJumpMoments').addEventListener('click', function () {
      closeAllPages();
      var mTab = document.querySelector('#app-chat .ct-tab-btn[data-tab="moments"]');
      if (mTab) mTab.click();
    });
  }

  /* ---------------- 6. 设置子页 ---------------- */
  function renderSettingsPage() {
    var acc = getActiveAccount();
    var allAccs = getAccounts();
    var chars = getCharsSafe();
    var prefs = getPrefs();

    var threadSettings = readJSON('chat_thread_settings_v1', {});
    var blockedCount = Object.keys(threadSettings || {}).filter(function (tid) {
      return threadSettings[tid] && threadSettings[tid].blocked;
    }).length;

    var accRoleHint = acc.type === 'char'
      ? 'Char 视角'
      : (acc.type === 'alt' ? '小号' : '主号');

    var ov = renderSubShell('设置', '',
      '<div class="ctme-section-label">账号与身份</div>' +
      '<div class="ctme-card">' +
        '<div class="ctme-item" id="ctmeSetSwitchAcc">' +
          '<div>' +
            '<div class="ctme-item-label">切换账号</div>' +
            '<div class="ctme-item-desc">当前：' + esc(acc.name) + '（' + accRoleHint + ' · ' + allAccs.length + ' 个自建 / ' + chars.length + ' 个角色）</div>' +
          '</div>' +
          '<div class="ctme-item-right"><span>管理</span>' + SVG_ARROW + '</div>' +
        '</div>' +
        '<div class="ctme-item" data-pref-toggle="allowCharChangePasscode">' +
          '<div>' +
            '<div class="ctme-item-label">允许 Char 自主修改密码</div>' +
            '<div class="ctme-item-desc">开启后，Char 可在对话中自己改掉微信密码并重新上锁</div>' +
          '</div>' +
          '<button type="button" class="ctme-switch ' + (prefs.allowCharChangePasscode ? 'is-on' : '') + '"></button>' +
        '</div>' +
      '</div>' +

      '<div class="ctme-section-label">消息与隐私</div>' +
      '<div class="ctme-card">' +
        '<div class="ctme-item" id="ctmeSetBlocklist">' +
          '<div class="ctme-item-label">黑名单管理</div>' +
          '<div class="ctme-item-right"><span>' + (blockedCount ? blockedCount + ' 人' : '无') + '</span>' + SVG_ARROW + '</div>' +
        '</div>' +
        '<div class="ctme-item" data-pref-toggle="enterToSend">' +
          '<div>' +
            '<div class="ctme-item-label">回车键直接发送</div>' +
            '<div class="ctme-item-desc">关闭时回车键用于换行</div>' +
          '</div>' +
          '<button type="button" class="ctme-switch ' + (prefs.enterToSend ? 'is-on' : '') + '"></button>' +
        '</div>' +
        '<div class="ctme-item" data-pref-toggle="notifySound">' +
          '<div class="ctme-item-label">新消息提示音</div>' +
          '<button type="button" class="ctme-switch ' + (prefs.notifySound ? 'is-on' : '') + '"></button>' +
        '</div>' +
        '<div class="ctme-item" data-pref-toggle="showWalletBalance">' +
          '<div class="ctme-item-label">「我的」页面显示零钱余额</div>' +
          '<button type="button" class="ctme-switch ' + (prefs.showWalletBalance ? 'is-on' : '') + '"></button>' +
        '</div>' +
      '</div>' +

      '<div class="ctme-section-label">数据与备份</div>' +
      '<div class="ctme-card">' +
        '<div class="ctme-item" id="ctmeSetExportBackup">' +
          '<div class="ctme-item-label">导出「我的」数据备份 (JSON)</div>' +
          '<div class="ctme-item-right">' + SVG_ARROW + '</div>' +
        '</div>' +
        '<div class="ctme-item" id="ctmeSetClearBills">' +
          '<div class="ctme-item-label" style="color:#ff3b30;">清空当前账号账单记录</div>' +
          '<div class="ctme-item-right">' + SVG_ARROW + '</div>' +
        '</div>' +
      '</div>'
    );
    if (!ov) return;

    ov.querySelector('#ctmeSetSwitchAcc').addEventListener('click', function () {
      pushPage({ id: 'accounts' });
    });
    ov.querySelector('#ctmeSetBlocklist').addEventListener('click', function () {
      pushPage({ id: 'blocklist' });
    });

    ov.querySelectorAll('[data-pref-toggle]').forEach(function (row) {
      row.addEventListener('click', function () {
        var key = row.getAttribute('data-pref-toggle');
        var next = getPrefs();
        next[key] = !next[key];
        savePrefs(next);
        renderTopPage();
      });
    });

    ov.querySelector('#ctmeSetExportBackup').addEventListener('click', function () {
      var payload = {
        exportedAt: Date.now(),
        activeAccountId: getActiveAccount().id,
        accounts: getAccounts(),
        walletBalance: getWalletBalance(),
        walletLogs: getWalletLogs(),
        favorites: getFavorites(),
        prefs: getPrefs()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chat-me-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1200);
      showToast('已导出备份文件');
    });

    ov.querySelector('#ctmeSetClearBills').addEventListener('click', function () {
      openConfirm('清空账单记录', '仅清空当前账号的历史账单流水，不会影响零钱余额。', '确认清空', function () {
        writeJSON(scopedKey(KEY_WALLET_LOGS), []);
        showToast('已清空账单记录');
      });
    });
  }

  /* ---------------- 切换账号子页 ---------------- */
  function openCharPasswordSheet(ch) {
    getCharPasscode(ch.id, ch.name);
    var lastMode = getCharLoginMode(ch.id);

    openSheet('登录「' + (ch.name || 'Char') + '」的账号',
      '<div class="ctme-hint-box">' +
        '登录 TA 的账号需要输入专属密码，密码只有 TA 自己知道——去聊天里问问 TA 吧。' +
      '</div>' +
      '<div class="ctme-field">' +
        '<label class="ctme-field-label">登录方式</label>' +
        '<select class="ctme-select" id="ctmeCharLoginMode">' +
          '<option value="stealth" ' + (lastMode === 'stealth' ? 'selected' : '') + '>悄悄偷看（隐身登录，不留通知痕迹）</option>' +
          '<option value="normal" ' + (lastMode === 'normal' ? 'selected' : '') + '>正常登录（会给 TA 发登录提醒，可能会顶号）</option>' +
        '</select>' +
      '</div>' +
      '<div class="ctme-field">' +
        '<label class="ctme-field-label">账号密码</label>' +
        '<div class="ctme-pwd-wrap">' +
          '<input type="password" class="ctme-input" id="ctmeCharPwdInput" placeholder="输入从 TA 那里问到的密码" autocomplete="off">' +
          '<button type="button" class="ctme-pwd-eye" id="ctmeCharPwdEye" aria-label="显示密码">' + SVG_EYE + '</button>' +
        '</div>' +
        '<div class="ctme-pwd-err" id="ctmeCharPwdErr"></div>' +
      '</div>' +
      '<button type="button" class="ctme-action-btn is-primary" id="ctmeCharPwdSubmit">验证并登录</button>',
      function (body) {
        var inp = body.querySelector('#ctmeCharPwdInput');
        var modeSel = body.querySelector('#ctmeCharLoginMode');
        var eye = body.querySelector('#ctmeCharPwdEye');
        var errEl = body.querySelector('#ctmeCharPwdErr');
        var submit = body.querySelector('#ctmeCharPwdSubmit');

        eye.addEventListener('click', function () {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        var doVerify = function () {
          var val = (inp.value || '').trim();
          if (!val) {
            errEl.textContent = '请先输入密码';
            return;
          }
          var mode = modeSel ? modeSel.value : 'stealth';
          if (verifyCharPasscode(ch.id, ch.name, val, mode)) {
            var charAcc = getOrCreateCharAccount(ch);
            setActiveAccount(charAcc.id);
            closeSheet();
            showToast(mode === 'normal'
              ? '已登录「' + (ch.name || 'Char') + '」账号（已留痕）'
              : '已悄悄切入「' + (ch.name || 'Char') + '」视角');
            renderTopPage();
          } else {
            errEl.textContent = '密码不对，再去聊天里套套话吧';
            inp.select();
          }
        };

        submit.addEventListener('click', doVerify);
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doVerify();
        });
        setTimeout(function () { inp.focus(); }, 180);
      }
    );
  }

  function openCharForceResetSheet(ch) {
    if (!isCharResetAllowed(ch.id)) {
      openSheet('强制改密码',
        '<div class="ctme-hint-box">' +
          '「' + esc(ch.name || '对方') + '」还没有允许你修改 TA 的账号密码。<br>去聊天里和 TA 商量，让 TA 在对话中给你授权后才能强制改密。' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeForceDeniedOk">知道了</button>',
        function (body) {
          body.querySelector('#ctmeForceDeniedOk').addEventListener('click', closeSheet);
        }
      );
      return;
    }

    openSheet('强制修改「' + (ch.name || 'Char') + '」密码',
      '<div class="ctme-hint-box">' +
        '已获得「' + esc(ch.name || 'TA') + '」的改密授权，你可以为 TA 设置一个新密码并直接解锁。' +
      '</div>' +
      '<div class="ctme-field">' +
        '<label class="ctme-field-label">新密码</label>' +
        '<div class="ctme-pwd-wrap">' +
          '<input type="password" class="ctme-input" id="ctmeForceNewPwd" placeholder="输入新的账号密码" autocomplete="off">' +
          '<button type="button" class="ctme-pwd-eye" id="ctmeForcePwdEye" aria-label="显示密码">' + SVG_EYE + '</button>' +
        '</div>' +
        '<div class="ctme-pwd-err" id="ctmeForcePwdErr"></div>' +
      '</div>' +
      '<button type="button" class="ctme-action-btn is-primary" id="ctmeForceSave">确认修改密码</button>',
      function (body) {
        var inp = body.querySelector('#ctmeForceNewPwd');
        var eye = body.querySelector('#ctmeForcePwdEye');
        var errEl = body.querySelector('#ctmeForcePwdErr');
        eye.addEventListener('click', function () {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        });
        body.querySelector('#ctmeForceSave').addEventListener('click', function () {
          var val = (inp.value || '').trim();
          if (!val) {
            errEl.textContent = '请输入新密码';
            return;
          }
          if (forceResetCharPasscode(ch.id, val)) {
            closeSheet();
            showToast('已为「' + (ch.name || 'TA') + '」重设密码');
            renderTopPage();
          }
        });
        setTimeout(function () { inp.focus(); }, 180);
      }
    );
  }

  function renderAccountsPage() {
    var list = getAccounts();
    var activeId = getActiveAccount().id;
    var masks = getMasksSafe();
    var chars = getCharsSafe();

    var mainAccounts = list.filter(function (a) { return a.type !== 'char' && a.type !== 'alt'; });
    var altAccounts = list.filter(function (a) { return a.type === 'alt'; });

    function buildSelfCard(a) {
      var isCur = a.id === activeId;
      var linkedMask = a.maskId ? masks.find(function (m) { return m.id === a.maskId; }) : null;
      var typeBadgeHtml = a.type === 'alt'
        ? '<span class="ctme-acc-badge is-alt">小号</span>'
        : '<span class="ctme-acc-badge is-main">主号</span>';
      var maskBadgeHtml = linkedMask
        ? '<span class="ctme-acc-badge is-mask">面具 · ' + esc(linkedMask.name || '已绑定') + '</span>'
        : '';
      var metaText = a.chatId
        ? ('ID: ' + a.chatId)
        : (a.signature || (linkedMask ? '面具「' + (linkedMask.name || '') + '」的社媒账号' : '点击切换为此账号'));

      var canDelete = list.length > 1 && a.id !== 'acc_default';
      var actionsHtml = (!isCur || canDelete)
        ? '<div class="ctme-acc-actions">' +
            (!isCur ? '<button type="button" class="ctme-mini-pill" style="background:#111;color:#fff;" data-acc-switch="' + esc(a.id) + '">切换使用</button>' : '') +
            (canDelete ? '<button type="button" class="ctme-mini-pill is-danger" data-acc-del="' + esc(a.id) + '">删除</button>' : '') +
          '</div>'
        : '';

      return '<div class="ctme-acc-card ' + (isCur ? 'is-current' : '') + '" data-acc-id="' + esc(a.id) + '">' +
        '<div class="ctme-acc-top" data-acc-switch="' + esc(a.id) + '">' +
          '<div class="ctme-acc-ava" data-acc-ava-id="' + esc(a.id) + '">' + esc((a.name || '我').slice(0, 1)) + '</div>' +
          '<div class="ctme-acc-info">' +
            '<div class="ctme-acc-name-line">' +
              '<span class="ctme-acc-name">' + esc(a.name) + '</span>' +
              typeBadgeHtml +
              maskBadgeHtml +
              (isCur ? '<span class="ctme-acc-badge">当前使用</span>' : '') +
            '</div>' +
            '<div class="ctme-acc-meta">' + esc(metaText) + '</div>' +
          '</div>' +
        '</div>' +
        actionsHtml +
      '</div>';
    }

    var mainSectionHtml = mainAccounts.map(buildSelfCard).join('');
    var altSectionHtml = altAccounts.length
      ? altAccounts.map(buildSelfCard).join('')
      : '<div class="ctme-card"><div class="ctme-empty" style="padding:20px;">暂无小号，点右上角「新建」可为不同面具开小号</div></div>';

    var charSectionHtml = chars.length
      ? chars.map(function (ch) {
          getCharPasscode(ch.id, ch.name);
          var unlocked = isCharUnlocked(ch.id);
          var loginMode = getCharLoginMode(ch.id);
          var charAcc = list.find(function (a) { return a.type === 'char' && a.charId === ch.id; });
          var isCur = !!(charAcc && charAcc.id === activeId);

          var actionsRowHtml = (!unlocked || !isCur)
            ? '<div class="ctme-acc-actions">' +
                (!unlocked
                  ? '<button type="button" class="ctme-mini-pill" style="background:#111;color:#fff;" data-char-login="' + esc(ch.id) + '">输入密码登录</button>'
                  : (!isCur ? '<button type="button" class="ctme-mini-pill" style="background:#111;color:#fff;" data-char-login="' + esc(ch.id) + '">切换为 TA</button>' : '')) +
                '<button type="button" class="ctme-mini-pill" data-char-force-reset="' + esc(ch.id) + '">强制改密码</button>' +
              '</div>'
            : '<div class="ctme-acc-actions">' +
                '<button type="button" class="ctme-mini-pill" data-char-force-reset="' + esc(ch.id) + '">强制改密码</button>' +
              '</div>';

          return '<div class="ctme-acc-card ' + (isCur ? 'is-current' : '') + '" data-char-card="' + esc(ch.id) + '">' +
            '<div class="ctme-acc-top" data-char-login="' + esc(ch.id) + '">' +
              '<div class="ctme-acc-ava" data-char-ava-id="' + esc(ch.id) + '">' + esc((ch.name || 'C').slice(0, 1)) + '</div>' +
              '<div class="ctme-acc-info">' +
                '<div class="ctme-acc-name-line">' +
                  '<span class="ctme-acc-name">' + esc(ch.name || '未命名角色') + '</span>' +
                  '<span class="ctme-acc-badge is-char">Char 视角</span>' +
                  (!unlocked
                    ? '<span class="ctme-acc-badge is-locked">需要密码</span>'
                    : (loginMode === 'stealth' ? '<span class="ctme-acc-badge is-stealth">悄悄偷看</span>' : '')) +
                  (isCur ? '<span class="ctme-acc-badge">当前登录</span>' : '') +
                '</div>' +
                '<div class="ctme-acc-meta">' +
                  (unlocked
                    ? (isCur ? '正以 TA 的视角查看微信与聊天' : '已验证密码，点击直接切换')
                    : '不能直接登录 · 密码只能去聊天里问 TA') +
                '</div>' +
              '</div>' +
              (!unlocked ? '<span class="ctme-lock-icon">' + SVG_LOCK + '</span>' : '') +
            '</div>' +
            actionsRowHtml +
          '</div>';
        }).join('')
      : '<div class="ctme-card"><div class="ctme-empty" style="padding:20px;">还没有角色卡，去「档案」添加 Char 后就能在这里登录 TA 的账号</div></div>';

    var ov = renderSubShell('切换账号',
      '<button type="button" class="ctme-pill-btn is-primary" id="ctmeAccCreate">新建</button>',
      '<div class="ctme-section-label">主账号</div>' +
      mainSectionHtml +
      '<div class="ctme-section-label">小号（支持不同面具）</div>' +
      altSectionHtml +
      '<div class="ctme-section-label">登录 Char 的账号</div>' +
      charSectionHtml
    );
    if (!ov) return;

    ov.querySelectorAll('.ctme-acc-ava[data-acc-ava-id]').forEach(function (el) {
      var id = el.getAttribute('data-acc-ava-id');
      var accObj = list.find(function (x) { return x.id === id; });
      if (accObj) loadAccountAvatarInto(accObj, el);
    });
    ov.querySelectorAll('.ctme-acc-ava[data-char-ava-id]').forEach(function (el) {
      var cid = el.getAttribute('data-char-ava-id');
      getCharAvatarSafe(cid).then(function (u) {
        if (u) el.innerHTML = '<img src="' + u + '" alt="">';
      });
    });

    ov.querySelectorAll('[data-acc-switch]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-acc-switch');
        if (id === activeId) return;
        setActiveAccount(id);
        showToast('已切换账号');
        renderTopPage();
      });
    });

    ov.querySelectorAll('[data-char-login]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var cid = el.getAttribute('data-char-login');
        var ch = chars.find(function (x) { return x.id === cid; });
        if (!ch) return;
        if (!isCharUnlocked(cid)) {
          openCharPasswordSheet(ch);
          return;
        }
        var charAcc = getOrCreateCharAccount(ch);
        if (charAcc.id === activeId) return;
        setActiveAccount(charAcc.id);
        showToast('已切换到「' + (ch.name || 'Char') + '」视角');
        renderTopPage();
      });
    });

    ov.querySelectorAll('[data-char-force-reset]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var cid = btn.getAttribute('data-char-force-reset');
        var ch = chars.find(function (x) { return x.id === cid; });
        if (!ch) return;
        openCharForceResetSheet(ch);
      });
    });

    ov.querySelectorAll('[data-acc-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-acc-del');
        var target = getAccounts().find(function (x) { return x.id === id; });
        if (!target) return;
        openConfirm('删除账号', '确认删除账号「' + target.name + '」吗？', '确认删除', function () {
          if (target.avatarDbKey) {
            delete avatarCache[target.avatarDbKey];
            dbRemove(target.avatarDbKey);
          }
          var next = getAccounts().filter(function (x) { return x.id !== id; });
          saveAccounts(next);
          if (id === activeId && next[0]) {
            setActiveAccount(next[0].id);
          }
          showToast('已删除账号');
          renderTopPage();
        });
      });
    });

    ov.querySelector('#ctmeAccCreate').addEventListener('click', function () {
      var curMasks = getMasksSafe();
      var maskOpts = curMasks.map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.name || '未命名面具') + '</option>';
      }).join('');

      openSheet('新建社媒账号',
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">账号类型</label>' +
          '<select class="ctme-select" id="ctmeNewAccType">' +
            '<option value="alt">小号（马甲账号）</option>' +
            '<option value="main">主号</option>' +
          '</select>' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">所属「面具」角色卡（可选）</label>' +
          '<select class="ctme-select" id="ctmeNewAccMaskId">' +
            '<option value="">不绑定面具</option>' +
            maskOpts +
          '</select>' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">网名</label>' +
          '<input type="text" class="ctme-input" id="ctmeNewAccName" placeholder="输入账号网名">' +
        '</div>' +
        '<div class="ctme-field">' +
          '<label class="ctme-field-label">Chat ID（可选）</label>' +
          '<input type="text" class="ctme-input" id="ctmeNewAccId" placeholder="例如：alt_account">' +
        '</div>' +
        '<button type="button" class="ctme-action-btn is-primary" id="ctmeNewAccSave">创建并切换</button>',
        function (body) {
          var typeSel = body.querySelector('#ctmeNewAccType');
          var maskIdSel = body.querySelector('#ctmeNewAccMaskId');
          var nameInp = body.querySelector('#ctmeNewAccName');

          if (maskIdSel) {
            maskIdSel.addEventListener('change', function () {
              var m = curMasks.find(function (x) { return x.id === maskIdSel.value; });
              if (m && !nameInp.value.trim()) {
                nameInp.value = m.name || '';
              }
            });
          }

          body.querySelector('#ctmeNewAccSave').addEventListener('click', function () {
            var name = (nameInp.value || '').trim();
            if (!name) {
              showToast('请输入账号网名');
              return;
            }
            var acc = {
              id: genId('acc'),
              type: typeSel.value === 'main' ? 'main' : 'alt',
              maskId: maskIdSel ? maskIdSel.value : '',
              charId: '',
              name: name,
              chatId: (body.querySelector('#ctmeNewAccId').value || '').trim(),
              signature: '',
              avatarDbKey: ''
            };
            var all = getAccounts();
            all.push(acc);
            saveAccounts(all);
            setActiveAccount(acc.id);
            closeSheet();
            showToast('已创建并切换到「' + name + '」');
            renderTopPage();
          });
        }
      );
    });
  }

  /* ---------------- 黑名单管理子页 ---------------- */
  function renderBlocklistPage() {
    var settings = readJSON('chat_thread_settings_v1', {});
    var contacts = readJSON('chat_contacts_v1', []);
    if (!Array.isArray(contacts)) contacts = [];
    var blockedIds = Object.keys(settings || {}).filter(function (tid) {
      return settings[tid] && settings[tid].blocked;
    });

    var rowsHtml = blockedIds.length
      ? '<div class="ctme-card">' + blockedIds.map(function (tid) {
          var c = contacts.find(function (x) { return x && (x.id === tid || x.threadId === tid); });
          var label = (settings[tid] && settings[tid].remark) || (c && (c.remark || c.name)) || tid;
          return '<div class="ctme-item">' +
            '<div class="ctme-item-label">' + esc(label) + '</div>' +
            '<button type="button" class="ctme-mini-pill" data-unblock-tid="' + esc(tid) + '">移出黑名单</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="ctme-card"><div class="ctme-empty">黑名单为空</div></div>';

    var ov = renderSubShell('黑名单管理', '', rowsHtml);
    if (!ov) return;

    ov.querySelectorAll('[data-unblock-tid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = btn.getAttribute('data-unblock-tid');
        var cur = readJSON('chat_thread_settings_v1', {});
        if (cur[tid]) {
          cur[tid].blocked = false;
          writeJSON('chat_thread_settings_v1', cur);
        }
        showToast('已移出黑名单');
        renderTopPage();
      });
    });
  }

  /* ---------------- 主页面渲染（「我的」Tab） ---------------- */
  function isMeTabActive() {
    var tab = document.querySelector('#app-chat .ct-tab-btn[data-tab="me"]');
    return !!(tab && tab.classList.contains('active'));
  }

  function renderRow(item, metaText) {
    return '<div class="ctme-row" data-me-item="' + item.id + '">' +
      '<div class="ctme-row-left">' +
        '<span class="ctme-row-icon">' + item.icon + '</span>' +
        '<span>' + item.label + '</span>' +
      '</div>' +
      '<div class="ctme-row-right">' +
        (metaText ? '<span class="ctme-row-meta">' + esc(metaText) + '</span>' : '') +
        '<span class="ctme-row-arrow">' + SVG_ARROW + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderMePage() {
    var appEl = document.querySelector('#app-chat .ct-app');
    var scroll = document.getElementById('ctMainScroll');
    if (!appEl || !scroll) return;

    if (!isMeTabActive()) {
      appEl.classList.remove('is-me-tab');
      closeAllPages();
      return;
    }

    appEl.classList.add('is-me-tab');
    rendering = true;

    var acc = getActiveAccount();
    var prefs = getPrefs();
    var balText = prefs.showWalletBalance ? ('¥' + getWalletBalance().toFixed(2)) : '';
    var subLine = acc.chatId ? ('ID: ' + acc.chatId) : (acc.signature || '');
    var roleTagHtml = acc.type === 'char'
      ? '<span class="ctme-role-tag is-char">Char 视角</span>'
      : (acc.type === 'alt' ? '<span class="ctme-role-tag">小号</span>' : '');

    scroll.innerHTML =
      '<div class="ctme-wrap">' +
        '<div class="ctme-profile" id="ctmeProfileEntry">' +
          '<div class="ctme-avatar" id="ctmeMainAvatar">' + SVG_USER + '</div>' +
          '<div class="ctme-profile-info">' +
            '<div class="ctme-name-row">' +
              '<div class="ctme-name">' + esc(acc.name || '我') + '</div>' +
              roleTagHtml +
            '</div>' +
            (subLine ? '<div class="ctme-sub-id">' + esc(subLine) + '</div>' : '') +
          '</div>' +
          '<span class="ctme-row-arrow">' + SVG_ARROW + '</span>' +
        '</div>' +
        '<div class="ctme-gap"></div>' +
        '<div class="ctme-list">' +
          MAIN_ITEMS.map(function (it) {
            return renderRow(it, it.id === 'wallet' ? balText : '');
          }).join('') +
        '</div>' +
        '<div class="ctme-gap"></div>' +
        '<div class="ctme-list">' + renderRow(SETTINGS_ITEM, '') + '</div>' +
      '</div>';

    loadAccountAvatarInto(acc, scroll.querySelector('#ctmeMainAvatar'));

    var profileEntry = scroll.querySelector('#ctmeProfileEntry');
    if (profileEntry) {
      profileEntry.addEventListener('click', function () {
        pushPage({ id: 'profile', accountId: acc.id });
      });
    }

    scroll.querySelectorAll('.ctme-row[data-me-item]').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.getAttribute('data-me-item');
        pushPage({ id: id });
      });
    });

    bindPressFeedback(scroll);
    rendering = false;
  }

  /* ---------------- 对外全局接口 ---------------- */
  window.PhoneChatMe = {
    getActiveAccount: getActiveAccount,
    getActiveAvatarDataUrl: function () {
      return resolveAccountAvatar(getActiveAccount());
    },
    getAccounts: getAccounts,
    setActiveAccount: setActiveAccount,
    isCharAccount: function () {
      var acc = getActiveAccount();
      return !!(acc && acc.type === 'char' && acc.charId);
    },
    getCharPasscode: getCharPasscode,
    setCharPasscode: setCharPasscode,
    isCharUnlocked: isCharUnlocked,
    isCharResetAllowed: isCharResetAllowed,
    setCharResetAllowed: setCharResetAllowed,
    getCharLoginMode: getCharLoginMode,
    getWalletBalance: getWalletBalance,
    setWalletBalance: setWalletBalance,
    addWalletLog: addWalletLog,
    getFavorites: getFavorites,
    addFavorite: function (item) {
      var key = scopedKey(KEY_FAVORITES);
      var list = readJSON(key, []);
      if (!Array.isArray(list)) list = [];
      list.unshift(Object.assign({
        id: genId('fav'),
        title: '',
        content: '',
        tag: '聊天记录',
        source: '',
        createdAt: Date.now()
      }, item || {}));
      writeJSON(key, list);
    },
    getStickerPacks: getStickerPacks,
    getStickerImage: function (dbKey) {
      if (!dbKey) return Promise.resolve('');
      if (stickerImgCache[dbKey]) return Promise.resolve(stickerImgCache[dbKey]);
      return dbGet(dbKey).then(function (u) {
        if (u) stickerImgCache[dbKey] = u;
        return u || '';
      });
    },
    getPrefs: getPrefs,
    openSubpage: function (id) {
      if (id) pushPage({ id: id });
    }
  };

  function init() {
    var scroll = document.getElementById('ctMainScroll');
    if (!scroll) return;
    var observer = new MutationObserver(function () {
      if (rendering) return;
      if (isMeTabActive()) {
        if (!scroll.querySelector('.ctme-wrap')) renderMePage();
      } else {
        var appEl = document.querySelector('#app-chat .ct-app');
        if (appEl) appEl.classList.remove('is-me-tab');
        closeAllPages();
      }
    });
    observer.observe(scroll, { childList: true });
    renderMePage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
