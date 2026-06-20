# LumaLingo interface guidelines

These guidelines define LumaLingo's reusable interface language. Semantic
tokens and shared components are the source of truth. Feature code must not
embed isolated color values or duplicate primitive interaction styles.

## Design direction

LumaLingo should feel calm, warm, focused, and encouraging. It is an
educational product, not a game dashboard.

- Favor generous space, short explanations, quiet surfaces, and one obvious
  next action.
- Use warm neutrals instead of pure white and black.
- Use teal for progress, selection, success, and primary actions.
- Reserve coral for temporary attention states such as recording or gentle
  correction.
- Prefer flat color, subtle borders, and tonal hierarchy. Avoid gradients,
  glass effects, heavy shadows, and decorative noise.
- Avoid childish celebration, streak pressure, shame, and excessive
  exclamation marks.

## Foundations

### Semantic tokens

Tokens live in `apps/web/src/design-system/tokens.css` and are exposed to
Tailwind through `@theme inline` in `apps/web/src/styles.css`. Both themes
define the same semantic API.

- Surfaces: `--background`, `--card`, `--secondary`, and `--muted`.
- Content: `--foreground` and each surface's `*-foreground` pair.
- Actions: `--primary`, `--emphasis`, `--accent`, and `--destructive` with
  matching foreground and hover tokens. Use `--emphasis` when an action needs
  contrast inside a primary surface.
- Structure: `--border`, `--ring`, spacing, radius, type, control-size, and
  motion tokens.
- Dark mode is activated by adding `.dark` to the root `html` element. The
  shared `ThemeToggle` stores the learner's choice in the `luma-theme` local
  storage key and otherwise starts from the operating system preference.

Never infer meaning from a color name in feature code. Use the semantic role.
Color cannot be the only state indicator; pair it with text, an icon, shape, or
accessible label.

### Typography

Use Inter when available and the system sans-serif stack otherwise.

| Role            | Token             | Size | Weight  |
| --------------- | ----------------- | ---- | ------- |
| Screen heading  | `--text-heading`  | 22px | 600     |
| Feature heading | `--text-feature`  | 18px | 600     |
| Activity label  | `--text-label`    | 15px | 500-600 |
| Body            | `--text-body`     | 15px | 400     |
| Supporting text | `--text-caption`  | 13px | 400     |
| Overline        | `--text-overline` | 11px | 600     |

Use sentence case for headings and actions. Reserve uppercase for short
overlines and metadata. Use tabular numerals for timers and changing numeric
values.

### Spacing and responsive layout

- Use the 4px spacing scale exposed by `--space-*` tokens.
- Start with the mobile layout. The reference viewport is 390 x 844px.
- Use `--screen-gutter` for page edges and `--content-gap` between major
  sections.
- Keep interactive targets at least 44 x 44px. Prominent mobile actions are at
  least 52px high.
- Let content reflow into constrained columns on larger screens; do not scale
  type with viewport width.
- Account for safe areas when fixing navigation or actions to viewport edges.
- Fixed headers and footers must not cover the independently scrollable content
  region.

### Shape and elevation

- Standard controls use `--radius-lg`; standard surfaces use `--radius-xl`.
- Use `--radius-feature` only for a dominant action or content surface.
- Pills and icon controls use `--radius-full`.
- Standard surfaces have a quiet 1px border and no shadow.
- Use shadows only where physical lift communicates interaction.
- Do not nest bordered surfaces unless the inner group is a distinct control.

## Shared components

Shared primitives live in `apps/web/src/design-system/components/`.

### Button

- Use one filled primary button for the main action in a section or screen.
- Variants: `primary`, `accent`, `emphasis`, `outline`, `ghost`, and `tinted`.
  The `emphasis` variant uses a deep teal for actions placed inside a primary
  teal surface.
- Sizes: `default`, `full`, and `icon`. Icon-only buttons require an
  `aria-label`.
- Keep labels short and action-oriented.
- Preserve hover, pressed, disabled, and visible keyboard-focus states.

### Surface

- `default`: regular grouped content with a quiet border.
- `secondary`: tutor notes, tips, and low-emphasis callouts.
- `tinted`: feedback or selected context.
- `primary`: a single dominant action or feature. Do not use it as a generic
  page wrapper.

### Progress

- Always provide a meaningful accessible label.
- Pair visual progress with nearby text when exact position matters.
- Use a thin continuous bar for an ongoing process and a segmented presentation
  when the number of activities is important.
- Do not rely on the bar alone to communicate completion.

Create a new shared component only after its behavior or structure is reused,
or when centralizing it is necessary for accessibility and consistency. Keep
feature-specific state in the owning feature.

## Interaction patterns

### Inputs and choices

- Inputs use a card surface, quiet border, 8px radius, readable placeholder,
  and semantic focus ring.
- Full-row choices should be buttons with a minimum 52px height.
- Selection must change more than color and expose state with `aria-pressed`
  when appropriate.
- Lock submitted choices while feedback is visible.
- Corrections should explain a reusable pattern. Prefer constructive language
  such as "Almost" over punitive labels.

### Audio

- A recording control should distinguish `idle`, `recording`, `paused`, and
  `submitted` through icon, label, shape, and color.
- Explain the benefit and privacy behavior before requesting microphone
  permission.
- Decorative waveforms are `aria-hidden`; the control's accessible label
  communicates state.
- Do not claim recording, playback, storage, or deletion behavior until the
  underlying implementation guarantees it.

### Navigation and progress

- Navigation items combine a familiar icon and a short label.
- Mark the active destination with both visual treatment and
  `aria-current="page"`.
- Keep navigation visually quiet so the current learning task remains dominant.
- Back controls include a familiar arrow and an accessible label while
  preserving a 44px target.

## Content voice

- Be concise, human, and specific.
- Explain benefit before asking for effort or personal data.
- Use realistic teaching examples instead of generic placeholder copy.
- Identify what worked, explain the mismatch, and offer the next useful pattern.
- Keep privacy and time estimates plain and explicit.

## Motion

- Keep transitions functional and between 150-300ms.
- Use motion to clarify a state change, progress, or spatial relationship.
- Avoid looping animation unless an activity is genuinely active.
- Respect `prefers-reduced-motion` and provide an equivalent static state.

## Accessibility checklist

- Prefer semantic HTML before adding ARIA.
- Maintain a visible 2px focus ring in both themes.
- Ensure normal text reaches 4.5:1 contrast and large text or meaningful
  graphics reaches 3:1.
- Never communicate selected, correct, incorrect, recording, or disabled state
  with color alone.
- Announce important dynamic feedback with an appropriate live region.
- Test keyboard navigation, screen readers, reduced motion, and 200% zoom.
- Verify contrast from computed colors, including opacity and overlays.
- Confirm fixed interface regions do not obscure content.

## Implementation rules

- Import Tailwind and the design-system CSS once through
  `apps/web/src/styles.css`.
- Prefer semantic utilities such as `bg-primary` and shared primitives over
  feature-specific CSS. Do not use arbitrary color values in product code.
- Use Tailwind utilities for layout, responsive behavior, spacing, and
  component composition. Keep CSS files for tokens, global foundations, and
  behavior that utilities cannot express clearly.
- Keep full pages under their feature or page directory, not inside the design
  system.
- Use named exports for reusable components.
- Keep static configuration outside render functions when it does not depend on
  props or state.
- Preserve semantic HTML, focus states, accessible names, and minimum target
  sizes when composing components.
- Review every token change in both light and dark themes.
