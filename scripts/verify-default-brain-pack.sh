#!/usr/bin/env bash
set -euo pipefail

# Wrapper for the Node verification script.
# Required env vars:
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   TEST_AGENCY_ID
#
# Optional for smoke test:
#   TEST_CLIENT_ID
#   CRON_SECRET
#
# Usage:
#   ./scripts/verify-default-brain-pack.sh
#   ./scripts/verify-default-brain-pack.sh -- --smoke

node scripts/verify-default-brain-pack.mjs "${@}"

