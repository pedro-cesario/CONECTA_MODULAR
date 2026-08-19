---
name: Clinical Clarity
colors:
  surface: '#f9f9ff'
  surface-dim: '#d9d9e1'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fa'
  surface-container: '#ededf5'
  surface-container-high: '#e7e7ef'
  surface-container-highest: '#e2e2e9'
  on-surface: '#191b21'
  on-surface-variant: '#424751'
  inverse-surface: '#2e3036'
  inverse-on-surface: '#f0f0f8'
  outline: '#737783'
  outline-variant: '#c3c6d3'
  surface-tint: '#285dad'
  primary: '#00387a'
  on-primary: '#ffffff'
  primary-container: '#134f9f'
  on-primary-container: '#a8c4ff'
  inverse-primary: '#acc7ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#642900'
  on-tertiary: '#ffffff'
  tertiary-container: '#883a00'
  on-tertiary-container: '#ffb38b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004492'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb68f'
  on-tertiary-fixed: '#331100'
  on-tertiary-fixed-variant: '#773200'
  background: '#f9f9ff'
  on-background: '#191b21'
  surface-variant: '#e2e2e9'
  urgent-red: '#DC2626'
  priority-orange: '#C2410C'
  warning-yellow: '#CA8A04'
  stable-green: '#15803D'
  info-blue: '#2563EB'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-page: 2rem
  gutter: 1.5rem
  card-padding: 1.25rem
  input-height: 48px
---

## Brand & Style

The design system embodies a **Corporate / Modern** aesthetic with a strategic infusion of **Glassmorphism** for entry points and high-level navigation. It is designed for healthcare professionals who require immediate data legibility and a sense of calm reliability. 

The personality is "Professional, Human, and Systematic." By moving away from high-contrast primary blocks toward a more sophisticated slate-based neutral palette, the interface reduces cognitive load and visual fatigue. The style utilizes soft translucent layers for authentication and high-density, flat "container-on-surface" logic for analytical dashboards, ensuring the product feels like a precision tool rather than a generic portal.

## Colors

The palette is anchored by the legacy primary blue, but it is supported by a comprehensive range of slates to provide depth without color-overload. 

- **Primary:** Used for primary actions, active navigation states, and brand-critical touchpoints.
- **Neutrals:** A "Slate" scale is utilized for all structural elements. Surface backgrounds use `Slate-50`, while borders use `Slate-200` to maintain a light, airy feel.
- **Semantic Health States:** These colors are strictly reserved for patient status and alerts. They should be used as backgrounds for badges (`50` weight) with high-contrast text (`800` weight) or as thin 4px decorative accents on card edges.

## Typography

This design system uses **Plus Jakarta Sans** for its contemporary, geometric proportions which remain highly legible at small sizes—essential for medical data. 

Hierarchy is established through weight shifts rather than massive size changes to maintain density. Labels for data points (e.g., "Patient ID", "Heart Rate") should use the `label-md` role in uppercase with slightly increased letter spacing. Headlines should utilize tighter line-heights and negative letter-spacing for a modern, "tucked" appearance.

## Layout & Spacing

The design system employs a **Fixed Grid** model for desktop dashboards to ensure data columns align predictably. 

- **Desktop (1180px+):** 12-column grid with a max-width of 1440px. 24px gutters.
- **Tablet (721px - 1179px):** Content reflows to 2 columns for dashboard cards; the sidebar collapses to an icon-only rail.
- **Mobile (≤720px):** Single-column stack. Margins reduce to 16px. Inter-card spacing is standardized to 12px to maximize screen real estate.

Spacing follows an 8px base unit, though component-specific padding (like card interiors) uses a 20px (1.25rem) value to feel more "open" and modern.

## Elevation & Depth

Visual hierarchy is communicated through a mix of **Tonal Layers** and **Glassmorphism**:

1.  **Level 0 (Background):** `Slate-50`.
2.  **Level 1 (Cards/Dashboard):** White surface with a `Slate-200` 1px border. No shadow is used for static cards to keep the UI clean; a soft `shadow-md` is applied only on hover.
3.  **Level 2 (Login/Overlays):** Glassmorphism is applied here. Backgrounds use `rgba(255, 255, 255, 0.7)` with a `24px` backdrop-blur. 
4.  **Level 3 (Modals):** High-diffusion ambient shadows (`shadow-lg`) with a slight tint of primary blue (`rgba(19, 79, 159, 0.08)`) to pull the element forward.

## Shapes

The design system moves away from sharp corners to create a more approachable, modern medical environment. 

- **Standard Components:** Buttons and Input fields use a 12px (rounded) corner.
- **Large Containers:** Dashboard cards and Modals use 24px (rounded-xl) corners.
- **Status Pills:** Badges and category tags use a full pill-shape (999px) for immediate visual distinction from interactive buttons.

## Components

### Buttons
Primary buttons use a subtle vertical gradient from `#134F9F` to `#1E5CB3`. They feature 12px rounded corners and a 2px hover lift. Secondary buttons use a `Slate-200` border with `Slate-700` text to remain professional and understated.

### High-Density Cards
Dashboards utilize flat white cards with a 1px border. Critical patient cards include a 4px left-hand border color-coded to their semantic health status (Red/Orange/Yellow/Green/Blue). Text density is high, utilizing `body-md` for data values.

### Input Fields
Inputs are 48px in height with a 12px radius. The border is a neutral `Slate-200`. On focus, the border transitions to Primary Blue with a soft 4px glow (outer shadow).

### Login Experience
The login container is a large-radius (28px) glassmorphic card set against a blurred photographic or abstract blue background, creating a premium first impression.

### Semantic Badges
Badges use a background color at 10% opacity of the semantic color with text at 90% opacity of the same hue. This ensures accessibility compliance while maintaining the color-coded "at-a-glance" system.