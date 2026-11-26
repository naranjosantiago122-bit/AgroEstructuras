---
name: AgroTech Dark Matrix
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffba61'
  on-tertiary: '#472a00'
  tertiary-container: '#ef9900'
  on-tertiary-container: '#5c3800'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
  canvas-void: '#020617'
  surface-card: '#1e293b'
  border-grid: '#334155'
  input-affordance: '#475569'
  spring-lime: '#4ade80'
  forest-deep: '#14532d'
  amber-structural: '#d97706'
  wireframe-blue: '#60a5fa'
  danger-alert: '#ef4444'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Work Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  metric-display:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a specialized, high-density telemetry and engineering environment tailored for agricultural civil engineering, greenhouse fabrication, and structural budgeting. It merges the exactitude of structural CAD software with the tactile responsiveness of modern developer tools.

### Personality & Audience
- **Target Audience:** Agronomists, greenhouse structural fabricators, agricultural civil engineers, and inventory cost analysts.
- **Brand Personality:** Precise, industrial, authoritative, and analytical. It projects structural reliability while feeling agile and modern.
- **Emotional Response:** High confidence in computational data, spatial clarity during 2.5D schematic configuration, and frictionless cost estimation under demanding operational conditions.

### Design Movement: High-Contrast Technical Minimalism
The interface leverages deep slate backgrounds to eliminate optical glare in indoor operations and outdoor field tablets. Crisp borders (`#334155`), neon architectural accents (emerald and spring green), and distinct functional tints (amber for Guadua/organic materials, blue for metallic-tubular frames) create an intuitive hierarchy. Flat surfaces are paired with subtle linear gradients, sharp tabular alignments, and responsive telemetry badges.

## Colors

The palette is engineered specifically for dark telemetry dashboards with high contrast and explicit domain-specific semantic mappings.

### Palette Architecture
- **Primary (`#22c55e`)**: Vibrant emerald indicating active states, budget totals, structural confirmations, and high-impact actions. Hover transitions shift to deeper emerald (`#16a34a`), while metrics and table currency values leverage high-luminosity spring green (`#4ade80`).
- **Secondary (`#3b82f6`)**: Technical blue used for mechanical specifications, tubular steel structural lines, input focus rings, and auxiliary actions.
- **Tertiary (`#f59e0b`)**: Warm structural amber dedicated to bio-materials (Guadua framing, bamboo profiles), material warnings, and pending inventory alerts.
- **Neutral Base (`#0f172a`)**: Deep slate foundation. Supported by `canvas-void` (`#020617`) for deep isometric viewport framing and `surface-card` (`#1e293b`) for elevated telemetry panels.
- **Borders & Dividers (`#334155`)**: Crisp 1px separators defining grid cards, input containers, and tabular matrices without clutter.

### Semantic Status Tokens
- **Structural Success & Grand Totals:** `rgba(34, 197, 94, 0.12)` background tint with `primary_color_hex` border.
- **Bio/Guadua Material Notices:** `rgba(245, 158, 11, 0.12)` fill with `tertiary_color_hex` border.
- **Tubular Engineering Notices:** `rgba(59, 130, 246, 0.12)` fill with `secondary_color_hex` border.
- **Critical Structural Exceedance / Error:** `danger-alert` (`#ef4444`) with dark red backdrop overlays.

## Typography

The type system balances technical engineering aesthetics with absolute computational legibility.

### Font Pairing
- **Headlines, Metrics & Labels:** **Space Grotesk**. Its sharp geometric terminal angles and technical proportions lend an industrial, blueprint-like aesthetic suited for structural dimensions, greenhouse naves, and financial totals.
- **Body & Data Tables:** **Work Sans**. Clean, neutral grotesque forms ensure dense bill-of-materials tables, inputs, and form descriptors remain comfortable to read during sustained workflows.

### Typographic Rules
- **Numerical Rigor:** All numbers in BOM (Bill of Materials), currency rows, and dimension specifications must render with tabular figures (`font-variant-numeric: tabular-nums`).
- **Uppercase Labels:** Micro-badges, table headers, and structural dimension category titles utilize `label-md` or `label-sm` with explicit tracking (`0.05em` to `0.08em`) in full uppercase.
- **Metric Clarity:** Primary KPIs (such as efficiency percentage and generated quotations) use `metric-display` in high-luminosity white or green accent.

## Layout & Spacing

The layout is structured around an information-dense 12-column engineering grid tailored for simultaneous parameter tuning and CAD visualization.

### Grid Architecture
- **Desktop (≥ 1280px):** 12-column layout. In calculation workflows, it operates as an asymmetric split view: 4 columns for parameter configuration panels and 8 columns for live isometric schematic viewports and BOM tables.
- **Tablet (768px - 1279px):** 6-column layout. Forms and simulation views stack sequentially while maintaining compact gutters.
- **Mobile (< 768px):** Single-column layout. Critical inputs and primary computed summaries are prioritized, while secondary tabular breakdowns collapse into expandable summary accordions.

### Spacing Philosophy
- Base unit is built on a 4px base increment (`0.25rem`).
- Internal component pads follow strict bounds: `space-sm` (8px) for inputs and mini buttons, `space-md` (16px) for nested parameter sub-groups and compact card bodies, and `space-lg` (24px) for full-width structural modules.
- Grid gaps stay locked at `gutter` (`1.5rem` / 24px) on desktop to preserve visual separation across dark containers.

