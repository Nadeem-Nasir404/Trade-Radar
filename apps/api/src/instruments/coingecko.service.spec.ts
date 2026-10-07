import { CoinGeckoService } from "./coingecko.service";

describe("CoinGeckoService.getMarketCaps", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const make = () => new CoinGeckoService({ get: (key: string) => (key === "COINGECKO_API_BASE_URL" ? "https://cg.test" : undefined) } as any);

  it("indexes the top coins by id and by ticker, keeping the biggest coin for a shared ticker", async () => {
    const calls: string[] = [];
    global.fetch = (async (url: string) => {
      calls.push(url);
      const page = url.includes("page=1")
        ? [
            { id: "bitcoin", symbol: "btc", market_cap: 2_000_000_000_000, market_cap_rank: 1 },
            { id: "cosmos", symbol: "atom", market_cap: 900_000_000, market_cap_rank: 90 },
          ]
        : [{ id: "atom-copycat", symbol: "atom", market_cap: 1_000, market_cap_rank: 480 }];
      return new Response(JSON.stringify(page), { status: 200 });
    }) as typeof fetch;

    const caps = await make().getMarketCaps();

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("order=market_cap_desc");
    expect(caps.bySymbol.get("BTC")).toEqual({ marketCap: 2_000_000_000_000, marketCapRank: 1 });
    expect(caps.bySymbol.get("ATOM")).toEqual({ marketCap: 900_000_000, marketCapRank: 90 });
    expect(caps.byId.get("atom-copycat")?.marketCapRank).toBe(480);
  });

  it("serves the cached copy without asking CoinGecko again within ten minutes", async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify([{ id: "bitcoin", symbol: "btc", market_cap: 1, market_cap_rank: 1 }]), { status: 200 });
    }) as typeof fetch;

    const service = make();
    await service.getMarketCaps();
    await service.getMarketCaps();
    expect(calls).toBe(2); // two pages on the first call, none on the second
  });

  it("returns an empty index instead of failing when CoinGecko is down", async () => {
    global.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
    const caps = await make().getMarketCaps();
    expect(caps.bySymbol.size).toBe(0);
  });
});
