# SMMAHUB Bilingual & Localization Strategy

> Version 1.0 | March 2026
> Cross-references: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [11-ui-ux-design-system.md](./11-ui-ux-design-system.md), [13-feature-matrix-mvp-v1-v2.md](./13-feature-matrix-mvp-v1-v2.md), [14-mvp-scope.md](./14-mvp-scope.md)

## 1. Strategy Overview

SMMAHUB is built for a global SMMA market. The localization strategy follows a phased approach: English-first with i18n infrastructure from day one, expanding to high-density SMMA markets in V1, and community-contributed languages in V2.

| Phase | Release | Languages | Scope |
|-------|---------|-----------|-------|
| Phase 1 | MVP | English (en-US) | Full UI. i18n infrastructure in place. All strings extractable. |
| Phase 2 | V1 | + Spanish (es), Portuguese (pt-BR) | Full UI translation. High SMMA density markets. |
| Phase 3 | V2 | + Community languages (fr, de, it, etc.) | Community contribution workflow. Professional review. |

---

## 2. Architecture

### 2.1 i18n Library

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime library | `react-intl` (FormatJS) | Industry standard, ICU MessageFormat, good TypeScript support |
| Message extraction | `@formatjs/cli extract` | Automated extraction from source |
| Message compilation | `@formatjs/cli compile` | Compiles to optimized AST for runtime |
| Locale data | `@formatjs/intl-*` polyfills | Number, date, plural rules |

### 2.2 Provider Architecture

```
<IntlProvider locale={locale} messages={messages[locale]}>
  <AuthProvider>
    ...app
  </AuthProvider>
</IntlProvider>
```

For the client portal, a separate `IntlProvider` instance wraps `ClientAuthProvider`, allowing the portal locale to differ from the agency locale.

```
<IntlProvider locale={portalLocale} messages={messages[portalLocale]}>
  <ClientAuthProvider>
    <ClientPortalLayout />
  </ClientAuthProvider>
</IntlProvider>
```

### 2.3 Message File Structure

```
src/
  i18n/
    messages/
      en.json          -- English (source of truth)
      es.json          -- Spanish
      pt-BR.json       -- Brazilian Portuguese
    index.ts           -- Locale loader and provider config
    extractedMessages/ -- Auto-extracted from source (git-ignored)
```

### 2.4 Message ID Convention

Messages use a hierarchical dot-notation ID:

```
{page}.{section}.{element}
```

Examples:

| ID | English Value |
|----|--------------|
| `dashboard.header.title` | "Dashboard" |
| `clients.list.empty` | "No client records yet. Add a client to continue." |
| `aiSetup.readiness.score` | "Readiness Score" |
| `portal.approvals.approve` | "Approve" |
| `common.actions.save` | "Save" |
| `common.actions.cancel` | "Cancel" |
| `common.errors.network` | "Something went wrong. Please try again." |

The `common.*` namespace is shared across all pages. Page-specific messages use the page name as prefix.

---

## 3. String Extraction and Management

### 3.1 Extraction Workflow

1. Developers write UI text using `<FormattedMessage>` or `intl.formatMessage()` with `defaultMessage` in English
2. CI runs `formatjs extract` to pull all messages into `extractedMessages/en.json`
3. Extracted messages are compared against `messages/en.json` to detect new/changed strings
4. New strings are flagged for translation

### 3.2 Translation Workflow

| Step | Actor | Tool |
|------|-------|------|
| String extraction | CI/CD | `@formatjs/cli extract` |
| Translation assignment | Product team | Translation management platform (Crowdin or Lokalise) |
| Translation | Professional translator | Translation platform |
| Review | Native speaker on team | Translation platform |
| Integration | CI/CD | Pull translated JSON into `src/i18n/messages/` |
| Verification | QA | Visual regression testing |

### 3.3 String Categories

| Category | Count Estimate | Change Frequency |
|----------|---------------|-----------------|
| Navigation labels | ~30 | Rare |
| Button labels / actions | ~50 | Rare |
| Form labels and placeholders | ~150 | Moderate |
| Status messages / badges | ~40 | Rare |
| Error messages | ~60 | Moderate |
| Toast / notification text | ~40 | Moderate |
| Page titles and headings | ~80 | Moderate |
| AI-related labels | ~50 | Frequent |
| Onboarding text | ~100 | Frequent |
| **Total** | **~600** | -- |

---

## 4. What is NOT Localized

Critical distinction: the SMMAHUB UI language and AI-generated content language are independent concerns.

| Content Type | Localized? | Governed By |
|-------------|-----------|-------------|
| UI chrome (buttons, labels, nav) | Yes | User's locale preference |
| System error messages | Yes | User's locale preference |
| AI-generated strategies | No | Client's language (set in client record) |
| AI-generated content briefs | No | Client's language (set in client record) |
| AI-generated reports | No | Client's language |
| Agency knowledge modules | No | Agency's input language |
| Client portal content | No (data) | Agency produces content in client's language |
| Portal UI chrome | Yes | Client's locale preference |

