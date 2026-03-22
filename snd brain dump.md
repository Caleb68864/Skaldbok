> **Source Document:** [initial brain dump.md](initial%20brain%20dump.md)

# Skaldbok: The Adventurer's Ledger

---

# Part 1: Product Requirements Document

## App Identity and Source References

The Name of this app with be Skaldbok: The Adventurer's Ledger

  "C:\Users\CalebBennett\Documents\Notes\DragonBane\dragonbane_reference_blueprint.yaml"                                                                                                                                                  "C:\Users\CalebBennett\Documents\Notes\DragonBane\dragonbane_reference_sheet.yaml"                                                                                                                                                                                                                                                                                                                                                                                              "C:\Users\CalebBennett\Documents\Notes\DragonBane\Souce Docs\Dragonbane_The_Sinking_Tower_v1.1.pdf"                                                                                                                                                                                                                                                                                                                                                                               "C:\Users\CalebBennett\Documents\Notes\DragonBane\Souce Docs\Dragonbane_new_professions_v2.pdf"                                                                                                                                         "C:\Users\CalebBennett\Documents\Notes\DragonBane\Souce Docs\Dragonbane_Quickstart_Guide_v1.1.pdf"

## Document Metadata

```yaml
document:
  type: product_spec
  version: "1.0.0"
  status: draft-ready
  title: "Dragonbane Tablet Character Sheet PWA"
  subtitle: "Offline-first, installable, local-only RPG character tracker"
  authoring_intent: "Detailed implementation-ready specification for AI-assisted development"
  primary_target_model: "Claude Code / Clawed Code"
  intended_stack:
    frontend: "React + TypeScript + Vite"
    app_type: "Progressive Web App"
    storage: "IndexedDB"
    hosting_for_install: "localhost or static local server during installation"
    runtime_mode: "Browser-only after installation"
  summary: >
    Build a tablet-first, offline-first, installable web application for tracking
    Dragonbane characters during play. The app must function as a character sheet
    and play tracker, not a VTT, not a note-taking app, and not a rules compendium.
    It must support multiple saved characters in a local library, but only one active
    character open at a time. It must support Dragonbane first, while being structured
    so that future systems can reuse the architecture through JSON-driven system and
    character definitions without attempting full multi-system genericity in V1.
```

## Product Definition

```yaml
product:
  name: "Dragonbane Character Sheet PWA"
  codename: "Dragonbane Terminal"
  vision: >
    A reliable, beautiful, touch-friendly, always-available character sheet app for
    Android tablets that works offline, installs once, stores data locally, and is
    fast to use during actual tabletop play.
  elevator_pitch: >
    A fillable-PDF-plus experience designed for Dragonbane, with touch-friendly screens,
    offline storage, fast character switching, combat-friendly controls, spell and heroic
    ability views, and a Dragonbane-inspired visual theme.
  product_positioning:
    category: "Tablet-first RPG character tracker"
    not_category:
      - "Virtual tabletop"
      - "Online sync app"
      - "Rules piracy container"
      - "Campaign journal"
      - "Backend-heavy SaaS"
    differentiators:
      - "Offline-first after install"
      - "Designed for real tablet use at the table"
      - "Play Mode and Edit Mode separation"
      - "Dragonbane-flavored presentation with function-first UX"
      - "JSON-driven system and character structure"
```

## Goals

```yaml
goals:
  primary_goals:
    - "Must work offline after installation and first load"
    - "Must be installable on Android tablet as a PWA"
    - "Must store all character data locally on the device"
    - "Must support a library of many characters"
    - "Must allow only one active character open at a time"
    - "Must provide fast, touch-friendly access to frequently used play data"
    - "Must support import/export of character data as JSON"
    - "Must visually support Dragonbane style without sacrificing usability"
    - "Must support dark mode, parchment mode, and light mode"
    - "Must separate Play Mode from Edit Mode"
    - "Must include spell and heroic ability management views"
    - "Must avoid copyrighted rules text"
  secondary_goals:
    - "Make future system expansion easier through JSON-driven definitions"
    - "Support derived values with override capability"
    - "Support fullscreen and keep-awake options where available"
    - "Be simple to host locally for installation"
  success_criteria:
    - "User can install app from local server to Android tablet"
    - "User can open app with no internet and continue using it"
    - "User can edit or create a character, close the app, reopen later, and data persists"
    - "User can track HP, WP, conditions, spells, and equipment during live play without frustration"
    - "User can switch between saved characters quickly"
    - "User can import/export character JSON without data loss"
```

## Non-Goals

```yaml
non_goals:
  - "No dice rolling in V1"
  - "No online sync in V1"
  - "No user accounts or authentication in V1"
  - "No backend API in V1"
  - "No multiplayer or party state sync in V1"
  - "No PDF import in V1"
  - "No OCR in V1"
  - "No GM campaign/session management in V1"
  - "No full legal-text rules reference"
  - "No generic drag-and-drop form builder in V1"
  - "No arbitrary formula scripting engine in V1"
  - "No full system-agnostic RPG platform in V1"
```

## Users

```yaml
users:
  primary_user:
    description: >
      A tabletop RPG player using an Android tablet at the table, often with weak or
      nonexistent internet, who needs a reliable, persistent, touch-friendly character sheet.
    needs:
      - "Always available offline"
      - "Easy to read"
      - "Fast updates during play"
      - "No accidental edits to structural data during play"
      - "No need for cloud, login, or backend"
  secondary_user:
    description: >
      A tinkering RPG player who may later want to define or import custom sheets or even
      adapt the architecture for another RPG system.
    needs:
      - "JSON import/export"
      - "Data-driven fields where sensible"
      - "Clear schemas"
      - "Simple manual customization"
```

## Platform Requirements

```yaml
platform_requirements:
  primary_platform:
    device_type: "Android tablet"
    browser: "Chrome preferred"
    orientation_support:
      - "Portrait"
      - "Landscape"
  installation_model:
    description: >
      App is served once from localhost or a local static server, opened in tablet browser,
      and installed as a PWA. After installation and first cache/storage population, app
      is expected to function offline.
  connectivity_model:
    required_for_first_install: true
    required_for_normal_use_after_install: false
    required_for_character_use: false
  offline_policy:
    description: >
      After installation and initial app-shell caching, the app must operate entirely offline
      for character loading, editing, viewing, and storage.
    allowed_online_behaviors:
      - "Optional future updates when online"
    disallowed_online_dependencies:
      - "Fetching character data from server during normal use"
      - "Fetching UI definitions during normal use"
      - "Fetching rules text or remote assets during play"
```

## Core Principles

```yaml
core_principles:
  - "Function first"
  - "Offline first"
  - "Touch first"
  - "Readability over ornament"
  - "Fast path for common play actions"
  - "Data safety over cleverness"
  - "Keep V1 constrained and finishable"
  - "Dragonbane first, extensible later"
  - "No copyright risk through copied rules text"
```

## Information Architecture

### Navigation Model

```yaml
information_architecture:
  navigation_model:
    recommended_pattern: "Bottom navigation + top action bar"
    rationale: >
      Bottom navigation is thumb-friendly on tablets and remains accessible while preserving
      more vertical space than persistent top tabs. The top action bar can hold global actions.
    top_action_bar:
      contents:
        - "Active character name"
        - "Mode toggle (Play/Edit)"
        - "Theme toggle or theme menu"
        - "Fullscreen toggle"
        - "Wake lock toggle"
        - "Overflow menu"
    bottom_nav_items:
      - id: "sheet"
        label: "Sheet"
      - id: "skills"
        label: "Skills"
      - id: "gear"
        label: "Gear"
      - id: "magic"
        label: "Magic"
      - id: "combat"
        label: "Combat"
    overflow_menu_items:
      - "Character Library"
      - "Import Character"
      - "Export Character"
      - "Settings"
      - "Reference"
      - "About"
```

### Screens

```yaml
  screens:
    - id: "character_library"
      purpose: "View, create, import, export, duplicate, delete, and activate characters"
    - id: "sheet"
      purpose: "Main overview for current character"
    - id: "skills"
      purpose: "View and edit skill values and related traits"
    - id: "gear"
      purpose: "Manage inventory, coins, armor, helmet, weapons, and encumbrance"
    - id: "magic"
      purpose: "Spellbook and heroic abilities"
    - id: "combat"
      purpose: "Large controls for in-session updates"
    - id: "reference"
      purpose: "User-authored paraphrased rules notes and reminders"
    - id: "settings"
      purpose: "App settings, theme, display, import/export helpers"
```

## Interaction Modes

```yaml
interaction_modes:
  modes:
    - id: "play"
      label: "Play Mode"
      goals:
        - "Fast updates"
        - "Prevent accidental deep edits"
        - "Large controls"
      editable_items:
        - "HP"
        - "WP"
        - "Conditions"
        - "Death rolls"
        - "Possibly equipped weapon"
        - "Possibly equipped armor state"
      non_editable_items:
        - "Base attributes"
        - "Core identity fields"
        - "Structural skill setup"
        - "Schema definitions"
    - id: "edit"
      label: "Edit Mode"
      goals:
        - "Full character editing"
        - "Detailed configuration"
      editable_items:
        - "Identity fields"
        - "Attributes"
        - "Skills"
        - "Weapons"
        - "Armor"
        - "Inventory"
        - "Spells"
        - "Heroic abilities"
        - "Overrides"
        - "Reference notes"
  mode_guardrails:
    - "Play Mode must not expose destructive structural edits inline"
    - "Edit Mode may expose inline and modal editing"
    - "Mode state must be visually obvious"
    - "App must default back to last used mode for the active character or a global preference"
```

## Theme System

```yaml
theme_system:
  themes:
    - id: "dark"
      priority: "primary"
      description: "Preferred default for table use"
      characteristics:
        - "Dark backgrounds"
        - "High contrast"
        - "Muted fantasy accents"
    - id: "parchment"
      priority: "secondary"
      description: "Dragonbane-inspired thematic mode"
      characteristics:
        - "Parchment-style background"
        - "Green/teal ornamental accents"
        - "Red danger emphasis"
        - "Controlled decorative scrollwork"
    - id: "light"
      priority: "tertiary"
      description: "Standard bright mode"
      characteristics:
        - "Minimal fantasy ornamentation"
        - "High readability"
  theme_guardrails:
    do:
      - "Use ornamentation sparingly"
      - "Keep all text readable"
      - "Keep controls large and obvious"
      - "Support theme switching without reload"
    dont:
      - "Do not sacrifice contrast for style"
      - "Do not use noisy textures behind dense text"
      - "Do not make fantasy theme slower or harder to read"
      - "Do not hardcode theme colors into components"
  implementation_notes:
    recommended_approach: "CSS variables or design tokens by theme"
    theme_storage: "Persist current theme locally"
```

## System Architecture

```yaml
system_architecture:
  architecture_style: "Frontend-only PWA with local persistence"
  components:
    app_shell:
      responsibilities:
        - "Bootstrap app"
        - "Register service worker"
        - "Load current system config"
        - "Load active character"
        - "Provide global context"
    routing:
      style: "Client-side routing"
      responsibilities:
        - "Manage screen transitions"
        - "Support direct screen restoration"
    storage_layer:
      responsibilities:
        - "Persist characters"
        - "Persist settings"
        - "Persist active character id"
        - "Persist imported system definitions"
    import_export_layer:
      responsibilities:
        - "Validate JSON"
        - "Transform versions if needed"
        - "Allow character backup and restore"
    ui_schema_layer:
      responsibilities:
        - "Render field groups based on system/sheet definitions"
        - "Keep app Dragonbane-first while enabling future expansion"
    domain_logic_layer:
      responsibilities:
        - "Derived values"
        - "Validation"
        - "Play/Edit mode rules"
        - "Visibility rules"
    pwa_layer:
      responsibilities:
        - "Manifest"
        - "Offline caching"
        - "Installability"
        - "Version update handling"
  backend:
    included_in_v1: false
    future_option: "Optional if sync or sharing is later desired"
```

## Storage

```yaml
storage:
  primary_database:
    type: "IndexedDB"
    rationale: >
      Structured data, multiple entities, persistence, and better suitability than localStorage.
  secondary_storage:
    type: "localStorage"
    allowed_uses:
      - "Current theme"
      - "Last opened route"
      - "Simple UI preferences"
    disallowed_uses:
      - "Full character data"
      - "Large structured datasets"
  database_collections:
    - name: "characters"
      purpose: "All stored character records"
    - name: "systems"
      purpose: "Imported or bundled system definitions"
    - name: "appSettings"
      purpose: "Global app settings"
    - name: "referenceNotes"
      purpose: "User-authored shorthand reference snippets"
    - name: "metadata"
      purpose: "Versioning and migration metadata"
  storage_guardrails:
    do:
      - "Autosave on meaningful edits"
      - "Version stored entities"
      - "Validate imported JSON before persistence"
      - "Keep transactions simple"
    dont:
      - "Do not require server reconciliation"
      - "Do not store all state in a giant single blob if avoidable"
      - "Do not assume storage writes never fail"
  backup_strategy:
    primary: "Manual JSON export"
    future_optional: "Automatic export reminder"
  migrations:
    required: true
    strategy: >
      Every stored system and character entity must include a schema/version field so
      future migrations can transform old data safely.
```

## Data Model

```yaml
data_model:
  philosophy: >
    Use a stable application model with JSON-driven system and character definitions.
    Avoid building a universal RPG engine in V1. Keep flexible where helpful, fixed
    where necessary.
  core_entities:
    system_definition:
      description: >
        Describes a ruleset and sheet structure at a high level. Dragonbane is the only
        required bundled system in V1.
      fields:
        id: "string"
        version: "string"
        name: "string"
        displayName: "string"
        themesSupported: "string[]"
        attributes: "AttributeDefinition[]"
        conditions: "ConditionDefinition[]"
        resources: "ResourceDefinition[]"
        sections: "SectionDefinition[]"
        skills: "SkillDefinition[]"
        fieldDefinitions: "FieldDefinition[]"
        derivedFields: "DerivedFieldDefinition[]"
        itemSchemas: "ItemSchemaDefinition[]"
    character_record:
      description: "Single persisted character"
      fields:
        id: "string"
        schemaVersion: "string"
        systemId: "string"
        name: "string"
        metadata: "CharacterMetadata"
        values: "Record<string, unknown>"
        skills: "CharacterSkillValue[]"
        weapons: "CharacterWeapon[]"
        inventory: "CharacterItem[]"
        spells: "CharacterSpell[]"
        heroicAbilities: "CharacterAbility[]"
        conditions: "Record<string, boolean>"
        resources: "Record<string, number>"
        derivedOverrides: "Record<string, unknown>"
        uiState: "CharacterUiState"
        timestamps: "CreatedUpdatedMetadata"
    app_settings:
      fields:
        activeCharacterId: "string | null"
        activeSystemId: "string"
        themeId: "string"
        wakeLockPreference: "boolean"
        fullscreenPreference: "boolean"
        preferredMode: "'play' | 'edit'"
  dragonbane_expected_fields:
    metadata_fields:
      - "playerName"
      - "characterName"
      - "kin"
      - "profession"
      - "age"
      - "appearance"
      - "weakness"
    attributes:
      - "str"
      - "con"
      - "agl"
      - "int"
      - "wil"
      - "cha"
    conditions:
      - "exhausted"
      - "sickly"
      - "dazed"
      - "angry"
      - "scared"
      - "disheartened"
    resources:
      - "hp"
      - "wp"
      - "deathRolls"
      - "silver"
      - "gold"
      - "copper"
    derived_values_examples:
      - "movement"
      - "damageBonusStrength"
      - "damageBonusAgility"
      - "encumbranceLimit"
  model_guardrails:
    do:
      - "Keep system definition declarative"
      - "Keep character records portable"
      - "Separate user data from system definitions"
      - "Use stable ids for fields and definitions"
    dont:
      - "Do not rely on display labels as keys"
      - "Do not hardcode all Dragonbane fields directly into UI components"
      - "Do not create a fully arbitrary layout engine in V1"
```

## JSON Schema Strategy

```yaml
json_schema_strategy:
  overview: >
    System definitions and character files must be serializable JSON objects with explicit
    schemaVersion fields. Import must validate shape, reject invalid structure, and report
    errors clearly.
  bundled_content:
    - "One bundled Dragonbane system definition"
    - "Optional sample blank Dragonbane character template"
  importable_content:
    - "Character JSON"
    - "System JSON, optional in V1 if useful"
  exportable_content:
    - "Character JSON"
  validation_rules:
    - "Every imported file must declare schemaVersion"
    - "Character import must declare systemId"
    - "Unknown fields may be preserved if harmless"
    - "Invalid required fields must block import"
    - "Import errors must be human-readable"
  future_expansion:
    description: >
      The JSON approach should make it easier to adapt the app later for another system,
      but V1 does not promise full compatibility with arbitrary systems.
```

## UI Component Strategy

```yaml
ui_component_strategy:
  philosophy: "Reusable field renderers, not a universal form generator"
  component_types:
    - "NumericField"
    - "TextField"
    - "ToggleChip"
    - "CounterControl"
    - "CardList"
    - "EditableList"
    - "DrawerEditor"
    - "SectionPanel"
    - "DerivedFieldDisplay"
    - "ModeAwareField"
    - "ResourceTracker"
  editing_patterns:
    inline_for:
      - "Short numeric values"
      - "Simple toggles"
      - "HP/WP counters"
      - "Conditions"
      - "Simple skill values"
    modal_or_drawer_for:
      - "Weapon editing"
      - "Spell editing"
      - "Ability editing"
      - "Inventory item editing"
      - "Metadata forms"
      - "Import/export"
  screen_guardrails:
    do:
      - "Favor cards and grouped panels"
      - "Keep large touch targets"
      - "Use sticky nav and top actions"
      - "Use obvious save/autosave feedback"
    dont:
      - "Do not create giant dense forms on one screen"
      - "Do not rely on hover states"
      - "Do not require pinch zoom"
      - "Do not bury common actions in deep menus"
```

## Screen Specs

### Character Library

```yaml
screen_specs:
  character_library:
    purpose: "Manage locally stored characters"
    required_features:
      - "List all characters"
      - "Create new character"
      - "Import character JSON"
      - "Export selected character"
      - "Duplicate character"
      - "Delete character with confirmation"
      - "Set active character"
    ui_requirements:
      - "Card or list layout suitable for tablet"
      - "Visible current active character"
      - "Search/filter optional"
    guardrails:
      do:
        - "Show character name and system"
        - "Make active/open action one tap"
      dont:
        - "Do not auto-delete without confirmation"
```

### Sheet Screen

```yaml
  sheet_screen:
    purpose: "At-a-glance overview of the active character"
    required_sections:
      - "Identity summary"
      - "Attributes"
      - "Conditions"
      - "Resources"
      - "Derived values"
      - "Quick equipment summary"
      - "Quick navigation tiles"
    play_mode_behavior:
      - "Only quick-change items editable"
    edit_mode_behavior:
      - "All displayed fields editable where appropriate"
```

### Skills Screen

```yaml
  skills_screen:
    purpose: "View and edit skill-related data"
    required_features:
      - "Group skills by category"
      - "Show all system skills or relevant-first with toggle"
      - "Edit numeric values"
      - "Optional trained/favorite visibility control"
    design_notes: >
      Default view should favor relevance and readability, with optional show-all toggle.
```

### Gear Screen

```yaml
  gear_screen:
    purpose: "Manage carried and equipped items"
    required_features:
      - "Weapons list"
      - "Armor/helmet controls"
      - "Inventory items"
      - "Tiny items"
      - "Memento"
      - "Coins"
      - "Encumbrance helper"
```

### Magic Screen

```yaml
  magic_screen:
    purpose: "Spellbook and heroic abilities"
    required_features:
      - "Spell cards"
      - "Heroic ability cards"
      - "Custom freeform entries"
      - "Can-cast filter by current WP"
      - "Collapse/expand details"
    design_notes:
      - "Treat this as a high-readability, low-fiddliness screen"
      - "Cards should be large and touch-friendly"
```

### Combat Screen

```yaml
  combat_screen:
    purpose: "Fast live-play interaction"
    required_features:
      - "Large HP controls"
      - "Large WP controls"
      - "Condition toggles"
      - "Death rolls"
      - "Quick equipped weapon view"
      - "Quick armor/helmet summary"
    guardrails:
      do:
        - "Prioritize visibility and speed"
      dont:
        - "Do not overload with editing options"
```

### Reference Screen

```yaml
  reference_screen:
    purpose: "User-authored shorthand reference"
    constraints:
      - "Must not ship copyrighted rules text"
      - "Allow paraphrased reminders only"
    required_features:
      - "Editable note cards"
      - "Simple categories or tags"
```

## Dragonbane-Specific Requirements

```yaml
dragonbane_specific_requirements:
  scope: "Supported as the first-class bundled system"
  must_support:
    - "Attributes"
    - "Conditions"
    - "HP/WP"
    - "Skills"
    - "Weapons"
    - "Armor and helmet"
    - "Inventory"
    - "Spells"
    - "Heroic abilities"
    - "Death rolls"
    - "Coins"
    - "Derived fields where appropriate"
  must_not_include:
    - "Verbatim copyrighted rules text"
    - "Scanned official sheet art"
    - "Unlicensed reproduction of book content"
  allowed_content:
    - "Original UI styling inspired by fantasy and Dragonbane mood"
    - "User-authored paraphrases"
    - "Field labels and character structure"
    - "Original icons, borders, and visual motifs"
```

## Play Flow Requirements

```yaml
play_flow_requirements:
  startup_flow:
    - "App opens quickly"
    - "If active character exists, open last-used route for that character"
    - "If no character exists, open Character Library"
  in_session_flow:
    - "Open app"
    - "View main character"
    - "Switch to Combat or Magic quickly"
    - "Adjust HP/WP/conditions rapidly"
    - "Close app or lock device"
    - "Reopen later with state preserved"
  edit_flow:
    - "Switch to Edit Mode"
    - "Update stats, gear, spells, abilities"
    - "Changes autosave"
    - "Return to Play Mode"
  import_flow:
    - "Open Character Library or menu"
    - "Choose JSON file"
    - "Validate"
    - "Preview or confirm"
    - "Persist locally"
    - "Optionally activate imported character"
  export_flow:
    - "Select current or library character"
    - "Export JSON"
    - "Trigger download/share"
```

## Derived Values

```yaml
derived_values:
  requirement: "Automatic where possible, with override support"
  examples:
    - id: "movement"
      behavior: "Derived by configured system rules if possible"
    - id: "encumbranceLimit"
      behavior: "Derived, but may be manually overridden"
  override_behavior:
    required: true
    rules:
      - "User may override derived values in Edit Mode"
      - "Override must be visibly marked"
      - "User may reset override to auto-calculated value"
  guardrails:
    do:
      - "Keep derivation rules simple"
      - "Centralize derived logic"
    dont:
      - "Do not hide whether a value is computed or overridden"
      - "Do not make derivation engine arbitrarily scriptable in V1"
```

## PWA Requirements

```yaml
pwa_requirements:
  required_features:
    - "Web app manifest"
    - "Service worker"
    - "Offline app-shell caching"
    - "Installable experience"
  caching_strategy:
    app_shell: "Precache essential assets"
    runtime_data: "Local database, not network"
    updates: "Prompt user when a new version is available"
  fullscreen:
    required: true
    behavior:
      - "Offer a fullscreen toggle"
      - "Gracefully handle denial or unsupported environments"
  wake_lock:
    required: true
    behavior:
      - "Offer a keep-awake toggle"
      - "Gracefully handle unsupported environments or revocation"
      - "Show status visibly"
  pwa_guardrails:
    do:
      - "Design for offline-first"
      - "Detect and message unsupported features gracefully"
    dont:
      - "Do not break app functionality if fullscreen or wake lock fails"
      - "Do not assume service worker update timing"
```

## Performance Requirements

```yaml
performance_requirements:
  goals:
    initial_load_after_install: "Fast enough to feel immediate on tablet"
    route_switching: "Instant or near-instant"
    local_save: "Non-blocking and fast"
    character_switching: "Quick and predictable"
  constraints:
    - "No large remote dependencies at runtime"
    - "Keep bundle size reasonable"
    - "Avoid giant monolithic state updates"
  do:
    - "Use lazy loading where sensible"
    - "Memoize heavy derived computations if needed"
    - "Keep imported character payloads modest"
  dont:
    - "Do not over-engineer micro-optimizations before profiling"
    - "Do not require network to render core screens"
```

## Accessibility Requirements

```yaml
accessibility_requirements:
  must_have:
    - "Readable text"
    - "Large touch targets"
    - "Clear icon plus label for key actions"
    - "Theme contrast suitable for dark mode"
    - "No hover-only interactions"
  should_have:
    - "Keyboard support where practical"
    - "Focus styles"
    - "Semantic headings and regions"
  dont:
    - "Do not rely solely on color to communicate state"
```

## Security and Privacy

