// TradePulse State Management & Multi-User Authentication
// Supports Equity Stocks + Option Contracts (Call [CE] and Put [PE]) for Indices & Stocks

const STORAGE_KEYS = {
  USERS_DB: "tradepulse_users_database",
  CURRENT_USER: "tradepulse_current_user",
  FUNDS_PREFIX: "tradepulse_funds_",
  HOLDINGS_PREFIX: "tradepulse_holdings_",
  POSITIONS_PREFIX: "tradepulse_positions_",
  ORDERS_PREFIX: "tradepulse_orders_",
  WATCHLISTS_PREFIX: "tradepulse_watchlists_",
  SETTINGS: "tradepulse_settings",
  SESSION_DATE_PREFIX: "tradepulse_session_date_"
};

const INITIAL_DEMO_CAPITAL = 20000.00;

class TradingStore {
  constructor() {
    this.init();
  }

  init() {
    // Migration: ensure holdings and positions start 100% clean and empty as requested
    const CLEANUP_KEY = "tradepulse_clean_v10";
    try {
      if (!localStorage.getItem(CLEANUP_KEY)) {
        Object.keys(localStorage).forEach(k => {
          if (
            k.startsWith("tradepulse_holdings_") ||
            k.startsWith("tradepulse_positions_") ||
            k.startsWith("tp_holdings_") ||
            k.startsWith("tp_positions_")
          ) {
            localStorage.setItem(k, JSON.stringify([]));
          }
          if (k.startsWith("tradepulse_funds_") || k.startsWith("tp_funds_")) {
            localStorage.setItem(k, JSON.stringify({
              availableCash: INITIAL_DEMO_CAPITAL,
              usedMargin: 0.00,
              totalBalance: INITIAL_DEMO_CAPITAL,
              initialCapital: INITIAL_DEMO_CAPITAL,
              realizedPnL: 0.00
            }));
          }
        });
        localStorage.setItem(CLEANUP_KEY, "true");
      }
    } catch (e) {}

    this.usersDb = this.load(STORAGE_KEYS.USERS_DB, []);
    this.currentUser = this.load(STORAGE_KEYS.CURRENT_USER, null);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, {
      theme: "light",
      soundEnabled: true
    });

    if (this.usersDb.length === 0) {
      const defaultUser = {
        id: "usr_default",
        name: "Demo Learner",
        email: "demo@tradepulse.app",
        password: "password123",
        clientId: "TP7842",
        createdAt: new Date().toISOString()
      };
      this.usersDb.push(defaultUser);
      this.save(STORAGE_KEYS.USERS_DB, this.usersDb);
    }

