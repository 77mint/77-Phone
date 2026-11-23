/* apps/mask.js - 面具（人物档案卡布局 + 性别 + 右上角导出 + PNG/JSON 导入导出 + 角色绑定） */
(function () {
  var STORAGE_KEY = 'phone_masks_v1';
  var AVATAR_PREFIX = 'mask_avatar_';

  var screenEl = document.getElementById('app-mask');
  if (!screenEl) return;

  var masks = loadMasks();
  var avatarCache = {};
  var charAvatarCache = {};
  var fabOpen = false;
  var exportMenuOpen = false;
  var editingId = null;
  var draftAvatarDataUrl = '';
  var draftAvatarCleared = false;
  var draftBoundCharIds = [];
  var toastTimer = null;

  function loadMasks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveMasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(masks));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('phone-mask-updated'));
  }

  function genId() {
    return 'msk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getAllChars() {
    if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      var list = window.PhoneArchive.getChars();
      return Array.isArray(list) ? list : [];
    }
    return [];
  }

  function fetchMaskAvatar(id) {
    if (!id) return Promise.resolve('');
    if (avatarCache[id] !== undefined) return Promise.resolve(avatarCache[id]);
    if (!window.PhoneDB || typeof window.PhoneDB.get !== 'function') {
      avatarCache[id] = '';
      return Promise.resolve('');
    }
    return window.PhoneDB.get(AVATAR_PREFIX + id).then(function (url) {
      avatarCache[id] = url || '';
      return avatarCache[id];
    }).catch(function () {
      avatarCache[id] = '';
      return '';
    });
  }

  function fetchCharAvatar(charObj) {
    if (!charObj || !charObj.id) return Promise.resolve('');
    if (charAvatarCache[charObj.id] !== undefined) return Promise.resolve(charAvatarCache[charObj.id]);
    if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      try {
        var res = window.PhoneArchive.getCharAvatar(charObj.id);
        if (res && typeof res.then === 'function') {
          return res.then(function (u) {
            charAvatarCache[charObj.id] = u || '';
            return charAvatarCache[charObj.id];
          }).catch(function () {
            charAvatarCache[charObj.id] = '';
            return '';
          });
        }
        if (typeof res === 'string') {
          charAvatarCache[charObj.id] = res;
          return Promise.resolve(res);
        }
      } catch (e) {}
    }
    charAvatarCache[charObj.id] = '';
    return Promise.resolve('');
  }

  /* 通用触摸按压绑定（带移动取消，防 iOS Safari :active 失效与滑动误触） */
  function bindTap(el, onTap) {
    if (!el) return;
    var sx = 0;
    var sy = 0;
    var moved = false;
    var handledTouch = false;

    el.addEventListener('touchstart', function (e) {
      moved = false;
      handledTouch = false;
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

    el.addEventListener('touchend', function (e) {
      el.classList.remove('is-pressed');
      if (!moved && typeof onTap === 'function') {
        handledTouch = true;
        e.preventDefault();
        e.stopPropagation();
        onTap(e);
      }
    }, { passive: false });

    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });

    el.addEventListener('click', function (e) {
      if (handledTouch) {
        handledTouch = false;
        e.stopPropagation();
        return;
      }
      if (typeof onTap === 'function') {
        e.stopPropagation();
        onTap(e);
      }
    });
  }

  /* 构建 DOM */
  screenEl.innerHTML =
    '<div class="msk-app">' +
      '<div class="msk-header">' +
        '<div class="msk-header-left">' +
          '<button class="msk-back-btn" id="mskHomeBackBtn" type="button" data-close-app aria-label="返回">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
          '<h1 class="msk-title">面具</h1>' +
        '</div>' +
        '<div class="msk-count-badge" id="mskCountBadge">0 个</div>' +
      '</div>' +

      '<div class="msk-scroll" id="mskListScroll"></div>' +

      '<div class="msk-fab-scrim" id="mskFabScrim"></div>' +
      '<div class="msk-fab-wrap" id="mskFabWrap">' +
        '<div class="msk-fab-actions">' +
          '<button class="msk-fab-action" id="mskImportBtn" type="button" data-order="1">' +
            '<span class="msk-fab-action-ic">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            '</span>' +
            '<span>导入<span class="msk-fab-action-sub">PNG / JSON</span></span>' +
          '</button>' +
          '<button class="msk-fab-action" id="mskAddBtn" type="button" data-order="2">' +
            '<span class="msk-fab-action-ic">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</span>' +
            '<span>新增</span>' +
          '</button>' +
        '</div>' +
        '<button class="msk-fab-btn" id="mskFabBtn" type="button" aria-label="展开操作">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '</button>' +
      '</div>' +

      /* 全屏编辑/新建子页 */
      '<div class="msk-editor" id="mskEditor">' +
        '<div class="msk-editor-header">' +
          '<div class="msk-editor-header-left">' +
            '<button class="msk-back-btn" id="mskEditorBackBtn" type="button" aria-label="返回">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h2 class="msk-editor-title" id="mskEditorTitle">新增面具</h2>' +
          '</div>' +
          '<div class="msk-editor-header-right">' +
            '<button class="msk-export-top-btn" id="mskExportTopBtn" type="button">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
              '<span>导出</span>' +
            '</button>' +
            '<button class="msk-save-btn" id="mskSaveBtn" type="button">保存</button>' +
          '</div>' +
        '</div>' +

        '<div class="msk-export-popover-mask" id="mskExportPopoverMask"></div>' +
        '<div class="msk-export-popover" id="mskExportPopover">' +
          '<button class="msk-export-popover-item" id="mskExportPngBtn" type="button">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
            '<span>导出 PNG 面具卡</span>' +
          '</button>' +
          '<button class="msk-export-popover-item" id="mskExportJsonBtn" type="button">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
            '<span>导出 JSON</span>' +
          '</button>' +
        '</div>' +

        '<div class="msk-editor-scroll" id="mskEditorScroll">' +
          /* 上半区：左竖版头像 + 右三行（姓名 / 性别 / 年龄） */
          '<div class="msk-profile-top">' +
            '<div class="msk-portrait-box" id="mskAvatarPicker" role="button" tabindex="0" aria-label="上传头像">' +
              '<div class="msk-portrait-inner" id="mskAvatarPreview"></div>' +
              '<button class="msk-portrait-clear" id="mskAvatarClearBtn" type="button" aria-label="移除头像">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="msk-profile-fields">' +
              '<div class="msk-field">' +
                '<label class="msk-field-label" for="mskNameInput">姓名</label>' +
                '<input class="msk-input" id="mskNameInput" type="text" placeholder="人设姓名" autocomplete="off">' +
              '</div>' +
              '<div class="msk-field">' +
                '<label class="msk-field-label" for="mskGenderInput">性别</label>' +
                '<input class="msk-input" id="mskGenderInput" type="text" placeholder="女 / 男 / 未知" autocomplete="off">' +
              '</div>' +
              '<div class="msk-field">' +
                '<label class="msk-field-label" for="mskAgeInput">年龄</label>' +
                '<input class="msk-input" id="mskAgeInput" type="text" placeholder="如：21、未知" autocomplete="off">' +
              '</div>' +
            '</div>' +
          '</div>' +

          /* 中间：整块大卡放设定 */
          '<div class="msk-setting-card">' +
            '<label class="msk-field-label" for="mskSettingInput">设定</label>' +
            '<textarea class="msk-textarea" id="mskSettingInput" placeholder="写下外貌、性格、身份背景、与角色的关系等设定..."></textarea>' +
          '</div>' +

          /* 底部：绑定角色 */
          '<div class="msk-section-label">' +
            '<span>绑定角色</span>' +
            '<span id="mskBindCountLabel">已选 0 个</span>' +
          '</div>' +
          '<div class="msk-bind-card" id="mskBindList"></div>' +

          '<button class="msk-delete-btn" id="mskDeleteBtn" type="button" style="display:none;">删除面具</button>' +
        '</div>' +
      '</div>' +

      /* 删除确认弹窗 */
      '<div class="msk-modal-mask" id="mskDeleteModal">' +
        '<div class="msk-modal">' +
          '<div class="msk-modal-title">删除这个面具？</div>' +
          '<div class="msk-modal-desc" id="mskDeleteModalDesc">删除后将解除已绑定角色的关联，无法恢复。</div>' +
          '<div class="msk-modal-btns">' +
            '<button class="msk-modal-btn is-cancel" id="mskDeleteCancelBtn" type="button">取消</button>' +
            '<button class="msk-modal-btn is-confirm" id="mskDeleteConfirmBtn" type="button">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="msk-toast" id="mskToast"></div>' +
      '<input type="file" id="mskAvatarFileInput" accept="image/*" style="display:none;">' +
      '<input type="file" id="mskImportFileInput" accept=".png,.json,image/png,application/json" style="display:none;">' +
    '</div>';

  var homeBackBtn = document.getElementById('mskHomeBackBtn');
  var countBadge = document.getElementById('mskCountBadge');
  var listScroll = document.getElementById('mskListScroll');
  var fabScrim = document.getElementById('mskFabScrim');
  var fabWrap = document.getElementById('mskFabWrap');
  var fabBtn = document.getElementById('mskFabBtn');
  var addBtn = document.getElementById('mskAddBtn');
  var importBtn = document.getElementById('mskImportBtn');

  var editorEl = document.getElementById('mskEditor');
  var editorBackBtn = document.getElementById('mskEditorBackBtn');
  var editorTitle = document.getElementById('mskEditorTitle');
  var exportTopBtn = document.getElementById('mskExportTopBtn');
  var exportPopoverMask = document.getElementById('mskExportPopoverMask');
  var exportPopover = document.getElementById('mskExportPopover');
  var exportPngBtn = document.getElementById('mskExportPngBtn');
  var exportJsonBtn = document.getElementById('mskExportJsonBtn');
  var saveBtn = document.getElementById('mskSaveBtn');
  var editorScroll = document.getElementById('mskEditorScroll');
  var avatarPicker = document.getElementById('mskAvatarPicker');
  var avatarPreview = document.getElementById('mskAvatarPreview');
  var avatarClearBtn = document.getElementById('mskAvatarClearBtn');
  var nameInput = document.getElementById('mskNameInput');
  var genderInput = document.getElementById('mskGenderInput');
  var ageInput = document.getElementById('mskAgeInput');
  var settingInput = document.getElementById('mskSettingInput');
  var bindCountLabel = document.getElementById('mskBindCountLabel');
  var bindListEl = document.getElementById('mskBindList');
  var deleteBtn = document.getElementById('mskDeleteBtn');

  var deleteModal = document.getElementById('mskDeleteModal');
  var deleteModalDesc = document.getElementById('mskDeleteModalDesc');
  var deleteCancelBtn = document.getElementById('mskDeleteCancelBtn');
  var deleteConfirmBtn = document.getElementById('mskDeleteConfirmBtn');
  var toastEl = document.getElementById('mskToast');
  var avatarFileInput = document.getElementById('mskAvatarFileInput');
  var importFileInput = document.getElementById('mskImportFileInput');

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 1800);
  }

  function setFabOpen(open) {
    fabOpen = !!open;
    fabWrap.classList.toggle('is-open', fabOpen);
    fabScrim.classList.toggle('is-open', fabOpen);
  }

  function setExportMenuOpen(open) {
    exportMenuOpen = !!open;
    exportPopover.classList.toggle('is-open', exportMenuOpen);
    exportPopoverMask.classList.toggle('is-open', exportMenuOpen);
  }

  /* 压缩图片到合适尺寸，避免 IndexedDB 过大 */
  function compressImageFile(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width || 1;
          var h = img.height || 1;
          var limit = maxSide || 720;
          if (w > limit || h > limit) {
            if (w >= h) {
              h = Math.round((h * limit) / w);
              w = limit;
            } else {
              w = Math.round((w * limit) / h);
              h = limit;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.86));
          } catch (err) {
            resolve(reader.result || '');
          }
        };
        img.onerror = function () { reject(new Error('图片加载失败')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('文件读取失败')); };
      reader.readAsDataURL(file);
    });
  }

  /* PNG 元数据解析（支持本 App 的 phone_mask 以及 SillyTavern 的 chara / ccv3） */
  function base64ToUtf8(b64) {
    var clean = String(b64 || '').replace(/\s+/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(String(str || ''));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function extractPngTextChunks(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    var bytes = new Uint8Array(arrayBuffer);
    var result = {};
    if (bytes.length < 8) return result;
    if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return result;

    var offset = 8;
    while (offset + 12 <= bytes.length) {
      var len = view.getUint32(offset, false);
      var type =
        String.fromCharCode(bytes[offset + 4]) +
        String.fromCharCode(bytes[offset + 5]) +
        String.fromCharCode(bytes[offset + 6]) +
        String.fromCharCode(bytes[offset + 7]);
      var dataStart = offset + 8;
      var dataEnd = dataStart + len;
      if (dataEnd > bytes.length) break;

      if (type === 'tEXt') {
        var zero = -1;
        for (var i = dataStart; i < dataEnd; i++) {
          if (bytes[i] === 0) { zero = i; break; }
        }
        if (zero > dataStart) {
          var key = new TextDecoder('latin1').decode(bytes.subarray(dataStart, zero));
          var val = new TextDecoder('latin1').decode(bytes.subarray(zero + 1, dataEnd));
          result[key] = val;
        }
      } else if (type === 'iTXt') {
        var z1 = -1;
        for (var j = dataStart; j < dataEnd; j++) {
          if (bytes[j] === 0) { z1 = j; break; }
        }
        if (z1 > dataStart && z1 + 3 < dataEnd) {
          var ikey = new TextDecoder('latin1').decode(bytes.subarray(dataStart, z1));
          var compFlag = bytes[z1 + 1];
          if (compFlag === 0) {
            var p = z1 + 3;
            while (p < dataEnd && bytes[p] !== 0) p++;
            p++;
            while (p < dataEnd && bytes[p] !== 0) p++;
            p++;
            if (p <= dataEnd) {
              result[ikey] = new TextDecoder('utf-8').decode(bytes.subarray(p, dataEnd));
            }
          }
        }
      }

      offset = dataEnd + 4;
      if (type === 'IEND') break;
    }
    return result;
  }

  /* CRC32 + 注入 tEXt 块到 PNG（用于导出面具 PNG 卡） */
  var crcTable = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function injectPngTextChunk(pngBuffer, keyword, textValue) {
    var src = new Uint8Array(pngBuffer);
    var view = new DataView(pngBuffer);
    var keyBytes = new TextEncoder().encode(keyword);
    var valBytes = new TextEncoder().encode(textValue);
    var chunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
    chunkData.set(keyBytes, 0);
    chunkData[keyBytes.length] = 0;
    chunkData.set(valBytes, keyBytes.length + 1);

    var typeAndData = new Uint8Array(4 + chunkData.length);
    typeAndData[0] = 116; // t
    typeAndData[1] = 69;  // E
    typeAndData[2] = 88;  // X
    typeAndData[3] = 116; // t
    typeAndData.set(chunkData, 4);

    var chunkCrc = crc32(typeAndData);
    var newChunk = new Uint8Array(4 + typeAndData.length + 4);
    var newView = new DataView(newChunk.buffer);
    newView.setUint32(0, chunkData.length, false);
    newChunk.set(typeAndData, 4);
    newView.setUint32(4 + typeAndData.length, chunkCrc, false);

    var offset = 8;
    var iendPos = src.length;
    while (offset + 12 <= src.length) {
      var len = view.getUint32(offset, false);
      var t =
        String.fromCharCode(src[offset + 4]) +
        String.fromCharCode(src[offset + 5]) +
        String.fromCharCode(src[offset + 6]) +
        String.fromCharCode(src[offset + 7]);
      if (t === 'IEND') {
        iendPos = offset;
        break;
      }
      offset += 12 + len;
    }

    var out = new Uint8Array(src.length + newChunk.length);
    out.set(src.subarray(0, iendPos), 0);
    out.set(newChunk, iendPos);
    out.set(src.subarray(iendPos), iendPos + newChunk.length);
    return out;
  }

  function normalizeImportedMaskObj(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var d = raw.data && typeof raw.data === 'object' ? raw.data : raw;
    var name = String(d.name || raw.name || '').trim();
    var gender = String(d.gender || raw.gender || '').trim();
    var age = String(d.age || raw.age || '').trim();
    var setting = '';
    if (typeof d.setting === 'string' && d.setting.trim()) {
      setting = d.setting.trim();
    } else if (typeof raw.setting === 'string' && raw.setting.trim()) {
      setting = raw.setting.trim();
    } else {
      var parts = [];
      if (d.description) parts.push(String(d.description).trim());
      if (d.personality) parts.push(String(d.personality).trim());
      if (d.scenario) parts.push(String(d.scenario).trim());
      setting = parts.filter(Boolean).join('\n\n');
    }
    var avatar = typeof raw.avatar === 'string' ? raw.avatar : '';
    if (!name && !setting && !avatar) return null;
    return {
      name: name || '未命名面具',
      gender: gender,
      age: age,
      setting: setting,
      avatar: avatar
    };
  }

  /* 渲染主列表 */
  function renderList() {
    countBadge.textContent = masks.length + ' 个';
    var chars = getAllChars();
    var charMap = {};
    chars.forEach(function (c) { charMap[c.id] = c; });

    if (!masks.length) {
      listScroll.innerHTML =
        '<div class="msk-empty">' +
          '<div class="msk-empty-icon">' +
            '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4 7c0-1.5 3.6-3 8-3s8 1.5 8 3v4c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V7z"/>' +
              '<path d="M8.5 11.2c.6-.7 1.9-.7 2.5 0"/>' +
              '<path d="M13 11.2c.6-.7 1.9-.7 2.5 0"/>' +
              '<path d="M9.5 15.5c1.5 1 3.5 1 5 0"/>' +
            '</svg>' +
          '</div>' +
          '<div class="msk-empty-title">还没有面具</div>' +
          '<div class="msk-empty-sub">点右下角大加号新增你的人设，或导入 PNG / JSON 面具卡。</div>' +
        '</div>';
      return;
    }

    var html = '';
    masks.forEach(function (m) {
      var initial = (m.name || '面').trim().charAt(0).toUpperCase();
      var boundIds = Array.isArray(m.boundCharIds) ? m.boundCharIds : [];
      var validBound = boundIds.filter(function (cid) { return !!charMap[cid]; });

      var pillsHtml = '';
      if (validBound.length) {
        validBound.forEach(function (cid) {
          var c = charMap[cid];
          var cname = c.name || '未命名';
          pillsHtml +=
            '<span class="msk-bound-pill">' +
              '<span class="msk-bound-pill-av" data-char-av="' + escHtml(cid) + '">' + escHtml(cname.charAt(0)) + '</span>' +
              '<span class="msk-bound-pill-name">' + escHtml(cname) + '</span>' +
            '</span>';
        });
      } else {
        pillsHtml = '<span class="msk-bound-none">未绑定角色</span>';
      }

      html +=
        '<div class="msk-card" data-mask-id="' + escHtml(m.id) + '">' +
          '<div class="msk-card-top">' +
            '<div class="msk-card-avatar" data-mask-av="' + escHtml(m.id) + '">' + escHtml(initial) + '</div>' +
            '<div class="msk-card-info">' +
              '<div class="msk-card-name-row">' +
                '<span class="msk-card-name">' + escHtml(m.name || '未命名面具') + '</span>' +
                (m.gender ? '<span class="msk-card-tag">' + escHtml(m.gender) + '</span>' : '') +
                (m.age ? '<span class="msk-card-tag">' + escHtml(m.age) + '</span>' : '') +
              '</div>' +
              '<div class="msk-card-setting">' + escHtml(m.setting || '暂无设定') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="msk-card-footer">' +
            '<div class="msk-bound-pills">' + pillsHtml + '</div>' +
            '<span class="msk-card-chevron">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
            '</span>' +
          '</div>' +
        '</div>';
    });

    listScroll.innerHTML = html;

    listScroll.querySelectorAll('.msk-card[data-mask-id]').forEach(function (card) {
      var id = card.getAttribute('data-mask-id');
      bindTap(card, function () {
        openEditor(id);
      });
    });

    masks.forEach(function (m) {
      fetchMaskAvatar(m.id).then(function (url) {
        if (!url) return;
        var el = listScroll.querySelector('.msk-card-avatar[data-mask-av="' + m.id + '"]');
        if (el) el.innerHTML = '<img src="' + url + '" alt="">';
      });
    });

    chars.forEach(function (c) {
      fetchCharAvatar(c).then(function (url) {
        if (!url) return;
        listScroll.querySelectorAll('.msk-bound-pill-av[data-char-av="' + c.id + '"]').forEach(function (el) {
          el.innerHTML = '<img src="' + url + '" alt="">';
        });
      });
    });
  }

  /* 渲染编辑页竖版头像预览 */
  function renderEditorAvatar() {
    if (draftAvatarDataUrl) {
      avatarPreview.innerHTML = '<img src="' + draftAvatarDataUrl + '" alt="">';
      avatarClearBtn.classList.add('is-show');
    } else {
      avatarPreview.innerHTML =
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
          '<circle cx="12" cy="13" r="4"/>' +
        '</svg>' +
        '<span class="msk-portrait-hint">上传头像</span>';
      avatarClearBtn.classList.remove('is-show');
    }
  }

  /* 渲染底部角色绑定列表 */
  function renderBindList() {
    var chars = getAllChars();
    bindCountLabel.textContent = '已选 ' + draftBoundCharIds.length + ' 个';

    if (!chars.length) {
      bindListEl.innerHTML = '<div class="msk-bind-empty">「档案」里还没有角色，创建角色后就能在这里绑定面具。</div>';
      return;
    }

    var otherBindMap = {};
    masks.forEach(function (m) {
      if (m.id === editingId) return;
      (m.boundCharIds || []).forEach(function (cid) {
        otherBindMap[cid] = m.name || '未命名面具';
      });
    });

    var html = '';
    chars.forEach(function (c) {
      var selected = draftBoundCharIds.indexOf(c.id) !== -1;
      var otherMaskName = otherBindMap[c.id] || '';
      var hintText = selected
        ? '已绑定当前面具'
        : (otherMaskName ? '当前绑定「' + otherMaskName + '」，点击改绑' : '未绑定面具');
      var hintClass = (!selected && otherMaskName) ? 'msk-bind-hint is-other' : 'msk-bind-hint';

      html +=
        '<div class="msk-bind-row' + (selected ? ' is-selected' : '') + '" data-bind-cid="' + escHtml(c.id) + '">' +
          '<div class="msk-bind-av" data-bind-av="' + escHtml(c.id) + '">' + escHtml((c.name || '角').charAt(0)) + '</div>' +
          '<div class="msk-bind-meta">' +
            '<div class="msk-bind-name">' + escHtml(c.name || '未命名角色') + '</div>' +
            '<div class="' + hintClass + '">' + escHtml(hintText) + '</div>' +
          '</div>' +
          '<div class="msk-check">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '</div>' +
        '</div>';
    });

    bindListEl.innerHTML = html;

    bindListEl.querySelectorAll('.msk-bind-row[data-bind-cid]').forEach(function (row) {
      var cid = row.getAttribute('data-bind-cid');
      bindTap(row, function () {
        var idx = draftBoundCharIds.indexOf(cid);
        if (idx === -1) {
          draftBoundCharIds.push(cid);
        } else {
          draftBoundCharIds.splice(idx, 1);
        }
        renderBindList();
      });
    });

    chars.forEach(function (c) {
      fetchCharAvatar(c).then(function (url) {
        if (!url) return;
        var avEl = bindListEl.querySelector('.msk-bind-av[data-bind-av="' + c.id + '"]');
        if (avEl) avEl.innerHTML = '<img src="' + url + '" alt="">';
      });
    });
  }

  /* 打开新建/编辑页 */
  function openEditor(id, prefill) {
    setFabOpen(false);
    setExportMenuOpen(false);
    editingId = id || null;
    draftAvatarCleared = false;

    if (editingId) {
      var target = masks.find(function (m) { return m.id === editingId; });
      if (!target) return;
      editorTitle.textContent = '编辑面具';
      nameInput.value = target.name || '';
      genderInput.value = target.gender || '';
      ageInput.value = target.age || '';
      settingInput.value = target.setting || '';
      draftBoundCharIds = Array.isArray(target.boundCharIds) ? target.boundCharIds.slice() : [];
      draftAvatarDataUrl = avatarCache[editingId] || '';
      deleteBtn.style.display = '';
      renderEditorAvatar();
      fetchMaskAvatar(editingId).then(function (url) {
        if (editingId === target.id && !draftAvatarCleared) {
          draftAvatarDataUrl = url || '';
          renderEditorAvatar();
        }
      });
    } else {
      editorTitle.textContent = '新增面具';
      nameInput.value = (prefill && prefill.name) ? prefill.name : '';
      genderInput.value = (prefill && prefill.gender) ? prefill.gender : '';
      ageInput.value = (prefill && prefill.age) ? prefill.age : '';
      settingInput.value = (prefill && prefill.setting) ? prefill.setting : '';
      draftBoundCharIds = [];
      draftAvatarDataUrl = (prefill && prefill.avatar) ? prefill.avatar : '';
      deleteBtn.style.display = 'none';
      renderEditorAvatar();
    }

    renderBindList();
    editorScroll.scrollTop = 0;
    editorEl.classList.add('is-open');
    syncEditorViewport();
  }

  function closeEditor() {
    setExportMenuOpen(false);
    if (document.activeElement && editorEl.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    editorEl.classList.remove('is-open');
    editorEl.style.height = '';
    editingId = null;
  }

  /* 保存当前面具 */
  function saveCurrentMask() {
    setExportMenuOpen(false);
    var name = nameInput.value.trim();
    var gender = genderInput.value.trim();
    var age = ageInput.value.trim();
    var setting = settingInput.value.trim();

    if (!name) {
      showToast('请先填写姓名');
      nameInput.focus();
      return;
    }

    var now = Date.now();
    var id = editingId || genId();
    var uniqueBound = [];
    draftBoundCharIds.forEach(function (cid) {
      if (cid && uniqueBound.indexOf(cid) === -1) uniqueBound.push(cid);
    });

    /* 单角色仅生效一个面具：自动从旧面具移出重复绑定 */
    masks.forEach(function (m) {
      if (m.id !== id && Array.isArray(m.boundCharIds)) {
        m.boundCharIds = m.boundCharIds.filter(function (cid) {
          return uniqueBound.indexOf(cid) === -1;
        });
      }
    });

    if (editingId) {
      var target = masks.find(function (m) { return m.id === editingId; });
      if (target) {
        target.name = name;
        target.gender = gender;
        target.age = age;
        target.setting = setting;
        target.boundCharIds = uniqueBound;
        target.updatedAt = now;
      }
    } else {
      masks.unshift({
        id: id,
        name: name,
        gender: gender,
        age: age,
        setting: setting,
        boundCharIds: uniqueBound,
        createdAt: now,
        updatedAt: now
      });
    }

    var dbTask = Promise.resolve();
    if (draftAvatarDataUrl) {
      avatarCache[id] = draftAvatarDataUrl;
      if (window.PhoneDB && typeof window.PhoneDB.set === 'function') {
        dbTask = window.PhoneDB.set(AVATAR_PREFIX + id, draftAvatarDataUrl);
      }
    } else if (draftAvatarCleared) {
      avatarCache[id] = '';
      if (window.PhoneDB && typeof window.PhoneDB.del === 'function') {
        dbTask = window.PhoneDB.del(AVATAR_PREFIX + id);
      }
    }

    dbTask.then(function () {
      saveMasks();
      renderList();
      closeEditor();
      showToast('已保存面具');
    });
  }

  /* 删除面具 */
  function openDeleteModal() {
    if (!editingId) return;
    setExportMenuOpen(false);
    var target = masks.find(function (m) { return m.id === editingId; });
    var n = target ? target.name : '这个面具';
    deleteModalDesc.textContent = '删除「' + n + '」后将解除已绑定角色的关联，无法恢复。';
    deleteModal.classList.add('is-open');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('is-open');
  }

  function confirmDeleteMask() {
    if (!editingId) return;
    var delId = editingId;
    masks = masks.filter(function (m) { return m.id !== delId; });
    delete avatarCache[delId];
    var delTask = (window.PhoneDB && typeof window.PhoneDB.del === 'function')
      ? window.PhoneDB.del(AVATAR_PREFIX + delId)
      : Promise.resolve();
    delTask.then(function () {
      saveMasks();
      renderList();
      closeDeleteModal();
      closeEditor();
      showToast('已删除面具');
    });
  }

  /* 导入 PNG / JSON */
  function handleImportFile(file) {
    if (!file) return;
    var fname = (file.name || '').toLowerCase();
    var isPng = file.type === 'image/png' || fname.endsWith('.png');

    if (isPng) {
      Promise.all([
        file.arrayBuffer(),
        compressImageFile(file, 720)
      ]).then(function (results) {
        var buf = results[0];
        var avatarDataUrl = results[1];
        var chunks = extractPngTextChunks(buf);
        var payload = null;

        var rawStr = chunks.phone_mask || chunks.ccv3 || chunks.chara || '';
        if (rawStr) {
          try {
            payload = JSON.parse(base64ToUtf8(rawStr));
          } catch (e1) {
            try {
              payload = JSON.parse(rawStr);
            } catch (e2) {
              payload = null;
            }
          }
        }

        var norm = payload ? normalizeImportedMaskObj(payload) : null;
        if (norm) {
          var newId = genId();
          var now = Date.now();
          masks.unshift({
            id: newId,
            name: norm.name,
            gender: norm.gender,
            age: norm.age,
            setting: norm.setting,
            boundCharIds: [],
            createdAt: now,
            updatedAt: now
          });
          avatarCache[newId] = avatarDataUrl || norm.avatar || '';
          var p = (avatarCache[newId] && window.PhoneDB && window.PhoneDB.set)
            ? window.PhoneDB.set(AVATAR_PREFIX + newId, avatarCache[newId])
            : Promise.resolve();
          p.then(function () {
            saveMasks();
            renderList();
            showToast('已导入面具「' + norm.name + '」');
          });
        } else {
          openEditor(null, { avatar: avatarDataUrl });
          showToast('已载入 PNG 为头像，请补充信息');
        }
      }).catch(function () {
        showToast('PNG 读取失败');
      });
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.masks) ? parsed.masks : [parsed]);
        var added = 0;
        var tasks = [];
        list.forEach(function (item) {
          var norm = normalizeImportedMaskObj(item);
          if (!norm) return;
          var newId = genId();
          var now = Date.now();
          masks.unshift({
            id: newId,
            name: norm.name,
            gender: norm.gender,
            age: norm.age,
            setting: norm.setting,
            boundCharIds: [],
            createdAt: now,
            updatedAt: now
          });
          if (norm.avatar) {
            avatarCache[newId] = norm.avatar;
            if (window.PhoneDB && window.PhoneDB.set) {
              tasks.push(window.PhoneDB.set(AVATAR_PREFIX + newId, norm.avatar));
            }
          }
          added++;
        });
        Promise.all(tasks).then(function () {
          if (added > 0) {
            saveMasks();
            renderList();
            showToast('成功导入 ' + added + ' 个面具');
          } else {
            showToast('未识别到有效面具数据');
          }
        });
      } catch (e) {
        showToast('JSON 格式有误');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /* 导出当前面具为 JSON */
  function exportCurrentAsJson() {
    setExportMenuOpen(false);
    var payload = {
      type: 'phone_mask_v1',
      name: nameInput.value.trim() || '未命名面具',
      gender: genderInput.value.trim(),
      age: ageInput.value.trim(),
      setting: settingInput.value.trim(),
      avatar: draftAvatarDataUrl || ''
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, (payload.name || '面具') + '.json');
    showToast('已导出 JSON');
  }

  /* 导出当前面具为 PNG 卡（内嵌 phone_mask tEXt 块，可无损再导入） */
  function exportCurrentAsPng() {
    setExportMenuOpen(false);
    var payload = {
      type: 'phone_mask_v1',
      name: nameInput.value.trim() || '未命名面具',
      gender: genderInput.value.trim(),
      age: ageInput.value.trim(),
      setting: settingInput.value.trim()
    };
    var encoded = utf8ToBase64(JSON.stringify(payload));

    function buildFromCanvas(canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          showToast('PNG 生成失败');
          return;
        }
        blob.arrayBuffer().then(function (buf) {
          var outBytes = injectPngTextChunk(buf, 'phone_mask', encoded);
          var outBlob = new Blob([outBytes], { type: 'image/png' });
          triggerDownload(outBlob, (payload.name || '面具') + '-面具卡.png');
          showToast('已导出 PNG 面具卡');
        });
      }, 'image/png');
    }

    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 682;
    var ctx = canvas.getContext('2d');

    if (draftAvatarDataUrl) {
      var img = new Image();
      img.onload = function () {
        var targetRatio = canvas.width / canvas.height;
        var imgRatio = img.width / img.height;
        var sx = 0;
        var sy = 0;
        var sw = img.width;
        var sh = img.height;
        if (imgRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        buildFromCanvas(canvas);
      };
      img.onerror = function () {
        drawFallbackCard(ctx, canvas.width, canvas.height, payload.name);
        buildFromCanvas(canvas);
      };
      img.src = draftAvatarDataUrl;
    } else {
      drawFallbackCard(ctx, canvas.width, canvas.height, payload.name);
      buildFromCanvas(canvas);
    }
  }

  function drawFallbackCard(ctx, w, h, name) {
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 132px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || '面').charAt(0), w / 2, h * 0.44);
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '600 30px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(name || '面具', w / 2, h * 0.64);
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 300);
  }

  /* iOS Safari 键盘弹起适配（仅同步 height，固定 top: 0，禁用 scrollIntoView） */
  function syncEditorViewport() {
    if (!window.visualViewport || !editorEl.classList.contains('is-open')) return;
    var vv = window.visualViewport;
    editorEl.style.height = vv.height + 'px';
    window.scrollTo(0, 0);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncEditorViewport);
  }

  /* 绑定全部交互手感 */
  bindTap(homeBackBtn, function () {
    setFabOpen(false);
    screenEl.classList.remove('open');
  });

  bindTap(fabBtn, function () {
    setFabOpen(!fabOpen);
  });

  bindTap(fabScrim, function () {
    setFabOpen(false);
  });

  bindTap(addBtn, function () {
    openEditor(null);
  });

  bindTap(importBtn, function () {
    setFabOpen(false);
    importFileInput.value = '';
    importFileInput.click();
  });

  bindTap(editorBackBtn, function () {
    closeEditor();
  });

  bindTap(exportTopBtn, function () {
    setExportMenuOpen(!exportMenuOpen);
  });

  bindTap(exportPopoverMask, function () {
    setExportMenuOpen(false);
  });

  bindTap(exportPngBtn, function () {
    exportCurrentAsPng();
  });

  bindTap(exportJsonBtn, function () {
    exportCurrentAsJson();
  });

  bindTap(saveBtn, function () {
    saveCurrentMask();
  });

  bindTap(avatarPicker, function (e) {
    if (e && e.target && e.target.closest('#mskAvatarClearBtn')) return;
    avatarFileInput.value = '';
    avatarFileInput.click();
  });

  bindTap(avatarClearBtn, function () {
    draftAvatarDataUrl = '';
    draftAvatarCleared = true;
    renderEditorAvatar();
  });

  bindTap(deleteBtn, function () {
    openDeleteModal();
  });

  bindTap(deleteCancelBtn, function () {
    closeDeleteModal();
  });

  bindTap(deleteConfirmBtn, function () {
    confirmDeleteMask();
  });

  deleteModal.addEventListener('click', function (e) {
    if (e.target === deleteModal) closeDeleteModal();
  });

  avatarFileInput.addEventListener('change', function () {
    var file = avatarFileInput.files && avatarFileInput.files[0];
    if (!file) return;
    compressImageFile(file, 720).then(function (dataUrl) {
      draftAvatarDataUrl = dataUrl;
      draftAvatarCleared = false;
      renderEditorAvatar();
    }).catch(function () {
      showToast('图片处理失败');
    });
  });

  importFileInput.addEventListener('change', function () {
    var file = importFileInput.files && importFileInput.files[0];
    if (!file) return;
    handleImportFile(file);
  });

  /* 档案变更时自动刷新绑定角色列表 */
  window.addEventListener('phone-archive-updated', function () {
    charAvatarCache = {};
    renderList();
    if (editorEl.classList.contains('is-open')) {
      renderBindList();
    }
  });

  /* 打开 App 时刷新列表 */
  var screenObserver = new MutationObserver(function () {
    if (screenEl.classList.contains('open')) {
      renderList();
    } else {
      setFabOpen(false);
      setExportMenuOpen(false);
    }
  });
  screenObserver.observe(screenEl, { attributes: true, attributeFilter: ['class'] });

  renderList();

  /* 暴露全局 API 供 Chat / 线下 / 对话引擎读取 */
  window.PhoneMask = {
    getMasks: function () {
      return masks.map(function (m) {
        return {
          id: m.id,
          name: m.name,
          gender: m.gender || '',
          age: m.age,
          setting: m.setting,
          boundCharIds: Array.isArray(m.boundCharIds) ? m.boundCharIds.slice() : [],
          createdAt: m.createdAt,
          updatedAt: m.updatedAt
        };
      });
    },
    getMaskById: function (id) {
      var found = masks.find(function (m) { return m.id === id; });
      return found ? Object.assign({}, found, { gender: found.gender || '', boundCharIds: (found.boundCharIds || []).slice() }) : null;
    },
    getMaskForChar: function (charId) {
      if (!charId) return null;
      var found = masks.find(function (m) {
        return Array.isArray(m.boundCharIds) && m.boundCharIds.indexOf(charId) !== -1;
      });
      return found ? Object.assign({}, found, { gender: found.gender || '', boundCharIds: (found.boundCharIds || []).slice() }) : null;
    },
    getMaskAvatar: function (id) {
      return fetchMaskAvatar(id);
    },
    open: function () {
      screenEl.classList.add('open');
    },
    close: function () {
      closeEditor();
      screenEl.classList.remove('open');
    }
  };
})();
