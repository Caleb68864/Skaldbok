task: dragonbane_pwa_theme_foundation
goal: >
  Implement the full visual theme foundation for the Dragonbane-inspired character sheet PWA.
  Focus only on colors, fonts, design tokens, surfaces, borders, spacing, shadows, and reusable
  theme structure. Do not implement artwork, SVG ornaments, dragon stat bars, or decorative images yet.
  The result should feel like a rugged fantasy field book or adventurer's ledger in all modes.

project_context:
  app_name: Scaldmark
  subtitle: The Adventurer's Ledger
  app_type: offline-first tablet-friendly PWA
  inspiration:
    - Dragonbane character sheet visual language
    - fantasy field journal
    - ranger expedition notebook
    - dragon hunter ledger
    - parchment + ink + carved jade + crimson danger accents
  tone:
    - adventurous
    - tactile
    - readable
    - grounded
    - dangerous
    - old-world
  avoid:
    - glossy MMO UI
    - neon fantasy
    - bright blue sci-fi tones
    - generic corporate form styling
    - overly ornate unreadable fantasy fonts
    - pure white backgrounds
    - pure black backgrounds
    - excessive gradients
    - texture-heavy text panels

implementation_scope:
  include:
    - global CSS variable system or theme token system
    - light theme
    - dark theme
    - parchment theme
    - font import/setup
    - typography scale
    - semantic color tokens
    - surface/background tokens
    - border/radius/shadow tokens
    - reusable component styling foundations
    - buttons
    - inputs
    - cards/panels
    - tabs
    - headings
    - body text
    - muted/help text
    - status/accent colors
    - theme switching readiness
  exclude:
    - artwork
    - dragon head graphics
    - custom SVG ornaments
    - textured image assets
    - parchment texture image files
    - icon packs unless already in project
    - layout rewrites unrelated to theming
    - business logic changes

font_requirements:
  overall_strategy: >
    Use a font pairing system that feels fantasy-adjacent and field-book inspired,
    while staying highly readable for forms, mobile/tablet UI, and dense character data.
  fonts:
    heading_display:
      primary: Marcellus
      fallback: Georgia, serif
      usage:
        - page titles
        - section headers
        - modal headers
        - card titles
    ui_body:
      primary: Source Sans 3
      fallback: Arial, Helvetica, sans-serif
      usage:
        - form labels
        - buttons
        - stats
        - navigation
        - body UI text
        - tables
    lore_text_optional:
      primary: Source Serif 4
      fallback: Georgia, serif
      usage:
        - long-form descriptions
        - lore text
        - journal/note text
        - flavor sections
  implementation_notes:
    - Prefer importing from Google Fonts or equivalent package if appropriate for the stack
    - Ensure font loading is efficient
    - Do not use decorative fantasy fonts for body text
    - Keep headings flavorful but legible
    - Use consistent font assignments through variables/tokens

theme_principles:
  - Every theme should feel like part of the same Dragonbane-inspired product
  - Preserve a shared fantasy identity across light, dark, and parchment modes
  - Favor warm neutrals, ink tones, jade/verdigris greens, ember/crimson accents
  - Maintain strong readability and contrast
  - Use subtle depth and tactile styling
  - Make cards and controls feel like physical objects, not generic web widgets
  - Build all styles from reusable tokens rather than hardcoded values

themes:
  light:
    name: Camp Before the Hunt
    mood:
      - warm daylight
      - readable
      - adventurous
      - field ledger on a table
    colors:
      bg: "#EEE6D2"
      surface: "#F7F1E2"
      surface_alt: "#EAE0C7"
      text: "#2D241B"
      text_muted: "#6C5B46"
      accent: "#1F6E66"
      accent_alt: "#154B47"
      danger: "#B63828"
      border: "#A69170"
      gold: "#A98235"
      success: "#5D7A49"
      warning: "#B96A2A"
      info: "#3E6C73"

  dark:
    name: Torchlight in the Barrow
    mood:
      - torchlit dungeon
      - brooding
      - dangerous
      - premium
    colors:
      bg: "#121613"
      surface: "#1A211D"
      surface_alt: "#222B26"
      text: "#E9DFC7"
      text_muted: "#B5A88E"
      accent: "#2F877A"
      accent_alt: "#73B6AA"
      danger: "#D14935"
      border: "#3E4B43"
      gold: "#AA8240"
      success: "#6E8C54"
      warning: "#C07A35"
      info: "#6A9CA4"

  parchment:
    name: The Adventurer's Ledger
    mood:
      - tactile
      - analog
      - immersive
      - weathered but usable
    colors:
      bg: "#D9C59A"
      surface: "#E8D8B2"
      surface_alt: "#F1E4C8"
      text: "#3A2B18"
      text_muted: "#6B573C"
      accent: "#2B756B"
      accent_alt: "#184A46"
      danger: "#A52F22"
      border: "#8A7451"
      gold: "#9C7934"
      success: "#667C4A"
      warning: "#AF6D2B"
      info: "#52727A"

