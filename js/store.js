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
  SETTINGS: "tradepulse_settings"
};

const INITIAL_DEMO_CAPITAL = 20000.00;

class TradingStore {
  constructor() {
    this.init();
  }

  init() {
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

    if (this.currentUser) {
      this.loadUserData(this.currentUser.email);
    } else {
      this.funds = {
        availableCash: INITIAL_DEMO_CAPITAL,
        usedMargin: 0.00,
        totalBalance: INITIAL_DEMO_CAPITAL,
        initialCapital: INITIAL_DEMO_CAPITAL
      };
      this.holdings = [];
      this.positions = [];
      this.orders = [];
      this.watchlists = DEFAULT_WATCHLISTS;
    }

    this.activeWatchlist = 1;

    // Immediately clean up previous days' closed items and execute any pending AMO orders
    this.cleanupPreviousDaysClosed();
    this.executeAllPendingAMOOrders();
    this.reconcileFunds();
  }

  getTodayDateString() {
    const d = (typeof engine !== "undefined" && engine && typeof engine.getISTDate === "function") ? engine.getISTDate() : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  cleanupPreviousDaysClosed() {
    const today = this.getTodayDateString();
    if (Array.isArray(this.holdings)) {
      // Keep active holdings (qty > 0) OR holdings closed today (available on screen till that day night!)
      this.holdings = this.holdings.filter(h => (h.quantity > 0) || (h.closedDate ? h.closedDate === today : true));
    }
    if (Array.isArray(this.positions)) {
      // Keep open positions (qty !== 0) OR positions closed today (available on screen till that day night!)
      this.positions = this.positions.filter(p => (p.status === "OPEN" && p.quantity !== 0) || (p.closedDate ? p.closedDate === today : true));
    }
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
    
    // Retain today's closed items until day night and clean previous days
    this.cleanupPreviousDaysClosed();
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

    // Validation for SELL CNC orders: Holdings check (for Equities)
    if (side === "SELL" && product === "CNC" && !isOption) {
      const holding = this.holdings.find(h => h.symbol === symbol && h.quantity > 0);
      if (!holding || holding.quantity < quantity) {
        const available = holding ? holding.quantity : 0;
        return {
          success: false,
          message: `Insufficient holdings to sell. You currently hold ${available} share(s) of ${symbol}.`
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

        const existing = this.holdings.find(h => h.symbol === symbol && h.quantity > 0);
        if (existing) {
          const totalQty = existing.quantity + quantity;
          const totalCost = (existing.quantity * existing.avgPrice) + (quantity * price);
          existing.quantity = totalQty;
          existing.avgPrice = +(totalCost / totalQty).toFixed(2);
          existing.investedValue = +(totalQty * existing.avgPrice).toFixed(2);
          existing.status = "OPEN";
        } else {
          // If holding was sold earlier today, reactivate it with new purchase
          const existingClosed = this.holdings.find(h => h.symbol === symbol && h.quantity === 0);
          if (existingClosed) {
            existingClosed.quantity = quantity;
            existingClosed.avgPrice = price;
            existingClosed.investedValue = +(quantity * price).toFixed(2);
            existingClosed.status = "OPEN";
            existingClosed.name = stock ? stock.name : symbol;
            existingClosed.exchange = stock ? stock.exchange : "NSE";
          } else {
            this.holdings.push({
              symbol,
              name: stock ? stock.name : symbol,
              exchange: stock ? stock.exchange : "NSE",
              quantity,
              avgPrice: price,
              investedValue: +(quantity * price).toFixed(2),
              status: "OPEN",
              createdDate: this.getTodayDateString()
            });
          }
        }
      } else if (side === "SELL") {
        const existingIdx = this.holdings.findIndex(h => h.symbol === symbol && h.quantity > 0);
        if (existingIdx !== -1) {
          const h = this.holdings[existingIdx];
          const soldQty = Math.min(quantity, h.quantity);
          const proceed = +(soldQty * price).toFixed(2);
          const costBasis = +(soldQty * h.avgPrice).toFixed(2);
          const realizedProfit = +(proceed - costBasis).toFixed(2);

          this.funds.availableCash = +(this.funds.availableCash + proceed).toFixed(2);
          this.funds.realizedPnL = +( (this.funds.realizedPnL || 0) + realizedProfit ).toFixed(2);

          h.quantity -= soldQty;
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
          status: "OPEN"
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
      this.exitPosition(p.id);
      count++;
    });
    return count;
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
