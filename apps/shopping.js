/* apps/shopping.js - 购物 App 逻辑（货架 / 购物车 / 订单，钱包互通 chat_wallet_balance_v1） */
(function () {
  'use strict';

  var GOODS_KEY = 'shopping_goods_v1';
  var CART_KEY = 'shopping_cart_v1';
  var ORDERS_KEY = 'shopping_orders_v1';
  var WALLET_KEY = 'chat_wallet_balance_v1';

  var appEl = document.getElementById('app-shopping');
  if (!appEl) return;

  var state = {
    tab: 'browse',
    keyword: '',
    goods: [],
    cart: [],
    orders: [],
    detailId: null,
    isSearchingAI: false
  };

  var toastTimer = null;

  function loadJson(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function getWalletBalance() {
    try {
      var val = parseFloat(localStorage.getItem(WALLET_KEY));
      if (isNaN(val)) return 8888.00;
      return val;
    } catch (e) {
      return 8888.00;
    }
  }

  function setWalletBalance(num) {
    try {
      localStorage.setItem(WALLET_KEY, Number(num).toFixed(2));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(n) {
    var num = parseFloat(n);
    if (isNaN(num)) num = 0;
    return num.toFixed(2);
  }

  function formatTime(ts) {
    var d = ts ? new Date(ts) : new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return m + '-' + day + ' ' + hh + ':' + mm;
  }

  function showToast(text) {
    var el = document.getElementById('spToast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
    }, 1800);
  }

  function bindPress(el, onTap) {
    if (!el) return;
    var pressed = false;
    var moved = false;
    var sx = 0;
    var sy = 0;

    el.addEventListener('touchstart', function (e) {
      pressed = true;
      moved = false;
      if (e.touches && e.touches[0]) {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }
      el.classList.add('is-pressed');
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!pressed || !e.touches || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) {
        moved = true;
        el.classList.remove('is-pressed');
      }
    }, { passive: true });

    el.addEventListener('touchend', function () {
      el.classList.remove('is-pressed');
      pressed = false;
    }, { passive: true });

    el.addEventListener('touchcancel', function () {
      el.classList.remove('is-pressed');
      pressed = false;
    }, { passive: true });

    el.addEventListener('mousedown', function () { el.classList.add('is-pressed'); });
    el.addEventListener('mouseup', function () { el.classList.remove('is-pressed'); });
    el.addEventListener('mouseleave', function () { el.classList.remove('is-pressed'); });

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

  function closeShoppingApp() {
    if (typeof window.closeApp === 'function') {
      window.closeApp();
      return;
    }
    if (typeof window.goHome === 'function') {
      window.goHome();
      return;
    }
    appEl.className = 'app-screen';
    var homeEl = document.getElementById('home');
    if (homeEl) {
      homeEl.classList.remove('hidden');
    }
  }

  function findGood(id) {
    for (var i = 0; i < state.goods.length; i++) {
      if (state.goods[i].id === id) return state.goods[i];
    }
    return null;
  }

  function addToCart(goodId) {
    var g = findGood(goodId);
    if (!g) return;
    var found = false;
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].goodId === goodId) {
        state.cart[i].qty += 1;
        state.cart[i].checked = true;
        found = true;
        break;
      }
    }
    if (!found) {
      state.cart.unshift({
        goodId: g.id,
        name: g.name,
        shop: g.shop || '严选小店',
        price: parseFloat(g.price) || 0,
        qty: 1,
        checked: true
      });
    }
    saveJson(CART_KEY, state.cart);
    updateCartBadge();
    showToast('已加入购物车');
  }

  function updateCartBadge() {
    var badge = document.getElementById('spCartBadge');
    if (!badge) return;
    var total = 0;
    for (var i = 0; i < state.cart.length; i++) {
      total += state.cart[i].qty || 1;
    }
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function getFilteredGoods() {
    var kw = state.keyword.trim().toLowerCase();
    if (!kw) return state.goods;
    return state.goods.filter(function (g) {
      return String(g.name || '').toLowerCase().indexOf(kw) !== -1 ||
        String(g.shop || '').toLowerCase().indexOf(kw) !== -1;
    });
  }

  function getBagIconSvg(size) {
    return (
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>' +
        '<line x1="3" y1="6" x2="21" y2="6"/>' +
        '<path d="M16 10a4 4 0 0 1-8 0"/>' +
      '</svg>'
    );
  }

  function renderBrowse(container) {
    var list = getFilteredGoods();
    if (!list.length) {
      var tip = state.keyword.trim()
        ? '货架里暂时没有匹配商品，可以点「AI 帮找」生成一批'
        : '输入想买的物品点「AI 帮找」，或点右上角 + 手动上架';
      container.innerHTML =
        '<div class="sp-empty-card">' +
          '<div class="sp-empty-icon">' + getBagIconSvg(26) + '</div>' +
          '<div class="sp-empty-title">货架空空如也</div>' +
          '<div class="sp-empty-sub">' + escapeHtml(tip) + '</div>' +
        '</div>';
      return;
    }

    container.innerHTML =
      '<div class="sp-grid">' +
        list.map(function (g) {
          return (
            '<div class="sp-card" data-good-id="' + escapeHtml(g.id) + '">' +
              '<div class="sp-card-cover">' + getBagIconSvg(34) + '</div>' +
              '<div class="sp-card-body">' +
                '<div class="sp-card-title">' + escapeHtml(g.name) + '</div>' +
                '<div class="sp-card-shop">' + escapeHtml(g.shop || '严选小店') + '</div>' +
                '<div class="sp-card-foot">' +
                  '<div class="sp-card-price">¥' + formatMoney(g.price) + '</div>' +
                  '<button class="sp-add-mini" data-add-id="' + escapeHtml(g.id) + '" type="button" aria-label="加购">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                  '</button>' +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>';

    var cards = container.querySelectorAll('.sp-card');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        bindPress(card, function (e) {
          if (e.target && e.target.closest && e.target.closest('.sp-add-mini')) return;
          openDetail(card.getAttribute('data-good-id'));
        });
      })(cards[i]);
    }

    var addBtns = container.querySelectorAll('.sp-add-mini');
    for (var j = 0; j < addBtns.length; j++) {
      (function (btn) {
        bindPress(btn, function (e) {
          e.stopPropagation();
          addToCart(btn.getAttribute('data-add-id'));
        });
      })(addBtns[j]);
    }
  }

  function renderCart(container) {
    if (!state.cart.length) {
      container.innerHTML =
        '<div class="sp-empty-card">' +
          '<div class="sp-empty-icon">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
          '</div>' +
          '<div class="sp-empty-title">购物车还是空的</div>' +
          '<div class="sp-empty-sub">去逛逛挑点喜欢的好物吧</div>' +
        '</div>';
      return;
    }

    var total = 0;
    var checkedCount = 0;
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].checked !== false) {
        total += (parseFloat(state.cart[i].price) || 0) * (state.cart[i].qty || 1);
        checkedCount += 1;
      }
    }

    var listHtml = state.cart.map(function (item, idx) {
      var isChecked = item.checked !== false;
      return (
        '<div class="sp-cart-item">' +
          '<button class="sp-check-btn' + (isChecked ? ' is-checked' : '') + '" data-cart-check="' + idx + '" type="button" aria-label="勾选">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '</button>' +
          '<div class="sp-cart-thumb">' + getBagIconSvg(26) + '</div>' +
          '<div class="sp-cart-info">' +
            '<div class="sp-cart-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="sp-cart-shop">' + escapeHtml(item.shop || '严选小店') + '</div>' +
            '<div class="sp-cart-bottom">' +
              '<div class="sp-cart-price">¥' + formatMoney(item.price) + '</div>' +
              '<div class="sp-qty-box">' +
                '<button class="sp-qty-btn" data-qty-dec="' + idx + '" type="button">-</button>' +
                '<span class="sp-qty-num">' + (item.qty || 1) + '</span>' +
                '<button class="sp-qty-btn" data-qty-inc="' + idx + '" type="button">+</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var balance = getWalletBalance();
    container.innerHTML =
      '<div class="sp-cart-list">' + listHtml + '</div>' +
      '<div class="sp-checkout-card">' +
        '<div class="sp-checkout-meta">' +
          '<div class="sp-checkout-total">合计 ¥' + formatMoney(total) + '</div>' +
          '<div class="sp-checkout-wallet">零钱余额 ¥' + formatMoney(balance) + '</div>' +
        '</div>' +
        '<button class="sp-checkout-btn" id="spCheckoutBtn" type="button">结算 (' + checkedCount + ')</button>' +
      '</div>';

    var checks = container.querySelectorAll('[data-cart-check]');
    for (var c = 0; c < checks.length; c++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-cart-check'), 10);
          if (!state.cart[idx]) return;
          state.cart[idx].checked = state.cart[idx].checked === false;
          saveJson(CART_KEY, state.cart);
          renderMain();
        });
      })(checks[c]);
    }

    var decs = container.querySelectorAll('[data-qty-dec]');
    for (var d = 0; d < decs.length; d++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-qty-dec'), 10);
          if (!state.cart[idx]) return;
          if (state.cart[idx].qty > 1) {
            state.cart[idx].qty -= 1;
          } else {
            state.cart.splice(idx, 1);
          }
          saveJson(CART_KEY, state.cart);
          updateCartBadge();
          renderMain();
        });
      })(decs[d]);
    }

    var incs = container.querySelectorAll('[data-qty-inc]');
    for (var n = 0; n < incs.length; n++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-qty-inc'), 10);
          if (!state.cart[idx]) return;
          state.cart[idx].qty = (state.cart[idx].qty || 1) + 1;
          saveJson(CART_KEY, state.cart);
          updateCartBadge();
          renderMain();
        });
      })(incs[n]);
    }

    var checkoutBtn = document.getElementById('spCheckoutBtn');
    bindPress(checkoutBtn, function () {
      checkoutSelectedCart();
    });
  }

  function renderOrders(container) {
    var balance = getWalletBalance();
    var walletCard =
      '<div class="sp-wallet-card">' +
        '<div>' +
          '<div class="sp-wallet-label">我的零钱余额（与 Chat 互通）</div>' +
          '<div class="sp-wallet-val">¥' + formatMoney(balance) + '</div>' +
        '</div>' +
      '</div>';

    if (!state.orders.length) {
      container.innerHTML = walletCard +
        '<div class="sp-empty-card">' +
          '<div class="sp-empty-title">还没有订单</div>' +
          '<div class="sp-empty-sub">下单后物流和订单记录会显示在这里</div>' +
        '</div>';
      return;
    }

    var ordersHtml = state.orders.map(function (ord, idx) {
      var rows = (ord.items || []).map(function (it) {
        return (
          '<div class="sp-order-row">' +
            '<span>' + escapeHtml(it.name) + ' × ' + (it.qty || 1) + '</span>' +
            '<span>¥' + formatMoney((parseFloat(it.price) || 0) * (it.qty || 1)) + '</span>' +
          '</div>'
        );
      }).join('');

      var done = ord.status === '已完成';
      return (
        '<div class="sp-order-card">' +
          '<div class="sp-order-top">' +
            '<span>' + formatTime(ord.createdAt) + '</span>' +
            '<span class="sp-order-status">' + escapeHtml(ord.status || '配送中') + '</span>' +
          '</div>' +
          '<div class="sp-order-items">' + rows + '</div>' +
          '<div class="sp-order-foot">' +
            '<span class="sp-order-sum">实付 ¥' + formatMoney(ord.total) + '</span>' +
            (!done ? '<button class="sp-confirm-btn" data-confirm-ord="' + idx + '" type="button">确认收货</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML = walletCard + '<div class="sp-order-list">' + ordersHtml + '</div>';

    var confirmBtns = container.querySelectorAll('[data-confirm-ord]');
    for (var i = 0; i < confirmBtns.length; i++) {
      (function (btn) {
        bindPress(btn, function () {
          var idx = parseInt(btn.getAttribute('data-confirm-ord'), 10);
          if (!state.orders[idx]) return;
          state.orders[idx].status = '已完成';
          saveJson(ORDERS_KEY, state.orders);
          renderMain();
          showToast('已确认收货');
        });
      })(confirmBtns[i]);
    }
  }

  function checkoutItems(itemsToBuy) {
    if (!itemsToBuy.length) {
      showToast('请先选择商品');
      return false;
    }
    var total = 0;
    for (var i = 0; i < itemsToBuy.length; i++) {
      total += (parseFloat(itemsToBuy[i].price) || 0) * (itemsToBuy[i].qty || 1);
    }
    var balance = getWalletBalance();
    if (balance < total) {
      showToast('零钱余额不足');
      return false;
    }
    setWalletBalance(balance - total);

    state.orders.unshift({
      id: 'ord_' + Date.now(),
      createdAt: Date.now(),
      total: total,
      status: '配送中',
      items: itemsToBuy.map(function (it) {
        return { name: it.name, price: it.price, qty: it.qty || 1 };
      })
    });
    saveJson(ORDERS_KEY, state.orders);
    showToast('支付成功 ¥' + formatMoney(total));
    return true;
  }

  function checkoutSelectedCart() {
    var selected = [];
    var remain = [];
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].checked !== false) {
        selected.push(state.cart[i]);
      } else {
        remain.push(state.cart[i]);
      }
    }
    if (checkoutItems(selected)) {
      state.cart = remain;
      saveJson(CART_KEY, state.cart);
      updateCartBadge();
      switchTab('orders');
    }
  }

  function openDetail(goodId) {
    var g = findGood(goodId);
    if (!g) return;
    state.detailId = goodId;
    var body = document.getElementById('spDetailScroll');
    if (body) {
      body.innerHTML =
        '<div class="sp-detail-cover">' + getBagIconSvg(56) + '</div>' +
        '<div class="sp-detail-card">' +
          '<div class="sp-detail-price">¥' + formatMoney(g.price) + '</div>' +
          '<div class="sp-detail-name">' + escapeHtml(g.name) + '</div>' +
          '<div class="sp-detail-shop">店铺：' + escapeHtml(g.shop || '严选小店') + '</div>' +
          '<div class="sp-detail-desc">' + escapeHtml(g.desc || '暂无详细说明') + '</div>' +
        '</div>';
    }
    var detailEl = document.getElementById('spDetail');
    if (detailEl) detailEl.classList.add('is-open');
  }

  function closeDetail() {
    var detailEl = document.getElementById('spDetail');
    if (detailEl) detailEl.classList.remove('is-open');
    state.detailId = null;
  }

  function openAddSheet() {
    var mask = document.getElementById('spSheetMask');
    var sheet = document.getElementById('spSheet');
    if (mask) mask.classList.add('is-open');
    if (sheet) sheet.classList.add('is-open');
  }

  function closeAddSheet() {
    var mask = document.getElementById('spSheetMask');
    var sheet = document.getElementById('spSheet');
    if (mask) mask.classList.remove('is-open');
    if (sheet) sheet.classList.remove('is-open');
  }

  function aiGenerateGoods() {
    if (state.isSearchingAI) return;
    var kw = state.keyword.trim() || '日常精致好物';
    if (!window.PhoneAPI || typeof window.PhoneAPI.getConfig !== 'function') {
      showToast('请先在 API App 配置接口');
      return;
    }
    var cfg = window.PhoneAPI.getConfig() || {};
    var baseUrl = String(cfg.url || cfg.baseUrl || cfg.endpoint || '').trim().replace(/\/+$/, '');
    var apiKey = String(cfg.key || cfg.apiKey || '').trim();
    var model = String(cfg.model || '').trim();
    if (!baseUrl || !apiKey || !model) {
      showToast('请先在 API App 填好接口与模型');
      return;
    }
    var endpoint = /\/chat\/completions$/i.test(baseUrl)
      ? baseUrl
      : (/\/v1$/i.test(baseUrl) ? baseUrl + '/chat/completions' : baseUrl + '/v1/chat/completions');

    state.isSearchingAI = true;
    var btn = document.getElementById('spAiSearchBtn');
    if (btn) {
      btn.classList.add('is-loading');
      btn.textContent = '找货中...';
    }

    var reqStart = Date.now();
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: '你是一个手机购物商城货架生成器。请根据关键词返回 4 个商品的 JSON 数组，不要其他文字。每个对象包含 name(商品名), price(数字), shop(店铺名), desc(一句真实感商品卖点)。'
          },
          { role: 'user', content: '关键词：' + kw }
        ],
        temperature: 0.8
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        var match = String(raw || '').match(/\[[\s\S]*\]/);
        if (!match) throw new Error('商品格式解析失败');
        var list = JSON.parse(match[0]);
        if (!Array.isArray(list) || !list.length) throw new Error('未生成商品');
        for (var i = list.length - 1; i >= 0; i--) {
          var item = list[i];
          if (!item || !item.name) continue;
          state.goods.unshift({
            id: 'sp_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
            name: String(item.name),
            price: parseFloat(item.price) || 99,
            shop: String(item.shop || '严选旗舰店'),
            desc: String(item.desc || '')
          });
        }
        saveJson(GOODS_KEY, state.goods);
        renderMain();
        showToast('已上架新商品');
        if (typeof window.PhoneAPI.addLog === 'function') {
          try {
            window.PhoneAPI.addLog({ app: 'shopping', model: model, duration: Date.now() - reqStart, status: 'ok' });
          } catch (e) {}
        }
      })
      .catch(function (err) {
        showToast('上架失败：' + (err && err.message ? err.message : '请检查 API'));
      })
      .finally(function () {
        state.isSearchingAI = false;
        if (btn) {
          btn.classList.remove('is-loading');
          btn.textContent = 'AI 帮找';
        }
      });
  }

  function switchTab(tabName) {
    state.tab = tabName;
    var tabs = document.querySelectorAll('#spTabbar .sp-tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === tabName);
    }

    var backBtn = document.getElementById('spBackBtn');
    var titleEl = document.getElementById('spTitle');
    var searchWrap = document.getElementById('spSearchWrap');
    var addBtn = document.getElementById('spAddBtn');

    if (backBtn) backBtn.classList.toggle('is-hidden', tabName !== 'browse');
    if (searchWrap) searchWrap.classList.toggle('is-hidden', tabName !== 'browse');
    if (addBtn) addBtn.style.display = tabName === 'browse' ? 'inline-flex' : 'none';

    if (titleEl) {
      titleEl.textContent = tabName === 'browse' ? '购物' : (tabName === 'cart' ? '购物车' : '订单');
    }

    renderMain();
  }

  function renderMain() {
    var scrollEl = document.getElementById('spScroll');
    if (!scrollEl) return;
    if (state.tab === 'browse') {
      renderBrowse(scrollEl);
    } else if (state.tab === 'cart') {
      renderCart(scrollEl);
    } else {
      renderOrders(scrollEl);
    }
  }

  function renderApp() {
    appEl.innerHTML =
      '<div class="sp-app">' +
        '<header class="sp-header">' +
          '<div class="sp-header-left">' +
            '<button class="sp-circle-btn sp-back-btn" id="spBackBtn" type="button" aria-label="返回">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<h1 class="sp-title" id="spTitle">购物</h1>' +
          '</div>' +
          '<div class="sp-header-actions">' +
            '<button class="sp-circle-btn" id="spAddBtn" type="button" aria-label="上架商品">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
          '</div>' +
        '</header>' +

        '<div class="sp-search-wrap" id="spSearchWrap">' +
          '<div class="sp-search-box">' +
            '<span class="sp-search-icon">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '</span>' +
            '<input class="sp-search-input" id="spSearchInput" type="search" placeholder="搜索商品，或输入名称让 AI 帮找" autocomplete="off">' +
            '<button class="sp-ai-search-btn" id="spAiSearchBtn" type="button">AI 帮找</button>' +
          '</div>' +
        '</div>' +

        '<main class="sp-scroll" id="spScroll"></main>' +

        '<div class="sp-tabbar-wrap">' +
          '<nav class="sp-tabbar" id="spTabbar">' +
            '<button class="sp-tab-btn is-active" data-tab="browse" type="button">逛逛</button>' +
            '<button class="sp-tab-btn" data-tab="cart" type="button">购物车<span class="sp-badge" id="spCartBadge" style="display:none;">0</span></button>' +
            '<button class="sp-tab-btn" data-tab="orders" type="button">订单</button>' +
          '</nav>' +
        '</div>' +

        '<div class="sp-detail" id="spDetail">' +
          '<div class="sp-detail-head">' +
            '<button class="sp-circle-btn" id="spDetailBackBtn" type="button" aria-label="返回">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="sp-detail-scroll" id="spDetailScroll"></div>' +
          '<div class="sp-detail-footer">' +
            '<button class="sp-btn-outline" id="spDetailCartBtn" type="button">加入购物车</button>' +
            '<button class="sp-btn-solid" id="spDetailBuyBtn" type="button">立即购买</button>' +
          '</div>' +
        '</div>' +

        '<div class="sp-sheet-mask" id="spSheetMask"></div>' +
        '<div class="sp-sheet" id="spSheet">' +
          '<div class="sp-sheet-head">' +
            '<span class="sp-sheet-title">上架商品</span>' +
            '<button class="sp-sheet-close" id="spSheetClose" type="button">关闭</button>' +
          '</div>' +
          '<div class="sp-form-group"><label class="sp-form-label">商品名称</label><input class="sp-form-input" id="spNewName" type="text" placeholder="例如：草莓奶油蛋糕"></div>' +
          '<div class="sp-form-group"><label class="sp-form-label">价格（元）</label><input class="sp-form-input" id="spNewPrice" type="number" step="0.01" placeholder="例如：88"></div>' +
          '<div class="sp-form-group"><label class="sp-form-label">店铺名（可选）</label><input class="sp-form-input" id="spNewShop" type="text" placeholder="例如：甜品屋"></div>' +
          '<div class="sp-form-group"><label class="sp-form-label">商品简介（可选）</label><input class="sp-form-input" id="spNewDesc" type="text" placeholder="一句话描述"></div>' +
          '<button class="sp-form-submit" id="spNewSubmit" type="button">确认上架</button>' +
        '</div>' +

        '<div class="sp-toast" id="spToast"></div>' +
      '</div>';

    bindPress(document.getElementById('spBackBtn'), closeShoppingApp);
    bindPress(document.getElementById('spAddBtn'), openAddSheet);
    bindPress(document.getElementById('spAiSearchBtn'), aiGenerateGoods);
    bindPress(document.getElementById('spDetailBackBtn'), closeDetail);
    bindPress(document.getElementById('spSheetClose'), closeAddSheet);

    var mask = document.getElementById('spSheetMask');
    if (mask) mask.addEventListener('click', closeAddSheet);

    bindPress(document.getElementById('spDetailCartBtn'), function () {
      if (state.detailId) addToCart(state.detailId);
    });

    bindPress(document.getElementById('spDetailBuyBtn'), function () {
      var g = findGood(state.detailId);
      if (!g) return;
      if (checkoutItems([{ name: g.name, price: g.price, qty: 1 }])) {
        closeDetail();
        switchTab('orders');
      }
    });

    bindPress(document.getElementById('spNewSubmit'), function () {
      var nameEl = document.getElementById('spNewName');
      var priceEl = document.getElementById('spNewPrice');
      var shopEl = document.getElementById('spNewShop');
      var descEl = document.getElementById('spNewDesc');
      var name = String((nameEl && nameEl.value) || '').trim();
      var price = parseFloat((priceEl && priceEl.value) || '0');
      if (!name) {
        showToast('请填写商品名称');
        return;
      }
      if (isNaN(price) || price < 0) price = 0;

      state.goods.unshift({
        id: 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        name: name,
        price: price,
        shop: String((shopEl && shopEl.value) || '').trim() || '自营小店',
        desc: String((descEl && descEl.value) || '').trim()
      });
      saveJson(GOODS_KEY, state.goods);
      if (nameEl) nameEl.value = '';
      if (priceEl) priceEl.value = '';
      if (shopEl) shopEl.value = '';
      if (descEl) descEl.value = '';
      closeAddSheet();
      renderMain();
      showToast('上架成功');
    });

    var searchInput = document.getElementById('spSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.keyword = searchInput.value || '';
        renderMain();
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          if (!getFilteredGoods().length && state.keyword.trim()) {
            aiGenerateGoods();
          }
        }
      });
    }

    var tabBtns = document.querySelectorAll('#spTabbar .sp-tab-btn');
    for (var i = 0; i < tabBtns.length; i++) {
      (function (btn) {
        bindPress(btn, function () {
          switchTab(btn.getAttribute('data-tab'));
        });
      })(tabBtns[i]);
    }

    updateCartBadge();
    renderMain();
  }

  function init() {
    state.goods = loadJson(GOODS_KEY);
    state.cart = loadJson(CART_KEY);
    state.orders = loadJson(ORDERS_KEY);
    renderApp();
  }

  var observer = new MutationObserver(function () {
    if (appEl.className !== 'app-screen') {
      state.goods = loadJson(GOODS_KEY);
      state.cart = loadJson(CART_KEY);
      state.orders = loadJson(ORDERS_KEY);
      updateCartBadge();
      renderMain();
    }
  });
  observer.observe(appEl, { attributes: true, attributeFilter: ['class'] });

  window.PhoneShopping = {
    getOrders: function () { return state.orders.slice(); },
    refresh: init
  };

  init();
})();