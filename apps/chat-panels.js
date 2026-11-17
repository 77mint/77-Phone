(function () {
  const STORAGE_KEY = 'phone_presets_list_v1';
  const ACTIVE_ONLINE_KEY = 'phone_presets_active_online_v1';
  const ACTIVE_OFFLINE_KEY = 'phone_presets_active_offline_v1';

  const SLOT_TYPES = [
    { id: 'text', label: '普通提示词' },
    { id: 'char', label: '角色设定插槽' },
    { id: 'lore_before', label: '世界书(前)插槽' },
    { id: 'lore_after', label: '世界书(后)插槽' },
    { id: 'history', label: '聊天记录插槽' }
  ];

  let presets = [];
  let activeOnlineId = '';
  let activeOfflineId = '';
  let currentTab = 'online'; // 'online' | 'offline'
  let searchKeyword = '';
  let editingId = null;
  let expandedEntryId = null;
  let ctxTargetId = null;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      presets = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(presets)) presets = [];
      presets.forEach(p => {
        if (!p.scene) p.scene = 'online';
      });
    } catch (e) {
      presets = [];
    }
    activeOnlineId = localStorage.getItem(ACTIVE_ONLINE_KEY) || '';
    activeOfflineId = localStorage.getItem(ACTIVE_OFFLINE_KEY) || '';
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    if (activeOnlineId) localStorage.setItem(ACTIVE_ONLINE_KEY, activeOnlineId);
    else localStorage.removeItem(ACTIVE_ONLINE_KEY);

    if (activeOfflineId) localStorage.setItem(ACTIVE_OFFLINE_KEY, activeOfflineId);
    else localStorage.removeItem(ACTIVE_OFFLINE_KEY);
  }

  function getActiveIdForScene(scene) {
    return scene === 'offline' ? activeOfflineId : activeOnlineId;
  }

  function setActiveIdForScene(scene, id) {
    if (scene === 'offline') activeOfflineId = id;
    else activeOnlineId = id;
  }

  function estimateTokens(text) {
    if (!text) return 0;
    const str = String(text);
    const cjkMatches = str.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    const otherCount = str.length - cjkCount;
    return Math.max(1, Math.round(cjkCount * 1.5 + otherCount * 0.28));
  }

  function calcPresetTokens(preset) {
    if (!preset || !Array.isArray(preset.entries)) return 0;
    return preset.entries.reduce((sum, entry) => {
      if (!entry.enabled || entry.slot !== 'text') return sum;
      return sum + estimateTokens(entry.content);
    }, 0);
  }

  function uid(prefix) {
    return (prefix || 'pr') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getEditingPreset() {
    return presets.find(p => p.id === editingId) || null;
  }

  function roleBadgeText(role) {
    if (role === 'user') return 'USR';
    if (role === 'assistant') return 'AST';
    return 'SYS';
  }

  function slotLabelText(slot) {
    const found = SLOT_TYPES.find(s => s.id === slot);
    return found ? found.label : '普通提示词';
  }

  function bindPress(el) {
    if (!el || el.dataset.pressBound) return;
    el.dataset.pressBound = '1';
    let sx = 0;
    let sy = 0;
    el.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }
      el.classList.add('is-pressed');
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) {
        el.classList.remove('is-pressed');
      }
    }, { passive: true });
    el.addEventListener('touchend', () => el.classList.remove('is-pressed'), { passive: true });
    el.addEventListener('touchcancel', () => el.classList.remove('is-pressed'), { passive: true });
    el.addEventListener('mousedown', () => el.classList.add('is-pressed'));
    el.addEventListener('mouseup', () => el.classList.remove('is-pressed'));
    el.addEventListener('mouseleave', () => el.classList.remove('is-pressed'));
  }

  function renderFolderSvg(uidStr) {
    return `
      <svg class="pr-folder-svg" viewBox="0 0 100 82" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fg_${uidStr}" x1="50" y1="23" x2="50" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6AC6FA"/>
            <stop offset="100%" stop-color="#41ABF1"/>
          </linearGradient>
        </defs>
        <path d="M6 12C6 7.58172 9.58172 4 14 4H32.2C34.75 4 37.16 5.15 38.75 7.12L42.2 11.4C43.1 12.5 44.44 13.14 45.85 13.14H86C90.4183 13.14 94 16.7217 94 21.14V68C94 72.4183 90.4183 76 86 76H14C9.58172 76 6 72.4183 6 68V12Z" fill="#3D9EE5"/>
        <rect x="9.5" y="17.5" width="81" height="16" rx="4.5" fill="#FFFFFF"/>
        <rect x="6" y="23.5" width="88" height="52.5" rx="8.5" fill="url(#fg_${uidStr})"/>
        <path d="M14.5 24H85.5C90.1944 24 94 27.8056 94 32.5V33.4C94 28.7056 90.1944 24.9 85.5 24.9H14.5C9.80558 24.9 6 28.7056 6 33.4V32.5C6 27.8056 9.80558 24 14.5 24Z" fill="#9FD8FC" fill-opacity="0.6"/>
      </svg>
    `;
  }

  function renderDOM() {
    const root = document.getElementById('app-presets');
    if (!root) return;

    root.innerHTML = `
      <div class="pr-wrap">
        <div class="pr-topbar">
          <div class="pr-topbar-left">
            <button class="app-back" id="prBackBtn" data-close-app type="button" aria-label="返回">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="pr-title" id="prPageTitle">预设</div>
          </div>
          <div class="pr-topbar-actions">
            <button class="pr-pill-btn" id="prImportBtn" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              导入
            </button>
            <button class="pr-pill-btn is-dark" id="prNewBtn" type="button">+ 新建</button>
          </div>
        </div>

        <div class="pr-search-wrap is-hidden" id="prSearchWrap">
          <div class="pr-search-box">
            <span class="pr-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input class="pr-search-input" id="prSearchInput" type="search" placeholder="搜索" autocomplete="off" />
          </div>
        </div>

        <div class="pr-scroll" id="prListScroll"></div>

        <div class="pr-bottom-bar">
          <button class="pr-tab-btn is-active" data-tab="online" type="button">线上</button>
          <button class="pr-tab-btn" data-tab="offline" type="button">线下</button>
        </div>

        <div class="pr-detail" id="prDetailView">
          <div class="pr-topbar">
            <div class="pr-topbar-left">
              <input class="pr-detail-name-input" id="prDetailName" type="text" placeholder="预设名称" />
            </div>
            <div class="pr-topbar-actions">
              <button class="pr-icon-btn" id="prExportBtn" type="button" aria-label="导出">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
              <button class="pr-icon-btn" id="prCloseDetailBtn" type="button" aria-label="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="pr-scroll" id="prDetailScroll"></div>
        </div>

        <div class="pr-modal-mask" id="prNewModal">
          <div class="pr-modal">
            <div class="pr-modal-head">
              <div class="pr-modal-title" id="prNewModalTitle">新建线上预设</div>
              <button class="pr-icon-btn" id="prCloseModalBtn" type="button" aria-label="关闭">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <input class="pr-input" id="prNewNameInput" type="text" placeholder="输入预设名称" />
            <button class="pr-modal-submit" id="prCreateConfirmBtn" type="button">创建</button>
          </div>
        </div>

        <div class="pr-ctx-mask" id="prCtxMask"></div>
        <div class="pr-ctx-sheet" id="prCtxSheet">
          <div class="pr-ctx-card">
            <div class="pr-ctx-header">
              <div class="pr-ctx-title" id="prCtxTitle">预设</div>
              <div class="pr-ctx-sub" id="prCtxSub"></div>
            </div>
            <button class="pr-ctx-btn" id="prCtxUseBtn" type="button">设为当前启用</button>
            <button class="pr-ctx-btn" id="prCtxEditBtn" type="button">打开编辑</button>
            <button class="pr-ctx-btn" id="prCtxExportBtn" type="button">导出 JSON</button>
            <button class="pr-ctx-btn is-danger" id="prCtxDelBtn" type="button">删除预设</button>
          </div>
          <button class="pr-ctx-cancel" id="prCtxCancelBtn" type="button">取消</button>
        </div>

        <input type="file" id="prImportFile" accept=".json,application/json" style="display:none" />
      </div>
    `;

    bindBaseEvents(root);
    renderList();
  }

  function bindBaseEvents(root) {
    const newBtn = root.querySelector('#prNewBtn');
    const newModal = root.querySelector('#prNewModal');
    const newModalTitle = root.querySelector('#prNewModalTitle');
    const newInput = root.querySelector('#prNewNameInput');
    const closeModalBtn = root.querySelector('#prCloseModalBtn');
    const createConfirmBtn = root.querySelector('#prCreateConfirmBtn');
    const backBtn = root.querySelector('#prBackBtn');
    const importBtn = root.querySelector('#prImportBtn');
    const importFile = root.querySelector('#prImportFile');
    const searchInput = root.querySelector('#prSearchInput');
    const exportBtn = root.querySelector('#prExportBtn');
    const closeDetailBtn = root.querySelector('#prCloseDetailBtn');

    [newBtn, importBtn, closeModalBtn, createConfirmBtn, exportBtn, closeDetailBtn].forEach(bindPress);

    root.querySelectorAll('.pr-tab-btn').forEach(btn => {
      bindPress(btn);
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;
        currentTab = tab;
        root.querySelectorAll('.pr-tab-btn').forEach(b => b.classList.toggle('is-active', b === btn));
        if (backBtn) backBtn.style.display = currentTab === 'online' ? '' : 'none';
        renderList();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchKeyword = searchInput.value || '';
        renderList();
      });
    }

    newBtn.addEventListener('click', () => {
      newModalTitle.textContent = currentTab === 'offline' ? '新建线下预设' : '新建线上预设';
      newInput.value = '';
      newModal.classList.add('is-open');
      setTimeout(() => newInput.focus(), 60);
    });

    closeModalBtn.addEventListener('click', () => newModal.classList.remove('is-open'));
    newModal.addEventListener('click', (e) => {
      if (e.target === newModal) newModal.classList.remove('is-open');
    });

    createConfirmBtn.addEventListener('click', () => {
      const name = newInput.value.trim() || '未命名预设';
      const item = {
        id: uid('pr'),
        scene: currentTab,
        name: name,
        temperature: 0.85,
        topP: 0.95,
        entries: []
      };
      presets.unshift(item);
      if (!getActiveIdForScene(currentTab)) setActiveIdForScene(currentTab, item.id);
      saveData();
      newModal.classList.remove('is-open');
      renderList();
      openDetail(item.id);
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          const imported = parseSTPreset(json, file.name.replace(/\.json$/i, ''), currentTab);
          presets.unshift(imported);
          if (!getActiveIdForScene(currentTab)) setActiveIdForScene(currentTab, imported.id);
          saveData();
          renderList();
          openDetail(imported.id);
        } catch (err) {
          alert('预设文件解析失败，请确认是有效的 JSON 文件');
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    });

    closeDetailBtn.addEventListener('click', closeDetail);
    exportBtn.addEventListener('click', () => exportPresetById(editingId));

    const nameInput = root.querySelector('#prDetailName');
    nameInput.addEventListener('input', () => {
      const p = getEditingPreset();
      if (!p) return;
      p.name = nameInput.value;
      saveData();
      renderList();
    });

    const ctxMask = root.querySelector('#prCtxMask');
    const ctxCancel = root.querySelector('#prCtxCancelBtn');
    const ctxUse = root.querySelector('#prCtxUseBtn');
    const ctxEdit = root.querySelector('#prCtxEditBtn');
    const ctxExport = root.querySelector('#prCtxExportBtn');
    const ctxDel = root.querySelector('#prCtxDelBtn');

    [ctxCancel, ctxUse, ctxEdit, ctxExport, ctxDel].forEach(bindPress);

    ctxMask.addEventListener('click', closeFolderMenu);
    ctxCancel.addEventListener('click', closeFolderMenu);

    ctxUse.addEventListener('click', () => {
      if (!ctxTargetId) return;
      const target = presets.find(p => p.id === ctxTargetId);
      if (!target) return;
      const scene = target.scene || 'online';
      setActiveIdForScene(scene, target.id);
      saveData();
      closeFolderMenu();
      renderList();
    });

    ctxEdit.addEventListener('click', () => {
      const id = ctxTargetId;
      closeFolderMenu();
      if (id) openDetail(id);
    });

    ctxExport.addEventListener('click', () => {
      const id = ctxTargetId;
      closeFolderMenu();
      if (id) exportPresetById(id);
    });

    ctxDel.addEventListener('click', () => {
      const id = ctxTargetId;
      closeFolderMenu();
      if (!id) return;
      const target = presets.find(p => p.id === id);
      if (!target) return;
      if (!confirm(`确定删除「${target.name || '未命名预设'}」吗？`)) return;
      const scene = target.scene || 'online';
      presets = presets.filter(item => item.id !== id);
      if (getActiveIdForScene(scene) === id) {
        const fallback = presets.find(item => (item.scene || 'online') === scene);
        setActiveIdForScene(scene, fallback ? fallback.id : '');
      }
      saveData();
      renderList();
    });
  }

  function openFolderMenu(id) {
    const p = presets.find(item => item.id === id);
    if (!p) return;
    ctxTargetId = id;

    const titleEl = document.getElementById('prCtxTitle');
    const subEl = document.getElementById('prCtxSub');
    const useBtn = document.getElementById('prCtxUseBtn');
    const mask = document.getElementById('prCtxMask');
    const sheet = document.getElementById('prCtxSheet');

    const scene = p.scene || 'online';
    const isActive = p.id === getActiveIdForScene(scene);
    const enabledCount = (p.entries || []).filter(e => e.enabled).length;
    const totalCount = (p.entries || []).length;
    const tokens = calcPresetTokens(p);

    if (titleEl) titleEl.textContent = p.name || '未命名预设';
    if (subEl) subEl.textContent = `${tokens.toLocaleString()} tok · 启用 ${enabledCount}/${totalCount} 项`;
    if (useBtn) useBtn.style.display = isActive ? 'none' : 'block';

    if (mask) mask.classList.add('is-open');
    if (sheet) sheet.classList.add('is-open');
  }

  function closeFolderMenu() {
    const mask = document.getElementById('prCtxMask');
    const sheet = document.getElementById('prCtxSheet');
    if (mask) mask.classList.remove('is-open');
    if (sheet) sheet.classList.remove('is-open');
    ctxTargetId = null;
  }

  function renderList() {
    const container = document.getElementById('prListScroll');
    const searchWrap = document.getElementById('prSearchWrap');
    if (!container) return;

    const sceneList = presets.filter(p => (p.scene || 'online') === currentTab);
    if (searchWrap) {
      searchWrap.classList.toggle('is-hidden', sceneList.length === 0);
    }

    const kw = searchKeyword.trim().toLowerCase();
    const list = kw
      ? sceneList.filter(p => String(p.name || '').toLowerCase().includes(kw))
      : sceneList;

    const activeForScene = getActiveIdForScene(currentTab);
    const sceneLabel = currentTab === 'offline' ? '线下' : '线上';

    if (!sceneList.length) {
      container.innerHTML = `
        <div class="pr-empty">
          <div class="pr-empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          </div>
          <div class="pr-empty-title">暂无${sceneLabel}预设</div>
          <div class="pr-empty-desc">点击右上角「+ 新建」手动编排，或「导入」酒馆 JSON 预设</div>
        </div>
      `;
      return;
    }

    if (!list.length) {
      container.innerHTML = `
        <div class="pr-empty">
          <div class="pr-empty-title">未找到匹配的预设</div>
          <div class="pr-empty-desc">换个关键词试试看</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="pr-file-grid">${list.map((p, idx) => {
      const isActive = p.id === activeForScene;
      const totalCount = (p.entries || []).length;
      const subText = isActive
        ? `当前启用 · ${totalCount} 项`
        : `${totalCount} 项`;

      return `
        <div class="pr-folder-item" data-id="${escapeHtml(p.id)}">
          <div class="pr-folder-icon-wrap">
            ${renderFolderSvg(p.id.replace(/[^a-zA-Z0-9]/g, '') + '_' + idx)}
          </div>
          <div class="pr-folder-name">${escapeHtml(p.name || '未命名预设')}</div>
          <div class="pr-folder-sub ${isActive ? 'is-active-text' : ''}">${escapeHtml(subText)}</div>
        </div>
      `;
    }).join('')}</div>`;

    container.querySelectorAll('.pr-folder-item').forEach(folder => {
      let holdTimer = null;
      let longPressed = false;
      let moved = false;
      let sx = 0;
      let sy = 0;

      folder.addEventListener('touchstart', (e) => {
        longPressed = false;
        moved = false;
        if (e.touches && e.touches[0]) {
          sx = e.touches[0].clientX;
          sy = e.touches[0].clientY;
        }
        folder.classList.add('is-pressed');
        holdTimer = setTimeout(() => {
          longPressed = true;
          folder.classList.remove('is-pressed');
          folder.classList.add('is-holding');
          if (navigator.vibrate) {
            try { navigator.vibrate(14); } catch (err) {}
          }
          openFolderMenu(folder.getAttribute('data-id'));
        }, 380);
      }, { passive: true });

      folder.addEventListener('touchmove', (e) => {
        if (!e.touches || !e.touches[0]) return;
        if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) {
          moved = true;
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
          folder.classList.remove('is-pressed', 'is-holding');
        }
      }, { passive: true });

      folder.addEventListener('touchend', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        folder.classList.remove('is-pressed', 'is-holding');
      }, { passive: true });

      folder.addEventListener('touchcancel', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        folder.classList.remove('is-pressed', 'is-holding');
      }, { passive: true });

      folder.addEventListener('mousedown', () => folder.classList.add('is-pressed'));
      folder.addEventListener('mouseup', () => folder.classList.remove('is-pressed'));
      folder.addEventListener('mouseleave', () => folder.classList.remove('is-pressed'));

      folder.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openFolderMenu(folder.getAttribute('data-id'));
      });

      folder.addEventListener('click', (e) => {
        if (longPressed || moved) {
          longPressed = false;
          moved = false;
          e.preventDefault();
          return;
        }
        openDetail(folder.getAttribute('data-id'));
      });
    });
  }

  function openDetail(id) {
    editingId = id;
    expandedEntryId = null;
    const p = getEditingPreset();
    if (!p) return;

    const detail = document.getElementById('prDetailView');
    const nameInput = document.getElementById('prDetailName');
    nameInput.value = p.name || '';
    renderDetailBody();
    detail.classList.add('is-open');
  }

  function closeDetail() {
    const detail = document.getElementById('prDetailView');
    if (detail) detail.classList.remove('is-open');
    editingId = null;
    renderList();
  }

  function renderDetailBody() {
    const scroll = document.getElementById('prDetailScroll');
    const p = getEditingPreset();
    if (!scroll || !p) return;

    const scene = p.scene || 'online';
    const totalTok = calcPresetTokens(p);
    const isActive = p.id === getActiveIdForScene(scene);

    scroll.innerHTML = `
      <div class="pr-card">
        <div class="pr-row-between">
          <div>
            <div style="font-weight:700; color:#111;">设为当前${scene === 'offline' ? '线下' : '线上'}预设</div>
            <div style="font-size:12px; color:#8e8e93; margin-top:2px;">长按下方条目可拖动调整顺序</div>
          </div>
          <button class="pr-switch ${isActive ? 'is-on' : ''}" id="prActiveToggle" type="button" aria-label="设为当前"></button>
        </div>

        <div class="pr-token-summary">
          <span class="pr-token-label">整套预设 Token</span>
          <span class="pr-token-big" id="prTotalTokenNum">${totalTok.toLocaleString()} <span style="font-size:13px;font-weight:600;color:#6e6e73;">tok</span></span>
        </div>

        <div class="pr-param-grid">
          <div class="pr-param-box">
            <div class="pr-param-label">Temperature (0 - 2)</div>
            <input class="pr-param-input" data-param="temperature" type="number" step="0.05" min="0" max="2" value="${p.temperature ?? 0.85}" />
          </div>
          <div class="pr-param-box">
            <div class="pr-param-label">Top P (0 - 1)</div>
            <input class="pr-param-input" data-param="topP" type="number" step="0.05" min="0" max="1" value="${p.topP ?? 0.95}" />
          </div>
        </div>
      </div>

      <button class="pr-add-entry-btn" id="prAddEntryBtn" type="button">+ 添加提示词条目</button>

      <div id="prEntriesWrap">
        ${(p.entries || []).map(entry => renderEntryCard(entry)).join('')}
      </div>

      <div style="text-align:center; padding:12px 0 6px;">
        <button class="pr-del-btn" id="prDeletePresetBtn" type="button">删除整套预设</button>
      </div>
    `;

    bindDetailEvents(scroll, p);
  }

  function renderEntryCard(entry) {
    const isExpanded = expandedEntryId === entry.id;
    const isText = entry.slot === 'text';
    const tok = isText ? estimateTokens(entry.content) : 0;
    const dotClass = !entry.enabled ? '' : (isText ? 'is-on' : 'is-marker');
    const isLocked = !!entry.locked;

    return `
      <div class="pr-entry-card" data-entry-id="${escapeHtml(entry.id)}">
        <div class="pr-entry-head">
          <div class="pr-entry-head-left">
            <span class="pr-dot ${dotClass}"></span>
            <span class="pr-entry-title">${escapeHtml(entry.name || '未命名条目')}</span>
            <span class="pr-role-tag">${isText ? roleBadgeText(entry.role) : '插槽'}</span>
            <span class="pr-entry-tok" data-entry-tok="${escapeHtml(entry.id)}">${isText ? tok + ' tok' : '动态'}</span>
          </div>
          <div class="pr-entry-head-right">
            ${isLocked ? `
              <span class="pr-lock-badge" title="已锁定">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
            ` : ''}
            <button class="pr-switch ${entry.enabled ? 'is-on' : ''}" data-toggle-entry="${escapeHtml(entry.id)}" type="button" aria-label="启用条目"></button>
          </div>
        </div>
        ${isExpanded ? `
          <div class="pr-entry-body">
            <div class="pr-field">
              <div class="pr-section-label">条目名称</div>
              <input class="pr-input" data-entry-field="name" type="text" value="${escapeHtml(entry.name)}" placeholder="例如：核心指令 / 文风约束" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="pr-field">
              <div class="pr-section-label">条目类型</div>
              <div class="pr-seg is-5">
                ${SLOT_TYPES.map(s => `
                  <button class="pr-seg-btn ${entry.slot === s.id ? 'is-active' : ''}" data-slot="${s.id}" type="button" ${isLocked ? 'disabled' : ''}>${s.label}</button>
                `).join('')}
              </div>
            </div>
            ${isText ? `
              <div class="pr-field">
                <div class="pr-section-label">发送角色</div>
                <div class="pr-seg">
                  <button class="pr-seg-btn ${entry.role === 'system' ? 'is-active' : ''}" data-role="system" type="button" ${isLocked ? 'disabled' : ''}>System</button>
                  <button class="pr-seg-btn ${entry.role === 'user' ? 'is-active' : ''}" data-role="user" type="button" ${isLocked ? 'disabled' : ''}>User</button>
                  <button class="pr-seg-btn ${entry.role === 'assistant' ? 'is-active' : ''}" data-role="assistant" type="button" ${isLocked ? 'disabled' : ''}>Assistant</button>
                </div>
              </div>
              <div class="pr-field">
                <div class="pr-section-label">提示词内容</div>
                <textarea class="pr-textarea" data-entry-field="content" placeholder="填写该条目的提示词..." ${isLocked ? 'disabled' : ''}>${escapeHtml(entry.content)}</textarea>
              </div>
            ` : `
              <div class="pr-field" style="font-size:12px; color:#8e8e93; background:#f2f2f7; padding:10px 12px; border-radius:12px;">
                该条目为「${slotLabelText(entry.slot)}」，对话时会自动在当前顺序位置插入对应数据。
              </div>
            `}
            <div class="pr-entry-footer">
              <button class="pr-lock-btn ${isLocked ? 'is-locked' : ''}" data-lock-entry="${escapeHtml(entry.id)}" type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  ${isLocked
                    ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
                    : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}
                </svg>
                ${isLocked ? '已锁定（点此解锁）' : '锁定条目'}
              </button>
              <button class="pr-del-btn" data-del-entry="${escapeHtml(entry.id)}" type="button">删除条目</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function updateTokenDashboard(p) {
    const totalTok = calcPresetTokens(p);
    const numEl = document.getElementById('prTotalTokenNum');
    if (numEl) {
      numEl.innerHTML = `${totalTok.toLocaleString()} <span style="font-size:13px;font-weight:600;color:#6e6e73;">tok</span>`;
    }
  }

  function bindLongPressDrag(wrap, p) {
    let holdTimer = null;
    let draggingCard = null;
    let startX = 0;
    let startY = 0;
    let suppressClick = false;

    function clearTimer() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    function syncEntriesOrderFromDOM() {
      const ids = Array.from(wrap.querySelectorAll('.pr-entry-card')).map(el => el.getAttribute('data-entry-id'));
      const map = {};
      p.entries.forEach(e => { map[e.id] = e; });
      p.entries = ids.map(id => map[id]).filter(Boolean);
      saveData();
    }

    wrap.addEventListener('touchstart', (e) => {
      const head = e.target.closest('.pr-entry-head');
      if (!head || e.target.closest('button')) return;
      const card = head.closest('.pr-entry-card');
      if (!card || e.touches.length !== 1) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      suppressClick = false;

      clearTimer();
      holdTimer = setTimeout(() => {
        draggingCard = card;
        suppressClick = true;
        card.classList.add('is-dragging');
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch (err) {}
        }
      }, 240);
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (!draggingCard) {
        if (holdTimer && e.touches.length === 1) {
          const dx = Math.abs(e.touches[0].clientX - startX);
          const dy = Math.abs(e.touches[0].clientY - startY);
          if (dx > 10 || dy > 10) clearTimer();
        }
        return;
      }

      e.preventDefault();
      const y = e.touches[0].clientY;
      const cards = Array.from(wrap.querySelectorAll('.pr-entry-card'));
      for (const other of cards) {
        if (other === draggingCard) continue;
        const rect = other.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid && draggingCard.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_PRECEDING) {
          wrap.insertBefore(draggingCard, other);
          break;
        } else if (y > mid && draggingCard.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) {
          wrap.insertBefore(draggingCard, other.nextSibling);
          break;
        }
      }
    }, { passive: false });

    function endDrag() {
      clearTimer();
      if (draggingCard) {
        draggingCard.classList.remove('is-dragging');
        draggingCard = null;
        syncEntriesOrderFromDOM();
      }
    }

    wrap.addEventListener('touchend', endDrag);
    wrap.addEventListener('touchcancel', endDrag);
    wrap.addEventListener('click', (e) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressClick = false;
      }
    }, true);
  }

  function bindDetailEvents(scroll, p) {
    const scene = p.scene || 'online';
    const activeToggle = scroll.querySelector('#prActiveToggle');
    activeToggle.addEventListener('click', () => {
      const next = getActiveIdForScene(scene) === p.id ? '' : p.id;
      setActiveIdForScene(scene, next);
      saveData();
      activeToggle.classList.toggle('is-on', next === p.id);
      renderList();
    });

    scroll.querySelectorAll('[data-param]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.getAttribute('data-param');
        const val = parseFloat(inp.value);
        if (!isNaN(val)) {
          p[key] = val;
          saveData();
        }
      });
    });

    const addEntryBtn = scroll.querySelector('#prAddEntryBtn');
    bindPress(addEntryBtn);
    addEntryBtn.addEventListener('click', () => {
      const entry = {
        id: uid('ent'),
        name: '新提示词',
        role: 'system',
        slot: 'text',
        content: '',
        enabled: true,
        locked: false
      };
      p.entries.push(entry);
      expandedEntryId = entry.id;
      saveData();
      renderDetailBody();
    });

    scroll.querySelector('#prDeletePresetBtn').addEventListener('click', () => {
      if (!confirm('确定删除这套预设吗？')) return;
      presets = presets.filter(item => item.id !== p.id);
      if (getActiveIdForScene(scene) === p.id) {
        const fallback = presets.find(item => (item.scene || 'online') === scene);
        setActiveIdForScene(scene, fallback ? fallback.id : '');
      }
      saveData();
      closeDetail();
    });

    const entriesWrap = scroll.querySelector('#prEntriesWrap');
    if (entriesWrap) bindLongPressDrag(entriesWrap, p);

    scroll.querySelectorAll('.pr-entry-card').forEach(card => {
      const entryId = card.getAttribute('data-entry-id');
      const entry = p.entries.find(e => e.id === entryId);
      if (!entry) return;

      card.querySelector('.pr-entry-head').addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        expandedEntryId = expandedEntryId === entryId ? null : entryId;
        renderDetailBody();
      });

      const toggleBtn = card.querySelector(`[data-toggle-entry="${entryId}"]`);
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          entry.enabled = !entry.enabled;
          saveData();
          renderDetailBody();
        });
      }

      const lockBtn = card.querySelector(`[data-lock-entry="${entryId}"]`);
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          entry.locked = !entry.locked;
          saveData();
          renderDetailBody();
        });
      }

      const nameInp = card.querySelector('[data-entry-field="name"]');
      if (nameInp) {
        nameInp.addEventListener('input', () => {
          entry.name = nameInp.value;
          const titleEl = card.querySelector('.pr-entry-title');
          if (titleEl) titleEl.textContent = entry.name || '未命名条目';
          saveData();
        });
      }

      const contentInp = card.querySelector('[data-entry-field="content"]');
      if (contentInp) {
        contentInp.addEventListener('input', () => {
          entry.content = contentInp.value;
          const tok = estimateTokens(entry.content);
          const tokBadge = card.querySelector(`[data-entry-tok="${entryId}"]`);
          if (tokBadge) tokBadge.textContent = `${tok} tok`;
          saveData();
          updateTokenDashboard(p);
        });
      }

      card.querySelectorAll('[data-role]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (entry.locked) return;
          entry.role = btn.getAttribute('data-role');
          saveData();
          renderDetailBody();
        });
      });

      card.querySelectorAll('[data-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (entry.locked) return;
          entry.slot = btn.getAttribute('data-slot');
          saveData();
          renderDetailBody();
        });
      });

      const delBtn = card.querySelector(`[data-del-entry="${entryId}"]`);
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (entry.locked && !confirm('该条目已锁定，确定要删除吗？')) return;
          p.entries = p.entries.filter(e => e.id !== entryId);
          if (expandedEntryId === entryId) expandedEntryId = null;
          saveData();
          renderDetailBody();
        });
      }
    });
  }

  function parseSTPreset(json, fallbackName, scene) {
    const rawPrompts = Array.isArray(json.prompts) ? json.prompts : [];
    const promptMap = {};
    rawPrompts.forEach(item => {
      if (item && item.identifier) promptMap[item.identifier] = item;
    });

    const markerMap = {
      charDescription: 'char',
      charPersonality: 'char',
      worldInfoBefore: 'lore_before',
      worldInfoAfter: 'lore_after',
      chatHistory: 'history'
    };

    let ordered = [];
    if (Array.isArray(json.prompt_order)) {
      const orderGroup = json.prompt_order.find(g => Array.isArray(g.order) && g.order.length) || json.prompt_order[0];
      if (orderGroup && Array.isArray(orderGroup.order)) {
        orderGroup.order.forEach(o => {
          const item = promptMap[o.identifier];
          if (!item) return;
          ordered.push({
            id: uid('ent'),
            name: item.name || o.identifier,
            role: ['system', 'user', 'assistant'].includes(item.role) ? item.role : 'system',
            slot: markerMap[o.identifier] || 'text',
            content: item.content || '',
            enabled: o.enabled !== false,
            locked: !!item.locked
          });
        });
      }
    }

    if (!ordered.length && rawPrompts.length) {
      ordered = rawPrompts.map(item => ({
        id: uid('ent'),
        name: item.name || item.identifier || '提示词',
        role: ['system', 'user', 'assistant'].includes(item.role) ? item.role : 'system',
        slot: markerMap[item.identifier] || 'text',
        content: item.content || '',
        enabled: item.enabled !== false,
        locked: !!item.locked
      }));
    }

    return {
      id: uid('pr'),
      scene: scene || (json.scene === 'offline' ? 'offline' : 'online'),
      name: json.name || fallbackName || '导入的预设',
      temperature: json.temperature !== undefined ? Number(json.temperature) : 0.85,
      topP: json.top_p !== undefined ? Number(json.top_p) : 0.95,
      entries: ordered
    };
  }

  function exportPresetById(id) {
    const p = presets.find(item => item.id === id);
    if (!p) return;

    const slotToST = {
      char: 'charDescription',
      lore_before: 'worldInfoBefore',
      lore_after: 'worldInfoAfter',
      history: 'chatHistory'
    };

    const prompts = [];
    const order = [];
    (p.entries || []).forEach(entry => {
      const identifier = slotToST[entry.slot] || entry.id;
      prompts.push({
        identifier: identifier,
        name: entry.name || '提示词',
        role: entry.role || 'system',
        content: entry.slot === 'text' ? (entry.content || '') : '',
        system_prompt: true,
        marker: entry.slot !== 'text',
        locked: !!entry.locked
      });
      order.push({ identifier: identifier, enabled: !!entry.enabled });
    });

    const payload = {
      name: p.name,
      scene: p.scene || 'online',
      temperature: p.temperature,
      top_p: p.topP,
      prompts: prompts,
      prompt_order: [{ character_id: 100001, order: order }]
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(p.name || 'preset').replace(/[\\/:*?"<>|]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.PhonePresets = {
    getPresets: (scene) => scene ? presets.filter(p => (p.scene || 'online') === scene) : presets.slice(),
    getActivePreset: (scene) => {
      const targetScene = scene === 'offline' ? 'offline' : 'online';
      const id = getActiveIdForScene(targetScene);
      const list = presets.filter(p => (p.scene || 'online') === targetScene);
      return list.find(p => p.id === id) || list[0] || null;
    },
    estimateTokens: estimateTokens,
    calcPresetTokens: calcPresetTokens
  };

  loadData();
  if (document.getElementById('app-presets')) {
    renderDOM();
  } else {
    document.addEventListener('DOMContentLoaded', renderDOM);
  }
})();