```yaml
security_and_privacy:
  privacy_model: "Local-only by default"
  data_collection: "None in V1"
  authentication: "None in V1"
  security_requirements:
    - "Validate imported JSON"
    - "Avoid unsafe HTML rendering from imported content"
    - "Escape or sanitize user-entered text where needed"
  do:
    - "Treat imports as untrusted"
  dont:
    - "Do not execute scripts from imported JSON"
    - "Do not embed raw HTML from character files"
```

## Error Handling

```yaml
error_handling:
  principles:
    - "Fail safely"
    - "Never silently discard character data"
    - "Show understandable messages"
  required_cases:
    - "Import validation failure"
    - "Storage failure"
    - "Wake lock unsupported"
    - "Fullscreen unsupported"
    - "Malformed character data"
    - "Migration failure"
  recovery_requirements:
    - "Preserve existing data when import fails"
    - "Allow retry for imports"
    - "Fallback to safe view when rendering unexpected fields"
```

## Testing Strategy

```yaml
testing_strategy:
  unit_tests:
    targets:
      - "Validation"
      - "Derived value calculations"
      - "Import/export transforms"
      - "Mode visibility logic"
  integration_tests:
    targets:
      - "Character creation"
      - "Character import/export"
      - "Mode switching"
      - "Persistence across reload"
      - "Character switching"
  manual_test_matrix:
    devices:
      - "Android tablet Chrome"
      - "Desktop Chrome for development"
    scenarios:
      - "Offline after install"
      - "Close/reopen app"
      - "Full session use in Play Mode"
      - "Edit then return to Play Mode"
      - "Import malformed JSON"
      - "Theme switching"
      - "Fullscreen and wake lock toggles"
  acceptance_tests:
    - "Create character, save, reload, data persists"
    - "Import character JSON, switch active character, reopen app, state persists"
    - "Use app offline with no network after initial install"
    - "Adjust HP/WP/conditions in Play Mode with large controls"
```

## Development Phases

```yaml
development_phases:
  phase_0_discovery:
    goals:
      - "Confirm field model for Dragonbane"
      - "Define JSON schemas"
      - "Define component map"
      - "Choose IndexedDB wrapper or small custom layer"
    deliverables:
      - "System schema"
      - "Character schema"
      - "Wireframe notes"
  phase_1_foundation:
    goals:
      - "Scaffold app"
      - "Implement PWA basics"
      - "Implement storage"
      - "Implement character library"
      - "Implement theme system"
      - "Implement Dragonbane system config"
    deliverables:
      - "Installable shell"
      - "Persistent local storage"
      - "Character list and activation"
  phase_2_core_sheet:
    goals:
      - "Implement main sheet"
      - "Implement skills"
      - "Implement gear"
      - "Implement magic"
      - "Implement edit/play mode"
    deliverables:
      - "Usable offline character tracker"
  phase_3_live_play_features:
    goals:
      - "Implement combat screen"
      - "Implement fullscreen"
      - "Implement wake lock"
      - "Implement derived values with override"
      - "Implement reference notes"
    deliverables:
      - "Table-ready experience"
  phase_4_polish:
    goals:
      - "Improve visuals"
      - "Improve animations subtly"
      - "Refine touch targets"
      - "Improve validation and migration paths"
      - "Add optional filters and favorites"
    deliverables:
      - "Polished release candidate"
```

## Tech Stack Recommendation

```yaml
tech_stack_recommendation:
  required:
    - "React"
    - "TypeScript"
    - "Vite"
    - "vite-plugin-pwa"
  recommended:
    - "Zod for validation"
    - "React Router"
    - "Dexie or a thin IndexedDB wrapper"
  optional:
    - "TanStack Query not needed unless architecture later expands"
    - "State library optional; React context + reducer may be enough"
  styling:
    preferred_options:
      - "CSS modules"
      - "Tailwind if desired"
      - "Plain CSS variables for themes"
    recommendation: "Use whatever keeps theme tokens clear and maintainable"
  constraints:
    do:
      - "Keep dependency count modest"
      - "Choose boring stable tools"
    dont:
      - "Do not introduce backend frameworks"
      - "Do not add sync libraries in V1"
```

## File Structure Recommendation

```yaml
file_structure_recommendation:
  root:
    - "src/"
    - "public/"
    - "schemas/"
    - "sample-data/"
    - "docs/"
  src_subdirs:
    - "app/"
    - "components/"
    - "screens/"
    - "features/"
    - "storage/"
    - "systems/"
    - "theme/"
    - "utils/"
    - "types/"
    - "pwa/"
  file_notes:
    - "systems/dragonbane/ should hold bundled Dragonbane definition JSON"
    - "schemas/ should hold Zod or JSON schema definitions"
    - "sample-data/ may hold blank/sample character files"
    - "docs/ may hold design notes and migration docs"
```

## Do and Don't Master List

```yaml
do_and_dont_master_list:
  do:
    - "Build for offline use first"
    - "Make touch targets large"
    - "Separate Play Mode and Edit Mode"
    - "Use JSON-driven definitions where it reduces hardcoding"
    - "Keep character data portable"
    - "Autosave safely"
    - "Preserve user data at all costs"
    - "Keep visuals evocative but restrained"
    - "Support easy character import/export"
    - "Design around actual live tabletop use"
  dont:
    - "Do not chase full multi-system genericity in V1"
    - "Do not require a backend"
    - "Do not rely on internet during play"
    - "Do not reproduce copyrighted rules text"
    - "Do not overload one screen with all editable fields"
    - "Do not make common actions hidden or tiny"
    - "Do not build dice rolling into V1"
    - "Do not assume wake lock/fullscreen always works"
    - "Do not let theme styling reduce readability"
```

## Guardrails

```yaml
guardrails:
  product_guardrails:
    - "Every feature must answer: does this improve actual tablet-at-the-table use?"
    - "If a feature smells like GM tooling, campaign management, or cloud sync, it is out of V1 scope"
    - "If a feature increases genericity but delays Dragonbane usefulness, defer it"
  design_guardrails:
    - "Readability beats decoration"
    - "Large buttons beat tiny elegant controls"
    - "Short tap path beats maximal configurability"
  engineering_guardrails:
    - "Prefer simple declarative schemas over runtime meta-programming"
    - "Prefer stable local persistence over clever abstractions"
    - "Prefer additive migrations over destructive changes"
  content_guardrails:
    - "No copyrighted rules text bundled into app"
    - "Only original paraphrases or user-created notes"
    - "No scanned sheet or book assets"
```

## Future Expansion Notes

```yaml
future_expansion_notes:
  possible_phase_2_or_3_plus:
    - "Savage Worlds support through new system definition and targeted UI extension"
    - "Additional system packs"
    - "Printable sheet export"
    - "Portrait/image attachments"
    - "More robust reference snippets"
  explicit_warning: >
    Future multi-system support should be approached as incremental reuse of the architecture,
    not as a promise that any arbitrary RPG system JSON will work automatically.
```

## Sample System Definition Shape

```yaml
sample_system_definition_shape:
  description: "Illustrative example only"
  code: |
    {
      "id": "dragonbane",
      "version": "1.0.0",
      "name": "dragonbane",
      "displayName": "Dragonbane",
      "themesSupported": ["dark", "parchment", "light"],
      "attributes": [
        { "id": "str", "label": "STR", "type": "number" },
        { "id": "con", "label": "CON", "type": "number" },
        { "id": "agl", "label": "AGL", "type": "number" },
        { "id": "int", "label": "INT", "type": "number" },
        { "id": "wil", "label": "WIL", "type": "number" },
        { "id": "cha", "label": "CHA", "type": "number" }
      ],
      "conditions": [
        { "id": "exhausted", "label": "Exhausted" },
        { "id": "sickly", "label": "Sickly" },
        { "id": "dazed", "label": "Dazed" },
        { "id": "angry", "label": "Angry" },
        { "id": "scared", "label": "Scared" },
        { "id": "disheartened", "label": "Disheartened" }
      ],
      "resources": [
        { "id": "hp", "label": "HP", "type": "counter" },
        { "id": "wp", "label": "WP", "type": "counter" },
        { "id": "deathRolls", "label": "Death Rolls", "type": "counter" }
      ]
    }
```

## Sample Character Shape

```yaml
sample_character_shape:
  description: "Illustrative example only"
  code: |
    {
      "id": "char-001",
      "schemaVersion": "1.0.0",
      "systemId": "dragonbane",
      "name": "Victor Vale",
      "metadata": {
        "playerName": "Caleb",
        "kin": "Human",
        "profession": "Mage",
        "age": "37",
        "appearance": "Tall, grim, slightly haunted",
        "weakness": "Reckless curiosity"
      },
      "values": {
        "str": 10,
        "con": 13,
        "agl": 14,
        "int": 17,
        "wil": 16,
        "cha": 12
      },
      "conditions": {
        "exhausted": false,
        "sickly": false,
        "dazed": false,
        "angry": false,
        "scared": false,
        "disheartened": false
      },
      "resources": {
        "hp": 13,
        "wp": 16,
        "deathRolls": 0,
        "silver": 12,
        "gold": 1,
        "copper": 4
      },
      "skills": [
        { "id": "awareness", "value": 12 },
        { "id": "evade", "value": 11 },
        { "id": "animism", "value": 0 },
        { "id": "mentalism", "value": 14 }
      ],
      "spells": [
        {
          "id": "spell-001",
          "name": "Telekinetic Push",
          "wpCost": 2,
          "summary": "Short paraphrase entered by user."
        }
      ],
      "heroicAbilities": [
        {
          "id": "ha-001",
          "name": "Scholar of the Hidden",
          "summary": "Custom shorthand note."
        }
      ],
      "weapons": [],
      "inventory": [],
      "derivedOverrides": {},
      "uiState": {
        "favoriteSpells": ["spell-001"],
        "lastMode": "play"
      },
      "timestamps": {
        "createdAt": "2026-03-21T00:00:00Z",
        "updatedAt": "2026-03-21T00:00:00Z"
      }
    }
```

## Sample TypeScript Snippets

### Zod System Schema

```yaml
sample_typescript_snippets:
  zod_system_schema:
    code: |
      import { z } from "zod";

      export const AttributeDefinitionSchema = z.object({
        id: z.string(),
        label: z.string(),
        type: z.literal("number"),
      });

      export const ConditionDefinitionSchema = z.object({
        id: z.string(),
        label: z.string(),
      });

      export const ResourceDefinitionSchema = z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(["counter", "number", "text"]),
      });

      export const SystemDefinitionSchema = z.object({
        id: z.string(),
        version: z.string(),
        name: z.string(),
        displayName: z.string(),
        themesSupported: z.array(z.string()),
        attributes: z.array(AttributeDefinitionSchema),
        conditions: z.array(ConditionDefinitionSchema),
        resources: z.array(ResourceDefinitionSchema),
      });

      export type SystemDefinition = z.infer<typeof SystemDefinitionSchema>;
```

### Zod Character Schema

```yaml
  zod_character_schema:
    code: |
      import { z } from "zod";

      export const CharacterSchema = z.object({
        id: z.string(),
        schemaVersion: z.string(),
        systemId: z.string(),
        name: z.string(),
        metadata: z.record(z.unknown()),
        values: z.record(z.unknown()),
        conditions: z.record(z.boolean()),
        resources: z.record(z.number()),
        skills: z.array(
          z.object({
            id: z.string(),
            value: z.number(),
          })
        ),
        spells: z.array(z.object({
          id: z.string(),
          name: z.string(),
          wpCost: z.number().optional(),
          summary: z.string().optional(),
        })).default([]),
        heroicAbilities: z.array(z.object({
          id: z.string(),
          name: z.string(),
          summary: z.string().optional(),
        })).default([]),
        weapons: z.array(z.record(z.unknown())).default([]),
        inventory: z.array(z.record(z.unknown())).default([]),
        derivedOverrides: z.record(z.unknown()).default({}),
        uiState: z.record(z.unknown()).default({}),
        timestamps: z.object({
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      });

      export type CharacterRecord = z.infer<typeof CharacterSchema>;
```

### IndexedDB Repository Example

```yaml
  indexeddb_repository_example:
    code: |
      export interface CharacterRepository {
        getAll(): Promise<CharacterRecord[]>;
        getById(id: string): Promise<CharacterRecord | undefined>;
        save(character: CharacterRecord): Promise<void>;
        delete(id: string): Promise<void>;
      }
```

### Play Mode Guard Example

```yaml
  play_mode_guard_example:
    code: |
      export function canEditField(mode: "play" | "edit", fieldId: string): boolean {
        const playModeAllowed = new Set(["hp", "wp", "deathRolls"]);
        if (mode === "edit") return true;
        return playModeAllowed.has(fieldId) || fieldId.startsWith("condition:");
      }
```

### Derived Override Example

```yaml
  derived_override_example:
    code: |
      export function getEffectiveValue<T>(
        fieldId: string,
        calculatedValue: T,
        overrides: Record<string, unknown>
      ): T {
        if (fieldId in overrides) {
          return overrides[fieldId] as T;
        }
        return calculatedValue;
      }
```

## Implementation Checklist

```yaml
implementation_checklist:
  foundation:
    - "Create Vite React TypeScript app"
    - "Add PWA support"
    - "Define schemas"
    - "Create IndexedDB layer"
    - "Add theme provider"
    - "Add app routing"
  data:
    - "Create Dragonbane bundled system definition JSON"
    - "Create blank/sample Dragonbane character JSON"
    - "Implement character import/export"
    - "Implement migrations/version checking"
  ui:
    - "Create top action bar"
    - "Create bottom nav"
    - "Build Character Library screen"
    - "Build Sheet screen"
    - "Build Skills screen"
    - "Build Gear screen"
    - "Build Magic screen"
    - "Build Combat screen"
    - "Build Settings and Reference screens"
  behavior:
    - "Implement Play Mode and Edit Mode"
    - "Implement autosave"
    - "Implement active character restoration"
    - "Implement theme persistence"
    - "Implement fullscreen toggle"
    - "Implement wake lock toggle"
  polish:
    - "Improve Dragonbane-inspired styling"
    - "Refine spacing and touch targets"
    - "Test portrait and landscape"
    - "Test offline after install"
```

## Definition of Done

```yaml
definition_of_done:
  mvp_done_when:
    - "App installs as PWA from a local served URL"
    - "App works offline after initial installation and caching"
    - "User can create/import/export characters"
    - "User can switch between multiple stored characters"
    - "User can use Play Mode for live tracking"
    - "User can use Edit Mode for full character editing"
    - "Themes function correctly"
    - "No backend is required"
    - "No copyrighted rules text is bundled"
  release_ready_when:
    - "Manual test matrix passes on target Android tablet"
    - "Offline persistence is reliable"
    - "Import/export validation is stable"
    - "Combat and Magic screens are comfortable to use during live play"
```

## Final Notes

```yaml
final_notes:
  strategic_recommendation: >
    Build Dragonbane well first. Let the architecture invite future reuse, but do not let
    future reuse dictate V1 complexity. The true enemy is not lack of abstraction. It is
    building a grand universal engine before the first goblin is properly tracked.
  implementation_priority: >
    Reliability, offline persistence, and touch usability outrank aesthetics, abstraction,
    and future-system dreams.
```

---

# Part 2: Implementation Plan

## Document Metadata

```yaml
document:
  type: implementation_plan
  version: "1.0.0"
  status: ready-for-execution
  title: "Dragonbane Character Sheet PWA - Implementation Plan"
  intended_consumer: "Claude Code / Clawed Code"
  project_type: "Frontend-only PWA"
  stack:
    frontend: "React + TypeScript + Vite"
    storage: "IndexedDB"
    validation: "Zod"
    routing: "React Router"
    pwa: "vite-plugin-pwa"
  execution_style: "Incremental, testable, milestone-based"
```

## Project Summary

```yaml
project_summary:
  objective: >
    Build a tablet-first, offline-first, installable Dragonbane character sheet PWA
    with a local character library, active-character workflow, Play Mode/Edit Mode,
    JSON import/export, and Dragonbane-inspired theming.
  build_strategy: >
    Deliver in small vertical slices. Prioritize reliability, offline persistence,
    touch usability, and data safety. Defer abstraction that does not directly improve
    the Dragonbane use case in V1.
```

## Delivery Principles

```yaml
delivery_principles:
  - "Ship usable slices early"
  - "Keep data model stable before polishing visuals"
  - "Prefer boring architecture over clever architecture"
  - "Every milestone must leave the app runnable"
  - "Never risk user data for convenience"
  - "Defer multi-system ambitions unless they directly aid Dragonbane V1"
```

## Team Assumptions

```yaml
team_assumptions:
  team_size: "1 developer or AI-assisted solo implementation"
  deployment_model: "Local dev server for install, offline use after caching"
  target_device: "Android tablet, Chrome preferred"
  first_real_use_case: "Live tabletop Dragonbane session"
```

## Epics

```yaml
epics:
  - id: "EPIC-001"
    name: "Foundation and Scaffolding"
    outcome: "Runnable app shell with routing, themes, and PWA wiring"
  - id: "EPIC-002"
    name: "Data and Validation"
    outcome: "Stable system/character schemas and local persistence"
  - id: "EPIC-003"
    name: "Character Library"
    outcome: "Manage stored characters locally"
  - id: "EPIC-004"
    name: "Core Character Screens"
    outcome: "Sheet, Skills, Gear, and Magic screens working with real data"
  - id: "EPIC-005"
    name: "Mode System"
    outcome: "Play Mode and Edit Mode behavior enforced"
  - id: "EPIC-006"
    name: "Combat and Live Play Utilities"
    outcome: "Combat screen, fullscreen, wake lock"
  - id: "EPIC-007"
    name: "Import/Export and Versioning"
    outcome: "Portable JSON and schema-safe upgrades"
  - id: "EPIC-008"
    name: "Polish, Testing, and Release Prep"
    outcome: "Stable, pleasant, release-ready app"
```

## Global Constraints

```yaml
global_constraints:
  required:
    - "No backend in V1"
    - "No network dependency during play"
    - "No dice roller in V1"
    - "No copyrighted rules text bundled"
    - "One active character at a time"
    - "Many stored characters locally"
  prohibited:
    - "No cloud sync"
    - "No authentication"
    - "No PDF import"
    - "No OCR"
    - "No GM campaign management"
    - "No universal RPG engine in V1"
```

## Milestones

```yaml
milestones:
  - id: "M1"
    name: "Scaffold Complete"
    done_when:
      - "App boots"
      - "Routes work"
      - "Theme switching works"
      - "PWA manifest and service worker configured"
  - id: "M2"
    name: "Data Core Complete"
    done_when:
      - "System schema defined"
      - "Character schema defined"
      - "IndexedDB persistence works"
      - "Bundled Dragonbane system loads"
  - id: "M3"
    name: "Library and Active Character Complete"
    done_when:
      - "Create/import/delete/duplicate/set-active all work"
      - "App restores active character after reload"
  - id: "M4"
    name: "Playable Character Tracker Complete"
    done_when:
      - "Sheet/Skills/Gear/Magic screens functional"
      - "Autosave works"
      - "Edit and Play modes exist"
  - id: "M5"
    name: "Table-Ready Complete"
    done_when:
      - "Combat screen works"
      - "Fullscreen works where supported"
      - "Wake lock works where supported"
      - "Offline testing passes"
  - id: "M6"
    name: "Release Candidate"
    done_when:
      - "Import/export validated"
      - "Theme polish complete"
      - "Manual test matrix passes"
```

## Execution Order

```yaml
execution_order:
  - "Initialize project and dependencies"
  - "Set up routing and top-level layout"
  - "Set up theming"
  - "Set up PWA config"
  - "Define schemas and core types"
  - "Implement storage/repositories"
  - "Bundle Dragonbane system definition"
  - "Implement app settings and active character logic"
  - "Implement Character Library"
  - "Implement main screens with static scaffolds"
  - "Bind screens to real persisted data"
  - "Implement Play/Edit mode restrictions"
  - "Implement import/export"
  - "Implement derived values and overrides"
  - "Implement combat utilities"
  - "Test offline/install flow"
  - "Polish and harden"
```

## Work Breakdown

### Phase 1: Scaffold

```yaml
work_breakdown:
  phase_1_scaffold:
    objective: "Create app shell and project structure"
    tasks:
      - id: "T-001"
        title: "Initialize Vite React TypeScript project"
        steps:
          - "Create new Vite app"
          - "Set up TypeScript strict mode"
          - "Install core dependencies"
        acceptance_criteria:
          - "npm install succeeds"
          - "npm run dev starts local server"
          - "TypeScript compilation passes"
        dos:
          - "Use strict TypeScript"
          - "Keep dependencies modest"
        donts:
          - "Do not install state libraries unless clearly needed"
      - id: "T-002"
        title: "Create initial folder structure"
        steps:
          - "Create app, screens, components, storage, systems, theme, utils, types, schemas, pwa folders"
          - "Add placeholder index files if useful"
        acceptance_criteria:
          - "Folder structure matches spec"
          - "Imports are clean and consistent"
      - id: "T-003"
        title: "Add React Router and base routes"
        steps:
          - "Create AppLayout"
          - "Define routes for Sheet, Skills, Gear, Magic, Combat, Library, Settings, Reference"
        acceptance_criteria:
          - "Navigation between routes works"
          - "Unknown route handling exists"
      - id: "T-004"
        title: "Implement top action bar and bottom navigation"
        steps:
          - "Create responsive shell layout"
          - "Add placeholder buttons for mode, theme, fullscreen, wake lock, menu"
        acceptance_criteria:
          - "Top bar visible"
          - "Bottom nav visible"
          - "Portrait and landscape layouts remain usable"
```

### Phase 2: Theme and Design Tokens

```yaml
  phase_2_theme_and_design_tokens:
    objective: "Implement theme infrastructure before deep UI work"
    tasks:
      - id: "T-005"
        title: "Create theme token system"
        steps:
          - "Define dark, parchment, light theme tokens"
          - "Use CSS variables or equivalent"
        acceptance_criteria:
          - "Theme changes apply without reload"
          - "No component hardcodes colors"
      - id: "T-006"
        title: "Implement ThemeProvider and persistence"
        steps:
          - "Store selected theme locally"
          - "Restore theme on startup"
        acceptance_criteria:
          - "User-selected theme persists"
      - id: "T-007"
        title: "Build primitive visual components"
        steps:
          - "Create Button, IconButton, Card, SectionPanel, Chip, Counter, Drawer, Modal primitives"
        acceptance_criteria:
          - "Core primitives reusable across screens"
        dos:
          - "Favor large touch targets"
          - "Test contrast in all themes"
        donts:
          - "Do not overstyle early"
          - "Do not add ornamental assets that block readability"
```

### Phase 3: PWA Setup

```yaml
  phase_3_pwa_setup:
    objective: "Make app installable and offline-capable"
    tasks:
      - id: "T-008"
        title: "Configure vite-plugin-pwa"
        steps:
          - "Add manifest"
          - "Add app name, icons, display mode, theme colors"
          - "Configure service worker"
        acceptance_criteria:
          - "Manifest is generated"
          - "Service worker registers"
          - "App is installable on supported platforms"
      - id: "T-009"
        title: "Implement app shell caching"
        steps:
          - "Precache essential assets"
          - "Ensure routes work offline after first load"
        acceptance_criteria:
          - "App loads offline after first install/use"
        dos:
          - "Cache shell and assets"
        donts:
          - "Do not cache dynamic user data as remote network responses"
      - id: "T-010"
        title: "Add update available flow"
        steps:
          - "Detect service worker update"
          - "Offer user prompt to refresh"
        acceptance_criteria:
          - "Update flow exists and does not silently wipe state"
```

### Phase 4: Schema and Types

```yaml
  phase_4_schema_and_types:
    objective: "Lock down data shapes early"
    tasks:
      - id: "T-011"
        title: "Define TypeScript domain types"
        steps:
          - "Create types for SystemDefinition, CharacterRecord, AppSettings, field definitions, item definitions"
        acceptance_criteria:
          - "Types compile"
          - "Core domain objects are represented clearly"
      - id: "T-012"
        title: "Create Zod schemas"
        steps:
          - "Create schemas for system, character, settings, import payloads"
        acceptance_criteria:
          - "Valid samples parse"
          - "Invalid samples produce readable errors"
      - id: "T-013"
        title: "Create bundled Dragonbane system definition"
        steps:
          - "Define attributes"
          - "Define conditions"
          - "Define resources"
          - "Define sections"
          - "Define skill list"
        acceptance_criteria:
          - "Dragonbane system JSON loads successfully"
          - "System ids are stable"
        dos:
          - "Use ids, not labels, as keys"
        donts:
          - "Do not include copyrighted rules text"
      - id: "T-014"
        title: "Create sample blank Dragonbane character"
        steps:
          - "Populate metadata shell"
          - "Populate conditions/resources defaults"
          - "Add empty lists for spells, abilities, items"
        acceptance_criteria:
          - "Blank character validates"
```

### Phase 5: Storage

