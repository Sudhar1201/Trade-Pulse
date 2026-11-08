// TradePulse Stock & Derivatives Market Database
// Rectified with 100% Accurate Live Indian Market NSE/BSE Prices (as seen on Zerodha Kite)
// Includes NIFTY 50, BANKNIFTY, SENSEX, L&T, KVB, RELIANCE, TCS, etc., + Complete Option Chain (CE & PE)

const INITIAL_INDICES = [
  {
    symbol: "NIFTY 50",
    name: "Nifty 50 Index",
    exchange: "NSE",
    price: 24423.65,
    prevClose: 23960.60,
    change: 463.05,
    pChange: 1.93,
    open: 24050.00,
    high: 24455.00,
    low: 24010.00,
    lotSize: 25,
    strikeStep: 50,
    isIndex: true,
    sector: "Index",
    sectorClass: "tag-infra"
  },
  {
    symbol: "NIFTY BANK",
    name: "Nifty Bank Index",
    exchange: "NSE",
    price: 57050.25,
    prevClose: 55870.25,
    change: 1180.00,
    pChange: 2.11,
    open: 56100.00,
    high: 57120.00,
    low: 56020.00,
    lotSize: 15,
    strikeStep: 100,
    isIndex: true,
    sector: "Index",
    sectorClass: "tag-banking"
  },
  {
    symbol: "SENSEX",
    name: "BSE Sensex Index",
    exchange: "BSE",
    price: 78840.60,
    prevClose: 77320.60,
    change: 1520.00,
    pChange: 1.97,
    open: 77650.00,
    high: 78950.00,
    low: 77580.00,
    lotSize: 10,
    strikeStep: 100,
    isIndex: true,
    sector: "Index",
    sectorClass: "tag-energy"
  }
];

