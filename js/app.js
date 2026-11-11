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
    this.selectedStock = STOCKS_MAP.get("DLF") || STOCKS_MAP.get("LT") || Array.from(STOCKS_MAP.values())[0];
    this.activeOrderSide = "BUY";
    this.activeProduct = "CNC";
    this.activeOrderType = "MARKET";
    this.chart = null;
    this.activeDepthStock = null;
    this.activeAuthTab = "signup";
    this.activeOCOptionUnderlying = "NIFTY 50";
    this.activeMobileTab = "watchlist";
    this.activeOrderSubtab = "open";
    this.activeBidsSubtab = "ipo";
    this.privacyMode = false;

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
    this.renderAccount();
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
    } else if (viewName === "bids") {
      this.activeMobileTab = "bids";
      this.updateMobileTabState("bids");
    } else if (viewName === "account") {
      this.activeMobileTab = "account";
      this.updateMobileTabState("account");
    } else if (viewName === "funds") {
      this.activeMobileTab = "funds";
      this.updateMobileTabState("funds");
    }

    // Always ensure both portfolio views are rendered when in portfolio
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
      case "bids":
        this.renderBids();
        break;
      case "account":
        this.renderAccount();
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

    // Mobile Portfolio Subtabs Counts & Badges
    const totalHoldingsCount = store.holdings.length;
    const mobHCount = document.getElementById("mobHoldingsTabCount");
    const mobHCount2 = document.getElementById("mobHoldingsTabCount2");
    if (mobHCount) mobHCount.textContent = totalHoldingsCount;
    if (mobHCount2) mobHCount2.textContent = totalHoldingsCount;

    const mobPCount = document.getElementById("mobPositionsTabCount");
    const mobPCount2 = document.getElementById("mobPositionsTabCount2");
    if (mobPCount) mobPCount.textContent = totalPositionsCount;
    if (mobPCount2) mobPCount2.textContent = totalPositionsCount;

    // Authentic Zerodha Kite Header Subtab Badges
    const pBadge1 = document.getElementById("portPositionsTabBadge");
    const pBadge2 = document.getElementById("portPositionsTabBadge2");
    if (pBadge1) {
      pBadge1.textContent = totalPositionsCount;
      pBadge1.style.display = totalPositionsCount ? "inline-block" : "none";
    }
    if (pBadge2) {
      pBadge2.textContent = totalPositionsCount;
      pBadge2.style.display = totalPositionsCount ? "inline-block" : "none";
    }

    const hBadge1 = document.getElementById("portHoldingsTabBadge");
    const hBadge2 = document.getElementById("portHoldingsTabBadge2");
    if (hBadge1) {
      hBadge1.textContent = totalHoldingsCount;
      hBadge1.style.display = totalHoldingsCount ? "inline-block" : "none";
    }
    if (hBadge2) {
      hBadge2.textContent = totalHoldingsCount;
      hBadge2.style.display = totalHoldingsCount ? "inline-block" : "none";
    }

    const mobNavUser = document.getElementById("mobBottomNavUserId");
    if (mobNavUser) {
      mobNavUser.textContent = (store.currentUser && store.currentUser.clientId) ? store.currentUser.clientId : "TP7842";
    }
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
    const tabs = document.querySelectorAll(".kite-wl-subtabs-bar .kite-subtab-btn, .wl-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        store.activeWatchlist = parseInt(tab.getAttribute("data-wl"), 10) || 1;
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

        const terms = query.split(/\s+/).filter(Boolean);
        const matches = Array.from(STOCKS_MAP.values()).filter((s) => {
          const optType = s.optionType || "";
          const underlying = s.underlyingSymbol || "";
          const fullText = `${s.symbol} ${s.name} ${underlying} ${optType} ${s.sector || ""}`.toUpperCase();
          return terms.every(term => fullText.includes(term));
        });

        resultsOverlay.style.display = "block";
        if (matches.length === 0) {
          resultsOverlay.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">No instruments matching "${query}"</div>`;
          return;
        }

        const activeList = store.watchlists[store.activeWatchlist] || [];
        resultsOverlay.innerHTML = matches.slice(0, 30).map((s) => {
          const isAdded = activeList.includes(s.symbol);
          const isPos = (s.change || 0) >= 0;
          return `
            <div class="search-result-item" onclick="app.openStockSheet('${s.symbol}')">
              <div style="flex:1;min-width:0;padding-right:8px;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="font-bold text-dark" style="font-size:13px;">${s.symbol}</span>
                  <span class="sector-tag ${s.sectorClass || 'tag-tech'}">${s.sector || s.exchange}</span>
                  <span class="exchange-tag">${s.exchange}</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <div style="text-align:right;">
                  <div style="font-weight:700;font-size:13px;">₹${s.price.toFixed(2)}</div>
                  <div style="font-size:10.5px;font-weight:600;" class="${isPos ? 'text-green' : 'text-red'}">${isPos ? '+' : ''}${(s.pChange || 0).toFixed(2)}%</div>
                </div>
                <button class="act-btn btn-buy-pill" style="width:26px;height:26px;font-size:11px;padding:0;" title="Buy" onclick="event.stopPropagation(); app.openOrderModal('${s.symbol}', 'BUY');">B</button>
                <button class="act-btn btn-sell-pill" style="width:26px;height:26px;font-size:11px;padding:0;" title="Sell" onclick="event.stopPropagation(); app.openOrderModal('${s.symbol}', 'SELL');">S</button>
                <button class="btn-secondary" style="padding:4px 8px;font-size:11px;white-space:nowrap;" onclick="event.stopPropagation(); app.toggleWatchlistStock('${s.symbol}')">
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
    if (countBadge) countBadge.textContent = `${symbols.length}/100`;

    // Highlight active subtab
    document.querySelectorAll(".kite-wl-subtabs-bar .kite-subtab-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.getAttribute("data-wl"), 10) === store.activeWatchlist);
    });

    if (symbols.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-muted);font-size:13px;">
          Watchlist ${store.activeWatchlist} is empty.<br>Use search bar above to add instruments.
        </div>
      `;
      return;
    }

    container.innerHTML = symbols.map((sym) => {
      const stock = STOCKS_MAP.get(sym);
      if (!stock) return "";
      const isPositive = stock.change >= 0;

      // Check if user has demat holding in this stock (matching Kite recording briefcase badge 💼 6)
      const holding = (store.holdings || []).find(h => h.symbol === stock.symbol && h.quantity > 0 && h.status === "OPEN");
      const holdingBadgeHtml = holding ? `
        <span class="kite-holding-badge" title="Holding in Demat">
          <span class="kite-holding-badge-icon">💼</span> ${holding.quantity}
        </span>
      ` : "";

      return `
        <li class="stock-row kite-stock-item" id="wl-row-${stock.symbol.replace(/\s+/g, '_')}" onclick="app.selectStock('${stock.symbol}')">
          <div class="kite-stock-left">
            <div class="kite-stock-sym-row">
              <span class="kite-stock-sym">${stock.symbol}</span>
            </div>
            <div class="kite-stock-sub-row">
              <span class="kite-stock-exchange">${stock.exchange || 'NSE'}</span>
              ${holdingBadgeHtml}
            </div>
          </div>

          <div class="kite-stock-right" id="wl-price-${stock.symbol.replace(/\s+/g, '_')}">
            <div class="kite-stock-ltp ${isPositive ? 'text-green' : 'text-red'}">
              ₹${stock.price.toFixed(2)}
            </div>
            <div class="kite-stock-chg ${isPositive ? 'text-green' : 'text-red'}">
              ${isPositive ? '+' : ''}${stock.change.toFixed(2)} (${isPositive ? '+' : ''}${stock.pChange.toFixed(2)}%)
            </div>
          </div>

          <!-- Desktop hover actions -->
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

  // --- Order Modal Logic (Supports Equities, Options, & Zerodha Kite Swipe Slider) ---
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

    // Side switcher buttons (BUY / SELL)
    const sideBtns = document.querySelectorAll(".side-toggle-btn");
    sideBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.getAttribute("data-side");
        this.setOrderSide(side);
      });
    });

    // Exchange selector options (NSE / BSE)
    const exchangeOpts = document.querySelectorAll(".kite-exchange-opt");
    exchangeOpts.forEach((opt) => {
      opt.addEventListener("click", () => {
        exchangeOpts.forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        this.selectedExchange = radio ? radio.value : "NSE";

        // Update price based on exchange selection
        if (this.selectedStock && priceInput) {
          const p = (this.selectedExchange === "BSE")
            ? (this.selectedStock.price + (this.selectedStock.price > 100 ? 0.25 : 0.05))
            : this.selectedStock.price;
          if (this.activeOrderType === "MARKET") {
            priceInput.value = p.toFixed(2);
          }
        }
        this.recalculateOrderMargin();
      });
    });

    // Variety Subtabs (Regular | Cover | AMO | Iceberg)
    const varietyTabs = document.querySelectorAll(".kite-variety-tab");
    varietyTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        varietyTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeOrderVariety = tab.getAttribute("data-variety") || "REGULAR";

        const amoBanner = document.getElementById("amoNoticeBanner");
        if (amoBanner) {
          if (this.activeOrderVariety === "AMO") {
            amoBanner.style.display = "flex";
            const textEl = document.getElementById("amoNoticeText");
            if (textEl) textEl.innerHTML = "Placing <b>AMO (After Market Order)</b> to execute at 09:15 AM on the next market session.";
          } else {
            const marketStatus = (typeof engine !== "undefined" && engine && typeof engine.getMarketStatus === "function")
              ? engine.getMarketStatus()
              : { isOpen: true };
            amoBanner.style.display = marketStatus.isOpen ? "none" : "flex";
          }
        }
      });
    });

    // Quantity Steppers (▲ / ▼)
    const btnQtyUp = document.getElementById("btnQtyUp");
    const btnQtyDown = document.getElementById("btnQtyDown");
    if (btnQtyUp && qtyInput) {
      btnQtyUp.addEventListener("click", () => {
        const isOption = !!(this.selectedStock && this.selectedStock.isOption);
        const step = isOption ? (this.selectedStock.lotSize || 25) : 1;
        const cur = parseInt(qtyInput.value, 10) || 0;
        qtyInput.value = cur + step;
        this.recalculateOrderMargin();
      });
    }
    if (btnQtyDown && qtyInput) {
      btnQtyDown.addEventListener("click", () => {
        const isOption = !!(this.selectedStock && this.selectedStock.isOption);
        const step = isOption ? (this.selectedStock.lotSize || 25) : 1;
        const cur = parseInt(qtyInput.value, 10) || step;
        qtyInput.value = Math.max(step, cur - step);
        this.recalculateOrderMargin();
      });
    }

    // Price Pencil Button (Toggles between Limit & Market)
    const btnTogglePricePencil = document.getElementById("btnTogglePricePencil");
    if (btnTogglePricePencil && priceInput) {
      btnTogglePricePencil.addEventListener("click", () => {
        if (priceInput.disabled) {
          // Switch to LIMIT mode
          priceInput.disabled = false;
          priceInput.focus();
          priceInput.select();
          this.activeOrderType = "LIMIT";
          document.querySelectorAll(".kite-type-pill, .order-type-tab").forEach((t) => {
            t.classList.toggle("active", t.getAttribute("data-type") === "LIMIT");
          });
          const badge = document.getElementById("orderMarketBadge");
          if (badge) badge.textContent = "Limit";
        } else {
          // Switch back to MARKET mode
          priceInput.disabled = true;
          this.activeOrderType = "MARKET";
          if (this.selectedStock) {
            priceInput.value = this.selectedStock.price.toFixed(2);
          }
          document.querySelectorAll(".kite-type-pill, .order-type-tab").forEach((t) => {
            t.classList.toggle("active", t.getAttribute("data-type") === "MARKET");
          });
          const badge = document.getElementById("orderMarketBadge");
          if (badge) badge.textContent = "LTP";
        }
        this.recalculateOrderMargin();
      });
    }

    // Price Steppers (▲ / ▼)
    const btnPriceUp = document.getElementById("btnPriceUp");
    const btnPriceDown = document.getElementById("btnPriceDown");
    if (btnPriceUp && priceInput) {
      btnPriceUp.addEventListener("click", () => {
        priceInput.disabled = false;
        this.activeOrderType = "LIMIT";
        document.querySelectorAll(".kite-type-pill, .order-type-tab").forEach((t) => {
          t.classList.toggle("active", t.getAttribute("data-type") === "LIMIT");
        });
        const badge = document.getElementById("orderMarketBadge");
        if (badge) badge.textContent = "Limit";
        const cur = parseFloat(priceInput.value) || (this.selectedStock ? this.selectedStock.price : 100);
        priceInput.value = (cur + 0.05).toFixed(2);
        this.recalculateOrderMargin();
      });
    }
    if (btnPriceDown && priceInput) {
      btnPriceDown.addEventListener("click", () => {
        priceInput.disabled = false;
        this.activeOrderType = "LIMIT";
        document.querySelectorAll(".kite-type-pill, .order-type-tab").forEach((t) => {
          t.classList.toggle("active", t.getAttribute("data-type") === "LIMIT");
        });
        const badge = document.getElementById("orderMarketBadge");
        if (badge) badge.textContent = "Limit";
        const cur = parseFloat(priceInput.value) || (this.selectedStock ? this.selectedStock.price : 100);
        priceInput.value = Math.max(0.05, cur - 0.05).toFixed(2);
        this.recalculateOrderMargin();
      });
    }

    // Product Selection Radios (MIS vs CNC)
    const productLabels = document.querySelectorAll(".product-radio-label");
    productLabels.forEach((label) => {
      label.addEventListener("click", () => {
        productLabels.forEach((l) => l.classList.remove("selected"));
        label.classList.add("selected");
        const radio = label.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        this.activeProduct = label.getAttribute("data-product") || "CNC";
        this.recalculateOrderMargin();
      });
    });

    // Order Type Segmented Pills (Market | Limit | SL | SL-M)
    const typeTabs = document.querySelectorAll(".order-type-tab, .kite-type-pill");
    typeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        typeTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeOrderType = tab.getAttribute("data-type") || "MARKET";

        const badge = document.getElementById("orderMarketBadge");
        if (priceInput) {
          if (this.activeOrderType === "MARKET") {
            priceInput.disabled = true;
            if (this.selectedStock) priceInput.value = this.selectedStock.price.toFixed(2);
            if (badge) badge.textContent = "LTP";
          } else {
            priceInput.disabled = false;
            if (badge) badge.textContent = "Limit";
          }
        }
        this.recalculateOrderMargin();
      });
    });

    // Margin Refresh Circular Button
    const refreshMarginBtn = document.getElementById("orderRefreshMarginBtn");
    if (refreshMarginBtn) {
      refreshMarginBtn.addEventListener("click", () => {
        refreshMarginBtn.classList.add("spinning");
        setTimeout(() => refreshMarginBtn.classList.remove("spinning"), 600);
        if (this.selectedStock && this.activeOrderType === "MARKET" && priceInput) {
          priceInput.value = this.selectedStock.price.toFixed(2);
        }
        this.recalculateOrderMargin();
      });
    }

    // Advanced Details Accordion Toggle
    const btnToggleAdvanced = document.getElementById("btnToggleAdvanced");
    const advancedContent = document.getElementById("kiteAdvancedContent");
    if (btnToggleAdvanced && advancedContent) {
      btnToggleAdvanced.addEventListener("click", () => {
        const isHidden = advancedContent.style.display === "none";
        advancedContent.style.display = isHidden ? "flex" : "none";
      });
    }

    if (qtyInput) qtyInput.addEventListener("input", () => this.recalculateOrderMargin());
    if (priceInput) priceInput.addEventListener("input", () => this.recalculateOrderMargin());
    if (submitBtn) submitBtn.addEventListener("click", () => this.handleOrderSubmit());

    // Initialize the Swipe Slider
    this.setupOrderSwipeSlider();
  }

  // Authentic Zerodha Swipe Slider (Supports Touch Drag, Mouse Drag, & Click Fallback)
  setupOrderSwipeSlider() {
    const track = document.getElementById("orderSwipeTrack");
    const thumb = document.getElementById("orderSwipeThumb");
    const text = document.getElementById("orderSwipeText");
    if (!track || !thumb || !text) return;

    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let maxDrag = 0;

    const calcMaxDrag = () => Math.max(10, track.clientWidth - thumb.clientWidth - 8);

    const startDrag = (clientX) => {
      isDragging = true;
      startX = clientX;
      currentX = 0;
      maxDrag = calcMaxDrag();
      thumb.classList.add("dragging");
    };

    const moveDrag = (clientX) => {
      if (!isDragging) return;
      const diff = clientX - startX;
      currentX = Math.max(0, Math.min(diff, maxDrag));
      thumb.style.transform = `translateX(${currentX}px)`;
      const progress = currentX / maxDrag;
      text.style.opacity = Math.max(0, 1 - progress * 1.6).toString();
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      thumb.classList.remove("dragging");

      if (currentX >= maxDrag * 0.50) {
        // Successfully swiped past threshold
        thumb.style.transform = `translateX(${maxDrag}px)`;
        text.style.opacity = "0";
        setTimeout(() => {
          this.handleOrderSubmit();
          setTimeout(() => this.resetSwipeSlider(), 400);
        }, 120);
      } else {
        // Snap back to start smoothly
        thumb.style.transform = "translateX(0px)";
        text.style.opacity = "1";
      }
      currentX = 0;
    };

    // Mobile touch events
    track.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) {
        startDrag(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (isDragging && e.touches && e.touches[0]) {
        moveDrag(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      if (isDragging) endDrag();
    });

    // Desktop mouse events
    thumb.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startDrag(e.clientX);
    });

    window.addEventListener("mousemove", (e) => {
      if (isDragging) moveDrag(e.clientX);
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) endDrag();
    });

    // Instant click / tap trigger fallback
    track.addEventListener("click", () => {
      if (currentX > 6) return; // ignore if was an intentional drag
      maxDrag = calcMaxDrag();
      thumb.style.transform = `translateX(${maxDrag}px)`;
      text.style.opacity = "0";
      setTimeout(() => {
        this.handleOrderSubmit();
        setTimeout(() => this.resetSwipeSlider(), 400);
      }, 160);
    });
  }

  resetSwipeSlider() {
    const thumb = document.getElementById("orderSwipeThumb");
    const text = document.getElementById("orderSwipeText");
    if (thumb) {
      thumb.classList.remove("dragging");
      thumb.style.transform = "translateX(0px)";
    }
    if (text) {
      text.style.opacity = "1";
    }
  }

  openOrderModal(symbol, side = "BUY") {
    const stock = STOCKS_MAP.get(symbol);
    if (!stock) return;
    this.selectedStock = stock;
    this.activeOrderSide = side;
    this.activeOrderVariety = "REGULAR";
    this.selectedExchange = "NSE";

    const modal = document.getElementById("orderModalBackdrop");
    const symbolEl = document.getElementById("modalStockSymbol");
    const subtagEl = document.getElementById("modalStockSubtag");
    const ltpNseEl = document.getElementById("orderLtpNSE");
    const ltpBseEl = document.getElementById("orderLtpBSE");
    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");
    const lotHint = document.getElementById("orderLotSizeHint");
    const productCNCLabel = document.getElementById("productCNCLabel");
    const marginNeededText = document.getElementById("marginNeededText");

    const isOption = !!stock.isOption;
    const defaultQty = isOption ? (stock.lotSize || 25) : 1;

    // Reset variety tabs
    document.querySelectorAll(".kite-variety-tab").forEach((t) => {
      t.classList.toggle("active", t.getAttribute("data-variety") === "REGULAR");
    });

    // Reset order types to Market
    this.activeOrderType = "MARKET";
    document.querySelectorAll(".kite-type-pill, .order-type-tab").forEach((t) => {
      t.classList.toggle("active", t.getAttribute("data-type") === "MARKET");
    });
    if (priceInput) priceInput.disabled = true;
    const badge = document.getElementById("orderMarketBadge");
    if (badge) badge.textContent = "LTP";

    // Symbol and Subtag
    if (symbolEl) {
      symbolEl.textContent = stock.symbol;
    }
    if (subtagEl) {
      if (isOption) {
        subtagEl.style.display = "inline-block";
        subtagEl.textContent = stock.optionType;
        subtagEl.className = `kite-order-subtag badge-tag ${stock.optionType === "CE" ? "badge-ce" : "badge-pe"}`;
      } else {
        subtagEl.style.display = "none";
      }
    }

    // Exchange bar prices (NSE & realistic BSE)
    const nsePrice = stock.price;
    const bsePrice = stock.price + (stock.price > 100 ? 0.25 : 0.05);
    if (ltpNseEl) ltpNseEl.textContent = `₹${nsePrice.toFixed(2)}`;
    if (ltpBseEl) ltpBseEl.textContent = `₹${bsePrice.toFixed(2)}`;

    // Reset exchange radio to NSE
    const nseRadio = document.querySelector('input[name="orderExchange"][value="NSE"]');
    if (nseRadio) nseRadio.checked = true;
    document.querySelectorAll(".kite-exchange-opt").forEach((o) => {
      o.classList.toggle("active", o.id === "exchangeOptNSE");
    });

    if (qtyInput) {
      qtyInput.value = defaultQty;
      qtyInput.step = isOption ? (stock.lotSize || 25) : 1;
      qtyInput.min = isOption ? (stock.lotSize || 25) : 1;
    }

    if (lotHint) {
      if (isOption) {
        lotHint.style.display = "inline-block";
        lotHint.textContent = `Lot size ${stock.lotSize}`;
      } else {
        lotHint.style.display = "none";
      }
    }

    if (productCNCLabel) {
      productCNCLabel.innerHTML = isOption
        ? `Overnight <span class="kite-subtext">NRML</span>`
        : `Longterm <span class="kite-subtext">CNC</span>`;
    }

    if (marginNeededText) {
      marginNeededText.textContent = isOption ? "Premium" : "Amount";
    }

    if (priceInput) priceInput.value = nsePrice.toFixed(2);

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
    } else {
      this.activeProduct = "CNC";
      document.querySelectorAll(".product-radio-label").forEach((l) => {
        l.classList.toggle("selected", l.getAttribute("data-product") === "CNC");
      });
    }

    // Check market status
    const marketStatus = (typeof engine !== "undefined" && engine && typeof engine.getMarketStatus === "function")
      ? engine.getMarketStatus()
      : { isOpen: true };
    const amoBanner = document.getElementById("amoNoticeBanner");
    if (amoBanner) {
      if (marketStatus.isOpen) {
        amoBanner.style.display = "none";
      } else {
        amoBanner.style.display = "flex";
        const textEl = document.getElementById("amoNoticeText");
        if (textEl) {
          textEl.innerHTML = `Market is closed (${marketStatus.dayName || 'Weekend'}). Placing <b>AMO (After Market Order)</b> to execute at 09:15 AM.`;
        }
      }
    }

    this.resetSwipeSlider();
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
    const modalCard = document.getElementById("orderModalCard");
    const submitBtn = document.getElementById("submitOrderBtn");
    const swipeText = document.getElementById("orderSwipeText");
    const btnBuy = document.getElementById("btnSideBuy");
    const btnSell = document.getElementById("btnSideSell");

    if (modalCard) {
      modalCard.classList.toggle("buy-theme", side === "BUY");
      modalCard.classList.toggle("sell-theme", side === "SELL");
    }

    if (btnBuy) btnBuy.classList.toggle("active", side === "BUY");
    if (btnSell) btnSell.classList.toggle("active", side === "SELL");

    if (swipeText) {
      swipeText.textContent = side === "BUY" ? "SWIPE TO BUY" : "SWIPE TO SELL";
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
    const chargesEl = document.getElementById("orderChargesVal");
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

    if (chargesEl) {
      let charges = 0.97;
      if (isOption) {
        charges = 20.00 + (marginReq * 0.0006);
      } else if (this.activeProduct === "MIS") {
        charges = Math.min(20, marginReq * 0.0003) + 1.25;
      } else {
        charges = Math.max(0.97, marginReq * 0.00015);
      }
      chargesEl.textContent = `Charges ₹${charges.toFixed(2)}`;
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
    if (!this.selectedStock) return;

    const qtyInput = document.getElementById("orderQtyInput");
    const priceInput = document.getElementById("orderPriceInput");

    const quantity = parseInt(qtyInput?.value, 10);
    const price = parseFloat(priceInput?.value) || this.selectedStock.price;

    const result = store.placeOrder({
      symbol: this.selectedStock.symbol,
      product: this.activeProduct,
      orderType: this.activeOrderType,
      side: this.activeOrderSide,
      quantity,
      price
    });

    if (result.success) {
      if (typeof window.playChime === "function") window.playChime();
      if (typeof window.showToast === "function") window.showToast(result.message, "success");
      this.closeOrderModal();
      this.renderUserQuickFunds();

      // On mobile screen, automatically navigate to Positions tab (all today's trades are in Positions!)
      if (window.innerWidth <= 768) {
        this.switchMobileTab("portfolio");
        this.switchView("positions");
      }
      this.renderActiveView();
    } else {
      if (typeof sounds !== "undefined" && sounds.playError) sounds.playError();
      if (typeof window.showToast === "function") window.showToast(result.message, "error");
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

  // Helper to format Kite symbol with optional weekly 'W' badge (Zerodha Kite Reference)
  formatKiteSymbol(symbol, isOption = false, underlying = null) {
    if (!isOption && !symbol.includes(" CE") && !symbol.includes(" PE")) {
      return `<span>${symbol}</span>`;
    }
    const isCE = symbol.includes(" CE");
    const isPE = symbol.includes(" PE");
    if (!isCE && !isPE) return `<span>${symbol}</span>`;

    // Match patterns like "SENSEX 12th NOV 78300 PE"
    const match = symbol.match(/^([A-Z0-9\s]+?)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3})\s+(\d+)\s+(CE|PE)$/i);
    if (match) {
      const idx = match[1];
      const expiry = match[2];
      const strike = match[3];
      const type = match[4];
      return `<span>${idx} ${expiry} <span class="kite-w-tag">W</span> ${strike} ${type}</span>`;
    }

    const parts = symbol.split(/\s+/);
    const type = parts[parts.length - 1];
    const strike = parts[parts.length - 2];
    const underlyingName = parts.slice(0, parts.length - 2).join(" ");
    return `<span>${underlyingName} 12th <span class="kite-w-tag">W</span> NOV ${strike} ${type}</span>`;
  }

  // 2. Holdings View
  renderHoldings() {
    const listEl = document.getElementById("holdingsKiteList");
    const emptyState = document.getElementById("holdingsEmptyState");
    const pnlCardVal = document.getElementById("holdingsPnlCardVal");
    const pnlCardSub = document.getElementById("holdingsPnlCardSub");
    const cardInvested = document.getElementById("holdingsCardInvested");
    const cardCurrent = document.getElementById("holdingsCardCurrent");

    // Also update legacy desktop elements if present
    const tbody = document.getElementById("holdingsTableBody");
    const totalInvestedEl = document.getElementById("holdingsTotalInvested");
    const curValEl = document.getElementById("holdingsCurrentVal");
    const totalPLEl = document.getElementById("holdingsTotalPL");
    const dayPLEl = document.getElementById("holdingsDayPL");

    if (store.holdings.length === 0) {
      if (listEl) listEl.innerHTML = "";
      if (tbody) tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (pnlCardVal) {
        pnlCardVal.className = "kite-pnl-card-val";
        pnlCardVal.textContent = "+0.00";
      }
      if (cardInvested) cardInvested.textContent = "0.00";
      if (cardCurrent) cardCurrent.textContent = "0.00";
      const cardPctEl = document.getElementById("holdingsPnlCardPct");
      if (cardPctEl) cardPctEl.textContent = "";
      const dayPnlValEl = document.getElementById("holdingsDayPnlVal");
      if (dayPnlValEl) {
        dayPnlValEl.className = "kite-sd-val text-green";
        dayPnlValEl.textContent = "+0.00 (+0.00%)";
      }
      const bH1 = document.getElementById("portHoldingsTabBadge");
      const bH2 = document.getElementById("portHoldingsTabBadge2");
      if (bH1) bH1.style.display = "none";
      if (bH2) bH2.style.display = "none";
      if (pnlCardSub) pnlCardSub.style.display = "none";
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

    let itemsToRender = [...store.holdings];
    if (this.portHoldingsFilter === "open") {
      itemsToRender = itemsToRender.filter(h => h.quantity > 0 && h.status === "OPEN");
    } else if (this.portHoldingsFilter === "closed") {
      itemsToRender = itemsToRender.filter(h => h.quantity === 0 || h.status === "CLOSED");
    }

    if (this.portHoldingsSearchQuery) {
      const q = this.portHoldingsSearchQuery.toLowerCase();
      itemsToRender = itemsToRender.filter(h => (h.symbol && h.symbol.toLowerCase().includes(q)) || (h.name && h.name.toLowerCase().includes(q)));
    }

    if (this.portSortDirection) {
      itemsToRender.sort((a, b) => {
        const getPl = (item) => {
          const s = STOCKS_MAP.get(item.symbol);
          const isC = item.quantity === 0 || item.status === "CLOSED";
          if (isC) return item.realizedPL || 0;
          const l = s ? s.price : item.avgPrice;
          return (item.quantity * l) - item.investedValue;
        };
        return this.portSortDirection === "desc" ? getPl(b) - getPl(a) : getPl(a) - getPl(b);
      });
    }

    const kiteItemsHtml = itemsToRender.map(h => {
      const stock = STOCKS_MAP.get(h.symbol);
      const isClosed = h.quantity === 0 || h.status === "CLOSED";
      const ltp = stock ? stock.price : (h.exitPrice || h.avgPrice);
      const curVal = isClosed ? 0 : (h.quantity * ltp);
      const pl = isClosed ? (h.realizedPL || 0) : (curVal - h.investedValue);
      const isPositive = pl >= 0;

      const dayChange = (!isClosed && stock) ? stock.change * h.quantity : 0;

      if (!isClosed) {
        totalInvested += h.investedValue;
        totalCurrent += curVal;
        totalDayPL += dayChange;
      } else {
        totalRealizedGain += (h.realizedPL || 0);
      }

      return `
        <div class="kite-pos-item ${isClosed ? 'kite-item-closed' : ''}" onclick="app.openHoldingSheet('${h.symbol}')">
          <div class="kite-item-row kite-row-top">
            <div class="kite-qty-avg">
              <span>Qty. <b class="${isClosed ? 'val-muted' : 'val-dark'}">${isClosed ? '0' : h.quantity}</b></span>
              <span class="kite-sep"></span>
              <span>Avg. <b class="${isClosed ? 'val-muted' : 'val-dark'}">${isClosed ? '0.00' : h.avgPrice.toFixed(2)}</b></span>
            </div>
            <span class="kite-prod-badge badge-cnc">CNC</span>
          </div>
          <div class="kite-item-row kite-row-mid">
            <div class="kite-symbol-name">
              <span>${h.symbol}</span>
            </div>
            <div class="kite-pnl-val ${isPositive ? 'text-green' : 'text-red'}">
              ${isPositive ? '+' : ''}${pl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="kite-item-row kite-row-bottom">
            <div class="kite-exchange">${h.exchange || 'NSE'}</div>
            <div class="kite-ltp">LTP <b>${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          </div>
        </div>
      `;
    }).join("");

    if (listEl) listEl.innerHTML = kiteItemsHtml;

    const totalPL = (totalCurrent - totalInvested) + totalRealizedGain;
    const isTotalPositive = totalPL >= 0;
    const pnlPct = totalInvested > 0 ? (totalPL / totalInvested * 100) : 0;

    const cardPctEl = document.getElementById("holdingsPnlCardPct");
    const dayPnlValEl = document.getElementById("holdingsDayPnlVal");
    const badgeHoldings = document.getElementById("portHoldingsTabBadge");
    const badgeHoldings2 = document.getElementById("portHoldingsTabBadge2");

    const openCount = (store.holdings || []).filter(h => h.quantity > 0 && h.status === "OPEN").length;
    if (badgeHoldings) {
      badgeHoldings.textContent = openCount;
      badgeHoldings.style.display = openCount ? "inline-block" : "none";
    }
    if (badgeHoldings2) {
      badgeHoldings2.textContent = openCount;
      badgeHoldings2.style.display = openCount ? "inline-block" : "none";
    }

    if (cardInvested) cardInvested.textContent = this.privacyMode ? "••••••" : totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (cardCurrent) cardCurrent.textContent = this.privacyMode ? "••••••" : totalCurrent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (pnlCardVal) {
      pnlCardVal.className = `kite-hcard-pnl-val ${isTotalPositive ? 'text-green' : 'text-red'}`;
      pnlCardVal.textContent = this.privacyMode ? "••••••" : `${isTotalPositive ? '+' : ''}${totalPL.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (cardPctEl) {
      cardPctEl.className = `kite-hcard-pnl-pct ${isTotalPositive ? 'text-green' : 'text-red'}`;
      cardPctEl.textContent = this.privacyMode ? "••••" : `[${isTotalPositive ? '+' : ''}${pnlPct.toFixed(2)}%]`;
    }
    if (dayPnlValEl) {
      const isDayPositive = totalDayPL >= 0;
      dayPnlValEl.className = `kite-sd-val ${isDayPositive ? 'text-green' : 'text-red'}`;
      const dayPct = totalCurrent > 0 ? (totalDayPL / totalCurrent * 100) : 0;
      dayPnlValEl.textContent = this.privacyMode ? "••••••" : `${isDayPositive ? '+' : ''}${totalDayPL.toFixed(2)} (${isDayPositive ? '+' : ''}${dayPct.toFixed(2)}%)`;
    }

    if (pnlCardSub && totalInvested > 0) {
      pnlCardSub.style.display = "flex";
    } else if (pnlCardSub) {
      pnlCardSub.style.display = "none";
    }

    if (totalInvestedEl) totalInvestedEl.textContent = `₹${totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (curValEl) curValEl.textContent = `₹${totalCurrent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (totalPLEl) {
      totalPLEl.className = `kpi-val ${isTotalPositive ? 'text-green' : 'text-red'}`;
      totalPLEl.textContent = `${isTotalPositive ? '+' : ''}₹${totalPL.toFixed(2)}`;
    }
  }

  updateHoldingsLiveData() {
    this.renderHoldings();
  }

  // 3. Positions View (Intraday MIS & F&O Options - Exact Match to Zerodha Kite Screenshot)
  renderPositions() {
    const listEl = document.getElementById("positionsKiteList");
    const emptyState = document.getElementById("positionsEmptyState");
    const pnlCardVal = document.getElementById("positionsPnlCardVal");
    const mtmKpi = document.getElementById("positionsTotalMTM");

    const todayPositions = store.positions;

    if (todayPositions.length === 0) {
      if (listEl) listEl.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (pnlCardVal) {
        pnlCardVal.className = "kite-pnl-card-val";
        pnlCardVal.textContent = "+0.00";
      }
      const bP1 = document.getElementById("portPositionsTabBadge");
      const bP2 = document.getElementById("portPositionsTabBadge2");
      if (bP1) bP1.style.display = "none";
      if (bP2) bP2.style.display = "none";
      if (mtmKpi) {
        mtmKpi.className = "kpi-val";
        mtmKpi.textContent = "₹0.00";
      }
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let totalMTM = 0;
    let totalRealized = 0;

    let itemsToRender = [...todayPositions];
    if (this.portPositionsFilter === "open") {
      itemsToRender = itemsToRender.filter(p => p.quantity !== 0 && p.status === "OPEN");
    } else if (this.portPositionsFilter === "closed") {
      itemsToRender = itemsToRender.filter(p => p.quantity === 0 || p.status === "CLOSED");
    }

    if (this.portPositionsSearchQuery) {
      const q = this.portPositionsSearchQuery.toLowerCase();
      itemsToRender = itemsToRender.filter(p => (p.symbol && p.symbol.toLowerCase().includes(q)) || (p.name && p.name.toLowerCase().includes(q)));
    }

    if (this.portSortDirection) {
      itemsToRender.sort((a, b) => {
        const getPl = (item) => {
          const s = STOCKS_MAP.get(item.symbol);
          const isC = item.status === "CLOSED" || item.quantity === 0;
          if (isC) return item.realizedPL || 0;
          const l = s ? s.price : (item.exitPrice || item.avgPrice);
          const isL = item.quantity > 0;
          return (isL ? (l - item.avgPrice) : (item.avgPrice - l)) * Math.abs(item.quantity);
        };
        return this.portSortDirection === "desc" ? getPl(b) - getPl(a) : getPl(a) - getPl(b);
      });
    }

    const itemsHtml = itemsToRender.map((pos) => {
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

      const productTag = pos.isOption ? (pos.optionType === "CE" ? "badge-ce" : "badge-pe") : (pos.product === "CNC" ? "badge-cnc" : "badge-mis");
      const productLabel = pos.isOption ? "NRML" : (pos.product || "NRML");

      return `
        <div class="kite-pos-item ${isClosed ? 'kite-item-closed' : ''}" onclick="app.openPositionSheet('${pos.id}')">
          <div class="kite-item-row kite-row-top">
            <div class="kite-qty-avg">
              <span>Qty. <b class="${isClosed ? 'val-muted' : 'val-dark'}">${isClosed ? '0' : Math.abs(pos.quantity)}</b></span>
              <span class="kite-sep"></span>
              <span>Avg. <b class="${isClosed ? 'val-muted' : 'val-dark'}">${isClosed ? '0.00' : pos.avgPrice.toFixed(2)}</b></span>
            </div>
            <span class="kite-prod-badge ${productTag}">${productLabel}</span>
          </div>
          <div class="kite-item-row kite-row-mid">
            <div class="kite-symbol-name">
              ${this.formatKiteSymbol(pos.symbol, pos.isOption, pos.underlying)}
            </div>
            <div class="kite-pnl-val ${isProfitable ? 'text-green' : 'text-red'}">
              ${isProfitable ? '+' : ''}${pnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div class="kite-item-row kite-row-bottom">
            <div class="kite-exchange">${exchange}</div>
            <div class="kite-ltp">LTP <b>${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          </div>
        </div>
      `;
    }).join("");

    if (listEl) listEl.innerHTML = itemsHtml;

    const totalNetPositionsPL = totalMTM + totalRealized;
    const isTotalProfitable = totalNetPositionsPL >= 0;

    const badgePos = document.getElementById("portPositionsTabBadge");
    const badgePos2 = document.getElementById("portPositionsTabBadge2");
    const openPosCount = (store.positions || []).filter(p => p.quantity !== 0 && p.status === "OPEN").length || store.positions.length;
    if (badgePos) {
      badgePos.textContent = openPosCount;
      badgePos.style.display = openPosCount ? "inline-block" : "none";
    }
    if (badgePos2) {
      badgePos2.textContent = openPosCount;
      badgePos2.style.display = openPosCount ? "inline-block" : "none";
    }

    if (pnlCardVal) {
      pnlCardVal.className = `kite-pnl-card-val ${isTotalProfitable ? 'text-green' : 'text-red'}`;
      pnlCardVal.textContent = this.privacyMode ? "••••••" : `${isTotalProfitable ? '+' : ''}${totalNetPositionsPL.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (mtmKpi) {
      mtmKpi.className = `kpi-val ${isTotalProfitable ? 'text-green' : 'text-red'}`;
      mtmKpi.textContent = `${isTotalProfitable ? '+' : ''}₹${totalNetPositionsPL.toFixed(2)}`;
    }
  }

  updatePositionsLiveData() {
    this.renderPositions();
  }

  // --- Zerodha Kite Action Sheet & Toolbar Handlers ---
  openPositionSheet(posId) {
    const pos = store.positions.find(p => p.id === posId);
    if (!pos) return;
    this.activeSheetItem = { type: "position", data: pos };

    const stock = STOCKS_MAP.get(pos.symbol);
    const ltp = stock ? stock.price : (pos.exitPrice || pos.avgPrice);
    const isClosed = pos.status === "CLOSED" || pos.quantity === 0;
    const isLong = pos.quantity > 0;
    const pnl = isClosed ? (pos.realizedPL || 0) : ((isLong ? (ltp - pos.avgPrice) : (pos.avgPrice - ltp)) * Math.abs(pos.quantity));

    const symEl = document.getElementById("kiteSheetSymbol");
    const subEl = document.getElementById("kiteSheetSub");
    const ltpEl = document.getElementById("kiteSheetLtp");
    const pnlEl = document.getElementById("kiteSheetPnl");
    const exitBtn = document.getElementById("kiteSheetBtnExit");

    if (symEl) symEl.textContent = pos.symbol;
    if (subEl) {
      const ex = pos.isOption ? (pos.underlying === "SENSEX" ? "BFO" : "NFO") : (stock?.exchange || "NSE");
      subEl.textContent = `${ex} • ${pos.product || "NRML"} • Net Qty: ${isClosed ? 0 : pos.quantity}`;
    }
    if (ltpEl) ltpEl.textContent = `₹${ltp.toFixed(2)}`;
    if (pnlEl) {
      pnlEl.className = `kite-sheet-pnl ${pnl >= 0 ? 'text-green' : 'text-red'}`;
      pnlEl.textContent = `${pnl >= 0 ? '+' : ''}₹${pnl.toFixed(2)} ${isClosed ? '(Realized)' : ''}`;
    }
    if (exitBtn) {
      exitBtn.style.display = isClosed ? "none" : "flex";
      exitBtn.textContent = "🔴 Exit Position";
    }

    const backdrop = document.getElementById("kiteItemSheetBackdrop");
    if (backdrop) backdrop.style.display = "flex";
  }

  openHoldingSheet(symbol) {
    const h = store.holdings.find(item => item.symbol === symbol);
    if (!h) return;
    this.activeSheetItem = { type: "holding", data: h };

    const stock = STOCKS_MAP.get(symbol);
    const ltp = stock ? stock.price : (h.exitPrice || h.avgPrice);
    const isClosed = h.quantity === 0 || h.status === "CLOSED";
    const curVal = isClosed ? 0 : (h.quantity * ltp);
    const pl = isClosed ? (h.realizedPL || 0) : (curVal - h.investedValue);

    const symEl = document.getElementById("kiteSheetSymbol");
    const subEl = document.getElementById("kiteSheetSub");
    const ltpEl = document.getElementById("kiteSheetLtp");
    const pnlEl = document.getElementById("kiteSheetPnl");
    const exitBtn = document.getElementById("kiteSheetBtnExit");

    if (symEl) symEl.textContent = h.symbol;
    if (subEl) subEl.textContent = `${h.exchange || "NSE"} • CNC • Qty: ${isClosed ? 0 : h.quantity}`;
    if (ltpEl) ltpEl.textContent = `₹${ltp.toFixed(2)}`;
    if (pnlEl) {
      pnlEl.className = `kite-sheet-pnl ${pl >= 0 ? 'text-green' : 'text-red'}`;
      pnlEl.textContent = `${pl >= 0 ? '+' : ''}₹${pl.toFixed(2)} ${isClosed ? '(Realized)' : ''}`;
    }
    if (exitBtn) {
      exitBtn.style.display = isClosed ? "none" : "flex";
      exitBtn.textContent = "🔴 Exit / Sell Holding";
    }

    const backdrop = document.getElementById("kiteItemSheetBackdrop");
    if (backdrop) backdrop.style.display = "flex";
  }

  closeItemSheet() {
    const backdrop = document.getElementById("kiteItemSheetBackdrop");
    if (backdrop) backdrop.style.display = "none";
    this.activeSheetItem = null;
  }

  actionSheetExit() {
    if (!this.activeSheetItem) return;
    const { type, data } = this.activeSheetItem;
    this.closeItemSheet();

    if (type === "position") {
      this.exitPosition(data.id);
    } else if (type === "holding") {
      this.openOrderModal(data.symbol, "SELL");
    }
  }

  actionSheetAdd() {
    if (!this.activeSheetItem) return;
    const sym = this.activeSheetItem.data.symbol;
    this.closeItemSheet();
    this.openOrderModal(sym, "BUY");
  }

  actionSheetChart() {
    if (!this.activeSheetItem) return;
    const sym = this.activeSheetItem.data.symbol;
    this.closeItemSheet();
    this.selectStock(sym);
    if (window.innerWidth <= 768) {
      this.switchMobileTab("watchlist");
    }
  }

  actionSheetDepth() {
    if (!this.activeSheetItem) return;
    const sym = this.activeSheetItem.data.symbol;
    this.closeItemSheet();
    this.openDepthModal(sym);
  }

  openFabChart() {
    const sym = (this.selectedStock && this.selectedStock.symbol) ? this.selectedStock.symbol : "NIFTY 50";
    this.selectStock(sym);
    if (window.innerWidth <= 768) {
      this.switchMobileTab("watchlist");
    }
  }

  togglePortSearch(view) {
    const expandEl = document.getElementById(`${view}SearchExpand`);
    const inputEl = document.getElementById(`${view}SearchInput`);
    if (expandEl) {
      const isVisible = expandEl.style.display === "block";
      expandEl.style.display = isVisible ? "none" : "block";
      if (!isVisible && inputEl) inputEl.focus();
    }
  }

  filterPortHoldings(val) {
    this.portHoldingsSearchQuery = val;
    this.renderHoldings();
  }

  filterPortPositions(val) {
    this.portPositionsSearchQuery = val;
    this.renderPositions();
  }

  togglePortFilter(view) {
    const prop = view === "holdings" ? "portHoldingsFilter" : "portPositionsFilter";
    const current = this[prop] || "all";
    const next = current === "all" ? "open" : (current === "open" ? "closed" : "all");
    this[prop] = next;
    window.showToast(`Showing: ${next.toUpperCase()} items`, "info");
    if (view === "holdings") this.renderHoldings();
    else this.renderPositions();
  }

  togglePortGrouping(view) {
    window.showToast("Grouping toggled", "info");
  }

  sortPortItems(view) {
    this.portSortDirection = this.portSortDirection === "desc" ? "asc" : "desc";
    window.showToast(`Sorted by P&L (${this.portSortDirection.toUpperCase()})`, "info");
    if (view === "holdings") this.renderHoldings();
    else this.renderPositions();
  }

  exitPosition(positionId) {
    const res = store.exitPosition(positionId);
    if (res.success) {
      window.playChime();
      window.showToast("Position squared off successfully!", "success");
      this.renderUserQuickFunds();
      this.renderPositions();
    } else {
      sounds.playError();
      window.showToast(res.message, "error");
    }
  }

  exitAllPositions() {
    const res = store.exitAllPositions();
    if (!res.success) {
      sounds.playError();
      window.showToast(res.message, "error");
      return;
    }
    const count = res.count || 0;
    if (count > 0) {
      window.playChime();
      window.showToast(`Squared off all ${count} open positions!`, "success");
      this.renderUserQuickFunds();
      this.renderPositions();
    } else {
      window.showToast("No open positions to square off.", "info");
    }
  }

  simulateNextDay() {
    const res = store.simulateNextTradingDay();
    if (res && res.success) {
      window.playChime();
      window.showToast(
        res.movedCount > 0
          ? `T+1 Settled: ${res.movedCount} open CNC position(s) graduated to Holdings (held > 1 day)!`
          : `Advanced session to ${res.nextDate}. Ready for new trading day.`,
        "success"
      );
      this.renderUserQuickFunds();
      this.renderHoldings();
      this.renderPositions();
      this.renderOrders();
      this.updateNavbarBadges();
    }
  }

  // 4. Orders View (Zerodha Kite Mobile Subtabs & Empty States)
  renderOrders() {
    const listEl = document.getElementById("kiteOrdersList");
    const emptyEl = document.getElementById("kiteOrdersEmpty");
    const emptyTitleEl = document.getElementById("ordersEmptyTitle");
    const openBadge = document.getElementById("orderOpenTabBadge");
    const execBadge = document.getElementById("orderExecutedTabBadge");
    const mobBadgeOrders = document.getElementById("mobBadgeOrders");
    const tbody = document.getElementById("ordersTableBody");
    const emptyState = document.getElementById("ordersEmptyState");

    const subtab = this.activeOrderSubtab || "open";

    // Subtab highlight
    document.querySelectorAll(".kite-orders-subtabs .kite-subtab-btn").forEach(btn => {
      btn.classList.remove("active");
    });
    const subtabKey = subtab.charAt(0).toUpperCase() + subtab.slice(1);
    const activeSubtabBtn = document.getElementById(`orderTab${subtabKey}`);
    if (activeSubtabBtn) activeSubtabBtn.classList.add("active");

    const openOrders = (store.orders || []).filter(o => o.status === "OPEN" || o.status === "AMO PENDING");
    const executedOrders = (store.orders || []).filter(o => o.status === "COMPLETE" || o.status === "CANCELLED" || o.status === "REJECTED");

    if (openBadge) {
      openBadge.textContent = openOrders.length;
      openBadge.style.display = openOrders.length ? "inline-block" : "none";
    }
    if (execBadge) {
      execBadge.textContent = executedOrders.length;
      execBadge.style.display = executedOrders.length ? "inline-block" : "none";
    }
    if (mobBadgeOrders) {
      mobBadgeOrders.textContent = openOrders.length;
      mobBadgeOrders.style.display = openOrders.length ? "inline-block" : "none";
    }

    let itemsToDisplay = [];
    if (subtab === "open") {
      itemsToDisplay = openOrders;
      if (emptyTitleEl) emptyTitleEl.textContent = "No pending orders";
    } else if (subtab === "executed") {
      itemsToDisplay = executedOrders;
      if (emptyTitleEl) emptyTitleEl.textContent = "No executed orders";
    } else if (subtab === "gtt") {
      itemsToDisplay = [];
      if (emptyTitleEl) emptyTitleEl.textContent = "No active GTT triggers";
    } else if (subtab === "baskets") {
      itemsToDisplay = [];
      if (emptyTitleEl) emptyTitleEl.textContent = "No baskets created";
    } else if (subtab === "sips") {
      itemsToDisplay = [];
      if (emptyTitleEl) emptyTitleEl.textContent = "No SIPs scheduled";
    }

    if (this.ordersSearchQuery) {
      const q = this.ordersSearchQuery.toLowerCase();
      itemsToDisplay = itemsToDisplay.filter(o => o.symbol.toLowerCase().includes(q) || (o.name && o.name.toLowerCase().includes(q)));
    }

    if (itemsToDisplay.length === 0) {
      if (listEl) listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "flex";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      if (listEl) {
        listEl.innerHTML = itemsToDisplay.map(o => {
          const isBuy = o.side === "BUY";
          const isComplete = o.status === "COMPLETE";
          const isOpen = o.status === "OPEN";
          const isAMO = o.status === "AMO PENDING";
          const statusClass = isComplete ? "text-green" : (isOpen || isAMO) ? "text-blue" : "text-red";
          
          return `
            <div class="kite-stock-item" onclick="app.openOrderSheet('${o.id}')">
              <div class="kite-stock-left">
                <div class="kite-stock-sym-row">
                  <span class="kite-stock-sym">${o.symbol}</span>
                  <span class="kite-holding-badge" style="background:${isBuy ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isBuy ? '#10b981' : '#ef4444'};">${isBuy ? '▲ BUY' : '▼ SELL'}</span>
                  <span class="badge-tag tag-cnc" style="font-size:10px;">${o.product}</span>
                </div>
                <div class="kite-stock-sub-row">
                  <span class="kite-stock-exchange">${o.orderType} • Qty: ${o.quantity}</span>
                  <span style="font-size:11px;color:#8892a0;">${o.time}</span>
                </div>
              </div>
              <div class="kite-stock-right">
                <div class="kite-stock-ltp">₹${o.price.toFixed(2)}</div>
                <div class="kite-stock-chg ${statusClass}" style="font-weight:700;">${o.status}</div>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    // Sync legacy desktop table if present
    if (tbody) {
      if (store.orders.length === 0) {
        tbody.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
      } else {
        if (emptyState) emptyState.style.display = "none";
        tbody.innerHTML = store.orders.map(o => {
          const isComplete = o.status === "COMPLETE";
          const isAMO = o.status === "AMO PENDING";
          const isOpen = o.status === "OPEN";
          return `
            <tr>
              <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted);">${o.time}</span></td>
              <td><span class="badge-tag ${o.side === 'BUY' ? 'tag-cnc' : 'tag-mis'}" style="font-weight:800;">${o.side}</span></td>
              <td><div class="font-bold text-dark">${o.symbol}</div></td>
              <td><span class="badge-tag tag-cnc">${o.product}</span></td>
              <td><b>${o.orderType}</b></td>
              <td class="text-right font-bold">${o.quantity}</td>
              <td class="text-right font-bold">₹${o.price.toFixed(2)}</td>
              <td><span class="badge-tag ${isComplete ? 'tag-complete' : isAMO ? 'tag-amo' : isOpen ? 'tag-open' : 'tag-cancelled'}">${o.status}</span></td>
              <td class="text-right">
                ${(isOpen || isAMO) ? `
                  <button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-right:4px;" onclick="app.forceExecuteOrder('${o.id}')">Execute</button>
                  <button class="btn-danger" style="padding:3px 8px;font-size:11px;" onclick="app.cancelOrder('${o.id}')">Cancel</button>
                ` : '—'}
              </td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  switchOrderSubtab(subtab) {
    this.activeOrderSubtab = subtab;
    this.renderOrders();
  }

  toggleOrderSearch() {
    const el = document.getElementById("ordersSearchExpand");
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display === "block") {
      const input = document.getElementById("ordersSearchInput");
      if (input) input.focus();
    }
  }

  toggleOrderFilter() {
    window.showToast("Filtered by order status", "info");
  }

  filterOrders(query) {
    this.ordersSearchQuery = query;
    this.renderOrders();
  }

  openContractNoteModal() {
    window.showToast("Demo Contract Note: Zero brokerage applied to demo trades", "info");
  }

  openTradebookModal() {
    window.showToast("Demo Tradebook: All trades executed on Trade Pulse simulated exchange", "info");
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

  // 5. Bids View (IPO, Govt. securities, Auctions)
  renderBids() {
    const subtab = this.activeBidsSubtab || "ipo";
    document.querySelectorAll(".kite-bids-subtabs .kite-subtab-btn").forEach(btn => btn.classList.remove("active"));
    const subtabKey = subtab.charAt(0).toUpperCase() + subtab.slice(1);
    const activeBtn = document.getElementById(`bidsTab${subtabKey}`);
    if (activeBtn) activeBtn.classList.add("active");

    const titleEl = document.getElementById("bidsEmptyTitle");
    if (titleEl) {
      if (subtab === "ipo") titleEl.textContent = "No securities available for bidding";
      else if (subtab === "govt") titleEl.textContent = "No govt. securities available for bidding";
      else if (subtab === "auctions") titleEl.textContent = "No auctions available for bidding";
    }
  }

  switchBidsSubtab(subtab) {
    this.activeBidsSubtab = subtab;
    this.renderBids();
  }

  toggleBidsSearch() {
    window.showToast("Search IPOs & Govt. securities (Demo mode)", "info");
  }

  toggleBidsFilter() {
    window.showToast("Filter securities", "info");
  }

  // 6. Account View (Profile, Privacy Mode, Funds & Settings)
  renderAccount() {
    const user = store.currentUser || { name: "Demo Learner", email: "demo@tradepulse.app", clientId: "TP7842" };
    const nameEl = document.getElementById("accountTopUserName");
    const idEl = document.getElementById("accountCardClientId");
    const emailEl = document.getElementById("accountCardEmail");
    const avatarEl = document.getElementById("accountCardAvatar");
    const navUserEl = document.getElementById("mobBottomNavUserId");
    const toggle = document.getElementById("privacyModeToggle");

    if (nameEl) nameEl.textContent = user.name || "Demo Learner";
    if (idEl) idEl.textContent = user.clientId || "TP7842";
    if (emailEl) emailEl.textContent = user.email || "demo@tradepulse.app";
    if (avatarEl) {
      const initials = (user.name || "Demo Learner").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || "TP";
    }
    if (navUserEl) navUserEl.textContent = user.clientId || "TP7842";
    if (toggle) toggle.checked = !!this.privacyMode;
  }

  togglePrivacyMode(isChecked) {
    this.privacyMode = !!isChecked;
    this.renderHoldings();
    this.renderPositions();
    this.renderFunds();
    window.showToast(`Privacy mode ${this.privacyMode ? 'enabled (balances hidden)' : 'disabled'}`, 'info');
  }

  // 7. Funds View (Available Margin, Add Funds, Withdraw / Reset)
  renderFunds() {
    const availEl = document.getElementById("fundsAvailableMargin");
    const cashEl = document.getElementById("fundsAvailableCash");
    const usedEl = document.getElementById("fundsUsedMargin");
    const openEl = document.getElementById("fundsOpeningBalance");
    const payinEl = document.getElementById("fundsPayin");
    const delivEl = document.getElementById("fundsDeliveryMargin");
    const optEl = document.getElementById("fundsOptionPremium");
    const totalCashEl = document.getElementById("fundsTotalCash");
    const initCapitalEl = document.getElementById("fundsInitialCapital");

    const avail = store.funds.availableCash;
    const used = store.funds.usedMargin || 0;
    const initial = store.funds.initialCapital || 20000;

    if (availEl) availEl.textContent = this.privacyMode ? "••••••" : `₹${avail.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (cashEl) cashEl.textContent = this.privacyMode ? "••••••" : avail.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    if (usedEl) usedEl.textContent = this.privacyMode ? "••••••" : used.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    if (openEl) openEl.textContent = this.privacyMode ? "••••••" : initial.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    if (payinEl) payinEl.textContent = "0.00";
    if (delivEl) delivEl.textContent = "0.00";
    if (optEl) optEl.textContent = "0.00";
    if (totalCashEl) totalCashEl.textContent = this.privacyMode ? "••••••" : `₹${store.funds.totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (initCapitalEl) initCapitalEl.textContent = this.privacyMode ? "••••••" : `₹${initial.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }

  addDemoCapital(amount = 10000) {
    store.funds.availableCash += amount;
    store.funds.totalBalance += amount;
    store.saveUserData();
    this.renderFunds();
    this.renderUserQuickFunds();
    window.playChime();
    window.showToast(`Added +₹${amount.toLocaleString("en-IN")} demo funds!`, "success");
  }

  resetDemoCapital(amount = 20000) {
    if (confirm(`Withdraw/Reset virtual funds back to ₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}?`)) {
      store.funds.availableCash = amount;
      store.funds.usedMargin = 0.00;
      store.funds.totalBalance = amount;
      store.saveUserData();
      this.renderFunds();
      this.renderUserQuickFunds();
      window.playChime();
      window.showToast(`Demo balance reset to ₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "success");
    }
  }

  setupFundsActions() {
    const resetBtn = document.getElementById("resetDemoFundsBtn");
    const addCashBtn = document.getElementById("addDemoCashBtn");

    if (resetBtn) {
      resetBtn.onclick = () => this.resetDemoCapital(20000);
    }
    if (addCashBtn) {
      addCashBtn.onclick = () => this.addDemoCapital(10000);
    }
  }

  // ==========================================================================
  // ZERODHA KITE MOBILE CONTROLLER & 5 TABS NAVIGATION
  // ==========================================================================
  setupMobile() {
    if (window.innerWidth <= 768) {
      document.body.setAttribute("data-mobile-tab", "watchlist");
      this.updateMobileTabState("watchlist");
    }

    const mobTickToggle = document.getElementById("forceMarketTickToggleMob");
    const desktopTickToggle = document.getElementById("forceMarketTickToggle");
    if (mobTickToggle) {
      mobTickToggle.addEventListener("change", (e) => {
        engine.setForceOpen(e.target.checked);
        if (desktopTickToggle) desktopTickToggle.checked = e.target.checked;
        window.showToast(e.target.checked ? "Market simulated: LIVE TICKS ACTIVE" : "Market set to: OFFICIAL MARKET HOURS (09:15 - 15:30 IST)", "info");
      });
    }

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

    // Hide indices drawer when changing tab
    const drawer = document.getElementById("kiteMobIndicesDrawer");
    if (drawer) drawer.style.display = "none";

    // Update Header title & icons (Zerodha Kite Header convention)
    const titleEl = document.getElementById("mobHeaderTitle");
    const cartBtn = document.getElementById("mobCartBtn");
    const chevronBtn = document.getElementById("mobChevronBtn");

    if (titleEl) {
      const titles = {
        watchlist: "Watchlist",
        orders: "Orders",
        portfolio: "Portfolio",
        bids: "Bids",
        account: "Account",
        funds: "Funds"
      };
      titleEl.textContent = titles[tab] || "Trade Pulse";
    }

    if (cartBtn) {
      cartBtn.style.display = (tab === "watchlist" || tab === "orders") ? "flex" : "none";
    }
    if (chevronBtn) {
      chevronBtn.style.display = (tab !== "account") ? "flex" : "none";
    }

    if (tab === "watchlist") {
      this.renderWatchlist();
      const pane = document.querySelector(".watchlist-pane");
      if (pane) pane.scrollTop = 0;
    } else if (tab === "orders") {
      this.switchView("orders");
      this.renderOrders();
    } else if (tab === "portfolio") {
      if (this.currentView === "positions") {
        this.switchView("positions");
      } else {
        this.switchView("holdings");
      }
    } else if (tab === "bids") {
      this.switchView("bids");
      this.renderBids();
    } else if (tab === "account") {
      this.switchView("account");
      this.renderAccount();
    } else if (tab === "funds") {
      this.switchView("funds");
      this.renderFunds();
    }
  }

  toggleMobileIndices() {
    const drawer = document.getElementById("kiteMobIndicesDrawer");
    if (!drawer) return;
    const isHidden = drawer.style.display === "none" || !drawer.style.display;
    drawer.style.display = isHidden ? "block" : "none";

    if (isHidden) {
      const nifty = (typeof INDICES_DATA !== "undefined" && Array.isArray(INDICES_DATA)) ? INDICES_DATA.find(i => i.symbol === "NIFTY 50") : null;
      const sensex = (typeof INDICES_DATA !== "undefined" && Array.isArray(INDICES_DATA)) ? INDICES_DATA.find(i => i.symbol === "SENSEX") : null;

      const nPrice = document.getElementById("mobNiftyPrice");
      const nChg = document.getElementById("mobNiftyChange");
      const sPrice = document.getElementById("mobSensexPrice");
      const sChg = document.getElementById("mobSensexChange");

      const np = nifty ? nifty.price : 24423.65;
      const nc = nifty ? nifty.change : 463.05;
      const npc = nifty ? nifty.pChange : 1.93;

      const sp = sensex ? sensex.price : 78840.60;
      const sc = sensex ? sensex.change : 1520.00;
      const spc = sensex ? sensex.pChange : 1.97;

      if (nPrice) nPrice.textContent = np.toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (nChg) {
        const isPos = nc >= 0;
        nChg.className = `mob-idx-change ${isPos ? 'text-green' : 'text-red'}`;
        nChg.textContent = `${isPos ? '+' : ''}${nc.toFixed(2)} (${isPos ? '+' : ''}${npc.toFixed(2)}%)`;
      }
      if (sPrice) sPrice.textContent = sp.toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (sChg) {
        const isPos = sc >= 0;
        sChg.className = `mob-idx-change ${isPos ? 'text-green' : 'text-red'}`;
        sChg.textContent = `${isPos ? '+' : ''}${sc.toFixed(2)} (${isPos ? '+' : ''}${spc.toFixed(2)}%)`;
      }
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

  openHoldingSheet(symbol) {
    const h = (store.holdings || []).find(item => item.symbol === symbol);
    if (!h) return;
    const stock = STOCKS_MAP.get(symbol);
    const ltp = stock ? stock.price : (h.exitPrice || h.avgPrice);
    const isClosed = h.quantity === 0 || h.status === "CLOSED";
    const pl = isClosed ? (h.realizedPL || 0) : ((h.quantity * ltp) - h.investedValue);

    this.activeSheetItem = { type: "holding", data: h };

    const symEl = document.getElementById("kiteSheetSymbol");
    const subEl = document.getElementById("kiteSheetSub");
    const ltpEl = document.getElementById("kiteSheetLtp");
    const pnlEl = document.getElementById("kiteSheetPnl");
    const exitBtn = document.getElementById("kiteSheetBtnExit");

    if (symEl) symEl.textContent = h.symbol;
    if (subEl) subEl.textContent = `${h.exchange || 'NSE'} • CNC • Demat Qty: ${isClosed ? 0 : h.quantity}`;
    if (ltpEl) ltpEl.textContent = `₹${ltp.toFixed(2)}`;
    if (pnlEl) {
      pnlEl.className = `kite-sheet-pnl ${pl >= 0 ? 'text-green' : 'text-red'}`;
      pnlEl.textContent = `${pl >= 0 ? '+' : ''}₹${pl.toFixed(2)} ${isClosed ? '(Sold)' : ''}`;
    }
    if (exitBtn) {
      exitBtn.style.display = isClosed ? "none" : "flex";
      exitBtn.textContent = "🔴 Sell Holding";
    }

    const sheet = document.getElementById("kiteItemSheetBackdrop");
    if (sheet) sheet.style.display = "flex";
  }

  openOrderSheet(orderId) {
    const order = (store.orders || []).find(o => o.id === orderId);
    if (!order) return;
    this.activeSheetItem = { type: "order", data: order };

    const symEl = document.getElementById("kiteSheetSymbol");
    const subEl = document.getElementById("kiteSheetSub");
    const ltpEl = document.getElementById("kiteSheetLtp");
    const pnlEl = document.getElementById("kiteSheetPnl");
    const exitBtn = document.getElementById("kiteSheetBtnExit");

    if (symEl) symEl.textContent = order.symbol;
    if (subEl) subEl.textContent = `${order.side} • ${order.orderType} • Qty: ${order.quantity}`;
    if (ltpEl) ltpEl.textContent = `₹${order.price.toFixed(2)}`;
    if (pnlEl) {
      pnlEl.className = "kite-sheet-pnl text-blue";
      pnlEl.textContent = order.status;
    }
    if (exitBtn) {
      const canCancel = order.status === "OPEN" || order.status === "AMO PENDING";
      exitBtn.style.display = canCancel ? "flex" : "none";
      exitBtn.textContent = "Cancel Order";
    }

    const sheet = document.getElementById("kiteItemSheetBackdrop");
    if (sheet) sheet.style.display = "flex";
  }

  closeItemSheet() {
    const sheet = document.getElementById("kiteItemSheetBackdrop");
    if (sheet) sheet.style.display = "none";
  }

  actionSheetExit() {
    if (!this.activeSheetItem) return;
    const { type, data } = this.activeSheetItem;
    this.closeItemSheet();

    if (type === "position") {
      this.exitPosition(data.id);
    } else if (type === "holding") {
      this.openOrderModal(data.symbol, "SELL");
    } else if (type === "order") {
      this.cancelOrder(data.id);
    }
  }

  actionSheetAdd() {
    if (!this.activeSheetItem) return;
    const { data } = this.activeSheetItem;
    this.closeItemSheet();
    this.openOrderModal(data.symbol, "BUY");
  }

  actionSheetChart() {
    if (!this.activeSheetItem) return;
    const { data } = this.activeSheetItem;
    this.closeItemSheet();
    this.openChartModal(data.symbol);
  }

  actionSheetDepth() {
    if (!this.activeSheetItem) return;
    const { data } = this.activeSheetItem;
    this.closeItemSheet();
    this.openDepthModal(data.symbol);
  }

  openFabChart() {
    if (this.selectedStock) {
      this.openChartModal(this.selectedStock.symbol);
    } else {
      this.openChartModal("NIFTY 50");
    }
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
