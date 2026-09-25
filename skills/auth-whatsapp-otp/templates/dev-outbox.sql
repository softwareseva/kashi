-- Development and test only: one-time codes land here instead of WhatsApp/SMS/email.
CREATE TABLE IF NOT EXISTS dev_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
