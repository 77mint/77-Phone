/* =========================================================
   Chat 输入扩展面板 & 发照片模块（独立模块化，不修改 chat.js）
   - 接管 #ctRoomPlusBtn，目前只放「照片」（支持单图 + 多图合并叠卡）
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';

  var SVG_PHOTO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM6 17h12l-3.8-5-2.9 3.6-2-2.4L6 17zm2.5-7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';
  var SVG_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var drawerOpen = false;
  var activeThreadId = '';
  var expandedBundles = {};
  var pendingPhotos = [];
  var mergePhotos = true;
  var photoBusy = false;

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

  function appendPhotoMessage(type, images) {
    var tid = resolveCurrentThreadId();
    if (!tid || !images || !images.length) return;
    var nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    var msgId = 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    msgs.push({
      id: msgId,
      sender: 'me',
      type: type,
      images: images.slice(),
      text: '[图片]',
      time: nowTime
    });
    saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);

    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var idx = threads.findIndex(function (t) { return t.id === tid; });
    if (idx !== -1) {
      threads[idx].lastMsg = '[图片]';
      threads[idx].lastTime = nowTime;
      saveJSON(STORAGE_THREADS_KEY, threads);
    }

    appendBubbleToDom(msgId, type, images);
  }

  function appendBubbleToDom(msgId, type, images) {
    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    var empty = box.querySelector('.ct-empty');
    if (empty) empty.remove();

    var group = document.createElement('div');
    group.className = 'ct-msg-group me';
    group.setAttribute('data-msg-id', msgId);
    group.setAttribute('data-sender-name', '我');
    group.innerHTML =
      '<div class="ct-msg-row me">' +
        '<div class="ct-msg-avatar">我</div>' +
        '<div class="ct-msg-bubble"></div>' +
      '</div>';
    box.appendChild(group);
    renderBubbleEl(group.querySelector('.ct-msg-bubble'), {
      id: msgId,
      type: type,
      images: images
    });
    box.scrollTop = box.scrollHeight;
  }

  function renderBubbleEl(bubble, msg) {
    if (!bubble || !msg) return;
    var imgs = Array.isArray(msg.images) ? msg.images : [];
    if (!imgs.length) return;

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
      var gridCls = 'ctp-bundle-grid' + (imgs.length <= 4 ? ' cols-2' : '');
      var gridHtml = imgs.map(function (src) {
        return '<img class="ctp-bundle-grid-img" decoding="async" data-ctp-preview="' + escapeHtml(src) + '" src="' + escapeHtml(src) + '" alt="">';
      }).join('');
      bubble.innerHTML =
        '<div class="ctp-bundle-row">' +
          '<button class="ctp-expand-pill" data-ctp-toggle="' + escapeHtml(msg.id) + '">收起</button>' +
          '<div class="' + gridCls + '">' + gridHtml + '</div>' +
        '</div>';
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
      if (!m || (m.type !== 'image' && m.type !== 'image_bundle')) return;
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
    if (checkEl) checkEl.classList.add('on');
    if (sendEl) sendEl.textContent = '发送 (' + pendingPhotos.length + ')';
    document.getElementById('ctpMultiMask').classList.add('open');
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
      '</div>';
    room.appendChild(drawer);

    var extra = document.createElement('div');
    extra.innerHTML =
      '<input type="file" id="ctpPhotoInput" accept="image/*" multiple style="display:none;">' +
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
            appendPhotoMessage('image', valid);
          } else {
            openMultiSheet(valid);
          }
        });
      }, 320);
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
        appendPhotoMessage('image_bundle', list);
      } else {
        list.forEach(function (src) { appendPhotoMessage('image', [src]); });
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
