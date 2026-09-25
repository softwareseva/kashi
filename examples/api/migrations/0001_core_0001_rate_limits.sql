-- @kashi/core: fixed-window counters used by rateLimit() and consumeRateLimit().
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);
