# Golden Set Harness (Phase 1)

## Files
1. Dataset: `dataset/golden_cases.json`
2. Actuals template: `dataset/golden_actuals.template.json`
3. Scorer: `notes/score_golden_set.mjs`
4. Output log: `logs/golden_set_score.json`

## Usage
1. Create an actuals file by copying the template and filling each case output.
2. Run:

```bash
node docs/audit/system/evidence/golden_set_onboarding_2026-03-09/notes/score_golden_set.mjs <path-to-actuals.json>
```

If no path is provided, scorer uses the template file.

## Current Gate
- Pass threshold: `0.85` overall check score.
- Intended use: CI gate + release evidence for onboarding AI quality.

## Notes
- This is Phase-1 harness scaffolding for measurable quality enforcement.
- Next step is wiring an automatic collector that runs real prompts against `ai-onboarding` and writes actuals automatically.
