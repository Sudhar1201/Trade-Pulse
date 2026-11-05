// TradePulse High-Performance Canvas Interactive Chart
// Supports Candlestick, Line, Crosshair Inspection, Volume, and Live Tick Updates

class StockChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.stock = null;
    this.chartType = "candle"; // "candle" or "line"
    this.timeframe = "1D";
    this.candles = [];
    this.mousePos = null;

    this.initEvents();
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const width = rect.width || 600;
    const height = Math.max(340, rect.height || 340);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;
    this.render();
  }

  setStock(stock, timeframe = "1D") {
    this.stock = stock;
    this.timeframe = timeframe;
    this.candles = stock && stock.candles ? [...stock.candles] : [];
    this.render();
  }

  setChartType(type) {
    this.chartType = type;
    this.render();
  }

  initEvents() {
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      this.render();
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.mousePos = null;
      this.render();
    });
  }

  render() {
    if (!this.ctx || !this.stock || this.candles.length === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Chart margins
    const margin = { top: 25, right: 65, bottom: 35, left: 15 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;

    // Detect theme
    const isDark = document.body.classList.contains("dark-mode");
    const bgColor = isDark ? "#121212" : "#ffffff";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0";
    const textColor = isDark ? "#888888" : "#999999";
    const greenColor = "#00b074";
    const redColor = "#eb5757";

    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Calculate Min & Max Price
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    this.candles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVolume) maxVolume = c.volume;
    });

    // Add padding to range
    const pricePadding = (maxPrice - minPrice) * 0.08 || 2;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice;

    // Helper to map price to Y
    const getY = (price) => margin.top + chartH - ((price - minPrice) / priceRange) * chartH;
    // Helper to map candle index to X
    const candleCount = this.candles.length;
    const candleGap = chartW / candleCount;
    const candleWidth = Math.max(3, candleGap * 0.65);
    const getX = (index) => margin.left + (index + 0.5) * candleGap;

    // Draw horizontal grid lines & Price Labels
    const gridRows = 5;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";

    for (let i = 0; i <= gridRows; i++) {
      const y = margin.top + (chartH / gridRows) * i;
      const priceVal = maxPrice - (priceRange / gridRows) * i;

      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();

      ctx.fillText(priceVal.toFixed(2), w - margin.right + 8, y + 3);
    }

    // Draw Volume Bars in lower 25% of chart
    const volHeight = chartH * 0.22;
    this.candles.forEach((c, i) => {
      const x = getX(i);
      const isUp = c.close >= c.open;
      const barH = (c.volume / (maxVolume || 1)) * volHeight;
      const y = margin.top + chartH - barH;

      ctx.fillStyle = isUp ? "rgba(0, 176, 116, 0.2)" : "rgba(235, 87, 87, 0.2)";
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, barH);
    });

    // Draw Candlesticks or Line
    if (this.chartType === "candle") {
      this.candles.forEach((c, i) => {
        const x = getX(i);
        const isUp = c.close >= c.open;
        const color = isUp ? greenColor : redColor;

        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);

        // Draw Wick
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Draw Body
        ctx.fillStyle = color;
        const bodyTop = Math.min(openY, closeY);
        const bodyH = Math.max(1.5, Math.abs(closeY - openY));
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyH);
      });
    } else {
      // Line Chart with gradient fill
      ctx.beginPath();
      this.candles.forEach((c, i) => {
        const x = getX(i);
        const y = getY(c.close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#4184f3";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Area gradient
      ctx.lineTo(getX(this.candles.length - 1), margin.top + chartH);
      ctx.lineTo(getX(0), margin.top + chartH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartH);
      grad.addColorStop(0, "rgba(65, 132, 243, 0.25)");
      grad.addColorStop(1, "rgba(65, 132, 243, 0.0)");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw Current Price Line
    const curY = getY(this.stock.price);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = this.stock.change >= 0 ? greenColor : redColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, curY);
    ctx.lineTo(w - margin.right, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price badge on the right
    ctx.fillStyle = this.stock.change >= 0 ? greenColor : redColor;
    ctx.fillRect(w - margin.right, curY - 10, margin.right - 5, 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.stock.price.toFixed(2), w - (margin.right / 2), curY + 3.5);

    // Crosshair inspection if mouse is over chart
    if (this.mousePos && this.mousePos.x >= margin.left && this.mousePos.x <= w - margin.right) {
      const idx = Math.min(candleCount - 1, Math.max(0, Math.floor((this.mousePos.x - margin.left) / candleGap)));
      const candle = this.candles[idx];
      const candleX = getX(idx);

      // Vertical line
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(candleX, margin.top);
      ctx.lineTo(candleX, margin.top + chartH);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(margin.left, this.mousePos.y);
      ctx.lineTo(w - margin.right, this.mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top info bar: O, H, L, C, Vol
      if (candle) {
        ctx.textAlign = "left";
        ctx.font = "11px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
        const isUp = candle.close >= candle.open;
        ctx.fillStyle = textColor;
        ctx.fillText(`O: `, margin.left + 5, margin.top - 8);
        ctx.fillStyle = isUp ? greenColor : redColor;
        ctx.fillText(`${candle.open.toFixed(2)}  `, margin.left + 22, margin.top - 8);

        ctx.fillStyle = textColor;
        ctx.fillText(`H: `, margin.left + 80, margin.top - 8);
        ctx.fillStyle = isUp ? greenColor : redColor;
        ctx.fillText(`${candle.high.toFixed(2)}  `, margin.left + 98, margin.top - 8);

        ctx.fillStyle = textColor;
        ctx.fillText(`L: `, margin.left + 155, margin.top - 8);
        ctx.fillStyle = isUp ? greenColor : redColor;
        ctx.fillText(`${candle.low.toFixed(2)}  `, margin.left + 172, margin.top - 8);

        ctx.fillStyle = textColor;
        ctx.fillText(`C: `, margin.left + 230, margin.top - 8);
        ctx.fillStyle = isUp ? greenColor : redColor;
        ctx.fillText(`${candle.close.toFixed(2)}  `, margin.left + 248, margin.top - 8);

        ctx.fillStyle = textColor;
        ctx.fillText(`Vol: ${(candle.volume).toLocaleString()}`, margin.left + 315, margin.top - 8);
      }
    }
  }
}