## Elevation & Depth

Visual hierarchy does not rely on heavy drop shadows. Depth is communicated through calibrated surface luminance tiers, hairline contrast strokes, and localized atmospheric glows.

### Surface Tiers
- **Void Ground (`#020617`):** Recessed backdrop reserved exclusively for the 2.5D schematic Canvas viewport and code/formula displays.
- **Canvas Base (`#0f172a`):** Base canvas background across application views.
- **Panel Surface (`#1e293b`):** Primary level for structural cards, data tables, and input groupings.
- **Elevated Inset (`rgba(15, 23, 42, 0.65)`): Interactive input fields, select triggers, and nested sub-panels.

### Borders & Glows
- **Panel Boundaries:** 1px solid `#334155`. Cards use a 1px border without diffuse drop shadows.
- **Atmospheric Glows:** Primary buttons and active viewport banners apply subtle, color-tinted ambient glows (`0 8px 24px -4px rgba(34, 197, 94, 0.25)`) to direct attention to actionable triggers.
- **Accent Framing:** High-priority cards (such as the primary material selector or active project metrics) feature an authoritative `border-l-4` indicator along their left edge (using `#22c55e` for financial/general parameters or `#f59e0b` for bio-material configurations).

## Shapes

The design system uses structured, moderate roundedness that balances modern digital tool standards with engineering discipline.

### Geometry Hierarchy
- **Base Rounding (`0.5rem` / 8px):** Applied to form fields, nested badges, table container wrappers, and sub-panels.
- **Large Components (`1rem` / 16px):** Standard for main module cards, modal dialogs, and the CAD simulation container.
- **Extra Large (`1.5rem` / 24px):** Reserved for hero banners and onboarding summary blocks.
- **Pills (`9999px`):** Used selectively for telemetry status chips, numerical version indicators, and unit tags (e.g., `[COP]`, `[m²]`).

## Components

### Buttons
- **Primary Action (`.agro-btn`):** Background `#22c55e`, label `#ffffff` in `label-lg`, padding `12px 24px`, radius `0.5rem`. Hover shifts to `#16a34a` with ambient green shadow. Transition: `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
- **Secondary / Technical:** Background `rgba(59, 130, 246, 0.1)`, border `1px solid rgba(59, 130, 246, 0.4)`, text `#60a5fa`. Hover shifts to `rgba(59, 130, 246, 0.2)`.
- **Warning / Material Action:** Background `rgba(245, 158, 11, 0.1)`, border `1px solid rgba(245, 158, 11, 0.4)`, text `#fbbf24`.
- **Ghost Action:** Background transparent, text `#94a3b8`, border `1px solid transparent`. Hover background `#1e293b` with border `#334155`.

### Input Fields & Selects
- **Container:** Background `#1e293b` (or inset `#0f172a`), border `1px solid #334155`, text `#f8fafc`, typography `body-md`, radius `0.5rem`, padding `8px 12px`.
- **Prepend Affordance:** Left-attached unit box (e.g., `$`, `m`, `Naves`) using `#475569` text and `#334155` background divider.
- **Focus State:** Border transitions to `#3b82f6` with a ring of `0 0 0 2px rgba(59, 130, 246, 0.3)`.

### Cards & Panels
- **Standard Panel (`.card-gamer`):** Background `#1e293b`, border `1px solid #334155`, radius `0.75rem` (`12px`), padding `1.5rem`.
- **Variant - Accent Left Bar:** Left border augmented to `border-l-4 border-l-[#22c55e]` or `border-l-4 border-l-[#f59e0b]`.
- **Micro-Gradients:** Subtle top-to-bottom surface sheen: `linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0) 100%)`.

### Chips & Badges
- **Status Badges:** Text `label-sm`, padding `4px 10px`, radius `9999px`.
- **Tubular Type:** Background `rgba(59, 130, 246, 0.12)`, text `#60a5fa`, border `1px solid rgba(59, 130, 246, 0.3)`.
- **Guadua Type:** Background `rgba(245, 158, 11, 0.12)`, text `#fbbf24`, border `1px solid rgba(245, 158, 11, 0.3)`.
- **Total/Success:** Background `rgba(34, 197, 94, 0.12)`, text `#4ade80`, border `1px solid rgba(34, 197, 94, 0.3)`.

### Data Tables (Bill of Materials)
- **Header:** Background `#0f172a`, typography `label-md`, text `#94a3b8`, bottom border `1px solid #334155`.
- **Row:** Typography `body-md`, text `#cbd5e1`, border-bottom `1px solid #1e293b`. Zebra striping omitted in favor of hover highlight `rgba(255, 255, 255, 0.02)`.
- **Currency & Totals:** Aligned right, rendered in `Space Grotesk` with tabular figures in `#4ade80`.

### Simulation Canvas Viewport
- **Frame:** Background `#020617`, outer border `1px solid #334155`, inner shadow inset, radius `0.75rem`.
- **Overlay HUD:** Floating absolute badges displaying current view perspective, camera orientation, and live structural load flags.