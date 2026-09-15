#!/usr/bin/env bash
# Runs the API in release mode (fast) with env from backend/.env
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec cargo run --release