```yaml
  phase_5_storage:
    objective: "Make persistence trustworthy"
    tasks:
      - id: "T-015"
        title: "Implement IndexedDB layer"
        steps:
          - "Choose Dexie or write a thin repository wrapper"
          - "Create stores for characters, systems, settings, metadata, referenceNotes"
        acceptance_criteria:
          - "Can save and retrieve records"
          - "No crashes on empty DB"
      - id: "T-016"
        title: "Create repository interfaces"
        steps:
          - "Character repository"
          - "Settings repository"
          - "System repository"
        acceptance_criteria:
          - "UI can access storage via repository abstraction"
      - id: "T-017"
        title: "Implement app startup hydration"
        steps:
          - "Load app settings"
          - "Load bundled Dragonbane system if absent"
          - "Restore active character if set"
        acceptance_criteria:
          - "App startup restores previous state correctly"
      - id: "T-018"
        title: "Implement autosave utilities"
        steps:
          - "Debounce saves where appropriate"
          - "Track updated timestamps"
        acceptance_criteria:
          - "Changes persist without explicit save button"
        dos:
          - "Preserve data frequently"
        donts:
          - "Do not block UI during save"
```

### Phase 6: Library

```yaml
  phase_6_library:
    objective: "Manage characters locally"
    tasks:
      - id: "T-019"
        title: "Build Character Library screen"
        steps:
          - "Show all stored characters"
          - "Highlight active character"
          - "Add create/import/export/duplicate/delete actions"
        acceptance_criteria:
          - "All core library actions work"
      - id: "T-020"
        title: "Implement create character flow"
        steps:
          - "Create from blank template"
          - "Assign id and timestamps"
          - "Save to DB"
        acceptance_criteria:
          - "New blank character appears and can be activated"
      - id: "T-021"
        title: "Implement set active character"
        steps:
          - "Persist activeCharacterId in settings"
          - "Redirect to Sheet screen after activation"
        acceptance_criteria:
          - "Selected character remains active after reload"
      - id: "T-022"
        title: "Implement delete and duplicate"
        steps:
          - "Delete with confirmation"
          - "Duplicate with new id and timestamps"
        acceptance_criteria:
          - "Delete is safe"
          - "Duplicate preserves structure"
```

### Phase 7: Screen Scaffolds

```yaml
  phase_7_screen_scaffolds:
    objective: "Create all main screens with placeholder data first"
    tasks:
      - id: "T-023"
        title: "Build Sheet screen skeleton"
      - id: "T-024"
        title: "Build Skills screen skeleton"
      - id: "T-025"
        title: "Build Gear screen skeleton"
      - id: "T-026"
        title: "Build Magic screen skeleton"
      - id: "T-027"
        title: "Build Combat screen skeleton"
      - id: "T-028"
        title: "Build Settings and Reference screens skeleton"
    acceptance_criteria:
      - "All major screens render"
      - "Navigation between them works"
      - "Empty state handling exists"
```

### Phase 8: Sheet Binding

```yaml
  phase_8_sheet_binding:
    objective: "Bind real character data to screens"
    tasks:
      - id: "T-029"
        title: "Bind Sheet screen to active character"
        steps:
          - "Show metadata summary"
          - "Show attributes"
          - "Show conditions"
          - "Show resources"
          - "Show derived value stubs"
        acceptance_criteria:
          - "Screen reflects actual active character state"
      - id: "T-030"
        title: "Bind Skills screen"
        steps:
          - "Load skill definitions from system JSON"
          - "Merge with character values"
          - "Allow show-all / relevant-first toggle"
        acceptance_criteria:
          - "Skill values display and can change in Edit Mode"
      - id: "T-031"
        title: "Bind Gear screen"
        steps:
          - "Show weapons"
          - "Show armor and helmet"
          - "Show inventory and coins"
        acceptance_criteria:
          - "Gear lists display and update"
      - id: "T-032"
        title: "Bind Magic screen"
        steps:
          - "Show spell cards"
          - "Show heroic ability cards"
          - "Add freeform create/edit flows"
          - "Add can-cast filter by current WP"
        acceptance_criteria:
          - "Magic data persists and filters correctly"
      - id: "T-033"
        title: "Bind Combat screen"
        steps:
          - "Show large HP/WP counters"
          - "Show condition toggles"
          - "Show death rolls"
          - "Show quick equipped item summary"
        acceptance_criteria:
          - "Combat screen is usable one-handed on tablet"
```

### Phase 9: Mode System

```yaml
  phase_9_mode_system:
    objective: "Enforce safe play behavior"
    tasks:
      - id: "T-034"
        title: "Implement global mode state"
        steps:
          - "Persist preferred mode"
          - "Allow toggle in top bar"
        acceptance_criteria:
          - "Mode changes reflected across screens"
      - id: "T-035"
        title: "Implement field-level mode guards"
        steps:
          - "Allow limited edits in Play Mode"
          - "Allow full edits in Edit Mode"
        acceptance_criteria:
          - "Play Mode prevents deep accidental edits"
      - id: "T-036"
        title: "Mark fields visually by mode"
        steps:
          - "Show disabled/edit affordances clearly"
        acceptance_criteria:
          - "User can tell what is editable"
        dos:
          - "Protect core structure in Play Mode"
        donts:
          - "Do not hide crucial quick controls in Play Mode"
```

### Phase 10: Editing Workflows

```yaml
  phase_10_editing_workflows:
    objective: "Make data editing practical without clutter"
    tasks:
      - id: "T-037"
        title: "Implement inline numeric/text editing for simple fields"
      - id: "T-038"
        title: "Implement drawer/modal editors for complex entries"
        steps:
          - "Weapon editor"
          - "Spell editor"
          - "Ability editor"
          - "Inventory item editor"
        acceptance_criteria:
          - "Complex data can be edited without overwhelming screens"
      - id: "T-039"
        title: "Implement create/remove list item actions"
        acceptance_criteria:
          - "User can add/delete spells, abilities, items, weapons"
```

### Phase 11: Import/Export

```yaml
  phase_11_import_export:
    objective: "Make character data portable and safe"
    tasks:
      - id: "T-040"
        title: "Implement character export to JSON"
        steps:
          - "Serialize stable character object"
          - "Trigger download/share"
        acceptance_criteria:
          - "Exported file reimports successfully"
      - id: "T-041"
        title: "Implement character import from JSON"
        steps:
          - "Parse file"
          - "Validate with schema"
          - "Show readable errors"
          - "Persist on success"
        acceptance_criteria:
          - "Valid files import"
          - "Invalid files do not damage existing data"
      - id: "T-042"
        title: "Add schemaVersion and migration hooks"
        steps:
          - "Read version"
          - "Route through migration pipeline if needed"
        acceptance_criteria:
          - "Older versions can be upgraded where supported"
        dos:
          - "Treat imports as untrusted"
        donts:
          - "Do not eval anything from imported content"
```

### Phase 12: Derived Values

```yaml
  phase_12_derived_values:
    objective: "Automate where useful, allow override when needed"
    tasks:
      - id: "T-043"
        title: "Implement derived value engine"
        steps:
          - "Compute movement"
          - "Compute encumbrance helper"
          - "Stub other configurable derivations"
        acceptance_criteria:
          - "Derived values update when inputs change"
      - id: "T-044"
        title: "Implement override system"
        steps:
          - "Allow override in Edit Mode"
          - "Store override separately"
          - "Mark overridden fields"
          - "Reset to auto option"
        acceptance_criteria:
          - "Override behavior is transparent and reliable"
```

### Phase 13: Live Play Utilities

```yaml
  phase_13_live_play_utilities:
    objective: "Make the app sing at the table"
    tasks:
      - id: "T-045"
        title: "Implement fullscreen toggle"
        steps:
          - "Use Fullscreen API"
          - "Handle unsupported cases"
        acceptance_criteria:
          - "User can enter fullscreen where allowed"
      - id: "T-046"
        title: "Implement wake lock toggle"
        steps:
          - "Use Screen Wake Lock API"
          - "Handle revocation"
          - "Show status"
        acceptance_criteria:
          - "App can request screen wake lock where supported"
      - id: "T-047"
        title: "Persist fullscreen/wake lock preferences"
        acceptance_criteria:
          - "Preferences restore or fail gracefully"
        donts:
          - "Do not break app if APIs are unsupported"
```

### Phase 14: Reference Notes

```yaml
  phase_14_reference_notes:
    objective: "Provide light utility without copyright trouble"
    tasks:
      - id: "T-048"
        title: "Implement reference notes screen"
        steps:
          - "Allow user-authored note cards"
          - "Store locally"
        acceptance_criteria:
          - "Notes persist"
      - id: "T-049"
        title: "Add warning/UX copy about paraphrase-only content"
        acceptance_criteria:
          - "App does not encourage copying book text"
```

### Phase 15: Testing and Hardening

```yaml
  phase_15_testing_and_hardening:
    objective: "Make it trustworthy"
    tasks:
      - id: "T-050"
        title: "Write unit tests for validation and derived logic"
      - id: "T-051"
        title: "Write integration tests for library and persistence"
      - id: "T-052"
        title: "Manual offline/install test pass"
        steps:
          - "Install from local server"
          - "Disconnect internet"
          - "Open app"
          - "Edit character"
          - "Close and reopen"
        acceptance_criteria:
          - "App remains usable offline"
      - id: "T-053"
        title: "Manual tablet usability pass"
        steps:
          - "Test portrait"
          - "Test landscape"
          - "Test dark/parchment/light"
          - "Test common play flows"
        acceptance_criteria:
          - "No screen requires pinch-zoom"
      - id: "T-054"
        title: "Import/export round-trip verification"
        acceptance_criteria:
          - "Export then import preserves character faithfully"
```

## User Stories

```yaml
stories:
  - id: "US-001"
    role: "player"
    want: "to install the app from my local network and use it offline"
    so_that: "I can rely on it even with bad internet"
    acceptance_criteria:
      - "App installs as PWA"
      - "App opens offline after initial load"
  - id: "US-002"
    role: "player"
    want: "to switch between multiple saved characters"
    so_that: "I can reuse the app for different games or heroes"
    acceptance_criteria:
      - "Character library lists all saved characters"
      - "One tap sets a character active"
  - id: "US-003"
    role: "player"
    want: "Play Mode"
    so_that: "I do not accidentally edit deep sheet fields during a session"
    acceptance_criteria:
      - "Only quick-use fields editable"
  - id: "US-004"
    role: "mage player"
    want: "a spellbook view filtered by current WP"
    so_that: "I can quickly see what I can cast"
    acceptance_criteria:
      - "Spell cards can be filtered by wpCost <= current WP"
  - id: "US-005"
    role: "player"
    want: "to export my character to JSON"
    so_that: "I can back it up or move it later"
    acceptance_criteria:
      - "Export is one action away from library or menu"
```

## Definition of Ready / Done

```yaml
definition_of_ready:
  task_ready_when:
    - "Dependencies identified"
    - "Acceptance criteria written"
    - "Scope small enough for one implementation pass"
    - "No blocked prerequisite remains"

definition_of_done:
  task_done_when:
    - "Code implemented"
    - "TypeScript passes"
    - "Relevant tests pass or manual verification recorded"
    - "No obvious regressions on tablet layout"
    - "Behavior matches acceptance criteria"
```

## Risk Register

```yaml
risk_register:
  - id: "R-001"
    risk: "Trying to over-generalize into a universal RPG engine too early"
    mitigation:
      - "Keep Dragonbane-first"
      - "Only make schemas generic where already useful"
  - id: "R-002"
    risk: "Service worker/update confusion causes stale app behavior"
    mitigation:
      - "Implement explicit update prompt"
      - "Document refresh path"
  - id: "R-003"
    risk: "Wake lock/fullscreen support varies by device"
    mitigation:
      - "Graceful fallback"
      - "Status indicators"
  - id: "R-004"
    risk: "Imported malformed JSON corrupts app state"
    mitigation:
      - "Validate before write"
      - "Never overwrite existing data before success"
  - id: "R-005"
    risk: "Tablet layouts become cramped"
    mitigation:
      - "Prefer cards and drawers"
      - "Manual portrait/landscape testing early"
```

## Technical Decisions

```yaml
technical_decisions:
  - decision: "Use IndexedDB for primary storage"
    rationale: "Structured local persistence without backend"
  - decision: "Use Zod for validation"
    rationale: "Clear runtime validation and readable error handling"
  - decision: "Use Play Mode/Edit Mode"
    rationale: "Safer live use"
  - decision: "Use bottom navigation"
    rationale: "Better thumb ergonomics on tablet"
  - decision: "Use bundled Dragonbane config JSON"
    rationale: "Data-driven enough without overbuilding"
```

## QA Checklists

```yaml
qa_checklists:
  installability:
    - "Manifest valid"
    - "Icons present"
    - "PWA install prompt available where supported"
  offline:
    - "App shell loads without network"
    - "Active character loads without network"
    - "Edits save without network"
  persistence:
    - "Character edits survive reload"
    - "Theme survives reload"
    - "Active character survives reload"
  usability:
    - "HP/WP quick controls easy to tap"
    - "Conditions easy to toggle"
    - "Magic screen readable at table distance"
    - "Combat screen low-friction"
  safety:
    - "Delete requires confirmation"
    - "Import validation blocks malformed data"
    - "Play Mode protects deep fields"
```

## Release Sequence

```yaml
release_sequence:
  alpha_internal:
    scope:
      - "Foundation"
      - "Storage"
      - "Library"
      - "Sheet screen"
    objective: "Prove persistence and offline basics"
  beta_personal_use:
    scope:
      - "Skills"
      - "Gear"
      - "Magic"
      - "Play/Edit mode"
      - "Import/export"
    objective: "Use in actual session or mock session"
  release_candidate:
    scope:
      - "Combat"
      - "Fullscreen"
      - "Wake lock"
      - "Theme polish"
      - "Hardening"
    objective: "Stable enough for repeated play"
```

## Do and Don't

```yaml
do_and_dont:
  do:
    - "Implement one vertical slice at a time"
    - "Use real sample character data early"
    - "Test on tablet early, not just desktop"
    - "Keep import/export simple and robust"
    - "Treat offline as a first-class requirement"
  dont:
    - "Do not chase fancy animations before reliability"
    - "Do not hardcode too much Dragonbane UI data into components"
    - "Do not overcomplicate formulas"
    - "Do not turn reference notes into a rulebook clone"
    - "Do not add backend hooks in V1 unless truly necessary"
```

## Handoff Notes for Claude Code

```yaml
handoff_notes_for_claude_code:
  implementation_style:
    - "Prefer small, composable components"
    - "Prefer explicit naming over clever abstractions"
    - "Keep app state understandable"
    - "Write types first when touching data"
  review_focus:
    - "Data loss prevention"
    - "Offline reliability"
    - "Touch ergonomics"
    - "Mode safety"
    - "JSON validation correctness"
  expected_artifacts:
    - "Working codebase"
    - "Bundled Dragonbane system JSON"
    - "Blank sample character JSON"
    - "Schemas and migration utilities"
    - "Manual testing notes"
```

## Next Action Recommendation

```yaml
next_action_recommendation:
  immediate_next_step: >
    Start with Phase 1 through Phase 5 only, and get to a thin but real vertical slice:
    installable shell, local storage, character library, active character restore, and
    a basic Sheet screen with conditions and HP/WP working. That gets the dragon breathing.
```

---

# Part 3: Tactical Execution Plan (Claude Code Build File)

## Document Metadata

```yaml
document:
  type: tactical_execution_plan
  version: "1.0.0"
  status: ready-for-use
  title: "Dragonbane Character Sheet PWA - Claude Code Tactical Build File"
  intended_consumer: "Claude Code / Clawed Code"
  purpose: >
    Provide a highly tactical, file-by-file, pass-by-pass implementation guide for building
    the Dragonbane Character Sheet PWA. This file is intended to be used as an execution
    companion to the PRD/spec and implementation plan.
  primary_goal: >
    Ensure that implementation happens in safe, incremental, testable passes with clear
    file ownership, bounded scope, review gates, and explicit do/don't guardrails.
```

## Project Identity

```yaml
project_identity:
  name: "Dragonbane Character Sheet PWA"
  codename: "Dragonbane Terminal"
  stack:
    frontend: "React"
    language: "TypeScript"
    bundler: "Vite"
    storage: "IndexedDB"
    validation: "Zod"
    routing: "React Router"
    pwa: "vite-plugin-pwa"
  runtime:
    install_model: "Served from localhost/local network for first install"
    normal_use: "Offline after initial caching"
  target_device:
    primary: "Android tablet"
    secondary: "Desktop Chrome during development"
```

## Execution Principles

```yaml
execution_principles:
  - "Implement in vertical slices"
  - "Keep every pass runnable"
  - "Prefer stable boring code over clever abstraction"
  - "Do not widen scope mid-pass"
  - "Do not build future-system features unless directly useful to Dragonbane V1"
  - "Protect user data above all else"
  - "Test tablet flows early"
```

## Master Constraints

```yaml
master_constraints:
  required:
    - "Frontend-only in V1"
    - "Offline-first after install"
    - "One active character at a time"
    - "Multiple saved characters in local library"
    - "Play Mode and Edit Mode"
    - "JSON import/export for character files"
    - "Dark, parchment, and light themes"
    - "No network dependency during play"
  prohibited:
    - "No backend API"
    - "No online sync"
    - "No authentication"
    - "No dice rolling"
    - "No PDF import"
    - "No OCR"
    - "No copyrighted rules text bundling"
    - "No universal RPG engine in V1"
```

## Repo Structure

```yaml
repo_structure:
  root_files:
    - "package.json"
    - "tsconfig.json"
    - "vite.config.ts"
    - "index.html"
    - "README.md"
  primary_dirs:
    - "src/"
    - "public/"
    - "schemas/"
    - "sample-data/"
    - "docs/"
  src_dirs:
    - "src/app/"
    - "src/routes/"
    - "src/screens/"
    - "src/components/"
    - "src/components/primitives/"
    - "src/components/layout/"
    - "src/components/fields/"
    - "src/features/"
    - "src/features/characters/"
    - "src/features/systems/"
    - "src/features/settings/"
    - "src/storage/"
    - "src/storage/repositories/"
    - "src/storage/db/"
    - "src/theme/"
    - "src/types/"
    - "src/utils/"
    - "src/pwa/"
    - "src/hooks/"
    - "src/context/"
  system_data_dirs:
    - "src/systems/dragonbane/"
  suggested_docs:
    - "docs/decisions.md"
    - "docs/migrations.md"
    - "docs/manual-test-checklist.md"
```

## Recommended File Inventory

```yaml
recommended_file_inventory:
  app_shell:
    - path: "src/main.tsx"
      purpose: "Entry point"
    - path: "src/app/App.tsx"
      purpose: "Root app"
    - path: "src/app/AppProviders.tsx"
      purpose: "Wrap providers"
    - path: "src/app/AppLayout.tsx"
      purpose: "Main layout shell"
  routing:
    - path: "src/routes/index.tsx"
      purpose: "Route declarations"
  theme:
    - path: "src/theme/themes.ts"
      purpose: "Theme token definitions"
    - path: "src/theme/ThemeProvider.tsx"
      purpose: "Theme context/provider"
    - path: "src/theme/theme.css"
      purpose: "CSS variables and theme classes"
  pwa:
    - path: "src/pwa/registerPwa.ts"
      purpose: "Service worker registration/update flow"
  types:
    - path: "src/types/system.ts"
      purpose: "System-related TS types"
    - path: "src/types/character.ts"
      purpose: "Character-related TS types"
    - path: "src/types/settings.ts"
      purpose: "App settings types"
  schemas:
    - path: "schemas/system.schema.ts"
      purpose: "Zod system schema"
    - path: "schemas/character.schema.ts"
      purpose: "Zod character schema"
    - path: "schemas/settings.schema.ts"
      purpose: "Zod settings schema"
  storage:
    - path: "src/storage/db/client.ts"
      purpose: "IndexedDB initialization"
    - path: "src/storage/repositories/characterRepository.ts"
      purpose: "Character persistence API"
    - path: "src/storage/repositories/systemRepository.ts"
      purpose: "System persistence API"
    - path: "src/storage/repositories/settingsRepository.ts"
      purpose: "Settings persistence API"
  systems:
    - path: "src/systems/dragonbane/system.json"
      purpose: "Bundled Dragonbane system definition"
    - path: "sample-data/dragonbane.blank.character.json"
      purpose: "Blank character template"
  context:
    - path: "src/context/AppStateContext.tsx"
      purpose: "Global app state"
    - path: "src/context/ActiveCharacterContext.tsx"
      purpose: "Active character data/state"
  layout_components:
    - path: "src/components/layout/TopBar.tsx"
      purpose: "Global actions and current character"
    - path: "src/components/layout/BottomNav.tsx"
      purpose: "Primary navigation"
  primitive_components:
    - path: "src/components/primitives/Button.tsx"
    - path: "src/components/primitives/IconButton.tsx"
    - path: "src/components/primitives/Card.tsx"
    - path: "src/components/primitives/Chip.tsx"
    - path: "src/components/primitives/CounterControl.tsx"
    - path: "src/components/primitives/Drawer.tsx"
    - path: "src/components/primitives/Modal.tsx"
    - path: "src/components/primitives/SectionPanel.tsx"
  screen_files:
    - path: "src/screens/CharacterLibraryScreen.tsx"
    - path: "src/screens/SheetScreen.tsx"
    - path: "src/screens/SkillsScreen.tsx"
    - path: "src/screens/GearScreen.tsx"
    - path: "src/screens/MagicScreen.tsx"
    - path: "src/screens/CombatScreen.tsx"
    - path: "src/screens/ReferenceScreen.tsx"
    - path: "src/screens/SettingsScreen.tsx"
  feature_files:
    - path: "src/features/characters/useCharacterActions.ts"
      purpose: "Create/update/delete/duplicate actions"
    - path: "src/features/characters/characterMappers.ts"
      purpose: "Mapping and normalization"
    - path: "src/features/systems/useSystemDefinition.ts"
      purpose: "Load active system definition"
    - path: "src/features/settings/useAppSettings.ts"
      purpose: "Theme/mode/preferences"
  utility_files:
    - path: "src/utils/ids.ts"
    - path: "src/utils/dates.ts"
    - path: "src/utils/importExport.ts"
    - path: "src/utils/derivedValues.ts"
    - path: "src/utils/migrations.ts"
    - path: "src/utils/modeGuards.ts"
  hooks:
    - path: "src/hooks/useFullscreen.ts"
    - path: "src/hooks/useWakeLock.ts"
    - path: "src/hooks/useAutosave.ts"
```

## Execution Passes

Due to the length of this section, each pass is presented with its full specification.

