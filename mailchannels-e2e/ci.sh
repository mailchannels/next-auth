#!/usr/bin/env bash
# Runs the @auth/core tests, then the MailChannels magic-link behaviour script
# against a stub Email API for Auth.js (this branch's provider) and Better Auth.
# Usage, from the repository root: mailchannels-e2e/ci.sh
# Synthetic data only: no real API key, no mail leaves the machine.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$ROOT/mailchannels-e2e"
OUT="${E2E_OUT:-$E2E/out}"
mkdir -p "$OUT/packs"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Node 25+ no longer bundles corepack.
command -v corepack >/dev/null || npm install -g --no-audit --no-fund corepack
corepack enable
PNPM="corepack pnpm"
cd "$ROOT"

echo "::group::node $(node -v), install"
$PNPM install --frozen-lockfile --filter "next-auth..." --ignore-scripts
echo "::endgroup::"

echo "::group::@auth/core build and tests"
$PNPM --filter @auth/core build
$PNPM --filter @auth/core test
echo "::endgroup::"

echo "::group::next-auth build and pack"
$PNPM --filter next-auth build
rm -f "$OUT"/packs/*.tgz
(cd packages/core && $PNPM pack --pack-destination "$OUT/packs")
(cd packages/next-auth && $PNPM pack --pack-destination "$OUT/packs")
CORE_TGZ="$(ls "$OUT"/packs/auth-core-*.tgz)"
NEXT_AUTH_TGZ="$(ls "$OUT"/packs/next-auth-*.tgz)"
echo "::endgroup::"

echo "::group::sample apps"
cd "$E2E/authjs-app"
npm pkg set "dependencies.next-auth=file:$NEXT_AUTH_TGZ" "overrides.@auth/core=file:$CORE_TGZ"
npm install --no-audit --no-fund
cd "$E2E/better-auth-app"
npm install --no-audit --no-fund
echo "::endgroup::"

export AUTH_SECRET="synthetic-e2e-secret-0123456789abcdef"
export AUTH_MAILCHANNELS_KEY="synthetic-test-key"
export MAILCHANNELS_API_KEY="synthetic-test-key"
export MAILCHANNELS_BASE_URL="http://localhost:8080"
export EMAIL_FROM="no-reply@example.test"
export BETTER_AUTH_SECRET="synthetic-e2e-secret-0123456789abcdef"
export BETTER_AUTH_URL="http://localhost:3002"
export NEXT_TELEMETRY_DISABLED=1

echo "::group::build sample apps"
(cd "$E2E/authjs-app" && npm run build)
(cd "$E2E/better-auth-app" && npm run build)
echo "::endgroup::"

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT
node "$E2E/stub/server.mjs" >"$OUT/stub.log" 2>&1 & pids+=($!)
(cd "$E2E/authjs-app" && npm start) >"$OUT/authjs-app.log" 2>&1 & pids+=($!)
(cd "$E2E/better-auth-app" && npm start) >"$OUT/better-auth-app.log" 2>&1 & pids+=($!)

for url in http://localhost:8080/sends http://localhost:3001/api/auth/csrf http://localhost:3002/api/auth/ok; do
  for _ in $(seq 1 60); do curl -fs -o /dev/null "$url" && break; sleep 1; done
  curl -fsS -o /dev/null "$url" || { echo "$url did not start"; tail -50 "$OUT"/*.log; exit 1; }
done

RESULTS_FILE="$OUT/e2e-results.json" node "$E2E/run-e2e.mjs"
