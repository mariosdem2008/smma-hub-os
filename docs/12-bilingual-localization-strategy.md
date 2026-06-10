# 12 Bilingual Localization Strategy

| Related | [11-ui-ux-design-system](11-ui-ux-design-system.md), [20-launch-assumptions-and-go-to-market](20-launch-assumptions-and-go-to-market.md) |

## 1. Goal

Support bilingual product experiences without compromising governance, clarity, or source integrity.

## 2. Localization Scope

| Layer | Requirement |
|---|---|
| Product UI | Localizable labels, navigation, statuses, and helper text |
| Client portal | Localizable external-facing copy and notifications |
| Source records | Preserve original language and translated summaries separately |
| AI outputs | Generate in the target language while preserving cited source meaning |

## 3. Operating Rules

- Canonical source meaning must not be altered by translation.
- Translated UI copy should use controlled terminology for workflow states and approvals.
- Packs may define language-specific voice and compliance rules.
- Bilingual support should not introduce duplicate truth records.

## 4. Launch Recommendation

Start with one default language and one secondary supported language only when:

- the terminology set is controlled
- pack rules support both languages
- approval and notification flows are tested end to end