```yaml
execution_passes:
  - pass_id: "PASS-001"
    name: "Initialize project and skeleton"
    objective: "Get a running React/TS app with clean folders and no business logic yet"
    files_to_create_or_edit:
      - "package.json"
      - "tsconfig.json"
      - "vite.config.ts"
      - "src/main.tsx"
      - "src/app/App.tsx"
      - "src/app/AppProviders.tsx"
      - "src/app/AppLayout.tsx"
      - "src/routes/index.tsx"
      - "README.md"
    expected_output:
      - "App runs"
      - "Basic routes exist"
      - "Placeholder layout exists"
    review_gate:
      checklist:
        - "App boots without TS errors"
        - "Screens can be navigated"
        - "Folder structure is in place"
    prompt_for_claude_code: |
      Create the initial Vite React TypeScript application structure for the Dragonbane Character Sheet PWA.
      Keep it minimal, typed, and clean. Add routing, a root AppLayout, and placeholder routes/screens for:
      Character Library, Sheet, Skills, Gear, Magic, Combat, Settings, and Reference.
      Do not implement domain logic yet. Do not add unnecessary libraries.
      Output all created files in full.
    dos:
      - "Keep shell minimal"
      - "Use clear filenames and exports"
    donts:
      - "Do not add business logic yet"
      - "Do not style heavily yet"

  - pass_id: "PASS-002"
    name: "Theme system and visual shell"
    objective: "Implement theme infrastructure and reusable shell visuals"
    files_to_create_or_edit:
      - "src/theme/themes.ts"
      - "src/theme/ThemeProvider.tsx"
      - "src/theme/theme.css"
      - "src/components/layout/TopBar.tsx"
      - "src/components/layout/BottomNav.tsx"
      - "src/components/primitives/Button.tsx"
      - "src/components/primitives/IconButton.tsx"
      - "src/components/primitives/Card.tsx"
      - "src/components/primitives/Chip.tsx"
      - "src/components/primitives/SectionPanel.tsx"
      - "src/app/AppLayout.tsx"
    expected_output:
      - "Dark, parchment, and light themes work"
      - "Top bar and bottom nav are visible and responsive"
    review_gate:
      checklist:
        - "Theme switches without reload"
        - "Contrast is acceptable"
        - "Nav usable in portrait and landscape"
    prompt_for_claude_code: |
      Implement a theme system with dark, parchment, and light themes using CSS variables.
      Build a touch-friendly AppLayout with a top action bar and bottom navigation.
      Add primitive UI components: Button, IconButton, Card, Chip, SectionPanel.
      The parchment theme should feel fantasy-inspired but remain readable.
      Do not hardcode colors in components.
      Output all changed files in full.
    dos:
      - "Prefer readability"
      - "Favor large controls"
    donts:
      - "Do not overdecorate"
      - "Do not use tiny icons without labels for critical navigation"

  - pass_id: "PASS-003"
    name: "PWA installability and offline shell"
    objective: "Enable installable offline-capable shell"
    files_to_create_or_edit:
      - "vite.config.ts"
      - "src/pwa/registerPwa.ts"
      - "src/main.tsx"
      - "public/icons/*"
      - "README.md"
    expected_output:
      - "Manifest configured"
      - "Service worker registered"
      - "Offline shell works after initial load"
    review_gate:
      checklist:
        - "PWA is installable on supported Chrome"
        - "App shell loads offline"
        - "Update flow does not silently disrupt state"
    prompt_for_claude_code: |
      Configure the app as a PWA using vite-plugin-pwa.
      Add a web app manifest, service worker registration, and a simple update-available flow.
      Assume the app is served from localhost or a local network URL for installation.
      Do not add runtime network fetching.
      Output all changed files in full.
    dos:
      - "Keep PWA setup simple and explicit"
    donts:
      - "Do not rely on remote APIs"
      - "Do not hide update behavior"

  - pass_id: "PASS-004"
    name: "Types and validation"
    objective: "Define the app's data contracts early"
    files_to_create_or_edit:
      - "src/types/system.ts"
      - "src/types/character.ts"
      - "src/types/settings.ts"
      - "schemas/system.schema.ts"
      - "schemas/character.schema.ts"
      - "schemas/settings.schema.ts"
    expected_output:
      - "Stable domain types"
      - "Zod validation for core objects"
    review_gate:
      checklist:
        - "Schemas parse valid sample data"
        - "Validation errors are readable"
        - "Types are not overly generic"
    prompt_for_claude_code: |
      Define TypeScript domain types and Zod schemas for:
      SystemDefinition, CharacterRecord, AppSettings, and related nested objects.
      Keep the data model Dragonbane-first but reusable enough for future schema-driven expansion.
      Do not create a fully generic RPG engine model.
      Output all created files in full.
    dos:
      - "Use stable ids"
      - "Separate display labels from identifiers"
    donts:
      - "Do not use any"
      - "Do not build unnecessary polymorphic complexity"

  - pass_id: "PASS-005"
    name: "Bundled Dragonbane system and blank character"
    objective: "Create default data used by the app"
    files_to_create_or_edit:
      - "src/systems/dragonbane/system.json"
      - "sample-data/dragonbane.blank.character.json"
      - "docs/decisions.md"
    expected_output:
      - "Bundled Dragonbane config"
      - "Blank sample character"
    review_gate:
      checklist:
        - "Both files validate"
        - "No copyrighted rules text included"
    prompt_for_claude_code: |
      Create the bundled Dragonbane system JSON and a blank Dragonbane character JSON template.
      Include structure for attributes, conditions, resources, skills, spells, heroic abilities,
      weapons, inventory, and metadata. Do not include copyrighted rules prose.
      Output both files in full.
    dos:
      - "Keep values simple and explicit"
    donts:
      - "Do not include verbatim rules text"
      - "Do not overstuff with optional fields"

  - pass_id: "PASS-006"
    name: "IndexedDB and repository layer"
    objective: "Make persistence reliable"
    files_to_create_or_edit:
      - "src/storage/db/client.ts"
      - "src/storage/repositories/characterRepository.ts"
      - "src/storage/repositories/systemRepository.ts"
      - "src/storage/repositories/settingsRepository.ts"
      - "src/utils/ids.ts"
      - "src/utils/dates.ts"
    expected_output:
      - "Repositories can save, load, list, delete data"
    review_gate:
      checklist:
        - "Empty DB startup works"
        - "CRUD works for characters"
        - "Bundled system can be persisted or loaded"
    prompt_for_claude_code: |
      Implement the local persistence layer using IndexedDB.
      Use either Dexie or a thin custom wrapper, but keep the repository surface simple.
      Add repositories for characters, systems, and settings.
      Focus on reliability and typed interfaces. No sync logic.
      Output all created files in full.
    dos:
      - "Design repository APIs cleanly"
    donts:
      - "Do not overabstract"
      - "Do not add sync conflict logic"

  - pass_id: "PASS-007"
    name: "App state and startup hydration"
    objective: "Restore active state correctly on launch"
    files_to_create_or_edit:
      - "src/context/AppStateContext.tsx"
      - "src/context/ActiveCharacterContext.tsx"
      - "src/features/settings/useAppSettings.ts"
      - "src/features/systems/useSystemDefinition.ts"
      - "src/app/AppProviders.tsx"
      - "src/app/App.tsx"
    expected_output:
      - "App loads settings"
      - "App restores theme"
      - "App restores active character if present"
    review_gate:
      checklist:
        - "Reload restores active character"
        - "Theme persists"
        - "No crashes when nothing exists yet"
    prompt_for_claude_code: |
      Implement startup hydration and global state contexts for app settings and active character.
      On startup, restore settings, ensure the bundled Dragonbane system is available,
      and restore the active character if one exists.
      Keep state understandable and avoid premature complexity.
      Output all changed files in full.
    dos:
      - "Handle missing data gracefully"
    donts:
      - "Do not use a complex state library unless necessary"

  - pass_id: "PASS-008"
    name: "Character Library vertical slice"
    objective: "Create the first truly useful feature"
    files_to_create_or_edit:
      - "src/screens/CharacterLibraryScreen.tsx"
      - "src/features/characters/useCharacterActions.ts"
      - "src/features/characters/characterMappers.ts"
      - "src/storage/repositories/characterRepository.ts"
      - "src/storage/repositories/settingsRepository.ts"
    expected_output:
      - "List characters"
      - "Create blank character"
      - "Duplicate character"
      - "Delete character with confirmation"
      - "Set active character"
    review_gate:
      checklist:
        - "User can create a blank character"
        - "User can activate a character"
        - "User can duplicate and delete safely"
    prompt_for_claude_code: |
      Build the Character Library screen and the core character actions.
      Support:
      - listing characters
      - creating a blank character from the sample Dragonbane template
      - duplicating a character
      - deleting a character with confirmation
      - setting one character as active
      The UI should be touch-friendly and tablet-appropriate.
      Output all changed files in full.
    dos:
      - "Prioritize data safety"
    donts:
      - "Do not make delete one-tap with no confirmation"

  - pass_id: "PASS-009"
    name: "Sheet screen with real active character data"
    objective: "Make the main sheet usable"
    files_to_create_or_edit:
      - "src/screens/SheetScreen.tsx"
      - "src/components/fields/AttributeField.tsx"
      - "src/components/fields/ConditionToggleGroup.tsx"
      - "src/components/fields/ResourceTracker.tsx"
      - "src/components/primitives/CounterControl.tsx"
      - "src/hooks/useAutosave.ts"
    expected_output:
      - "Identity summary visible"
      - "Attributes visible"
      - "Conditions togglable"
      - "HP/WP counters work"
      - "Autosave works"
    review_gate:
      checklist:
        - "Screen uses real active character"
        - "Edits persist after reload"
        - "Conditions and counters are easy to use"
    prompt_for_claude_code: |
      Implement the main Sheet screen for the active character.
      Show metadata summary, attributes, conditions, HP/WP, and quick character state.
      Add autosave behavior. The screen should already feel usable at the table.
      Keep it clean and touch-friendly.
      Output all changed files in full.
    dos:
      - "Favor readability"
      - "Use chunky controls for resources"
    donts:
      - "Do not cram too many sections into one screen"

  - pass_id: "PASS-010"
    name: "Play Mode and Edit Mode system"
    objective: "Protect against accidental deep edits"
    files_to_create_or_edit:
      - "src/utils/modeGuards.ts"
      - "src/features/settings/useAppSettings.ts"
      - "src/components/layout/TopBar.tsx"
      - "src/context/AppStateContext.tsx"
      - "src/screens/SheetScreen.tsx"
    expected_output:
      - "Mode toggle exists"
      - "Play Mode only allows quick-use edits"
      - "Edit Mode enables deeper edits"
    review_gate:
      checklist:
        - "Mode state is obvious"
        - "Play Mode blocks structural edits"
    prompt_for_claude_code: |
      Implement Play Mode and Edit Mode across the app state and start by enforcing it on the Sheet screen.
      In Play Mode, allow only quick-use edits like HP, WP, death rolls, and conditions.
      In Edit Mode, allow full editing for the screen.
      Make the mode visually obvious.
      Output all changed files in full.
    dos:
      - "Keep Play Mode safe"
    donts:
      - "Do not silently allow deep edits in Play Mode"

  - pass_id: "PASS-011"
    name: "Skills screen with system-definition merge"
    objective: "Render skills from system JSON plus character values"
    files_to_create_or_edit:
      - "src/screens/SkillsScreen.tsx"
      - "src/components/fields/SkillList.tsx"
      - "src/components/fields/SkillRow.tsx"
      - "src/features/systems/useSystemDefinition.ts"
      - "src/features/characters/characterMappers.ts"
    expected_output:
      - "Skills render from system definitions"
      - "Character values overlay correctly"
      - "Show-all / relevant-first toggle works"
    review_gate:
      checklist:
        - "Skill edits persist"
        - "View is readable"
        - "System JSON drives labels and grouping"
    prompt_for_claude_code: |
      Build the Skills screen by merging the bundled Dragonbane skill definitions with the active character's stored skill values.
      Support grouped display, editable values in Edit Mode, and a toggle between relevant-first and show-all.
      Keep the UI fast and readable on a tablet.
      Output all changed files in full.
    dos:
      - "Use definition ids as the source of truth"
    donts:
      - "Do not hardcode all skills in the component"

  - pass_id: "PASS-012"
    name: "Gear screen and list editors"
    objective: "Make equipment practical to track"
    files_to_create_or_edit:
      - "src/screens/GearScreen.tsx"
      - "src/components/fields/WeaponCard.tsx"
      - "src/components/fields/InventoryList.tsx"
      - "src/components/primitives/Drawer.tsx"
      - "src/components/primitives/Modal.tsx"
    expected_output:
      - "Weapons visible"
      - "Inventory visible"
      - "Armor/helmet summary visible"
      - "Coins editable"
    review_gate:
      checklist:
        - "User can add/edit/delete gear"
        - "Complex entry editing uses modal or drawer"
    prompt_for_claude_code: |
      Build the Gear screen with equipment-focused UX.
      Include weapons, inventory, armor/helmet summary, and coins.
      Use drawers or modals for editing complex list entries rather than overloading the main screen.
      Respect Play Mode/Edit Mode behavior.
      Output all changed files in full.
    dos:
      - "Use cards for complex items"
    donts:
      - "Do not make gear editing a dense spreadsheet"

  - pass_id: "PASS-013"
    name: "Magic screen for spells and heroic abilities"
    objective: "Support mage play and ability reference"
    files_to_create_or_edit:
      - "src/screens/MagicScreen.tsx"
      - "src/components/fields/SpellCard.tsx"
      - "src/components/fields/AbilityCard.tsx"
      - "src/components/fields/FilterBar.tsx"
    expected_output:
      - "Spell cards"
      - "Heroic ability cards"
      - "Create/edit/delete freeform entries"
      - "Can-cast filter by current WP"
    review_gate:
      checklist:
        - "Spell list is readable"
        - "Filter by WP works"
        - "Edits persist"
    prompt_for_claude_code: |
      Build the Magic screen for spells and heroic abilities.
      Support freeform custom entries, editing via modal/drawer where useful, and a filter that shows spells castable with current WP.
      Make this screen high readability and low friction.
      Output all changed files in full.
    dos:
      - "Favor large cards"
    donts:
      - "Do not bury spell costs or summaries"

  - pass_id: "PASS-014"
    name: "Combat screen"
    objective: "Create the fast live-play mode"
    files_to_create_or_edit:
      - "src/screens/CombatScreen.tsx"
      - "src/components/fields/CombatResourcePanel.tsx"
      - "src/components/fields/QuickConditionPanel.tsx"
    expected_output:
      - "Large HP/WP counters"
      - "Large condition toggles"
      - "Death rolls"
      - "Quick equipment summary"
    review_gate:
      checklist:
        - "Combat screen is visibly larger and simpler than main sheet"
        - "Common actions are one tap or near-one tap"
    prompt_for_claude_code: |
      Build a dedicated Combat screen optimized for live use.
      It should feature very large controls for HP, WP, conditions, and death rolls,
      plus quick summaries for equipped weapon and armor/helmet.
      This screen should be more touch-optimized and less information-dense than the main sheet.
      Output all changed files in full.
    dos:
      - "Think one-handed thumb use"
    donts:
      - "Do not overload this screen with edit complexity"

  - pass_id: "PASS-015"
    name: "Import/export and migration utilities"
    objective: "Make the data portable and safer long-term"
    files_to_create_or_edit:
      - "src/utils/importExport.ts"
      - "src/utils/migrations.ts"
      - "src/screens/CharacterLibraryScreen.tsx"
      - "src/screens/SettingsScreen.tsx"
    expected_output:
      - "Export character JSON"
      - "Import character JSON"
      - "Readable validation errors"
      - "Migration hook exists"
    review_gate:
      checklist:
        - "Round-trip export/import works"
        - "Malformed files fail safely"
    prompt_for_claude_code: |
      Implement character JSON export/import and a migration utility scaffold.
      Validate all imports with Zod, reject malformed files with readable errors, and never overwrite existing data unless import succeeds.
      Add export and import entry points in the Character Library and/or Settings.
      Output all changed files in full.
    dos:
      - "Treat imports as untrusted"
    donts:
      - "Do not execute or render unsafe imported content"

  - pass_id: "PASS-016"
    name: "Derived values and overrides"
    objective: "Automate where helpful, allow manual correction"
    files_to_create_or_edit:
      - "src/utils/derivedValues.ts"
      - "src/screens/SheetScreen.tsx"
      - "src/screens/GearScreen.tsx"
      - "src/components/fields/DerivedFieldDisplay.tsx"
    expected_output:
      - "Derived values visible"
      - "Override support in Edit Mode"
      - "Reset-to-auto support"
    review_gate:
      checklist:
        - "Derived values update when inputs change"
        - "Overrides are visibly marked"
    prompt_for_claude_code: |
      Implement derived values and override support.
      Start with practical fields like movement and encumbrance helper.
      Derived values should compute automatically, but in Edit Mode the user can override them and later reset to auto.
      Mark overridden values clearly.
      Output all changed files in full.
    dos:
      - "Centralize derivation logic"
    donts:
      - "Do not create an arbitrary formula scripting language in V1"

  - pass_id: "PASS-017"
    name: "Fullscreen and wake lock"
    objective: "Improve real session usability"
    files_to_create_or_edit:
      - "src/hooks/useFullscreen.ts"
      - "src/hooks/useWakeLock.ts"
      - "src/components/layout/TopBar.tsx"
      - "src/features/settings/useAppSettings.ts"
    expected_output:
      - "Fullscreen toggle"
      - "Wake lock toggle"
      - "Graceful unsupported handling"
    review_gate:
      checklist:
        - "App does not break if unsupported"
        - "User gets clear status feedback"
    prompt_for_claude_code: |
      Implement fullscreen and screen wake lock support using browser APIs.
      Add toggles to the top bar and persist user preferences where sensible.
      Handle unsupported browsers or revoked wake locks gracefully.
      Output all changed files in full.
    dos:
      - "Be honest about support state"
    donts:
      - "Do not assume the APIs always work"

  - pass_id: "PASS-018"
    name: "Reference notes and settings cleanup"
    objective: "Finish the utility edges"
    files_to_create_or_edit:
      - "src/screens/ReferenceScreen.tsx"
      - "src/screens/SettingsScreen.tsx"
      - "src/storage/repositories/settingsRepository.ts"
    expected_output:
      - "Local paraphrase-only notes"
      - "Settings organized"
    review_gate:
      checklist:
        - "Notes persist"
        - "Settings are understandable"
    prompt_for_claude_code: |
      Build the Reference and Settings screens.
      Reference should allow simple user-authored shorthand notes stored locally.
      Settings should expose theme selection, mode preference, import/export helpers, and any relevant device toggles.
      Keep these screens simple and useful.
      Output all changed files in full.
    dos:
      - "Keep notes local and minimal"
    donts:
      - "Do not turn Reference into a rulebook clone"

  - pass_id: "PASS-019"
    name: "Testing, polish, and hardening"
    objective: "Make the app trustworthy for actual use"
    files_to_create_or_edit:
      - "docs/manual-test-checklist.md"
      - "src/**/*"
    expected_output:
      - "Manual test checklist"
      - "Visual polish"
      - "Reduced rough edges"
    review_gate:
      checklist:
        - "Offline flow passes"
        - "Common tablet flows feel smooth"
        - "No pinch-zoom required"
        - "Import/export round-trip verified"
    prompt_for_claude_code: |
      Perform a polish and hardening pass across the app.
      Improve spacing, touch targets, empty states, labels, and visual consistency.
      Add or refine a manual testing checklist in docs/manual-test-checklist.md.
      Do not expand scope. Focus on reliability and usability.
      Output all changed files in full.
    dos:
      - "Polish what's there"
    donts:
      - "Do not add new large features in the polish pass"
```

## File-by-File Build Order

```yaml
file_by_file_build_order:
  order:
    - "src/main.tsx"
    - "src/app/App.tsx"
    - "src/app/AppProviders.tsx"
    - "src/app/AppLayout.tsx"
    - "src/routes/index.tsx"
    - "src/theme/themes.ts"
    - "src/theme/ThemeProvider.tsx"
    - "src/theme/theme.css"
    - "src/components/layout/TopBar.tsx"
    - "src/components/layout/BottomNav.tsx"
    - "src/pwa/registerPwa.ts"
    - "src/types/system.ts"
    - "src/types/character.ts"
    - "src/types/settings.ts"
    - "schemas/system.schema.ts"
    - "schemas/character.schema.ts"
    - "schemas/settings.schema.ts"
    - "src/systems/dragonbane/system.json"
    - "sample-data/dragonbane.blank.character.json"
    - "src/storage/db/client.ts"
    - "src/storage/repositories/characterRepository.ts"
    - "src/storage/repositories/systemRepository.ts"
    - "src/storage/repositories/settingsRepository.ts"
    - "src/context/AppStateContext.tsx"
    - "src/context/ActiveCharacterContext.tsx"
    - "src/features/settings/useAppSettings.ts"
    - "src/features/systems/useSystemDefinition.ts"
    - "src/features/characters/useCharacterActions.ts"
    - "src/screens/CharacterLibraryScreen.tsx"
    - "src/screens/SheetScreen.tsx"
    - "src/screens/SkillsScreen.tsx"
    - "src/screens/GearScreen.tsx"
    - "src/screens/MagicScreen.tsx"
    - "src/screens/CombatScreen.tsx"
    - "src/screens/ReferenceScreen.tsx"
    - "src/screens/SettingsScreen.tsx"
    - "src/utils/importExport.ts"
    - "src/utils/migrations.ts"
    - "src/utils/derivedValues.ts"
    - "src/utils/modeGuards.ts"
    - "src/hooks/useAutosave.ts"
    - "src/hooks/useFullscreen.ts"
    - "src/hooks/useWakeLock.ts"
```

## Review Protocol

```yaml
review_protocol:
  after_each_pass:
    - "Run TypeScript check"
    - "Run local app"
    - "Verify no route crashes"
    - "Verify no broken imports"
    - "Verify no obvious visual regressions"
  before_moving_to_next_pass:
    - "Acceptance criteria for current pass met"
    - "No unresolved blockers that poison the next pass"
    - "Any shortcuts documented in docs/decisions.md"
```

## Prompting Rules for Claude Code

```yaml
prompting_rules_for_claude_code:
  always_include:
    - "Output changed files in full"
    - "Respect current scope only"
    - "Do not refactor unrelated files"
    - "Keep code typed and readable"
    - "Do not add unnecessary dependencies"
  when_bugfixing:
    - "Explain root cause briefly"
    - "Patch minimally"
    - "Avoid opportunistic architecture changes"
  when_creating_ui:
    - "Prioritize touch ergonomics"
    - "Avoid dense layouts"
    - "Use current theme tokens"
  when_working_with_data:
    - "Validate inputs"
    - "Preserve user data"
    - "Prefer explicit transformations"
```

## Manual Test Sequences

```yaml
manual_test_sequences:
  sequence_1_install_and_offline:
    steps:
      - "Run local dev or preview server"
      - "Open app on tablet"
      - "Install as PWA"
      - "Launch app"
      - "Disable network"
      - "Relaunch app"
    pass_conditions:
      - "App opens"
      - "App shell loads"
      - "Stored character data remains available"
  sequence_2_character_lifecycle:
    steps:
      - "Create blank character"
      - "Edit metadata"
      - "Change HP/WP and conditions"
      - "Close app"
      - "Reopen app"
    pass_conditions:
      - "All edits persist"
  sequence_3_library_management:
    steps:
      - "Create second character"
      - "Duplicate first character"
      - "Switch active character"
      - "Delete duplicate"
    pass_conditions:
      - "Library remains consistent"
      - "Active character restore works"
  sequence_4_magic_play:
    steps:
      - "Add several spells with different WP costs"
      - "Lower WP"
      - "Use castable filter"
    pass_conditions:
      - "Filtering behaves correctly"
  sequence_5_mode_safety:
    steps:
      - "Enter Play Mode"
      - "Attempt to edit deep field"
      - "Switch to Edit Mode"
      - "Edit deep field"
    pass_conditions:
      - "Play Mode blocks deep edits"
      - "Edit Mode allows them"
```

## Acceptance Summary

```yaml
acceptance_summary:
  app_is_mvp_complete_when:
    - "Runs as installable PWA"
    - "Works offline after first install/load"
    - "Supports multiple local characters"
    - "Restores one active character"
    - "Supports Sheet, Skills, Gear, Magic, Combat screens"
    - "Supports Play Mode and Edit Mode"
    - "Supports import/export JSON"
    - "Supports dark, parchment, and light themes"
    - "Supports fullscreen and wake lock where available"
    - "Does not contain copyrighted rules text"
```

## Anti-Scope Creep Rules

```yaml
anti_scope_creep_rules:
  if_requested_feature_is:
    gm_tooling: "defer"
    online_sync: "defer"
    dice_rolling: "defer"
    pdf_import: "defer"
    ocr: "defer"
    universal_layout_builder: "defer"
    arbitrary_formula_language: "defer"
  rationale: >
    These features are attractive but not necessary to make the Dragonbane tablet tracker
    successful in V1.
```

## Fallback Rules

```yaml
fallback_rules:
  if_fullscreen_unsupported:
    action: "Show disabled state and continue normally"
  if_wake_lock_unsupported:
    action: "Show disabled state and continue normally"
  if_import_invalid:
    action: "Show errors, do not persist, preserve existing data"
  if_storage_fails:
    action: "Show error and avoid destructive writes"
  if_no_active_character:
    action: "Open Character Library"
```

## Handoff Strategy

```yaml
handoff_strategy:
  best_starting_prompt: |
    Use the tactical YAML execution file for implementation order.
    Start with PASS-001 only.
    Respect all constraints:
    - frontend-only
    - offline-first
    - no backend
    - no dice roller
    - Dragonbane-first
    - touch-friendly tablet UI
    Output all created/changed files in full.
  iteration_pattern:
    - "One pass at a time"
    - "Review output"
    - "Test locally"
    - "Proceed to next pass only after review gate is met"
```

## Final Note

```yaml
final_note:
  message: >
    Build the dragon one scale at a time. The app does not need to become the One Sheet to Rule Them All.
    It needs to become the thing you trust when the Wi-Fi dies, the goblins charge, and your willpower is running on fumes.
```

---

# Part 4: Testing Master Prompt & Scenario Test Spec

## Document Metadata

```yaml
document:
  type: testing_master_prompt
  version: "1.0.0"
  status: ready-for-use
  title: "Dragonbane Character Sheet PWA - Master Testing Prompt and Scenario Test Spec"
  intended_consumer: "Claude Code / Claude testing skill / AI-assisted QA workflow"
  purpose: >
    Drive exhaustive testing for the Dragonbane Character Sheet PWA throughout development.
    This file should be used after each implementation phase and before any release candidate.
    It covers unit, integration, component, persistence, offline, PWA, scenario, regression,
    and mechanics-adjacent workflow validation.
```

## Project Under Test

```yaml
project_under_test:
  name: "Dragonbane Character Sheet PWA"
  app_type: "Frontend-only installable PWA"
  target_platforms:
    primary:
      - "Android tablet with Chrome"
    secondary:
      - "Desktop Chrome for development/testing"
  runtime_constraints:
    - "Offline-first after install"
    - "Local-only data persistence"
    - "No backend in V1"
    - "No sync in V1"
    - "One active character at a time"
    - "Many local characters in library"
    - "Dragonbane-first implementation"
    - "Play Mode and Edit Mode"
    - "Import/export JSON"
```

## Testing Objectives

