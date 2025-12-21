#!/usr/bin/env bash
set -euo pipefail

FUNCTION_URL="${FUNCTION_URL:-https://dbclmdeowohzmwtkktsa.supabase.co/functions/v1/send-portal-invite}"
ORIGIN="${ORIGIN:-http://localhost:8080}"
TOKEN="${TOKEN:-}"

echo "== Preflight =="
curl -i -X OPTIONS \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type, apikey" \
  "${FUNCTION_URL}"

echo
echo "== POST (set TOKEN env var with a JWT) =="
if [ -z "$TOKEN" ]; then
  echo "Skip POST because TOKEN is empty. Export TOKEN=<jwt> to run."
  exit 0
fi

curl -i -X POST \
  -H "Origin: ${ORIGIN}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","clientName":"Test Client","portalUrl":"https://example.com","agencyName":"Test Agency","agencyId":"00000000-0000-0000-0000-000000000000","inviterName":"Tester","clientId":"00000000-0000-0000-0000-000000000000"}' \
  "${FUNCTION_URL}"
