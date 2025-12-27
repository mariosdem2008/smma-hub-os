# Push 408 Resolution

## Summary
- Push failures were caused by huge blobs in history under `docs/ai/audit_artifacts/`, which created a ~901.64 MiB pack for upload.
- Resolved by removing `docs/ai/audit_artifacts/` from history with `git filter-repo`, then pushing via SSH with `--force-with-lease` after verifying remote HEAD was unchanged.
- Added `.gitignore` guardrails to prevent reintroducing large artifacts.

## Size Metrics
- Before rewrite: `size-pack` = 901.64 MiB (from `docs/diagnostics/push_408_before.txt`)
- After rewrite: `size-pack` = 2.21 MiB (from `docs/diagnostics/push_408_after_rewrite.txt`)

## Largest Blobs
- Before: 3,974,738,482 bytes (3790.61 MB) at `docs/ai/audit_artifacts/rg_memory_brains_db.txt`
- After: 322,757 bytes (0.31 MB) at `package-lock.json`

## Fix Applied
1) Removed `docs/ai/audit_artifacts/` from history.
2) Pushed over SSH with `git push --force-with-lease` after remote HEAD verification.
3) Added `.gitignore` entries for audit artifacts and build/binary files.

## Notes
- Remote HEAD was verified unchanged before force-with-lease (see `docs/diagnostics/remote_head_compare.txt`).
- SSH authentication succeeded (`ssh -T git@github.com`).