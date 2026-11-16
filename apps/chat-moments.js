/* =========================================================
   Chat 朋友圈页（仿微信朋友圈独立模块，顺滑交互 + 全球真实地址定位/搜索）
   - 不改动 apps/chat.js / apps/chat.css，独立接管朋友圈 tab
   ========================================================= */
(function () {
  var STORAGE_MOMENTS_KEY = 'chat_moments_v1';
  var DB_COVER_KEY = 'moments_cover';

  var SVG_CAMERA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3L7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z"/></svg>';
  var SVG_HEART = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  var SVG_HEART_FILL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  var SVG_COMMENT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var SVG_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var rendering = false;
  var coverUrl = '';
  var coverLoaded = false;
  var coverBusy = false;
  var openPopId = '';
  var commentTargetId = '';

  var draftImages = [];
  var draftLocation = '';
  var draftMentionIds = [];
  var draftVisibility = '公开';
  var draftPartialIds = [];

  var pickerMode = '';
  var pickerKeyword = '';
  var tempIds = [];

  var geoStatusText = '点击获取当前真实位置';
  var geoPlaces = [];
  var searchPlaces = [];
  var searchTimer = null;

  function loadPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_MOMENTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function savePosts(list) {
    try {
      localStorage.setItem(STORAGE_MOMENTS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(ts) {
    if (!ts) return '刚刚';
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function getContacts() {
    var chars = [];
    var ids = [];
    try {
      if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
        chars = window.PhoneArchive.getChars() || [];
      }
      if (window.PhoneChat && typeof window.PhoneChat.getContactIds === 'function') {
        ids = window.PhoneChat.getContactIds() || [];
      }
    } catch (e) {}
    var idSet = new Set(ids);
    return chars.filter(function (c) { return idSet.has(c.id); });
  }

  function getCharName(c) {
    return (c && (c.name || c.nickname)) || '未命名';
  }

  function getCharAvHtml(c) {
    var name = getCharName(c);
    var fb = (c && c.id === 'assistant-shuixiaojiu') ? '九' : name.slice(0, 1);
    var av = '';
    try {
      if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
        av = window.PhoneArchive.getCharAvatar(c.id) || '';
      }
    } catch (e) {}
    if (!av && c && c.avatar) av = c.avatar;
    if (av) {
      return '<div class="ctm-pick-av"><img src="' + escapeHtml(av) + '" onerror="this.parentNode.textContent=\'' + escapeHtml(fb) + '\'" alt=""></div>';
    }
    return '<div class="ctm-pick-av">' + escapeHtml(fb) + '</div>';
  }

  function compressPhoto(file, maxSide, quality) {
    var limit = maxSide || 800;
    var q = quality || 0.78;
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

  function applyCoverToDom(url) {
    var area = document.getElementById('ctmCoverArea');
    var imgEl = document.getElementById('ctmCoverImg');
    if (!area || !imgEl) return;
    if (url) {
      imgEl.src = url;
      area.classList.add('has-cover');
    } else {
      imgEl.removeAttribute('src');
      area.classList.remove('has-cover');
    }
  }

  function isMomentsTabActive() {
    var tab = document.querySelector('#app-chat .ct-tab-btn[data-tab="moments"]');
    return !!(tab && tab.classList.contains('active'));
  }

  function ensureUI() {
    var appEl = document.querySelector('#app-chat .ct-app');
    if (!appEl || document.getElementById('ctmComposeView')) return;

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="ctm-compose" id="ctmComposeView">' +
        '<div class="ctm-compose-head">' +
          '<button class="ctm-compose-cancel" id="ctmComposeCancel">取消</button>' +
          '<div class="ctm-compose-title">发表动态</div>' +
          '<button class="ctm-compose-send" id="ctmComposeSend">发表</button>' +
        '</div>' +
        '<div class="ctm-compose-body">' +
          '<textarea class="ctm-compose-textarea" id="ctmComposeText" placeholder="这一刻的想法..."></textarea>' +
          '<div class="ctm-compose-imgs" id="ctmComposeImgs"></div>' +
          '<div class="ctm-compose-opts">' +
            '<div class="ctm-opt-row" id="ctmOptLocation">' +
              '<div class="ctm-opt-left">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '<span>所在位置</span>' +
              '</div>' +
              '<div class="ctm-opt-right"><span class="ctm-opt-val" id="ctmOptLocVal"></span><span>›</span></div>' +
            '</div>' +
            '<div class="ctm-opt-row" id="ctmOptMention">' +
              '<div class="ctm-opt-left">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>' +
                '<span>提醒谁看</span>' +
              '</div>' +
              '<div class="ctm-opt-right"><span class="ctm-opt-val" id="ctmOptMentionVal"></span><span>›</span></div>' +
            '</div>' +
            '<div class="ctm-opt-row" id="ctmOptVisibility">' +
              '<div class="ctm-opt-left">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '<span>谁可以看</span>' +
              '</div>' +
              '<div class="ctm-opt-right"><span class="ctm-opt-val" id="ctmOptVisVal">公开</span><span>›</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctm-picker" id="ctmPickerView">' +
        '<div class="ctm-picker-head">' +
          '<button class="ctm-picker-btn left" id="ctmPickerCancel">取消</button>' +
          '<div class="ctm-picker-title" id="ctmPickerTitle"></div>' +
          '<button class="ctm-picker-btn primary" id="ctmPickerDone">确定</button>' +
        '</div>' +
        '<div class="ctm-picker-search" id="ctmPickerSearchBox" style="display:none;">' +
          '<input id="ctmPickerSearchInput" placeholder="搜索全球城市、街道或地点">' +
        '</div>' +
        '<div class="ctm-picker-list" id="ctmPickerList"></div>' +
      '</div>' +
      '<div class="ctm-comment-bar" id="ctmCommentBar">' +
        '<input class="ctm-comment-input" id="ctmCommentInput" placeholder="评论">' +
        '<button class="ctm-comment-send" id="ctmCommentSend">发送</button>' +
      '</div>' +
      '<input type="file" id="ctmCoverInput" accept="image/*" style="display:none;">' +
      '<input type="file" id="ctmPostImgInput" accept="image/*" multiple style="display:none;">';

    while (wrap.firstChild) {
      appEl.appendChild(wrap.firstChild);
    }

    bindStaticEvents();
  }

  function formatNomPlace(item) {
    if (!item) return null;
    var addr = item.address || {};
    var city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
    var country = addr.country || '';
    var shortName = item.name || addr.road || addr.suburb || addr.neighbourhood || city || '';
    var sub = [city, addr.state, country].filter(Boolean).filter(function (v, i, a) {
      return a.indexOf(v) === i && v !== shortName;
    }).join(' · ');
    return {
      title: shortName || (item.display_name ? item.display_name.split(',')[0] : ''),
      sub: sub || item.display_name || ''
    };
  }

  function requestRealGeolocation() {
    if (!navigator.geolocation) {
      geoStatusText = '当前浏览器不支持定位，请直接搜索地点';
      if (pickerMode === 'location') renderPickerList();
      return;
    }
    geoStatusText = '正在获取当前真实位置...';
    if (pickerMode === 'location') renderPickerList();

    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude;
      var lon = pos.coords.longitude;
      var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon + '&addressdetails=1&accept-language=zh-CN,en';
      fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        var addr = (data && data.address) || {};
        var city = addr.city || addr.town || addr.county || addr.state || '';
        var country = addr.country || '';
        var list = [];
        if (addr.neighbourhood || addr.suburb || addr.road) {
          var detail = [city, addr.suburb || addr.neighbourhood || addr.road].filter(Boolean).join(' · ');
          list.push({ title: detail, sub: country });
        }
        if (city) {
          list.push({ title: city + (country ? ' · ' + country : ''), sub: '当前所在城市' });
        }
        if (!list.length && data && data.display_name) {
          list.push({ title: data.display_name.split(',').slice(0, 2).join(', '), sub: data.display_name });
        }
        geoPlaces = list;
        geoStatusText = list.length ? '已定位（点击重新获取）' : '未解析到地址，可搜索全球地点';
        if (pickerMode === 'location') renderPickerList();
      }).catch(function () {
        geoStatusText = '位置解析失败，请直接搜索地点';
        if (pickerMode === 'location') renderPickerList();
      });
    }, function () {
      geoStatusText = '未允许定位权限，可直接在上方搜索全球地点';
      if (pickerMode === 'location') renderPickerList();
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  }

  function searchWorldPlaces(q) {
    var kw = (q || '').trim();
    if (!kw) {
      searchPlaces = [];
      if (pickerMode === 'location') renderPickerList();
      return;
    }
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=' + encodeURIComponent(kw) + '&limit=10&addressdetails=1&accept-language=zh-CN,en';
    fetch(url).then(function (r) { return r.json(); }).then(function (arr) {
      if (pickerKeyword.trim() !== kw) return;
      searchPlaces = (Array.isArray(arr) ? arr : []).map(formatNomPlace).filter(function (x) { return x && x.title; });
      if (pickerMode === 'location') renderPickerList();
    }).catch(function () {
      searchPlaces = [];
      if (pickerMode === 'location') renderPickerList();
    });
  }

  function syncOptLabels() {
    var contacts = getContacts();
    var locEl = document.getElementById('ctmOptLocVal');
    var menEl = document.getElementById('ctmOptMentionVal');
    var visEl = document.getElementById('ctmOptVisVal');

    if (locEl) locEl.textContent = draftLocation || '';

    if (menEl) {
      var mNames = draftMentionIds.map(function (id) {
        var c = contacts.find(function (item) { return item.id === id; });
        return c ? getCharName(c) : '';
      }).filter(Boolean);
      menEl.textContent = mNames.join('、');
    }

    if (visEl) {
      if (draftVisibility === '部分') {
        var pNames = draftPartialIds.map(function (id) {
          var c = contacts.find(function (item) { return item.id === id; });
          return c ? getCharName(c) : '';
        }).filter(Boolean);
        visEl.textContent = pNames.length ? ('部分（' + pNames.slice(0, 2).join('、') + (pNames.length > 2 ? '等' : '') + '）') : '部分';
      } else {
        visEl.textContent = draftVisibility;
      }
    }
  }

  function syncSendBtn() {
    var txt = (document.getElementById('ctmComposeText').value || '').trim();
    var btn = document.getElementById('ctmComposeSend');
    if (btn) btn.classList.toggle('ready', txt.length > 0 || draftImages.length > 0);
  }

  function renderDraftImages() {
    var box = document.getElementById('ctmComposeImgs');
    if (!box) return;
    var html = draftImages.map(function (src, idx) {
      return '<div class="ctm-compose-thumb">' +
        '<img src="' + escapeHtml(src) + '" alt="">' +
        '<span class="ctm-compose-img-del" data-del-img="' + idx + '">×</span>' +
      '</div>';
    }).join('');
    if (draftImages.length < 9) {
      html += '<div class="ctm-compose-add" id="ctmAddPostImg">+</div>';
    }
    box.innerHTML = html;
    syncSendBtn();
  }

  function openComposer() {
    ensureUI();
    draftImages = [];
    draftLocation = '';
    draftMentionIds = [];
    draftVisibility = '公开';
    draftPartialIds = [];
    document.getElementById('ctmComposeText').value = '';
    syncOptLabels();
    renderDraftImages();
    document.getElementById('ctmComposeView').classList.add('open');
  }

  function openPicker(mode) {
    pickerMode = mode;
    pickerKeyword = '';
    searchPlaces = [];
    var titleEl = document.getElementById('ctmPickerTitle');
    var doneBtn = document.getElementById('ctmPickerDone');
    var searchBox = document.getElementById('ctmPickerSearchBox');
    var searchInput = document.getElementById('ctmPickerSearchInput');

    searchInput.value = '';

    if (mode === 'location') {
      titleEl.textContent = '所在位置';
      doneBtn.style.display = 'none';
      searchBox.style.display = 'block';
      if (!geoPlaces.length) requestRealGeolocation();
    } else if (mode === 'mention') {
      titleEl.textContent = '提醒谁看';
      doneBtn.style.display = 'block';
      searchBox.style.display = 'none';
      tempIds = draftMentionIds.slice();
    } else if (mode === 'visibility') {
      titleEl.textContent = '谁可以看';
      doneBtn.style.display = 'none';
      searchBox.style.display = 'none';
    } else if (mode === 'partial') {
      titleEl.textContent = '选择可见联系人';
      doneBtn.style.display = 'block';
      searchBox.style.display = 'none';
      tempIds = draftPartialIds.slice();
    }

    renderPickerList();
    document.getElementById('ctmPickerView').classList.add('open');
  }

  function renderPickerList() {
    var listEl = document.getElementById('ctmPickerList');
    if (!listEl) return;

    if (pickerMode === 'location') {
      var kw = pickerKeyword.trim();
      var html =
        '<div class="ctm-pick-row" data-pick-loc="">' +
          '<div class="ctm-pick-main"><div class="ctm-pick-title">不显示位置</div></div>' +
          '<div class="ctm-pick-check ' + (!draftLocation ? 'on' : '') + '">' + (!draftLocation ? SVG_CHECK : '') + '</div>' +
        '</div>' +
        '<div class="ctm-pick-row" id="ctmLocateNowRow">' +
          '<div class="ctm-pick-main">' +
            '<div class="ctm-pick-title">定位当前真实位置</div>' +
            '<div class="ctm-pick-sub">' + escapeHtml(geoStatusText) + '</div>' +
          '</div>' +
        '</div>';

      var places = kw ? searchPlaces : geoPlaces;
      places.forEach(function (pl) {
        var on = draftLocation === pl.title;
        html +=
          '<div class="ctm-pick-row" data-pick-loc="' + escapeHtml(pl.title) + '">' +
            '<div class="ctm-pick-main">' +
              '<div class="ctm-pick-title">' + escapeHtml(pl.title) + '</div>' +
              (pl.sub ? '<div class="ctm-pick-sub">' + escapeHtml(pl.sub) + '</div>' : '') +
            '</div>' +
            '<div class="ctm-pick-check ' + (on ? 'on' : '') + '">' + (on ? SVG_CHECK : '') + '</div>' +
          '</div>';
      });

      if (kw) {
        html +=
          '<div class="ctm-pick-row" data-pick-loc="' + escapeHtml(kw) + '">' +
            '<div class="ctm-pick-main"><div class="ctm-pick-title">直接使用「' + escapeHtml(kw) + '」</div></div>' +
          '</div>';
      }

      listEl.innerHTML = html;
      return;
    }

    if (pickerMode === 'visibility') {
      var opts = [
        { key: '公开', title: '公开', sub: '所有联系人可见' },
        { key: '私密', title: '私密', sub: '仅自己可见' },
        { key: '部分', title: '部分可见', sub: '选中的联系人可见' }
      ];
      listEl.innerHTML = opts.map(function (o) {
        var on = draftVisibility === o.key;
        return '<div class="ctm-pick-row" data-pick-vis="' + o.key + '">' +
          '<div class="ctm-pick-main">' +
            '<div class="ctm-pick-title">' + o.title + '</div>' +
            '<div class="ctm-pick-sub">' + o.sub + '</div>' +
          '</div>' +
          '<div class="ctm-pick-check ' + (on ? 'on' : '') + '">' + (on ? SVG_CHECK : '') + '</div>' +
        '</div>';
      }).join('');
      return;
    }

    var contacts = getContacts();
    if (!contacts.length) {
      listEl.innerHTML = '<div class="ctm-empty">还没有联系人，先去「联系人」页添加吧</div>';
      return;
    }

    listEl.innerHTML = contacts.map(function (c) {
      var on = tempIds.indexOf(c.id) !== -1;
      return '<div class="ctm-pick-row" data-pick-contact="' + escapeHtml(c.id) + '">' +
        '<div class="ctm-pick-left">' +
          getCharAvHtml(c) +
          '<div class="ctm-pick-main"><div class="ctm-pick-title">' + escapeHtml(getCharName(c)) + '</div></div>' +
        '</div>' +
        '<div class="ctm-pick-check ' + (on ? 'on' : '') + '">' + (on ? SVG_CHECK : '') + '</div>' +
      '</div>';
    }).join('');
  }

  function bindStaticEvents() {
    document.getElementById('ctmComposeCancel').addEventListener('click', function () {
      document.getElementById('ctmComposeView').classList.remove('open');
    });

    document.getElementById('ctmComposeText').addEventListener('input', syncSendBtn);

    document.getElementById('ctmComposeImgs').addEventListener('click', function (e) {
      var delIdx = e.target.getAttribute('data-del-img');
      if (delIdx !== null) {
        draftImages.splice(Number(delIdx), 1);
        renderDraftImages();
        return;
      }
      if (e.target.id === 'ctmAddPostImg') {
        document.getElementById('ctmPostImgInput').click();
      }
    });

    document.getElementById('ctmPostImgInput').addEventListener('change', function () {
      var inputEl = this;
      var files = Array.prototype.slice.call(inputEl.files || []).slice(0, 9 - draftImages.length);
      if (!files.length) {
        inputEl.value = '';
        return;
      }
      setTimeout(function () {
        Promise.all(files.map(function (f) { return compressPhoto(f, 800, 0.76); })).then(function (urls) {
          inputEl.value = '';
          urls.forEach(function (u) {
            if (u && draftImages.length < 9) draftImages.push(u);
          });
          renderDraftImages();
        });
      }, 320);
    });

    document.getElementById('ctmOptLocation').addEventListener('click', function () {
      openPicker('location');
    });
    document.getElementById('ctmOptMention').addEventListener('click', function () {
      openPicker('mention');
    });
    document.getElementById('ctmOptVisibility').addEventListener('click', function () {
      openPicker('visibility');
    });

    document.getElementById('ctmPickerCancel').addEventListener('click', function () {
      document.getElementById('ctmPickerView').classList.remove('open');
    });

    document.getElementById('ctmPickerDone').addEventListener('click', function () {
      if (pickerMode === 'mention') {
        draftMentionIds = tempIds.slice();
      } else if (pickerMode === 'partial') {
        draftVisibility = tempIds.length ? '部分' : '公开';
        draftPartialIds = tempIds.slice();
      }
      syncOptLabels();
      document.getElementById('ctmPickerView').classList.remove('open');
    });

    document.getElementById('ctmPickerSearchInput').addEventListener('input', function (e) {
      pickerKeyword = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchWorldPlaces(pickerKeyword);
      }, 360);
      renderPickerList();
    });

    document.getElementById('ctmPickerList').addEventListener('click', function (e) {
      if (e.target.closest('#ctmLocateNowRow')) {
        requestRealGeolocation();
        return;
      }

      var locRow = e.target.closest('[data-pick-loc]');
      if (locRow) {
        draftLocation = locRow.getAttribute('data-pick-loc') || '';
        syncOptLabels();
        document.getElementById('ctmPickerView').classList.remove('open');
        return;
      }

      var visRow = e.target.closest('[data-pick-vis]');
      if (visRow) {
        var v = visRow.getAttribute('data-pick-vis');
        if (v === '部分') {
          openPicker('partial');
          return;
        }
        draftVisibility = v;
        draftPartialIds = [];
        syncOptLabels();
        document.getElementById('ctmPickerView').classList.remove('open');
        return;
      }

      var cRow = e.target.closest('[data-pick-contact]');
      if (cRow) {
        var cid = cRow.getAttribute('data-pick-contact');
        var idx = tempIds.indexOf(cid);
        if (idx === -1) tempIds.push(cid);
        else tempIds.splice(idx, 1);
        renderPickerList();
      }
    });

    document.getElementById('ctmComposeSend').addEventListener('click', function () {
      var text = (document.getElementById('ctmComposeText').value || '').trim();
      if (!text && !draftImages.length) return;
      var posts = loadPosts();
      posts.unshift({
        id: 'mom-' + Date.now(),
        sender: 'me',
        authorName: '我',
        text: text,
        images: draftImages.slice(),
        location: draftLocation,
        mentionIds: draftMentionIds.slice(),
        visibility: draftVisibility,
        partialIds: draftPartialIds.slice(),
        likes: [],
        comments: [],
        time: Date.now()
      });
      savePosts(posts);
      document.getElementById('ctmComposeView').classList.remove('open');
      renderMoments();
    });

    document.getElementById('ctmCoverInput').addEventListener('change', function () {
      var inputEl = this;
      var file = inputEl.files && inputEl.files[0];
      if (!file) {
        inputEl.value = '';
        coverBusy = false;
        return;
      }
      // 等 iOS 原生选图菜单完全收起后再异步压缩和绘制，避免卡死
      setTimeout(function () {
        compressPhoto(file, 800, 0.76).then(function (url) {
          inputEl.value = '';
          coverBusy = false;
          if (!url) return;
          coverUrl = url;
          applyCoverToDom(url);
          setTimeout(function () {
            if (window.PhoneDB) PhoneDB.set(DB_COVER_KEY, url);
          }, 80);
        });
      }, 320);
    });

    var commentInput = document.getElementById('ctmCommentInput');
    function submitComment() {
      var txt = (commentInput.value || '').trim();
      if (!txt || !commentTargetId) {
        document.getElementById('ctmCommentBar').classList.remove('open');
        commentTargetId = '';
        return;
      }
      var posts = loadPosts();
      var target = posts.find(function (p) { return p.id === commentTargetId; });
      if (target) {
        if (!Array.isArray(target.comments)) target.comments = [];
        target.comments.push({ author: '我', text: txt });
        savePosts(posts);
      }
      commentInput.value = '';
      commentTargetId = '';
      document.getElementById('ctmCommentBar').classList.remove('open');
      renderMoments();
    }

    document.getElementById('ctmCommentSend').addEventListener('click', submitComment);
    commentInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitComment();
    });
    commentInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (!commentInput.value.trim()) {
          document.getElementById('ctmCommentBar').classList.remove('open');
          commentTargetId = '';
        }
      }, 150);
    });
  }

  function renderMoments() {
    var appEl = document.querySelector('#app-chat .ct-app');
    var scroll = document.getElementById('ctMainScroll');
    if (!appEl || !scroll) return;

    ensureUI();

    if (!isMomentsTabActive()) {
      appEl.classList.remove('is-moments-tab');
      var bar = document.getElementById('ctmCommentBar');
      if (bar) bar.classList.remove('open');
      return;
    }

    appEl.classList.add('is-moments-tab');
    rendering = true;

    if (!coverLoaded && window.PhoneDB) {
      coverLoaded = true;
      PhoneDB.get(DB_COVER_KEY).then(function (val) {
        if (val) {
          coverUrl = val;
          applyCoverToDom(val);
        }
      });
    }

    var posts = loadPosts();
    var feedHtml = '';
    if (!posts.length) {
      feedHtml = '<div class="ctm-empty">还没有动态<br>点右上角相机图标发一条朋友圈吧</div>';
    } else {
      feedHtml = posts.map(function (p) {
        var isMe = p.sender === 'me';
        var imgs = Array.isArray(p.images) ? p.images : [];
        var imgsHtml = '';
        if (imgs.length) {
          imgsHtml = '<div class="ctm-post-imgs ' + (imgs.length === 1 ? 'is-single' : '') + '">' +
            imgs.map(function (src) {
              return '<img class="ctm-post-img" decoding="async" src="' + escapeHtml(src) + '" alt="">';
            }).join('') +
          '</div>';
        }
        var likes = Array.isArray(p.likes) ? p.likes : [];
        var comments = Array.isArray(p.comments) ? p.comments : [];
        var hasLiked = likes.indexOf('我') !== -1;

        var socialHtml = '';
        if (likes.length || comments.length) {
          socialHtml = '<div class="ctm-social-box">';
          if (likes.length) {
            socialHtml += '<div class="ctm-likes-row">' + SVG_HEART + '<span>' + escapeHtml(likes.join('，')) + '</span></div>';
          }
          if (comments.length) {
            socialHtml += '<div class="ctm-comments-list">' + comments.map(function (cm) {
              return '<div class="ctm-comment-item"><span class="ctm-comment-name">' + escapeHtml(cm.author) + '：</span>' + escapeHtml(cm.text) + '</div>';
            }).join('') + '</div>';
          }
          socialHtml += '</div>';
        }

        var avText = escapeHtml((p.authorName || '我').slice(0, 1));
        var avHtml = p.avatar
          ? '<div class="ctm-post-avatar"><img src="' + escapeHtml(p.avatar) + '" alt=""></div>'
          : '<div class="ctm-post-avatar">' + avText + '</div>';

        var visBadge = '';
        if (p.visibility === '私密') visBadge = '<span>仅自己可见</span>';
        else if (p.visibility === '部分') visBadge = '<span>部分可见</span>';

        return '<div class="ctm-post" data-post-id="' + escapeHtml(p.id) + '">' +
          avHtml +
          '<div class="ctm-post-body">' +
            '<div class="ctm-post-author">' + escapeHtml(p.authorName || '我') + '</div>' +
            (p.text ? '<div class="ctm-post-text">' + escapeHtml(p.text) + '</div>' : '') +
            imgsHtml +
            (p.location ? '<div class="ctm-post-loc">' + escapeHtml(p.location) + '</div>' : '') +
            '<div class="ctm-post-meta">' +
              '<div class="ctm-post-meta-left">' +
                '<span>' + escapeHtml(formatTime(p.time)) + '</span>' +
                visBadge +
                (isMe ? '<span class="ctm-post-del" data-del-post="' + escapeHtml(p.id) + '">删除</span>' : '') +
              '</div>' +
              '<button class="ctm-more-btn" data-pop-btn="' + escapeHtml(p.id) + '" aria-label="操作">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/></svg>' +
              '</button>' +
              '<div class="ctm-action-pop ' + (openPopId === p.id ? 'open' : '') + '">' +
                '<button class="ctm-pop-btn ' + (hasLiked ? 'is-liked' : '') + '" data-like-post="' + escapeHtml(p.id) + '" aria-label="点赞">' + (hasLiked ? SVG_HEART_FILL : SVG_HEART) + '</button>' +
                '<div class="ctm-pop-sep"></div>' +
                '<button class="ctm-pop-btn" data-comment-post="' + escapeHtml(p.id) + '" aria-label="评论">' + SVG_COMMENT + '</button>' +
              '</div>' +
            '</div>' +
            socialHtml +
          '</div>' +
        '</div>';
      }).join('');
    }

    var coverCls = 'ctm-cover-area' + (coverUrl ? ' has-cover' : '');
    var coverImgAttr = coverUrl ? ' src="' + escapeHtml(coverUrl) + '"' : '';

    scroll.innerHTML =
      '<div class="ctm-wrap">' +
        '<div class="' + coverCls + '" id="ctmCoverArea">' +
          '<img class="ctm-cover-img" id="ctmCoverImg" decoding="async" alt=""' + coverImgAttr + '>' +
          '<div class="ctm-cover-hint">点击更换封面</div>' +
          '<button class="ctm-camera-btn" id="ctmCameraBtn" aria-label="发朋友圈">' + SVG_CAMERA + '</button>' +
        '</div>' +
        '<div class="ctm-me-corner">' +
          '<div class="ctm-me-name">我</div>' +
          '<div class="ctm-me-avatar">我</div>' +
        '</div>' +
        '<div class="ctm-feed">' + feedHtml + '</div>' +
      '</div>';

    bindMomentsEvents();
    rendering = false;
  }

  function bindMomentsEvents() {
    var coverArea = document.getElementById('ctmCoverArea');
    var cameraBtn = document.getElementById('ctmCameraBtn');
    var wrap = document.querySelector('#ctMainScroll .ctm-wrap');

    if (cameraBtn) {
      cameraBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openComposer();
      });
    }

    if (coverArea) {
      coverArea.addEventListener('click', function () {
        if (coverBusy) return;
        coverBusy = true;
        setTimeout(function () { coverBusy = false; }, 1200);
        document.getElementById('ctmCoverInput').click();
      });
    }

    if (wrap) {
      wrap.addEventListener('click', function (e) {
        var popBtn = e.target.closest('[data-pop-btn]');
        if (popBtn) {
          e.stopPropagation();
          var pid = popBtn.getAttribute('data-pop-btn');
          openPopId = (openPopId === pid) ? '' : pid;
          wrap.querySelectorAll('.ctm-action-pop').forEach(function (el) {
            var postEl = el.closest('[data-post-id]');
            el.classList.toggle('open', !!(postEl && postEl.getAttribute('data-post-id') === openPopId));
          });
          return;
        }

        var likeBtn = e.target.closest('[data-like-post]');
        if (likeBtn) {
          e.stopPropagation();
          var lid = likeBtn.getAttribute('data-like-post');
          var posts = loadPosts();
          var target = posts.find(function (p) { return p.id === lid; });
          if (target) {
            if (!Array.isArray(target.likes)) target.likes = [];
            var idx = target.likes.indexOf('我');
            if (idx === -1) target.likes.push('我');
            else target.likes.splice(idx, 1);
            savePosts(posts);
          }
          openPopId = '';
          renderMoments();
          return;
        }

        var cmtBtn = e.target.closest('[data-comment-post]');
        if (cmtBtn) {
          e.stopPropagation();
          commentTargetId = cmtBtn.getAttribute('data-comment-post');
          openPopId = '';
          wrap.querySelectorAll('.ctm-action-pop.open').forEach(function (el) { el.classList.remove('open'); });
          var bar = document.getElementById('ctmCommentBar');
          var inp = document.getElementById('ctmCommentInput');
          if (bar && inp) {
            bar.classList.add('open');
            inp.value = '';
            inp.focus();
          }
          return;
        }

        var delBtn = e.target.closest('[data-del-post]');
        if (delBtn) {
          e.stopPropagation();
          var did = delBtn.getAttribute('data-del-post');
          if (!confirm('删除这条动态？')) return;
          var next = loadPosts().filter(function (p) { return p.id !== did; });
          savePosts(next);
          renderMoments();
          return;
        }

        if (openPopId) {
          openPopId = '';
          wrap.querySelectorAll('.ctm-action-pop.open').forEach(function (el) { el.classList.remove('open'); });
        }
      });
    }
  }

  function init() {
    var scroll = document.getElementById('ctMainScroll');
    if (!scroll) return;
    var observer = new MutationObserver(function () {
      if (rendering) return;
      if (isMomentsTabActive()) {
        if (!scroll.querySelector('.ctm-wrap')) renderMoments();
      } else {
        var appEl = document.querySelector('#app-chat .ct-app');
        if (appEl) appEl.classList.remove('is-moments-tab');
      }
    });
    observer.observe(scroll, { childList: true });
    renderMoments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