design_tokens:
  typography:
    font_display: "'Marcellus', Georgia, serif"
    font_ui: "'Source Sans 3', Arial, Helvetica, sans-serif"
    font_text: "'Source Serif 4', Georgia, serif"

    size_xs: "0.75rem"
    size_sm: "0.875rem"
    size_md: "1rem"
    size_lg: "1.125rem"
    size_xl: "1.25rem"
    size_2xl: "1.5rem"
    size_3xl: "1.875rem"

    weight_normal: 400
    weight_medium: 500
    weight_semibold: 600
    weight_bold: 700

    line_height_tight: 1.2
    line_height_normal: 1.5
    line_height_relaxed: 1.65

  spacing:
    space_1: "0.25rem"
    space_2: "0.5rem"
    space_3: "0.75rem"
    space_4: "1rem"
    space_5: "1.25rem"
    space_6: "1.5rem"
    space_8: "2rem"
    space_10: "2.5rem"

  radius:
    sm: "8px"
    md: "12px"
    lg: "16px"
    xl: "20px"

  shadows:
    soft: "0 2px 8px rgba(0,0,0,0.12)"
    medium: "0 6px 18px rgba(0,0,0,0.16)"
    deep: "0 10px 28px rgba(0,0,0,0.22)"
    inset_soft: "inset 0 1px 2px rgba(0,0,0,0.10)"

  borders:
    thin: "1px solid var(--color-border)"
    strong: "2px solid var(--color-border)"

semantic_tokens:
  - --color-bg
  - --color-surface
  - --color-surface-alt
  - --color-text
  - --color-text-muted
  - --color-accent
  - --color-accent-alt
  - --color-danger
  - --color-border
  - --color-gold
  - --color-success
  - --color-warning
  - --color-info
  - --font-display
  - --font-ui
  - --font-text
  - --radius-sm
  - --radius-md
  - --radius-lg
  - --radius-xl
  - --shadow-soft
  - --shadow-medium
  - --shadow-deep

component_styling_guidelines:
  app_shell:
    - Use theme background token
    - Ensure overall app chrome feels warm and grounded
    - Avoid stark blank space
    - Keep enough contrast for long use on tablet/mobile

  cards_panels:
    - Use surface and surface_alt tokens
    - Panels should feel like ledger sections or framed notes
    - Apply subtle borders and soft shadows
    - Avoid glossy card styling
    - Keep corners moderately rounded, not ultra-modern pill shapes

  headings:
    - Use display font
    - Use accent or danger color selectively
    - Keep readable letter spacing
    - Major page titles can feel dramatic, but section headers should remain practical

  body_text:
    - Use UI font by default
    - Use text token for primary content
    - Use muted token for helper text and metadata
    - Optionally allow lore/journal sections to use font_text

  buttons:
    primary:
      - Use accent background with readable contrast
      - Feel sturdy and tactile
      - Hover/focus states should deepen color or slightly lift
    secondary:
      - Use surface_alt with border
      - Maintain fantasy field-book tone
    danger:
      - Use danger color
      - Reserve for destructive actions
    all_buttons:
      - Use UI font
      - Avoid overly rounded modern SaaS look
      - Avoid shiny gradients

  inputs:
    - Should resemble inked or framed writing fields
    - Use subtle inset shadow if appropriate
    - Strong readable border
    - Background should harmonize with theme
    - Focus state should use accent token
    - Error state should use danger token
    - Disabled state should remain readable but muted

  tabs_navigation:
    - Use surface_alt and border styling
    - Active state should feel selected like a marked ledger section
    - Accent color should indicate selection
    - Avoid modern neon underline-only tab styling unless adapted to the theme

  tables_lists:
    - Maintain high legibility
    - Use alternating subtle surface tones if needed
    - Borders should feel inked and restrained
    - Headers should be clear and slightly emphasized

  modals_drawers:
    - Use stronger shadow
    - Maintain theme consistency
    - Header/title styling should use display font or elevated UI styling
    - Background dimming should support immersion without crushing contrast

interaction_states:
  hover:
    - subtle darken/lighten depending on theme
    - slight lift allowed on important controls
  active:
    - mild pressed effect
    - no flashy animations
  focus:
    - accessible visible focus ring using accent or gold
    - must be keyboard accessible
  disabled:
    - reduced contrast but still legible
  error:
    - use danger token clearly
  success:
    - use success token subtly but visibly

accessibility_requirements:
  - Preserve strong contrast for body text and important controls
  - Ensure all themes remain usable for long reading sessions
  - Focus states must be clearly visible
  - Avoid low-contrast decorative text
  - Use body font sizing suitable for tablet users
  - Decorative choices must never interfere with form completion

technical_requirements:
  - Centralize all design tokens in one theme source
  - Support switching themes via data attribute, CSS class, or equivalent theming mechanism
  - Avoid hardcoding component colors directly where tokens should be used
  - Ensure future artwork can be layered on top without rewriting the theme system
  - Organize styles so decorative assets can be added later cleanly
  - Prefer scalable maintainable CSS/SCSS/theme object structure depending on framework
  - Keep implementation ready for PWA/mobile use

deliverables:
  - theme token definitions for all three themes
  - font setup/import implementation
  - base typography styles
  - base component styles for cards, buttons, inputs, headings, tabs, and layout surfaces
  - clear theme-switching structure
  - concise comments explaining key token groups
  - no placeholder fantasy images unless already present in project

definition_of_done:
  - App supports light, dark, and parchment themes
  - Fonts are applied consistently and read well
  - Theme modes feel cohesive and fantasy field-book inspired
  - No artwork is required for the design to already feel on-brand
  - Components look intentionally themed rather than default browser controls
  - The system is ready for later addition of parchment textures and dragon-themed artwork