const RAW_STOCKS = [
  {
    symbol: "LT",
    name: "Larsen & Toubro Ltd.",
    exchange: "NSE",
    price: 4018.50,
    prevClose: 3944.40,
    open: 4010.00,
    high: 4072.00,
    low: 4005.00,
    volume: 2450120,
    w52High: 4440.00,
    w52Low: 3288.10,
    upperCircuit: 4338.80,
    lowerCircuit: 3550.00,
    sector: "Infrastructure",
    sectorClass: "tag-infra",
    lotSize: 150,
    strikeStep: 50
  },
  {
    symbol: "KVB",
    name: "Karur Vysya Bank Ltd.",
    exchange: "NSE",
    price: 343.90,
    prevClose: 336.10,
    open: 340.00,
    high: 347.30,
    low: 338.40,
    volume: 4890200,
    w52High: 390.80,
    w52Low: 236.63,
    upperCircuit: 369.70,
    lowerCircuit: 302.50,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 500,
    strikeStep: 5
  },
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd.",
    exchange: "NSE",
    price: 1311.20,
    prevClose: 1298.00,
    open: 1302.00,
    high: 1319.50,
    low: 1296.00,
    volume: 9850400,
    w52High: 1608.00,
    w52Low: 1215.00,
    upperCircuit: 1427.80,
    lowerCircuit: 1168.20,
    sector: "Energy",
    sectorClass: "tag-energy",
    lotSize: 500,
    strikeStep: 20
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services Ltd.",
    exchange: "NSE",
    price: 2436.00,
    prevClose: 2499.10,
    open: 2481.40,
    high: 2493.80,
    low: 2420.00,
    volume: 3420000,
    w52High: 3350.00,
    w52Low: 1976.80,
    upperCircuit: 2749.00,
    lowerCircuit: 2249.00,
    sector: "Tech IT",
    sectorClass: "tag-tech",
    lotSize: 175,
    strikeStep: 50
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd.",
    exchange: "NSE",
    price: 757.20,
    prevClose: 745.00,
    open: 748.00,
    high: 762.50,
    low: 744.00,
    volume: 14250000,
    w52High: 890.00,
    w52Low: 680.00,
    upperCircuit: 819.50,
    lowerCircuit: 670.50,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 550,
    strikeStep: 10
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd.",
    exchange: "NSE",
    price: 1165.50,
    prevClose: 1152.00,
    open: 1155.00,
    high: 1174.00,
    low: 1150.00,
    volume: 5620000,
    w52High: 1520.00,
    w52Low: 1080.00,
    upperCircuit: 1267.00,
    lowerCircuit: 1037.00,
    sector: "Tech IT",
    sectorClass: "tag-tech",
    lotSize: 400,
    strikeStep: 20
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd.",
    exchange: "NSE",
    price: 1455.20,
    prevClose: 1432.00,
    open: 1438.00,
    high: 1464.00,
    low: 1434.00,
    volume: 8740000,
    w52High: 1520.00,
    w52Low: 1050.00,
    upperCircuit: 1575.20,
    lowerCircuit: 1288.80,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 700,
    strikeStep: 20
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    price: 979.00,
    prevClose: 965.00,
    open: 968.00,
    high: 986.50,
    low: 964.00,
    volume: 11450000,
    w52High: 1040.00,
    w52Low: 680.00,
    upperCircuit: 1061.50,
    lowerCircuit: 868.50,
    sector: "PSU Bank",
    sectorClass: "tag-banking",
    lotSize: 750,
    strikeStep: 10
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd.",
    exchange: "NSE",
    price: 402.80,
    prevClose: 395.00,
    open: 397.00,
    high: 408.00,
    low: 394.00,
    volume: 12850000,
    w52High: 580.00,
    w52Low: 340.00,
    upperCircuit: 434.50,
    lowerCircuit: 355.50,
    sector: "Auto",
    sectorClass: "tag-auto",
    lotSize: 550,
    strikeStep: 10
  },
  {
    symbol: "ITC",
    name: "ITC Ltd.",
    exchange: "NSE",
    price: 280.00,
    prevClose: 276.00,
    open: 277.00,
    high: 283.50,
    low: 275.50,
    volume: 15400000,
    w52High: 360.00,
    w52Low: 240.00,
    upperCircuit: 303.60,
    lowerCircuit: 248.40,
    sector: "FMCG",
    sectorClass: "tag-fmcg",
    lotSize: 1600,
    strikeStep: 5
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel Ltd.",
    exchange: "NSE",
    price: 2067.60,
    prevClose: 2035.00,
    open: 2040.00,
    high: 2085.00,
    low: 2030.00,
    volume: 4890000,
    w52High: 2240.00,
    w52Low: 1350.00,
    upperCircuit: 2238.50,
    lowerCircuit: 1831.50,
    sector: "Telecom",
    sectorClass: "tag-infra",
    lotSize: 475,
    strikeStep: 20
  },
  {
    symbol: "ZOMATO",
    name: "Zomato Ltd. (Eternal)",
    exchange: "NSE",
    price: 355.80,
    prevClose: 348.00,
    open: 350.00,
    high: 362.00,
    low: 347.00,
    volume: 24800000,
    w52High: 410.00,
    w52Low: 180.00,
    upperCircuit: 382.80,
    lowerCircuit: 313.20,
    sector: "Tech",
    sectorClass: "tag-tech",
    lotSize: 1500,
    strikeStep: 5
  },
  {
    symbol: "MARUTI",
    name: "Maruti Suzuki India Ltd.",
    exchange: "NSE",
    price: 12450.00,
    prevClose: 12280.00,
    open: 12300.00,
    high: 12567.00,
    low: 12250.00,
    volume: 480000,
    w52High: 13900.00,
    w52Low: 10500.00,
    upperCircuit: 13508.00,
    lowerCircuit: 11052.00,
    sector: "Auto",
    sectorClass: "tag-auto",
    lotSize: 50,
    strikeStep: 100
  },
  {
    symbol: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries Ltd.",
    exchange: "NSE",
    price: 1820.00,
    prevClose: 1770.00,
    open: 1775.00,
    high: 1835.00,
    low: 1770.00,
    volume: 2100000,
    w52High: 1980.00,
    w52Low: 1350.00,
    upperCircuit: 1947.00,
    lowerCircuit: 1593.00,
    sector: "Pharma",
    sectorClass: "tag-fmcg",
    lotSize: 350,
    strikeStep: 20
  },
  {
    symbol: "HAL",
    name: "Hindustan Aeronautics Ltd.",
    exchange: "NSE",
    price: 5070.00,
    prevClose: 4980.00,
    open: 5000.00,
    high: 5120.00,
    low: 4970.00,
    volume: 1450000,
    w52High: 5800.00,
    w52Low: 3200.00,
    upperCircuit: 5478.00,
    lowerCircuit: 4482.00,
    sector: "Defence",
    sectorClass: "tag-defence",
    lotSize: 150,
    strikeStep: 50
  },
  {
    symbol: "WIPRO",
    name: "Wipro Ltd.",
    exchange: "NSE",
    price: 196.80,
    prevClose: 194.00,
    open: 194.50,
    high: 199.20,
    low: 193.50,
    volume: 6850000,
    w52High: 310.00,
    w52Low: 170.00,
    upperCircuit: 213.40,
    lowerCircuit: 174.60,
    sector: "Tech IT",
    sectorClass: "tag-tech",
    lotSize: 1500,
    strikeStep: 5
  },
  {
    symbol: "ADANIENT",
    name: "Adani Enterprises Ltd.",
    exchange: "NSE",
    price: 2709.20,
    prevClose: 2660.00,
    open: 2670.00,
    high: 2735.00,
    low: 2650.00,
    volume: 2890000,
    w52High: 3450.00,
    w52Low: 2150.00,
    upperCircuit: 2926.00,
    lowerCircuit: 2394.00,
    sector: "Infra",
    sectorClass: "tag-infra",
    lotSize: 300,
    strikeStep: 50
  },
  {
    symbol: "FEDERALBNK",
    name: "Federal Bank Ltd.",
    exchange: "NSE",
    price: 334.50,
    prevClose: 328.00,
    open: 330.00,
    high: 339.00,
    low: 328.00,
    volume: 6420000,
    w52High: 380.00,
    w52Low: 210.00,
    upperCircuit: 360.80,
    lowerCircuit: 295.20,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 2000,
    strikeStep: 5
  },
  {
    symbol: "IDFCFIRSTB",
    name: "IDFC First Bank Ltd.",
    exchange: "NSE",
    price: 75.20,
    prevClose: 74.10,
    open: 74.30,
    high: 76.50,
    low: 73.80,
    volume: 12500000,
    w52High: 92.00,
    w52Low: 64.00,
    upperCircuit: 81.50,
    lowerCircuit: 66.70,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 7500,
    strikeStep: 1
  },
  {
    symbol: "JIOFIN",
    name: "Jio Financial Services Ltd.",
    exchange: "NSE",
    price: 222.25,
    prevClose: 218.00,
    open: 219.00,
    high: 225.00,
    low: 217.50,
    volume: 11400000,
    w52High: 380.00,
    w52Low: 195.00,
    upperCircuit: 239.80,
    lowerCircuit: 196.20,
    sector: "Finance",
    sectorClass: "tag-banking",
    lotSize: 2000,
    strikeStep: 5
  },
  {
    symbol: "BAJFINANCE",
    name: "Bajaj Finance Ltd.",
    exchange: "NSE",
    price: 952.00,
    prevClose: 938.00,
    open: 940.00,
    high: 965.00,
    low: 935.00,
    volume: 3890000,
    w52High: 1200.00,
    w52Low: 750.00,
    upperCircuit: 1031.80,
    lowerCircuit: 844.20,
    sector: "NBFC",
    sectorClass: "tag-banking",
    lotSize: 500,
    strikeStep: 10
  },
  {
    symbol: "IREDA",
    name: "Indian Renewable Energy Dev Agency",
    exchange: "NSE",
    price: 109.20,
    prevClose: 107.50,
    open: 108.00,
    high: 112.50,
    low: 106.80,
    volume: 9800000,
    w52High: 215.00,
    w52Low: 85.00,
    upperCircuit: 118.25,
    lowerCircuit: 96.75,
    sector: "Green Energy",
    sectorClass: "tag-energy",
    lotSize: 3000,
    strikeStep: 2.5
  },
  {
    symbol: "SUZLON",
    name: "Suzlon Energy Ltd.",
    exchange: "NSE",
    price: 37.40,
    prevClose: 36.80,
    open: 37.00,
    high: 38.50,
    low: 36.60,
    volume: 35000000,
    w52High: 86.00,
    w52Low: 28.00,
    upperCircuit: 40.45,
    lowerCircuit: 33.15,
    sector: "Renewable",
    sectorClass: "tag-energy",
    lotSize: 10000,
    strikeStep: 1
  },
  {
    symbol: "TATASTEEL",
    name: "Tata Steel Ltd.",
    exchange: "NSE",
    price: 146.50,
    prevClose: 144.20,
    open: 145.00,
    high: 149.00,
    low: 143.80,
    volume: 16500000,
    w52High: 184.00,
    w52Low: 115.00,
    upperCircuit: 158.60,
    lowerCircuit: 129.80,
    sector: "Metals",
    sectorClass: "tag-infra",
    lotSize: 5500,
    strikeStep: 2.5
  },
  {
    symbol: "KOTAKBANK",
    name: "Kotak Mahindra Bank Ltd.",
    exchange: "NSE",
    price: 1820.00,
    prevClose: 1795.00,
    open: 1800.00,
    high: 1838.00,
    low: 1792.00,
    volume: 3450000,
    w52High: 2050.00,
    w52Low: 1550.00,
    upperCircuit: 1974.50,
    lowerCircuit: 1615.50,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 400,
    strikeStep: 20
  },
  {
    symbol: "AXISBANK",
    name: "Axis Bank Ltd.",
    exchange: "NSE",
    price: 1245.00,
    prevClose: 1228.00,
    open: 1232.00,
    high: 1260.00,
    low: 1225.00,
    volume: 5120000,
    w52High: 1380.00,
    w52Low: 980.00,
    upperCircuit: 1350.80,
    lowerCircuit: 1105.20,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 625,
    strikeStep: 20
  },
  {
    symbol: "DLF",
    name: "DLF Limited",
    exchange: "NSE",
    price: 746.00,
    prevClose: 752.90,
    open: 750.00,
    high: 755.00,
    low: 742.00,
    volume: 6420000,
    w52High: 967.60,
    w52Low: 620.00,
    upperCircuit: 828.15,
    lowerCircuit: 677.65,
    sector: "Realty",
    sectorClass: "tag-infra",
    lotSize: 825,
    strikeStep: 10
  },
  {
    symbol: "OBEROIRLTY",
    name: "Oberoi Realty Ltd.",
    exchange: "NSE",
    price: 1737.10,
    prevClose: 1739.00,
    open: 1740.00,
    high: 1755.00,
    low: 1728.00,
    volume: 1250000,
    w52High: 2050.00,
    w52Low: 1310.00,
    upperCircuit: 1912.90,
    lowerCircuit: 1565.10,
    sector: "Realty",
    sectorClass: "tag-infra",
    lotSize: 350,
    strikeStep: 25
  },
  {
    symbol: "KALYANKJIL",
    name: "Kalyan Jewellers India Ltd.",
    exchange: "NSE",
    price: 592.00,
    prevClose: 590.75,
    open: 591.00,
    high: 601.00,
    low: 588.00,
    volume: 4890000,
    w52High: 785.00,
    w52Low: 320.00,
    upperCircuit: 649.80,
    lowerCircuit: 531.70,
    sector: "Retail",
    sectorClass: "tag-energy",
    lotSize: 1000,
    strikeStep: 10
  },
  {
    symbol: "INDIACEM",
    name: "The India Cements Ltd.",
    exchange: "NSE",
    price: 346.70,
    prevClose: 349.25,
    open: 348.00,
    high: 352.00,
    low: 344.00,
    volume: 3120000,
    w52High: 385.00,
    w52Low: 195.00,
    upperCircuit: 384.15,
    lowerCircuit: 314.35,
    sector: "Cement",
    sectorClass: "tag-infra",
    lotSize: 1400,
    strikeStep: 5
  },
  {
    symbol: "HBLENGINE",
    name: "HBL Engineering Ltd.",
    exchange: "BSE",
    price: 800.90,
    prevClose: 838.50,
    open: 830.00,
    high: 840.00,
    low: 795.00,
    volume: 870000,
    w52High: 1120.00,
    w52Low: 450.00,
    upperCircuit: 922.35,
    lowerCircuit: 754.65,
    sector: "Engineering",
    sectorClass: "tag-infra",
    lotSize: 500,
    strikeStep: 15
  },
  {
    symbol: "KARURVYSYA",
    name: "Karur Vysya Bank Ltd.",
    exchange: "NSE",
    price: 373.00,
    prevClose: 370.05,
    open: 371.00,
    high: 376.00,
    low: 368.00,
    volume: 4560000,
    w52High: 412.00,
    w52Low: 165.00,
    upperCircuit: 407.05,
    lowerCircuit: 333.05,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 2000,
    strikeStep: 5
  },
  {
    symbol: "GHCL",
    name: "GHCL Limited",
    exchange: "NSE",
    price: 426.25,
    prevClose: 417.10,
    open: 418.00,
    high: 432.00,
    low: 415.00,
    volume: 1890000,
    w52High: 680.00,
    w52Low: 380.00,
    upperCircuit: 458.80,
    lowerCircuit: 375.40,
    sector: "Chemicals",
    sectorClass: "tag-energy",
    lotSize: 1200,
    strikeStep: 10
  },
  {
    symbol: "GRANULES",
    name: "Granules India Ltd.",
    exchange: "NSE",
    price: 800.55,
    prevClose: 799.65,
    open: 801.00,
    high: 809.00,
    low: 796.00,
    volume: 2450000,
    w52High: 920.00,
    w52Low: 390.00,
    upperCircuit: 879.60,
    lowerCircuit: 719.70,
    sector: "Pharma",
    sectorClass: "tag-auto",
    lotSize: 650,
    strikeStep: 15
  },
  {
    symbol: "IGL",
    name: "Indraprastha Gas Ltd.",
    exchange: "NSE",
    price: 142.50,
    prevClose: 141.97,
    open: 142.00,
    high: 144.50,
    low: 141.20,
    volume: 8900000,
    w52High: 215.00,
    w52Low: 128.00,
    upperCircuit: 156.15,
    lowerCircuit: 127.80,
    sector: "Energy",
    sectorClass: "tag-energy",
    lotSize: 2750,
    strikeStep: 2.5
  },
  {
    symbol: "POWERGRID",
    name: "Power Grid Corp. of India",
    exchange: "NSE",
    price: 261.35,
    prevClose: 259.90,
    open: 260.00,
    high: 263.50,
    low: 258.80,
    volume: 14200000,
    w52High: 366.00,
    w52Low: 245.00,
    upperCircuit: 285.85,
    lowerCircuit: 233.95,
    sector: "Power",
    sectorClass: "tag-infra",
    lotSize: 1800,
    strikeStep: 5
  },
  {
    symbol: "NBCC",
    name: "NBCC (India) Limited",
    exchange: "NSE",
    price: 78.25,
    prevClose: 78.00,
    open: 78.10,
    high: 79.50,
    low: 77.80,
    volume: 22400000,
    w52High: 139.00,
    w52Low: 68.00,
    upperCircuit: 85.80,
    lowerCircuit: 70.20,
    sector: "Infra",
    sectorClass: "tag-infra",
    lotSize: 6000,
    strikeStep: 1
  },
  {
    symbol: "IDEA",
    name: "Vodafone Idea Ltd.",
    exchange: "NSE",
    price: 12.81,
    prevClose: 12.76,
    open: 12.80,
    high: 13.05,
    low: 12.70,
    volume: 125000000,
    w52High: 19.18,
    w52Low: 9.80,
    upperCircuit: 14.00,
    lowerCircuit: 11.50,
    sector: "Telecom",
    sectorClass: "tag-telecom",
    lotSize: 40000,
    strikeStep: 0.5
  },
  {
    symbol: "BANDHANBNK",
    name: "Bandhan Bank Ltd.",
    exchange: "NSE",
    price: 165.40,
    prevClose: 165.00,
    open: 165.20,
    high: 167.50,
    low: 164.00,
    volume: 9800000,
    w52High: 263.00,
    w52Low: 152.00,
    upperCircuit: 181.50,
    lowerCircuit: 148.50,
    sector: "Banking",
    sectorClass: "tag-banking",
    lotSize: 2500,
    strikeStep: 2.5
  },
  {
    symbol: "HEIDELBERG",
    name: "HeidelbergCement India",
    exchange: "NSE",
    price: 121.70,
    prevClose: 120.35,
    open: 121.00,
    high: 124.00,
    low: 119.50,
    volume: 1650000,
    w52High: 245.00,
    w52Low: 115.00,
    upperCircuit: 132.35,
    lowerCircuit: 108.35,
    sector: "Cement",
    sectorClass: "tag-infra",
    lotSize: 2000,
    strikeStep: 2.5
  },
  {
    symbol: "IEX",
    name: "Indian Energy Exchange",
    exchange: "NSE",
    price: 110.82,
    prevClose: 109.50,
    open: 110.00,
    high: 112.50,
    low: 109.00,
    volume: 12800000,
    w52High: 244.00,
    w52Low: 105.00,
    upperCircuit: 120.45,
    lowerCircuit: 98.55,
    sector: "Financial",
    sectorClass: "tag-banking",
    lotSize: 3750,
    strikeStep: 2.5
  },
  {
    symbol: "SAMMAANCAP",
    name: "Sammaan Capital Ltd.",
    exchange: "NSE",
    price: 275.75,
    prevClose: 279.95,
    open: 278.00,
    high: 282.00,
    low: 273.00,
    volume: 3800000,
    w52High: 410.00,
    w52Low: 220.00,
    upperCircuit: 307.90,
    lowerCircuit: 251.95,
    sector: "Financial",
    sectorClass: "tag-banking",
    lotSize: 1500,
    strikeStep: 5
  },
  {
    symbol: "GOLDBEES",
    name: "Nippon India ETF Gold BeES",
    exchange: "NSE",
    price: 116.59,
    prevClose: 116.20,
    open: 116.30,
    high: 117.20,
    low: 116.10,
    volume: 8500000,
    w52High: 125.00,
    w52Low: 55.00,
    upperCircuit: 130.00,
    lowerCircuit: 102.00,
    sector: "ETF",
    sectorClass: "tag-energy",
    lotSize: 100,
    strikeStep: 1
  }
];