AI outputs follow the client's configured language regardless of the agency user's UI locale. An agency user with Spanish UI generating a strategy for a US client will see Spanish buttons and labels but English strategy output.

---

## 5. Language Preference Hierarchy

### 5.1 Agency Side

| Level | Setting | Storage | Override |
|-------|---------|---------|---------|
| Agency default | Set in `/settings` | `agencies.default_locale` column | -- |
| User preference | Set in user profile | `profiles.locale` column | Overrides agency default |
| Browser fallback | `navigator.language` | -- | Used if no preference set |

Resolution order: User preference > Agency default > Browser language > `en-US`.

### 5.2 Client Portal Side

| Level | Setting | Storage | Override |
|-------|---------|---------|---------|
| Portal default | Set in client portal config | `client_portals.locale` column | -- |
| Client user preference | Set by client user | `client_portal_users.locale` column | Overrides portal default |
| Browser fallback | `navigator.language` | -- | Used if no preference set |

Resolution order: Client user preference > Portal default > Browser language > `en-US`.

---

## 6. Formatting Standards

### 6.1 Date Formatting

All dates use `Intl.DateTimeFormat` via `react-intl`'s `<FormattedDate>`.

| Context | English (en-US) | Spanish (es) | Portuguese (pt-BR) |
|---------|-----------------|-------------|-------------------|
| Short date | Mar 23, 2026 | 23 mar 2026 | 23 de mar. de 2026 |
| Long date | March 23, 2026 | 23 de marzo de 2026 | 23 de marco de 2026 |
| Date + time | Mar 23, 2026 2:30 PM | 23 mar 2026 14:30 | 23 de mar. de 2026 14:30 |
| Relative | 2 hours ago | hace 2 horas | ha 2 horas |

### 6.2 Number Formatting

| Context | en-US | es | pt-BR |
|---------|-------|-----|-------|
| Integer | 1,234 | 1.234 | 1.234 |
| Decimal | 1,234.56 | 1.234,56 | 1.234,56 |
| Percentage | 85% | 85 % | 85% |

### 6.3 Currency Formatting

Currency follows the agency's configured currency, not the locale.

| Currency | en-US | es | pt-BR |
|----------|-------|-----|-------|
| USD | $1,234.00 | 1.234,00 US$ | US$ 1.234,00 |
| EUR | EUR 1,234.00 | 1.234,00 EUR | EUR 1.234,00 |
| BRL | BRL 1,234.00 | 1.234,00 BRL | R$ 1.234,00 |

---

## 7. RTL Considerations

Phase 1-2 targets LTR languages only. RTL infrastructure is designed but not activated.

| Aspect | Implementation | Status |
|--------|---------------|--------|
| CSS logical properties | Use `start`/`end` instead of `left`/`right` where possible | Phase 1 (prep) |
| Tailwind RTL plugin | `tailwindcss-rtl` installed but inactive | Phase 3 |
| Icon mirroring | Directional icons (arrows, chevrons) auto-flip | Phase 3 |
| Layout mirroring | Sidebar moves to right, text alignment flips | Phase 3 |
| Arabic / Hebrew | Not targeted in Phase 1-3 | Future |

Developers should use CSS logical properties (`margin-inline-start` via Tailwind `ms-*`) instead of physical properties (`margin-left` via `ml-*`) for new components to reduce future RTL migration cost.

---

## 8. Pluralization and ICU MessageFormat

`react-intl` uses ICU MessageFormat for pluralization and selection.

### 8.1 Plural Rules

```json
{
  "clients.count": "{count, plural, =0 {No clients} one {1 client} other {{count} clients}}"
}
```

### 8.2 Select Rules (Gender, Status)

```json
{
  "approval.status": "{status, select, pending {Pending review} approved {Approved} rejected {Rejected} other {Unknown}}"
}
```

### 8.3 Rich Text

For messages with inline formatting:

```json
{
  "onboarding.welcome": "Welcome to <b>SMMAHUB</b>. Let's configure your agency's AI."
}
```

Rendered with `<FormattedMessage values={{ b: (chunks) => <strong>{chunks}</strong> }} />`.

---

## 9. Locale-Aware SEO (Marketing Site)

The marketing site (landing page at `/`) and public pages (`/pricing`, `/terms`, `/privacy`) need locale-aware SEO.

| Concern | Implementation |
|---------|---------------|
| URL structure | `/` (English default), `/es/` (Spanish), `/pt-br/` (Portuguese) |
| `hreflang` tags | `<link rel="alternate" hreflang="es" href="/es/" />` on all public pages |
| `lang` attribute | `<html lang="{locale}">` set dynamically |
| Meta descriptions | Translated per locale |
| Open Graph tags | Translated `og:title`, `og:description` per locale |
| Sitemap | Multi-locale sitemap with `xhtml:link` alternates |
| Canonical | Each locale page is canonical to itself |

Application routes (`/dashboard`, `/clients`, etc.) are not indexed and do not need SEO localization.

---

## 10. Cultural Adaptation Beyond Translation

### 10.1 Content Considerations

