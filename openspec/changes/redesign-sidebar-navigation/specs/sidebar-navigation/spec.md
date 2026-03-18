## ADDED Requirements

### Requirement: Sidebar Color-Coded Navigation Groups
The sidebar navigation SHALL assign each top-level group a distinct theme color (Blue, Purple, Emerald, Amber, Indigo) that visually differentiates the five business modules.

#### Scenario: Group visual identity
- **WHEN** the sidebar renders its five navigation groups
- **THEN** each group header and its child items SHALL use a consistent theme color for decorative elements (indicator dots, active bars, hover accents)

#### Scenario: Dark mode adaptation
- **WHEN** the system switches between Light and Dark theme
- **THEN** all navigation color accents SHALL automatically adapt to the corresponding dark-mode palette values

### Requirement: Active State Indicator
The currently active navigation item SHALL display a prominent visual indicator consisting of a left-side gradient color bar, a subtle background gradient, and theme-colored icon.

#### Scenario: Active menu item display
- **WHEN** a user navigates to a page corresponding to a sidebar menu item
- **THEN** that item SHALL show a 3px left-side gradient bar in the group's theme color
- **AND** the item background SHALL show a subtle left-to-right gradient using the theme color at low opacity
- **AND** the item icon SHALL display in the group's theme color

#### Scenario: Active sub-item in collapsed group
- **WHEN** a user navigates to a page under a collapsed group
- **THEN** the parent group header SHALL visually indicate it contains the active item (via theme color text)

### Requirement: Hover Interaction Feedback
Navigation items SHALL provide smooth visual feedback on hover.

#### Scenario: Hover effect
- **WHEN** a user hovers over a non-active menu item
- **THEN** the item SHALL show a subtle background transition to the group's theme color at low opacity
- **AND** the icon SHALL transition to the group's theme color
- **AND** the transition SHALL complete within 150ms using ease-out timing

### Requirement: Group Header Visual Design
Each collapsible group header SHALL display a decorative indicator dot in the group's theme gradient and a fading gradient line extending from the label.

#### Scenario: Group header rendering
- **WHEN** a navigation group header renders
- **THEN** it SHALL show a small (6px) gradient-filled circle in the group's theme color before the label
- **AND** a gradient line extending from after the label text, fading from theme color to transparent

### Requirement: Brand Header Enhancement
The sidebar header SHALL present a polished brand identity with animated logo glow, gradient brand text, and a decorative separator line.

#### Scenario: Brand header display
- **WHEN** the sidebar header renders
- **THEN** the logo icon SHALL display a subtle pulsing glow animation
- **AND** the brand name "Vibe" portion SHALL use a gradient color treatment
- **AND** a gradient separator line SHALL appear below the header area

### Requirement: Enhanced Sub-menu Connection Line
Sub-menu items SHALL use a gradient-styled connection line instead of a plain border.

#### Scenario: Sub-menu visual connection
- **WHEN** a collapsible group is expanded showing sub-items
- **THEN** the left connection line SHALL render as a gradient (theme color to transparent) instead of a solid border

### Requirement: Inter-Group Gradient Separators
Visual separators between navigation groups SHALL use subtle gradient lines instead of plain borders.

#### Scenario: Group separator display
- **WHEN** multiple navigation groups render in the sidebar
- **THEN** a subtle gradient separator line SHALL appear between groups, using a transparent-to-theme-color-to-transparent pattern
