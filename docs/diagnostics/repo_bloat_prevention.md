# Repo Bloat Prevention

## Policy
- Max allowed tracked file size: 10 MB (10485760 bytes).
- Applies to all tracked files and to new/modified files in PRs.

## Why
Large files inflate Git pack sizes and lead to push timeouts and slow clones. A 10 MB cap keeps uploads reliable and repository history manageable.

## How It Is Enforced
- Local pre-commit hook in `.githooks/` blocks staged files over 10 MB.
- CI job fails if any tracked file exceeds 10 MB or a PR adds a >10 MB file.

## Overrides (Intentional Large Assets)
If a large binary must be stored:
1) Prefer Git LFS for specific extensions or paths.
2) Alternatively, store outside Git (artifact storage, object storage).

Do not commit large binaries directly into Git history.

## Current Status
- Latest scan found no tracked files >10 MB.
