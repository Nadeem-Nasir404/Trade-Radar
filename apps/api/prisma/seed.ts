import "dotenv/config";
import { PrismaClient, AssetType, ProviderType, ConditionType, AlertStatus, PlanTier } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Prisma 7 requires an explicit driver adapter (see PrismaService) - this script runs
// standalone via ts-node, outside Nest's DI, so it constructs its own client the same way.
const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@levelpulse.app";
const DEMO_PASSWORD = "demo1234";

// Friendly display names for the pairs traders actually recognize - anything outside this map
// just falls back to its base asset ticker (e.g. "FLOKI"), which is fine for a long tail list.
const FRIENDLY_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  TRX: "TRON",
  AVAX: "Avalanche",
  DOT: "Polkadot",
  LINK: "Chainlink",
  MATIC: "Polygon",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  XLM: "Stellar",
  ICP: "Internet Computer",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  INJ: "Injective",
  SUI: "Sui",
  TON: "Toncoin",
  SHIB: "Shiba Inu",
  PEPE: "Pepe",
  FIL: "Filecoin",
  ETC: "Ethereum Classic",
  HBAR: "Hedera",
  RENDER: "Render",
  TIA: "Celestia",
  SEI: "Sei",
};

interface BinanceExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed: boolean;
}

interface BinanceTicker24hr {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
}

interface BinancePairSeed {
  symbol: string;
  baseAsset: string;
  lastPrice: number;
}

// Fallback used only if live Binance REST calls fail (offline dev box, transient DNS blip -
// same failure mode we already hit once with the Ethereal mailer call). Never let a seed run
// hard-fail over one flaky network call when we can degrade to a small known-good set instead.
const FALLBACK_PAIRS: BinancePairSeed[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", lastPrice: 103420 },
  { symbol: "ETHUSDT", baseAsset: "ETH", lastPrice: 4821 },
  { symbol: "SOLUSDT", baseAsset: "SOL", lastPrice: 238 },
  { symbol: "BNBUSDT", baseAsset: "BNB", lastPrice: 620 },
  { symbol: "XRPUSDT", baseAsset: "XRP", lastPrice: 0.55 },
];

interface CoinGeckoMarket {
  symbol: string;
  image: string;
  market_cap: number | null;
}

/**
 * Real coin logos for whatever CoinGecko's top-250-by-market-cap covers (most of what we seed).
 * Symbol collisions (e.g. two unrelated coins both ticker "X") are resolved by keeping the first
 * hit, since the list is already sorted market-cap descending - the bigger/more-recognized coin
 * wins the ticker. Never throws: an empty map here just means every pair falls through to the
 * next tier (the cryptocurrency-icons CDN, then the client-side initials badge).
 */
async function fetchCoingeckoIconMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false");
    if (!res.ok) throw new Error(`CoinGecko REST error: ${res.status}`);
    const markets = (await res.json()) as CoinGeckoMarket[];
    for (const m of markets) {
      const symbol = m.symbol.toUpperCase();
      if (!map.has(symbol) && m.image) map.set(symbol, m.image);
    }
  } catch (err) {
    console.warn("Could not fetch CoinGecko icon set (non-fatal, falling back to secondary icon CDN):", err);
  }
  return map;
}

/** Pulls the top `limit` USDT spot pairs by 24h quote volume, with real current prices. */
async function fetchTopBinanceUsdtPairs(limit: number): Promise<BinancePairSeed[]> {
  const [exchangeInfoRes, tickerRes] = await Promise.all([
    fetch("https://api.binance.com/api/v3/exchangeInfo"),
    fetch("https://api.binance.com/api/v3/ticker/24hr"),
  ]);
  if (!exchangeInfoRes.ok || !tickerRes.ok) {
    throw new Error(`Binance REST error: exchangeInfo=${exchangeInfoRes.status} ticker=${tickerRes.status}`);
  }

  const exchangeInfo = (await exchangeInfoRes.json()) as { symbols: BinanceExchangeSymbol[] };
  const tickers = (await tickerRes.json()) as BinanceTicker24hr[];

  const tradableUsdtPairs = new Set(
    exchangeInfo.symbols
      .filter(
        (s) =>
          s.status === "TRADING" &&
          s.quoteAsset === "USDT" &&
          s.isSpotTradingAllowed &&
          // Stablecoin-vs-stablecoin and leveraged-token pairs (UPUSDT/DOWNUSDT/BULL/BEAR) aren't
          // things traders set price alerts on - filter them out of the catalog.
          !/^(USD|EUR|GBP|TUSD|FDUSD|USDP|BUSD)/.test(s.baseAsset) &&
          !/(UP|DOWN|BULL|BEAR)$/.test(s.baseAsset),
      )
      .map((s) => s.symbol),
  );

  return tickers
    .filter((t) => tradableUsdtPairs.has(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      baseAsset: t.symbol.slice(0, -4), // strip "USDT"
      lastPrice: Number(t.lastPrice),
      quoteVolume: Number(t.quoteVolume),
    }))
    .filter((t) => Number.isFinite(t.lastPrice) && t.lastPrice > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, limit)
    .map(({ symbol, baseAsset, lastPrice }) => ({ symbol, baseAsset, lastPrice }));
}