| Aspect | Adaptation |
|--------|-----------|
| Date format | Automatic via `Intl.DateTimeFormat` |
| First day of week | Monday for es/pt-BR, Sunday for en-US (calendar views) |
| Name display | No assumptions about first/last name order |
| Address format | Country-specific address fields in client records |
| Phone format | International format with country code |
| Tone of voice | Translation brief specifies professional but approachable tone |
| Examples / screenshots | Localized for docs and onboarding in Phase 2 |

### 10.2 Marketing Content

| Market | Key Messaging Adaptation |
|--------|------------------------|
| US / UK | Emphasize scalability, AI governance, enterprise readiness |
| LATAM (es) | Emphasize team collaboration, cost efficiency, growth |
| Brazil (pt-BR) | Emphasize social media focus (Instagram/TikTok heavy market), ease of use |

---

## 11. Implementation Phases

### Phase 1: MVP (English + Infrastructure)

| Task | Priority | Effort |
|------|----------|--------|
| Install `react-intl` and configure `IntlProvider` | P0 | 2h |
| Create `src/i18n/` structure with `en.json` | P0 | 1h |
| Extract all hardcoded strings in shared components (`common.*`) | P1 | 8h |
| Extract page-specific strings for top 10 pages | P1 | 16h |
| Set up `formatjs extract` in CI | P1 | 2h |
| Add locale preference to user profile and agency settings | P2 | 4h |
| Use CSS logical properties in new components | P2 | Ongoing |
| **Total Phase 1** | -- | **~33h** |

### Phase 2: V1 (Spanish + Portuguese)

| Task | Priority | Effort |
|------|----------|--------|
| Extract remaining hardcoded strings | P0 | 16h |
| Set up translation management platform (Crowdin/Lokalise) | P0 | 4h |
| Professional translation: en -> es (~600 strings) | P0 | External |
| Professional translation: en -> pt-BR (~600 strings) | P0 | External |
| Translation review by native speakers | P1 | 8h |
| Visual QA for text overflow, truncation | P1 | 8h |
| Locale-aware SEO for marketing pages | P1 | 8h |
| Client portal locale configuration UI | P1 | 4h |
| **Total Phase 2** | -- | **~48h + external translation** |

### Phase 3: V2 (Community Languages)

| Task | Priority | Effort |
|------|----------|--------|
| Community translation portal / Crowdin public project | P1 | 8h |
| Contribution guidelines and glossary | P1 | 4h |
| Review workflow for community translations | P1 | 8h |
| RTL support activation (if Arabic/Hebrew requested) | P2 | 24h |
| Additional professional translations based on demand | P2 | External |
| **Total Phase 3** | -- | **~44h + community effort** |

---

## 12. Developer Guidelines

### 12.1 Rules for All UI Text

1. Never hardcode user-visible strings. Use `<FormattedMessage>` or `intl.formatMessage()`.
2. Always provide `defaultMessage` in English as fallback.
3. Use meaningful message IDs following the `{page}.{section}.{element}` convention.
4. Use ICU MessageFormat for plurals, selects, and interpolation.
5. Do not concatenate translated strings. Use a single message with placeholders.
6. Do not embed HTML in translation strings. Use rich text `values` prop.
7. Keep messages short. Long paragraphs should be broken into multiple messages.
8. Avoid locale-specific assumptions (date order, name order, number format).

### 12.2 What NOT to Wrap in i18n

| Content | Reason |
|---------|--------|
| Brand names ("SMMAHUB") | Never translated |
| Technical identifiers (module keys, API names) | Internal |
| AI-generated content | Governed by client language, not UI locale |
| User-entered data | Stored and displayed as-is |
| URLs and paths | Technical |
| Emoji | Universal |

### 12.3 Testing Translated UI

| Test | Tool | Frequency |
|------|------|-----------|
| Pseudo-localization | `@formatjs/cli` pseudo locale | Every PR (CI) |
| Text expansion check | Pseudo locale adds 30% length | Every PR (CI) |
| Visual regression | Playwright screenshots per locale | Weekly |
| RTL layout check | Browser `dir="rtl"` override | Phase 3 |
| Missing translation detection | `react-intl` `onError` handler logs missing IDs | Runtime (dev mode) |

---

## 13. Glossary Management

A shared glossary ensures consistent translation of domain-specific terms.

| English Term | Spanish | Portuguese (BR) | Notes |
|-------------|---------|-----------------|-------|
| Agency | Agencia | Agencia | Core domain term |
| Client | Cliente | Cliente | -- |
| Strategy | Estrategia | Estrategia | -- |
| Content brief | Brief de contenido | Brief de conteudo | Industry standard |
| Approval | Aprobacion | Aprovacao | -- |
| Readiness | Preparacion | Prontidao | AI readiness context |
| Guardrail | Guardrail | Guardrail | Keep English (industry term) |
| Trust level | Nivel de confianza | Nivel de confianca | AI governance context |
| Knowledge module | Modulo de conocimiento | Modulo de conhecimento | -- |
| Governed AI | IA gobernada | IA governada | Brand differentiator |

The glossary is maintained in the translation management platform and enforced during translation review.
