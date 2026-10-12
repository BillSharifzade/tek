-- Восстановление пароля по e-mail: одноразовая ссылка /reset-password?token=… на 1 час.
-- В базе — только SHA-256 токена (как у refresh-токенов); использованная или устаревшая ссылка удаляется.
CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets(user_id, created_at DESC);
