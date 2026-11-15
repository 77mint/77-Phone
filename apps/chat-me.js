/* =========================================================
   Chat 我的页（仿微信「我」独立模块）
   - 不改动 apps/chat.js / apps/chat.css，独立接管我的 tab
   - 去掉小卡片、去掉顶部「我的」标题栏，顺序：钱包 / 收藏 / 表情包 / 朋友圈
   ========================================================= */
(function () {
  var rendering = false;

  var MENU_ITEMS = [
    {
      id: 'wallet',
      label: '钱包',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>'
    },
    {
      id: 'favorites',
      label: '收藏',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
    },
    {
      id: 'stickers',
      label: '表情包',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
    },
    {
      id: 'moments',
      label: '朋友圈',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/></svg>'
    }
  ];

  var SVG_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  function isMeTabActive() {
    var tab = document.querySelector('#app-chat .ct-tab-btn[data-tab="me"]');
    return !!(tab && tab.classList.contains('active'));
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

    var rowsHtml = MENU_ITEMS.map(function (item) {
      return '<div class="ctme-row" data-me-item="' + item.id + '">' +
        '<div class="ctme-row-left">' +
          '<span class="ctme-row-icon">' + item.icon + '</span>' +
          '<span>' + item.label + '</span>' +
        '</div>' +
        '<span class="ctme-row-arrow">' + SVG_ARROW + '</span>' +
      '</div>';
    }).join('');

    scroll.innerHTML =
      '<div class="ctme-wrap">' +
        '<div class="ctme-profile">' +
          '<div class="ctme-avatar">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          '</div>' +
          '<div class="ctme-name">我</div>' +
        '</div>' +
        '<div class="ctme-gap"></div>' +
        '<div class="ctme-list">' + rowsHtml + '</div>' +
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
