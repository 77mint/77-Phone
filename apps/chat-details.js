/* apps/chat-details.js - 微信 Chat 聊天室右上角「···」详情页（全局 #f2f2f7 + 真·实时感知 + 独立世界书页） */
(function () {
  'use strict';

  var SETTINGS_KEY = 'chat_thread_settings_v1';
  var THREADS_KEY = 'chat_threads_v1';
  var MSGS_PREFIX = 'chat_msgs_v1_';
  var REAL_CTX_KEY = 'phone_real_context_cache_v1';

  // 1:1 复刻 IMG_2079.png：顶部小环 + 微撇轮廓铃铛 + 底部小铃舌 + 左上到右下斜杠
  var SVG_MUTE_BELL =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.8 4.4a1.2 1.2 0 0 1 2.4 0"/>' +
      '<path d="M16.2 11.4c0-3.2-1.8-5.4-4.2-5.4-1.1 0-2 .4-2.7 1.1"/>' +
      '<path d="M7.8 11.4v1c0 2.2-.6 3.7-1.6 4.7h11.6c-1-1-1.6-2.5-1.6-4.7v-1"/>' +
      '<path d="M10.9 18.2a1.1 1.1 0 0 0 2.2 0"/>' +
      '<line x1="3.8" y1="4.5" x2="20.2" y2="20.5"/>' +
    '</svg>';

  var activeThreadId = null;
  var lastContactId = null;
  var detailsEl = null;
  var searchEl = null;
  var loreEl = null;

  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var selectedDateStr = '';
  var calendarCollapsed = false;
  var syncingBell = false;
  var fetchingReal = false;

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

  function defaultSettings() {
    return {
      pinned: false,
      muted: false,
      hasBg: false,
      realTime: false,
      realWeather: false,
      realLocation: false,
      loreOverride: false,
      loreIds: []
    };
  }

  function getAllSettings() {
    return loadJSON(SETTINGS_KEY, {});
  }

  function getThreadSettings(threadId) {
    var all = getAllSettings();
    var s = Object.assign(defaultSettings(), all[threadId] || {});
    if (!Array.isArray(s.loreIds)) s.loreIds = [];
    return s;
  }

  function setThreadSettings(threadId, patch) {
    if (!threadId) return;
    var all = getAllSettings();
    var merged = Object.assign(defaultSettings(), all[threadId] || {}, patch);
    if (!Array.isArray(merged.loreIds)) merged.loreIds = [];
    all[threadId] = merged;
    saveJSON(SETTINGS_KEY, all);
  }

  function getRealCache() {
    return loadJSON(REAL_CTX_KEY, {
      location: '',
      weather: '',
      lat: null,
      lon: null,
      updatedAt: 0
    });
  }

  function wmoToText(code) {
    var c = Number(code);
    if (c === 0) return '晴';
    if (c === 1 || c === 2) return '多云';
    if (c === 3) return '阴';
    if (c === 45 || c === 48) return '雾';
    if (c >= 51 && c <= 67) return '雨';
    if (c >= 71 && c <= 77) return '雪';
    if (c >= 80 && c <= 82) return '阵雨';
    if (c >= 95) return '雷阵雨';
    return '多云';
  }

  function fetchCoords() {
    return new Promise(function (resolve) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            resolve({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              fromGps: true
            });
          },
          function () {
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        );
      } else {
        resolve(null);
      }
    }).then(function (gps) {
      if (gps) return gps;
      return fetch('https://get.geojs.io/v1/ip/geo.json')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.latitude && d.longitude) {
            return {
              lat: parseFloat(d.latitude),
              lon: parseFloat(d.longitude),
              city: d.city || d.region || d.country || ''
            };
          }
          return null;
        })
        .catch(function () { return null; });
    });
  }

  function refreshRealContext(force) {
    var cache = getRealCache();
    var fresh = cache.updatedAt && (Date.now() - cache.updatedAt < 600000);
    if (!force && fresh && cache.location && cache.weather) {
      return Promise.resolve(cache);
    }
    if (fetchingReal) return Promise.resolve(cache);
    fetchingReal = true;

    return fetchCoords().then(function (coords) {
      if (!coords) throw new Error('无法获取定位');
      var locPromise = coords.city
        ? Promise.resolve(coords.city)
        : fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + encodeURIComponent(coords.lat) + '&longitude=' + encodeURIComponent(coords.lon) + '&localityLanguage=zh')
            .then(function (r) { return r.json(); })
            .then(function (g) {
              var parts = [g.city || g.principalSubdivision || '', g.locality || ''].filter(Boolean);
              var uniq = [];
              parts.forEach(function (p) { if (uniq.indexOf(p) === -1) uniq.push(p); });
              return uniq.join(' ') || (g.countryName || '已定位');
            })
            .catch(function () { return '已定位'; });

      var weatherPromise = fetch('https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(coords.lat) + '&longitude=' + encodeURIComponent(coords.lon) + '&current=temperature_2m,weather_code&timezone=auto')
        .then(function (r) { return r.json(); })
        .then(function (w) {
          if (w && w.current) {
            var desc = wmoToText(w.current.weather_code);
            var temp = Math.round(Number(w.current.temperature_2m));
            return desc + ' ' + temp + '°C';
          }
          return '';
        })
        .catch(function () { return ''; });

      return Promise.all([locPromise, weatherPromise]).then(function (res) {
        var next = {
          location: res[0] || cache.location || '',
          weather: res[1] || cache.weather || '',
          lat: coords.lat,
          lon: coords.lon,
          updatedAt: Date.now()
        };
        saveJSON(REAL_CTX_KEY, next);
        return next;
      });
    }).catch(function () {
      return cache;
    }).finally(function () {
      fetchingReal = false;
      if (detailsEl && detailsEl.classList.contains('is-open')) {
        renderDetailsBody();
      }
    });
  }

  function getRealContext(threadId) {
    var s = getThreadSettings(threadId);
    var cache = getRealCache();
    return {
      time: s.realTime ? new Date().toLocaleString('zh-CN', { hour12: false }) : '',
      weather: s.realWeather ? (cache.weather || '') : '',
      location: s.realLocation ? (cache.location || '') : ''
    };
  }

  function getThreads() {
    if (window.PhoneChat && typeof window.PhoneChat.getThreads === 'function') {
      return window.PhoneChat.getThreads() || [];
    }
    return loadJSON(THREADS_KEY, []);
  }

  function getArchiveChars() {
    if (window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      return window.PhoneArchive.getChars() || [];
    }
    return [];
  }

  function getCharAvatar(charObj) {
    if (!charObj) return '';
    if (window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      return window.PhoneArchive.getCharAvatar(charObj.id) || charObj.avatar || '';
    }
    return charObj.avatar || '';
  }

  function getLorebooks() {
    try {
      if (window.PhoneLorebook) {
        if (typeof window.PhoneLorebook.getBooks === 'function') {
          var b = window.PhoneLorebook.getBooks();
          if (Array.isArray(b)) return b;
        }
        if (typeof window.PhoneLorebook.getAll === 'function') {
          var a = window.PhoneLorebook.getAll();
          if (Array.isArray(a)) return a;
        }
        if (typeof window.PhoneLorebook.getList === 'function') {
          var l = window.PhoneLorebook.getList();
          if (Array.isArray(l)) return l;
        }
      }
      var keys = ['phone_lorebooks_v1', 'phone_lorebook_v1', 'phone_lorebook_books_v1', 'lorebook_books_v1'];
      for (var i = 0; i < keys.length; i++) {
        var arr = loadJSON(keys[i], null);
        if (Array.isArray(arr) && arr.length) return arr;
      }
      for (var j = 0; j < localStorage.length; j++) {
        var k = localStorage.key(j);
        if (k && /lore/i.test(k)) {
          var parsed = loadJSON(k, null);
          if (Array.isArray(parsed) && parsed.length && (parsed[0].name || parsed[0].title)) {
            return parsed;
          }
        }
      }
    } catch (e) {}
    return [];
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bindPress(el, onTap) {
    if (!el) return;
    var sx = 0, sy = 0, moved = false;
    el.addEventListener('touchstart', function (e) {
      moved = false;
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
    el.addEventListener('touchend', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });
    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
    }, { passive: true });
    if (typeof onTap === 'function') {
      el.addEventListener('click', function (e) {
        if (moved) {
          moved = false;
          return;
        }
        onTap(e);
      });
    }
  }

  function resolveCurrentThread() {
    var threads = getThreads();
    if (activeThreadId) {
      var hit = threads.find(function (t) { return t.id === activeThreadId; });
      if (hit) return hit;
    }
    var titleEl = document.getElementById('ctRoomTitle');
    var titleText = titleEl ? titleEl.textContent.trim() : '';
    if (titleText) {
      var chars = getArchiveChars();
      var byTitle = threads.find(function (t) {
        if (t.type === 'dm') {
          var c = chars.find(function (item) { return item.id === t.charId; });
          var cname = c ? (c.name || c.nickname || '') : (t.name || '');
          return cname === titleText;
        }
        return (t.name || '') === titleText;
      });
      if (byTitle) {
        activeThreadId = byTitle.id;
        return byTitle;
      }
    }
    return null;
  }

  function reorderStoredThreadsByPin() {
    var list = loadJSON(THREADS_KEY, []);
    if (!Array.isArray(list) || list.length < 2) return;
    var all = getAllSettings();
    var pinned = [];
    var normal = [];
    list.forEach(function (t) {
      if (t && all[t.id] && all[t.id].pinned) pinned.push(t);
      else normal.push(t);
    });
    saveJSON(THREADS_KEY, pinned.concat(normal));
  }

  function syncPinnedRowsInHomeList() {
    var flatList = document.querySelector('#ctMainScroll .ct-flat-list');
    if (!flatList) return;
    var rows = Array.from(flatList.querySelectorAll('.ct-thread-row[data-thread-id]'));
    if (!rows.length) return;
    var all = getAllSettings();
    var pinnedRows = [];
    rows.forEach(function (row) {
      var tid = row.dataset.threadId;
      var isPinned = !!(tid && all[tid] && all[tid].pinned);
      row.classList.toggle('is-pinned-row', isPinned);
      if (isPinned) pinnedRows.push(row);
    });
    for (var i = pinnedRows.length - 1; i >= 0; i--) {
      if (flatList.firstElementChild !== pinnedRows[i]) {
        flatList.insertBefore(pinnedRows[i], flatList.firstElementChild);
      }
    }
  }

  function syncRoomBell() {
    if (syncingBell) return;
    var titleEl = document.getElementById('ctRoomTitle');
    if (!titleEl) return;
    var t = resolveCurrentThread();
    var muted = t ? getThreadSettings(t.id).muted : false;
    var existing = titleEl.querySelector('.ct-dt-room-bell');
    syncingBell = true;
    try {
      if (muted) {
        if (!existing) {
          var span = document.createElement('span');
          span.className = 'ct-dt-room-bell';
          span.innerHTML = SVG_MUTE_BELL;
          titleEl.appendChild(span);
        }
      } else if (existing) {
        existing.remove();
      }
    } finally {
      syncingBell = false;
    }
  }

  function applyRoomBackground(threadId) {
    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    if (!threadId || !window.PhoneDB) {
      box.style.backgroundImage = '';
      box.style.backgroundSize = '';
      box.style.backgroundPosition = '';
      return;
    }
    window.PhoneDB.get('chat_bg_' + threadId).then(function (url) {
      if (url) {
        box.style.backgroundImage = 'url("' + url + '")';
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
      } else {
        box.style.backgroundImage = '';
        box.style.backgroundSize = '';
        box.style.backgroundPosition = '';
      }
    });
  }

  function showChatToast(msg) {
    var el = document.getElementById('ctToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showChatToast._t);
    showChatToast._t = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  function getMsgDateStr(m) {
    if (!m) return '';
    var ts = 0;
    if (typeof m.createdAt === 'number') ts = m.createdAt;
    else if (m.id && /^m-\d{10,}/.test(String(m.id))) {
      ts = parseInt(String(m.id).slice(2), 10);
    }
    if (!ts || isNaN(ts)) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function ensureDOM() {
    var appContainer = document.querySelector('#app-chat .ct-app');
    if (!appContainer) return false;

    if (!document.getElementById('ctDetailsView')) {
      detailsEl = document.createElement('div');
      detailsEl.id = 'ctDetailsView';
      detailsEl.className = 'ct-details-view';
      detailsEl.innerHTML =
        '<div class="ct-details-topbar">' +
          '<div class="ct-details-topbar-left">' +
            '<button class="ct-details-back" id="ctDetailsBackBtn" type="button" aria-label="返回">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="ct-details-title">聊天详情</h1>' +
          '</div>' +
        '</div>' +
        '<div class="ct-details-scroll" id="ctDetailsScroll"></div>' +
        '<input type="file" id="ctDetailsBgFile" accept="image/*" style="display:none" />';
      appContainer.appendChild(detailsEl);

      bindPress(document.getElementById('ctDetailsBackBtn'), closeDetails);

      var bgInput = document.getElementById('ctDetailsBgFile');
      bgInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file || !activeThreadId) return;
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          if (window.PhoneDB && dataUrl) {
            window.PhoneDB.set('chat_bg_' + activeThreadId, dataUrl).then(function () {
              setThreadSettings(activeThreadId, { hasBg: true });
              applyRoomBackground(activeThreadId);
              renderDetailsBody();
              showChatToast('已更换聊天背景');
            });
          }
        };
        reader.readAsDataURL(file);
        bgInput.value = '';
      });
    } else {
      detailsEl = document.getElementById('ctDetailsView');
    }

    if (!document.getElementById('ctDetailsSearchView')) {
      searchEl = document.createElement('div');
      searchEl.id = 'ctDetailsSearchView';
      searchEl.className = 'ct-dt-subview';
      searchEl.innerHTML =
        '<div class="ct-details-topbar">' +
          '<div class="ct-details-topbar-left">' +
            '<button class="ct-details-back" id="ctDtSearchBackBtn" type="button" aria-label="返回">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="ct-details-title">查找聊天记录</h1>' +
          '</div>' +
        '</div>' +
        '<div class="ct-dt-search-top">' +
          '<div class="ct-dt-search-box">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input class="ct-dt-search-input" id="ctDtSearchInput" type="search" placeholder="输入关键词搜索消息" autocomplete="off" />' +
          '</div>' +
          '<div class="ct-dt-rt-bar" id="ctDtSearchRtRow">' +
            '<span class="ct-dt-rt-label">感知真实时间</span>' +
            '<button class="ct-dt-switch" id="ctDtSearchRtSwitch" type="button" aria-label="感知真实时间"><span class="ct-dt-switch-thumb"></span></button>' +
          '</div>' +
          '<div class="ct-dt-cal-wrap" id="ctDtCalWrap"></div>' +
        '</div>' +
        '<div class="ct-dt-search-list" id="ctDtSearchList"></div>';
      appContainer.appendChild(searchEl);

      bindPress(document.getElementById('ctDtSearchBackBtn'), function () {
        searchEl.classList.remove('is-open');
      });

      bindPress(document.getElementById('ctDtSearchRtRow'), function () {
        if (!activeThreadId) return;
        var cur = getThreadSettings(activeThreadId);
        var next = !cur.realTime;
        setThreadSettings(activeThreadId, { realTime: next });
        if (!next) {
          selectedDateStr = '';
          calendarCollapsed = false;
        } else {
          calendarCollapsed = false;
        }
        renderSearchView();
      });

      document.getElementById('ctDtSearchInput').addEventListener('input', renderSearchMessagesOnly);
    } else {
      searchEl = document.getElementById('ctDetailsSearchView');
    }

    if (!document.getElementById('ctDetailsLoreView')) {
      loreEl = document.createElement('div');
      loreEl.id = 'ctDetailsLoreView';
      loreEl.className = 'ct-dt-subview';
      loreEl.innerHTML =
        '<div class="ct-details-topbar">' +
          '<div class="ct-details-topbar-left">' +
            '<button class="ct-details-back" id="ctDtLoreBackBtn" type="button" aria-label="返回">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="ct-details-title">单独挂载世界书</h1>' +
          '</div>' +
        '</div>' +
        '<div class="ct-details-scroll" id="ctDtLoreScroll"></div>';
      appContainer.appendChild(loreEl);

      bindPress(document.getElementById('ctDtLoreBackBtn'), function () {
        loreEl.classList.remove('is-open');
        renderDetailsBody();
      });
    } else {
      loreEl = document.getElementById('ctDetailsLoreView');
    }

    return true;
  }

  function renderDetailsBody() {
    var scroll = document.getElementById('ctDetailsScroll');
    if (!scroll) return;

    var thread = resolveCurrentThread();
    if (!thread) {
      scroll.innerHTML = '<div class="ct-dt-empty">未找到当前会话信息</div>';
      return;
    }

    var chars = getArchiveChars();
    var isGroup = thread.type === 'group';
    var settings = getThreadSettings(thread.id);
    var realCache = getRealCache();

    var profileCardHtml = '';
    if (!isGroup) {
      var c = chars.find(function (item) { return item.id === thread.charId; });
      var cname = c ? (c.name || c.nickname || '未命名') : (thread.name || '未命名');
      var av = getCharAvatar(c);
      var bio = (c && (c.persona || c.bio || c.signature)) || '暂无简介';
      var avHtml = av ? '<img src="' + escapeHtml(av) + '" alt="" />' : escapeHtml(cname.slice(0, 1));
      profileCardHtml =
        '<div class="ct-dt-card">' +
          '<div class="ct-dt-profile">' +
            '<div class="ct-dt-avatar">' + avHtml + '</div>' +
            '<div class="ct-dt-profile-info">' +
              '<div class="ct-dt-name">' + escapeHtml(cname) + '</div>' +
              '<div class="ct-dt-bio">' + escapeHtml(bio) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    } else {
      var members = (thread.memberIds || []).map(function (id) {
        return chars.find(function (item) { return item.id === id; });
      }).filter(Boolean);
      var membersHtml = members.map(function (m) {
        var mName = m.name || m.nickname || '成员';
        var mAv = getCharAvatar(m);
        return (
          '<div class="ct-dt-member">' +
            '<div class="ct-dt-member-av">' + (mAv ? '<img src="' + escapeHtml(mAv) + '" alt="" />' : escapeHtml(mName.slice(0, 1))) + '</div>' +
            '<div class="ct-dt-member-name">' + escapeHtml(mName) + '</div>' +
          '</div>'
        );
      }).join('');

      profileCardHtml =
        '<div class="ct-dt-card">' +
          '<div class="ct-dt-row">' +
            '<div class="ct-dt-row-label">群聊名称</div>' +
            '<div style="flex:1;min-width:0;margin-left:12px;">' +
              '<input class="ct-dt-inline-input" id="ctDtGroupNameInput" type="text" value="' + escapeHtml(thread.name || '') + '" placeholder="输入群聊名称" />' +
            '</div>' +
          '</div>' +
          '<div class="ct-dt-members">' + membersHtml + '</div>' +
        '</div>';
    }

    var presetName = '未设置';
    if (window.PhonePresets && typeof window.PhonePresets.getActivePreset === 'function') {
      var p = window.PhonePresets.getActivePreset('online');
      if (p && p.name) presetName = p.name;
    }

    var weatherSub = settings.realWeather
      ? (realCache.weather ? ('当前：' + realCache.weather) : (fetchingReal ? '正在获取实时天气...' : '点击刷新天气'))
      : '开启后同步真实天气给角色';

    var locSub = settings.realLocation
      ? (realCache.location ? ('当前：' + realCache.location) : (fetchingReal ? '正在获取当前位置...' : '点击刷新位置'))
      : '开启后同步真实地点给角色';

    var loreSub = settings.loreOverride
      ? ('已开启 · 已选 ' + settings.loreIds.length + ' 本')
      : '跟随全局世界书';

    var chevronSvg = '<svg class="ct-dt-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';

    scroll.innerHTML =
      profileCardHtml +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtSearchRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">查找聊天记录</div></div>' +
          '<div class="ct-dt-row-right">' + chevronSvg + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtPinRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">置顶聊天</div></div>' +
          '<button class="ct-dt-switch' + (settings.pinned ? ' is-on' : '') + '" type="button" aria-label="置顶聊天"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtMuteRow">' +
          '<div class="ct-dt-row-left"><div class="ct-dt-row-label">消息免打扰</div></div>' +
          '<button class="ct-dt-switch' + (settings.muted ? ' is-on' : '') + '" type="button" aria-label="消息免打扰"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtBgRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">聊天背景</div>' +
            '<div class="ct-dt-row-sub">' + (settings.hasBg ? '已设置自定义背景' : '默认纯色背景') + '</div>' +
          '</div>' +
          '<div class="ct-dt-row-right">' + chevronSvg + '</div>' +
        '</div>' +
        (settings.hasBg ? (
          '<div class="ct-dt-row" id="ctDtResetBgRow">' +
            '<div class="ct-dt-row-left"><div class="ct-dt-row-label">恢复默认背景</div></div>' +
          '</div>'
        ) : '') +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtRealWeatherRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">感知真实天气</div>' +
            '<div class="ct-dt-row-sub">' + escapeHtml(weatherSub) + '</div>' +
          '</div>' +
          '<button class="ct-dt-switch' + (settings.realWeather ? ' is-on' : '') + '" type="button" aria-label="感知真实天气"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtRealLocRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">感知真实地点</div>' +
            '<div class="ct-dt-row-sub">' + escapeHtml(locSub) + '</div>' +
          '</div>' +
          '<button class="ct-dt-switch' + (settings.realLocation ? ' is-on' : '') + '" type="button" aria-label="感知真实地点"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">当前线上预设</div>' +
            '<div class="ct-dt-row-sub">在「预设」App 中切换</div>' +
          '</div>' +
          '<div class="ct-dt-row-right"><span>' + escapeHtml(presetName) + '</span></div>' +
        '</div>' +
        '<div class="ct-dt-row" id="ctDtLoreRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">启用单独挂载世界书</div>' +
            '<div class="ct-dt-row-sub">' + escapeHtml(loreSub) + '</div>' +
          '</div>' +
          '<div class="ct-dt-row-right">' + chevronSvg + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card">' +
        '<button class="ct-dt-danger-btn" id="ctDtClearBtn" type="button">清空聊天记录</button>' +
      '</div>';

    var groupInput = document.getElementById('ctDtGroupNameInput');
    if (groupInput) {
      groupInput.addEventListener('change', function () {
        var nextName = groupInput.value.trim();
        if (!nextName) return;
        var list = loadJSON(THREADS_KEY, []);
        var idx = list.findIndex(function (t) { return t.id === thread.id; });
        if (idx !== -1) {
          list[idx].name = nextName;
          saveJSON(THREADS_KEY, list);
          var roomTitle = document.getElementById('ctRoomTitle');
          if (roomTitle) {
            roomTitle.textContent = nextName;
            syncRoomBell();
          }
          showChatToast('群聊名称已更新');
        }
      });
    }

    bindPress(document.getElementById('ctDtSearchRow'), function () {
      var inp = document.getElementById('ctDtSearchInput');
      if (inp) inp.value = '';
      selectedDateStr = '';
      calendarCollapsed = false;
      var now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      renderSearchView();
      searchEl.classList.add('is-open');
    });

    bindPress(document.getElementById('ctDtPinRow'), function () {
      var cur = getThreadSettings(thread.id);
      setThreadSettings(thread.id, { pinned: !cur.pinned });
      reorderStoredThreadsByPin();
      syncPinnedRowsInHomeList();
      renderDetailsBody();
    });

    bindPress(document.getElementById('ctDtMuteRow'), function () {
      var cur = getThreadSettings(thread.id);
      setThreadSettings(thread.id, { muted: !cur.muted });
      syncRoomBell();
      renderDetailsBody();
    });

    bindPress(document.getElementById('ctDtRealWeatherRow'), function () {
      var cur = getThreadSettings(thread.id);
      var next = !cur.realWeather;
      setThreadSettings(thread.id, { realWeather: next });
      renderDetailsBody();
      if (next) refreshRealContext(true);
    });

    bindPress(document.getElementById('ctDtRealLocRow'), function () {
      var cur = getThreadSettings(thread.id);
      var next = !cur.realLocation;
      setThreadSettings(thread.id, { realLocation: next });
      renderDetailsBody();
      if (next) refreshRealContext(true);
    });

    bindPress(document.getElementById('ctDtLoreRow'), function () {
      renderLoreView();
      loreEl.classList.add('is-open');
    });

    bindPress(document.getElementById('ctDtBgRow'), function () {
      var f = document.getElementById('ctDetailsBgFile');
      if (f) f.click();
    });

    var resetBgRow = document.getElementById('ctDtResetBgRow');
    if (resetBgRow) {
      bindPress(resetBgRow, function () {
        if (window.PhoneDB) {
          window.PhoneDB.del('chat_bg_' + thread.id).then(function () {
            setThreadSettings(thread.id, { hasBg: false });
            applyRoomBackground(thread.id);
            renderDetailsBody();
            showChatToast('已恢复默认背景');
          });
        }
      });
    }

    bindPress(document.getElementById('ctDtClearBtn'), function () {
      if (!window.confirm('确定要清空这段聊天记录吗？')) return;
      saveJSON(MSGS_PREFIX + thread.id, []);
      var list = loadJSON(THREADS_KEY, []);
      var idx = list.findIndex(function (t) { return t.id === thread.id; });
      if (idx !== -1) {
        list[idx].lastMsg = '';
        list[idx].lastTime = '';
        saveJSON(THREADS_KEY, list);
      }
      var msgBox = document.getElementById('ctRoomMessages');
      if (msgBox) {
        msgBox.innerHTML = '<div class="ct-empty">发一句话开始聊天吧</div>';
      }
      showChatToast('已清空聊天记录');
      closeDetails();
    });
  }

  function renderLoreView() {
    var scroll = document.getElementById('ctDtLoreScroll');
    if (!scroll || !activeThreadId) return;

    var settings = getThreadSettings(activeThreadId);
    var books = getLorebooks();
    var checkSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    var booksHtml = !books.length
      ? '<div class="ct-dt-empty">世界书 App 里还没有世界书</div>'
      : books.map(function (b, idx) {
          var bid = String(b.id || b.name || b.title || idx);
          var bname = b.name || b.title || ('世界书 ' + (idx + 1));
          var entryCount = Array.isArray(b.entries) ? b.entries.length : 0;
          var checked = settings.loreIds.indexOf(bid) !== -1;
          return (
            '<div class="ct-dt-row" data-pick-lore="' + escapeHtml(bid) + '">' +
              '<div class="ct-dt-row-left">' +
                '<div class="ct-dt-row-label">' + escapeHtml(bname) + '</div>' +
                (entryCount ? '<div class="ct-dt-row-sub">' + entryCount + ' 条设定</div>' : '') +
              '</div>' +
              '<span class="ct-dt-check' + (checked ? ' is-checked' : '') + '">' + (checked ? checkSvg : '') + '</span>' +
            '</div>'
          );
        }).join('');

    scroll.innerHTML =
      '<div class="ct-dt-card">' +
        '<div class="ct-dt-row" id="ctDtLoreOverrideRow">' +
          '<div class="ct-dt-row-left">' +
            '<div class="ct-dt-row-label">启用单独挂载世界书</div>' +
            '<div class="ct-dt-row-sub">开启后不随全局，勾几个启用几个</div>' +
          '</div>' +
          '<button class="ct-dt-switch' + (settings.loreOverride ? ' is-on' : '') + '" type="button" aria-label="启用单独挂载世界书"><span class="ct-dt-switch-thumb"></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="ct-dt-card ct-dt-lore-list-wrap' + (settings.loreOverride ? '' : ' is-disabled') + '">' +
        booksHtml +
      '</div>';

    bindPress(document.getElementById('ctDtLoreOverrideRow'), function () {
      var cur = getThreadSettings(activeThreadId);
      setThreadSettings(activeThreadId, { loreOverride: !cur.loreOverride });
      renderLoreView();
    });

    scroll.querySelectorAll('[data-pick-lore]').forEach(function (row) {
      bindPress(row, function () {
        var bid = row.getAttribute('data-pick-lore');
        var cur = getThreadSettings(activeThreadId);
        var ids = cur.loreIds.slice();
        var pos = ids.indexOf(bid);
        if (pos === -1) ids.push(bid);
        else ids.splice(pos, 1);
        setThreadSettings(activeThreadId, { loreIds: ids });
        renderLoreView();
      });
    });
  }

  function renderSearchView() {
    if (!activeThreadId) return;
    var settings = getThreadSettings(activeThreadId);
    var rtSwitch = document.getElementById('ctDtSearchRtSwitch');
    var calWrap = document.getElementById('ctDtCalWrap');

    if (rtSwitch) rtSwitch.classList.toggle('is-on', !!settings.realTime);

    if (calWrap) {
      if (!settings.realTime) {
        calWrap.classList.remove('is-open');
      } else {
        var msgs = loadJSON(MSGS_PREFIX + activeThreadId, []);
        if (!Array.isArray(msgs)) msgs = [];
        var activeDates = {};
        msgs.forEach(function (m) {
          var ds = getMsgDateStr(m);
          if (ds) activeDates[ds] = true;
        });

        if (selectedDateStr && calendarCollapsed) {
          calWrap.innerHTML =
            '<div class="ct-dt-date-pill" id="ctDtDateExpandPill">' +
              '<span>日期：' + escapeHtml(selectedDateStr) + '</span>' +
              '<div class="ct-dt-date-pill-actions">' +
                '<button class="ct-dt-date-clear" id="ctDtDateClear" type="button">全部</button>' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
              '</div>' +
            '</div>';
          bindPress(document.getElementById('ctDtDateExpandPill'), function (e) {
            if (e.target && e.target.closest('#ctDtDateClear')) return;
            calendarCollapsed = false;
            renderSearchView();
          });
          bindPress(document.getElementById('ctDtDateClear'), function (e) {
            e.stopPropagation();
            selectedDateStr = '';
            calendarCollapsed = false;
            renderSearchView();
          });
        } else {
          var firstDay = new Date(calYear, calMonth, 1).getDay();
          var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
          var cells = [];
          for (var e = 0; e < firstDay; e++) {
            cells.push('<div class="ct-dt-cal-day is-empty"></div>');
          }
          for (var d = 1; d <= daysInMonth; d++) {
            var ds = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var hasMsg = !!activeDates[ds];
            var isSel = selectedDateStr === ds;
            var cls = 'ct-dt-cal-day' + (hasMsg ? ' has-msg' : ' is-disabled') + (isSel ? ' is-selected' : '');
            cells.push('<button class="' + cls + '" data-cal-date="' + ds + '" type="button">' + d + '</button>');
          }

          calWrap.innerHTML =
            '<div class="ct-dt-cal-card">' +
              '<div class="ct-dt-cal-head">' +
                '<span class="ct-dt-cal-month">' + calYear + '年' + (calMonth + 1) + '月</span>' +
                '<div class="ct-dt-cal-nav">' +
                  '<button class="ct-dt-cal-btn" id="ctDtCalPrev" type="button" aria-label="上个月">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
                  '</button>' +
                  '<button class="ct-dt-cal-btn" id="ctDtCalNext" type="button" aria-label="下个月">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<div class="ct-dt-cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>' +
              '<div class="ct-dt-cal-grid">' + cells.join('') + '</div>' +
            '</div>';

          bindPress(document.getElementById('ctDtCalPrev'), function () {
            calMonth -= 1;
            if (calMonth < 0) {
              calMonth = 11;
              calYear -= 1;
            }
            renderSearchView();
          });
          bindPress(document.getElementById('ctDtCalNext'), function () {
            calMonth += 1;
            if (calMonth > 11) {
              calMonth = 0;
              calYear += 1;
            }
            renderSearchView();
          });
          calWrap.querySelectorAll('.ct-dt-cal-day.has-msg').forEach(function (dayBtn) {
            bindPress(dayBtn, function () {
              var ds = dayBtn.getAttribute('data-cal-date');
              if (selectedDateStr === ds) {
                selectedDateStr = '';
                calendarCollapsed = false;
              } else {
                selectedDateStr = ds;
                calendarCollapsed = true;
              }
              renderSearchView();
            });
          });
        }

        requestAnimationFrame(function () {
          calWrap.classList.add('is-open');
        });
      }
    }

    renderSearchMessagesOnly();
  }

  function renderSearchMessagesOnly() {
    var listEl = document.getElementById('ctDtSearchList');
    var inp = document.getElementById('ctDtSearchInput');
    if (!listEl || !activeThreadId) return;

    var settings = getThreadSettings(activeThreadId);
    var kw = inp ? inp.value.trim().toLowerCase() : '';
    var msgs = loadJSON(MSGS_PREFIX + activeThreadId, []);
    if (!Array.isArray(msgs)) msgs = [];

    var filtered = msgs.slice();
    if (settings.realTime && selectedDateStr) {
      filtered = filtered.filter(function (m) {
        return getMsgDateStr(m) === selectedDateStr;
      });
    }
    if (kw) {
      filtered = filtered.filter(function (m) {
        var txt = String(m.text || m.transcript || '').toLowerCase();
        return txt.indexOf(kw) !== -1;
      });
    } else if (!selectedDateStr) {
      filtered = filtered.slice(-30).reverse();
    }

    if (!filtered.length) {
      listEl.innerHTML = '<div class="ct-dt-empty">' + (kw || selectedDateStr ? '没有找到匹配的聊天记录' : '暂无聊天记录') + '</div>';
      return;
    }

    var chars = getArchiveChars();
    listEl.innerHTML = filtered.map(function (m) {
      var senderName = '我';
      if (m.sender !== 'me') {
        var c = chars.find(function (item) { return item.id === m.charId; });
        senderName = c ? (c.name || c.nickname || '对方') : '对方';
      }
      var dStr = settings.realTime ? getMsgDateStr(m) : '';
      var timeLabel = dStr ? (dStr.slice(5) + ' ' + (m.time || '')) : (m.time || '');
      return (
        '<div class="ct-dt-search-item">' +
          '<div class="ct-dt-search-meta">' +
            '<span class="ct-dt-search-sender">' + escapeHtml(senderName) + '</span>' +
            '<span>' + escapeHtml(timeLabel) + '</span>' +
          '</div>' +
          '<div class="ct-dt-search-text">' + escapeHtml(m.text || m.transcript || '') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function openDetails() {
    if (!ensureDOM()) return;
    var t = resolveCurrentThread();
    renderDetailsBody();
    detailsEl.classList.add('is-open');
    if (t) {
      var s = getThreadSettings(t.id);
      if (s.realWeather || s.realLocation) {
        refreshRealContext(false);
      }
    }
  }

  function closeDetails() {
    if (loreEl) loreEl.classList.remove('is-open');
    if (searchEl) searchEl.classList.remove('is-open');
    if (detailsEl) detailsEl.classList.remove('is-open');
  }

  function setupObservers() {
    var titleEl = document.getElementById('ctRoomTitle');
    if (titleEl && !titleEl.dataset.dtObs) {
      titleEl.dataset.dtObs = '1';
      var tObs = new MutationObserver(function () {
        syncRoomBell();
      });
      tObs.observe(titleEl, { childList: true });
    }

    var mainScroll = document.getElementById('ctMainScroll');
    if (mainScroll && !mainScroll.dataset.dtObs) {
      mainScroll.dataset.dtObs = '1';
      var mObs = new MutationObserver(function () {
        syncPinnedRowsInHomeList();
      });
      mObs.observe(mainScroll, { childList: true });
      syncPinnedRowsInHomeList();
    }
  }

  document.addEventListener('click', function (e) {
    setupObservers();

    var row = e.target.closest('.ct-row[data-thread-id]');
    if (row) {
      activeThreadId = row.dataset.threadId || null;
      setTimeout(function () {
        applyRoomBackground(activeThreadId);
        syncRoomBell();
      }, 30);
      return;
    }

    var contactRow = e.target.closest('.ct-row[data-contact-id]');
    if (contactRow) {
      lastContactId = contactRow.dataset.contactId || null;
      return;
    }

    if (e.target.closest('#ctProfileMsgBtn') && lastContactId) {
      activeThreadId = 'dm-' + lastContactId;
      setTimeout(function () {
        applyRoomBackground(activeThreadId);
        syncRoomBell();
      }, 30);
      return;
    }

    if (e.target.closest('#ctRoomBackBtn')) {
      closeDetails();
      activeThreadId = null;
      applyRoomBackground(null);
      setTimeout(syncPinnedRowsInHomeList, 30);
      return;
    }

    if (e.target.closest('#ctRoomMoreBtn')) {
      e.stopPropagation();
      e.preventDefault();
      openDetails();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }

  window.PhoneChatDetails = {
    getSettings: getThreadSettings,
    getRealContext: getRealContext,
    refreshRealContext: refreshRealContext,
    open: openDetails,
    close: closeDetails
  };
})();
