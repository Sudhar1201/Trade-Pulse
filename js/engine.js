// TradePulse Market Hours & Execution Engine
// Enforces Strict Indian Market Trading Hours: Mon - Fri, 09:15 AM - 03:30 PM IST
// Outside market hours, prices remain 100% FROZEN at the last closing prices until next session open

class MarketEngine {
  constructor(stocksMap, indices, store) {
    this.stocksMap = stocksMap;
    this.indices = indices;
    this.store = store;
    this.listeners = [];
    this.statusListeners = [];
    this.timer = null;
    this.statusTimer = null;
    this.forceOpenSimulation = false; // Optional toggle for demonstration
  }

  // Calculate current Indian Standard Time (IST, UTC+5:30)
  getISTDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }

  // Official NSE/BSE Indian Stock Market Holidays Calendar
  isMarketHoliday(istDate) {
    const mm = String(istDate.getMonth() + 1).padStart(2, "0");
    const dd = String(istDate.getDate()).padStart(2, "0");
    const key = `${mm}-${dd}`;

    const HOLIDAYS = {
      "01-26": "Republic Day",
      "03-08": "Maha Shivratri",
      "03-25": "Holi",
      "03-29": "Good Friday",
      "04-11": "Eid-Ul-Fitr",
      "04-14": "Dr. Babasaheb Ambedkar Jayanti",
      "04-17": "Shri Ram Navami",
      "05-01": "Maharashtra Day",
      "06-17": "Bakri Id",
      "07-17": "Muharram",
      "08-15": "Independence Day",
      "10-02": "Mahatma Gandhi Jayanti",
      "11-01": "Diwali Laxmi Pujan",
      "11-15": "Gurunanak Jayanti",
      "12-25": "Christmas"
    };

    return HOLIDAYS[key] || null;
  }

  // Determine if Indian Equity Market (NSE/BSE) is currently open
  getMarketStatus() {
    if (this.forceOpenSimulation) {
      return {
        isOpen: true,
        statusText: "LIVE (SIMULATED)",
        message: "Market simulation active • Live orders allowed",
        isSimulated: true,
        isWeekday: true,
        holidayName: null,
        reason: ""
      };
    }

    const ist = this.getISTDate();
    const day = ist.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekday = day >= 1 && day <= 5;
    const dayName = ist.toLocaleDateString('en-US', { weekday: 'long' });

    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Official NSE Trading Hours: 09:15 AM (555 min) to 03:30 PM (930 min) IST
    const openMinutes = 9 * 60 + 15;  // 555
    const closeMinutes = 15 * 60 + 30; // 930

    const holidayName = this.isMarketHoliday(ist);
    const isHoliday = !!holidayName;

    const isOpen = !isHoliday && isWeekday && totalMinutes >= openMinutes && totalMinutes < closeMinutes;

    let reason = "";
    let nextSession = "";

    if (!isWeekday) {
      reason = `Market is CLOSED today (${dayName}). Live trading is only permitted Monday to Friday between 09:15 AM and 03:30 PM IST per the Indian Stock Market calendar.`;
      nextSession = "Opens Monday at 09:15 AM IST";
    } else if (isHoliday) {
      reason = `Market is CLOSED today on account of ${holidayName} per the Indian Stock Market holiday calendar.`;
      nextSession = "Opens next business day at 09:15 AM IST";
    } else if (totalMinutes < openMinutes) {
      reason = `Market opens today at 09:15 AM IST. Trading is only permitted during official market hours (09:15 AM to 03:30 PM IST).`;
      nextSession = "Opens today at 09:15 AM IST";
    } else if (totalMinutes >= closeMinutes) {
      reason = `Market is CLOSED for today. Trading hours are 09:15 AM to 03:30 PM IST.`;
      nextSession = (day === 5) ? "Opens Monday at 09:15 AM IST" : "Opens tomorrow at 09:15 AM IST";
    }

    const timeFormatted = ist.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return {
      isOpen,
      statusText: isOpen ? "MARKET OPEN" : "MARKET CLOSED",
      message: isOpen ? `Market Live (Closes 03:30 PM IST) • IST: ${timeFormatted}` : `Market Closed (${nextSession})`,
      istTime: timeFormatted,
      nextSession,
      isWeekday,
      dayName,
      holidayName,
      reason
    };
  }

  start() {
    this.checkMarketAndTick();

    // Check market state every second
    if (!this.statusTimer) {
      this.statusTimer = setInterval(() => {
        this.checkMarketAndTick();
      }, 1000);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  checkMarketAndTick() {
    const status = this.getMarketStatus();
    this.notifyStatusListeners(status);

    if (status.isOpen && this.store) {
      // Execute any pending AMO orders when market is active
      this.store.executeAllPendingAMOOrders();
    }

    // Continuous live market price updates at all times (every 1.5s)
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.tick();
      }, 1500);
    }
  }

  setForceOpen(force) {
    this.forceOpenSimulation = !!force;
    const status = this.getMarketStatus();
    this.notifyStatusListeners(status);
    this.checkMarketAndTick();
  }

  onTick(callback) {
    if (typeof callback === "function") {
      this.listeners.push(callback);
    }
  }

  onStatusChange(callback) {
    if (typeof callback === "function") {
      this.statusListeners.push(callback);
      callback(this.getMarketStatus());
    }
  }

  notifyStatusListeners(status) {
    this.statusListeners.forEach(cb => {
      try { cb(status); } catch (e) {}
    });
  }

  // Continuous live tick execution (updates market prices every 1.5s)
  tick() {
    const updatedStocks = [];
    const updatedIndices = [];

    const underlyingKeys = ALL_UNDERLYINGS.map(u => u.symbol);
    const tickCount = Math.floor(Math.random() * 4) + 2;
    const pickedIndices = new Set();
    while (pickedIndices.size < Math.min(tickCount, underlyingKeys.length)) {
      pickedIndices.add(Math.floor(Math.random() * underlyingKeys.length));
    }

    // Always include symbols of any open positions so user sees active trades update in real-time
    if (this.store && Array.isArray(this.store.positions)) {
      this.store.positions.forEach(p => {
        if (p.status === "OPEN") {
          const underlyingSym = p.underlying || p.symbol;
          const idx = underlyingKeys.indexOf(underlyingSym);
          if (idx !== -1) pickedIndices.add(idx);
        }
      });
    }

    pickedIndices.forEach(idx => {
      const sym = underlyingKeys[idx];
      const item = this.stocksMap.get(sym);
      if (!item) return;

      const previousPrice = item.price;
      const steps = Math.floor(Math.random() * 5) - 2;
      const stepMultiplier = item.price > 10000 ? 5.0 : item.price > 1000 ? 0.5 : 0.05;
      const delta = +(steps * stepMultiplier).toFixed(2);

      let newPrice = +(item.price + delta).toFixed(2);
      if (item.upperCircuit && newPrice > item.upperCircuit) newPrice = item.upperCircuit;
      if (item.lowerCircuit && newPrice < item.lowerCircuit) newPrice = item.lowerCircuit;

      if (newPrice !== previousPrice) {
        const priceChange = +(newPrice - previousPrice).toFixed(2);
        item.price = newPrice;
        item.change = +(item.price - item.prevClose).toFixed(2);
        item.pChange = +((item.change / item.prevClose) * 100).toFixed(2);
        item.high = Math.max(item.high || newPrice, newPrice);
        item.low = Math.min(item.low || newPrice, newPrice);
        item.lastTickDirection = newPrice > previousPrice ? "up" : "down";
        item.depth = generateMarketDepth(newPrice);

        if (item.candles && item.candles.length > 0) {
          const lastCandle = item.candles[item.candles.length - 1];
          lastCandle.close = newPrice;
          lastCandle.high = Math.max(lastCandle.high, newPrice);
          lastCandle.low = Math.min(lastCandle.low, newPrice);
        }

        updatedStocks.push(item);
        if (item.isIndex) updatedIndices.push(item);

        this.checkPendingOrders(item);
        this.updateRelatedOptions(item, priceChange, updatedStocks);
      }
    });

    this.notifySubscribers({
      updatedStocks,
      updatedIndices,
      allStocks: this.stocksMap,
      indices: this.indices
    });
  }

  updateRelatedOptions(underlying, underlyingPriceDelta, updatedStocks) {
    const options = Array.from(this.stocksMap.values()).filter(
      s => s.isOption && s.underlyingSymbol === underlying.symbol
    );

    options.forEach(opt => {
      const prevOptPrice = opt.price;
      const isCall = opt.optionType === "CE";
      
      const diffPct = (underlying.price - opt.strike) / (underlying.strikeStep || 50);
      let optionDelta = isCall ? (0.5 + diffPct * 0.1) : (0.5 - diffPct * 0.1);
      optionDelta = Math.min(0.95, Math.max(0.05, optionDelta));

      let optChange = isCall
        ? +(underlyingPriceDelta * optionDelta).toFixed(2)
        : +(-underlyingPriceDelta * optionDelta).toFixed(2);

      const noise = (Math.random() - 0.5) * 0.1;
      let newOptPrice = Math.max(0.05, +(opt.price + optChange + noise).toFixed(2));
      newOptPrice = +(Math.round(newOptPrice * 20) / 20).toFixed(2);

      if (newOptPrice !== prevOptPrice) {
        opt.price = newOptPrice;
        opt.change = +(opt.price - opt.prevClose).toFixed(2);
        opt.pChange = +((opt.change / opt.prevClose) * 100).toFixed(2);
        opt.lastTickDirection = newOptPrice > prevOptPrice ? "up" : "down";
        opt.depth = generateMarketDepth(newOptPrice);

        if (opt.candles && opt.candles.length > 0) {
          const last = opt.candles[opt.candles.length - 1];
          last.close = newOptPrice;
        }

        updatedStocks.push(opt);
        this.checkPendingOrders(opt);
      }
    });
  }

  checkPendingOrders(stock) {
    const pendingOrders = this.store.orders.filter(o => o.symbol === stock.symbol && (o.status === "OPEN" || o.status === "AMO PENDING"));

    pendingOrders.forEach(order => {
      let shouldExecute = false;
      if (order.orderType === "MARKET" || order.status === "AMO PENDING") {
        shouldExecute = true;
      } else if (order.side === "BUY" && stock.price <= order.price) {
        shouldExecute = true;
      } else if (order.side === "SELL" && stock.price >= order.price) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        order.status = "COMPLETE";
        order.statusMessage = `Triggered & Executed at ₹${stock.price.toFixed(2)}`;
        order.price = stock.price;

        this.store.processExecution(order);
        this.store.saveAll();

        if (window.showToast) {
          window.showToast(`Order Executed: ${order.side} ${order.quantity} ${order.symbol} @ ₹${stock.price.toFixed(2)}`, "success");
        }
        if (window.playChime) {
          window.playChime();
        }
      }
    });
  }

  notifySubscribers(data) {
    this.listeners.forEach(cb => {
      try { cb(data); } catch (e) {}
    });
  }
}

const engine = new MarketEngine(STOCKS_MAP, INITIAL_INDICES, store);