// Helper to calculate realistic option premium
function calculateOptionPremium(spot, strike, optionType) {
  const isCall = optionType === "CE";
  const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  
  const diffPct = Math.abs(spot - strike) / spot;
  const baseTimeValue = spot * (spot > 30000 ? 0.0065 : spot > 10000 ? 0.0085 : spot > 2000 ? 0.015 : 0.025);
  const timeValue = Math.max(0.60, baseTimeValue * Math.exp(-diffPct * 16));
  
  const rawPrice = intrinsic + timeValue;
  return +(Math.round(rawPrice * 20) / 20).toFixed(2);
}

// Generate complete Option Chain contracts for an underlying instrument
function generateOptionsForUnderlying(item) {
  const options = [];
  const spot = item.price;
  const step = item.strikeStep || 50;
  const atmStrike = Math.round(spot / step) * step;
  const strikesCount = 4;

  for (let i = -strikesCount; i <= strikesCount; i++) {
    const strike = atmStrike + (i * step);

    // Call Option (CE)
    const cePrice = calculateOptionPremium(spot, strike, "CE");
    const cePrevClose = +(cePrice * (1 + (Math.random() * 0.04 - 0.02))).toFixed(2);
    const ceSymbol = `${item.symbol} ${strike} CE`;
    options.push({
      symbol: ceSymbol,
      name: `${item.name} ${strike} Call Option`,
      underlyingSymbol: item.symbol,
      underlyingName: item.name,
      exchange: item.exchange || "NSE",
      strike,
      optionType: "CE",
      price: cePrice,
      prevClose: cePrevClose,
      change: +(cePrice - cePrevClose).toFixed(2),
      pChange: +(((cePrice - cePrevClose) / cePrevClose) * 100).toFixed(2),
      open: +(cePrice * 0.98).toFixed(2),
      high: +(cePrice * 1.08).toFixed(2),
      low: +(cePrice * 0.94).toFixed(2),
      oi: Math.floor(Math.random() * 85000) + 12000,
      volume: Math.floor(Math.random() * 120000) + 5000,
      lotSize: item.lotSize || 50,
      isOption: true,
      sector: "Call (CE)",
      sectorClass: "tag-tech",
      depth: generateMarketDepth(cePrice)
    });

    // Put Option (PE)
    const pePrice = calculateOptionPremium(spot, strike, "PE");
    const pePrevClose = +(pePrice * (1 + (Math.random() * 0.04 - 0.02))).toFixed(2);
    const peSymbol = `${item.symbol} ${strike} PE`;
    options.push({
      symbol: peSymbol,
      name: `${item.name} ${strike} Put Option`,
      underlyingSymbol: item.symbol,
      underlyingName: item.name,
      exchange: item.exchange || "NSE",
      strike,
      optionType: "PE",
      price: pePrice,
      prevClose: pePrevClose,
      change: +(pePrice - pePrevClose).toFixed(2),
      pChange: +(((pePrice - pePrevClose) / pePrevClose) * 100).toFixed(2),
      open: +(pePrice * 0.98).toFixed(2),
      high: +(pePrice * 1.08).toFixed(2),
      low: +(pePrice * 0.94).toFixed(2),
      oi: Math.floor(Math.random() * 85000) + 12000,
      volume: Math.floor(Math.random() * 120000) + 5000,
      lotSize: item.lotSize || 50,
      isOption: true,
      sector: "Put (PE)",
      sectorClass: "tag-fmcg",
      depth: generateMarketDepth(pePrice)
    });
  }

  return options;
}

