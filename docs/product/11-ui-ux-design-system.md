# SMMAHUB UI/UX Design System

> Version 1.0 | March 2026
> Cross-references: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [10-information-architecture.md](./10-information-architecture.md), [12-bilingual-localization-strategy.md](./12-bilingual-localization-strategy.md), [14-mvp-scope.md](./14-mvp-scope.md)

## 1. Foundation

SMMAHUB's design system is built on:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Utility framework | Tailwind CSS 3.x | Spacing, color, typography, responsive utilities |
| Primitive components | Radix UI | Accessible, unstyled headless components |
| Component library | shadcn/ui | Pre-styled Radix wrappers with Tailwind |
| Icons | Lucide React | Consistent icon set |
| Notifications | Sonner + shadcn Toaster | Toast and notification system |
| Tooltips | Radix TooltipProvider | Global tooltip layer |

All components are co-located in `src/components/ui/` (shadcn primitives) and `src/components/` (app-level composites).

---

## 2. Design Tokens

### 2.1 Color System

Colors are defined as CSS custom properties in HSL format, referenced via Tailwind's `theme.extend.colors`. The system uses semantic naming to support theming.

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--background` | `0 0% 100%` | `222.2 84% 4.9%` | Page background |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | Primary text |
| `--card` | `0 0% 100%` | `222.2 84% 4.9%` | Card surfaces |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | Card text |
| `--primary` | `221.2 83% 53%` | `217.2 91% 60%` | Primary actions, links |
| `--primary-foreground` | `210 40% 98%` | `222.2 47% 11%` | Text on primary |
| `--secondary` | `210 40% 96%` | `217.2 33% 18%` | Secondary surfaces |
| `--muted` | `210 40% 96%` | `217.2 33% 18%` | Muted backgrounds |
| `--muted-foreground` | `215.4 16% 47%` | `215 20% 65%` | Muted text |
| `--accent` | `210 40% 96%` | `217.2 33% 18%` | Accent highlights |
| `--destructive` | `0 84% 60%` | `0 63% 31%` | Error, delete actions |
| `--border` | `214.3 32% 91%` | `217.2 33% 18%` | Borders |
| `--ring` | `221.2 83% 53%` | `224.3 76% 48%` | Focus rings |

### 2.2 Semantic Status Colors

| Status | Color Class | Usage |
|--------|-----------|-------|
| Success | `text-green-600` / `bg-green-50` | Approved, complete, healthy |
| Warning | `text-amber-600` / `bg-amber-50` | Needs attention, pending |
| Error | `text-red-600` / `bg-red-50` | Failed, rejected, critical |
| Info | `text-blue-600` / `bg-blue-50` | Informational, in-progress |
| Neutral | `text-gray-500` / `bg-gray-50` | Inactive, archived |

### 2.3 Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | `Inter, system-ui, sans-serif` | All UI text |
| `font-mono` | `JetBrains Mono, monospace` | Code, IDs, technical values |
| `text-xs` | 12px / 1rem | Labels, captions |
| `text-sm` | 14px / 1.25rem | Body text, table cells |
| `text-base` | 16px / 1.5rem | Paragraphs, inputs |
| `text-lg` | 18px / 1.75rem | Section headings |
| `text-xl` | 20px / 1.75rem | Card titles |
| `text-2xl` | 24px / 2rem | Page headings |
| `text-3xl` | 30px / 2.25rem | Hero headings |

### 2.4 Spacing Scale

Tailwind default scale. Key application patterns:

| Context | Spacing | Tailwind Class |
|---------|---------|---------------|
| Inline element gap | 4px | `gap-1` |
| Icon-to-label gap | 8px | `gap-2` |
| Card internal padding | 16-24px | `p-4` to `p-6` |
| Section gap | 24-32px | `gap-6` to `gap-8` |
| Page margin | 24-32px | `p-6` to `p-8` |
| Sidebar width | 256px | `w-64` |

### 2.5 Shadows and Elevation

| Level | Class | Usage |
|-------|-------|-------|
| 0 | none | Flat elements, inline content |
| 1 | `shadow-sm` | Cards, dropdowns at rest |
| 2 | `shadow-md` | Elevated cards, popovers |
| 3 | `shadow-lg` | Modals, command palette |
| 4 | `shadow-xl` | Floating panels, AI chat |

---

## 3. Component Library

### 3.1 Atoms

| Component | Source | Variants | Notes |
|-----------|--------|----------|-------|
| Button | shadcn/ui | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | Size: `default`, `sm`, `lg`, `icon` |
| Input | shadcn/ui | text, email, password, search | Consistent border-radius, focus ring |
| Textarea | shadcn/ui | Auto-resize option | Used in AI prompt inputs |
| Badge | shadcn/ui | `default`, `secondary`, `destructive`, `outline` | Status indicators, tags |
| Avatar | shadcn/ui | Image, fallback initials | User and client avatars |
| Checkbox | shadcn/ui (Radix) | Checked, indeterminate | Form controls, bulk selection |
| Switch | shadcn/ui (Radix) | On/off | Feature toggles, settings |
| Select | shadcn/ui (Radix) | Single select | Dropdown selection |
| Label | shadcn/ui | -- | Form field labels |
| Separator | shadcn/ui | Horizontal, vertical | Visual dividers |
| Skeleton | shadcn/ui | -- | Loading placeholders |
| Spinner | Custom | sm, md, lg | Inline loading indicator |
| Progress | shadcn/ui | Determinate | Setup progress, upload progress |

### 3.2 Molecules

| Component | Composition | Usage |
|-----------|------------|-------|
| FormGroup | Label + Input + Error message | Consistent form field layout |
| StatBlock | Value + Label + Trend indicator | Dashboard metrics |
| Card | shadcn Card + Header + Content + Footer | Content containers |
| Alert | shadcn Alert + icon + title + description | System messages, warnings |
| Dialog | shadcn Dialog (Radix) | Confirmation, forms |
| Sheet | shadcn Sheet (Radix) | Side panels, mobile nav |
| Popover | shadcn Popover (Radix) | Contextual menus, info |
| Tabs | shadcn Tabs (Radix) | Client workspace tabs |
| DropdownMenu | shadcn (Radix) | Action menus, user menu |
| Breadcrumb | Custom | Navigation context (see [10-information-architecture.md](./10-information-architecture.md)) |
| EmptyState | Icon + Heading + Description + CTA | Zero-data states |
| StepIndicator | Custom | AI Setup wizard progress |

### 3.3 Organisms

| Component | Description | Usage |
|-----------|------------|-------|
| DataTable | Table + sorting + filtering + pagination | Client list, content list, approvals |
| AppLayout / Sidebar | Navigation rail + header + content area | Agency application shell |
| ClientDetailLayout | Tab bar + content area | Client workspace |
| ClientPortalLayout | Portal nav + content | Client portal shell |
| CommandPalette | shadcn Command (cmdk) | Global search (Cmd+K) |
| AiChatPanel | Message list + input + generation indicator | AI onboarding, AI assistant |
| AgencyAiSetupV2Shell | Stepper + content + checkpoint cards | AI setup wizard |
| ApprovalCard | Content preview + approve/reject/comment | Approval workflow |
| ContentCalendar | Month/week grid + content items | Content planning |
| ReportDashboard | Stat blocks + charts + date range | Performance reporting |

---

## 4. Page Templates

### 4.1 Dashboard Template

```
+----------------------------------+
| Header: Page title + date range  |
+----------------------------------+
| Stat row (4 StatBlocks)          |
+----------------------------------+
| Primary chart    | Activity feed |
|                  |               |
+----------------------------------+
| Recent items table               |
+----------------------------------+
```

### 4.2 List Template

```
+----------------------------------+
| Header: Title + Create button    |
| Filter bar + Search              |
+----------------------------------+
| DataTable with pagination        |
|                                  |
+----------------------------------+
```

### 4.3 Detail Template

```
+----------------------------------+
| Breadcrumb                       |
| Header: Name + Status + Actions  |
+----------------------------------+
| Tab bar                          |
+----------------------------------+
| Tab content                      |
|                                  |
+----------------------------------+
```

### 4.4 Form Template

```
+----------------------------------+
| Header: Form title               |
+----------------------------------+
| Form sections with field groups  |
|                                  |
+----------------------------------+
| Footer: Cancel + Save            |
+----------------------------------+
```

### 4.5 Wizard Template (AI Setup)

```
+----------------------------------+
| Step indicator (horizontal)      |
+----------------------------------+
| Step title + description         |
+----------------------------------+
| Step content (cards, forms)      |
|                                  |
+----------------------------------+
| Footer: Back + Next / Complete   |
+----------------------------------+
```

---

## 5. Interaction Patterns

### 5.1 Loading States

| Context | Pattern | Component |
|---------|---------|-----------|
| Page load | Full skeleton layout | `Skeleton` composites |
| Data fetch | Skeleton rows in tables, skeleton cards | `Skeleton` |
| Button action | Button spinner + disabled state | `Button` with `loading` prop |
| AI generation | Pulsing dot animation + status text | Custom `AiGenerationIndicator` |
| File upload | Progress bar with percentage | `Progress` |
| Route transition | Centered "Loading..." fallback | `Suspense` fallback |

### 5.2 Empty States

| Context | Content | Action |
|---------|---------|--------|
| No clients | Illustration + "Add a client record" | CTA button to create |
| No content | Illustration + "Generate your first brief" | CTA to content creation |
| No approvals | Check icon + "All caught up" | -- |
| No messages | Mail icon + "No messages yet" | -- |
| Search no results | Search icon + "No results for '{query}'" | Suggestion to adjust filters |

### 5.3 Error States

| Type | Display | Recovery |
|------|---------|----------|
| Network error | Toast + retry option | Retry button |
| 404 | Full-page `NotFound` component | Back to dashboard link |
| Validation error | Inline field errors (red border + message) | User corrects input |
| Permission denied | Alert banner | Contact admin message |
| AI generation failure | Error card with retry | Retry button + fallback option |

### 5.4 Success Feedback

| Action | Feedback |
|--------|----------|
| Save | Sonner toast: "Changes saved" |
| Create | Sonner toast: "{Entity} created" + navigate to detail |
| Delete | Confirmation dialog, then toast: "{Entity} deleted" |
| Approve | Toast + status badge update in-place |
| AI generation complete | Toast + content appears in panel |

---

## 6. AI-Specific Design Patterns

### 6.1 Generation Indicators

- **Inline generation**: Pulsing dots animation ("Generating...") below the prompt input
- **Panel generation**: Streaming text with cursor animation in chat panels
- **Background generation**: Toast notification when complete, badge on nav item

### 6.2 Confidence Display

| Confidence Level | Visual | Usage |
|-----------------|--------|-------|
| High (80-100%) | Green badge: "High confidence" | Strategy recommendations |
| Medium (50-79%) | Amber badge: "Review suggested" | Content suggestions |
| Low (< 50%) | Red badge: "Needs human input" | Uncertain outputs |

### 6.3 Source Attribution

AI-generated content displays attribution:

- "Generated by {Agent Name}" label with brain icon
- "Based on: {Module Names}" collapsible source list
- Timestamp of generation
- "Regenerate" action button

### 6.4 Approval Prompts

AI outputs requiring approval display:

- Clear "AI-generated" label
- Side-by-side comparison (when editing existing content)
- Approve / Edit / Reject action buttons
- Comment input for feedback
- Trust level indicator (see [14-mvp-scope.md](./14-mvp-scope.md) for trust levels)

### 6.5 Readiness Visualization

The AI readiness system uses a radial/progress visualization:

- Per-agent readiness score (0-100%)
- Color-coded progress ring (red < 40%, amber 40-70%, green > 70%)
- Module completion checklist beneath the score
- "What's needed" action list for incomplete items

---

## 7. Accessibility Requirements

SMMAHUB targets WCAG 2.1 Level AA compliance.

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | Minimum 4.5:1 for normal text, 3:1 for large text. Verified via Tailwind semantic tokens |
| Keyboard navigation | All interactive elements focusable. Focus ring via `--ring` token. Tab order follows visual order |
| Screen reader support | Radix UI provides ARIA attributes. Custom components use `aria-label`, `aria-describedby`, `role` |
| Focus management | Modal focus trap (Radix Dialog). Route change announces new page title |
| Reduced motion | `prefers-reduced-motion` media query disables animations |
| Form accessibility | All inputs have associated labels. Error messages linked via `aria-describedby` |
| Alt text | All meaningful images have alt text. Decorative images use `alt=""` |
| Landmark regions | `<main>`, `<nav>`, `<aside>` used for page structure |
| Skip navigation | "Skip to content" link on every page |
| Touch targets | Minimum 44x44px touch targets on mobile |

---

## 8. Responsive Breakpoints

| Breakpoint | Tailwind Prefix | Min Width | Target |
|-----------|----------------|-----------|--------|
| Default | (none) | 0px | Mobile |
| `sm` | `sm:` | 640px | Large phone / small tablet |
| `md` | `md:` | 768px | Tablet |
| `lg` | `lg:` | 1024px | Small desktop |
| `xl` | `xl:` | 1280px | Desktop (primary) |
| `2xl` | `2xl:` | 1536px | Large desktop |

### Responsive Behavior

| Component | < 768px | 768-1279px | >= 1280px |
|-----------|---------|-----------|-----------|
| Sidebar | Hidden (hamburger) | Icon rail (64px) | Full sidebar (256px) |
| DataTable | Card list view | Horizontal scroll | Full table |
| StatBlocks | Stacked (1 col) | 2 columns | 4 columns |
| Dialog | Full screen sheet | Centered modal | Centered modal |
| AI Chat | Full screen | Side panel (400px) | Side panel (480px) |

---

## 9. Theme Support

### 9.1 Light/Dark Mode

The application supports light and dark themes via CSS custom properties on `:root` and `.dark` class.

| Mechanism | Detail |
|-----------|--------|
| Storage | `localStorage` key: `smmahub-theme` |
| Default | System preference via `prefers-color-scheme` |
| Toggle | User setting in Settings page |
| Scope | Applied globally to both agency and portal |

### 9.2 Portal Theming

Client portals support basic brand customization:

| Property | Customizable | Token |
|----------|-------------|-------|
| Primary color | Yes | `--primary` override |
| Logo | Yes | Portal header logo |
| Favicon | Yes (V2) | Per-portal favicon |
| Font | No (V1) | System font only |
| Full CSS override | No | Not supported |

---

## 10. Animation Principles

| Principle | Implementation |
|-----------|---------------|
| Purposeful | Animations communicate state changes, not decoration |
| Fast | Transitions under 200ms for micro-interactions, 300ms for layout changes |
| Consistent | Same easing (`ease-in-out`) across all transitions |
| Reducible | All animations respect `prefers-reduced-motion` |

### Standard Transitions

| Pattern | Duration | Easing | Usage |
|---------|----------|--------|-------|
| Fade in | 150ms | ease-in | Tooltips, popovers |
| Slide in | 200ms | ease-out | Sheets, drawers |
| Expand | 200ms | ease-in-out | Accordion, collapsible |
| Scale | 150ms | ease-out | Dialog entrance |
| Skeleton pulse | 1.5s | ease-in-out (loop) | Loading states |
| AI dot pulse | 1s | ease-in-out (loop) | Generation indicator |

---

## 11. Component File Organization

```
src/
  components/
    ui/                    -- shadcn/ui primitives (button, input, card, etc.)
    AppLayout.tsx           -- Agency application shell
    ClientDetailLayout.tsx  -- Client workspace shell
    ProtectedRoute.tsx      -- Auth guard wrapper
    GlobalUpgradeModal.tsx  -- Upgrade prompts
    UpgradeAssistantCard.tsx
    agency-ai-setup-v2/    -- AI setup wizard components
      AgencyAiSetupV2Shell.tsx
      AgencyAiSetupCheckpointCard.tsx
      AgencyAiSetupWizardStepper.tsx
      AgencyAiSetupQuickSimulationCard.tsx
    client-tabs/           -- Client detail tab content
      ReportDetail.tsx
```

All new components follow the naming convention: `PascalCase.tsx`. Components that are page-level live in `src/pages/`. Reusable components live in `src/components/`.
