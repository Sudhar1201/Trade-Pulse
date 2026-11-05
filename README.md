# ⚡ TradePulse — India's Premier Paper Trading Terminal & Market Simulator

> **An Institutional-Grade Market Simulator** adhering strictly to **official Indian NSE/BSE trading hours (Monday to Friday, 09:15 AM to 03:30 PM IST)**. Outside market hours and on weekends, price fluctuations are **100% frozen at the last closing price** until the next day's 09:15 AM session opens. Supports **After-Market Orders (AMO)**, full **Call (CE) & Put (PE) Options Trading**, an interactive **Option Chain**, and instant **₹20,000 demo capital credit**.

---

## ⏰ Indian Market Hours Enforcement (IST: UTC+5:30)

| Session Time | Market Status | Engine Behavior | Order Handling |
| :--- | :--- | :--- | :--- |
| **09:15 AM – 03:30 PM IST** *(Mon–Fri)* | `🟢 MARKET OPEN` | **Live Ticks Active:** Real-time micro-fluctuations, live option premium Greek tracking, and instant limit order triggers. | **Regular Orders:** Instant execution for Market orders; limit triggers active. |
| **03:30 PM – 09:15 AM IST** *(Evenings / Nights)* | `🔴 MARKET CLOSED` | **Prices 100% Frozen:** All stock and index quotes remain static at their official last closing price. | **AMO (After-Market Orders):** Orders queued as `AMO PENDING` to execute at 09:15 AM next session. |
| **Saturday & Sunday** *(Weekends)* | `🔴 MARKET CLOSED` | **Prices 100% Frozen:** Displays `Opens Monday at 09:15 AM IST`. | **AMO (After-Market Orders):** Queued for Monday open. |

---

## 🌟 Rectified Live Market Price Reference (Matching Zerodha Kite)

| Instrument | Exchange | Live Market Price (LTP) | Prev. Close | Day Change |
| :--- | :--- | :--- | :--- | :--- |
| **NIFTY 50** | NSE | **₹24,423.65** | ₹23,960.60 | +463.05 (+1.93%) |
| **NIFTY BANK** | NSE | **₹57,050.25** | ₹55,870.25 | +1,180.00 (+2.11%) |
| **BSE SENSEX** | BSE | **₹78,840.60** | ₹77,320.60 | +1,520.00 (+1.97%) |
| **L&T (Larsen & Toubro)** | NSE | **₹4,018.50** | ₹3,944.40 | +74.10 (+1.88%) |
| **KVB (Karur Vysya Bank)** | NSE | **₹343.90** | ₹336.10 | +7.80 (+2.32%) |
| **RELIANCE** | NSE | **₹1,311.20** | ₹1,298.00 | +13.20 (+1.02%) |
| **TCS** | NSE | **₹2,436.00** | ₹2,499.10 | -63.10 (-2.52%) |
| **HDFCBANK** | NSE | **₹757.20** | ₹745.00 | +12.20 (+1.64%) |
| **ICICIBANK** | NSE | **₹1,455.20** | ₹1,432.00 | +23.20 (+1.62%) |
| **INFY (Infosys)** | NSE | **₹1,165.50** | ₹1,152.00 | +13.50 (+1.17%) |
| **SBIN (State Bank of India)** | NSE | **₹979.00** | ₹965.00 | +14.00 (+1.45%) |
| **TATAMOTORS** | NSE | **₹402.80** | ₹395.00 | +7.80 (+1.97%) |
| **ITC** | NSE | **₹280.00** | ₹276.00 | +4.00 (+1.45%) |
| **BHARTIARTL (Airtel)** | NSE | **₹2,067.60** | ₹2,035.00 | +32.60 (+1.60%) |
| **HAL** | NSE | **₹5,070.00** | ₹4,980.00 | +90.00 (+1.81%) |
| **MARUTI** | NSE | **₹12,450.00** | ₹12,280.00 | +170.00 (+1.38%) |
| **SUNPHARMA** | NSE | **₹1,820.00** | ₹1,770.00 | +50.00 (+2.82%) |
| **ZOMATO (Eternal)** | NSE | **₹355.80** | ₹348.00 | +7.80 (+2.24%) |

---

## 🚀 How to Run the Website

### Option 1: Direct Browser Launch (Immediate)
Simply double-click `index.html` inside `C:\Users\KiTE\.gemini\antigravity\scratch\tradepulse` or open it in any modern browser (Google Chrome, Microsoft Edge, Brave, Firefox, Safari).

### Option 2: Local HTTP Server (Optional)
```bash
cd C:\Users\KiTE\.gemini\antigravity\scratch\tradepulse
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

---

## 📁 Project Architecture

```
tradepulse/
├── index.html            # Main SPA with Market Hours Status & Option Chain Modal
├── README.md             # Complete documentation and live market hours reference
├── css/
│   └── styles.css        # Market Status Pills (Open/Closed), AMO tags & high-contrast UI
└── js/
    ├── data.js           # Rectified live market prices matching Zerodha Kite
    ├── store.js          # Multi-user accounts, ₹20,000 demo capital, and AMO order handling
    ├── engine.js         # Strict IST market hours enforcer (Freezes prices outside 09:15 - 15:30)
    ├── chart.js          # Interactive HTML5 Canvas candlestick & line chart
    └── app.js            # Option Chain renderer, market status listener, and modals
```

A distributable archive has also been updated at:
- `C:\Users\KiTE\.gemini\antigravity\scratch\tradepulse.zip`