async function main() {
  console.log("Seeding CoinRadar database...");

  // --- Providers -----------------------------------------------------------
  const binance = await prisma.provider.upsert({
    where: { name: "binance" },
    update: {},
    create: {
      name: "binance",
      type: ProviderType.BINANCE,
      assetTypes: [AssetType.CRYPTO],
      isEnabled: true,
      priority: 10,
    },
  });

  const mock = await prisma.provider.upsert({
    where: { name: "mock" },
    update: {},
    create: {
      name: "mock",
      type: ProviderType.MOCK,
      assetTypes: [AssetType.CRYPTO, AssetType.COMMODITY, AssetType.FOREX, AssetType.INDEX],
      isEnabled: true,
      priority: 0,
    },
  });

  await prisma.provider.upsert({
    where: { name: "coingecko" },
    update: {},
    create: {
      name: "coingecko",
      type: ProviderType.COINGECKO,
      assetTypes: [AssetType.CRYPTO],
      isEnabled: true,
      priority: 5,
    },
  });

  const twelveData = await prisma.provider.upsert({
    where: { name: "twelvedata" },
    update: {},
    create: {
      name: "twelvedata",
      type: ProviderType.TWELVE_DATA,
      assetTypes: [AssetType.FOREX, AssetType.COMMODITY, AssetType.INDEX],
      isEnabled: true,
      priority: 5,
    },
  });

  // --- Exchanges -------------------------------------------------------------
  const binanceExchange = await prisma.exchange.upsert({
    where: { name: "Binance" },
    update: {},
    create: { name: "Binance", providerId: binance.id, timezone: "UTC" },
  });

  const twelveDataExchange = await prisma.exchange.upsert({
    where: { name: "Spot" },
    update: {},
    create: { name: "Spot", providerId: twelveData.id, timezone: "UTC" },
  });

  const demoExchange = await prisma.exchange.upsert({
    where: { name: "CoinRadar Demo" },
    update: {},
    create: { name: "CoinRadar Demo", providerId: mock.id, timezone: "UTC" },
  });

  // --- Instruments -----------------------------------------------------------
  console.log("Fetching live Binance USDT pairs...");
  let binancePairs: BinancePairSeed[];
  try {
    binancePairs = await fetchTopBinanceUsdtPairs(220);
    console.log(`Fetched ${binancePairs.length} live pairs from Binance.`);
  } catch (err) {
    console.warn("Could not fetch live Binance pairs, falling back to a small static set:", err);
    binancePairs = FALLBACK_PAIRS;
  }

  console.log("Fetching CoinGecko icon set...");
  const coingeckoIcons = await fetchCoingeckoIconMap();
  console.log(`Fetched ${coingeckoIcons.size} icons from CoinGecko.`);

  // Two-tier icon lookup: CoinGecko's real logos first (best coverage/quality for well-known
  // coins), falling back to the open-source cryptocurrency-icons set on jsdelivr for anything
  // CoinGecko's top-250-by-market-cap doesn't include. Anything neither covers falls through to
  // the client-side initials badge (CoinLogo component) - never a broken image.
  const iconUrlFor = (baseAsset: string) =>
    coingeckoIcons.get(baseAsset.toUpperCase()) ??
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${baseAsset.toLowerCase()}.png`;

  const instrumentSeeds = [
    ...binancePairs.map((pair) => ({
      symbol: pair.symbol,
      displaySymbol: `${pair.baseAsset}/USDT`,
      name: FRIENDLY_NAMES[pair.baseAsset] ?? pair.baseAsset,
      assetType: AssetType.CRYPTO,
      baseCurrency: pair.baseAsset,
      quoteCurrency: "USDT",
      providerId: binance.id,
      providerSymbol: pair.symbol.toLowerCase(),
      exchangeId: binanceExchange.id,
      coingeckoId: null as string | null,
      iconUrl: iconUrlFor(pair.baseAsset),
      lastPrice: pair.lastPrice,
    })),
    {
      // Real spot gold quote via Twelve Data (requires TWELVE_DATA_API_KEY) - not a crypto-token
      // proxy like Binance's PAXG, which trades at its own premium/spread vs true XAU/USD spot.
      symbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      name: "Gold",
      assetType: AssetType.COMMODITY,
      baseCurrency: "XAU",
      quoteCurrency: "USD",
      providerId: twelveData.id,
      providerSymbol: "xau/usd",
      exchangeId: twelveDataExchange.id,
      coingeckoId: null as string | null,
      iconUrl: null as string | null,
      lastPrice: 3987,
    },
  ];

  const instruments: Record<string, { id: string }> = {};
  for (const seed of instrumentSeeds) {
    const instrument = await prisma.instrument.upsert({
      where: { providerId_providerSymbol: { providerId: seed.providerId, providerSymbol: seed.providerSymbol } },
      update: { lastPrice: seed.lastPrice, lastPriceAt: new Date(), iconUrl: seed.iconUrl },
      create: { ...seed, lastPriceAt: new Date() },
    });
    instruments[seed.symbol] = instrument;
  }

  // --- Demo user ---------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo Trader",
      timezone: "Asia/Karachi",
      currency: "USD",
      emailVerified: new Date(),
      settings: { create: {} },
      subscription: { create: { plan: PlanTier.PRO, maxActiveAlerts: 300 } },
    },
  });

  await prisma.notificationChannel.upsert({
    where: { userId_type: { userId: demoUser.id, type: "EMAIL" } },
    update: {},
    create: { userId: demoUser.id, type: "EMAIL", config: {}, isEnabled: true, isVerified: true },
  });

  const defaultWatchlist = await prisma.watchlist.upsert({
    where: { id: `${demoUser.id}-default` },
    update: {},
    create: {
      id: `${demoUser.id}-default`,
      userId: demoUser.id,
      name: "My Watchlist",
      isDefault: true,
      items: {
        create: [
          { instrumentId: instruments.BTCUSDT.id, sortOrder: 0 },
          { instrumentId: instruments.ETHUSDT.id, sortOrder: 1 },
          { instrumentId: instruments.SOLUSDT.id, sortOrder: 2 },
          { instrumentId: instruments.XAUUSD.id, sortOrder: 3 },
        ],
      },
    },
  });

  const sampleAlerts = [
    { instrumentId: instruments.BTCUSDT.id, conditionType: ConditionType.CROSSES_ABOVE, targetValue: 105000 },
    { instrumentId: instruments.BTCUSDT.id, conditionType: ConditionType.BELOW, targetValue: 100000 },
    { instrumentId: instruments.ETHUSDT.id, conditionType: ConditionType.BELOW, targetValue: 4200 },
    { instrumentId: instruments.XAUUSD.id, conditionType: ConditionType.ABOVE, targetValue: 4000 },
  ];

  for (const alert of sampleAlerts) {
    const existing = await prisma.alert.findFirst({
      where: { userId: demoUser.id, instrumentId: alert.instrumentId, conditionType: alert.conditionType, targetValue: alert.targetValue },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          userId: demoUser.id,
          instrumentId: alert.instrumentId,
          conditionType: alert.conditionType,
          targetValue: alert.targetValue,
          status: AlertStatus.ACTIVE,
          channelPrefs: { create: [{ channelType: "WEBPUSH", isEnabled: true }] },
        },
      });
    }
  }

  console.log(`Seed complete. Instruments: ${instrumentSeeds.length}. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Default watchlist: ${defaultWatchlist.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