    if (!this.currentUser) {
      this.currentUser = this.usersDb[0] || {
        id: "usr_default",
        name: "Demo Learner",
        email: "demo@tradepulse.app",
        password: "password123",
        clientId: "TP7842",
        createdAt: new Date().toISOString()
      };
      this.save(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.loadUserData(this.currentUser.email);

    this.activeWatchlist = 1;

    // Immediately run daily session lifecycle: retain today's trades till night, reset to blank on next day
    this.cleanupDailySession();
    this.executeAllPendingAMOOrders();
    this.reconcileFunds();
  }

  getTodayDateString() {
    const eng = typeof globalThis !== "undefined" ? globalThis.engine : (typeof window !== "undefined" ? window.engine : null);
    const d = (eng && typeof eng.getISTDate === "function") ? eng.getISTDate() : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Daily Session Lifecycle per Indian Stock Market Settlement Rules:
  // 1. On purchase day (T), stocks appear in "Positions" (intraday trading).
  // 2. Only stocks held for more than 1 day graduate to "Holdings" (T+1 Demat settlement).
  // 3. Sold stocks remain on screen till that day's night (23:59:59 IST) like Zerodha Kite.
  // 4. On the next day, closed stocks are cleared (blank) and positions start fresh.
  cleanupDailySession() {
    const today = this.getTodayDateString();
    this.currentSessionDate = today;
    const userEmail = this.currentUser ? this.currentUser.email : "guest";
    const key = userEmail.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const lastSessionDate = this.load(STORAGE_KEYS.SESSION_DATE_PREFIX + key, null);

    // If a new day has arrived:
    if (lastSessionDate && lastSessionDate !== today) {
      // 1. Graduate open CNC positions from previous day into this.holdings (now held > 1 day)
      if (Array.isArray(this.positions)) {
        this.positions.forEach(pos => {
          if (pos.product === "CNC" && pos.quantity > 0 && pos.status === "OPEN") {
            const existingH = this.holdings.find(h => h.symbol === pos.symbol && h.quantity > 0);
            if (existingH) {
              const totalQty = existingH.quantity + pos.quantity;
              const totalCost = (existingH.quantity * existingH.avgPrice) + (pos.quantity * pos.avgPrice);
              existingH.quantity = totalQty;
              existingH.avgPrice = +(totalCost / totalQty).toFixed(2);
              existingH.investedValue = +(totalQty * existingH.avgPrice).toFixed(2);
              existingH.status = "OPEN";
              existingH.holdingDays = (existingH.holdingDays || 1) + 1;
            } else {
              this.holdings.push({
                symbol: pos.symbol,
                name: pos.name,
                exchange: pos.exchange,
                quantity: pos.quantity,
                avgPrice: pos.avgPrice,
                investedValue: +(pos.quantity * pos.avgPrice).toFixed(2),
                status: "OPEN",
                createdDate: pos.createdDate || lastSessionDate,
                holdingDays: 1
              });
            }
          }
        });
      }

      // 2. Clear closed holdings from past dates (next day starts blank of closed items!)
      // Keep only active holdings held for > 1 day, purging any dummy legacy seeds
      if (Array.isArray(this.holdings)) {
        this.holdings = this.holdings.filter(h => {
          if (h.symbol === "OBEROIRLTY" || h.symbol === "DLF" || h.symbol === "KALYANKJIL" || h.symbol === "INDIACEM" || h.symbol === "HBLENGINE") {
            if (h.createdDate === "2026-11-05" || h.createdDate === "2026-11-06" || !h.orderId) return false;
          }
          return h.quantity > 0 && h.status === "OPEN" && (h.holdingDays || 0) >= 1;
        });
      }

      // 3. Clear positions for the new day's fresh intraday trading
      this.positions = [];

      // 4. Clear past executed orders
      this.orders = Array.isArray(this.orders) ? this.orders.filter(o => o.createdDate === today) : [];

      this.save(STORAGE_KEYS.SESSION_DATE_PREFIX + key, today);
      this.reconcileFunds();
      this.saveUserData();
      return;
    }

    // Save current active day session date
    this.save(STORAGE_KEYS.SESSION_DATE_PREFIX + key, today);

    // Within the same day:
    // Move any CNC stocks created today out of holdings into positions (Day T belongs strictly in Positions!)
    if (Array.isArray(this.holdings)) {
      const createdToday = [];
      this.holdings = this.holdings.filter(h => {
        // Unconditional purge of any legacy demo seeds
        if (h.symbol === "OBEROIRLTY" || h.symbol === "DLF" || h.symbol === "KALYANKJIL" || h.symbol === "INDIACEM" || h.symbol === "HBLENGINE") {
          if (h.createdDate === "2026-11-05" || h.createdDate === "2026-11-06" || !h.orderId) {
            return false;
          }
        }
        // If stock was bought today or holdingDays < 1, it belongs strictly in POSITIONS
        if (h.createdDate === today || !h.holdingDays || h.holdingDays < 1) {
          if (h.status === "OPEN" && h.quantity > 0) {
            createdToday.push(h);
          }
          return false;
        }
        // Remove closed holdings from older dates (only keep today's closed holdings till night)
        if (h.status === "CLOSED" && h.closedDate && h.closedDate !== today) {
          return false;
        }
        return true;
      });

      createdToday.forEach(h => {
        if (!Array.isArray(this.positions)) this.positions = [];
        const existingPos = this.positions.find(p => p.symbol === h.symbol && p.product === "CNC" && p.status === "OPEN");
        if (!existingPos) {
          this.positions.push({
            id: "POS-" + Math.floor(1000 + Math.random() * 9000),
            symbol: h.symbol,
            name: h.name,
            exchange: h.exchange,
            product: "CNC",
            quantity: h.quantity,
            avgPrice: h.avgPrice,
            marginBlocked: h.investedValue || (h.quantity * h.avgPrice),
            status: "OPEN",
            isOption: false,
            createdDate: today,
            holdingDays: 0
          });
        }
      });
    }

    // Filter out past closed positions
    if (Array.isArray(this.positions)) {
      this.positions = this.positions.filter(p => {
        if (p.status === "CLOSED" && p.closedDate && p.closedDate !== today) {
          return false;
        }
        return true;
      });
    }
  }

  // Fast-forward simulation to next trading day (T+1 settlement demo)
  simulateNextTradingDay() {
    const curDate = new Date(this.currentSessionDate || this.getTodayDateString());
    curDate.setDate(curDate.getDate() + 1);
    // If lands on Saturday or Sunday, advance to Monday
    if (curDate.getDay() === 6) curDate.setDate(curDate.getDate() + 2);
    else if (curDate.getDay() === 0) curDate.setDate(curDate.getDate() + 1);

    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, "0");
    const dd = String(curDate.getDate()).padStart(2, "0");
    const nextDateStr = `${yyyy}-${mm}-${dd}`;

    const userEmail = this.currentUser ? this.currentUser.email : "guest";
    const key = userEmail.toLowerCase().replace(/[^a-z0-9]/g, "_");

    let movedCount = 0;
    if (Array.isArray(this.positions)) {
      this.positions.forEach(pos => {
        if (pos.product === "CNC" && pos.quantity > 0 && pos.status === "OPEN") {
          const existingH = this.holdings.find(h => h.symbol === pos.symbol && h.quantity > 0);
          if (existingH) {
            const totalQty = existingH.quantity + pos.quantity;
            const totalCost = (existingH.quantity * existingH.avgPrice) + (pos.quantity * pos.avgPrice);
            existingH.quantity = totalQty;
            existingH.avgPrice = +(totalCost / totalQty).toFixed(2);
            existingH.investedValue = +(totalQty * existingH.avgPrice).toFixed(2);
            existingH.status = "OPEN";
            existingH.holdingDays = (existingH.holdingDays || 1) + 1;
          } else {
            this.holdings.push({
              symbol: pos.symbol,
              name: pos.name,
              exchange: pos.exchange,
              quantity: pos.quantity,
              avgPrice: pos.avgPrice,
              investedValue: +(pos.quantity * pos.avgPrice).toFixed(2),
              status: "OPEN",
              createdDate: pos.createdDate || this.currentSessionDate,
              holdingDays: 1
            });
          }
          movedCount++;
        }
      });
    }

    // Retain only active holdings (>1 day holding)
    if (Array.isArray(this.holdings)) {
      this.holdings = this.holdings.filter(h => h.quantity > 0 && h.status === "OPEN");
    }

    // Clear positions for the new day
    this.positions = [];
    this.orders = Array.isArray(this.orders) ? this.orders.filter(o => o.createdDate === nextDateStr) : [];

    this.currentSessionDate = nextDateStr;
    this.save(STORAGE_KEYS.SESSION_DATE_PREFIX + key, nextDateStr);
    this.reconcileFunds();
    this.saveUserData();

    return { success: true, nextDate: nextDateStr, movedCount };
  }

  loadUserData(email) {
    const key = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    this.funds = this.load(STORAGE_KEYS.FUNDS_PREFIX + key, {
      availableCash: INITIAL_DEMO_CAPITAL,
      usedMargin: 0.00,
      totalBalance: INITIAL_DEMO_CAPITAL,
      initialCapital: INITIAL_DEMO_CAPITAL,
      realizedPnL: 0.00
    });
    this.holdings = this.load(STORAGE_KEYS.HOLDINGS_PREFIX + key, []);
    this.positions = this.load(STORAGE_KEYS.POSITIONS_PREFIX + key, []);
    this.orders = this.load(STORAGE_KEYS.ORDERS_PREFIX + key, []);

    // Ensure clean empty portfolio as requested: holdings and positions start 100% empty
    if (Array.isArray(this.holdings)) {
      this.holdings = this.holdings.filter(h => {
        if (!h.orderId || h.orderId.startsWith("seed_") || h.orderId.startsWith("demo_") ||
            h.symbol === "OBEROIRLTY" || h.symbol === "DLF" || h.symbol === "KALYANKJIL" || h.symbol === "INDIACEM" || h.symbol === "HBLENGINE") {
          return false;
        }
        return h.quantity > 0 && (h.holdingDays || 0) >= 1 && h.createdDate !== this.getTodayDateString();
      });
    }
    if (Array.isArray(this.positions)) {
      this.positions = this.positions.filter(p => !(p.id && p.id.startsWith("pos_demo_")));
    }
    this.saveUserData();
    
    // Retain today's holdings & positions until night, start blank on next day
    this.cleanupDailySession();
    this.reconcileFunds();

    // Load watchlists and ensure valid existing symbols
    let loadedWatchlists = this.load(STORAGE_KEYS.WATCHLISTS_PREFIX + key, null);
    if (!loadedWatchlists || !loadedWatchlists[5] || !loadedWatchlists[5].some(s => s.includes("57000") || s.includes("24400"))) {
      loadedWatchlists = JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
    }
    this.watchlists = loadedWatchlists;
  }

  saveUserData() {
    if (!this.currentUser) return;
    const key = this.currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    this.save(STORAGE_KEYS.FUNDS_PREFIX + key, this.funds);
    this.save(STORAGE_KEYS.HOLDINGS_PREFIX + key, this.holdings);
    this.save(STORAGE_KEYS.POSITIONS_PREFIX + key, this.positions);
    this.save(STORAGE_KEYS.ORDERS_PREFIX + key, this.orders);
    this.save(STORAGE_KEYS.WATCHLISTS_PREFIX + key, this.watchlists);
  }

  signUp({ name, email, password, confirmPassword }) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    password = (password || "").trim();
    confirmPassword = (confirmPassword || "").trim();

    if (!name) return { success: false, message: "Please enter your full name." };
    if (!email || !email.includes("@")) return { success: false, message: "Please enter a valid email address." };
    if (!password || password.length < 4) return { success: false, message: "Password must be at least 4 characters long." };
    if (password !== confirmPassword) return { success: false, message: "Passwords do not match! Please check and re-type." };

    const existing = this.usersDb.find(u => u.email === email);
    if (existing) return { success: false, message: "An account with this email already exists. Please log in." };

    const randomId = Math.floor(1000 + Math.random() * 9000);
    const newUser = {
      id: "usr_" + Date.now(),
      name,
      email,
      password,
      clientId: `TP${randomId}`,
      createdAt: new Date().toISOString()
    };

    this.usersDb.push(newUser);
    this.save(STORAGE_KEYS.USERS_DB, this.usersDb);

    this.currentUser = newUser;
    this.save(STORAGE_KEYS.CURRENT_USER, this.currentUser);

    this.funds = {
      availableCash: INITIAL_DEMO_CAPITAL,
      usedMargin: 0.00,
      totalBalance: INITIAL_DEMO_CAPITAL,
      initialCapital: INITIAL_DEMO_CAPITAL
    };
    this.holdings = [];
    this.positions = [];
    this.orders = [];
    this.watchlists = JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
    this.saveUserData();

    return {
      success: true,
      user: newUser,
      message: `Account created successfully! ₹20,000.00 Demo Capital added to your wallet.`
    };
  }