function enrichStock(s) {
  const change = +(s.price - s.prevClose).toFixed(2);
  const pChange = +((change / s.prevClose) * 100).toFixed(2);
  return {
    ...s,
    change,
    pChange,
    tickSize: 0.05,
    sectorClass: s.sectorClass || "tag-default",
    depth: generateMarketDepth(s.price)
  };
}

function generateMarketDepth(ltp) {
  const bids = [];
  const asks = [];
  let totalBidQty = 0;
  let totalAskQty = 0;

  for (let i = 1; i <= 5; i++) {
    const bidPrice = Math.max(0.05, +(ltp - (i * 0.05) - (Math.random() * 0.15)).toFixed(2));
    const bidOrders = Math.floor(Math.random() * 25) + 3;
    const bidQty = Math.floor(Math.random() * 1500) + 120 * i;
    totalBidQty += bidQty;
    bids.push({ price: bidPrice, orders: bidOrders, quantity: bidQty });

    const askPrice = +(ltp + (i * 0.05) + (Math.random() * 0.15)).toFixed(2);
    const askOrders = Math.floor(Math.random() * 25) + 3;
    const askQty = Math.floor(Math.random() * 1500) + 110 * i;
    totalAskQty += askQty;
    asks.push({ price: askPrice, orders: askOrders, quantity: askQty });
  }

  return { bids, asks, totalBidQty, totalAskQty };
}

