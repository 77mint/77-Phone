/* =========================================================
   Chat「一起听」独立模块（高清透 0 模糊液态玻璃 + 对接音乐 App 接口）
   - 悬浮条支持播放/暂停、下一首（跟随当前播放模式）、收起成右上角小圆球
   - 顶栏纯文字计时（无外框无绿点）、循环/单曲/随机三态切换、点歌词跳进度
   ========================================================= */
(function () {
  var STORAGE_THREADS_KEY = 'chat_threads_v1';
  var STORAGE_MSGS_PREFIX = 'chat_msgs_v1_';
  var DEFAULT_API_BASE = 'https://api-enhanced-ashen-one-33.vercel.app';

  var SVG_HEADPHONES = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
  var SVG_NOTE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>';
  var SVG_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  var SVG_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  var SVG_PLAY_LG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  var SVG_PAUSE_LG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  var SVG_NEXT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2.5" height="16" rx="1"/></svg>';
  var SVG_NEXT_SM = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2.5" height="16" rx="1"/></svg>';
  var SVG_PREV = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 4 9 12 19 20 19 4"/><rect x="4.5" y="4" width="2.5" height="16" rx="1"/></svg>';
  var SVG_CHEVRON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
  var SVG_MODE_LOOP = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4l3 3-3 3"/><path d="M4 12V10a3 3 0 0 1 3-3h13"/><path d="M7 20l-3-3 3-3"/><path d="M20 12v2a3 3 0 0 1-3 3H4"/></svg>';
  var SVG_MODE_ONE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4l3 3-3 3"/><path d="M4 12V10a3 3 0 0 1 3-3h13"/><path d="M7 20l-3-3 3-3"/><path d="M20 12v2a3 3 0 0 1-3 3H4"/><path d="M11 10.4l1.3-0.9v5"/></svg>';
  var SVG_MODE_SHUFFLE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c2.4 0 4.2 10 7 10H20"/><path d="M3 17h3.5c2.4 0 4.2-10 7-10H20"/><path d="M17 4l3 3-3 3"/><path d="M17 14l3 3-3 3"/></svg>';

  var DEFAULT_SONGS = [
    { title: '红尘客栈', sub: '周杰伦', id: '', pic: '' },
    { title: '太聪明', sub: '陈绮贞', id: '', pic: '' },
    { title: 'Die For You', sub: 'The Weeknd', id: '', pic: '' }
  ];

  var activeThreadId = '';
  var currentSong = null;
  var songQueue = [];
  var isPlaying = false;
  var playMode = 0; // 0: 循环播放, 1: 单曲循环, 2: 随机播放
  var parsedLyrics = [];
  var lastLyricIdx = -1;
  var manualScrollUntil = 0;
  var togetherSec = 0;
  var togetherTimer = null;
  var searchTimer = null;

  function getApiBase() {
    return (localStorage.getItem('music_api_base') || DEFAULT_API_BASE).replace(/\/+$/, '');
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTime(sec) {
    if (!sec || isNaN(sec)) return '--:--';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtClock(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
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
    var name = (titleEl && titleEl.textContent.trim()) || (t && t.name) || '对方';
    var avatar = '';
    try {
      if (window.PhoneArchive && t && t.charId) {
        if (typeof window.PhoneArchive.getCharAvatar === 'function') {
          avatar = window.PhoneArchive.getCharAvatar(t.charId) || '';
        }
      }
    } catch (e) {}
    return { name: name, avatar: avatar };
  }

  function getMusicAppSongs() {
    var cards = document.querySelectorAll('#app-music #muStartList .mu-rect-card');
    if (cards && cards.length) {
      var arr = [];
      cards.forEach(function (el) {
        arr.push({
          id: el.getAttribute('data-song-id') || '',
          title: el.getAttribute('data-song-title') || '未知歌曲',
          sub: el.getAttribute('data-song-sub') || '',
          pic: el.getAttribute('data-song-pic') || ''
        });
      });
      return arr;
    }
    return DEFAULT_SONGS.slice();
  }

  function renderSongList(list) {
    var box = document.getElementById('ctlPickList');
    if (!box) return;
    if (!list || !list.length) {
      box.innerHTML = '<div style="text-align:center;color:#8e8e93;padding:36px 12px;font-size:13px;">没有找到相关歌曲</div>';
      return;
    }
    box.innerHTML = list.map(function (s, idx) {
      var hasArt = s.pic ? ' has-art' : '';
      var style = s.pic ? ' style="background-image:url(\'' + escapeHtml(s.pic) + '\')"' : '';
      return '<div class="ctl-song-row" data-ctl-idx="' + idx + '" data-sid="' + escapeHtml(s.id) + '" data-stitle="' + escapeHtml(s.title) + '" data-ssub="' + escapeHtml(s.sub) + '" data-spic="' + escapeHtml(s.pic) + '">' +
        '<div class="ctl-song-cover' + hasArt + '"' + style + '>' + SVG_NOTE + '</div>' +
        '<div class="ctl-song-info">' +
          '<div class="ctl-song-name">' + escapeHtml(s.title) + '</div>' +
          '<div class="ctl-song-artist">' + escapeHtml(s.sub || '未知歌手') + '</div>' +
        '</div>' +
        '<div class="ctl-song-send">一起听</div>' +
      '</div>';
    }).join('');
  }

  function openSongPicker() {
    var drawer = document.getElementById('ctpDrawer');
    if (drawer) drawer.classList.remove('open');
    document.getElementById('ctlPickInput').value = '';
    songQueue = getMusicAppSongs();
    renderSongList(songQueue);
    document.getElementById('ctlPickMask').classList.add('open');
  }

  function sendListenMessage(song) {
    var tid = resolveCurrentThreadId();
    if (!tid || !song) return;
    var nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    var msgId = 'm-ctl-' + Date.now();
    var msgObj = {
      id: msgId,
      sender: 'me',
      type: 'listen_together',
      song: song,
      text: '[一起听] ' + song.title,
      time: nowTime
    };

    var msgs = loadJSON(STORAGE_MSGS_PREFIX + tid, []);
    msgs.push(msgObj);
    saveJSON(STORAGE_MSGS_PREFIX + tid, msgs);

    var threads = loadJSON(STORAGE_THREADS_KEY, []);
    var idx = threads.findIndex(function (t) { return t.id === tid; });
    if (idx !== -1) {
      threads[idx].lastMsg = '[一起听] ' + song.title;
      threads[idx].lastTime = nowTime;
      saveJSON(STORAGE_THREADS_KEY, threads);
    }

    var box = document.getElementById('ctRoomMessages');
    if (box) {
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
      renderListenCard(group.querySelector('.ct-msg-bubble'), msgObj);
      box.scrollTop = box.scrollHeight;
    }

    startListenSession(song, true);
  }

  function renderListenCard(bubble, msg) {
    if (!bubble || !msg || !msg.song) return;
    var s = msg.song;
    var peer = getPeerInfo();
    var hasArt = s.pic ? ' has-art' : '';
    var artStyle = s.pic ? ' style="background-image:url(\'' + escapeHtml(s.pic) + '\')"' : '';
    var peerAv = peer.avatar
      ? '<div class="ctl-mini-av"><img src="' + escapeHtml(peer.avatar) + '" alt=""></div>'
      : '<div class="ctl-mini-av">' + escapeHtml(peer.name.slice(0, 1)) + '</div>';

    bubble.classList.add('ctl-msg-card');
    bubble.dataset.ctlRendered = '1';
    bubble.setAttribute('data-ctl-open', msg.id);
    bubble.innerHTML =
      '<div class="ctl-card-top">' +
        '<div class="ctl-card-art' + hasArt + '"' + artStyle + '>' + SVG_NOTE + '</div>' +
        '<div class="ctl-card-info">' +
          '<div class="ctl-card-title">' + escapeHtml(s.title) + '</div>' +
          '<div class="ctl-card-sub">' + escapeHtml(s.sub || '邀请你一起听歌') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ctl-card-foot">' +
        '<span>一起听</span>' +
        '<div class="ctl-card-avs">' +
          '<div class="ctl-mini-av">我</div>' +
          peerAv +
        '</div>' +
      '</div>';
  }

  function decorateMessages() {
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
      if (!m || m.type !== 'listen_together') return;
      var bubble = group.querySelector('.ct-msg-bubble');
      if (bubble && bubble.dataset.ctlRendered !== '1') {
        renderListenCard(bubble, m);
      }
    });
  }

  function syncPlayerUI() {
    var room = document.getElementById('ctlRoom');
    var pill = document.getElementById('ctlFloatPill');
    var orb = document.getElementById('ctlMiniOrb');
    var playBtn = document.getElementById('ctlPlayBtn');
    var floatPlay = document.getElementById('ctlFloatPlay');
    if (room) room.classList.toggle('playing', isPlaying);
    if (pill) pill.classList.toggle('playing', isPlaying);
    if (orb) orb.classList.toggle('playing', isPlaying);
    if (playBtn) playBtn.innerHTML = isPlaying ? SVG_PAUSE_LG : SVG_PLAY_LG;
    if (floatPlay) floatPlay.innerHTML = isPlaying ? SVG_PAUSE : SVG_PLAY;
  }

  function renderModeUI() {
    var btn = document.getElementById('ctlModeBtn');
    var lbl = document.getElementById('ctlModeLbl');
    if (!btn || !lbl) return;
    if (playMode === 0) {
      btn.innerHTML = SVG_MODE_LOOP;
      lbl.textContent = '循环播放';
    } else if (playMode === 1) {
      btn.innerHTML = SVG_MODE_ONE;
      lbl.textContent = '单曲循环';
    } else {
      btn.innerHTML = SVG_MODE_SHUFFLE;
      lbl.textContent = '随机播放';
    }
  }

  function loadLyrics(songId) {
    parsedLyrics = [];
    lastLyricIdx = -1;
    var box = document.getElementById('ctlLyrics');
    if (!box) return;
    if (!songId) {
      box.innerHTML = '<div class="ctl-lrc-line">暂无歌词</div>';
      return;
    }
    box.innerHTML = '<div class="ctl-lrc-line">正在加载歌词...</div>';
    fetch(getApiBase() + '/lyric?id=' + songId)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var raw = res.lrc && res.lrc.lyric;
        if (!raw) {
          box.innerHTML = '<div class="ctl-lrc-line">暂无歌词</div>';
          return;
        }
        var lines = [];
        raw.split('\n').forEach(function (line) {
          var m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
          if (m) {
            var txt = m[3].trim();
            if (txt) lines.push({ time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: txt });
          }
        });
        parsedLyrics = lines;
        if (!lines.length) {
          box.innerHTML = '<div class="ctl-lrc-line">纯音乐，请欣赏</div>';
          return;
        }
        box.innerHTML = lines.map(function (l, i) {
          return '<div class="ctl-lrc-line" data-ctl-lrc="' + i + '" data-ctl-time="' + l.time + '">' + escapeHtml(l.text) + '</div>';
        }).join('');
      }).catch(function () {
        box.innerHTML = '<div class="ctl-lrc-line">歌词加载失败</div>';
      });
  }

  function startListenSession(song, openFull) {
    if (!song) return;
    currentSong = song;
    var muAudio = document.getElementById('muAudio');
    if (muAudio && !muAudio.paused) muAudio.pause();

    var peer = getPeerInfo();
    var peerAvEl = document.getElementById('ctlPeerAv');
    if (peer.avatar) {
      peerAvEl.innerHTML = '<img src="' + escapeHtml(peer.avatar) + '" onerror="this.parentNode.textContent=\'' + escapeHtml(peer.name.slice(0, 1)) + '\'" alt="">';
    } else {
      peerAvEl.textContent = peer.name.slice(0, 1);
    }

    document.getElementById('ctlMetaTitle').textContent = song.title;
    document.getElementById('ctlMetaSub').textContent = song.sub || '';
    document.getElementById('ctlFloatTxt').textContent = song.title + (song.sub ? ' - ' + song.sub : '');

    var disc = document.getElementById('ctlDisc');
    var bg = document.getElementById('ctlRoomBg');
    var floatArt = document.getElementById('ctlFloatArt');
    var orbArt = document.getElementById('ctlMiniOrbArt');
    if (song.pic) {
      disc.style.backgroundImage = 'url("' + song.pic + '")';
      disc.classList.add('has-art');
      bg.style.backgroundImage = 'url("' + song.pic + '")';
      floatArt.style.backgroundImage = 'url("' + song.pic + '")';
      orbArt.style.backgroundImage = 'url("' + song.pic + '")';
    } else {
      disc.style.backgroundImage = '';
      disc.classList.remove('has-art');
      bg.style.backgroundImage = '';
      floatArt.style.backgroundImage = '';
      orbArt.style.backgroundImage = '';
    }

    document.getElementById('ctlStage').classList.remove('lyrics-on');
    document.getElementById('ctlProgFill').style.width = '0%';
    document.getElementById('ctlCurTime').textContent = '--:--';
    document.getElementById('ctlDurTime').textContent = '--:--';

    if (!togetherTimer) {
      togetherSec = 0;
      document.getElementById('ctlTogetherTime').textContent = '一起听 · 00:00';
      togetherTimer = setInterval(function () {
        togetherSec++;
        var el = document.getElementById('ctlTogetherTime');
        if (el) el.textContent = '一起听 · ' + fmtClock(togetherSec);
      }, 1000);
    }

    var audio = document.getElementById('ctlAudio');
    isPlaying = true;
    syncPlayerUI();
    renderModeUI();
    loadLyrics(song.id);

    var fetchPlay = function (songId) {
      var cookie = localStorage.getItem('music_netease_cookie') || '';
      fetch(getApiBase() + '/song/url/v1?id=' + songId + '&level=standard' + (cookie ? '&cookie=' + encodeURIComponent(cookie) : ''))
        .then(function (r) { return r.json(); })
        .then(function (u) {
          var mp3 = u.data && u.data[0] && u.data[0].url;
          if (mp3) {
            audio.src = mp3.replace(/^http:\/\//, 'https://');
            audio.play().catch(function () {});
          }
        }).catch(function () {});
    };

    if (song.id) {
      fetchPlay(song.id);
    } else {
      fetch(getApiBase() + '/cloudsearch?keywords=' + encodeURIComponent(song.title + ' ' + song.sub) + '&limit=1')
        .then(function (r) { return r.json(); })
        .then(function (res) {
          var hit = res.result && res.result.songs && res.result.songs[0];
          if (hit) {
            song.id = hit.id;
            if (!song.pic && hit.al && hit.al.picUrl) {
              song.pic = hit.al.picUrl.replace(/^http:\/\//, 'https://') + '?param=600y600';
              disc.style.backgroundImage = 'url("' + song.pic + '")';
              disc.classList.add('has-art');
              bg.style.backgroundImage = 'url("' + song.pic + '")';
              floatArt.style.backgroundImage = 'url("' + song.pic + '")';
              orbArt.style.backgroundImage = 'url("' + song.pic + '")';
            }
            loadLyrics(hit.id);
            fetchPlay(hit.id);
          }
        }).catch(function () {});
    }

    if (openFull) {
      document.getElementById('ctlRoom').classList.add('open');
      document.getElementById('ctlFloatPill').classList.remove('open');
      document.getElementById('ctlMiniOrb').classList.remove('open');
    } else if (!document.getElementById('ctlMiniOrb').classList.contains('open')) {
      document.getElementById('ctlFloatPill').classList.add('open');
    }
  }

  function exitListenSession() {
    var audio = document.getElementById('ctlAudio');
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
    isPlaying = false;
    currentSong = null;
    clearInterval(togetherTimer);
    togetherTimer = null;
    togetherSec = 0;
    document.getElementById('ctlRoom').classList.remove('open');
    document.getElementById('ctlFloatPill').classList.remove('open');
    document.getElementById('ctlMiniOrb').classList.remove('open');
    syncPlayerUI();
  }

  function ensureUI() {
    var grid = document.querySelector('#ctpDrawer .ctp-grid');
    var room = document.getElementById('ctRoomView');
    if (!room || document.getElementById('ctlRoom')) return;

    if (grid && !document.getElementById('ctlBtnListen')) {
      var tile = document.createElement('button');
      tile.className = 'ctp-item';
      tile.id = 'ctlBtnListen';
      tile.innerHTML =
        '<div class="ctp-item-icon">' + SVG_HEADPHONES + '</div>' +
        '<div class="ctp-item-label">一起听</div>';
      grid.appendChild(tile);
    }

    var holder = document.createElement('div');
    holder.innerHTML =
      '<div class="ctl-float-pill ctl-glass" id="ctlFloatPill">' +
        '<div class="ctl-float-art" id="ctlFloatArt"></div>' +
        '<div class="ctl-float-txt" id="ctlFloatTxt">一起听</div>' +
        '<button class="ctl-float-btn" id="ctlFloatPlay" aria-label="播放暂停">' + SVG_PLAY + '</button>' +
        '<button class="ctl-float-btn" id="ctlFloatNext" aria-label="下一首">' + SVG_NEXT_SM + '</button>' +
        '<button class="ctl-float-btn" id="ctlFloatHide" aria-label="收起悬浮条">' + SVG_CHEVRON_UP + '</button>' +
      '</div>' +
      '<div class="ctl-mini-orb ctl-glass" id="ctlMiniOrb" aria-label="展开一起听">' +
        '<div class="ctl-mini-orb-art" id="ctlMiniOrbArt"></div>' +
      '</div>' +
      '<div class="ctl-pick-mask" id="ctlPickMask">' +
        '<div class="ctl-pick-sheet">' +
          '<div class="ctl-pick-head">' +
            '<div class="ctl-pick-title">邀请一起听</div>' +
            '<button class="ctl-pick-close" id="ctlPickClose">关闭</button>' +
          '</div>' +
          '<div class="ctl-pick-search">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input id="ctlPickInput" placeholder="搜索歌曲或歌手（同步音乐 App）">' +
          '</div>' +
          '<div class="ctl-pick-list" id="ctlPickList"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ctl-room" id="ctlRoom">' +
        '<div class="ctl-room-bg" id="ctlRoomBg"></div>' +
        '<div class="ctl-room-nav">' +
          '<button class="ctl-nav-circle ctl-glass" id="ctlMinBtn" aria-label="收起">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<div class="ctl-nav-time" id="ctlTogetherTime">一起听 · 00:00</div>' +
          '<button class="ctl-nav-exit ctl-glass" id="ctlExitBtn">退出</button>' +
        '</div>' +
        '<div class="ctl-pair">' +
          '<div class="ctl-pair-av">我</div>' +
          '<div class="ctl-pair-wave"><span></span><span></span><span></span></div>' +
          '<div class="ctl-pair-av" id="ctlPeerAv"></div>' +
        '</div>' +
        '<div class="ctl-stage" id="ctlStage">' +
          '<div class="ctl-disc-wrap ctl-glass" id="ctlDiscWrap">' +
            '<div class="ctl-disc" id="ctlDisc">' + SVG_NOTE + '</div>' +
          '</div>' +
          '<div class="ctl-lyrics" id="ctlLyrics"></div>' +
        '</div>' +
        '<div class="ctl-panel ctl-glass">' +
          '<div class="ctl-song-meta">' +
            '<div class="ctl-meta-left">' +
              '<div class="ctl-meta-title" id="ctlMetaTitle">未选择歌曲</div>' +
              '<div class="ctl-meta-sub" id="ctlMetaSub"></div>' +
            '</div>' +
            '<button class="ctl-switch-btn" id="ctlSwitchBtn">换歌</button>' +
          '</div>' +
          '<div class="ctl-prog-bar" id="ctlProgBar"><div class="ctl-prog-fill" id="ctlProgFill"></div></div>' +
          '<div class="ctl-prog-times"><span id="ctlCurTime">--:--</span><span id="ctlDurTime">--:--</span></div>' +
          '<div class="ctl-ctrls">' +
            '<button class="ctl-ctrl-btn" id="ctlModeBtn" aria-label="播放模式">' + SVG_MODE_LOOP + '</button>' +
            '<button class="ctl-ctrl-btn" id="ctlPrevBtn" aria-label="上一首">' + SVG_PREV + '</button>' +
            '<button class="ctl-ctrl-btn main" id="ctlPlayBtn" aria-label="播放暂停">' + SVG_PLAY_LG + '</button>' +
            '<button class="ctl-ctrl-btn" id="ctlNextBtn" aria-label="下一首">' + SVG_NEXT + '</button>' +
            '<span class="ctl-mode-lbl" id="ctlModeLbl">循环播放</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<audio id="ctlAudio" preload="none"></audio>';

    while (holder.firstChild) room.appendChild(holder.firstChild);
    bindEvents();
  }

  function bindEvents() {
    var msgBox = document.getElementById('ctRoomMessages');
    var mainScroll = document.getElementById('ctMainScroll');
    var audio = document.getElementById('ctlAudio');
    var lyricsEl = document.getElementById('ctlLyrics');

    if (mainScroll) {
      mainScroll.addEventListener('click', function (e) {
        var row = e.target.closest('.ct-row[data-thread-id]');
        if (row) activeThreadId = row.getAttribute('data-thread-id') || '';
      }, true);
    }

    var listenBtn = document.getElementById('ctlBtnListen');
    if (listenBtn) {
      listenBtn.addEventListener('click', openSongPicker);
    }

    document.getElementById('ctlPickClose').addEventListener('click', function () {
      document.getElementById('ctlPickMask').classList.remove('open');
    });

    document.getElementById('ctlPickInput').addEventListener('input', function (e) {
      var kw = e.target.value.trim();
      clearTimeout(searchTimer);
      if (!kw) {
        songQueue = getMusicAppSongs();
        renderSongList(songQueue);
        return;
      }
      searchTimer = setTimeout(function () {
        fetch(getApiBase() + '/cloudsearch?keywords=' + encodeURIComponent(kw) + '&limit=15')
          .then(function (r) { return r.json(); })
          .then(function (res) {
            var songs = (res.result && res.result.songs) || [];
            songQueue = songs.map(function (s) {
              return {
                id: s.id,
                title: s.name,
                sub: (s.ar || []).map(function (a) { return a.name; }).join('/'),
                pic: s.al && s.al.picUrl ? s.al.picUrl.replace(/^http:\/\//, 'https://') + '?param=600y600' : ''
              };
            });
            renderSongList(songQueue);
          }).catch(function () {});
      }, 350);
    });

    document.getElementById('ctlPickList').addEventListener('click', function (e) {
      var row = e.target.closest('.ctl-song-row');
      if (!row) return;
      var song = {
        id: row.getAttribute('data-sid') || '',
        title: row.getAttribute('data-stitle') || '',
        sub: row.getAttribute('data-ssub') || '',
        pic: row.getAttribute('data-spic') || ''
      };
      document.getElementById('ctlPickMask').classList.remove('open');
      sendListenMessage(song);
    });

    if (msgBox) {
      msgBox.addEventListener('click', function (e) {
        var card = e.target.closest('[data-ctl-open]');
        if (!card) return;
        e.stopPropagation();
        var mid = card.getAttribute('data-ctl-open');
        var tid = resolveCurrentThreadId();
        var msgs = tid ? loadJSON(STORAGE_MSGS_PREFIX + tid, []) : [];
        var m = msgs.find(function (item) { return item.id === mid; });
        if (m && m.song) {
          if (currentSong && currentSong.title === m.song.title) {
            document.getElementById('ctlRoom').classList.add('open');
            document.getElementById('ctlFloatPill').classList.remove('open');
            document.getElementById('ctlMiniOrb').classList.remove('open');
          } else {
            startListenSession(m.song, true);
          }
        }
      });

      var observer = new MutationObserver(decorateMessages);
      observer.observe(msgBox, { childList: true });
    }

    document.getElementById('ctlMinBtn').addEventListener('click', function () {
      document.getElementById('ctlRoom').classList.remove('open');
      if (currentSong) {
        document.getElementById('ctlFloatPill').classList.add('open');
        document.getElementById('ctlMiniOrb').classList.remove('open');
      }
    });

    document.getElementById('ctlFloatPill').addEventListener('click', function (e) {
      if (e.target.closest('.ctl-float-btn')) return;
      document.getElementById('ctlFloatPill').classList.remove('open');
      document.getElementById('ctlMiniOrb').classList.remove('open');
      document.getElementById('ctlRoom').classList.add('open');
    });

    function hidePillToOrb() {
      document.getElementById('ctlFloatPill').classList.remove('open');
      if (currentSong) document.getElementById('ctlMiniOrb').classList.add('open');
    }

    document.getElementById('ctlFloatHide').addEventListener('click', function (e) {
      e.stopPropagation();
      hidePillToOrb();
    });

    // 上滑悬浮条也能顺滑收成小圆球
    var pillEl = document.getElementById('ctlFloatPill');
    var pillStartY = 0;
    pillEl.addEventListener('touchstart', function (e) {
      pillStartY = e.touches[0].clientY;
    }, { passive: true });
    pillEl.addEventListener('touchend', function (e) {
      if (!pillStartY) return;
      var dy = e.changedTouches[0].clientY - pillStartY;
      pillStartY = 0;
      if (dy < -24) hidePillToOrb();
    }, { passive: true });

    document.getElementById('ctlMiniOrb').addEventListener('click', function () {
      this.classList.remove('open');
      if (currentSong) document.getElementById('ctlFloatPill').classList.add('open');
    });

    function togglePlay() {
      isPlaying = !isPlaying;
      if (audio.src) {
        if (isPlaying) audio.play().catch(function () {});
        else audio.pause();
      }
      syncPlayerUI();
    }

    document.getElementById('ctlFloatPlay').addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlay();
    });

    function stepSong(delta) {
      if (!songQueue.length) songQueue = getMusicAppSongs();
      if (!songQueue.length) return;
      var inRoom = document.getElementById('ctlRoom').classList.contains('open');
      if (playMode === 2 && songQueue.length > 1) {
        var r = Math.floor(Math.random() * songQueue.length);
        var curIdx = currentSong ? songQueue.findIndex(function (x) { return x.title === currentSong.title; }) : -1;
        if (r === curIdx) r = (r + 1) % songQueue.length;
        startListenSession(songQueue[r], inRoom);
        return;
      }
      var idx = currentSong ? songQueue.findIndex(function (x) { return x.title === currentSong.title; }) : -1;
      var nextIdx = (idx + delta + songQueue.length) % songQueue.length;
      startListenSession(songQueue[nextIdx], inRoom);
    }

    document.getElementById('ctlFloatNext').addEventListener('click', function (e) {
      e.stopPropagation();
      stepSong(1);
    });

    document.getElementById('ctlPlayBtn').addEventListener('click', togglePlay);
    document.getElementById('ctlExitBtn').addEventListener('click', exitListenSession);
    document.getElementById('ctlSwitchBtn').addEventListener('click', openSongPicker);

    document.getElementById('ctlModeBtn').addEventListener('click', function () {
      playMode = (playMode + 1) % 3;
      renderModeUI();
    });

    document.getElementById('ctlPrevBtn').addEventListener('click', function () { stepSong(-1); });
    document.getElementById('ctlNextBtn').addEventListener('click', function () { stepSong(1); });

    document.getElementById('ctlDiscWrap').addEventListener('click', function () {
      document.getElementById('ctlStage').classList.add('lyrics-on');
    });

    lyricsEl.addEventListener('touchstart', function () {
      manualScrollUntil = Date.now() + 4500;
    }, { passive: true });
    lyricsEl.addEventListener('scroll', function () {
      manualScrollUntil = Date.now() + 4500;
    }, { passive: true });

    // 点歌词跳对应进度；点空白处切回唱片
    lyricsEl.addEventListener('click', function (e) {
      var line = e.target.closest('.ctl-lrc-line[data-ctl-time]');
      if (line) {
        e.stopPropagation();
        var t = parseFloat(line.getAttribute('data-ctl-time'));
        if (!isNaN(t)) {
          audio.currentTime = t;
          manualScrollUntil = 0;
          if (audio.paused && audio.src) {
            isPlaying = true;
            audio.play().catch(function () {});
            syncPlayerUI();
          }
        }
        return;
      }
      document.getElementById('ctlStage').classList.remove('lyrics-on');
    });

    document.getElementById('ctlProgBar').addEventListener('click', function (e) {
      if (!audio.duration) return;
      var rect = this.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    });

    audio.addEventListener('ended', function () {
      if (playMode === 1) {
        audio.currentTime = 0;
        audio.play().catch(function () {});
      } else {
        stepSong(1);
      }
    });

    audio.addEventListener('timeupdate', function () {
      if (!audio.duration) return;
      document.getElementById('ctlProgFill').style.width = (audio.currentTime / audio.duration * 100) + '%';
      document.getElementById('ctlCurTime').textContent = fmtTime(audio.currentTime);
      document.getElementById('ctlDurTime').textContent = fmtTime(audio.duration);
      if (parsedLyrics.length) {
        var curT = audio.currentTime;
        var activeIdx = 0;
        for (var i = 0; i < parsedLyrics.length; i++) {
          if (curT >= parsedLyrics[i].time) activeIdx = i;
        }
        if (activeIdx !== lastLyricIdx) {
          lastLyricIdx = activeIdx;
          var els = document.querySelectorAll('#ctlLyrics .ctl-lrc-line');
          els.forEach(function (el, idx) {
            var on = idx === activeIdx;
            el.classList.toggle('active', on);
            if (on && document.getElementById('ctlStage').classList.contains('lyrics-on') && Date.now() > manualScrollUntil) {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          });
        }
      }
    });

    document.getElementById('ctRoomBackBtn').addEventListener('click', exitListenSession, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUI);
  } else {
    ensureUI();
  }
})();
