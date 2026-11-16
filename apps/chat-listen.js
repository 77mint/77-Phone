/* =========================================================
   Chat 一起听（全局常驻：跨 App / 主屏幕保持播放与悬浮）
   ========================================================= */
(function () {
  var DEFAULT_API = 'https://api-enhanced-ashen-one-33.vercel.app';

  var PLAY_MODES = [
    { key: 'list', label: '循环播放' },
    { key: 'single', label: '单曲循环' },
    { key: 'shuffle', label: '随机播放' }
  ];

  var RED_LOVE_PATH =
    'M 2,26 C 14,25 22,19 25,11 C 27,5 22,2 19,6 C 15,12 14,23 19,27 C 24,30 33,24 38,18 C 41,15 47,15 48,19 C 49,24 43,28 39,26 C 36,24 38,17 44,17 C 49,17 53,22 57,24 C 60,25 63,21 65,16 C 67,22 70,25 74,23 C 77,21 79,16 83,16 C 87,16 88,21 84,23 C 80,25 79,20 84,18 C 91,15 103,20 116,22';

  var state = {
    inited: false,
    active: false,
    roomOpen: false,
    orbMode: false,
    orbHidden: false,
    showLyrics: false,
    threadId: '',
    contactId: '',
    contactName: '',
    contactAvatar: '',
    playlist: [],
    currentIndex: -1,
    currentSong: null,
    lyrics: [],
    activeLyricIdx: -1,
    playModeIdx: 0,
    isPlaying: false,
    elapsedSec: 0,
    timerId: null,
    audio: null,
    seeking: false,
    searchTimer: null
  };

  var els = {};

  function getRootContainer() {
    return document.querySelector('.phone-screen') || document.body;
  }

  function getApiBase() {
    var base = localStorage.getItem('music_api_base') || DEFAULT_API;
    return base.replace(/\/+$/, '');
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTime(sec) {
    var s = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function showToast(text) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.add('show');
    clearTimeout(els.toast._t);
    els.toast._t = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 1800);
  }

  function bindPressFeedback(el) {
    if (!el || el._pressBound) return;
    el._pressBound = true;
    el.addEventListener('touchstart', function () {
      el.classList.add('is-pressed');
    }, { passive: true });
    var clear = function () {
      el.classList.remove('is-pressed');
    };
    el.addEventListener('touchend', clear, { passive: true });
    el.addEventListener('touchcancel', clear, { passive: true });
    el.addEventListener('mousedown', function () {
      el.classList.add('is-pressed');
    });
    el.addEventListener('mouseup', clear);
    el.addEventListener('mouseleave', clear);
  }

  function getContactInfoFromRoom() {
    var titleEl = document.getElementById('ctRoomTitle');
    var name = titleEl ? titleEl.textContent.trim() : 'Ta';
    var threadId = '';
    var contactId = '';
    var avatar = '';

    if (window.PhoneChat && typeof window.PhoneChat.getThreads === 'function') {
      var threads = window.PhoneChat.getThreads() || [];
      for (var i = 0; i < threads.length; i++) {
        if (threads[i].name === name || threads[i].title === name) {
          threadId = threads[i].id || '';
          contactId = threads[i].contactId || threads[i].charId || '';
          avatar = threads[i].avatar || '';
          break;
        }
      }
    }

    if (!avatar && contactId && window.PhoneArchive && typeof window.PhoneArchive.getCharAvatar === 'function') {
      avatar = window.PhoneArchive.getCharAvatar(contactId) || '';
    }
    if (!avatar && window.PhoneArchive && typeof window.PhoneArchive.getChars === 'function') {
      var chars = window.PhoneArchive.getChars() || [];
      for (var j = 0; j < chars.length; j++) {
        if (chars[j].name === name) {
          contactId = chars[j].id || contactId;
          avatar = chars[j].avatar || '';
          break;
        }
      }
    }
    if (!avatar && name === '水小九') {
      avatar = 'icons/IMG_0288.jpeg';
    }
    return {
      threadId: threadId || ('thread_' + name),
      contactId: contactId,
      contactName: name,
      contactAvatar: avatar
    };
  }

  function buildGlobalDOM() {
    if (state.inited) return;
    state.inited = true;

    var container = getRootContainer();

    /* 1. 全局悬浮条 */
    var pill = document.createElement('div');
    pill.id = 'ctlFloatPill';
    pill.className = 'ctl-float-pill';
    pill.innerHTML =
      '<div class="ctl-float-cover" id="ctlFloatCover"></div>' +
      '<div class="ctl-float-txt"><span class="ctl-float-txt-inner" id="ctlFloatTxtInner">一起听</span></div>' +
      '<button type="button" class="ctl-float-btn" id="ctlFloatPlayBtn" aria-label="播放暂停"></button>' +
      '<button type="button" class="ctl-float-btn" id="ctlFloatNextBtn" aria-label="下一首">' +
        '<svg viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zm12 0h2v16h-2V4z"/></svg>' +
      '</button>' +
      '<button type="button" class="ctl-float-btn ctl-float-collapse" id="ctlFloatToOrbBtn" aria-label="收起为小球">' +
        '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>' +
      '</button>';
    container.appendChild(pill);

    /* 2. 全局可拖动贴边小球 */
    var orb = document.createElement('div');
    orb.id = 'ctlMiniOrb';
    orb.className = 'ctl-mini-orb';
    orb.innerHTML =
      '<div class="ctl-mini-orb-art" id="ctlOrbArt"></div>' +
      '<div class="ctl-mini-orb-close"><svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></div>';
    container.appendChild(orb);

    /* 3. 全局全屏一起听房间 */
    var room = document.createElement('div');
    room.id = 'ctlRoom';
    room.className = 'ctl-room';
    room.innerHTML =
      '<div class="ctl-room-bg" id="ctlRoomBg"></div>' +
      '<div class="ctl-top">' +
        '<div class="ctl-icon-btn ctl-glass" id="ctlCollapseBtn" aria-label="收起">' +
          '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="ctl-timer" id="ctlTimer">一起听 · 00:00</div>' +
        '<div class="ctl-quit-btn ctl-glass" id="ctlQuitBtn">退出</div>' +
      '</div>' +
      '<div class="ctl-pair">' +
        '<div class="ctl-pair-av" id="ctlMyAv">我</div>' +
        '<svg class="ctl-red-thread" viewBox="0 0 118 44" preserveAspectRatio="none">' +
          '<path class="ctl-love-path" pathLength="100" d="' + RED_LOVE_PATH + '"/>' +
        '</svg>' +
        '<div class="ctl-pair-av" id="ctlPeerAv"></div>' +
      '</div>' +
      '<div class="ctl-stage" id="ctlStage">' +
        '<div class="ctl-disc-wrap">' +
          '<div class="ctl-disc" id="ctlDisc"></div>' +
        '</div>' +
        '<div class="ctl-lyrics" id="ctlLyrics"></div>' +
      '</div>' +
      '<div class="ctl-panel ctl-glass">' +
        '<div class="ctl-song-row">' +
          '<div class="ctl-song-info">' +
            '<div class="ctl-song-title" id="ctlSongTitle">未选择歌曲</div>' +
            '<div class="ctl-song-artist" id="ctlSongArtist">--</div>' +
          '</div>' +
          '<div class="ctl-change-btn" id="ctlChangeBtn">换歌</div>' +
        '</div>' +
        '<div class="ctl-prog-wrap" id="ctlProgWrap">' +
          '<div class="ctl-prog-track"><div class="ctl-prog-fill" id="ctlProgFill"></div></div>' +
        '</div>' +
        '<div class="ctl-time-row">' +
          '<span id="ctlCurTime">00:00</span>' +
          '<span id="ctlDurTime">00:00</span>' +
        '</div>' +
        '<div class="ctl-ctrl-row">' +
          '<div class="ctl-mode-btn" id="ctlModeBtn">' +
            '<span id="ctlModeIcon"></span>' +
            '<span id="ctlModeLabel">循环播放</span>' +
          '</div>' +
          '<div class="ctl-ctrl-center">' +
            '<div class="ctl-step-btn" id="ctlPrevBtn"><svg viewBox="0 0 24 24"><path d="M19 20L9 12l10-8v16zM5 4h2v16H5V4z"/></svg></div>' +
            '<div class="ctl-play-btn" id="ctlPlayBtn"></div>' +
            '<div class="ctl-step-btn" id="ctlNextBtn"><svg viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zm12 0h2v16h-2V4z"/></svg></div>' +
          '</div>' +
          '<div class="ctl-mode-spacer"></div>' +
        '</div>' +
      '</div>';
    container.appendChild(room);

    /* 4. 全局选歌弹窗 */
    var modal = document.createElement('div');
    modal.id = 'ctlSongModal';
    modal.className = 'ctl-modal';
    modal.innerHTML =
      '<div class="ctl-sheet">' +
        '<div class="ctl-sheet-head">' +
          '<div class="ctl-sheet-title">选择一起听的歌</div>' +
          '<div class="ctl-sheet-close" id="ctlModalClose">×</div>' +
        '</div>' +
        '<div class="ctl-search-row">' +
          '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>' +
          '<input class="ctl-search-input" id="ctlSearchInput" type="text" placeholder="搜索歌名、歌手…" />' +
        '</div>' +
        '<div class="ctl-song-list" id="ctlSongList"></div>' +
      '</div>';
    container.appendChild(modal);

    /* 5. 全局轻提示 */
    var toast = document.createElement('div');
    toast.id = 'ctlToast';
    toast.className = 'ctl-toast';
    container.appendChild(toast);

    els = {
      container: container,
      pill: pill,
      floatCover: document.getElementById('ctlFloatCover'),
      floatTxtInner: document.getElementById('ctlFloatTxtInner'),
      floatPlayBtn: document.getElementById('ctlFloatPlayBtn'),
      floatNextBtn: document.getElementById('ctlFloatNextBtn'),
      floatToOrbBtn: document.getElementById('ctlFloatToOrbBtn'),
      orb: orb,
      orbArt: document.getElementById('ctlOrbArt'),
      room: room,
      roomBg: document.getElementById('ctlRoomBg'),
      collapseBtn: document.getElementById('ctlCollapseBtn'),
      timer: document.getElementById('ctlTimer'),
      quitBtn: document.getElementById('ctlQuitBtn'),
      myAv: document.getElementById('ctlMyAv'),
      peerAv: document.getElementById('ctlPeerAv'),
      stage: document.getElementById('ctlStage'),
      disc: document.getElementById('ctlDisc'),
      lyrics: document.getElementById('ctlLyrics'),
      songTitle: document.getElementById('ctlSongTitle'),
      songArtist: document.getElementById('ctlSongArtist'),
      changeBtn: document.getElementById('ctlChangeBtn'),
      progWrap: document.getElementById('ctlProgWrap'),
      progFill: document.getElementById('ctlProgFill'),
      curTime: document.getElementById('ctlCurTime'),
      durTime: document.getElementById('ctlDurTime'),
      modeBtn: document.getElementById('ctlModeBtn'),
      modeIcon: document.getElementById('ctlModeIcon'),
      modeLabel: document.getElementById('ctlModeLabel'),
      prevBtn: document.getElementById('ctlPrevBtn'),
      playBtn: document.getElementById('ctlPlayBtn'),
      nextBtn: document.getElementById('ctlNextBtn'),
      modal: modal,
      modalClose: document.getElementById('ctlModalClose'),
      searchInput: document.getElementById('ctlSearchInput'),
      songList: document.getElementById('ctlSongList'),
      toast: toast
    };

    bindGlobalEvents();
    renderPlayButtons();
    renderModeUI();
  }

  function renderPlayButtons() {
    var playSvg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var pauseSvg = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>';
    var svg = state.isPlaying ? pauseSvg : playSvg;
    if (els.playBtn) els.playBtn.innerHTML = svg;
    if (els.floatPlayBtn) els.floatPlayBtn.innerHTML = svg;
    if (els.disc) els.disc.classList.toggle('playing', state.isPlaying);
    if (els.floatCover) els.floatCover.classList.toggle('playing', state.isPlaying);
    if (els.orbArt) els.orbArt.classList.toggle('playing', state.isPlaying);
  }

  function renderModeUI() {
    var mode = PLAY_MODES[state.playModeIdx] || PLAY_MODES[0];
    if (els.modeLabel) els.modeLabel.textContent = mode.label;
    if (!els.modeIcon) return;
    if (mode.key === 'single') {
      els.modeIcon.innerHTML =
        '<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>';
    } else if (mode.key === 'shuffle') {
      els.modeIcon.innerHTML =
        '<svg viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
    } else {
      els.modeIcon.innerHTML =
        '<svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    }
  }

  function updateFloatingVisibility() {
    if (!els.pill || !els.orb) return;
    if (!state.active || state.roomOpen || state.orbHidden) {
      els.pill.classList.remove('show');
      els.orb.classList.remove('show');
      els.orb.classList.remove('confirm-hide');
      return;
    }
    if (state.orbMode) {
      els.pill.classList.remove('show');
      els.orb.classList.add('show');
    } else {
      els.orb.classList.remove('show');
      els.orb.classList.remove('confirm-hide');
      els.pill.classList.add('show');
    }
  }

  function updateMarqueeText(text) {
    if (!els.floatTxtInner) return;
    var safeText = text || '一起听';
    if (els.floatTxtInner.textContent === safeText) return;
    els.floatTxtInner.classList.remove('scrolling');
    els.floatTxtInner.textContent = safeText;
    requestAnimationFrame(function () {
      var box = els.floatTxtInner.parentElement;
      if (!box) return;
      var diff = els.floatTxtInner.scrollWidth - box.clientWidth;
      if (diff > 8) {
        els.floatTxtInner.style.setProperty('--ctl-scroll-dist', '-' + (diff + 14) + 'px');
        els.floatTxtInner.classList.add('scrolling');
      }
    });
  }

  function syncFloatText() {
    if (!state.currentSong) {
      updateMarqueeText('一起听');
      return;
    }
    if (state.lyrics.length && state.activeLyricIdx >= 0 && state.lyrics[state.activeLyricIdx]) {
      var line = state.lyrics[state.activeLyricIdx].text;
      if (line) {
        updateMarqueeText(line);
        return;
      }
    }
    updateMarqueeText(
      '正在与 ' + (state.contactName || 'Ta') + ' 一起听: ' + state.currentSong.name + ' - ' + state.currentSong.artist
    );
  }

  function openRoom() {
    if (!state.active) return;
    state.roomOpen = true;
    state.orbHidden = false;
    els.room.classList.add('open');
    updateFloatingVisibility();
  }

  function closeRoomToFloat() {
    state.roomOpen = false;
    els.room.classList.remove('open');
    updateFloatingVisibility();
  }

  function quitListenSession() {
    state.active = false;
    state.roomOpen = false;
    state.orbMode = false;
    state.orbHidden = false;
    state.isPlaying = false;
    state.elapsedSec = 0;
    clearInterval(state.timerId);
    state.timerId = null;
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.currentTime = 0;
      } catch (e) {}
    }
    els.room.classList.remove('open');
    updateFloatingVisibility();
    renderPlayButtons();
  }

  function startSessionTimer() {
    clearInterval(state.timerId);
    state.timerId = setInterval(function () {
      if (!state.active) return;
      state.elapsedSec += 1;
      if (els.timer) {
        els.timer.textContent = '一起听 · ' + fmtTime(state.elapsedSec);
      }
    }, 1000);
  }

  function ensureAudio() {
    if (state.audio) return state.audio;
    var audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', function () {
      if (state.seeking) return;
      var cur = audio.currentTime || 0;
      var dur = audio.duration || 0;
      if (els.curTime) els.curTime.textContent = fmtTime(cur);
      if (els.durTime && dur > 0) els.durTime.textContent = fmtTime(dur);
      if (els.progFill && dur > 0) {
        els.progFill.style.width = Math.min(100, (cur / dur) * 100) + '%';
      }
      syncLyricsByTime(cur);
    });
    audio.addEventListener('play', function () {
      state.isPlaying = true;
      renderPlayButtons();
    });
    audio.addEventListener('pause', function () {
      state.isPlaying = false;
      renderPlayButtons();
    });
    audio.addEventListener('ended', function () {
      playNext(true);
    });
    state.audio = audio;
    return audio;
  }

  function parseLrc(lrcStr) {
    if (!lrcStr) return [];
    var lines = lrcStr.split('\n');
    var out = [];
    var re = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var text = raw.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      var match;
      re.lastIndex = 0;
      while ((match = re.exec(raw)) !== null) {
        var m = parseInt(match[1], 10);
        var s = parseInt(match[2], 10);
        var ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
        var t = m * 60 + s + ms / 1000;
        if (text) out.push({ time: t, text: text });
      }
    }
    out.sort(function (a, b) { return a.time - b.time; });
    return out;
  }

  function renderLyricsDOM() {
    if (!els.lyrics) return;
    if (!state.lyrics.length) {
      els.lyrics.innerHTML = '<div class="ctl-lrc-empty">暂无歌词</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < state.lyrics.length; i++) {
      html +=
        '<div class="ctl-lrc-line" data-idx="' + i + '" data-time="' + state.lyrics[i].time + '">' +
        escHtml(state.lyrics[i].text) +
        '</div>';
    }
    els.lyrics.innerHTML = html;
  }

  function syncLyricsByTime(cur) {
    if (!state.lyrics.length) return;
    var idx = -1;
    for (var i = 0; i < state.lyrics.length; i++) {
      if (cur >= state.lyrics[i].time - 0.2) idx = i;
      else break;
    }
    if (idx === state.activeLyricIdx) return;
    state.activeLyricIdx = idx;
    var items = els.lyrics ? els.lyrics.querySelectorAll('.ctl-lrc-line') : [];
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('active', j === idx);
    }
    if (idx >= 0 && items[idx] && els.lyrics && state.showLyrics) {
      var targetTop = items[idx].offsetTop - els.lyrics.clientHeight / 2 + items[idx].offsetHeight / 2;
      els.lyrics.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
    syncFloatText();
  }

  function loadSongAndPlay(song, sendCard) {
    if (!song) return;
    state.active = true;
    state.orbHidden = false;
    state.currentSong = song;
    state.lyrics = [];
    state.activeLyricIdx = -1;

    var coverUrl = song.cover || '';
    if (els.songTitle) els.songTitle.textContent = song.name || '未知歌曲';
    if (els.songArtist) els.songArtist.textContent = song.artist || '未知歌手';
    if (els.disc) els.disc.style.backgroundImage = coverUrl ? 'url("' + coverUrl + '")' : '';
    if (els.roomBg) els.roomBg.style.backgroundImage = coverUrl ? 'url("' + coverUrl + '")' : '';
    if (els.floatCover) els.floatCover.style.backgroundImage = coverUrl ? 'url("' + coverUrl + '")' : '';
    if (els.orbArt) els.orbArt.style.backgroundImage = coverUrl ? 'url("' + coverUrl + '")' : '';
    if (els.progFill) els.progFill.style.width = '0%';
    if (els.curTime) els.curTime.textContent = '00:00';
    if (els.durTime) els.durTime.textContent = '00:00';

    if (els.peerAv) {
      if (state.contactAvatar) {
        els.peerAv.style.backgroundImage = 'url("' + state.contactAvatar + '")';
        els.peerAv.textContent = '';
      } else {
        els.peerAv.style.backgroundImage = '';
        els.peerAv.textContent = (state.contactName || 'Ta').slice(0, 1);
      }
    }

    syncFloatText();
    renderLyricsDOM();
    if (!state.timerId) {
      state.elapsedSec = 0;
      if (els.timer) els.timer.textContent = '一起听 · 00:00';
      startSessionTimer();
    }

    if (sendCard) {
      appendListenCardToChat(song);
    }

    openRoom();

    var api = getApiBase();
    var audio = ensureAudio();
    fetch(api + '/song/url/v1?id=' + encodeURIComponent(song.id) + '&level=standard')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var url = d && d.data && d.data[0] && d.data[0].url;
        if (!url) {
          showToast('该歌曲暂无可用音源');
          return;
        }
        audio.src = url;
        audio.play().catch(function () {});
      })
      .catch(function () {
        showToast('获取音源失败');
      });

    fetch(api + '/lyric?id=' + encodeURIComponent(song.id))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lrc = d && d.lrc && d.lrc.lyric;
        state.lyrics = parseLrc(lrc);
        renderLyricsDOM();
        syncFloatText();
      })
      .catch(function () {});
  }

  function playNext(fromEnded) {
    if (!state.playlist.length) return;
    var mode = PLAY_MODES[state.playModeIdx] || PLAY_MODES[0];
    if (fromEnded && mode.key === 'single') {
      if (state.audio) {
        state.audio.currentTime = 0;
        state.audio.play().catch(function () {});
      }
      return;
    }
    var nextIdx = state.currentIndex;
    if (mode.key === 'shuffle' && state.playlist.length > 1) {
      while (nextIdx === state.currentIndex) {
        nextIdx = Math.floor(Math.random() * state.playlist.length);
      }
    } else {
      nextIdx = (state.currentIndex + 1) % state.playlist.length;
    }
    state.currentIndex = nextIdx;
    loadSongAndPlay(state.playlist[nextIdx], false);
  }

  function playPrev() {
    if (!state.playlist.length) return;
    var mode = PLAY_MODES[state.playModeIdx] || PLAY_MODES[0];
    var prevIdx = state.currentIndex;
    if (mode.key === 'shuffle' && state.playlist.length > 1) {
      while (prevIdx === state.currentIndex) {
        prevIdx = Math.floor(Math.random() * state.playlist.length);
      }
    } else {
      prevIdx = (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
    }
    state.currentIndex = prevIdx;
    loadSongAndPlay(state.playlist[prevIdx], false);
  }

  function appendListenCardToChat(song) {
    var box = document.getElementById('ctRoomMessages');
    if (!box) return;
    var row = document.createElement('div');
    row.className = 'ct-msg-row me';
    var peerStyle = state.contactAvatar
      ? 'style="background-image:url(\'' + escHtml(state.contactAvatar) + '\')"'
      : '';
    var peerTxt = state.contactAvatar ? '' : escHtml((state.contactName || 'Ta').slice(0, 1));
    row.innerHTML =
      '<div class="ct-msg-bubble" style="background:transparent;padding:0;box-shadow:none;">' +
        '<div class="ctl-msg-card" data-song-id="' + escHtml(song.id) + '">' +
          '<div class="ctl-msg-top">' +
            '<div class="ctl-msg-cover" style="background-image:url(\'' + escHtml(song.cover || '') + '\')"></div>' +
            '<div class="ctl-msg-meta">' +
              '<div class="ctl-msg-title">' + escHtml(song.name) + '</div>' +
              '<div class="ctl-msg-artist">' + escHtml(song.artist) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ctl-msg-foot">' +
            '<span class="ctl-msg-tag">一起听</span>' +
            '<div class="ctl-msg-avatars">' +
              '<div class="ctl-msg-av">我</div>' +
              '<div class="ctl-msg-av" ' + peerStyle + '>' + peerTxt + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ct-msg-avatar">我</div>';

    var card = row.querySelector('.ctl-msg-card');
    bindPressFeedback(card);
    card.addEventListener('click', function () {
      if (state.active && state.currentSong && String(state.currentSong.id) === String(song.id)) {
        openRoom();
      } else {
        var info = getContactInfoFromRoom();
        state.threadId = info.threadId;
        state.contactId = info.contactId;
        state.contactName = info.contactName;
        state.contactAvatar = info.contactAvatar;
        loadSongAndPlay(song, false);
      }
    });

    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  function renderSongPickerList(songs) {
    if (!els.songList) return;
    if (!songs || !songs.length) {
      els.songList.innerHTML = '<div class="ctl-list-tip">没有找到相关歌曲</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < songs.length; i++) {
      var s = songs[i];
      html +=
        '<div class="ctl-song-item" data-idx="' + i + '">' +
          '<div class="ctl-song-item-cov" style="background-image:url(\'' + escHtml(s.cover || '') + '\')"></div>' +
          '<div class="ctl-song-item-info">' +
            '<div class="ctl-song-item-t">' + escHtml(s.name) + '</div>' +
            '<div class="ctl-song-item-s">' + escHtml(s.artist) + '</div>' +
          '</div>' +
        '</div>';
    }
    els.songList.innerHTML = html;

    var items = els.songList.querySelectorAll('.ctl-song-item');
    items.forEach(function (item) {
      bindPressFeedback(item);
      item.addEventListener('click', function () {
        var idx = parseInt(item.getAttribute('data-idx'), 10);
        var chosen = songs[idx];
        if (!chosen) return;
        state.playlist = songs.slice();
        state.currentIndex = idx;
        var shouldSendCard = !state.active;
        closeSongModal();
        loadSongAndPlay(chosen, shouldSendCard);
      });
    });
  }

  function fetchInitialSongs() {
    if (!els.songList) return;
    els.songList.innerHTML = '<div class="ctl-list-tip">正在加载曲库…</div>';
    var api = getApiBase();
    fetch(api + '/personalized/newsong?limit=20')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var arr = (d && d.result) || [];
        var list = arr.map(function (item) {
          var song = item.song || item;
          var artists = (song.artists || []).map(function (a) { return a.name; }).join(' / ');
          return {
            id: item.id,
            name: item.name || song.name,
            artist: artists || '未知歌手',
            cover: item.picUrl || (song.album && song.album.picUrl) || ''
          };
        });
        renderSongPickerList(list);
      })
      .catch(function () {
        els.songList.innerHTML = '<div class="ctl-list-tip">加载失败，请试试搜索歌名</div>';
      });
  }

  function searchSongs(kw) {
    if (!kw) {
      fetchInitialSongs();
      return;
    }
    if (!els.songList) return;
    els.songList.innerHTML = '<div class="ctl-list-tip">搜索中…</div>';
    var api = getApiBase();
    fetch(api + '/cloudsearch?keywords=' + encodeURIComponent(kw) + '&limit=20')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var songs = (d && d.result && d.result.songs) || [];
        var list = songs.map(function (s) {
          var ar = (s.ar || s.artists || []).map(function (a) { return a.name; }).join(' / ');
          var cov = (s.al && s.al.picUrl) || (s.album && s.album.picUrl) || '';
          return {
            id: s.id,
            name: s.name,
            artist: ar || '未知歌手',
            cover: cov
          };
        });
        renderSongPickerList(list);
      })
      .catch(function () {
        els.songList.innerHTML = '<div class="ctl-list-tip">搜索失败，请检查网络</div>';
      });
  }

  function openSongModal() {
    buildGlobalDOM();
    if (!state.active) {
      var info = getContactInfoFromRoom();
      state.threadId = info.threadId;
      state.contactId = info.contactId;
      state.contactName = info.contactName;
      state.contactAvatar = info.contactAvatar;
    }
    els.modal.classList.add('open');
    if (els.searchInput) els.searchInput.value = '';
    fetchInitialSongs();
  }

  function closeSongModal() {
    if (els.modal) els.modal.classList.remove('open');
  }

  function setupOrbDragAndLongPress() {
    var orb = els.orb;
    if (!orb) return;
    var startX = 0;
    var startY = 0;
    var origLeft = 0;
    var origTop = 0;
    var moved = false;
    var lpTimer = null;
    var lpTriggered = false;

    function getScale() {
      var rect = els.container.getBoundingClientRect();
      return rect.width / (els.container.offsetWidth || 393) || 1;
    }

    function onStart(e) {
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      origLeft = orb.offsetLeft;
      origTop = orb.offsetTop;
      moved = false;
      lpTriggered = false;
      orb.classList.add('is-pressed');

      clearTimeout(lpTimer);
      lpTimer = setTimeout(function () {
        if (!moved) {
          lpTriggered = true;
          orb.classList.remove('is-pressed');
          orb.classList.add('confirm-hide');
        }
      }, 460);
    }

    function onMove(e) {
      var pt = e.touches ? e.touches[0] : e;
      var scale = getScale();
      var dx = (pt.clientX - startX) / scale;
      var dy = (pt.clientY - startY) / scale;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        moved = true;
        clearTimeout(lpTimer);
        orb.classList.remove('confirm-hide');
        orb.classList.add('dragging');
        var cw = els.container.offsetWidth || 393;
        var ch = els.container.offsetHeight || 852;
        var nx = Math.max(6, Math.min(cw - orb.offsetWidth - 6, origLeft + dx));
        var ny = Math.max(54, Math.min(ch - orb.offsetHeight - 36, origTop + dy));
        orb.style.left = nx + 'px';
        orb.style.top = ny + 'px';
      }
    }

    function onEnd() {
      clearTimeout(lpTimer);
      orb.classList.remove('is-pressed');
      orb.classList.remove('dragging');
      if (moved) {
        var cw = els.container.offsetWidth || 393;
        var mid = orb.offsetLeft + orb.offsetWidth / 2;
        orb.style.left = (mid < cw / 2 ? 10 : cw - orb.offsetWidth - 10) + 'px';
        return;
      }
      if (lpTriggered) return;
      if (orb.classList.contains('confirm-hide')) {
        state.orbHidden = true;
        orb.classList.remove('confirm-hide');
        updateFloatingVisibility();
        showToast('已隐藏悬浮，点聊天卡片可再打开');
      } else {
        state.orbMode = false;
        updateFloatingVisibility();
      }
    }

    orb.addEventListener('touchstart', onStart, { passive: true });
    orb.addEventListener('touchmove', onMove, { passive: true });
    orb.addEventListener('touchend', onEnd);
    orb.addEventListener('mousedown', function (e) {
      onStart(e);
      var mm = function (ev) { onMove(ev); };
      var mu = function () {
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
        onEnd();
      };
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    });

    document.addEventListener('touchstart', function (e) {
      if (orb.classList.contains('confirm-hide') && !orb.contains(e.target)) {
        orb.classList.remove('confirm-hide');
      }
    }, { passive: true });
  }

  function bindGlobalEvents() {
    [
      els.pill,
      els.floatPlayBtn,
      els.floatNextBtn,
      els.floatToOrbBtn,
      els.collapseBtn,
      els.quitBtn,
      els.changeBtn,
      els.modeBtn,
      els.prevBtn,
      els.playBtn,
      els.nextBtn
    ].forEach(bindPressFeedback);

    els.collapseBtn.addEventListener('click', closeRoomToFloat);
    els.quitBtn.addEventListener('click', quitListenSession);

    els.pill.addEventListener('click', function (e) {
      if (
        e.target.closest('#ctlFloatPlayBtn') ||
        e.target.closest('#ctlFloatNextBtn') ||
        e.target.closest('#ctlFloatToOrbBtn')
      ) {
        return;
      }
      openRoom();
    });

    els.floatPlayBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlay();
    });

    els.floatNextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      playNext(false);
    });

    els.floatToOrbBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      state.orbMode = true;
      updateFloatingVisibility();
    });

    els.playBtn.addEventListener('click', togglePlay);
    els.nextBtn.addEventListener('click', function () { playNext(false); });
    els.prevBtn.addEventListener('click', playPrev);

    els.modeBtn.addEventListener('click', function () {
      state.playModeIdx = (state.playModeIdx + 1) % PLAY_MODES.length;
      renderModeUI();
    });

    els.changeBtn.addEventListener('click', openSongModal);
    els.modalClose.addEventListener('click', closeSongModal);
    els.modal.addEventListener('click', function (e) {
      if (e.target === els.modal) closeSongModal();
    });

    els.searchInput.addEventListener('input', function () {
      clearTimeout(state.searchTimer);
      var val = els.searchInput.value.trim();
      state.searchTimer = setTimeout(function () {
        searchSongs(val);
      }, 320);
    });

    els.stage.addEventListener('click', function (e) {
      var line = e.target.closest('.ctl-lrc-line');
      if (line && state.showLyrics) {
        var t = parseFloat(line.getAttribute('data-time'));
        if (!isNaN(t) && state.audio) {
          state.audio.currentTime = t;
          if (state.audio.paused) state.audio.play().catch(function () {});
        }
        return;
      }
      state.showLyrics = !state.showLyrics;
      els.stage.classList.toggle('show-lyrics', state.showLyrics);
      if (state.showLyrics && state.activeLyricIdx >= 0) {
        var items = els.lyrics.querySelectorAll('.ctl-lrc-line');
        if (items[state.activeLyricIdx]) {
          var targetTop =
            items[state.activeLyricIdx].offsetTop -
            els.lyrics.clientHeight / 2 +
            items[state.activeLyricIdx].offsetHeight / 2;
          els.lyrics.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
      }
    });

    /* 进度条拖动/点击跳转 */
    var handleSeek = function (clientX) {
      if (!state.audio || !state.audio.duration) return;
      var rect = els.progWrap.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      els.progFill.style.width = (ratio * 100) + '%';
      var t = ratio * state.audio.duration;
      els.curTime.textContent = fmtTime(t);
      return t;
    };

    els.progWrap.addEventListener('touchstart', function (e) {
      state.seeking = true;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });
    els.progWrap.addEventListener('touchmove', function (e) {
      if (!state.seeking) return;
      handleSeek(e.touches[0].clientX);
    }, { passive: true });
    els.progWrap.addEventListener('touchend', function (e) {
      if (!state.seeking) return;
      state.seeking = false;
      var t = handleSeek(e.changedTouches[0].clientX);
      if (typeof t === 'number' && state.audio) state.audio.currentTime = t;
    });
    els.progWrap.addEventListener('click', function (e) {
      var t = handleSeek(e.clientX);
      if (typeof t === 'number' && state.audio) state.audio.currentTime = t;
    });

    setupOrbDragAndLongPress();
  }

  function togglePlay() {
    if (!state.audio) return;
    if (state.audio.paused) {
      state.audio.play().catch(function () {});
    } else {
      state.audio.pause();
    }
  }

  function hookDrawerListenTile() {
    document.addEventListener('click', function (e) {
      var tile = e.target.closest('.ctp-item');
      if (!tile) return;
      var txt = (tile.textContent || '').trim();
      if (txt.indexOf('一起听') !== -1) {
        e.stopPropagation();
        var drawer = document.getElementById('ctpDrawer');
        if (drawer) drawer.classList.remove('open');
        openSongModal();
      }
    }, true);
  }

  window.PhoneChatListen = {
    openSongModal: openSongModal,
    openRoom: openRoom,
    quit: quitListenSession
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildGlobalDOM();
      hookDrawerListenTile();
    });
  } else {
    buildGlobalDOM();
    hookDrawerListenTile();
  }
})();