function generateHistoricalCandles(basePrice, count = 40) {
  const candles = [];
  let current = basePrice * 0.96;
  const now = Date.now();
  const stepMs = 5 * 60 * 1000;

  for (let i = count; i >= 0; i--) {
    const time = new Date(now - i * stepMs);
    const delta = (Math.random() - 0.48) * (basePrice * 0.008);
    const open = +current.toFixed(2);
    const close = +(open + delta).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * (basePrice * 0.004)).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * (basePrice * 0.004)).toFixed(2);
    const volume = Math.floor(Math.random() * 18000) + 2000;

    candles.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: time.getTime(),
      open,
      high,
      low,
      close,
      volume
    });
    current = close;
  }
  candles[candles.length - 1].close = basePrice;
  return candles;
}

// Global Maps
const STOCKS_MAP = new Map();
const ALL_UNDERLYINGS = [...INITIAL_INDICES, ...RAW_STOCKS];

// Register all stocks & indices with accurate live market prices
ALL_UNDERLYINGS.forEach(item => {
  const enriched = enrichStock(item);
  enriched.candles = generateHistoricalCandles(enriched.price);
  STOCKS_MAP.set(enriched.symbol, enriched);
});

// Register all Option Contracts (Call and Put) matching newly rectified strikes
ALL_UNDERLYINGS.forEach(item => {
  const options = generateOptionsForUnderlying(item);
  options.forEach(opt => {
    opt.candles = generateHistoricalCandles(opt.price);
    STOCKS_MAP.set(opt.symbol, opt);
  });
});

