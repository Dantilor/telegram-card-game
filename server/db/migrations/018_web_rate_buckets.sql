-- Shared rate-limit buckets for multi-instance WEB API (additive).
-- Never apply to gnh_supabase without explicit approval.

CREATE TABLE IF NOT EXISTS web_rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hit_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT web_rate_buckets_hit_nonneg CHECK (hit_count >= 0),
  CONSTRAINT web_rate_buckets_key_len CHECK (char_length(bucket_key) BETWEEN 1 AND 200)
);

COMMENT ON TABLE web_rate_buckets IS
  'Cross-instance sliding windows for OTP / telegram-link abuse controls.';
