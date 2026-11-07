// TradePulse Master UI Controller & Interaction Engine
// Handles Navigation, Watchlist, Sign Up / Login, Option Chain (CE / PE), Orders, Holdings, Positions, and Funds

// 1. Synthesized Web Audio API Chimes
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playSuccess() {
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0.15, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);
    } catch (e) {}
  }

  playError() {
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }
}

const sounds = new SoundFX();
window.playChime = () => sounds.playSuccess();

// 2. Global Toast Notification Helper
window.showToast = function (message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
  toast.innerHTML = `
    <span>${message}</span>
    <span style="cursor:pointer;margin-left:12px;opacity:0.6;" onclick="this.parentElement.remove()">✕</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
};

// 3. Main Application Class
class App {
  constructor() {
    this.currentView = "orders";
    this.selectedStock = STOCKS_MAP.get("LT") || Array.from(STOCKS_MAP.values())[0];
    this.activeOrderSide = "BUY";
    this.activeProduct = "CNC";
    this.activeOrderType = "MARKET";
    this.chart = null;
    this.activeDepthStock = null;
    this.activeAuthTab = "signup";
    this.activeOCOptionUnderlying = "NIFTY 50";

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupNavigation();
    this.setupWatchlist();
    this.setupOrderModal();
    this.setupDepthModal();
    this.setupOptionChainModal();
    this.setupChart();
    this.setupFundsActions();
    this.setupProfileDropdown();
    this.setupMobile();
    this.renderHeaderIndices();
    this.renderUserQuickFunds();
    this.renderActiveView();

    engine.onStatusChange((status) => this.handleMarketStatusChange(status));
    engine.onTick((data) => this.handleMarketTick(data));
    engine.start();

    const forceTickToggle = document.getElementById("forceMarketTickToggle");
    if (forceTickToggle) {
      forceTickToggle.addEventListener("change", (e) => {
        engine.setForceOpen(e.target.checked);
        window.showToast(e.target.checked ? "Market simulated: LIVE TICKS ACTIVE" : "Market set to: OFFICIAL MARKET HOURS (09:15 - 15:30 IST)", "info");
      });
    }

    if (!store.currentUser) {
      this.openAuthModal("signup");
    }
  }

  handleMarketStatusChange(status) {
    const pill = document.getElementById("marketStatusPill");
    const textEl = document.getElementById("marketStatusText");
    if (!pill || !textEl) return;

    if (status.isOpen) {
      pill.className = "market-status-pill open";
      textEl.textContent = status.statusText;
      pill.title = status.message;
    } else {
      pill.className = "market-status-pill closed";
      textEl.textContent = `${status.statusText} (09:15 AM Open)`;
      pill.title = status.message;
    }
  }

  // --- Theme Management ---
  setupTheme() {
    const isDark = store.settings.theme === "dark";
    if (isDark) document.body.classList.add("dark-mode");

    const toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const darkActive = document.body.classList.contains("dark-mode");
        store.settings.theme = darkActive ? "dark" : "light";
        store.save(STORAGE_KEYS.SETTINGS, store.settings);
        toggleBtn.innerHTML = darkActive ? "☀️" : "🌙";
        if (this.chart) this.chart.render();
      });
      toggleBtn.innerHTML = isDark ? "☀️" : "🌙";
    }
  }

  // --- Profile Menu & Logout ---
  setupProfileDropdown() {
    const profileBtn = document.getElementById("userProfileMenuBtn");
    const dropdown = document.getElementById("userDropdownCard");
    const logoutBtn = document.getElementById("logoutBtn");

    if (profileBtn && dropdown) {
      profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
      });

      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
          dropdown.classList.remove("show");
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        store.logout();
        if (dropdown) dropdown.classList.remove("show");
        window.showToast("Logged out successfully.", "info");
        this.renderUserQuickFunds();
        this.renderActiveView();
        this.openAuthModal("login");
      });
    }
  }

  // --- Auth Modal (Sign Up & Login) ---
  openAuthModal(tab = "signup") {
    const modal = document.getElementById("authModalBackdrop");
    this.setAuthTab(tab);
    if (modal) modal.classList.add("open");
  }

  closeAuthModal() {
    const modal = document.getElementById("authModalBackdrop");
    if (modal) modal.classList.remove("open");
  }

  setAuthTab(tab) {
    this.activeAuthTab = tab;
    const tabSignup = document.getElementById("authTabSignup");
    const tabLogin = document.getElementById("authTabLogin");
    const signupForm = document.getElementById("signupForm");
    const loginForm = document.getElementById("loginForm");

    if (tab === "signup") {
      tabSignup?.classList.add("active");
      tabLogin?.classList.remove("active");
      if (signupForm) signupForm.style.display = "block";
      if (loginForm) loginForm.style.display = "none";
    } else {
      tabLogin?.classList.add("active");
      tabSignup?.classList.remove("active");
      if (loginForm) loginForm.style.display = "block";
      if (signupForm) signupForm.style.display = "none";
    }
  }

  handleSignUpSubmit() {
    const name = document.getElementById("signupName")?.value;
    const email = document.getElementById("signupEmail")?.value;
    const password = document.getElementById("signupPassword")?.value;
    const confirmPassword = document.getElementById("signupConfirmPassword")?.value;

    const res = store.signUp({ name, email, password, confirmPassword });

    if (res.success) {
      window.playChime();
      window.showToast(res.message, "success");
      this.closeAuthModal();
      this.renderUserQuickFunds();
      this.renderWatchlist();
      this.renderActiveView();
    } else {
      sounds.playError();
      window.showToast(res.message, "error");
    }
  }

  handleLoginSubmit() {
    const email = document.getElementById("loginEmail")?.value;
    const password = document.getElementById("loginPassword")?.value;

    const res = store.login({ email, password });

    if (res.success) {
      window.playChime();
      window.showToast(res.message, "success");
      this.closeAuthModal();
      this.renderUserQuickFunds();
      this.renderWatchlist();
      this.renderActiveView();
    } else {
      sounds.playError();
      window.showToast(res.message, "error");
    }
  }

  handleGuestLogin() {
    const user = store.quickDemoLogin();
    window.playChime();
    window.showToast(`Logged in as ${user.name}! Demo balance: ₹20,000.00`, "success");
    this.closeAuthModal();
    this.renderUserQuickFunds();
    this.renderWatchlist();
    this.renderActiveView();
  }

  // --- Top Navigation Tabs ---
  setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link[data-view]");
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.getAttribute("data-view");
        this.switchView(view);
      });
    });

    const brand = document.getElementById("brandLogo");
    if (brand) {
      brand.addEventListener("click", () => this.switchView("orders"));
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    document.querySelectorAll(".nav-link[data-view]").forEach((l) => {
      l.classList.toggle("active", l.getAttribute("data-view") === viewName);
    });

    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.remove("active");
    });

    const activeSec = document.getElementById(`view-${viewName}`);
    if (activeSec) {
      activeSec.classList.add("active");
    }

    // Synchronize mobile bottom nav state
    if (viewName === "orders") {
      this.activeMobileTab = "orders";
      this.updateMobileTabState("orders");
    } else if (viewName === "holdings" || viewName === "positions") {
      this.activeMobileTab = "portfolio";
      this.updateMobileTabState("portfolio");
    } else if (viewName === "funds") {
      this.activeMobileTab = "funds";
      this.updateMobileTabState("funds");
    }

    // Always ensure both mobile card views are rendered when in portfolio
    if (viewName === "holdings" || viewName === "positions") {
      this.renderHoldings();
      this.renderPositions();
    }

    this.renderActiveView();
  }

  updateMobileTabState(tab) {
    document.body.setAttribute("data-mobile-tab", tab);
    document.querySelectorAll(".mob-nav-item").forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-mob-tab") === tab);
    });
  }

  renderActiveView() {
    this.updateNavBadges();
    switch (this.currentView) {
      case "orders":
        this.renderOrders();
        break;
      case "holdings":
        this.renderHoldings();
        break;
      case "positions":
        this.renderPositions();
        break;
      case "funds":
        this.renderFunds();
        break;
    }
  }

  updateNavBadges() {
    const openOrdersCount = store.orders.filter((o) => o.status === "OPEN" || o.status === "AMO PENDING").length;
    const openOrdersBadge = document.getElementById("badgeOpenOrders");
    if (openOrdersBadge) {
      openOrdersBadge.textContent = openOrdersCount || "";
      openOrdersBadge.style.display = openOrdersCount ? "inline-block" : "none";
    }

    const holdingsBadge = document.getElementById("badgeHoldingsCount");
    if (holdingsBadge) {
      holdingsBadge.textContent = store.holdings.length || "";
      holdingsBadge.style.display = store.holdings.length ? "inline-block" : "none";
    }

    const positionsBadge = document.getElementById("badgePositionsCount");
    const totalPositionsCount = store.positions.length;
    if (positionsBadge) {
      positionsBadge.textContent = totalPositionsCount || "";
      positionsBadge.style.display = totalPositionsCount ? "inline-block" : "none";
    }

    // Mobile Bottom Navigation Badges
    const mobOrdersBadge = document.getElementById("mobBadgeOrders");
    if (mobOrdersBadge) {
      mobOrdersBadge.textContent = openOrdersCount || "";
      mobOrdersBadge.style.display = openOrdersCount ? "inline-block" : "none";
    }

    const mobPortBadge = document.getElementById("mobBadgePortfolio");
    const portCount = store.holdings.length + totalPositionsCount;
    if (mobPortBadge) {
      mobPortBadge.textContent = portCount || "";
      mobPortBadge.style.display = portCount ? "inline-block" : "none";
    }

    // Mobile Portfolio Subtabs Counts
    const mobHCount = document.getElementById("mobHoldingsTabCount");
    const mobHCount2 = document.getElementById("mobHoldingsTabCount2");
    if (mobHCount) mobHCount.textContent = store.holdings.length;
    if (mobHCount2) mobHCount2.textContent = store.holdings.length;

    const mobPCount = document.getElementById("mobPositionsTabCount");
    const mobPCount2 = document.getElementById("mobPositionsTabCount2");
    if (mobPCount) mobPCount.textContent = totalPositionsCount;
    if (mobPCount2) mobPCount2.textContent = totalPositionsCount;
  }

  renderUserQuickFunds() {
    const el = document.getElementById("quickMarginVal");
    if (el) {
      el.textContent = `₹${store.funds.availableCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    }
    const avatar = document.getElementById("userAvatarText");
    const menuName = document.getElementById("menuUserName");
    const menuEmail = document.getElementById("menuUserEmail");
    const menuClientId = document.getElementById("menuUserClientId");

    const mobAvatar = document.getElementById("mobUserAvatar");
    const mobName = document.getElementById("mobUserName");
    const mobEmail = document.getElementById("mobUserEmail");
    const mobClientId = document.getElementById("mobUserClientId");

    if (store.currentUser) {
      const initials = (store.currentUser.name || "TP").slice(0, 2).toUpperCase();
      if (avatar) avatar.textContent = initials;
      if (menuName) menuName.textContent = store.currentUser.name;
      if (menuEmail) menuEmail.textContent = store.currentUser.email;
      if (menuClientId) menuClientId.textContent = `Client ID: ${store.currentUser.clientId || "TP7842"}`;

      if (mobAvatar) mobAvatar.textContent = initials;
      if (mobName) mobName.textContent = store.currentUser.name;
      if (mobEmail) mobEmail.textContent = store.currentUser.email;
      if (mobClientId) mobClientId.textContent = `Client ID: ${store.currentUser.clientId || "TP7842"}`;
    } else {
      if (avatar) avatar.textContent = "TP";
      if (menuName) menuName.textContent = "Demo Learner";
      if (menuEmail) menuEmail.textContent = "demo@tradepulse.app";
      if (menuClientId) menuClientId.textContent = "Client ID: TP7842";

      if (mobAvatar) mobAvatar.textContent = "TP";
      if (mobName) mobName.textContent = "Demo Learner";
      if (mobEmail) mobEmail.textContent = "demo@tradepulse.app";
      if (mobClientId) mobClientId.textContent = "Client ID: TP7842";
    }
  }

  // --- Header Indices (NIFTY 50, SENSEX, BANKNIFTY) ---
  renderHeaderIndices() {
    const container = document.getElementById("indicesTicker");
    if (!container) return;

    container.innerHTML = INITIAL_INDICES.map((idx) => {
      const isPositive = idx.change >= 0;
      return `
        <div class="index-item" id="idx-${idx.symbol.replace(/\s+/g, '')}" onclick="app.openOptionChainModal('${idx.symbol}')" title="Click to open Option Chain">
          <span class="index-name">${idx.symbol}</span>
          <span class="index-price">${idx.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          <span class="index-change ${isPositive ? 'text-green' : 'text-red'}">
            ${isPositive ? '+' : ''}${idx.change.toFixed(2)} (${isPositive ? '+' : ''}${idx.pChange.toFixed(2)}%)
          </span>
        </div>
      `;
    }).join("");
  }

  // --- Watchlist Rendering & Actions ---
  setupWatchlist() {
    const tabs = document.querySelectorAll(".wl-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        store.activeWatchlist = parseInt(tab.getAttribute("data-wl"), 10);
        this.renderWatchlist();
      });
    });

    const searchInput = document.getElementById("watchlistSearchInput");
    const resultsOverlay = document.getElementById("searchResultsOverlay");

    if (searchInput && resultsOverlay) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toUpperCase();
        if (!query) {
          resultsOverlay.style.display = "none";
          return;
        }

        const matches = Array.from(STOCKS_MAP.values()).filter(
          (s) => s.symbol.includes(query) || s.name.toUpperCase().includes(query)
        );

        resultsOverlay.style.display = "block";
        if (matches.length === 0) {
          resultsOverlay.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">No instruments matching "${query}"</div>`;
          return;
        }

        const activeList = store.watchlists[store.activeWatchlist] || [];
        resultsOverlay.innerHTML = matches.slice(0, 15).map((s) => {
          const isAdded = activeList.includes(s.symbol);
          return `
            <div class="search-result-item" onclick="app.toggleWatchlistStock('${s.symbol}')">
              <div>
                <span class="font-bold text-dark">${s.symbol}</span>
                <span class="sector-tag ${s.sectorClass}" style="margin-left:6px;">${s.sector}</span>
                <span class="exchange-tag" style="margin-left:4px;">${s.exchange}</span>
                <div style="font-size:11.5px;color:var(--text-secondary);">${s.name}</div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-weight:700;font-size:13.5px;">₹${s.price.toFixed(2)}</span>
                <button class="btn-secondary" style="padding:4px 9px;font-size:11.5px;">
                  ${isAdded ? "✓ Added" : "+ Add"}
                </button>
              </div>
            </div>
          `;
        }).join("");
      });

      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !resultsOverlay.contains(e.target)) {
          resultsOverlay.style.display = "none";
        }
      });
    }

    this.renderWatchlist();
  }

  toggleWatchlistStock(symbol) {
    const listId = store.activeWatchlist;
    const currentList = store.watchlists[listId] || [];
    if (currentList.includes(symbol)) {
      store.removeStockFromWatchlist(listId, symbol);
      window.showToast(`Removed ${symbol} from Watchlist ${listId}`);
    } else {
      store.addStockToWatchlist(listId, symbol);
      window.showToast(`Added ${symbol} to Watchlist ${listId}`, "success");
    }
    const searchInput = document.getElementById("watchlistSearchInput");
    if (searchInput) searchInput.value = "";
    const overlay = document.getElementById("searchResultsOverlay");
    if (overlay) overlay.style.display = "none";
    this.renderWatchlist();
  }

  renderWatchlist() {
    const container = document.getElementById("watchlistItemsList");
    const countBadge = document.getElementById("watchlistCountPill");
    if (!container) return;

    const symbols = store.watchlists[store.activeWatchlist] || [];
    if (countBadge) countBadge.textContent = `${symbols.length} / 50`;

    if (symbols.length === 0) {
      container.innerHTML = `
        <div style="padding:32px 20px;text-align:center;color:var(--text-muted);font-size:13px;">
          Watchlist ${store.activeWatchlist} is empty.<br>Use search bar above to add stocks or options like <b>LT</b>, <b>KVB</b>, <b>NIFTY CE</b>.
        </div>
      `;
      return;
    }

    container.innerHTML = symbols.map((sym) => {
      const stock = STOCKS_MAP.get(sym);
      if (!stock) return "";
      const isPositive = stock.change >= 0;

      return `
        <li class="stock-row" id="wl-row-${stock.symbol.replace(/\s+/g, '_')}" onclick="app.selectStock('${stock.symbol}')">
          <div class="stock-info">
            <div class="stock-symbol">
              ${stock.symbol}
              <span class="sector-tag ${stock.sectorClass}">${stock.sector}</span>
              <span class="exchange-tag">${stock.exchange}</span>
            </div>
            <div class="stock-fullname">${stock.name}</div>
          </div>

          <div class="stock-pricing" id="wl-price-${stock.symbol.replace(/\s+/g, '_')}">
            <div class="stock-ltp ${isPositive ? 'text-green' : 'text-red'}">₹${stock.price.toFixed(2)}</div>
            <div class="stock-delta ${isPositive ? 'text-green' : 'text-red'}">
              ${isPositive ? '▲ +' : '▼ '}${stock.change.toFixed(2)} (${isPositive ? '+' : ''}${stock.pChange.toFixed(2)}%)
            </div>
          </div>

          <!-- Zerodha Signature Hover Actions -->
          <div class="stock-hover-actions">
            <button class="act-btn btn-buy-pill" title="Buy (B)" onclick="event.stopPropagation(); app.openOrderModal('${stock.symbol}', 'BUY');">B</button>
            <button class="act-btn btn-sell-pill" title="Sell (S)" onclick="event.stopPropagation(); app.openOrderModal('${stock.symbol}', 'SELL');">S</button>
            <button class="act-btn btn-icon-pill" title="Market Depth" onclick="event.stopPropagation(); app.openDepthModal('${stock.symbol}');">📊</button>
            <button class="act-btn btn-icon-pill" title="View Chart" onclick="event.stopPropagation(); app.openChartModal('${stock.symbol}');">📈</button>
            <button class="act-btn btn-icon-pill" title="Delete from watchlist" onclick="event.stopPropagation(); app.toggleWatchlistStock('${stock.symbol}');">🗑️</button>
          </div>
        </li>
      `;
    }).join("");
  }

  selectStock(symbol) {
    const s = STOCKS_MAP.get(symbol);
    if (!s) return;
    this.selectedStock = s;

    // On mobile screens (<= 768px), open the signature Zerodha Mobile Action Sheet!
    if (window.innerWidth <= 768) {
      this.openStockSheet(symbol);
      return;
    }

    // On desktop, clicking a stock opens its interactive Chart Modal!
    this.openChartModal(symbol);
  }

  // --- Real-Time Market Tick Subscriber ---
  handleMarketTick(data) {
    const { updatedStocks, updatedIndices } = data;

    updatedIndices.forEach((idx) => {
      const el = document.getElementById(`idx-${idx.symbol.replace(/\s+/g, '')}`);
      if (el) {
        const isPos = idx.change >= 0;
        el.querySelector(".index-price").textContent = idx.price.toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const chgEl = el.querySelector(".index-change");
        chgEl.className = `index-change ${isPos ? 'text-green' : 'text-red'}`;
        chgEl.textContent = `${isPos ? '+' : ''}${idx.change.toFixed(2)} (${isPos ? '+' : ''}${idx.pChange.toFixed(2)}%)`;
        el.classList.add(idx.lastTickDirection === "up" ? "tick-up" : "tick-down");
        setTimeout(() => el.classList.remove("tick-up", "tick-down"), 900);
      }
    });

    updatedStocks.forEach((stock) => {
      const safeId = stock.symbol.replace(/\s+/g, '_');
      const row = document.getElementById(`wl-row-${safeId}`);
      const priceBlock = document.getElementById(`wl-price-${safeId}`);
      if (row && priceBlock) {
        const isPos = stock.change >= 0;
        priceBlock.innerHTML = `
          <div class="stock-ltp ${isPos ? 'text-green' : 'text-red'}">₹${stock.price.toFixed(2)}</div>
          <div class="stock-delta ${isPos ? 'text-green' : 'text-red'}">
            ${isPos ? '▲ +' : '▼ '}${stock.change.toFixed(2)} (${isPos ? '+' : ''}${stock.pChange.toFixed(2)}%)
          </div>
        `;
        row.classList.add(stock.lastTickDirection === "up" ? "tick-up" : "tick-down");
        setTimeout(() => row.classList.remove("tick-up", "tick-down"), 900);
      }

      if (this.activeDepthStock && this.activeDepthStock.symbol === stock.symbol) {
        this.renderDepthContent(stock);
      }

      if (this.selectedStock && this.selectedStock.symbol === stock.symbol && this.chart) {
        this.chart.render();
      }

      // Live update for Mobile Stock Sheet if open
      const sheet = document.getElementById("mobileStockSheetBackdrop");
      if (sheet && sheet.classList.contains("open") && this.selectedStock && this.selectedStock.symbol === stock.symbol) {
        const ltpEl = document.getElementById("sheetStockLTP");
        const deltaEl = document.getElementById("sheetStockDelta");
        const isPos = stock.change >= 0;
        if (ltpEl) ltpEl.textContent = `₹${stock.price.toFixed(2)}`;
        if (deltaEl) {
          deltaEl.className = `sheet-delta ${isPos ? 'text-green' : 'text-red'}`;
          deltaEl.textContent = `${isPos ? '+' : ''}${stock.change.toFixed(2)} (${isPos ? '+' : ''}${stock.pChange.toFixed(2)}%)`;
        }
      }
    });

    // If Option Chain is open, live update table
    const ocBackdrop = document.getElementById("optionChainModalBackdrop");
    if (ocBackdrop && ocBackdrop.classList.contains("open")) {
      const spotItem = STOCKS_MAP.get(this.activeOCOptionUnderlying);
      const spotEl = document.getElementById("ocSpotPrice");
      if (spotItem && spotEl) {
        spotEl.textContent = `₹${spotItem.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }
      this.refreshOptionChainRows();
    }

    // Check if trading day rolled over past midnight (23:59:59 -> new date)
    const currentToday = store.getTodayDateString();
    if (store.currentSessionDate && store.currentSessionDate !== currentToday) {
      store.cleanupDailySession();
      this.renderActiveView();
    }

    if (this.currentView === "holdings" || (window.innerWidth <= 768 && this.activeMobileTab === "portfolio")) {
      this.updateHoldingsLiveData();
    }
    if (this.currentView === "positions" || (window.innerWidth <= 768 && this.activeMobileTab === "portfolio")) {
      this.updatePositionsLiveData();
    }
    this.updateNavBadges();
  }

  // --- Order Modal Logic (Supports Equities & Options) ---
  setupOrderModal() {
    const modalBackdrop = document.getElementById("orderModalBackdrop");
    const closeBtn = document.getElementById("closeOrderModalBtn");
    const submitBtn = document.getElementById("submitOrderBtn");
    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");

    if (closeBtn) closeBtn.addEventListener("click", () => this.closeOrderModal());
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) this.closeOrderModal();
      });
    }

    const sideBtns = document.querySelectorAll(".side-toggle-btn");
    sideBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.getAttribute("data-side");
        this.setOrderSide(side);
      });
    });

    const productLabels = document.querySelectorAll(".product-radio-label");
    productLabels.forEach((label) => {
      label.addEventListener("click", () => {
        productLabels.forEach((l) => l.classList.remove("selected"));
        label.classList.add("selected");
        this.activeProduct = label.getAttribute("data-product");
        this.recalculateOrderMargin();
      });
    });

    const typeTabs = document.querySelectorAll(".order-type-tab");
    typeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        typeTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeOrderType = tab.getAttribute("data-type");

        if (priceInput) {
          if (this.activeOrderType === "MARKET") {
            priceInput.disabled = true;
            if (this.selectedStock) priceInput.value = this.selectedStock.price.toFixed(2);
          } else {
            priceInput.disabled = false;
          }
        }
        this.recalculateOrderMargin();
      });
    });

    if (qtyInput) qtyInput.addEventListener("input", () => this.recalculateOrderMargin());
    if (priceInput) priceInput.addEventListener("input", () => this.recalculateOrderMargin());
    if (submitBtn) submitBtn.addEventListener("click", () => this.handleOrderSubmit());
  }

  openOrderModal(symbol, side = "BUY") {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.selectedStock = stock;
    this.activeOrderSide = side;

    const modal = document.getElementById("orderModalBackdrop");
    const symbolEl = document.getElementById("modalStockSymbol");
    const priceEl = document.getElementById("modalStockLTP");
    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");
    const lotHint = document.getElementById("orderLotSizeHint");
    const productCNCLabel = document.getElementById("productCNCLabel");
    const marginNeededText = document.getElementById("marginNeededText");

    const isOption = !!stock.isOption;
    const defaultQty = isOption ? (stock.lotSize || 25) : 1;

    if (symbolEl) {
      symbolEl.innerHTML = `
        ${stock.symbol}
        ${isOption ? `<span class="badge-tag ${stock.optionType === 'CE' ? 'badge-ce' : 'badge-pe'}">${stock.optionType}</span>` : ''}
        <span class="exchange-tag">${stock.exchange}</span>
      `;
    }

    if (priceEl) priceEl.textContent = `LTP: ₹${stock.price.toFixed(2)}`;
    if (qtyInput) {
      qtyInput.value = defaultQty;
      qtyInput.step = isOption ? (stock.lotSize || 25) : 1;
      qtyInput.min = isOption ? (stock.lotSize || 25) : 1;
    }

    if (lotHint) {
      if (isOption) {
        lotHint.style.display = "block";
        lotHint.textContent = `1 Lot = ${stock.lotSize} Qty (Underlying: ${stock.underlyingSymbol})`;
      } else {
        lotHint.style.display = "none";
      }
    }

    if (productCNCLabel) {
      productCNCLabel.innerHTML = isOption
        ? `NRML <span style="font-size:10.5px;color:var(--text-muted);">(Overnight)</span>`
        : `CNC <span style="font-size:10.5px;color:var(--text-muted);">(Longterm)</span>`;
    }

    if (marginNeededText) {
      marginNeededText.textContent = isOption ? "Premium req:" : "Margin req:";
    }

    if (priceInput) priceInput.value = stock.price.toFixed(2);

    // If selling, pre-fill with held quantity and matching product
    if (side === "SELL") {
      const existingHolding = store.holdings.find(h => h.symbol === stock.symbol);
      const existingPos = store.positions.find(p => p.symbol === stock.symbol && p.status === "OPEN");
      if (existingHolding) {
        if (qtyInput) qtyInput.value = existingHolding.quantity;
        this.activeProduct = "CNC";
        document.querySelectorAll(".product-radio-label").forEach((l) => {
          l.classList.toggle("selected", l.getAttribute("data-product") === "CNC");
        });
      } else if (existingPos) {
        if (qtyInput) qtyInput.value = Math.abs(existingPos.quantity);
        this.activeProduct = existingPos.product;
        document.querySelectorAll(".product-radio-label").forEach((l) => {
          l.classList.toggle("selected", l.getAttribute("data-product") === existingPos.product);
        });
      }
    }

    const marketStatus = engine.getMarketStatus();
    const amoBanner = document.getElementById("amoNoticeBanner");
    if (amoBanner) {
      if (marketStatus.isOpen) {
        amoBanner.style.display = "none";
      } else {
        amoBanner.style.display = "flex";
        amoBanner.innerHTML = `
          <span style="font-size:16px;">💡</span>
          <span><b>Demo Practice Mode:</b> Market is closed (09:15 - 15:30 IST). Demo market orders execute immediately at LTP for continuous practice!</span>
        `;
      }
    }

    this.setOrderSide(side);
    this.recalculateOrderMargin();

    if (modal) modal.classList.add("open");
  }

  closeOrderModal() {
    const modal = document.getElementById("orderModalBackdrop");
    if (modal) modal.classList.remove("open");
  }

  setOrderSide(side) {
    this.activeOrderSide = side;
    const header = document.getElementById("orderModalHeader");
    const submitBtn = document.getElementById("submitOrderBtn");
    const sideBtns = document.querySelectorAll(".side-toggle-btn");

    sideBtns.forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-side") === side);
    });

    if (header) {
      header.className = `order-modal-header ${side === "BUY" ? "buy-theme" : "sell-theme"}`;
    }

    if (submitBtn) {
      submitBtn.textContent = `${side} ${this.selectedStock ? this.selectedStock.symbol : ''}`;
      submitBtn.className = `btn-submit-order ${side === "BUY" ? "buy-action" : "sell-action"}`;
    }

    this.recalculateOrderMargin();
  }

  recalculateOrderMargin() {
    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");
    const marginNeededEl = document.getElementById("marginRequiredVal");
    const marginAvailEl = document.getElementById("marginAvailableVal");
    const submitBtn = document.getElementById("submitOrderBtn");

    const qty = parseInt(qtyInput?.value, 10) || 0;
    const price = parseFloat(priceInput?.value) || (this.selectedStock?.price || 0);
    const isOption = !!this.selectedStock?.isOption;

    const marginReq = store.calculateMarginRequired(this.activeProduct, qty, price, isOption);
    const available = store.funds.availableCash;

    if (marginNeededEl) {
      marginNeededEl.textContent = `₹${marginReq.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      if (this.activeProduct === "MIS" && !isOption) {
        marginNeededEl.innerHTML += ` <span style="font-size:10.5px;color:var(--tp-orange);font-weight:700;">(5x Intraday)</span>`;
      }
    }

    if (marginAvailEl) {
      marginAvailEl.textContent = `₹${available.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    }

    if (submitBtn && this.activeOrderSide === "BUY") {
      if (marginReq > available) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";
        submitBtn.title = "Insufficient demo funds";
      } else {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.title = "";
      }
    } else if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
    }
  }

  handleOrderSubmit() {
    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");

    const quantity = parseInt(qtyInput?.value, 10);
    const price = parseFloat(priceInput?.value);

    const result = store.placeOrder({
      symbol: this.selectedStock.symbol,
      product: this.activeProduct,
      orderType: this.activeOrderType,
      side: this.activeOrderSide,
      quantity,
      price
    });

    if (result.success) {
      window.playChime();
      window.showToast(result.message, "success");
      this.closeOrderModal();
      this.renderUserQuickFunds();

      // On mobile screen, automatically navigate to Portfolio tab so the user immediately sees their trade and live P&L
      if (window.innerWidth <= 768) {
        if (this.activeProduct === "CNC") {
          this.switchMobileTab("portfolio");
          this.switchView("holdings");
        } else {
          this.switchMobileTab("portfolio");
          this.switchView("positions");
        }
      }
      this.renderActiveView();
    } else {
      sounds.playError();
      window.showToast(result.message, "error");
    }
  }

  // --- Interactive Option Chain Modal (CE & PE) ---
  setupOptionChainModal() {
    const modal = document.getElementById("optionChainModalBackdrop");
    const closeBtn = document.getElementById("closeOptionChainBtn");
    const select = document.getElementById("ocUnderlyingSelect");

    if (closeBtn) closeBtn.addEventListener("click", () => this.closeOptionChainModal());
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeOptionChainModal();
      });
    }

    if (select) {
      select.innerHTML = ALL_UNDERLYINGS.map((u) => `
        <option value="${u.symbol}" ${u.symbol === 'NIFTY 50' ? 'selected' : ''}>
          ${u.symbol} (${u.name})
        </option>
      `).join("");
    }
  }

  openOptionChainModal(underlyingSymbol = "NIFTY 50") {
    this.activeOCOptionUnderlying = underlyingSymbol;
    const modal = document.getElementById("optionChainModalBackdrop");
    const select = document.getElementById("ocUnderlyingSelect");
    if (select) select.value = underlyingSymbol;

    this.renderOptionChain(underlyingSymbol);
    if (modal) modal.classList.add("open");
  }

  closeOptionChainModal() {
    const modal = document.getElementById("optionChainModalBackdrop");
    if (modal) modal.classList.remove("open");
  }

  renderOptionChain(underlyingSymbol) {
    this.activeOCOptionUnderlying = underlyingSymbol;
    const underlying = STOCKS_MAP.get(underlyingSymbol);
    if (!underlying) return;

    const spotEl = document.getElementById("ocSpotPrice");
    if (spotEl) {
      spotEl.textContent = `₹${underlying.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    }

    this.refreshOptionChainRows();
  }

  refreshOptionChainRows() {
    const tbody = document.getElementById("optionChainTableBody");
    const underlying = STOCKS_MAP.get(this.activeOCOptionUnderlying);
    if (!tbody || !underlying) return;

    // Filter all Call and Put options for this underlying
    const allOptions = Array.from(STOCKS_MAP.values()).filter(
      s => s.isOption && s.underlyingSymbol === underlying.symbol
    );

    const strikesMap = new Map();
    allOptions.forEach(opt => {
      if (!strikesMap.has(opt.strike)) {
        strikesMap.set(opt.strike, { strike: opt.strike });
      }
      const item = strikesMap.get(opt.strike);
      if (opt.optionType === "CE") item.call = opt;
      else if (opt.optionType === "PE") item.put = opt;
    });

    const sortedStrikes = Array.from(strikesMap.values()).sort((a, b) => a.strike - b.strike);
    const step = underlying.strikeStep || 50;
    const atmStrike = Math.round(underlying.price / step) * step;

    tbody.innerHTML = sortedStrikes.map(row => {
      const isATM = Math.abs(row.strike - atmStrike) < (step / 2);
      const ce = row.call;
      const pe = row.put;

      return `
        <tr class="${isATM ? 'oc-row-atm' : ''}">
          <!-- CALLS (CE) -->
          <td style="color:var(--text-secondary);font-size:11.5px;">${ce ? ce.oi.toLocaleString() : '—'}</td>
          <td style="color:var(--text-secondary);font-size:11.5px;">${ce ? ce.volume.toLocaleString() : '—'}</td>
          <td class="oc-call-ltp">${ce ? '₹' + ce.price.toFixed(2) : '—'}</td>
          <td>
            ${ce ? `
              <div class="oc-btn-group">
                <button class="btn-oc-buy" onclick="app.openOrderModal('${ce.symbol}', 'BUY')">B</button>
                <button class="btn-oc-sell" onclick="app.openOrderModal('${ce.symbol}', 'SELL')">S</button>
              </div>
            ` : '—'}
          </td>

          <!-- STRIKE -->
          <td class="oc-strike-cell">
            ${row.strike}
            ${isATM ? `<span style="font-size:9.5px;margin-left:3px;opacity:0.9;">ATM</span>` : ''}
          </td>

          <!-- PUTS (PE) -->
          <td>
            ${pe ? `
              <div class="oc-btn-group">
                <button class="btn-oc-buy" onclick="app.openOrderModal('${pe.symbol}', 'BUY')">B</button>
                <button class="btn-oc-sell" onclick="app.openOrderModal('${pe.symbol}', 'SELL')">S</button>
              </div>
            ` : '—'}
          </td>
          <td class="oc-put-ltp">${pe ? '₹' + pe.price.toFixed(2) : '—'}</td>
          <td style="color:var(--text-secondary);font-size:11.5px;">${pe ? pe.volume.toLocaleString() : '—'}</td>
          <td style="color:var(--text-secondary);font-size:11.5px;">${pe ? pe.oi.toLocaleString() : '—'}</td>
        </tr>
      `;
    }).join("");
  }

  // --- Market Depth Modal ---
  setupDepthModal() {
    const modal = document.getElementById("depthModalBackdrop");
    const closeBtn = document.getElementById("closeDepthModalBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (modal) modal.classList.remove("open");
        this.activeDepthStock = null;
      });
    }
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("open");
          this.activeDepthStock = null;
        }
      });
    }
  }

  openDepthModal(symbol) {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.activeDepthStock = stock;
    const modal = document.getElementById("depthModalBackdrop");
    this.renderDepthContent(stock);
    if (modal) modal.classList.add("open");
  }

  renderDepthContent(stock) {
    const titleEl = document.getElementById("depthModalTitle");
    const bidsBody = document.getElementById("depthBidsBody");
    const asksBody = document.getElementById("depthAsksBody");
    const totalBidEl = document.getElementById("depthTotalBidQty");
    const totalAskEl = document.getElementById("depthTotalAskQty");

    const openEl = document.getElementById("depthOpenVal");
    const highEl = document.getElementById("depthHighVal");
    const lowEl = document.getElementById("depthLowVal");
    const closeEl = document.getElementById("depthCloseVal");
    const w52HighEl = document.getElementById("depth52WHigh");
    const w52LowEl = document.getElementById("depth52WLow");
    const rangeFill = document.getElementById("depth52WFill");

    if (titleEl) {
      titleEl.innerHTML = `
        <span class="font-bold">${stock.symbol}</span>
        <span class="sector-tag ${stock.sectorClass}" style="margin-left:6px;">${stock.sector}</span>
        <span class="exchange-tag" style="margin-left:4px;">${stock.exchange}</span>
        <span style="margin-left:14px;font-weight:800;color:${stock.change >= 0 ? 'var(--tp-green-bright)' : 'var(--tp-red-bright)'}">₹${stock.price.toFixed(2)}</span>
      `;
    }

    if (bidsBody && stock.depth) {
      bidsBody.innerHTML = stock.depth.bids.map((b) => `
        <tr>
          <td class="price">₹${b.price.toFixed(2)}</td>
          <td class="text-right">${b.orders}</td>
          <td class="text-right font-semibold">${b.quantity.toLocaleString()}</td>
        </tr>
      `).join("");
      if (totalBidEl) totalBidEl.textContent = stock.depth.totalBidQty.toLocaleString();
    }

    if (asksBody && stock.depth) {
      asksBody.innerHTML = stock.depth.asks.map((a) => `
        <tr>
          <td class="price">₹${a.price.toFixed(2)}</td>
          <td class="text-right">${a.orders}</td>
          <td class="text-right font-semibold">${a.quantity.toLocaleString()}</td>
        </tr>
      `).join("");
      if (totalAskEl) totalAskEl.textContent = stock.depth.totalAskQty.toLocaleString();
    }

    if (openEl) openEl.textContent = `₹${stock.open.toFixed(2)}`;
    if (highEl) highEl.textContent = `₹${stock.high.toFixed(2)}`;
    if (lowEl) lowEl.textContent = `₹${stock.low.toFixed(2)}`;
    if (closeEl) closeEl.textContent = `₹${stock.prevClose.toFixed(2)}`;
    if (w52HighEl) w52HighEl.textContent = `₹${(stock.w52High || stock.high || stock.price * 1.2).toFixed(2)}`;
    if (w52LowEl) w52LowEl.textContent = `₹${(stock.w52Low || stock.low || stock.price * 0.8).toFixed(2)}`;

    if (rangeFill) {
      const high = stock.w52High || stock.price * 1.2;
      const low = stock.w52Low || stock.price * 0.8;
      const pct = Math.min(100, Math.max(0, ((stock.price - low) / (high - low)) * 100));
      rangeFill.style.width = `${pct.toFixed(1)}%`;
    }
  }

  // --- Interactive Canvas Chart ---
  setupChart() {
    this.chart = new StockChart("mainStockChartCanvas");
    if (this.selectedStock) {
      this.viewStockChart(this.selectedStock.symbol);
    }

    document.querySelectorAll(".chart-tf-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".chart-tf-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tf = btn.getAttribute("data-tf");
        if (this.chart) this.chart.setStock(this.selectedStock, tf);
      });
    });

    const typeBtn = document.getElementById("toggleChartTypeBtn");
    if (typeBtn) {
      typeBtn.addEventListener("click", () => {
        if (!this.chart) return;
        const newType = this.chart.chartType === "candle" ? "line" : "candle";
        this.chart.setChartType(newType);
        typeBtn.textContent = newType === "candle" ? "📊 Candlestick" : "📈 Line";
      });
    }

    const buyBtn = document.getElementById("chartModalBuyBtn");
    if (buyBtn) {
      buyBtn.onclick = () => {
        this.closeChartModal();
        if (this.selectedStock) this.openOrderModal(this.selectedStock.symbol, "BUY");
      };
    }
    const sellBtn = document.getElementById("chartModalSellBtn");
    if (sellBtn) {
      sellBtn.onclick = () => {
        this.closeChartModal();
        if (this.selectedStock) this.openOrderModal(this.selectedStock.symbol, "SELL");
      };
    }
    const ocBtn = document.getElementById("chartModalOcBtn");
    if (ocBtn) {
      ocBtn.onclick = () => {
        this.closeChartModal();
        if (this.selectedStock) this.openOptionChainModal(this.selectedStock.symbol);
      };
    }
  }

  openChartModal(symbol) {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.selectedStock = stock;
    const modal = document.getElementById("chartModalBackdrop");
    this.viewStockChart(symbol);
    if (modal) modal.classList.add("open");
    if (this.chart) {
      setTimeout(() => {
        this.chart.resize();
        this.chart.render();
      }, 60);
    }
  }

  closeChartModal() {
    const modal = document.getElementById("chartModalBackdrop");
    if (modal) modal.classList.remove("open");
  }

  viewStockChart(symbol) {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.selectedStock = stock;

    const symEl = document.getElementById("chartStockSymbol");
    const ltpEl = document.getElementById("chartStockLTP");
    const chgEl = document.getElementById("chartStockChange");

    if (symEl) symEl.textContent = `${stock.symbol} (${stock.name})`;
    if (ltpEl) ltpEl.textContent = `₹${stock.price.toFixed(2)}`;
    if (chgEl) {
      const isPos = stock.change >= 0;
      chgEl.className = `font-bold ${isPos ? 'text-green' : 'text-red'}`;
      chgEl.textContent = `${isPos ? '+' : ''}${stock.change.toFixed(2)} (${isPos ? '+' : ''}${stock.pChange.toFixed(2)}%)`;
    }

    if (this.chart) {
      this.chart.setStock(stock);
    }
  }

  // 2. Holdings View
  renderHoldings() {
    const tbody = document.getElementById("holdingsTableBody");
    const emptyState = document.getElementById("holdingsEmptyState");
    const mobCards = document.getElementById("holdingsMobileCards");
    const mobPnlEl = document.getElementById("mobHoldingsTotalPL");
    const mobInvestedEl = document.getElementById("mobHoldingsInvested");
    const mobCurrentEl = document.getElementById("mobHoldingsCurrent");
    const totalInvestedEl = document.getElementById("holdingsTotalInvested");
    const curValEl = document.getElementById("holdingsCurrentVal");
    const totalPLEl = document.getElementById("holdingsTotalPL");
    const dayPLEl = document.getElementById("holdingsDayPL");

    if (!tbody) return;

    if (store.holdings.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (mobCards) {
        mobCards.innerHTML = `
          <div class="mob-empty-msg">
            <div style="font-size:24px;margin-bottom:6px;">💼</div>
            <div style="font-weight:700;color:var(--text-dark);margin-bottom:4px;">No active holdings</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Use your demo capital to buy CNC equity shares from the watchlist.</div>
            <button class="btn-primary" style="font-size:12px;padding:6px 14px;" onclick="app.switchMobileTab('watchlist')">Browse Watchlist</button>
          </div>
        `;
      }
      if (mobPnlEl) {
        mobPnlEl.className = "mob-pnl-val";
        mobPnlEl.textContent = "₹0.00 (0.00%)";
      }
      if (mobInvestedEl) mobInvestedEl.textContent = "₹0.00";
      if (mobCurrentEl) mobCurrentEl.textContent = "₹0.00";
      if (totalInvestedEl) totalInvestedEl.textContent = "₹0.00";
      if (curValEl) curValEl.textContent = "₹0.00";
      if (totalPLEl) {
        totalPLEl.className = "kpi-val";
        totalPLEl.textContent = "₹0.00 (0.00%)";
      }
      if (dayPLEl) dayPLEl.textContent = "₹0.00";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let totalInvested = 0;
    let totalCurrent = 0;
    let totalDayPL = 0;
    let totalRealizedGain = 0;
    const cardsHtml = [];

    tbody.innerHTML = store.holdings.map((h) => {
      const stock = STOCKS_MAP.get(h.symbol);
      const isClosed = h.quantity === 0 || h.status === "CLOSED";
      const ltp = stock ? stock.price : (h.exitPrice || h.avgPrice);
      const curVal = isClosed ? 0 : (h.quantity * ltp);
      const pl = isClosed ? (h.realizedPL || 0) : (curVal - h.investedValue);
      const plPct = (!isClosed && h.investedValue > 0) ? (pl / h.investedValue) * 100 : 0;
      const isPositive = pl >= 0;

      const dayChange = (!isClosed && stock) ? stock.change * h.quantity : 0;
      const dayPct = stock ? stock.pChange : 0;

      if (!isClosed) {
        totalInvested += h.investedValue;
        totalCurrent += curVal;
        totalDayPL += dayChange;
      } else {
        totalRealizedGain += (h.realizedPL || 0);
      }

      cardsHtml.push(`
        <div class="kite-card ${isClosed ? 'kite-card-closed' : ''}">
          <div class="kite-card-row kite-row-top">
            <div class="kite-card-qty-avg">
              <span>Qty. <b class="${isClosed ? 'text-muted' : 'font-bold'}">${h.quantity}</b></span>
              <span class="kite-sep">•</span>
              <span>Avg. <b>${isClosed ? '0.00' : h.avgPrice.toFixed(2)}</b></span>
            </div>
            <span class="badge-tag tag-cnc">CNC</span>
          </div>
          <div class="kite-card-row kite-row-mid">
            <div class="kite-card-symbol">${h.symbol}</div>
            <div class="kite-card-pnl ${isPositive ? 'text-green' : 'text-red'}">
              ${isPositive ? '+' : ''}${pl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="kite-card-row kite-row-bottom">
            <div class="kite-card-exchange">${h.exchange || 'NSE'}</div>
            <div class="kite-card-ltp">LTP <b>₹${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          </div>
          <div class="kite-card-actions">
            ${!isClosed ? `
              <button class="mob-btn-exit" onclick="app.openOrderModal('${h.symbol}', 'SELL')">Exit / Sell</button>
              <button class="mob-btn-add" onclick="app.openOrderModal('${h.symbol}', 'BUY')">+ Add More</button>
            ` : `
              <button class="mob-btn-add" style="width:100%;" onclick="app.openOrderModal('${h.symbol}', 'BUY')">+ Re-buy ${h.symbol}</button>
            `}
          </div>
        </div>
      `);

      return `
        <tr class="${isClosed ? 'row-closed' : ''}">
          <td>
            <div class="font-bold text-dark">
              ${h.symbol}
              ${isClosed ? '<span class="badge-tag tag-complete" style="margin-left:6px;font-size:10px;">CLOSED</span>' : ''}
            </div>
            <div style="font-size:11.5px;color:var(--text-secondary);">${h.name}</div>
          </td>
          <td class="text-right font-bold ${isClosed ? 'text-muted' : ''}">${h.quantity}</td>
          <td class="text-right">${isClosed ? '—' : `₹${h.avgPrice.toFixed(2)}`}</td>
          <td class="text-right font-bold">₹${ltp.toFixed(2)}</td>
          <td class="text-right font-bold">₹${curVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td class="text-right font-bold ${isPositive ? 'text-green' : 'text-red'}">
            ${isPositive ? '+' : ''}₹${pl.toFixed(2)} ${!isClosed ? `(${isPositive ? '+' : ''}${plPct.toFixed(2)}%)` : '(Realized)'}
          </td>
          <td class="text-right ${dayChange >= 0 ? 'text-green' : 'text-red'}">
            ${isClosed ? '—' : `${dayChange >= 0 ? '+' : ''}₹${dayChange.toFixed(2)} (${dayPct.toFixed(2)}%)`}
          </td>
          <td class="text-right">
            ${!isClosed ? `
              <button class="btn-primary" style="padding:4px 8px;font-size:11.5px;" onclick="app.openOrderModal('${h.symbol}', 'BUY')">Add</button>
              <button class="btn-danger" style="padding:4px 8px;font-size:11.5px;margin-left:4px;" onclick="app.openOrderModal('${h.symbol}', 'SELL')">Exit</button>
            ` : `
              <button class="btn-primary" style="padding:4px 8px;font-size:11.5px;" onclick="app.openOrderModal('${h.symbol}', 'BUY')">+ Re-buy</button>
            `}
          </td>
        </tr>
      `;
    }).join("");

    if (mobCards) mobCards.innerHTML = cardsHtml.join("");

    const totalPL = (totalCurrent - totalInvested) + totalRealizedGain;
    const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    if (totalInvestedEl) totalInvestedEl.textContent = `₹${totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (curValEl) curValEl.textContent = `₹${totalCurrent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (totalPLEl) {
      totalPLEl.className = `kpi-val ${totalPL >= 0 ? 'text-green' : 'text-red'}`;
      totalPLEl.textContent = `${totalPL >= 0 ? '+' : ''}₹${totalPL.toFixed(2)} ${totalInvested > 0 ? `(${totalPLPct.toFixed(2)}%)` : '(Realized)'}`;
    }
    if (dayPLEl) {
      dayPLEl.className = `kpi-val ${totalDayPL >= 0 ? 'text-green' : 'text-red'}`;
      dayPLEl.textContent = `${totalDayPL >= 0 ? '+' : ''}₹${totalDayPL.toFixed(2)}`;
    }
    if (mobPnlEl) {
      mobPnlEl.className = `mob-pnl-val ${totalPL >= 0 ? 'text-green' : 'text-red'}`;
      mobPnlEl.textContent = `${totalPL >= 0 ? '+' : ''}₹${totalPL.toFixed(2)} ${totalInvested > 0 ? `(${totalPLPct.toFixed(2)}%)` : ''}`;
    }
    if (mobInvestedEl) mobInvestedEl.textContent = `₹${totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (mobCurrentEl) mobCurrentEl.textContent = `₹${totalCurrent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }

  updateHoldingsLiveData() {
    this.renderHoldings();
  }

  // 3. Positions View (Intraday MIS & F&O Options)
  renderPositions() {
    const tbody = document.getElementById("positionsTableBody");
    const emptyState = document.getElementById("positionsEmptyState");
    const mtmKpi = document.getElementById("positionsTotalMTM");
    const mobCards = document.getElementById("positionsMobileCards");
    const mobPnlEl = document.getElementById("mobPositionsTotalPL");

    if (!tbody) return;

    const todayPositions = store.positions;

    if (todayPositions.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (mobCards) {
        mobCards.innerHTML = `
          <div class="mob-empty-msg">
            <div style="font-size:24px;margin-bottom:6px;">⚡</div>
            <div style="font-weight:700;color:var(--text-dark);margin-bottom:4px;">No open positions</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Trade Call & Put options or MIS intraday stocks to see live MTM P&L.</div>
            <button class="btn-primary" style="font-size:12px;padding:6px 14px;" onclick="app.openOptionChainModal('NIFTY 50')">Open Option Chain</button>
          </div>
        `;
      }
      if (mtmKpi) {
        mtmKpi.className = "kpi-val";
        mtmKpi.textContent = "₹0.00";
      }
      if (mobPnlEl) {
        mobPnlEl.className = "mob-pnl-val";
        mobPnlEl.textContent = "₹0.00";
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let totalMTM = 0;
    let totalRealized = 0;
    const cardsHtml = [];

    tbody.innerHTML = todayPositions.map((pos) => {
      const stock = STOCKS_MAP.get(pos.symbol);
      const isClosed = pos.status === "CLOSED" || pos.quantity === 0;
      const ltp = stock ? stock.price : (pos.exitPrice || pos.avgPrice);
      const isLong = pos.quantity > 0;

      let pnl = 0;
      if (isClosed) {
        pnl = pos.realizedPL || 0;
        totalRealized += pnl;
      } else {
        const pnlPerShare = isLong ? (ltp - pos.avgPrice) : (pos.avgPrice - ltp);
        pnl = pnlPerShare * Math.abs(pos.quantity);
        totalMTM += pnl;
      }
      const isProfitable = pnl >= 0;

      let exchange = "NSE";
      if (pos.isOption) {
        exchange = pos.underlying === "SENSEX" ? "BFO" : "NFO";
      } else if (stock && stock.exchange) {
        exchange = stock.exchange;
      }

      const productTag = pos.isOption ? (pos.optionType === "CE" ? "badge-ce" : "badge-pe") : "tag-mis";

      cardsHtml.push(`
        <div class="kite-card ${isClosed ? 'kite-card-closed' : ''}">
          <div class="kite-card-row kite-row-top">
            <div class="kite-card-qty-avg">
              <span>Qty. <b class="${isClosed ? 'text-muted' : (isLong ? 'text-blue' : 'text-red')}">${isClosed ? '0' : pos.quantity}</b></span>
              <span class="kite-sep">•</span>
              <span>Avg. <b>${isClosed ? '0.00' : pos.avgPrice.toFixed(2)}</b></span>
            </div>
            <span class="badge-tag ${productTag}">${pos.product || 'NRML'}</span>
          </div>
          <div class="kite-card-row kite-row-mid">
            <div class="kite-card-symbol">${pos.symbol}</div>
            <div class="kite-card-pnl ${isProfitable ? 'text-green' : 'text-red'}">
              ${isProfitable ? '+' : ''}${pnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="kite-card-row kite-row-bottom">
            <div class="kite-card-exchange">${exchange}</div>
            <div class="kite-card-ltp">LTP <b>₹${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          </div>
          <div class="kite-card-actions">
            ${!isClosed ? `
              <button class="mob-btn-exit" onclick="app.exitPosition('${pos.id}')">Exit Position</button>
              <button class="mob-btn-add" onclick="app.openOrderModal('${pos.symbol}', 'BUY')">+ Add More</button>
            ` : `
              <button class="mob-btn-add" style="width:100%;" onclick="app.openOrderModal('${pos.symbol}', 'BUY')">+ Trade ${pos.symbol} Again</button>
            `}
          </div>
        </div>
      `);

      return `
        <tr class="${isClosed ? 'row-closed' : ''}">
          <td>
            <span class="badge-tag ${pos.isOption ? (pos.optionType === 'CE' ? 'badge-ce' : 'badge-pe') : 'tag-mis'}">
              ${pos.isOption ? `${pos.optionType} (${pos.product})` : 'MIS 5x'}
            </span>
          </td>
          <td>
            <div class="font-bold text-dark">
              ${pos.symbol}
              ${isClosed ? '<span class="badge-tag tag-complete" style="margin-left:6px;font-size:10px;">CLOSED</span>' : ''}
            </div>
            <div style="font-size:11.5px;color:var(--text-secondary);">${pos.name}</div>
          </td>
          <td class="text-right font-bold ${isClosed ? 'text-muted' : (isLong ? 'text-blue' : 'text-red')}">
            ${isClosed ? '0' : pos.quantity}
          </td>
          <td class="text-right">${isClosed ? '—' : `₹${pos.avgPrice.toFixed(2)}`}</td>
          <td class="text-right font-bold">₹${ltp.toFixed(2)}</td>
          <td class="text-right font-bold ${isProfitable ? 'text-green' : 'text-red'}">
            ${isProfitable ? '+' : ''}₹${pnl.toFixed(2)} ${isClosed ? '(Realized)' : ''}
          </td>
          <td class="text-right">
            ${!isClosed ? `
              <button class="btn-danger" style="padding:4px 10px;font-size:11.5px;" onclick="app.exitPosition('${pos.id}')">Exit</button>
            ` : `
              <button class="btn-primary" style="padding:4px 8px;font-size:11.5px;" onclick="app.openOrderModal('${pos.symbol}', 'BUY')">Trade Again</button>
            `}
          </td>
        </tr>
      `;
    }).join("");

    if (mobCards) mobCards.innerHTML = cardsHtml.join("");

    const totalNetPositionsPL = totalMTM + totalRealized;

    if (mtmKpi) {
      mtmKpi.className = `kpi-val ${totalNetPositionsPL >= 0 ? 'text-green' : 'text-red'}`;
      mtmKpi.textContent = `${totalNetPositionsPL >= 0 ? '+' : ''}₹${totalNetPositionsPL.toFixed(2)}`;
    }
    if (mobPnlEl) {
      mobPnlEl.className = `mob-pnl-val ${totalNetPositionsPL >= 0 ? 'text-green' : 'text-red'}`;
      mobPnlEl.textContent = `${totalNetPositionsPL >= 0 ? '+' : ''}₹${totalNetPositionsPL.toFixed(2)}`;
    }
  }

  updatePositionsLiveData() {
    this.renderPositions();
  }

  exitPosition(positionId) {
    const res = store.exitPosition(positionId);
    if (res.success) {
      window.playChime();
      window.showToast("Position squared off successfully!", "success");
      this.renderUserQuickFunds();
      this.renderPositions();
    } else {
      window.showToast(res.message, "error");
    }
  }

  exitAllPositions() {
    const count = store.exitAllPositions();
    if (count > 0) {
      window.playChime();
      window.showToast(`Squared off all ${count} open positions!`, "success");
      this.renderUserQuickFunds();
      this.renderPositions();
    } else {
      window.showToast("No open positions to square off.", "info");
    }
  }

  // 4. Orders View
  renderOrders() {
    const tbody = document.getElementById("ordersTableBody");
    const emptyState = document.getElementById("ordersEmptyState");
    const mobCards = document.getElementById("ordersMobileCards");

    if (!tbody) return;

    if (store.orders.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (mobCards) {
        mobCards.innerHTML = `
          <div class="mob-empty-msg">
            <div style="font-size:24px;margin-bottom:6px;">📋</div>
            <div style="font-weight:700;color:var(--text-dark);margin-bottom:4px;">No orders placed yet</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Execute demo trades on stocks or options.</div>
            <button class="btn-primary" style="font-size:12px;padding:6px 14px;" onclick="app.switchMobileTab('watchlist')">Browse Watchlist</button>
          </div>
        `;
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    const cardsHtml = [];

    tbody.innerHTML = store.orders.map((o) => {
      const isComplete = o.status === "COMPLETE";
      const isAMO = o.status === "AMO PENDING";
      const isOpen = o.status === "OPEN";

      cardsHtml.push(`
        <div class="mob-pos-card">
          <div class="mob-pos-top">
            <div class="mob-pos-left">
              <span class="badge-tag ${o.side === 'BUY' ? 'tag-cnc' : 'tag-mis'}" style="font-weight:800;">${o.side}</span>
              <span class="badge-tag ${o.product === 'CNC' || o.product === 'NRML' ? 'tag-cnc' : 'tag-mis'}">${o.product}</span>
              <span class="mob-pos-symbol">${o.symbol}</span>
            </div>
            <div>
              <span class="badge-tag ${isComplete ? 'tag-complete' : isAMO ? 'tag-amo' : isOpen ? 'tag-open' : 'tag-cancelled'}">
                ${o.status}
              </span>
            </div>
          </div>
          <div class="mob-pos-mid">
            <div class="mob-pos-stat">
              <span class="stat-lbl">Type</span>
              <span class="stat-val font-bold">${o.orderType}</span>
            </div>
            <div class="mob-pos-stat">
              <span class="stat-lbl">Qty</span>
              <span class="stat-val font-bold">${o.quantity}</span>
            </div>
            <div class="mob-pos-stat">
              <span class="stat-lbl">Price</span>
              <span class="stat-val font-bold">₹${o.price.toFixed(2)}</span>
            </div>
            <div class="mob-pos-stat">
              <span class="stat-lbl">Time</span>
              <span class="stat-val" style="font-size:11px;">${o.time}</span>
            </div>
          </div>
          ${o.statusMessage ? `<div style="font-size:11.5px;color:var(--text-secondary);padding:0 4px 6px;">${o.statusMessage}</div>` : ''}
          ${(isOpen || isAMO) ? `
            <div class="mob-pos-actions">
              <button class="mob-btn-execute" onclick="app.forceExecuteOrder('${o.id}')">⚡ Execute Now</button>
              <button class="mob-btn-exit" onclick="app.cancelOrder('${o.id}')">Cancel</button>
            </div>
          ` : ''}
        </div>
      `);

      return `
        <tr>
          <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted);">${o.time}</span></td>
          <td>
            <span class="badge-tag ${o.side === 'BUY' ? 'tag-cnc' : 'tag-mis'}" style="font-weight:800;">
              ${o.side}
            </span>
          </td>
          <td>
            <div class="font-bold text-dark">
              ${o.symbol}
              ${o.isOption ? `<span class="badge-tag ${o.optionType === 'CE' ? 'badge-ce' : 'badge-pe'}" style="margin-left:4px;">${o.optionType}</span>` : ''}
            </div>
            <div style="font-size:11.5px;color:var(--text-secondary);">${o.name}</div>
          </td>
          <td><span class="badge-tag ${o.product === 'CNC' || o.product === 'NRML' ? 'tag-cnc' : 'tag-mis'}">${o.product}</span></td>
          <td><b>${o.orderType}</b></td>
          <td class="text-right font-bold">${o.quantity}</td>
          <td class="text-right font-bold">₹${o.price.toFixed(2)}</td>
          <td>
            <span class="badge-tag ${isComplete ? 'tag-complete' : isAMO ? 'tag-amo' : isOpen ? 'tag-open' : 'tag-cancelled'}">
              ${o.status}
            </span>
            <span style="font-size:11px;color:var(--text-secondary);margin-left:6px;">${o.statusMessage || ''}</span>
          </td>
          <td class="text-right">
            ${(isOpen || isAMO) ? `
              <button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-right:4px;" onclick="app.forceExecuteOrder('${o.id}')" title="Instantly execute order">Execute</button>
              <button class="btn-danger" style="padding:3px 8px;font-size:11px;" onclick="app.cancelOrder('${o.id}')">Cancel</button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join("");

    if (mobCards) mobCards.innerHTML = cardsHtml.join("");
  }

  forceExecuteOrder(orderId) {
    if (store.executeOrder(orderId)) {
      window.playChime();
      window.showToast("Order executed successfully!", "success");
      this.renderUserQuickFunds();
      this.renderOrders();
      this.renderPositions();
      this.renderHoldings();
    } else {
      window.showToast("Order could not be executed.", "error");
    }
  }

  cancelOrder(orderId) {
    if (store.cancelOrder(orderId)) {
      window.showToast("Order cancelled successfully.", "info");
      this.renderOrders();
      this.renderUserQuickFunds();
    }
  }

  // 5. Funds View
  renderFunds() {
    const availEl = document.getElementById("fundsAvailableMargin");
    const usedEl = document.getElementById("fundsUsedMargin");
    const totalCashEl = document.getElementById("fundsTotalCash");
    const initCapitalEl = document.getElementById("fundsInitialCapital");

    if (availEl) availEl.textContent = `₹${store.funds.availableCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (usedEl) usedEl.textContent = `₹${store.funds.usedMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (totalCashEl) totalCashEl.textContent = `₹${store.funds.totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (initCapitalEl) initCapitalEl.textContent = `₹${store.funds.initialCapital.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }

  setupFundsActions() {
    const resetBtn = document.getElementById("resetDemoFundsBtn");
    const addCashBtn = document.getElementById("addDemoCashBtn");

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Reset your demo account back to ₹20,000.00? (This will clear open demo orders and holdings)")) {
          store.resetFunds(20000);
          window.playChime();
          window.showToast("Demo account reset to ₹20,000.00!", "success");
          this.renderUserQuickFunds();
          this.renderActiveView();
        }
      });
    }

    if (addCashBtn) {
      addCashBtn.addEventListener("click", () => {
        store.addDemoCash(10000);
        window.playChime();
        window.showToast("Added +₹10,000 practice funds to demo account!", "success");
        this.renderUserQuickFunds();
        this.renderActiveView();
      });
    }
  }

  // ==========================================================================
  // ZERODHA KITE MOBILE CONTROLLER
  // ==========================================================================
  setupMobile() {
    // If mobile viewport on initial page load, default to Watchlist view
    if (window.innerWidth <= 768) {
      document.body.setAttribute("data-mobile-tab", "watchlist");
      this.updateMobileTabState("watchlist");
    }

    // Sync mobile tick toggle in Funds tab with engine
    const mobTickToggle = document.getElementById("forceMarketTickToggleMob");
    const desktopTickToggle = document.getElementById("forceMarketTickToggle");
    if (mobTickToggle) {
      mobTickToggle.addEventListener("change", (e) => {
        engine.setForceOpen(e.target.checked);
        if (desktopTickToggle) desktopTickToggle.checked = e.target.checked;
        window.showToast(e.target.checked ? "Market simulated: LIVE TICKS ACTIVE" : "Market set to: OFFICIAL MARKET HOURS (09:15 - 15:30 IST)", "info");
      });
    }

    // Window resize handler: gracefully sync layout
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        document.body.removeAttribute("data-mobile-tab");
      } else {
        if (!document.body.getAttribute("data-mobile-tab")) {
          document.body.setAttribute("data-mobile-tab", "watchlist");
          this.updateMobileTabState("watchlist");
        }
      }
    });
  }

  switchMobileTab(tab) {
    this.activeMobileTab = tab;
    this.updateMobileTabState(tab);

    if (tab === "watchlist") {
      this.renderWatchlist();
      const pane = document.querySelector(".watchlist-pane");
      if (pane) pane.scrollTop = 0;
    } else if (tab === "orders") {
      this.switchView("orders");
    } else if (tab === "portfolio") {
      // Smart mobile default: if user has open positions and no holdings, default to positions; else holdings
      if (this.currentView === "positions" || (store.positions.length > 0 && store.holdings.length === 0)) {
        this.switchView("positions");
      } else {
        this.switchView("holdings");
      }
    } else if (tab === "funds") {
      this.switchView("funds");
    }
  }

  openStockSheet(symbol) {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.selectedStock = stock;

    const sheet = document.getElementById("mobileStockSheetBackdrop");
    const symEl = document.getElementById("sheetStockSymbol");
    const exEl = document.getElementById("sheetStockExchange");
    const secEl = document.getElementById("sheetStockSector");
    const nameEl = document.getElementById("sheetStockFullname");
    const ltpEl = document.getElementById("sheetStockLTP");
    const deltaEl = document.getElementById("sheetStockDelta");

    const btnBuy = document.getElementById("sheetBtnBuy");
    const btnSell = document.getElementById("sheetBtnSell");
    const btnChart = document.getElementById("sheetBtnChart");
    const btnOc = document.getElementById("sheetBtnOptionChain");
    const btnDepth = document.getElementById("sheetBtnDepth");

    const isPos = stock.change >= 0;

    if (symEl) symEl.textContent = stock.symbol;
    if (exEl) exEl.textContent = stock.exchange || "NSE";
    if (secEl) {
      secEl.textContent = stock.sector || "EQUITY";
      secEl.className = `sheet-sector-tag ${stock.sectorClass || ''}`;
    }
    if (nameEl) nameEl.textContent = stock.name;
    if (ltpEl) ltpEl.textContent = `₹${stock.price.toFixed(2)}`;
    if (deltaEl) {
      deltaEl.className = `sheet-delta ${isPos ? 'text-green' : 'text-red'}`;
      deltaEl.textContent = `${isPos ? '+' : ''}${stock.change.toFixed(2)} (${isPos ? '+' : ''}${stock.pChange.toFixed(2)}%)`;
    }

    // OHLC Summary stats
    const openVal = stock.prevClose ? (stock.prevClose * 1.002).toFixed(2) : stock.price.toFixed(2);
    const highVal = (stock.price * 1.012).toFixed(2);
    const lowVal = (stock.price * 0.988).toFixed(2);
    const prevVal = (stock.prevClose || stock.price).toFixed(2);

    const statOpen = document.getElementById("sheetStatOpen");
    const statHigh = document.getElementById("sheetStatHigh");
    const statLow = document.getElementById("sheetStatLow");
    const statClose = document.getElementById("sheetStatClose");

    if (statOpen) statOpen.textContent = `₹${openVal}`;
    if (statHigh) statHigh.textContent = `₹${highVal}`;
    if (statLow) statLow.textContent = `₹${lowVal}`;
    if (statClose) statClose.textContent = `₹${prevVal}`;

    // Action button listeners
    if (btnBuy) {
      btnBuy.onclick = () => {
        this.closeStockSheet();
        this.openOrderModal(stock.symbol, "BUY");
      };
    }
    if (btnSell) {
      btnSell.onclick = () => {
        this.closeStockSheet();
        this.openOrderModal(stock.symbol, "SELL");
      };
    }
    if (btnChart) {
      btnChart.onclick = () => {
        this.closeStockSheet();
        this.openChartModal(stock.symbol);
      };
    }
    if (btnOc) {
      btnOc.onclick = () => {
        this.closeStockSheet();
        this.openOptionChainModal(stock.symbol);
      };
    }
    if (btnDepth) {
      btnDepth.onclick = () => {
        this.closeStockSheet();
        this.openDepthModal(stock.symbol);
      };
    }

    if (sheet) sheet.classList.add("open");
  }

  closeStockSheet() {
    const sheet = document.getElementById("mobileStockSheetBackdrop");
    if (sheet) sheet.classList.remove("open");
  }
}

// Global App bootstrap
let app = null;
function initTradePulseApp() {
  if (!window.app) {
    app = new App();
    window.app = app;
  }
}
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initTradePulseApp);
} else {
  initTradePulseApp();
}