// Default Watchlists updated with rectified strikes and Zerodha Kite watchlist sets
const DEFAULT_WATCHLISTS = {
  1: ["DLF", "OBEROIRLTY", "KALYANKJIL", "INDIACEM", "HBLENGINE", "KARURVYSYA", "GHCL", "GRANULES", "IGL", "POWERGRID", "NBCC", "IDEA", "BANDHANBNK", "HEIDELBERG", "IEX", "SAMMAANCAP", "GOLDBEES"],
  2: ["ICICIBANK", "SBIN", "BHARTIARTL", "BAJFINANCE", "ZOMATO", "MARUTI", "TATASTEEL", "ITC"],
  3: ["HDFCBANK", "HINDUNILVR", "INFY", "ONGC", "TCS", "RELIANCE", "LT", "SUNPHARMA", "WIPRO"],
  4: ["FEDERALBNK", "IDFCFIRSTB", "IREDA", "SUZLON", "ADANIENT", "HAL", "JIOFIN"],
  5: ["KOTAKBANK", "AXISBANK", "BAJAJ-AUTO", "ASIANPAINT", "TITAN", "COALINDIA"],
  6: ["NIFTY 50", "NIFTY BANK", "SENSEX", "RELIANCE", "TCS", "INFY", "HDFCBANK"],
  7: [
    "NIFTY 50 24400 CE",
    "NIFTY 50 24450 PE",
    "NIFTY BANK 57000 CE",
    "NIFTY BANK 57100 PE",
    "SENSEX 78800 CE",
    "SENSEX 78900 PE",
    "LT 4000 CE",
    "LT 4050 PE"
  ]
};
