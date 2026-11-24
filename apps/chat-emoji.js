/* =========================================================
   Chat 表情包发送抽屉 & 联想搜图 & 偷表情包 (apps/chat-emoji.js)
   - 拦截 #ctRoomEmojiBtn，独立挂载在 #ctRoomFooter，不修改 apps/chat.js
   - 同步 PhoneChatMe.getStickerPacks() / getStickerImage()
   - 支持点击发送表情包气泡、联想搜图条、长按对方表情包偷存进自己分组
   ========================================================= */

(function () {
  const MSGS_PREFIX = 'chat_msgs_v1_';
  const THREADS_KEY = 'chat_threads_v1';
  const STICKERS_KEY = 'chat_sticker_packs_v1';

  let drawerEl = null;
  let assocBarEl = null;
  let activePackId = 'all';
  let isDrawerOpen = false;
  let imgCache = {};

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const el = document.getElementById('ctToast');
    if (!el || !msg) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 1900);
  }

  function bindPressed(root) {
    if (!root || root.dataset.ctePressBound) return;
    root.dataset.ctePressBound = '1';
    const sel = '.cte-tab, .cte-cell, .cte-assoc-chip, .cte-empty-btn';
    let cur = null;
    root.addEventListener('touchstart', (e) => {
      const t = e.target.closest(sel);
      if (t) {
        if (cur) cur.classList.remove('is-pressed');
        cur = t;
        cur.classList.add('is-pressed');
      }
    }, { passive: true });
    const clear = () => {
      if (cur) { cur.classList.remove('is-pressed'); cur = null; }
    };
    root.addEventListener('touchmove', clear, { passive: true });
    root.addEventListener('touchend', clear, { passive: true });
    root.addEventListener('touchcancel', clear, { passive: true });
  }

  function getPacks() {
    try {
      if (window.PhoneChatMe && typeof window.PhoneChatMe.getStickerPacks === 'function') {
        return window.PhoneChatMe.getStickerPacks() || [];
      }
    } catch (e) {}
    const raw = loadJSON(STICKERS_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  function loadStickerSrc(dbKey, imgEl) {
    if (!dbKey || !imgEl) return;
    if (imgCache[dbKey]) {
      imgEl.src = imgCache[dbKey];
      return;
    }
    if (window.PhoneChatMe && typeof window.PhoneChatMe.getStickerImage === 'function') {
      window.PhoneChatMe.getStickerImage(dbKey).then((url) => {
        if (url && imgEl) {
          imgCache[dbKey] = url;
          imgEl.src = url;
        }
      });
    }
  }

  function getCurrentThreadId() {
    try {
      if (window.PhoneChat && typeof window.PhoneChat.getCurrentThreadId === 'function') {
        return window.PhoneChat.getCurrentThreadId();
      }
    } catch (e) {}
    return '';
  }

  function getThreadSettings(tid) {
    try {
      if (tid && window.PhoneChatDetails && typeof window.PhoneChatDetails.getSettings === 'function') {
        return window.PhoneChatDetails.getSettings(tid) || {};
      }
    } catch (e) {}
    return {};
  }

  function sendSticker(st) {
    const tid = getCurrentThreadId();
    if (!tid || !st) return;

    const settings = getThreadSettings(tid);
    if (settings.blocked) {
      showToast('已拉黑该联系人，请先解除拉黑');
      return;
    }

    let isChar = false;
    let charId = '';
    try {
      if (window.PhoneChatMe && typeof window.PhoneChatMe.getActiveAccount === 'function') {
        const acc = window.PhoneChatMe.getActiveAccount();
        if (acc && acc.type === 'char' && acc.charId) {
          isChar = true;
          charId = acc.charId;
        }
      }
    } catch (e) {}

    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const msgs = loadJSON(MSGS_PREFIX + tid, []);
    msgs.push({
      id: 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sender: isChar ? 'char' : 'me',
      charId: isChar ? charId : undefined,
      type: 'sticker',
      stickerId: st.id || '',
      stickerName: st.name || '表情',
      stickerDbKey: st.dbKey || '',
      text: `[表情:${st.name || '表情'}]`,
      time: nowTime
    });
    saveJSON(MSGS_PREFIX + tid, msgs);

    const threads = loadJSON(THREADS_KEY, []);
    const idx = threads.findIndex(t => t.id === tid);
    if (idx !== -1) {
      threads[idx].lastMsg = `[表情] ${st.name || ''}`.trim();
      threads[idx].lastTime = nowTime;
      saveJSON(THREADS_KEY, threads);
    }

    if (window.PhoneChat && typeof window.PhoneChat.refreshMessages === 'function') {
      window.PhoneChat.refreshMessages();
    }
    hideAssocBar();
  }

  /* ---------------- 偷对方发的表情包进自己分组 ---------------- */
  function stealStickerToMine(msgObj) {
    if (!msgObj || !msgObj.stickerDbKey) return;
    const packs = getPacks();
    let targetPack = packs[0];
    if (!targetPack) {
      targetPack = {
        id: 'pack_' + Date.now().toString(36),
        name: '偷来的表情包',
        createdAt: Date.now(),
        items: []
      };
      packs.unshift(targetPack);
    }
    if (!Array.isArray(targetPack.items)) targetPack.items = [];
    if (targetPack.items.some(it => it.dbKey === msgObj.stickerDbKey)) {
      showToast('表情包里已经有了');
      return;
    }
    targetPack.items.unshift({
      id: 'stk_' + Date.now().toString(36),
      name: msgObj.stickerName || '表情',
      tag: msgObj.stickerName || '表情',
      dbKey: msgObj.stickerDbKey,
      createdAt: Date.now()
    });
    saveJSON(STICKERS_KEY, packs);
    showToast(`已存进「${targetPack.name}」`);
    if (isDrawerOpen) renderDrawer();
  }

  /* ---------------- 联想搜图条 ---------------- */
  function ensureUI() {
    const footer = document.getElementById('ctRoomFooter');
    if (!footer) return false;

    if (!assocBarEl || !footer.contains(assocBarEl)) {
      assocBarEl = document.createElement('div');
      assocBarEl.className = 'cte-assoc-bar';
      assocBarEl.id = 'cteAssocBar';
      footer.insertBefore(assocBarEl, footer.firstChild);
      bindPressed(assocBarEl);
    }

    if (!drawerEl || !footer.contains(drawerEl)) {
      drawerEl = document.createElement('div');
      drawerEl.className = 'cte-drawer';
      drawerEl.id = 'cteDrawer';
      footer.appendChild(drawerEl);
      bindPressed(drawerEl);
    }
    return true;
  }

  function hideAssocBar() {
    if (assocBarEl) {
      assocBarEl.classList.remove('show');
      assocBarEl.innerHTML = '';
    }
  }

  function updateAssocSearch(keyword) {
    if (!ensureUI()) return;
    const tid = getCurrentThreadId();
    const settings = getThreadSettings(tid);
    const kw = String(keyword || '').trim().toLowerCase();
    if (!tid || !settings.stickerAssocSearch || !kw) {
      hideAssocBar();
      return;
    }

    const packs = getPacks();
    const pool = [];
    packs.forEach(p => {
      (Array.isArray(p.items) ? p.items : []).forEach(st => {
        const hay = `${st.name || ''} ${st.tag || ''}`.toLowerCase();
        if (hay.includes(kw)) pool.push(st);
      });
    });

    const hits = pool.slice(0, 10);
    if (!hits.length) {
      hideAssocBar();
      return;
    }

    assocBarEl.innerHTML = hits.map((st, idx) => `
      <button type="button" class="cte-assoc-chip" data-assoc-idx="${idx}" title="${esc(st.name || '')}">
        <img data-cte-key="${esc(st.dbKey)}" alt="${esc(st.name || '')}">
      </button>
    `).join('');
    assocBarEl.classList.add('show');

    assocBarEl.querySelectorAll('img[data-cte-key]').forEach(img => {
      loadStickerSrc(img.getAttribute('data-cte-key'), img);
    });
    assocBarEl.querySelectorAll('[data-assoc-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = hits[Number(btn.dataset.assocIdx)];
        if (st) {
          const inp = document.getElementById('ctRoomInput');
          if (inp) inp.value = '';
          sendSticker(st);
        }
      });
    });
  }

  /* ---------------- 表情包抽屉渲染与开关 ---------------- */
  function renderDrawer() {
    if (!ensureUI()) return;
    const packs = getPacks();
    if (activePackId !== 'all' && !packs.some(p => p.id === activePackId)) {
      activePackId = 'all';
    }

    let items = [];
    if (activePackId === 'all') {
      packs.forEach(p => {
        if (Array.isArray(p.items)) items = items.concat(p.items);
      });
    } else {
      const target = packs.find(p => p.id === activePackId);
      if (target && Array.isArray(target.items)) items = target.items;
    }

    const tabsHtml = [
      `<button type="button" class="cte-tab ${activePackId === 'all' ? 'active' : ''}" data-cte-pack="all">全部</button>`
    ].concat(packs.map(p =>
      `<button type="button" class="cte-tab ${activePackId === p.id ? 'active' : ''}" data-cte-pack="${esc(p.id)}">${esc(p.name)}</button>`
    )).join('');

    const bodyHtml = items.length
      ? `<div class="cte-grid">${items.map((st, idx) => `
          <button type="button" class="cte-cell" data-cte-idx="${idx}">
            <div class="cte-cell-box"><img data-cte-key="${esc(st.dbKey)}" alt="${esc(st.name || '')}"></div>
            <div class="cte-cell-name">${esc(st.name || '表情')}</div>
          </button>
        `).join('')}</div>`
      : `<div class="cte-empty">
          还没有导入表情包<br>
          <button type="button" class="cte-empty-btn" id="cteGoImportBtn">去「我的 → 表情包」导入</button>
         </div>`;

    drawerEl.innerHTML = `
      <div class="cte-tabs">${tabsHtml}</div>
      <div class="cte-grid-wrap">${bodyHtml}</div>
    `;

    drawerEl.querySelectorAll('img[data-cte-key]').forEach(img => {
      loadStickerSrc(img.getAttribute('data-cte-key'), img);
    });

    drawerEl.querySelectorAll('[data-cte-pack]').forEach(btn => {
      btn.addEventListener('click', () => {
        activePackId = btn.dataset.ctePack;
        renderDrawer();
      });
    });

    drawerEl.querySelectorAll('[data-cte-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = items[Number(btn.dataset.cteIdx)];
        if (st) sendSticker(st);
      });
    });

    const goBtn = drawerEl.querySelector('#cteGoImportBtn');
    if (goBtn) {
      goBtn.addEventListener('click', () => {
        closeDrawer();
        const backBtn = document.getElementById('ctRoomBackBtn');
        if (backBtn) backBtn.click();
        setTimeout(() => {
          const meTab = document.querySelector('#app-chat .ct-tab-btn[data-tab="me"]');
          if (meTab) meTab.click();
          setTimeout(() => {
            if (window.PhoneChatMe && typeof window.PhoneChatMe.openSubpage === 'function') {
              window.PhoneChatMe.openSubpage('stickers');
            }
          }, 80);
        }, 120);
      });
    }
  }

  function openDrawer() {
    if (!ensureUI()) return;
    const inp = document.getElementById('ctRoomInput');
    if (inp) inp.blur();
    // 互斥收起「+」号面板
    const plusDrawer = document.querySelector('#ctRoomFooter .ctp-drawer.open');
    if (plusDrawer) plusDrawer.classList.remove('open');

    renderDrawer();
    isDrawerOpen = true;
    drawerEl.classList.add('open');
    const msgBox = document.getElementById('ctRoomMessages');
    if (msgBox) setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 120);
  }

  function closeDrawer() {
    isDrawerOpen = false;
    if (drawerEl) drawerEl.classList.remove('open');
  }

  /* ---------------- 聊天消息气泡图片水合 ---------------- */
  function hydrateStickerBubbles() {
    const tid = getCurrentThreadId();
    const box = document.getElementById('ctRoomMessages');
    if (!tid || !box) return;
    const msgs = loadJSON(MSGS_PREFIX + tid, []);
    if (!Array.isArray(msgs) || !msgs.length) return;

    const msgMap = new Map(msgs.map(m => [m.id, m]));
    box.querySelectorAll('.ct-msg-group[data-msg-id]').forEach(group => {
      const mid = group.dataset.msgId;
      const m = msgMap.get(mid);
      if (!m || m.type !== 'sticker' || !m.stickerDbKey) return;
      const bubble = group.querySelector('.ct-msg-bubble');
      if (!bubble || bubble.dataset.cteHydrated === '1') return;

      bubble.dataset.cteHydrated = '1';
      bubble.classList.add('cte-sticker-bubble');
      bubble.innerHTML = `<img class="cte-msg-sticker-img" alt="${esc(m.stickerName || '表情')}">`;
      const img = bubble.querySelector('img');
      loadStickerSrc(m.stickerDbKey, img);

      // 非自己发的表情包，长按可偷进自己的分组
      if (!group.classList.contains('me')) {
        let lpTimer = null;
        bubble.addEventListener('touchstart', () => {
          lpTimer = setTimeout(() => stealStickerToMine(m), 520);
        }, { passive: true });
        const cancelLP = () => clearTimeout(lpTimer);
        bubble.addEventListener('touchmove', cancelLP, { passive: true });
        bubble.addEventListener('touchend', cancelLP, { passive: true });
        bubble.addEventListener('touchcancel', cancelLP, { passive: true });
      }
    });
  }

  function init() {
    document.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('#ctRoomEmojiBtn');
      if (emojiBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isDrawerOpen) closeDrawer();
        else openDrawer();
        return;
      }

      if (e.target.closest('#ctRoomPlusBtn') || e.target.closest('#ctRoomVoiceBtn') || e.target.closest('#ctRoomBackBtn')) {
        closeDrawer();
      }
    }, true);

    document.addEventListener('focusin', (e) => {
      if (e.target && e.target.id === 'ctRoomInput') {
        closeDrawer();
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'ctRoomInput') {
        updateAssocSearch(e.target.value);
      }
    });

    const appChat = document.getElementById('app-chat');
    if (appChat) {
      let queued = false;
      const obs = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          hydrateStickerBubbles();
        });
      });
      obs.observe(appChat, { childList: true, subtree: true });
    }
  }

  window.PhoneChatEmoji = {
    open: openDrawer,
    close: closeDrawer,
    sendSticker: sendSticker
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
