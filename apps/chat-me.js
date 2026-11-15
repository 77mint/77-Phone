/* =========================================================
   Chat 我的页（仿微信「我」独立模块）
   - 不改动 apps/chat.js / apps/chat.css，独立接管我的 tab
   - 纯白主背景、ID 对齐头像上缘、仿 p2 彩色图标
   - 顺序：钱包 / 收藏 / 表情包 / 朋友圈 /（分隔）/ 设置
   ========================================================= */
(function () {
  var rendering = false;

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

  function isMeTabActive() {
    var tab = document.querySelector('#app-chat .ct-tab-btn[data-tab="me"]');
    return !!(tab && tab.classList.contains('active'));
  }

  function renderRow(item) {
    return '<div class="ctme-row" data-me-item="' + item.id + '">' +
      '<div class="ctme-row-left">' +
        '<span class="ctme-row-icon">' + item.icon + '</span>' +
        '<span>' + item.label + '</span>' +
      '</div>' +
      '<span class="ctme-row-arrow">' + SVG_ARROW + '</span>' +
    '</div>';
  }

  function renderMePage() {
    var appEl = document.querySelector('#app-chat .ct-app');
    var scroll = document.getElementById('ctMainScroll');
    if (!appEl || !scroll) return;

    if (!isMeTabActive()) {
      appEl.classList.remove('is-me-tab');
      return;
    }

    appEl.classList.add('is-me-tab');
    rendering = true;

    scroll.innerHTML =
      '<div class="ctme-wrap">' +
        '<div class="ctme-profile">' +
          '<div class="ctme-avatar">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          '</div>' +
          '<div class="ctme-profile-info">' +
            '<div class="ctme-name">我</div>' +
          '</div>' +
        '</div>' +
        '<div class="ctme-gap"></div>' +
        '<div class="ctme-list">' + MAIN_ITEMS.map(renderRow).join('') + '</div>' +
        '<div class="ctme-gap"></div>' +
        '<div class="ctme-list">' + renderRow(SETTINGS_ITEM) + '</div>' +
      '</div>';

    scroll.querySelectorAll('.ctme-row[data-me-item]').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.getAttribute('data-me-item');
        if (id === 'moments') {
          var mTab = document.querySelector('#app-chat .ct-tab-btn[data-tab="moments"]');
          if (mTab) mTab.click();
        }
      });
    });

    rendering = false;
  }

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