```yaml
testing_objectives:
  primary:
    - "Catch data-loss bugs early"
    - "Catch persistence bugs early"
    - "Catch offline/PWA bugs early"
    - "Catch UI mode safety issues early"
    - "Catch invalid import/migration behavior early"
    - "Catch tablet usability problems before release"
    - "Reduce post-deploy debugging"
  secondary:
    - "Verify derived values and override behavior"
    - "Verify scenario play flows"
    - "Verify future-safe schema behavior"
    - "Verify graceful fallback for unsupported browser APIs"
```

## Test Strategy

```yaml
test_strategy:
  philosophy:
    - "Test early and repeatedly"
    - "Test each vertical slice when introduced"
    - "Prioritize high-risk features first"
    - "Prefer deterministic tests for logic"
    - "Use scenario tests for real-world table behavior"
    - "Use regression suites after every phase"
  risk_priorities:
    highest_risk:
      - "Data loss"
      - "Broken autosave"
      - "Corrupt import/export"
      - "Offline failure after install"
      - "Play Mode allowing forbidden edits"
      - "App crash on malformed data"
    medium_risk:
      - "Theme regressions"
      - "Derived value drift"
      - "Wake lock/fullscreen inconsistencies"
      - "List editor bugs"
    lower_risk:
      - "Minor spacing issues"
      - "Visual polish inconsistencies"
```

## Instructions for AI Tester

```yaml
instructions_for_ai_tester:
  role: >
    Act as a strict software QA engineer and test architect. Your job is to generate,
    implement, and run thorough tests for the Dragonbane Character Sheet PWA.
  mandatory_behavior:
    - "Prefer completeness over brevity"
    - "Generate tests that reflect real user behavior"
    - "Think about edge cases, malformed data, interrupted flows, and re-open/reload behavior"
    - "Protect against regressions"
    - "Assume users will use the app in low-connectivity, high-distraction environments"
    - "Call out untestable areas and suggest instrumentation if needed"
  output_requirements:
    - "Create tests grouped by category"
    - "Explain what each group protects against"
    - "List any missing hooks or seams needed for testing"
    - "Recommend fixes if architecture prevents reliable testing"
    - "Do not silently skip important categories"
  constraints:
    - "Do not invent backend APIs"
    - "Do not test features outside scope like dice rolling"
    - "Do not assume internet availability in normal runtime tests"
    - "Do not assume unsupported browser APIs always exist"
```

## Recommended Test Stack

```yaml
recommended_test_stack:
  unit_and_component:
    preferred:
      - "Vitest"
      - "React Testing Library"
      - "jsdom"
  integration:
    preferred:
      - "Vitest + RTL for local integration"
  end_to_end:
    preferred:
      - "Playwright"
    optional:
      - "Cypress"
  pwa_offline:
    preferred:
      - "Playwright"
      - "Manual device validation"
  static_checks:
    preferred:
      - "TypeScript strict compile"
      - "ESLint if present"
  coverage:
    objective:
      - "High coverage on domain logic"
      - "Practical coverage on UI"
    warning: >
      Coverage percentage alone is not sufficient. High-risk workflows must have explicit tests.
```

## Test Categories

```yaml
test_categories:
  - id: "CAT-001"
    name: "Static and Type Safety"
    purpose: "Catch broken code before runtime"
  - id: "CAT-002"
    name: "Schema Validation Tests"
    purpose: "Protect import/export and persisted data shapes"
  - id: "CAT-003"
    name: "Repository and Persistence Tests"
    purpose: "Protect IndexedDB and save/load behavior"
  - id: "CAT-004"
    name: "Context and App State Tests"
    purpose: "Protect startup hydration and active character logic"
  - id: "CAT-005"
    name: "Theme and UI Shell Tests"
    purpose: "Protect routing, layout, and theme behavior"
  - id: "CAT-006"
    name: "Mode Safety Tests"
    purpose: "Protect Play Mode/Edit Mode boundaries"
  - id: "CAT-007"
    name: "Character Library Workflow Tests"
    purpose: "Protect create/duplicate/delete/activate flows"
  - id: "CAT-008"
    name: "Sheet Screen Tests"
    purpose: "Protect identity, attributes, conditions, and resources"
  - id: "CAT-009"
    name: "Skills Screen Tests"
    purpose: "Protect system-definition merge and editing"
  - id: "CAT-010"
    name: "Gear Screen Tests"
    purpose: "Protect lists, editors, and summary behavior"
  - id: "CAT-011"
    name: "Magic Screen Tests"
    purpose: "Protect spell and ability workflows"
  - id: "CAT-012"
    name: "Combat Screen Tests"
    purpose: "Protect high-speed live-play interactions"
  - id: "CAT-013"
    name: "Derived Value and Override Tests"
    purpose: "Protect calculations and override rules"
  - id: "CAT-014"
    name: "Import/Export and Migration Tests"
    purpose: "Protect portability and version resilience"
  - id: "CAT-015"
    name: "Fullscreen and Wake Lock Tests"
    purpose: "Protect optional browser-enhancement features"
  - id: "CAT-016"
    name: "Offline and PWA Tests"
    purpose: "Protect installability and no-network behavior"
  - id: "CAT-017"
    name: "Accessibility and Touch Ergonomics Tests"
    purpose: "Protect usability on tablet"
  - id: "CAT-018"
    name: "Scenario and Mechanics-Adjacent Tests"
    purpose: "Simulate real play sessions and user behavior"
  - id: "CAT-019"
    name: "Regression Suites by Phase"
    purpose: "Keep completed work from breaking"
```

## Phase Test Requirements

```yaml
phase_test_requirements:
  phase_1_scaffold:
    must_test:
      - "App boots"
      - "Routes render"
      - "No route crashes"
      - "Theme shell loads"
    block_release_if_failed: true
  phase_2_theme_and_shell:
    must_test:
      - "Theme switch works"
      - "Top bar and bottom nav render"
      - "Portrait and landscape layouts do not break badly"
    block_release_if_failed: true
  phase_3_pwa:
    must_test:
      - "Manifest present"
      - "Service worker registers"
      - "Installability valid where supported"
      - "Offline shell works after first load"
    block_release_if_failed: true
  phase_4_types_and_schemas:
    must_test:
      - "Valid sample data passes"
      - "Invalid sample data fails"
      - "Errors are readable"
    block_release_if_failed: true
  phase_5_storage:
    must_test:
      - "Create/read/update/delete in local DB"
      - "Startup with empty DB works"
      - "Autosave path does not corrupt data"
    block_release_if_failed: true
  phase_6_library:
    must_test:
      - "Create blank character"
      - "Duplicate character"
      - "Delete with confirmation"
      - "Activate character and restore after reload"
    block_release_if_failed: true
  phase_7_to_14_feature_phases:
    must_test:
      - "All new screen workflows"
      - "Mode safety"
      - "Persistence across reload"
      - "No regressions in prior screens"
    block_release_if_failed: true
  phase_15_plus_polish:
    must_test:
      - "Offline on target device"
      - "Import/export round trip"
      - "Manual tablet scenario pass"
    block_release_if_failed: true
```

## Unit Test Matrix

```yaml
unit_test_matrix:
  static_and_type:
    tests:
      - "TypeScript compile passes"
      - "No implicit any in core data paths"
      - "No circular import crashes in app startup"
  schema_validation:
    system_schema:
      should_pass:
        - "Valid Dragonbane bundled system JSON"
        - "System JSON with optional fields omitted where allowed"
      should_fail:
        - "Missing id"
        - "Missing version"
        - "Duplicate attribute ids if uniqueness is enforced in helper validation"
        - "Wrong primitive types"
        - "Malformed sections"
    character_schema:
      should_pass:
        - "Blank sample character"
        - "Character with spells and abilities"
        - "Character with empty lists"
        - "Character with override map"
      should_fail:
        - "Missing systemId"
        - "Missing schemaVersion"
        - "Conditions with non-boolean values"
        - "Resources with non-numeric values"
        - "Skills missing id or value"
        - "Malformed timestamps"
    settings_schema:
      should_pass:
        - "Defaults"
        - "Stored theme and active character id"
      should_fail:
        - "Unknown invalid mode values"
        - "Wrong primitive types"
  repository_tests:
    character_repository:
      tests:
        - "save new character"
        - "get by id"
        - "list all"
        - "delete existing"
        - "delete missing id behaves safely"
        - "update existing character"
        - "duplicate externally then save succeeds"
    settings_repository:
      tests:
        - "save settings"
        - "load settings with empty db fallback"
        - "replace existing settings"
    system_repository:
      tests:
        - "save bundled system"
        - "load by id"
        - "list systems"
  utility_tests:
    ids:
      tests:
        - "generated ids are non-empty strings"
        - "generated ids do not collide in small sample set"
    dates:
      tests:
        - "timestamp format consistent"
    mode_guards:
      tests:
        - "Play Mode allows hp/wp/deathRolls/conditions only"
        - "Edit Mode allows all supported edits"
        - "Unknown field in Play Mode defaults to deny"
    derived_values:
      tests:
        - "movement calculation with valid inputs"
        - "encumbrance helper with no items"
        - "encumbrance helper with sample items"
        - "override supersedes computed value"
        - "reset-to-auto restores computed value"
    import_export:
      tests:
        - "export serializes stable shape"
        - "import valid file succeeds"
        - "import invalid file returns readable error"
        - "import does not overwrite existing state on failure"
    migrations:
      tests:
        - "current version is passthrough"
        - "older known version migrates"
        - "unsupported version returns controlled failure"
```

## Component Test Matrix

```yaml
component_test_matrix:
  top_bar:
    tests:
      - "renders active character name when present"
      - "renders mode toggle"
      - "renders theme action"
      - "renders fullscreen and wake lock controls"
      - "gracefully handles no active character"
  bottom_nav:
    tests:
      - "renders all primary destinations"
      - "highlights active route"
      - "navigation events fire correctly"
  primitive_components:
    button:
      tests:
        - "renders label"
        - "fires onClick"
        - "disabled state respected"
    icon_button:
      tests:
        - "accessible label present"
        - "fires onClick"
    card:
      tests:
        - "renders content without layout break"
    chip:
      tests:
        - "toggle-like selected state visible"
    counter_control:
      tests:
        - "increments"
        - "decrements"
        - "respects min/max if applicable"
        - "does not double-fire unexpectedly"
    drawer_modal:
      tests:
        - "open/close behavior"
        - "close on escape if supported"
        - "close on outside click only if intended"
        - "focus handling reasonable"
  field_components:
    attribute_field:
      tests:
        - "shows current value"
        - "editable in Edit Mode if intended"
        - "not editable in Play Mode if intended"
    condition_group:
      tests:
        - "renders all conditions"
        - "toggle persists callback"
        - "selected state obvious"
    resource_tracker:
      tests:
        - "shows current resource"
        - "counter updates call handler"
    skill_row:
      tests:
        - "shows label from definition"
        - "shows character value"
        - "edits persist callback"
    spell_card:
      tests:
        - "shows name"
        - "shows wp cost"
        - "shows summary"
        - "favorite or expanded state if implemented"
    ability_card:
      tests:
        - "shows name and summary"
    derived_field_display:
      tests:
        - "shows computed value"
        - "shows override marker when overridden"
```

## Integration Test Matrix

```yaml
integration_test_matrix:
  app_startup:
    tests:
      - "startup with no data opens Character Library"
      - "startup with active character restores that character"
      - "startup restores theme"
      - "startup with malformed stored settings fails gracefully"
  character_library_workflows:
    tests:
      - "create blank character and open it"
      - "duplicate character preserves data but changes id"
      - "delete inactive character removes it"
      - "delete active character clears active state or redirects safely"
      - "activate different character updates app state and route"
  sheet_workflows:
    tests:
      - "edit metadata in Edit Mode persists"
      - "toggle condition in Play Mode persists"
      - "adjust HP/WP persists after reload"
      - "attempt deep edit in Play Mode blocked"
  skills_workflows:
    tests:
      - "system skill definitions merge with character values"
      - "editing skill in Edit Mode persists"
      - "show-all toggle changes visible set"
      - "missing character skill value defaults sensibly"
  gear_workflows:
    tests:
      - "add weapon"
      - "edit weapon"
      - "delete weapon"
      - "add inventory item"
      - "edit coins"
      - "armor/helmet summary updates"
  magic_workflows:
    tests:
      - "add spell"
      - "edit spell"
      - "remove spell"
      - "add ability"
      - "filter spells by current WP"
      - "filter updates when WP changes"
  combat_workflows:
    tests:
      - "adjust HP quickly"
      - "adjust WP quickly"
      - "toggle multiple conditions"
      - "death rolls update and persist"
  import_export_workflows:
    tests:
      - "export current character then import copy"
      - "import malformed file fails safely"
      - "import unsupported version surfaces controlled message"
  theme_workflows:
    tests:
      - "change theme on one screen and persists after route changes"
      - "theme survives reload"
  settings_workflows:
    tests:
      - "toggle mode preference"
      - "toggle wake lock preference if stored"
      - "update settings and restore after reload"
```

## Offline and PWA Tests

```yaml
offline_and_pwa_tests:
  automated:
    - "manifest exists and contains required fields"
    - "service worker registration path executes"
    - "app shell route loads after offline transition"
  manual_required:
    - "Install app from local server to Android tablet"
    - "Disconnect internet"
    - "Open installed app"
    - "Load active character"
    - "Change HP/WP/conditions"
    - "Close app completely"
    - "Reopen app still offline"
  pass_conditions:
    - "App launches offline"
    - "Stored data available offline"
    - "New changes persist offline"
  negative_tests:
    - "First-ever load with no caching and no internet should fail gracefully, not misleadingly"
    - "Update available prompt should not wipe local data"
  pwa_specific_edge_cases:
    - "App upgraded while offline"
    - "Service worker stale cache behavior"
    - "Reinstall app after existing local data"
    - "Open browser tab version and installed app version separately if possible"
```

## Fullscreen and Wake Lock Tests

```yaml
fullscreen_and_wake_lock_tests:
  fullscreen:
    should_test:
      - "toggle enters fullscreen where supported"
      - "toggle exits fullscreen"
      - "unsupported browser shows graceful state"
      - "screen route changes do not break fullscreen state unexpectedly"
  wake_lock:
    should_test:
      - "request wake lock where supported"
      - "release wake lock"
      - "revocation handled gracefully"
      - "unsupported browser shows graceful state"
      - "background/tab hidden state handled without crash"
  negative_cases:
    - "permission denied"
    - "API missing"
    - "API revoked after screen off"
    - "state desync between UI toggle and actual lock state"
```

## Accessibility and Touch Tests

```yaml
accessibility_and_touch_tests:
  accessibility:
    tests:
      - "critical controls have accessible names"
      - "icon buttons have labels"
      - "headings are structured reasonably"
      - "no color-only critical meaning without another cue"
  touch_ergonomics:
    tests:
      - "primary controls are easy to tap"
      - "no key play flow requires pinch zoom"
      - "bottom nav reachable in portrait"
      - "combat controls remain easy to use one-handed"
  visual_tests:
    tests:
      - "dark mode contrast acceptable"
      - "parchment mode readable"
      - "light mode functional"
      - "long names do not destroy layout"
```

## Scenario Tests

```yaml
scenario_tests:
  philosophy: >
    These simulate real table use. They are not just feature checks. They are meant to test
    whether the app behaves correctly when used like a player would actually use it.
  scenarios:
    - id: "SCN-001"
      name: "Fresh install, first character, first offline use"
      purpose: "Verify onboarding and first success path"
      steps:
        - "Serve app locally"
        - "Install to tablet"
        - "Open Character Library"
        - "Create blank character"
        - "Enter metadata"
        - "Switch to Sheet"
        - "Toggle a condition"
        - "Adjust HP and WP"
        - "Disable internet"
        - "Close and reopen app"
      expected_results:
        - "Character persists"
        - "Sheet opens"
        - "Condition and resources preserved"
    - id: "SCN-002"
      name: "Mid-combat panic tapping"
      purpose: "Verify high-speed interaction under stress"
      steps:
        - "Open Combat screen"
        - "Rapidly decrement HP several times"
        - "Rapidly increment/decrement WP"
        - "Toggle multiple conditions quickly"
        - "Navigate to Sheet and back"
      expected_results:
        - "No missed or duplicated bizarre state transitions"
        - "No crashes"
        - "State remains consistent across screens"
    - id: "SCN-003"
      name: "Mage in play"
      purpose: "Verify spellbook utility"
      steps:
        - "Create or load mage character"
        - "Add multiple spells with different WP costs"
        - "Set WP high and view castable filter"
        - "Reduce WP"
        - "Re-check castable filter"
      expected_results:
        - "Filter updates correctly"
        - "Spell cards remain readable"
    - id: "SCN-004"
      name: "Edit before session, play during session"
      purpose: "Verify mode switching and persistence"
      steps:
        - "Open Edit Mode"
        - "Update skills, gear, and spells"
        - "Return to Play Mode"
        - "Use HP/WP/conditions during play"
        - "Reload app"
      expected_results:
        - "All edit changes preserved"
        - "Play Mode limits respected"
        - "Quick play changes preserved"
    - id: "SCN-005"
      name: "Character library rotation"
      purpose: "Verify multi-character local storage behavior"
      steps:
        - "Create three characters"
        - "Activate each one in turn"
        - "Make a distinctive change to each"
        - "Reload app"
        - "Switch among all three"
      expected_results:
        - "Each character retains its own state"
        - "Only one is active at a time"
    - id: "SCN-006"
      name: "Bad import attempt"
      purpose: "Verify safety against malformed files"
      steps:
        - "Prepare malformed JSON file"
        - "Attempt import"
        - "Observe error"
        - "Check library and active character afterward"
      expected_results:
        - "Readable error shown"
        - "No existing data lost"
    - id: "SCN-007"
      name: "Round-trip portability"
      purpose: "Verify backup and restore"
      steps:
        - "Export character"
        - "Delete local copy if safe in test environment"
        - "Reimport exported file"
      expected_results:
        - "Character restored faithfully"
    - id: "SCN-008"
      name: "Low-attention resume"
      purpose: "Verify user can re-enter quickly after interruption"
      steps:
        - "Open app on Magic screen"
        - "Lock device or background app"
        - "Return later"
      expected_results:
        - "App restores sensibly"
        - "No confusing blank state"
    - id: "SCN-009"
      name: "Theme switching without damage"
      purpose: "Verify themes do not affect behavior"
      steps:
        - "Cycle through dark, parchment, light"
        - "Edit fields in each"
        - "Reload"
      expected_results:
        - "Theme persists"
        - "No data loss"
    - id: "SCN-010"
      name: "Unsupported device features"
      purpose: "Verify graceful fallback"
      steps:
        - "Run in environment without wake lock or fullscreen support, or mock absence"
        - "Attempt to toggle those features"
      expected_results:
        - "No crash"
        - "Helpful status shown"
```

## Mechanics-Adjacent Test Design

```yaml
mechanics_adjacent_test_design:
  purpose: >
    These are not rules-verification tests for Dragonbane itself. They are tests that
    simulate mechanics-related usage patterns the app must support correctly.
  skill_tests_needed:
    - id: "MEC-001"
      name: "Condition tracking accuracy"
      verifies:
        - "Conditions toggle individually"
        - "Conditions persist"
        - "Multiple simultaneous conditions supported"
    - id: "MEC-002"
      name: "Resource tracking accuracy"
      verifies:
        - "HP changes persist"
        - "WP changes persist"
        - "Death rolls persist"
        - "No accidental reset on route change"
    - id: "MEC-003"
      name: "Spell affordability view"
      verifies:
        - "Spell filter based on current WP behaves correctly"
        - "Changing WP immediately changes available view"
    - id: "MEC-004"
      name: "Ability and spell storage fidelity"
      verifies:
        - "Freeform custom entries preserve names and summaries"
        - "No truncation or silent wipe"
    - id: "MEC-005"
      name: "Skill definition merge fidelity"
      verifies:
        - "System skill definitions load correctly"
        - "Character-specific values layer on top correctly"
        - "Missing entries default safely"
    - id: "MEC-006"
      name: "Derived value trustworthiness"
      verifies:
        - "Derived values update when source values change"
        - "Override prevents recalculation from replacing user override"
    - id: "MEC-007"
      name: "Play Mode mechanical safety"
      verifies:
        - "Only intended play-time fields editable"
        - "Core build data protected mid-session"
    - id: "MEC-008"
      name: "Gear-state fidelity"
      verifies:
        - "Weapons, armor, coins, and inventory entries persist"
        - "Quick summaries reflect current stored state"
  scenario_skill_prompt_guidance: >
    For scenario-based testing in Claude, ask it to behave like an actual player at the table.
    Have it simulate rapid changes, interrupted sessions, low attention, accidental taps, and
    frequent screen switching. It should try to break persistence and mode safety.
```

## Negative and Chaos Tests

```yaml
negative_and_chaos_tests:
  malformed_data:
    - "Character with missing required keys"
    - "Character with wrong primitive types"
    - "System definition with unknown section types"
    - "Corrupt JSON file"
  interrupted_flows:
    - "Close modal mid-edit"
    - "Navigate away during edit"
    - "Reload immediately after changing HP"
    - "Background app after update"
  storage_failures:
    - "Mock repository failure on save"
    - "Mock repository failure on load"
    - "Mock quota or transaction failure where possible"
  api_absence:
    - "window.ScreenWakeLock missing"
    - "Fullscreen API missing"
  extreme_values:
    - "Very long character name"
    - "Very long spell names"
    - "Large number of spells"
    - "Large number of inventory items"
    - "Zero skills explicitly set"
  weird_but_possible:
    - "Delete currently active character"
    - "Import character with same id as existing character"
    - "Switch theme during modal editing"
    - "Switch active character while unsaved edit would normally occur"
```

## Regression Suite Design

```yaml
regression_suite_design:
  must_run_after_each_phase:
    smoke_suite:
      - "App boots"
      - "Route navigation works"
      - "No console-crash-level failures"
    persistence_suite:
      - "Create or load character"
      - "Change one value"
      - "Reload"
      - "Value persists"
    theme_suite:
      - "Toggle theme"
      - "Navigate screens"
      - "Theme persists"
  must_run_after_feature_phases:
    library_suite:
      - "Create/duplicate/delete/activate"
    mode_suite:
      - "Play Mode restrictions"
      - "Edit Mode access"
    import_export_suite:
      - "Round trip"
      - "Malformed rejection"
    offline_suite:
      - "Shell loads offline"
      - "Character persists offline"
  must_run_before_release_candidate:
    full_tabletop_suite:
      - "Fresh install"
      - "Offline session"
      - "Combat use"
      - "Mage use"
      - "Character switching"
      - "Export backup"
      - "Reload and reopen"
```

## Test File Suggestions

```yaml
test_file_suggestions:
  unit:
    - "src/utils/__tests__/modeGuards.test.ts"
    - "src/utils/__tests__/derivedValues.test.ts"
    - "src/utils/__tests__/importExport.test.ts"
    - "src/utils/__tests__/migrations.test.ts"
    - "src/storage/repositories/__tests__/characterRepository.test.ts"
    - "schemas/__tests__/character.schema.test.ts"
    - "schemas/__tests__/system.schema.test.ts"
  component:
    - "src/components/layout/__tests__/TopBar.test.tsx"
    - "src/components/layout/__tests__/BottomNav.test.tsx"
    - "src/components/primitives/__tests__/CounterControl.test.tsx"
    - "src/components/fields/__tests__/ConditionToggleGroup.test.tsx"
    - "src/components/fields/__tests__/SkillRow.test.tsx"
    - "src/components/fields/__tests__/SpellCard.test.tsx"
  integration:
    - "src/screens/__tests__/CharacterLibraryScreen.test.tsx"
    - "src/screens/__tests__/SheetScreen.test.tsx"
    - "src/screens/__tests__/SkillsScreen.test.tsx"
    - "src/screens/__tests__/GearScreen.test.tsx"
    - "src/screens/__tests__/MagicScreen.test.tsx"
    - "src/screens/__tests__/CombatScreen.test.tsx"
  e2e:
    - "e2e/install-offline.spec.ts"
    - "e2e/library-workflow.spec.ts"
    - "e2e/play-mode.spec.ts"
    - "e2e/mage-scenario.spec.ts"
    - "e2e/import-export.spec.ts"
```

## Acceptance Thresholds

```yaml
acceptance_thresholds:
  release_blockers:
    - "Any reproducible data loss bug"
    - "Any import bug that corrupts existing data"
    - "Offline launch failure after successful install"
    - "Play Mode allowing forbidden edits"
    - "App crash on valid character file"
    - "Character state failing to persist after reload"
  should_fix_before_release:
    - "Touch target pain on core controls"
    - "Unreadable theme contrast"
    - "Broken filter behavior on Magic screen"
    - "Character library confusion around active state"
  can_defer_if_minor:
    - "Small spacing inconsistencies"
    - "Non-critical animation polish"
    - "Minor visual flicker with theme changes"
```

## Output Format for AI

