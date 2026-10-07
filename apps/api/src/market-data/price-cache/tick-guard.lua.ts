/**
 * Atomically rejects stale/duplicate/out-of-order ticks and advances the per-instrument
 * price hash. Runs as a single Redis EVAL so a concurrent tick can never read a torn state.
 *
 * KEYS[1] = price:{instrumentId}
 * ARGV[1] = price (string)
 * ARGV[2] = eventTime (ms epoch, from the exchange)
 * ARGV[3] = receivedTime (ms epoch, server clock)
 * ARGV[4] = providerId
 * ARGV[5] = isDemo ('1'|'0') - true when produced by MockMarketDataProvider
 * ARGV[6] = providerSeq ('' when the provider has none) - when set, ordering uses this
 *           per-provider monotonic id instead of eventTime, so several trades in the same
 *           millisecond are all admitted while replays are still rejected
 *
 * Returns: { accepted (0|1), prevPrice (string), seq (number) }
 */
export const TICK_GUARD_LUA = `
if ARGV[6] ~= '' then
  local seqField = 'pseq:' .. ARGV[4]
  local lastProviderSeq = tonumber(redis.call('HGET', KEYS[1], seqField) or '-1')
  if tonumber(ARGV[6]) <= lastProviderSeq then
    return {0, '0', 0}
  end
  redis.call('HSET', KEYS[1], seqField, ARGV[6])
else
  local lastEventTime = tonumber(redis.call('HGET', KEYS[1], 'ts') or '0')
  if tonumber(ARGV[2]) <= lastEventTime then
    return {0, '0', 0}
  end
end

local prevPrice = redis.call('HGET', KEYS[1], 'price')
local seq = redis.call('HINCRBY', KEYS[1], 'seq', 1)

redis.call('HSET', KEYS[1],
  'price', ARGV[1],
  'prevPrice', prevPrice or ARGV[1],
  'ts', ARGV[2],
  'receivedTs', ARGV[3],
  'providerId', ARGV[4],
  'isDemo', ARGV[5]
)

return {1, prevPrice or ARGV[1], seq}
`;
