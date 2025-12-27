# Git Hooks

This repo uses a local hooks path (`.githooks`) to prevent staging files larger than 10 MB.

Enable locally:
```
git config core.hooksPath .githooks
```

Threshold:
- 10 MB (10485760 bytes)

If you need to add large binaries, use Git LFS or external storage instead of committing them directly.