```yaml
output_format_for_ai:
  when_generating_tests:
    require:
      - "Group tests by file and category"
      - "Include clear test names"
      - "State assumptions and mocks"
      - "Note any missing seams or refactors needed for testability"
      - "Prefer deterministic tests"
  when_reporting_results:
    require:
      - "Passed tests"
      - "Failed tests"
      - "Suspected root cause"
      - "Risk level"
      - "Recommended fix order"
```

## Master Prompt for Claude

```yaml
master_prompt_for_claude:
  text: |
    You are acting as a senior QA engineer and test architect for the Dragonbane Character Sheet PWA.

    Your job is to design and implement exhaustive tests for this app with special focus on:
    - data safety
    - offline reliability
    - Play Mode/Edit Mode safety
    - import/export correctness
    - tablet usability
    - scenario realism

    Generate tests for:
    1. unit logic
    2. schema validation
    3. persistence/repositories
    4. component behavior
    5. screen integration
    6. PWA/offline behavior
    7. scenario-based tabletop workflows
    8. regression suites after each phase

    Constraints:
    - frontend-only app
    - no backend
    - no dice roller
    - no sync
    - no copyrighted rules text
    - Dragonbane-first implementation
    - one active character at a time
    - many local characters
    - offline after install

    Requirements:
    - output changed or created test files in full
    - do not skip high-risk categories
    - identify missing seams/hooks needed for testability
    - recommend architecture adjustments only if they directly improve testability and reliability
    - do not widen product scope

    Prioritize tests that would catch:
    - data loss
    - failed autosave
    - malformed imports
    - broken offline behavior
    - mode safety bugs
    - route/state restore bugs
    - quick-tap combat bugs
    - spell filter bugs
    - theme persistence bugs
```

## Final Guidance

```yaml
final_guidance:
  recommendation: >
    Use this testing prompt after every implementation pass, but especially after storage,
    library, Sheet, mode, Magic, Combat, and import/export phases. For highest confidence,
    combine automated tests with one manual tablet pass after each major milestone.
  note_on_scenario_testing: >
    Scenario testing is where the soul of this app gets judged. Unit tests catch the gremlins.
    Scenario tests catch whether the thing actually helps when the table is noisy and your brain
    is running on snacks and adrenaline.
```

---

# Part 5: Reference Navigation Spec

## Document Metadata

```yaml
document:
  type: feature_spec
  version: "1.0.0"
  status: ready-for-implementation
  title: "Scaldmark Reference Navigation Spec"
  subtitle: "Tabbed one-stop rules reference for Dragonbane"
  intended_consumer: "Claude Code / Clawed Code"
  parent_product: "Scaldmark: The Adventurer's Ledger"
  purpose: >
    Add a dedicated in-app reference area to Scaldmark that acts as a one-stop shop
    for the most commonly needed Dragonbane rules and play aids. The reference must
    be easy to browse on a tablet, touch-friendly, readable in dark/parchment/light themes,
    and structured around major tabbed areas rather than a long unbroken scroll.
```

## Feature Summary

```yaml
feature_summary:
  feature_name: "Reference Navigation"
  primary_screen: "Reference"
  feature_goal: >
    Give the user a fast, organized, offline-friendly reference page with tabs for
    the major areas of the Dragonbane reference docs, using the uploaded reference
    blueprint and normalized section data as source material. :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}
  intended_use:
    - "Quick lookup during play"
    - "Combat flow support"
    - "Condition/rest/fear reminders"
    - "Travel mishap and NPC lookup"
    - "Basic rules access without digging through multiple screens"
```

## Design Principles

```yaml
design_principles:
  - "One stop shop"
  - "Touch first"
  - "Fast lookup over page reproduction"
  - "Readable over decorative"
  - "Tabbed organization over giant scroll"
  - "Preserve source grouping where useful"
  - "Offline accessible after install"
  - "Reference should feel like a field manual, not a PDF viewer"
```

## Source Material

```yaml
source_material:
  blueprint_file:
    path: "/mnt/data/dragonbane_reference_blueprint.yaml"
    usage: "Layout and grouping inspiration"
    citation: ":contentReference[oaicite:4]{index=4}"
  normalized_reference_file:
    path: "/mnt/data/dragonbane_reference_sheet.yaml"
    usage: "Canonical structured content source"
    citation: ":contentReference[oaicite:5]{index=5}"
  source_notes:
    - "Blueprint groups content by page purpose and component layout"
    - "Normalized reference file provides structured sections and rows/items for rendering"
    - "Reference content includes time, actions, injuries, attributes, skills, rest, conditions, fear, NPCs, animals, NPC generation, and mishaps"
```

## Scope

```yaml
scope:
  in_scope:
    - "Dedicated Reference screen"
    - "Top-level tab navigation inside the Reference screen"
    - "Section rendering from structured reference data"
    - "Optional secondary in-tab section jump navigation"
    - "Offline rendering of included reference content"
    - "Search/filter within Reference screen"
    - "Responsive tablet-friendly layout"
    - "Support for dark, parchment, and light themes"
  out_of_scope:
    - "External web fetching during play"
    - "PDF viewer embedding"
    - "Verbatim reproduction beyond included provided content"
    - "Rules authoring UI in V1"
    - "Cross-system universal rules browser in V1"
```

## Navigation Model

```yaml
navigation_model:
  entry_point:
    location:
      - "Main app bottom navigation or overflow menu"
    label: "Reference"
    icon_hint: "book-open, ledger, or rune tablet"
  page_structure:
    screen_id: "reference"
    screen_title: "Reference"
    layout:
      top_area:
        - "Screen title"
        - "Optional quick search field"
        - "Optional pin/favorite actions later"
      tab_bar:
        style: "sticky horizontal tab bar"
        behavior:
          - "Swipeable horizontally if needed on smaller devices"
          - "Tap to switch major reference area"
          - "Always visible or sticky under page header"
      content_area:
        - "Shows sections for active tab"
      optional_secondary_nav:
        - "In-tab jump links to section anchors"
```

## Top-Level Tabs

```yaml
top_level_tabs:
  rationale: >
    Tabs should correspond to the major ways a player actually looks up rules during play,
    while still mapping cleanly to the uploaded source sections. :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}
  tabs:
    - id: "combat"
      label: "Combat"
      purpose: "Combat flow, actions, reactions, injuries"
      includes_sections:
        - "measuring_time"
        - "free_actions"
        - "actions"
        - "severe_injuries"
    - id: "core_rules"
      label: "Core Rules"
      purpose: "Attributes, skills, rest, conditions, fear, skill baseline"
      includes_sections:
        - "attributes"
        - "skills"
        - "healing_and_rest"
        - "conditions"
        - "skill_level_base_chance"
        - "fear"
    - id: "npcs_animals"
      label: "NPCs & Animals"
      purpose: "Quick lookup for generic NPCs, animals, and attribute guidelines"
      includes_sections:
        - "typical_npcs"
        - "common_animals"
        - "npc_attribute_guidelines"
    - id: "generators"
      label: "Generators"
      purpose: "Create NPCs and improvise details"
      includes_sections:
        - "creating_npcs"
    - id: "travel_hazards"
      label: "Travel"
      purpose: "Travel mishaps and overland trouble"
      includes_sections:
        - "mishaps"
```

## Secondary Section Navigation

```yaml
secondary_section_navigation:
  enabled: true
  style: "in-tab pill nav or compact anchor list"
  behavior:
    - "Appears at top of each tab if the tab has multiple sections"
    - "Tapping a pill scrolls to section"
    - "Current section can highlight as user scrolls"
  examples:
    combat:
      - "Measuring Time"
      - "Free Actions"
      - "Actions"
      - "Severe Injuries"
    core_rules:
      - "Attributes"
      - "Skills"
      - "Healing & Rest"
      - "Conditions"
      - "Skill Level"
      - "Fear"
```

## Reference Screen Behavior

```yaml
reference_screen_behavior:
  startup_behavior:
    - "Open last-used reference tab if user has visited before"
    - "Otherwise default to Combat tab"
  persistence:
    - "Persist last active reference tab locally"
    - "Persist optional last search term only if useful and not annoying"
  search_behavior:
    enabled: true
    mode: "local client-side filtering"
    searches_across:
      - "tab labels"
      - "section titles"
      - "table cells"
      - "key-value names"
      - "key-value descriptions"
      - "rules text paragraphs"
    behavior:
      - "Typing filters current tab by default"
      - "Optional toggle later for 'search all tabs'"
      - "Matched terms highlighted if straightforward"
  empty_states:
    - "If no results in search, show friendly no-results message"
  offline_behavior:
    - "Reference content bundled locally and always available after install"
```

## Data Strategy

```yaml
data_strategy:
  primary_source: "Bundled structured YAML/JSON derived from uploaded reference file"
  preferred_runtime_format: "JSON imported into app bundle"
  recommendation:
    - "Convert normalized reference YAML into app-consumable JSON at build time or commit-time"
    - "Keep section ids stable"
    - "Keep source grouping metadata"
  required_entities:
    reference_document:
      fields:
        - "title"
        - "subtitle"
        - "source_kind"
        - "license_notice"
        - "notes"
    reference_section:
      fields:
        - "id"
        - "title"
        - "type"
        - "columns"
        - "rows"
        - "items"
        - "paragraphs"
        - "notes"
        - "tab_id"
        - "display_order"
  mapping_rules:
    - section_id: "measuring_time"
      tab_id: "combat"
      display_order: 10
    - section_id: "free_actions"
      tab_id: "combat"
      display_order: 20
    - section_id: "actions"
      tab_id: "combat"
      display_order: 30
    - section_id: "severe_injuries"
      tab_id: "combat"
      display_order: 40
    - section_id: "attributes"
      tab_id: "core_rules"
      display_order: 10
    - section_id: "skills"
      tab_id: "core_rules"
      display_order: 20
    - section_id: "healing_and_rest"
      tab_id: "core_rules"
      display_order: 30
    - section_id: "conditions"
      tab_id: "core_rules"
      display_order: 40
    - section_id: "skill_level_base_chance"
      tab_id: "core_rules"
      display_order: 50
    - section_id: "fear"
      tab_id: "core_rules"
      display_order: 60
    - section_id: "typical_npcs"
      tab_id: "npcs_animals"
      display_order: 10
    - section_id: "common_animals"
      tab_id: "npcs_animals"
      display_order: 20
    - section_id: "npc_attribute_guidelines"
      tab_id: "npcs_animals"
      display_order: 30
    - section_id: "creating_npcs"
      tab_id: "generators"
      display_order: 10
    - section_id: "mishaps"
      tab_id: "travel_hazards"
      display_order: 10
```

## UI Rendering Rules

```yaml
ui_rendering_rules:
  page_title: "Reference"
  tab_bar:
    style:
      - "Large touch-friendly tabs"
      - "Scrollable horizontally if needed"
      - "Sticky under header"
    active_state:
      - "Strong highlight"
      - "Theme-aware accent"
  section_cards:
    style:
      - "Each section rendered in its own card/panel"
      - "Clear section title bar"
      - "Subtle border or background contrast"
  section_header_style:
    inspiration: "Dark green title bars from the reference sample"
    recommendation:
      - "Use Scaldmark theme tokens rather than hardcoded colors"
      - "Keep white or high-contrast text on dark headers"
  table_rendering:
    requirements:
      - "Responsive without horizontal misery where possible"
      - "Support alternating row striping"
      - "Handle multiline cells cleanly"
      - "Support stacked/mobile-card fallback for narrow widths"
    behavior_on_tablet:
      - "Prefer normal table layout in landscape"
      - "Allow card-like row layout in portrait if table becomes unreadable"
  key_value_lists:
    requirements:
      - "Bold item name"
      - "Description below or beside name depending width"
      - "Clear separation between items"
  rules_text_blocks:
    requirements:
      - "Readable paragraph spacing"
      - "Optional highlighted note box style"
  note_rendering:
    requirements:
      - "Show section notes below section body"
      - "Style as compact callout"
```

## Screen Layout by Tab

```yaml
screen_layout_by_tab:
  combat:
    summary: "Most-used-at-table content first"
    suggested_order:
      - "Measuring Time"
      - "Free Actions"
      - "Actions"
      - "Severe Injuries"
    optional_layout_hint:
      - "Show Measuring Time and Free Actions as compact panels up top"
      - "Actions as expandable list"
      - "Severe Injuries as full table below"
  core_rules:
    summary: "Core system concepts and frequently checked mechanics"
    suggested_order:
      - "Attributes"
      - "Healing & Rest"
      - "Conditions"
      - "Skill Level"
      - "Skills"
      - "Fear"
    optional_layout_hint:
      - "Attributes and Healing & Rest side by side on wide screens"
      - "Conditions and Skill Level as compact cards"
      - "Skills as large searchable table"
      - "Fear as separate standout table"
  npcs_animals:
    summary: "Fast lookup material for GM-ish needs or player curiosity"
    suggested_order:
      - "Typical NPCs"
      - "Common Animals"
      - "Attributes for NPCs"
  generators:
    summary: "Improvisation helpers"
    suggested_order:
      - "Creating NPCs"
  travel_hazards:
    summary: "Journey mishaps and wilderness trouble"
    suggested_order:
      - "Mishaps"
```

## Interaction Patterns

```yaml
interaction_patterns:
  section_collapsing:
    enabled: true
    default:
      combat:
        - "Actions expanded"
        - "Severe Injuries collapsed or partially collapsed if long"
      core_rules:
        - "Skills collapsed behind search or preview by default on portrait"
      npcs_animals:
        - "Both main tables collapsed preview on portrait optional"
    behavior:
      - "User can expand/collapse sections"
      - "Expansion state need not persist unless easy"
  quick_jump:
    enabled: true
    behavior:
      - "Section pills scroll to anchors"
  search:
    enabled: true
    placement: "top of reference page under title"
  future_enhancements:
    - "Favorite sections"
    - "Pin section to top"
    - "Recent lookups"
    - "Cross-links from character sheet screens into specific reference sections"
```

## Integration with Scaldmark

```yaml
integration_with_scaldmark:
  current_app_integration:
    add_to_navigation: true
    destination: "Reference screen"
  optional_contextual_links:
    from_sheet_screen:
      - "Conditions summary opens Core Rules > Conditions"
      - "HP/WP/rest helper opens Core Rules > Healing & Rest"
    from_combat_screen:
      - "Actions helper opens Combat > Actions"
      - "Severe injuries helper opens Combat > Severe Injuries"
    from_magic_or_other_screens:
      - "No special link required yet unless later spell rules refs added"
```

## Implementation Notes

```yaml
implementation_notes:
  architecture:
    recommendation: >
      Keep reference content bundled as static structured data in-app. Do not fetch remotely.
      Build a generic ReferenceRenderer that can render:
      - table sections
      - key-value list sections
      - rules-text sections
  suggested_files:
    - "src/screens/ReferenceScreen.tsx"
    - "src/components/reference/ReferenceTabBar.tsx"
    - "src/components/reference/ReferenceSearch.tsx"
    - "src/components/reference/ReferenceSectionRenderer.tsx"
    - "src/components/reference/ReferenceTable.tsx"
    - "src/components/reference/ReferenceKeyValueList.tsx"
    - "src/components/reference/ReferenceTextBlock.tsx"
    - "src/features/reference/referenceData.ts"
    - "src/features/reference/referenceMappings.ts"
    - "src/features/reference/useReferenceState.ts"
  bundled_data_files:
    - "src/features/reference/dragonbane-reference.json"
    - "src/features/reference/dragonbane-reference-blueprint.json"
  state_to_persist:
    - "lastReferenceTab"
    - "optional lastSearchMode"
  state_not_required_to_persist:
    - "expanded/collapsed section state"
```

## Do and Don't

```yaml
do_and_dont:
  do:
    - "Use the normalized section file as the canonical content source"
    - "Keep the Reference page fast and offline-friendly"
    - "Group content by actual lookup behavior"
    - "Use tabs for major areas"
    - "Add secondary section jump links for long tabs"
    - "Keep tables readable on tablet"
    - "Allow search"
    - "Use theme tokens"
  dont:
    - "Do not embed a PDF viewer"
    - "Do not require internet to load reference content"
    - "Do not make the user scroll one massive page for everything"
    - "Do not overcomplicate with nested tab mazes"
    - "Do not hardcode content into components if static data can drive it"
    - "Do not let decorative styling reduce readability"
```

## Guardrails

```yaml
guardrails:
  product_guardrails:
    - "Reference must support fast play lookup first"
    - "If a layout choice makes lookup slower, reject it"
    - "The page should feel like a field manual, not a scanned handout"
  engineering_guardrails:
    - "Keep rendering components generic across section types"
    - "Keep data ids stable"
    - "Avoid fragile HTML injection"
    - "Treat reference data as static bundled content"
  content_guardrails:
    - "Use the provided uploaded content as source"
    - "Do not invent additional rule text unless explicitly requested"
    - "Preserve section meaning when reorganizing into tabs"
```

## Test Requirements

```yaml
test_requirements:
  must_test:
    - "Reference page loads offline"
    - "Each top-level tab renders correct sections"
    - "Section anchor navigation works"
    - "Search filters content correctly"
    - "Long tables remain readable in portrait and landscape"
    - "Tab state persists if intended"
    - "Theme switching does not break table readability"
  scenario_tests:
    - "From Combat screen, jump to Actions reference and back"
    - "Search for 'fear' and land in correct tab/section"
    - "Open NPCs & Animals tab and read a multiline table comfortably"
    - "Use Reference page offline after app installation"
```

## Acceptance Criteria

```yaml
acceptance_criteria:
  functional:
    - "User can open a Reference page in Scaldmark"
    - "User sees tabs for Combat, Core Rules, NPCs & Animals, Generators, and Travel"
    - "Selecting a tab shows the correct grouped sections"
    - "Search works against reference content"
    - "Reference content is available offline"
  usability:
    - "User can find major rules faster than scrolling a raw PDF"
    - "Primary actions and sections are readable on Android tablet"
    - "No key reference flow requires pinch zoom"
  technical:
    - "Reference content comes from bundled structured data"
    - "No remote dependency is required for viewing references"
    - "Components remain theme-aware and reusable"
```

## Sample Reference Nav Config

```yaml
sample_reference_nav_config:
  code: |
    {
      "tabs": [
        {
          "id": "combat",
          "label": "Combat",
          "sections": ["measuring_time", "free_actions", "actions", "severe_injuries"]
        },
        {
          "id": "core_rules",
          "label": "Core Rules",
          "sections": ["attributes", "skills", "healing_and_rest", "conditions", "skill_level_base_chance", "fear"]
        },
        {
          "id": "npcs_animals",
          "label": "NPCs & Animals",
          "sections": ["typical_npcs", "common_animals", "npc_attribute_guidelines"]
        },
        {
          "id": "generators",
          "label": "Generators",
          "sections": ["creating_npcs"]
        },
        {
          "id": "travel_hazards",
          "label": "Travel",
          "sections": ["mishaps"]
        }
      ]
    }
```

## Prompt for Claude Code

```yaml
prompt_for_claude_code:
  text: |
    Add a dedicated Reference screen to Scaldmark with a top-level tab navigation system.
    The goal is a one-stop shop for the basic Dragonbane rules and play aids.

    Use the uploaded Dragonbane reference blueprint and normalized reference data as the source of truth.
    Organize the Reference page into these top-level tabs:
    - Combat
    - Core Rules
    - NPCs & Animals
    - Generators
    - Travel

    Requirements:
    - Build the page for tablet use
    - Keep it offline-first
    - Use bundled static data, not network fetches
    - Support a search field
    - Support section jump navigation inside tabs
    - Render tables, key-value lists, and rules text cleanly
    - Use Scaldmark theme tokens
    - Do not embed a PDF viewer
    - Do not widen scope into a full compendium framework

    Use the normalized reference data as the canonical content source and map sections to tabs.
    Output all created/changed files in full.
```

## Final Note

```yaml
final_note:
  recommendation: >
    This Reference page should become the in-app field manual. The tab structure lets
    it feel much faster than a PDF while still honoring the original grouped content.
```

---

# Part 6: Reference Data Transform & Mapping Spec

## Document Metadata

```yaml
document:
  type: data_transform_spec
  version: "1.0.0"
  status: ready-for-implementation
  title: "Scaldmark Reference Data Transform and Mapping Spec"
  subtitle: "Convert Dragonbane reference source data into Scaldmark runtime models"
  intended_consumer: "Claude Code / Clawed Code"
  parent_product: "Scaldmark: The Adventurer's Ledger"
  companion_specs:
    - "Scaldmark Reference Navigation Spec"
  purpose: >
    Define the exact transformation layer that converts the uploaded Dragonbane reference
    blueprint and normalized reference sheet into Scaldmark-ready data structures for
    tabbed navigation, section rendering, search, and offline runtime use. The goal is
    to make the data pipeline explicit, stable, and reusable without turning Scaldmark
    into a sprawling compendium framework.
```

## Source Inputs

```yaml
source_inputs:
  blueprint_source:
    path: "/mnt/data/dragonbane_reference_blueprint.yaml"
    role: "layout/grouping/render hint source"
    citation: ":contentReference[oaicite:2]{index=2}"
  normalized_source:
    path: "/mnt/data/dragonbane_reference_sheet.yaml"
    role: "canonical content source"
    citation: ":contentReference[oaicite:3]{index=3}"
```

## Transform Goals

```yaml
transform_goals:
  - "Use normalized sheet data as canonical content"
  - "Use blueprint page/component structure as layout and grouping metadata"
  - "Produce app-bundled JSON models"
  - "Map sections into Scaldmark tabs"
  - "Preserve stable section ids"
  - "Support local search"
  - "Support renderer selection per section type"
  - "Support future additional reference packs without refactoring the runtime"
```

## Design Principles

```yaml
design_principles:
  - "Canonical content lives in normalized source"
  - "Blueprint informs presentation, not rules truth"
  - "Transform once, render many times"
  - "Stable ids over display strings"
  - "Keep runtime data simple"
  - "No dynamic YAML parsing in browser runtime"
  - "Compile or preconvert to JSON for app use"
```

## Runtime Data Strategy

```yaml
runtime_data_strategy:
  recommendation: >
    Convert YAML source files into JSON at build time or as a committed preprocessed artifact.
    The app runtime should consume JSON, not parse YAML in the browser.
  required_runtime_files:
    - "src/features/reference/data/dragonbane-reference.document.json"
    - "src/features/reference/data/dragonbane-reference.tabs.json"
    - "src/features/reference/data/dragonbane-reference.sections.json"
    - "src/features/reference/data/dragonbane-reference.search-index.json"
  optional_runtime_files:
    - "src/features/reference/data/dragonbane-reference.render-hints.json"
```

## Transform Pipeline

```yaml
transform_pipeline:
  stages:
    - stage_id: "S1"
      name: "Load Source Files"
      input:
        - "dragonbane_reference_blueprint.yaml"
        - "dragonbane_reference_sheet.yaml"
      output:
        - "rawBlueprint"
        - "rawReferenceDocument"
    - stage_id: "S2"
      name: "Validate Source Structure"
      input:
        - "rawBlueprint"
        - "rawReferenceDocument"
      checks:
        - "document metadata exists"
        - "sections array exists in normalized source"
        - "section ids unique"
        - "blueprint pages/components structurally valid"
      output:
        - "validatedBlueprint"
        - "validatedReferenceDocument"
    - stage_id: "S3"
      name: "Normalize Section Records"
      input:
        - "validatedReferenceDocument.sections"
      output:
        - "normalizedSections"
      behavior:
        - "ensure every section has id, title, type"
        - "default missing arrays to empty arrays"
        - "normalize table rows to array"
        - "normalize key_value_list items to array"
        - "normalize rules_text paragraphs to array"
    - stage_id: "S4"
      name: "Attach Blueprint Layout Hints"
      input:
        - "validatedBlueprint.pages"
        - "normalizedSections"
      output:
        - "sectionsWithLayoutHints"
      behavior:
        - "match blueprint component.section_id to normalized section.id"
        - "copy render_hint metadata onto matched section"
        - "copy page_number and page purpose onto matched section"
        - "support nested blueprint containers like two_column_region and three_panel_region"
    - stage_id: "S5"
      name: "Map Sections to Scaldmark Tabs"
      input:
        - "sectionsWithLayoutHints"
      output:
        - "tabbedSections"
      behavior:
        - "assign each section to a Scaldmark tab"
        - "assign display order inside each tab"
        - "assign optional quick-jump group labels"
    - stage_id: "S6"
      name: "Build Runtime Navigation Model"
      input:
        - "tabbedSections"
      output:
        - "referenceTabs"
        - "referenceDocument"
      behavior:
        - "create tab metadata"
        - "create section ids per tab"
        - "create labels and section counts"
    - stage_id: "S7"
      name: "Build Search Index"
      input:
        - "tabbedSections"
      output:
        - "searchIndex"
      behavior:
        - "flatten titles, rows, items, paragraphs into searchable text blobs"
        - "associate each blob with tab_id and section_id"
    - stage_id: "S8"
      name: "Emit Runtime Artifacts"
      output:
        - "dragonbane-reference.document.json"
        - "dragonbane-reference.tabs.json"
        - "dragonbane-reference.sections.json"
        - "dragonbane-reference.search-index.json"
```