  login({ email, password }) {
    email = (email || "").trim().toLowerCase();
    password = (password || "").trim();

    if (!email) return { success: false, message: "Please enter your registered email address." };
    if (!password) return { success: false, message: "Please enter your password." };

    const user = this.usersDb.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, message: "Invalid email or password. Please check your credentials." };

    this.currentUser = user;
    this.save(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    this.loadUserData(user.email);

    return {
      success: true,
      user,
      message: `Welcome back, ${user.name}! Your demo account is ready.`
    };
  }

  quickDemoLogin() {
    const demoUser = this.usersDb[0];
    this.currentUser = demoUser;
    this.save(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    this.loadUserData(demoUser.email);
    return demoUser;
  }

  logout() {
    this.currentUser = null;
    this.save(STORAGE_KEYS.CURRENT_USER, null);
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  saveAll() {
    this.saveUserData();
  }

  // Calculate Margin Required for given order (Stocks vs Option Contracts)
  calculateMarginRequired(product, quantity, price, isOption = false) {
    const total = quantity * price;

    if (isOption) {
      // Options Buying: 100% of premium required
      return +total.toFixed(2);
    }

    if (product === "MIS") {
      // 5x leverage for intraday MIS equity
      return +(total / 5).toFixed(2);
    }
    // CNC 100% upfront margin
    return +total.toFixed(2);
  }

  // Place Order (Buy / Sell for Equities & Options)
  placeOrder({ symbol, product, orderType, side, quantity, price, triggerPrice = 0 }) {
    quantity = parseInt(quantity, 10);
    price = parseFloat(price);

    if (isNaN(quantity) || quantity <= 0) {
      return { success: false, message: "Please enter a valid quantity greater than 0." };
    }

    // Demo Execution Engine:
    // Allow all traders to execute buy or sell orders smoothly anytime for continuous learning & practice.
    const eng = typeof globalThis !== "undefined" ? globalThis.engine : (typeof window !== "undefined" ? window.engine : null);
    const market = (eng && typeof eng.getMarketStatus === "function")
      ? eng.getMarketStatus()
      : { isOpen: true };

    const stock = STOCKS_MAP.get(symbol);
    if (!stock) {
      return { success: false, message: `Instrument ${symbol} not found.` };
    }

    const isOption = !!stock.isOption;
    const executionPrice = orderType === "MARKET" ? stock.price : price;
    const marginReq = this.calculateMarginRequired(product, quantity, executionPrice, isOption);

    // Validation for BUY orders: Margin check
    if (side === "BUY") {
      if (marginReq > this.funds.availableCash) {
        return {
          success: false,
          message: `Insufficient demo funds. Required: ₹${marginReq.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Available: ₹${this.funds.availableCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        };
      }
    }

    // Validation for SELL CNC orders: Check holdings (>1 day) + today's CNC positions
    if (side === "SELL" && product === "CNC" && !isOption) {
      const holding = this.holdings.find(h => h.symbol === symbol && h.quantity > 0);
      const pos = this.positions.find(p => p.symbol === symbol && p.product === "CNC" && p.status === "OPEN" && p.quantity > 0);
      const availableHolding = holding ? holding.quantity : 0;
      const availablePos = pos ? pos.quantity : 0;
      const totalAvailable = availableHolding + availablePos;

      if (totalAvailable < quantity) {
        return {
          success: false,
          message: `Insufficient shares to sell. You currently have ${totalAvailable} share(s) available (${availableHolding} in Holdings, ${availablePos} in Positions).`
        };
      }
    }

    const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // In our practice paper trading terminal, MARKET orders ALWAYS execute immediately
    // so learners and clients can practice buying & selling at any time without being blocked!
    // LIMIT orders execute immediately if price condition matches, else stay OPEN
    const isImmediate = (orderType === "MARKET") || (
      orderType === "LIMIT" && (
        (side === "BUY" && stock.price <= price) ||
        (side === "SELL" && stock.price >= price)
      )
    );

    const order = {
      id: orderId,
      time: timeStr,
      symbol,
      name: stock.name,
      exchange: stock.exchange,
      side,
      product: isOption ? (product === "CNC" ? "NRML" : product) : product,
      orderType,
      quantity,
      price: executionPrice,
      triggerPrice,
      status: isImmediate ? "COMPLETE" : "OPEN",
      marginUsed: marginReq,
      isOption,
      optionType: stock.optionType || null,
      strike: stock.strike || null,
      isAMO: false,
      createdDate: this.getTodayDateString(),
      statusMessage: isImmediate 
        ? `Executed at ₹${executionPrice.toFixed(2)}` 
        : `Limit order pending at ₹${executionPrice.toFixed(2)}`
    };

    this.orders.unshift(order);

    if (isImmediate) {
      this.processExecution(order);
    } else {
      if (side === "BUY") {
        this.funds.availableCash -= marginReq;
        this.funds.usedMargin += marginReq;
      }
    }

    this.saveAll();
    return {
      success: true,
      order,
      isImmediate,
      isAMO: false,
      message: isImmediate
        ? `${side} ${quantity} ${symbol} executed at ₹${executionPrice.toFixed(2)}`
        : `Limit order placed: ${side} ${quantity} ${symbol} at ₹${executionPrice.toFixed(2)}`
    };
  }

  processExecution(order) {
    const { symbol, product, side, quantity, price, marginUsed, isOption } = order;
    const stock = STOCKS_MAP.get(symbol);

    // Options always go to Positions (NRML / MIS)
    if (isOption) {
      const existingIdx = this.positions.findIndex(p => p.symbol === symbol && p.status === "OPEN");

      if (existingIdx !== -1) {
        const pos = this.positions[existingIdx];
        const isSameSide = (pos.quantity > 0 && side === "BUY") || (pos.quantity < 0 && side === "SELL");

        if (isSameSide) {
          const additionalQty = side === "BUY" ? quantity : -quantity;
          const newQty = pos.quantity + additionalQty;
          const totalCost = (Math.abs(pos.quantity) * pos.avgPrice) + (quantity * price);
          pos.avgPrice = +(totalCost / Math.abs(newQty)).toFixed(2);
          pos.quantity = newQty;
          pos.marginBlocked += marginUsed;

          this.funds.availableCash -= marginUsed;
          this.funds.usedMargin += marginUsed;
        } else {
          // Squaring off Option
          const currentAbsQty = Math.abs(pos.quantity);
          const closedQty = Math.min(currentAbsQty, quantity);
          const posIsLong = pos.quantity > 0;
          const pnlPerShare = posIsLong ? (price - pos.avgPrice) : (pos.avgPrice - price);
          const realizedPL = +(pnlPerShare * closedQty).toFixed(2);

          const releasedMargin = +(closedQty * pos.avgPrice).toFixed(2);
          this.funds.availableCash += (releasedMargin + realizedPL);
          this.funds.usedMargin = Math.max(0, this.funds.usedMargin - releasedMargin);
          this.funds.realizedPnL = +( (this.funds.realizedPnL || 0) + realizedPL ).toFixed(2);

          if (closedQty === currentAbsQty) {
            pos.status = "CLOSED";
            pos.quantity = 0;
            pos.avgPrice = 0;
            pos.marginBlocked = 0;
            pos.realizedPL = +( (pos.realizedPL || 0) + realizedPL ).toFixed(2);
            pos.exitPrice = price;
            pos.exitTime = new Date().toLocaleTimeString();
            pos.closedDate = this.getTodayDateString();
          } else {
            const remainingQty = currentAbsQty - closedQty;
            pos.quantity = posIsLong ? remainingQty : -remainingQty;
            pos.marginBlocked = Math.max(0, pos.marginBlocked - releasedMargin);
            pos.realizedPL = +( (pos.realizedPL || 0) + realizedPL ).toFixed(2);
          }
        }
      } else {
        // New Option Position
        this.funds.availableCash -= marginUsed;
        this.funds.usedMargin += marginUsed;

        this.positions.push({
          id: "POS-" + Math.floor(1000 + Math.random() * 9000),
          symbol,
          name: stock ? stock.name : symbol,
          exchange: stock ? stock.exchange : "NSE",
          product: product || "NRML",
          quantity: side === "BUY" ? quantity : -quantity,
          avgPrice: price,
          marginBlocked: marginUsed,
          status: "OPEN",
          isOption: true,
          optionType: stock ? stock.optionType : null,
          strike: stock ? stock.strike : null,
          createdDate: this.getTodayDateString()
        });
      }

      this.reconcileFunds();
      return;
    }

    // Regular Equity CNC / MIS
    if (product === "CNC") {
      if (side === "BUY") {
        this.funds.availableCash -= marginUsed;
        this.funds.usedMargin += marginUsed;

        // On purchase day (Day T), equity CNC is an intraday purchase awaiting T+1 settlement and resides in Positions!
        const existingPos = this.positions.find(p => p.symbol === symbol && p.product === "CNC" && p.status === "OPEN");
        if (existingPos) {
          const totalQty = existingPos.quantity + quantity;
          const totalCost = (existingPos.quantity * existingPos.avgPrice) + (quantity * price);
          existingPos.quantity = totalQty;
          existingPos.avgPrice = +(totalCost / totalQty).toFixed(2);
          existingPos.marginBlocked += marginUsed;
          existingPos.status = "OPEN";
        } else {
          // If was closed earlier today, reactivate
          const existingClosed = this.positions.find(p => p.symbol === symbol && p.product === "CNC" && p.status === "CLOSED");
          if (existingClosed) {
            existingClosed.quantity = quantity;
            existingClosed.avgPrice = price;
            existingClosed.marginBlocked = marginUsed;
            existingClosed.status = "OPEN";
            existingClosed.name = stock ? stock.name : symbol;
            existingClosed.exchange = stock ? stock.exchange : "NSE";
            existingClosed.createdDate = this.getTodayDateString();
            existingClosed.closedDate = null;
          } else {
            this.positions.push({
              id: "POS-" + Math.floor(1000 + Math.random() * 9000),
              symbol,
              name: stock ? stock.name : symbol,
              exchange: stock ? stock.exchange : "NSE",
              product: "CNC",
              quantity,
              avgPrice: price,
              marginBlocked: marginUsed,
              status: "OPEN",
              isOption: false,
              createdDate: this.getTodayDateString(),
              holdingDays: 0
            });
          }
        }
      } else if (side === "SELL") {
        let remainingToSell = quantity;

        // 1. First, square off / sell from today's open CNC position if exists
        const pos = this.positions.find(p => p.symbol === symbol && p.product === "CNC" && p.status === "OPEN" && p.quantity > 0);
        if (pos && remainingToSell > 0) {
          const soldFromPos = Math.min(remainingToSell, pos.quantity);
          const posCostBasis = +(soldFromPos * pos.avgPrice).toFixed(2);
          const posProceeds = +(soldFromPos * price).toFixed(2);
          const posRealizedPL = +(posProceeds - posCostBasis).toFixed(2);

          const releasedMargin = posCostBasis;
          this.funds.availableCash += (releasedMargin + posRealizedPL);
          this.funds.usedMargin = Math.max(0, this.funds.usedMargin - releasedMargin);
          this.funds.realizedPnL = +( (this.funds.realizedPnL || 0) + posRealizedPL ).toFixed(2);

          pos.realizedPL = +( (pos.realizedPL || 0) + posRealizedPL ).toFixed(2);
          pos.exitPrice = price;
          pos.exitTime = new Date().toLocaleTimeString();

          if (soldFromPos === pos.quantity) {
            pos.status = "CLOSED";
            pos.quantity = 0;
            pos.avgPrice = 0;
            pos.marginBlocked = 0;
            pos.closedDate = this.getTodayDateString();
          } else {
            pos.quantity -= soldFromPos;
            pos.marginBlocked = Math.max(0, pos.marginBlocked - releasedMargin);
          }

          remainingToSell -= soldFromPos;
        }

        // 2. Next, sell any remaining quantity from overnight holdings (held > 1 day)
        if (remainingToSell > 0) {
          const h = this.holdings.find(item => item.symbol === symbol && item.quantity > 0);
          if (h) {
            const soldFromHoldings = Math.min(remainingToSell, h.quantity);
            const proceed = +(soldFromHoldings * price).toFixed(2);
            const costBasis = +(soldFromHoldings * h.avgPrice).toFixed(2);
            const realizedProfit = +(proceed - costBasis).toFixed(2);

            this.funds.availableCash = +(this.funds.availableCash + proceed).toFixed(2);
            this.funds.realizedPnL = +( (this.funds.realizedPnL || 0) + realizedProfit ).toFixed(2);

            h.quantity -= soldFromHoldings;
            h.realizedPL = +( (h.realizedPL || 0) + realizedProfit ).toFixed(2);
            h.exitPrice = price;
            h.exitTime = new Date().toLocaleTimeString();
            h.closedDate = this.getTodayDateString();

            if (h.quantity <= 0) {
              h.quantity = 0;
              h.investedValue = 0;
              h.status = "CLOSED";
              // Retained on screen till that day night (like Zerodha Kite)!
            } else {
              h.investedValue = +(h.quantity * h.avgPrice).toFixed(2);
            }
          }
        }
      }
    } else if (product === "MIS") {
      const existingIdx = this.positions.findIndex(p => p.symbol === symbol && p.product === "MIS" && p.status === "OPEN");

      if (existingIdx !== -1) {
        const pos = this.positions[existingIdx];
        const isSameSide = (pos.quantity > 0 && side === "BUY") || (pos.quantity < 0 && side === "SELL");

        if (isSameSide) {
          const additionalQty = side === "BUY" ? quantity : -quantity;
          const newQty = pos.quantity + additionalQty;
          const totalCost = (Math.abs(pos.quantity) * pos.avgPrice) + (quantity * price);
          pos.avgPrice = +(totalCost / Math.abs(newQty)).toFixed(2);
          pos.quantity = newQty;
          pos.marginBlocked += marginUsed;

          this.funds.availableCash -= marginUsed;
          this.funds.usedMargin += marginUsed;
        } else {
          const currentAbsQty = Math.abs(pos.quantity);
          const closedQty = Math.min(currentAbsQty, quantity);
          const posIsLong = pos.quantity > 0;
          const pnlPerShare = posIsLong ? (price - pos.avgPrice) : (pos.avgPrice - price);
          const realizedPL = +(pnlPerShare * closedQty).toFixed(2);

          const releasedMargin = +((closedQty * pos.avgPrice) / 5).toFixed(2);
          this.funds.availableCash += (releasedMargin + realizedPL);
          this.funds.usedMargin = Math.max(0, this.funds.usedMargin - releasedMargin);
          this.funds.realizedPnL = +( (this.funds.realizedPnL || 0) + realizedPL ).toFixed(2);

          if (closedQty === currentAbsQty) {
            pos.status = "CLOSED";
            pos.quantity = 0;
            pos.avgPrice = 0;
            pos.marginBlocked = 0;
            pos.realizedPL = +( (pos.realizedPL || 0) + realizedPL ).toFixed(2);
            pos.exitPrice = price;
            pos.exitTime = new Date().toLocaleTimeString();
            pos.closedDate = this.getTodayDateString();
          } else {
            const remainingQty = currentAbsQty - closedQty;
            pos.quantity = posIsLong ? remainingQty : -remainingQty;
            pos.marginBlocked = Math.max(0, pos.marginBlocked - releasedMargin);
            pos.realizedPL = +( (pos.realizedPL || 0) + realizedPL ).toFixed(2);
          }
        }
      } else {
        this.funds.availableCash -= marginUsed;
        this.funds.usedMargin += marginUsed;

        this.positions.push({
          id: "POS-" + Math.floor(1000 + Math.random() * 9000),
          symbol,
          name: stock ? stock.name : symbol,
          exchange: stock ? stock.exchange : "NSE",
          product: "MIS",
          quantity: side === "BUY" ? quantity : -quantity,
          avgPrice: price,
          marginBlocked: marginUsed,
          status: "OPEN",
          createdDate: this.getTodayDateString()
        });
      }
    }

    this.reconcileFunds();
  }

  reconcileFunds() {
    if (!this.funds) {
      this.funds = {
        availableCash: INITIAL_DEMO_CAPITAL,
        usedMargin: 0.00,
        totalBalance: INITIAL_DEMO_CAPITAL,
        initialCapital: INITIAL_DEMO_CAPITAL,
        realizedPnL: 0.00
      };
    }

    // Always compute realizedPnL accurately from all closed positions and closed holdings
    let closedRealizedTotal = 0;
    this.positions.forEach(p => {
      if (typeof p.realizedPL === "number") closedRealizedTotal += p.realizedPL;
    });
    this.holdings.forEach(h => {
      if (typeof h.realizedPL === "number") closedRealizedTotal += h.realizedPL;
    });
    this.funds.realizedPnL = +closedRealizedTotal.toFixed(2);

    // 1. Exact margin currently needed for active CNC holdings (only quantity > 0)
    const holdingsCost = this.holdings.reduce((sum, h) => {
      if (h.quantity > 0) {
        const cost = typeof h.investedValue === "number" ? h.investedValue : (h.quantity * h.avgPrice);
        return sum + (cost || 0);
      }
      return sum;
    }, 0);

    // 2. Exact margin currently blocked for open intraday & option positions
    const openPositionsMargin = this.positions
      .filter(p => p.status === "OPEN" && p.quantity !== 0)
      .reduce((sum, p) => sum + (p.marginBlocked || 0), 0);

    // 3. Exact margin blocked for open pending BUY orders
    const pendingOrdersMargin = this.orders
      .filter(o => o.status === "OPEN" && o.side === "BUY")
      .reduce((sum, o) => sum + (o.marginUsed || 0), 0);

    const exactUsedMargin = +(holdingsCost + openPositionsMargin + pendingOrdersMargin).toFixed(2);

    // If usedMargin in store was bloated or mismatched:
    const currentUsed = +(this.funds.usedMargin || 0);
    if (Math.abs(currentUsed - exactUsedMargin) > 0.001) {
      const discrepancy = currentUsed - exactUsedMargin;
      this.funds.availableCash = +( (this.funds.availableCash || 0) + discrepancy ).toFixed(2);
      this.funds.usedMargin = exactUsedMargin;
    }

    // Baseline validation: if user has zero active holdings and zero open positions, availableCash cannot be stranded lower than baseline
    const hasActiveHoldings = this.holdings.some(h => h.quantity > 0);
    const expectedBaseCash = (this.funds.initialCapital || INITIAL_DEMO_CAPITAL) + (this.funds.realizedPnL || 0) - this.funds.usedMargin;
    if (this.funds.availableCash < expectedBaseCash && !hasActiveHoldings && openPositionsMargin === 0 && pendingOrdersMargin === 0) {
      this.funds.availableCash = +expectedBaseCash.toFixed(2);
    }

    this.funds.totalBalance = +(this.funds.availableCash + this.funds.usedMargin).toFixed(2);
    this.saveUserData();
  }

  getRealizedPnL() {
    this.reconcileFunds();
    return +(this.funds.realizedPnL || 0).toFixed(2);
  }

  recalculateTotalBalance() {
    this.reconcileFunds();
  }

  cancelOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || (order.status !== "OPEN" && order.status !== "AMO PENDING")) return false;

    order.status = "CANCELLED";
    order.statusMessage = "Cancelled by user";

    this.reconcileFunds();
    this.saveAll();
    return true;
  }

  executeOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || (order.status !== "OPEN" && order.status !== "AMO PENDING")) return false;

    const stock = STOCKS_MAP.get(order.symbol);
    const execPrice = stock ? stock.price : order.price;

    order.status = "COMPLETE";
    order.price = execPrice;
    order.statusMessage = `Executed at ₹${execPrice.toFixed(2)}`;

    this.processExecution(order);
    this.saveAll();
    return true;
  }

  executeAllPendingAMOOrders() {
    const pending = this.orders.filter(o => o.status === "AMO PENDING" || (o.status === "OPEN" && o.orderType === "MARKET"));
    let count = 0;
    pending.forEach(o => {
      if (this.executeOrder(o.id)) {
        count++;
      }
    });
    return count;
  }

  exitPosition(positionId) {
    const pos = this.positions.find(p => p.id === positionId && p.status === "OPEN");
    if (!pos) return { success: false, message: "Position not found or already closed." };

    const stock = STOCKS_MAP.get(pos.symbol);
    const exitPrice = stock ? stock.price : pos.avgPrice;
    const qty = Math.abs(pos.quantity);
    const side = pos.quantity > 0 ? "SELL" : "BUY";

    const res = this.placeOrder({
      symbol: pos.symbol,
      product: pos.product,
      orderType: "MARKET",
      side,
      quantity: qty,
      price: exitPrice
    });

    return res;
  }

  exitAllPositions() {
    const openPositions = this.positions.filter(p => p.status === "OPEN");
    let count = 0;
    openPositions.forEach(p => {
      const res = this.exitPosition(p.id);
      if (res && res.success) count++;
    });
    return { success: true, count };
  }

  resetFunds(capital = INITIAL_DEMO_CAPITAL) {
    this.funds = {
      availableCash: capital,
      usedMargin: 0.00,
      totalBalance: capital,
      initialCapital: capital,
      realizedPnL: 0.00
    };
    this.holdings = [];
    this.positions = [];
    this.orders = [];
    this.saveAll();
  }

  addDemoCash(amount = 10000) {
    this.funds.availableCash += amount;
    this.recalculateTotalBalance();
    this.saveAll();
    return this.funds.availableCash;
  }

  addStockToWatchlist(listId, symbol) {
    if (!this.watchlists[listId]) this.watchlists[listId] = [];
    if (!this.watchlists[listId].includes(symbol)) {
      this.watchlists[listId].push(symbol);
      this.saveUserData();
      return true;
    }
    return false;
  }

  removeStockFromWatchlist(listId, symbol) {
    if (!this.watchlists[listId]) return false;
    const idx = this.watchlists[listId].indexOf(symbol);
    if (idx !== -1) {
      this.watchlists[listId].splice(idx, 1);
      this.saveUserData();
      return true;
    }
    return false;
  }
}

const store = new TradingStore();