## Canonical Source Rules

```yaml
canonical_source_rules:
  content_truth:
    source: "normalized_reference_file"
    rationale: >
      The normalized reference file contains the structured section content and should be the
      single source of truth for titles, rows, items, and paragraphs. :contentReference[oaicite:4]{index=4}
  layout_truth:
    source: "blueprint_file"
    rationale: >
      The blueprint file carries useful page purpose and component render hints such as
      full-width table, compact table, stacked sections, and grouped page intent.
  conflict_rule:
    behavior: >
      If normalized content and blueprint metadata disagree, keep normalized content and use
      blueprint only for grouping/render hints unless an explicit override is defined.
```

## Runtime Models

```yaml
runtime_models:
  reference_document_model:
    description: "Top-level metadata about this bundled reference pack"
    fields:
      id: "string"
      title: "string"
      subtitle: "string | null"
      sourceKind: "string"
      pageCount: "number"
      licenseNotice: "string | null"
      notes: "string[]"
      themeHints: "object | null"
      sourcePackId: "string"
  reference_tab_model:
    description: "Top-level tab in Scaldmark reference UI"
    fields:
      id: "string"
      label: "string"
      shortLabel: "string | null"
      iconHint: "string | null"
      description: "string | null"
      displayOrder: "number"
      sectionIds: "string[]"
      sectionCount: "number"
  reference_section_model:
    description: "Runtime section model rendered by Scaldmark"
    fields:
      id: "string"
      title: "string"
      type: "table | key_value_list | rules_text | text_block"
      tabId: "string"
      pageNumber: "number | null"
      pagePurpose: "string | null"
      displayOrder: "number"
      searchWeight: "number"
      renderModel: "string"
      columns: "string[]"
      rows: "object[]"
      items: "object[]"
      paragraphs: "string[]"
      notes: "string[]"
      renderHints: "object"
      sourceMeta: "object"
  reference_search_entry_model:
    description: "Precomputed searchable content record"
    fields:
      id: "string"
      tabId: "string"
      sectionId: "string"
      sectionTitle: "string"
      blobType: "title | row | item | paragraph | note"
      text: "string"
      keywords: "string[]"
      weight: "number"
```

## Scaldmark Tabs Definition

```yaml
scaldmark_tabs:
  definition:
    - id: "combat"
      label: "Combat"
      shortLabel: "Combat"
      iconHint: "swords"
      description: "Time, actions, reactions, and injuries"
      displayOrder: 10
    - id: "core_rules"
      label: "Core Rules"
      shortLabel: "Core"
      iconHint: "book"
      description: "Attributes, skills, rest, conditions, fear"
      displayOrder: 20
    - id: "npcs_animals"
      label: "NPCs & Animals"
      shortLabel: "NPCs"
      iconHint: "users"
      description: "Typical NPCs, animals, and NPC guidelines"
      displayOrder: 30
    - id: "generators"
      label: "Generators"
      shortLabel: "Gen"
      iconHint: "dice"
      description: "NPC generation and improv prompts"
      displayOrder: 40
    - id: "travel_hazards"
      label: "Travel"
      shortLabel: "Travel"
      iconHint: "map"
      description: "Mishaps and wilderness trouble"
      displayOrder: 50
```

## Section-to-Tab Mapping

```yaml
section_to_tab_mapping:
  mapping:
    - section_id: "measuring_time"
      tab_id: "combat"
      display_order: 10
      search_weight: 8
    - section_id: "free_actions"
      tab_id: "combat"
      display_order: 20
      search_weight: 8
    - section_id: "actions"
      tab_id: "combat"
      display_order: 30
      search_weight: 10
    - section_id: "severe_injuries"
      tab_id: "combat"
      display_order: 40
      search_weight: 9
    - section_id: "attributes"
      tab_id: "core_rules"
      display_order: 10
      search_weight: 7
    - section_id: "skills"
      tab_id: "core_rules"
      display_order: 20
      search_weight: 10
    - section_id: "healing_and_rest"
      tab_id: "core_rules"
      display_order: 30
      search_weight: 9
    - section_id: "conditions"
      tab_id: "core_rules"
      display_order: 40
      search_weight: 10
    - section_id: "skill_level_base_chance"
      tab_id: "core_rules"
      display_order: 50
      search_weight: 6
    - section_id: "fear"
      tab_id: "core_rules"
      display_order: 60
      search_weight: 9
    - section_id: "typical_npcs"
      tab_id: "npcs_animals"
      display_order: 10
      search_weight: 7
    - section_id: "common_animals"
      tab_id: "npcs_animals"
      display_order: 20
      search_weight: 7
    - section_id: "npc_attribute_guidelines"
      tab_id: "npcs_animals"
      display_order: 30
      search_weight: 6
    - section_id: "creating_npcs"
      tab_id: "generators"
      display_order: 10
      search_weight: 7
    - section_id: "mishaps"
      tab_id: "travel_hazards"
      display_order: 10
      search_weight: 8
```

## Blueprint Layout Extraction

```yaml
blueprint_layout_extraction:
  purpose: >
    Extract useful presentation hints from the blueprint and attach them to runtime sections
    so Scaldmark can render sections intelligently without copying the PDF layout literally.
  extracted_fields:
    - "page_number"
    - "page purpose"
    - "component_type"
    - "render_hint.variant"
    - "render_hint.column_widths"
    - "render_hint.row_striping"
    - "render_hint.allow_nested_rows"
    - "render_hint.allow_multiline_cells"
    - "render_hint.dense"
    - "container context (stacked, split, panel region)"
  examples:
    measuring_time:
      from_blueprint:
        page_number: 2
        page_purpose: "Combat and time reference"
        variant: "full_width_table"
        row_striping: "alternating"
        column_widths:
          - "22%"
          - "20%"
          - "58%"
    skills:
      from_blueprint:
        page_number: 3
        page_purpose: "Core rules reference"
        variant: "full_width_table"
        column_widths:
          - "22%"
          - "12%"
          - "66%"
        allow_nested_rows: true
    fear:
      from_blueprint:
        page_number: 3
        page_purpose: "Core rules reference"
        variant: "wide_effect_table"
        column_widths:
          - "10%"
          - "90%"
    typical_npcs:
      from_blueprint:
        page_number: 4
        page_purpose: "NPC and animal reference"
        variant: "full_width_table"
        allow_multiline_cells: true
    creating_npcs:
      from_blueprint:
        page_number: 5
        page_purpose: "NPC generator and travel hazards"
        variant: "full_width_table"
        dense: true
```

## Render Model Rules

```yaml
render_model_rules:
  purpose: "Choose a Scaldmark renderer based on section type plus attached hints"
  rules:
    - when:
        type: "table"
        variant: "compact_table"
      render_model: "referenceCompactTable"
    - when:
        type: "table"
        variant: "full_width_table"
      render_model: "referenceStandardTable"
    - when:
        type: "table"
        variant: "wide_effect_table"
      render_model: "referenceWideEffectTable"
    - when:
        type: "key_value_list"
      render_model: "referenceKeyValueList"
    - when:
        type: "rules_text"
      render_model: "referenceRulesText"
    - when:
        type: "text_block"
      render_model: "referenceTextBlock"
  fallback:
    render_model: "referenceGenericSection"
```

## Search Index Rules

```yaml
search_index_rules:
  purpose: "Make local search fast and straightforward"
  included_text_sources:
    - "section title"
    - "table row cell values"
    - "key_value_list item names"
    - "key_value_list item descriptions"
    - "rules_text paragraphs"
    - "section notes"
  normalization:
    - "lowercase all search text"
    - "strip repeated whitespace"
    - "optionally strip punctuation for simpler matching"
  optional_keywords:
    - "tab label"
    - "page purpose"
    - "section id"
  weighting_guidance:
    title: 10
    item_name: 8
    row_primary_column: 7
    description_or_effect: 5
    note: 4
  search_examples:
    - query: "fear"
      expected_hits:
        - "fear section title"
        - "severe injuries row with nightmares"
    - query: "rest"
      expected_hits:
        - "measuring time"
        - "healing and rest"
        - "actions > round rest"
    - query: "wolf"
      expected_hits:
        - "common animals"
        - "mishaps savage animal"
```

## Transform Rules by Section Type

```yaml
transform_rules_by_section_type:
  table:
    required_output_fields:
      - "columns"
      - "rows"
    normalization_rules:
      - "preserve row order"
      - "preserve multiline arrays if present as arrays"
      - "stringify only at render time, not transform time"
  key_value_list:
    required_output_fields:
      - "items"
    normalization_rules:
      - "require name"
      - "allow missing description as empty string"
  rules_text:
    required_output_fields:
      - "paragraphs"
    normalization_rules:
      - "preserve paragraph order"
  text_block:
    required_output_fields:
      - "paragraphs or text converted to paragraph array"
    normalization_rules:
      - "convert single text field to one-paragraph array if needed"
```

## File Outputs

```yaml
file_outputs:
  reference_document_json:
    path: "src/features/reference/data/dragonbane-reference.document.json"
    contains:
      - "document metadata"
      - "license notice"
      - "theme hints"
  reference_tabs_json:
    path: "src/features/reference/data/dragonbane-reference.tabs.json"
    contains:
      - "tab definitions"
      - "ordered section ids"
  reference_sections_json:
    path: "src/features/reference/data/dragonbane-reference.sections.json"
    contains:
      - "all runtime sections"
      - "render model"
      - "render hints"
      - "page metadata"
      - "tab mapping"
  reference_search_index_json:
    path: "src/features/reference/data/dragonbane-reference.search-index.json"
    contains:
      - "flattened searchable entries"
```

## Validation Requirements

```yaml
validation_requirements:
  source_validation:
    - "blueprint file must parse"
    - "normalized file must parse"
    - "all normalized section ids must be unique"
    - "all blueprint referenced section_ids should exist in normalized sections unless explicitly ignored"
  output_validation:
    - "every section has exactly one tabId"
    - "every section has one renderModel"
    - "every tab sectionId must map to a real section"
    - "search index entries must reference real tabId and sectionId"
  warnings_not_errors:
    - "blueprint has component ids without matching normalized section only if component is cover page or synthetic layout container"
    - "normalized section lacks blueprint render hint, in which case fallback render model may be used"
```

## Synthetic Sections and Exclusions

```yaml
synthetic_sections_and_exclusions:
  excluded_from_runtime_tabs:
    - "cover page content from blueprint"
  synthetic_runtime_objects_allowed:
    - "tab metadata"
    - "section quick-jump lists"
    - "search index entries"
  note: >
    The blueprint includes a cover page component and layout containers like two_column_region
    and three_panel_region which should not become standalone user-visible sections.
```

## Suggested Code Artifacts

```yaml
suggested_code_artifacts:
  source_loader:
    path: "scripts/reference/parseDragonbaneReference.ts"
    purpose: "Load YAML source files and validate"
  transformer:
    path: "scripts/reference/buildDragonbaneReferenceArtifacts.ts"
    purpose: "Build output JSON artifacts"
  schemas:
    - "scripts/reference/schemas/referenceSource.schema.ts"
    - "scripts/reference/schemas/referenceRuntime.schema.ts"
  runtime_files:
    - "src/features/reference/data/dragonbane-reference.document.json"
    - "src/features/reference/data/dragonbane-reference.tabs.json"
    - "src/features/reference/data/dragonbane-reference.sections.json"
    - "src/features/reference/data/dragonbane-reference.search-index.json"
```

## Example Runtime Section

```yaml
example_runtime_section:
  code: |
    {
      "id": "conditions",
      "title": "Conditions",
      "type": "table",
      "tabId": "core_rules",
      "pageNumber": 3,
      "pagePurpose": "Core rules reference",
      "displayOrder": 40,
      "searchWeight": 10,
      "renderModel": "referenceCompactTable",
      "columns": ["condition", "attribute"],
      "rows": [
        { "condition": "Exhausted", "attribute": "STR" },
        { "condition": "Sickly", "attribute": "CON" }
      ],
      "items": [],
      "paragraphs": [],
      "notes": [
        "Bane on all rolls against attribute and skill rolls based on that attribute."
      ],
      "renderHints": {
        "variant": "compact_table",
        "columnWidths": ["60%", "40%"]
      },
      "sourceMeta": {
        "sourcePackId": "dragonbane-reference-sheet",
        "sourceSectionId": "conditions"
      }
    }
```

## Example Search Index Entry

```yaml
example_search_index_entry:
  code: |
    {
      "id": "conditions-title",
      "tabId": "core_rules",
      "sectionId": "conditions",
      "sectionTitle": "Conditions",
      "blobType": "title",
      "text": "conditions",
      "keywords": ["core rules", "condition", "attribute", "bane"],
      "weight": 10
    }
```

## Implementation Algorithm

```yaml
implementation_algorithm:
  pseudocode:
    - "parse blueprint YAML"
    - "parse normalized reference YAML"
    - "validate both against source schemas"
    - "index normalized sections by id"
    - "walk blueprint pages recursively"
    - "for each component with section_id, attach page and render hints to that section"
    - "for layout containers, recurse into children/panels"
    - "for each normalized section, apply explicit section_to_tab_mapping"
    - "derive renderModel from section type + variant"
    - "build ordered tab models from mapped sections"
    - "build search index by flattening text content"
    - "emit JSON output files"
    - "validate runtime JSON artifacts"
```

## Do and Don't

```yaml
do_and_dont:
  do:
    - "Use normalized reference sections as content source"
    - "Use blueprint only for render and grouping hints"
    - "Preserve stable section ids"
    - "Emit simple runtime JSON"
    - "Precompute search index"
    - "Validate every stage"
  dont:
    - "Do not parse YAML in the browser runtime"
    - "Do not flatten away useful section structure"
    - "Do not make runtime depend on blueprint container geometry"
    - "Do not infer tab mapping from fuzzy titles when explicit mapping is defined"
    - "Do not silently drop unmatched source sections"
```

## Guardrails

```yaml
guardrails:
  engineering_guardrails:
    - "Transformation should be deterministic"
    - "Same source input should always produce same output order"
    - "No dynamic eval or unsafe content rendering"
    - "Keep transform script separate from UI runtime"
  product_guardrails:
    - "Runtime data should serve fast lookup, not archival fidelity"
    - "If a layout hint hurts readability, renderer may ignore it"
  maintenance_guardrails:
    - "Adding a new reference pack later should require new source data and a mapping config, not runtime refactor"
```

## Test Requirements

```yaml
test_requirements:
  transform_tests:
    - "all normalized sections emitted to runtime output unless explicitly excluded"
    - "all sections receive tab assignment"
    - "all sections receive render model"
    - "blueprint page metadata attached where available"
    - "search index contains entries for title and body content"
  negative_tests:
    - "missing section in blueprint does not crash transform"
    - "unknown section type fails clearly"
    - "duplicate section ids fail validation"
    - "invalid mapping section_id fails validation"
  snapshot_tests:
    - "tabs output stable"
    - "sections output stable"
    - "search index output stable enough for review"
```

## Prompt for Claude Code

```yaml
prompt_for_claude_code:
  text: |
    Create the reference data transformation pipeline for Scaldmark.

    Inputs:
    - the uploaded Dragonbane reference blueprint YAML
    - the uploaded Dragonbane normalized reference sheet YAML

    Requirements:
    - use the normalized reference sheet as the canonical content source
    - use the blueprint for page grouping and render hints
    - produce runtime JSON artifacts for:
      1. document metadata
      2. tab definitions
      3. runtime sections
      4. search index
    - map sections into these tabs:
      Combat, Core Rules, NPCs & Animals, Generators, Travel
    - preserve stable section ids
    - assign render models based on section type and blueprint variant
    - precompute searchable text blobs
    - validate source and output shapes
    - do not parse YAML in the browser runtime

    Suggested outputs:
    - transform script(s)
    - schemas
    - generated JSON artifacts
    - any small helper utilities

    Keep the transformation deterministic, typed, and easy to review.
    Output all created or changed files in full.
```

## Acceptance Criteria

```yaml
acceptance_criteria:
  functional:
    - "A transform script can convert uploaded YAML source into Scaldmark runtime JSON"
    - "All reference sections appear in exactly one Scaldmark tab"
    - "Runtime sections include render hints and page metadata where available"
    - "Search index supports local lookup"
  technical:
    - "Runtime app consumes JSON, not YAML"
    - "Validation exists for source and runtime models"
    - "Transformation is deterministic"
  usability:
    - "Produced tab/section structure aligns with fast reference lookup needs"
```

## Final Note

```yaml
final_note:
  recommendation: >
    This file is the little gear train behind the reference vault. The previous spec decides
    what the user sees. This one decides how the data gets turned into something sturdy enough
    for Scaldmark to wield without tripping over a pile of YAML scrolls.
```

---

# Appendix A: Dragonbane Reference Blueprint (Source Data)

> Source file: `C:\Users\CalebBennett\Documents\Notes\DragonBane\dragonbane_reference_blueprint.yaml`

```yaml
document_blueprint:
  title: Dragonbane Reference Sheet Builder Blueprint
  source_document:
    title: Dragonbane Reference Sheet
    subtitle: A supplement for Dragonbane
    source_pdf: https://d1vzi28wh99zvq.cloudfront.net/pdf_previews/467450-sample.pdf
    source_kind: sample preview pdf
    page_count: 5
    license_notice: This game is not affiliated with, sponsored, or endorsed by Fria Ligan AB. This Supplement was created under Fria Ligan AB's Dragonbane Third Party Supplement License.
  intent:
  - Use this file as a rendering-oriented schema for rebuilding the reference sheet in HTML, a PWA, or another UI layer.
  - Content is grouped into reusable components such as cover blocks, section headers, key-value lists, and data tables.
  - The layout model favors readability over pixel-perfect reproduction, but tracks the original page grouping and visual hierarchy.
  theme:
    style_name: dragonbane_reference_sample
    page_background: '#f3f3ef'
    accent_primary: '#2f5b1f'
    accent_secondary: '#9bc07b'
    title_red: '#d92b20'
    text_color: '#1b1b1b'
    watermark_present_in_sample: true
    watermark_text: Sample file
    notes:
    - The sample PDF uses dark green section bars with white uppercase titles.
    - Table header rows use a lighter green fill.
    - Body rows alternate between white and pale green.
    - The cover page uses a large red DRAGONBANE wordmark and a centered title block.
  component_library:
    cover_page:
      description: Full-page title treatment with brand mark, subtitle, divider, and legal notice.
      fields:
      - brand
      - title
      - subtitle
      - legal_notice
    section_header:
      description: Horizontal dark-green title bar with white uppercase text.
      fields:
      - title
    table:
      description: Structured tabular content with column headers and rows.
      fields:
      - title
      - columns
      - rows
      - row_style
      - notes
    key_value_list:
      description: Two-column list with a bold label and descriptive body text.
      fields:
      - title
      - items
      - row_style
      - notes
    text_block:
      description: Freeform explanatory text or notes.
      fields:
      - title
      - text
    two_column_region:
      description: A layout container for placing multiple components side by side.
      fields:
      - left
      - right
  pages:
  - page_number: 1
    purpose: Cover
    layout: single_column_centered
    components:
    - component_type: cover_page
      id: cover
      brand:
        primary_text: DRAGONBANE
        prefix_text: A Supplement for
        style_hint: large_centered_logo
      title: Reference Sheet
      subtitle: null
      divider: true
      legal_notice: This game is not affiliated with, sponsored, or endorsed by Fria Ligan AB. This Supplement was created under Fria Ligan AB's Dragonbane Third Party Supplement License.
  - page_number: 2
    purpose: Combat and time reference
    layout: stacked_sections
    components:
    - component_type: table
      section_id: measuring_time
      render_hint:
        variant: full_width_table
        row_striping: alternating
        column_widths:
        - 22%
        - 20%
        - 58%
    - component_type: key_value_list
      section_id: free_actions
      render_hint:
        variant: full_width_label_list
        label_width: 20%
        body_width: 80%
    - component_type: key_value_list
      section_id: actions
      render_hint:
        variant: full_width_label_list
        label_width: 20%
        body_width: 80%
    - component_type: table
      section_id: severe_injuries
      render_hint:
        variant: full_width_table
        row_striping: alternating
        column_widths:
        - 10%
        - 20%
        - 70%
  - page_number: 3
    purpose: Core rules reference
    layout: mixed_top_split_then_full_then_three_panel
    components:
    - component_type: two_column_region
      id: page3_top_split
      left:
        component_type: table
        section_id: attributes
        render_hint:
          variant: compact_table
          column_widths:
          - 34%
          - 66%
      right:
        component_type: table
        section_id: healing_and_rest
        render_hint:
          variant: compact_table
          column_widths:
          - 28%
          - 72%
    - component_type: table
      section_id: skills
      render_hint:
        variant: full_width_table
        column_widths:
        - 22%
        - 12%
        - 66%
        allow_nested_rows: true
    - component_type: three_panel_region
      id: page3_bottom_region
      panels:
      - position: left_top
        component_type: table
        section_id: conditions
        render_hint:
          variant: compact_table
          column_widths:
          - 60%
          - 40%
      - position: left_bottom
        component_type: table
        section_id: skill_level_base_chance
        render_hint:
          variant: compact_table
          column_widths:
          - 60%
          - 40%
      - position: right_full
        component_type: table
        section_id: fear
        render_hint:
          variant: wide_effect_table
          column_widths:
          - 10%
          - 90%
  - page_number: 4
    purpose: NPC and animal reference
    layout: stacked_sections
    components:
    - component_type: table
      section_id: typical_npcs
      render_hint:
        variant: full_width_table
        allow_multiline_cells: true
        column_widths:
        - 17%
        - 22%
        - 19%
        - 10%
        - 8%
        - 8%
        - 16%
    - component_type: table
      section_id: common_animals
      render_hint:
        variant: full_width_table
        allow_multiline_cells: true
        column_widths:
        - 16%
        - 11%
        - 8%
        - 33%
        - 32%
    - component_type: text_block
      id: attributes_for_npcs
      title: Attributes for NPCs
      text: 'In adventures for Dragonbane, attribute scores for NPCs are not listed as they are very rarely used. If you need to roll against an exact attribute score: STR & AGL use the damage bonus. At +D6, roll against 17. At +D4, roll against 14. At no bonus, roll against 10. CON: roll against maximum HP, reduced by 2 for each level of Robust. WIL: roll against maximum WP if listed, reduced by 2 for each level of Focused. If WP is not listed, roll against 10. INT & CHA: roll against 10.'
      render_hint:
        variant: two_column_note_box
        split_after_sentence: 'CON:'
      source_section_id: npc_attribute_guidelines
  - page_number: 5
    purpose: NPC generator and travel hazards
    layout: stacked_sections
    components:
    - component_type: table
      section_id: creating_npcs
      render_hint:
        variant: full_width_table
        column_widths:
        - 8%
        - 11%
        - 11%
        - 26%
        - 14%
        - 14%
        - 16%
        dense: true
    - component_type: table
      section_id: mishaps
      render_hint:
        variant: full_width_table
        column_widths:
        - 8%
        - 92%
        allow_multiline_cells: true
  rendering_rules:
    default_title_case: uppercase
    header_bar_style:
      background: '#2f5b1f'
      text_color: '#ffffff'
      font_weight: bold
    table_header_style:
      background: '#9bc07b'
      text_color: '#1b1b1b'
      font_weight: bold
    table_body_style:
      row_striping:
      - '#ffffff'
      - '#e4eddc'
      border_style: minimal
    label_style:
      font_weight: bold
    body_text_style:
      font_family_hint: serif_or_bookish
      font_size_hint: compact_readable
  section_index:
  - section_id: measuring_time
    title: Measuring Time
    source_type: table
    row_count: 3
    item_count: null
    columns:
    - unit_of_time
    - duration
    - enough_time_to
    notes: []
  - section_id: free_actions
    title: Free Actions
    source_type: key_value_list
    row_count: null
    item_count: 4
    columns: null
    notes: []
  - section_id: actions
    title: Actions
    source_type: key_value_list
    row_count: null
    item_count: 16
    columns: null
    notes: []
  - section_id: severe_injuries
    title: Severe Injuries
    source_type: table
    row_count: 14
    item_count: null
    columns:
    - d20
    - injury
    - effect
    notes: []
  - section_id: attributes
    title: Attributes
    source_type: table
    row_count: 6
    item_count: null
    columns:
    - attribute
    - description
    notes: []
  - section_id: skills
    title: Skills
    source_type: table
    row_count: 31
    item_count: null
    columns:
    - skill
    - attribute
    - description
    notes: []
  - section_id: healing_and_rest
    title: Healing & Rest
    source_type: table
    row_count: 3
    item_count: null
    columns:
    - rest_type
    - effect
    notes: []
  - section_id: conditions
    title: Conditions
    source_type: table
    row_count: 6
    item_count: null
    columns:
    - condition
    - attribute
    notes:
    - Bane on all rolls against attribute and skill rolls based on that attribute.
  - section_id: fear
    title: Fear
    source_type: table
    row_count: 8
    item_count: null
    columns:
    - d8
    - effect
    notes: []
  - section_id: skill_level_base_chance
    title: Skill Level
    source_type: table
    row_count: 5
    item_count: null
    columns:
    - attribute_range
    - base_chance
    notes: []
  - section_id: typical_npcs
    title: Typical NPCs
    source_type: table
    row_count: 11
    item_count: null
    columns:
    - type
    - skills
    - heroic_abilities
    - damage_bonus
    - hp
    - wp
    - gear
    notes: []
  - section_id: common_animals
    title: Common Animals
    source_type: table
    row_count: 11
    item_count: null
    columns:
    - animal
    - movement
    - hp
    - attack
    - skills
    notes: []
  - section_id: npc_attribute_guidelines
    title: Attributes for NPCs
    source_type: rules_text
    row_count: null
    item_count: null
    columns: null
    notes: []
  - section_id: creating_npcs
    title: Creating NPCs
    source_type: table
    row_count: 20
    item_count: null
    columns:
    - d20
    - attitude_d4
    - kin_d6
    - motivation_d8
    - profession_d10
    - trait_d12
    - name_d20_choose_one
    notes: []
  - section_id: mishaps
    title: Mishaps
    source_type: table
    row_count: 12
    item_count: null
    columns:
    - d12
    - mishap
    notes: []
```

---

# Appendix B: Dragonbane Reference Sheet (Normalized Content Data)

> Source file: `C:\Users\CalebBennett\Documents\Notes\DragonBane\dragonbane_reference_sheet.yaml`

```yaml
document:
  title: Dragonbane Reference Sheet
  subtitle: A supplement for Dragonbane
  source_pdf: https://d1vzi28wh99zvq.cloudfront.net/pdf_previews/467450-sample.pdf
  source_kind: sample preview pdf
  page_count: 5
  license_notice: This game is not affiliated with, sponsored, or endorsed by Fria Ligan AB. This Supplement was created under Fria Ligan AB's Dragonbane Third Party Supplement License.
  notes:
  - Extracted and reorganized for reuse in HTML, PWA, or other reference-document builders.
  - Content has been normalized into named sections and tables.
  - A few OCR/parsing issues from the preview were corrected using page screenshots where possible.
sections:
- id: measuring_time
  title: Measuring Time
  type: table
  columns:
  - unit_of_time
  - duration
  - enough_time_to
  rows:
  - unit_of_time: Round
    duration: 10 seconds
    enough_time_to: Perform an action in combat, take a round rest (page 52)
  - unit_of_time: Stretch
    duration: 15 minutes
    enough_time_to: Explore a room, take a stretch rest (page 52)
  - unit_of_time: Shift
    duration: 6 hours
    enough_time_to: Hike for 15 kilometers, take a shift rest (page 52)
- id: free_actions
  title: Free Actions
  type: key_value_list
  items:
  - name: Draw Weapon
    description: Draw, exchange, or put away a weapon kept at hand.
  - name: Change Position
    description: Throw yourself to the ground or get up.
  - name: Drop Item
    description: Drop an item on the ground.
  - name: Shout
    description: Say or shout a few words.
- id: actions
  title: Actions
  type: key_value_list
  items:
  - name: Dash
    description: This action doubles your movement rate in the round.
  - name: Melee Attack
    description: These can be performed against an enemy within 2 meters (4 meters for long weapons).
  - name: Ranged Attack
    description: Attacks with a ranged weapon can be made against targets within the weapon's range.
  - name: Parry
    description: Both melee and ranged attacks can be parried, but the latter requires a shield. Parrying is a reaction and takes place outside your turn and replaces your regular action in the round.
  - name: Dodge
    description: Dodging melee or ranged attacks is also a reaction.
  - name: Pick Up Item
    description: Pick up an item from the ground within 2 meters, or from your inventory.
  - name: Equip / Unequip Armor / Helmet
    description: Suits of armor and helmets protect you from damage, but also restrict your movement.
  - name: First Aid
    description: The HEALING skill is used to save the life of someone who has had their HP reduced to zero and is at risk of dying.
  - name: Rally
    description: You can PERSUADE another player character at zero HP to rally and keep fighting.
  - name: Break Down Door
    description: Doors can take a certain amount of damage before they break down.
  - name: Pick Lock
    description: Picking a lock requires a SLEIGHT OF HAND roll. Doing so without lockpicks gives you a bane.
  - name: Use Item
    description: Use a potion or some other item within 2 meters.
  - name: Activate Ability
    description: Use an innate or heroic ability.
  - name: Cast Spell
    description: In most cases, casting a spell counts as an action. This includes magic tricks. Some spells are reactions and do not require an action, while others are more time-consuming.
  - name: Helping
    description: Helping another character gives them a boon to a roll in the same round.
  - name: Round Rest
    description: You rest and recover D6 WP. This can only be done once per shift.
- id: severe_injuries
  title: Severe Injuries
  type: table
  columns:
  - d20
  - injury
  - effect
  rows:
  - d20: 1-2
    injury: Broken nose
    effect: 'You get a bane on all AWARENESS rolls. Healing time: D6 days.'
  - d20: 3-4
    injury: Scarred face
    effect: 'Bane on all PERFORMANCE and PERSUASION rolls. Healing time: 2D6 days.'
  - d20: 5-6
    injury: Teeth knocked out
    effect: Your PERFORMANCE and PERSUASION skill levels are permanently reduced by 2 (to a minimum of 3).
  - d20: 7-8
    injury: Broken ribs
    effect: 'Bane on all skills based on STR and AGL. Healing time: D6 days.'
  - d20: 9-10
    injury: Concussion
    effect: 'Bane on all skills based on INT. Healing time: D6 days.'
  - d20: 11-12
    injury: Deep wounds
    effect: 'Bane on all skills based on STR and AGL, and every roll against such skill inflicts D6 points of damage. Healing time: 2D6 days.'
  - d20: '13'
    injury: Broken leg
    effect: 'Your movement rate is halved. Healing time: 3D6 days.'
  - d20: '14'
    injury: Broken arm
    effect: 'You cannot use two-handed weapon, nor dual wield, and get a bane on all other actions normally using both arms, such as climbing. Healing time: 3D6 days.'
  - d20: '15'
    injury: Severed toe
    effect: Movement rate permanently reduced by 2 (to a minimum of 4).
  - d20: '16'
    injury: Severed finger
    effect: Your skill levels in all weapon skills are permanently reduced by 1 (to a minimum of 3).
  - d20: '17'
    injury: Gouged eye
    effect: Your skill level in SPOT HIDDEN is permanently reduced by 2 (to a minimum of 3).
  - d20: '18'
    injury: Nightmares
    effect: 'Roll to resist fear (page 52). Each shift you sleep. If you fail, the shift doesn''t count as slept. Healing time: 2D6 days.'
  - d20: '19'
    injury: Changed personality
    effect: Randomly generate a new weakness (page 26).
  - d20: '20'
    injury: Amnesia
    effect: 'You cannot remember who you or the other player characters are. The effect must be roleplayed. Healing time: D6 days.'
- id: attributes
  title: Attributes
  type: table
  columns:
  - attribute
  - description
  rows:
  - attribute: Strength (STR)
    description: Raw muscle power.
  - attribute: Constitution (CON)
    description: Physical fitness and resilience.
  - attribute: Agility (AGL)
    description: Body control, speed, and fine motor skills.
  - attribute: Intelligence (INT)
    description: Mental acuity, intellect, and reasoning skills.
  - attribute: Willpower (WIL)
    description: Self-discipline and focus.
  - attribute: Charisma (CHA)
    description: Force of personality and empathy.
- id: skills
  title: Skills
  type: table
  columns:
  - skill
  - attribute
  - description
  rows:
  - skill: ACROBATICS
    attribute: AGL
    description: Jumping, climbing, balancing or performing other similar physical actions.
  - skill: AWARENESS
    attribute: INT
    description: Watch or listen for anyone sneaking around, notice emerging threats in time.
  - skill: BARTERING
    attribute: CHA
    description: Haggling over the price when buying or selling.
  - skill: BEAST LORE
    attribute: INT
    description: Identifying an animal or monster, to know its habits, abilities, and weaknesses.
  - skill: BLUFFING
    attribute: CHA
    description: Quickly come up with a convincing lie.
  - skill: BUSHCRAFT
    attribute: INT
    description: Lead the way through the wilderness, make camp, cook food, or stay warm in cold weather.
  - skill: CRAFTING
    attribute: STR
    description: Repair gear and weapon, craft useful item.
  - skill: EVADE
    attribute: AGL
    description: Dodge an attack or flee from combat.
  - skill: HEALING
    attribute: INT
    description: Get fallen companions back on their feet or even save their lives.
  - skill: HUNTING & FISHING
    attribute: AGL
    description: Finding and obtaining food in wilderness.
  - skill: LANGUAGES
    attribute: INT
    description: Understanding foreign or ancient language.
  - skill: MYTHS & LEGENDS
    attribute: INT
    description: Trying to remember stories of old times or distant lands, understand links to the past.
  - skill: PERFORMANCE
    attribute: CHA
    description: Singing a song, reading a poem, making jokes or in some other way try to amuse a crowd.
  - skill: PERSUASION
    attribute: CHA
    description: Charm, threats or sensible reasoning, make another person see things your way.
  - skill: RIDING
    attribute: AGL
    description: Advanced maneuvers while mounted.
  - skill: SEAMANSHIP
    attribute: INT
    description: Steer a vessel over water, navigation.
  - skill: SLEIGHT OF HAND
    attribute: AGL
    description: Steal something unnoticed, pick a lock, or perform any other action that requires fine motor skill.
  - skill: SNEAKING
    attribute: AGL
    description: Sneak past the enemy undetected.
  - skill: SPOT HIDDEN
    attribute: INT
    description: Looking for something hidden, concealed.
  - skill: SWIMMING
    attribute: AGL
    description: Swim in difficult situation.
  - skill: WEAPON SKILLS
    attribute: STR / AGL
    description: Wielding different types of weapons.
  - skill: Axes
    attribute: STR
    description: Axes of all kinds, including when thrown.
  - skill: Bows
    attribute: AGL
    description: All types of bows.
  - skill: Brawling
    attribute: STR
    description: Unarmed combat with fists, feet, teeth or claws.
  - skill: Crossbows
    attribute: AGL
    description: Attack with crossbows of all kinds.
  - skill: Hammers
    attribute: STR
    description: Warhammers and other blunt weapons such as clubs and maces.
  - skill: Knives
    attribute: AGL
    description: Combat with knives and daggers, including when thrown.
  - skill: Slings
    attribute: AGL
    description: Attacking with sling.
  - skill: Spears
    attribute: STR
    description: Combat with spears and tridents, including when thrown, lances.
  - skill: Staves
    attribute: AGL
    description: Fighting with staff.
  - skill: Swords
    attribute: STR
    description: Combat with all types of swords.
- id: healing_and_rest
  title: Healing & Rest
  type: table
  columns:
  - rest_type
  - effect
  rows:
  - rest_type: Round Rest
    effect: Recover D6 WP. Once per shift.
  - rest_type: Stretch Rest
    effect: Heal D6 HP, or 2D6 HP if someone else succeeds with HEALING roll. Recover D6 WP and heal one condition.
  - rest_type: Shift Rest
    effect: Recover all HP and WP, and heal all conditions.
- id: conditions
  title: Conditions
  type: table
  columns:
  - condition
  - attribute
  rows:
  - condition: Exhausted
    attribute: STR
  - condition: Sickly
    attribute: CON
  - condition: Dazed
    attribute: AGL
  - condition: Angry
    attribute: INT
  - condition: Scared
    attribute: WIL
  - condition: Disheartened
    attribute: CHA
  notes:
  - Bane on all rolls against attribute and skill rolls based on that attribute.
- id: fear
  title: Fear
  type: table
  columns:
  - d8
  - effect
  rows:
  - d8: '1'
    effect: Enfeebled. The fear drains your energy and determination. You lose 2D6 WP (to a minimum of zero) and become Disheartened.
  - d8: '2'
    effect: Shaken. You suffer the Scared condition.
  - d8: '3'
    effect: Panting. The intense fear leaves you out of breath and makes you Exhausted.
  - d8: '4'
    effect: Pale. Your face turns white as a sheet. You and all player characters within 10 meters and in sight of you become Scared.
  - d8: '5'
    effect: Scream. You scream in horror, which causes all player characters who hear the sound to immediately suffer a fear attack as well. Each person only ever needs to make one WIL roll to resist the same fear attack.
  - d8: '6'
    effect: Rage. Your fear turns into anger, and you are forced to attack its source on your next turn, in melee combat if possible. You also become Angry.
  - d8: '7'
    effect: Paralyzed. You are petrified with terror and unable to move. You cannot perform any action or movement on your next turn. Make another WIL roll on each subsequent turn (not an action) to break the paralysis.
  - d8: '8'
    effect: Wild Panic. In a fit of utter panic, you flee the scene as fast as you can. On your next turn you must dash away from the source of your fear. Make another WIL roll on each subsequent turn (not an action) to stop running and act normally again.
- id: skill_level_base_chance
  title: Skill Level
  type: table
  columns:
  - attribute_range
  - base_chance
  rows:
  - attribute_range: 1-5
    base_chance: '3'
  - attribute_range: 6-8
    base_chance: '4'
  - attribute_range: 9-12
    base_chance: '5'
  - attribute_range: 13-15
    base_chance: '6'
  - attribute_range: 16-18
    base_chance: '7'
- id: typical_npcs
  title: Typical NPCs
  type: table
  columns:
  - type
  - skills
  - heroic_abilities
  - damage_bonus
  - hp
  - wp
  - gear
  rows:
  - type: Guard
    skills:
    - Awareness 10
    - Swords 12
    heroic_abilities: []
    damage_bonus: STR +D4
    hp: '12'
    wp: '-'
    gear:
    - Broadsword
    - studded leather armor
  - type: Cultist
    skills:
    - Evade 14
    - Knives 14
    heroic_abilities: []
    damage_bonus: AGL +D4
    hp: '12'
    wp: '-'
    gear:
    - Dagger
  - type: Thief
    skills:
    - Evade 12
    - Knives 12
    heroic_abilities: []
    damage_bonus: AGL +D4
    hp: '10'
    wp: '-'
    gear:
    - Knife
  - type: Villager
    skills:
    - Brawling 8
    heroic_abilities: []
    damage_bonus: '-'
    hp: '8'
    wp: '-'
    gear:
    - Wooden club
  - type: Hunter
    skills:
    - Awareness 12
    - Bows 13
    heroic_abilities: []
    damage_bonus: AGL +D4
    hp: '13'
    wp: '-'
    gear:
    - Longbow
    - leather armor
  - type: Bandit
    skills:
    - Bows 12
    - Evade 10
    - Swords 12
    heroic_abilities: []
    damage_bonus: '-'
    hp: '12'
    wp: '-'
    gear:
    - Short sword
    - short bow
  - type: Adventurer
    skills:
    - Awareness 10
    - Swords 12
    heroic_abilities: []
    damage_bonus: STR +D4
    hp: '13'
    wp: '-'
    gear:
    - Broadsword
    - studded leather armor
  - type: Scholar
    skills:
    - Languages 13
    - Myths & Legends 13
    - Staves 8
    heroic_abilities: []
    damage_bonus: '-'
    hp: '7'
    wp: '-'
    gear:
    - A good book
  - type: Bandit Chief (Boss)
    skills:
    - Awareness 12
    - Brawling 15
    - Hammers 15
    heroic_abilities:
    - Berserker
    - Robust x 6
    - Veteran
    damage_bonus: STR +D6
    hp: '30'
    wp: '16'
    gear:
    - Heavy warhammer
    - chainmail
    - open helmet
  - type: Knight Champion (Boss)
    skills:
    - Brawling 14
    - Swords 16
    heroic_abilities:
    - Defensive
    - Double Slash
    - Focused x 6
    - Robust x 6
    damage_bonus: STR +D6
    hp: '28'
    wp: '26'
    gear:
    - Longsword
    - large shield
    - plate armor
    - great helm
    - combat-trained horse
  - type: Archmage (Boss)
    skills:
    - Magic School 15
    - Staves 13
    heroic_abilities:
    - Focused x 6
    - Master Spellcaster
    - Robust x 4
    damage_bonus: '-'
    hp: '22'
    wp: '30'
    gear:
    - Staff
    - grimoire
- id: common_animals
  title: Common Animals
  type: table
  columns:
  - animal
  - movement
  - hp
  - attack
  - skills
  rows:
  - animal: Cat
    movement: '12'
    hp: '4'
    attack: Bite (skill level 8, damage D3)
    skills:
    - Awareness 12
    - Evade 14
    - Sneaking 16
  - animal: Dog
    movement: '14'
    hp: '8'
    attack: Bite (skill level 12, damage D8)
    skills:
    - Awareness 14
    - Evade 10
    - Sneaking 12
  - animal: Goat
    movement: '10'
    hp: '6'
    attack: Horns (skill level 10, damage D6)
    skills:
    - Awareness 10
    - Evade 12
  - animal: Donkey
    movement: '14'
    hp: '12'
    attack: Kick (skill level 10, damage D10)
    skills:
    - Awareness 10
    - Evade 6
  - animal: Horse
    movement: '20'
    hp: '16'
    attack: Kick (skill level 10, damage 2D4)
    skills:
    - Awareness 12
    - Evade 8
  - animal: Wild Boar
    movement: '12'
    hp: '14'
    attack: Tusks (skill level 12, damage 2D6)
    skills:
    - Awareness 10
    - Evade 8
  - animal: Deer
    movement: '18'
    hp: '12'
    attack: Horns (skill level 10, damage D8)
    skills:
    - Awareness 12
    - Evade 12
  - animal: Moose
    movement: '16'
    hp: '18'
    attack: Horns (skill level 10, damage 2D6)
    skills:
    - Awareness 10
    - Evade 8
  - animal: Fox
    movement: '10'
    hp: '6'
    attack: Bite (skill level 12, damage D6)
    skills:
    - Awareness 12
    - Evade 10
    - Sneaking 14
  - animal: Wolf
    movement: '16'
    hp: '10'
    attack: Bite (skill level 14, damage 2D6)
    skills:
    - Awareness 14
    - Evade 12
    - Sneaking 14
  - animal: Bear
    movement: '12'
    hp: '20'
    attack: Bite (skill level 12, damage 2D8)
    skills:
    - Awareness 10
    - Evade 8
- id: npc_attribute_guidelines
  title: Attributes for NPCs
  type: rules_text
  paragraphs:
  - 'In adventures for Dragonbane, attribute scores for NPCs are not listed as they are very rarely used. If you at some point would need to roll against an exact attribute score for NPC, use the guidelines below:'
  - 'STR & AGL: Use the damage bonus. At +D6, roll against an attribute score of 17. At +D4, roll against 14. At no bonus, roll against 10.'
  - 'CON: Roll against maximum HP, reduced by 2 for each level of the Robust heroic ability.'
  - 'WIL: Roll against maximum WP if this is listed, reduced by 2 for each level of the Focused heroic ability. If WP is not listed, roll against 10.'
  - 'INT & CHA: Roll against 10.'
- id: creating_npcs
  title: Creating NPCs
  type: table
  columns:
  - d20
  - attitude_d4
  - kin_d6
  - motivation_d8
  - profession_d10
  - trait_d12
  - name_d20_choose_one
  rows:
  - d20: '1'
    attitude_d4: Hostile
    kin_d6: Human
    motivation_d8: Sweet, glittering gold
    profession_d10: Bard
    trait_d12: Talks too much
    name_d20_choose_one:
    - Agnar
    - Jorid
    - Dereios
  - d20: '2'
    attitude_d4: Evasive
    kin_d6: Dwarf
    motivation_d8: Knowledge of the world
    profession_d10: Artisan
    trait_d12: Strange clothes
    name_d20_choose_one:
    - Ragnfast
    - Ask
    - Euanthe
  - d20: '3'
    attitude_d4: Indifferent
    kin_d6: Elf
    motivation_d8: Deep and eternal love
    profession_d10: Hunter
    trait_d12: Wild-eyed
    name_d20_choose_one:
    - Arnulf
    - Tyra
    - Xanthos
  - d20: '4'
    attitude_d4: Friendly
    kin_d6: Halfling
    motivation_d8: A lifelong oath
    profession_d10: Fighter
    trait_d12: Smells bad
    name_d20_choose_one:
    - Atle
    - Liv
    - Athalia
  - d20: '5'
    attitude_d4: '-'
    kin_d6: Wolfkin
    motivation_d8: An injustice that demands retribution
    profession_d10: Scholar
    trait_d12: Joker
    name_d20_choose_one:
    - Guthorm
    - Embla
    - Kleitos
  - d20: '6'
    attitude_d4: '-'
    kin_d6: Mallard
    motivation_d8: A life of joy and song
    profession_d10: Mage
    trait_d12: Cultist
    name_d20_choose_one:
    - Botvid
    - Ragna
    - Astara
  - d20: '7'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: Blood ties that can never be severed
    profession_d10: Merchant
    trait_d12: A bit childish
    name_d20_choose_one:
    - Kale
    - Turid
    - Priamus
  - d20: '8'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: Escaping the dark past
    profession_d10: Knight
    trait_d12: Quiet and difficult
    name_d20_choose_one:
    - Egil
    - Jorunn
    - Galyna
  - d20: '9'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: Mariner
    trait_d12: Demon worshiper
    name_d20_choose_one:
    - Ingemund
    - Borghild
    - Taras
  - d20: '10'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: Thief
    trait_d12: Obstinate
    name_d20_choose_one:
    - Gudmund
    - Gylla
    - Zenais
  - d20: '11'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: Very touchy
    name_d20_choose_one:
    - Grim
    - Tora
    - Hesiod
  - d20: '12'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: Highly romantic
    name_d20_choose_one:
    - Brand
    - Edda
    - Liene
  - d20: '13'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Folkvid
    - Sigrun
    - Eupraxia
  - d20: '14'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Germund
    - Dagrun
    - Tyrus
  - d20: '15'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Algot
    - Bolla
    - Lysandra
  - d20: '16'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Tolir
    - Yrsa
    - Kallias
  - d20: '17'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Hjorvald
    - Estrid
    - Isidora
  - d20: '18'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Ambjorn
    - Signe
    - Athos
  - d20: '19'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Grunn
    - Tilde
    - Larysa
  - d20: '20'
    attitude_d4: '-'
    kin_d6: '-'
    motivation_d8: '-'
    profession_d10: '-'
    trait_d12: '-'
    name_d20_choose_one:
    - Olgrid
    - Idun
    - Nikias
- id: mishaps
  title: Mishaps
  type: table
  columns:
  - d12
  - mishap
  rows:
  - d12: '1'
    mishap: Fog. The player characters are caught unawares by thick fog. The distance covered this shift is reduced by half.
  - d12: '2'
    mishap: Blocking Terrain. The way ahead is blocked by rocks, fallen trees, thick shrubs, or flooding. Each player character must make an ACROBATICS roll to keep moving forward. Anyone who succeeds can help the others. A player character who fails makes no progress this shift.
  - d12: '3'
    mishap: Torn Clothes. The pathfinder leads the group into a thorny thicket, rocky ravine, or swampy marsh. The clothes of a random player character are damaged and now counts as rags.
  - d12: '4'
    mishap: Lost. The player characters realize that they are walking in circles and do not make any progress on the map this shift. The pathfinder must also make a BUSHCRAFT roll to find the right way again. Others cannot help.
  - d12: '5'
    mishap: Dropped Item. A random player character drops or breaks an item of your choice.
  - d12: '6'
    mishap: Mosquito Swarm. A large swarm of mosquitoes or gnats attack the group, driving everyone crazy with their biting and buzzing. All player characters without a cloak become Angry.
  - d12: '7'
    mishap: Sprained Ankle. A random player character falls or missteps and suffer D6 damage. Armor has no effect but boots reduce the damage by two.
  - d12: '8'
    mishap: Downpour. A massive rainfall or blizzard (depending on the season) catches the group unawares. All player characters without cloak must roll to withstand the cold (page 54). They must also seek shelter until the storm passes and cannot make any progress on the map this shift.
  - d12: '9'
    mishap: Wasps. The pathfinder steps right into a nest of wasps. A swarm of angry wasps attack the entire group. All player characters must make an EVADE roll, and those who fail suffer D6 damage and a condition of their choice.
  - d12: '10'
    mishap: Landslide. The player characters are walking in rough terrain when the ground suddenly gives away under their feet. Everyone must make an EVADE roll. Anyone who fails suffer D10 damage.
  - d12: '11'
    mishap: Savage Animal. A wolf, bear, or other savage animal feels threatened and attacks the adventurers. Choose an animal from the table (page 99).
  - d12: '12'
    mishap: Quicksand. The ground collapses! Each player character must make a BUSHCRAFT roll. Anyone who fails suffers a condition and must roll again. A character who already has a condition and fails the roll is swallowed by the quicksand and disappears for good. Whoever is free can help those who are stuck.
```
