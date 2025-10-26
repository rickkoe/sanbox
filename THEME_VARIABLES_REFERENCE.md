# Theme Variables Quick Reference

**Complete list of all CSS variables available in the theme system**

Location: `/frontend/src/styles/themes.css`

---

## Base Variables (Shared Across All Themes)

### Transitions & Animations
```css
--transition-speed: 0.2s
--transition-timing: cubic-bezier(0.4, 0, 0.2, 1)
```

### Border Radius
```css
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px
```

### Shadows
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15)
```

### Spacing Scale
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
--space-6: 32px
```

### Typography
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif
--font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace

--font-size-xs: 12px
--font-size-sm: 13px
--font-size-md: 14px
--font-size-lg: 16px
--font-size-xl: 20px
--font-size-2xl: 24px

--line-height-tight: 1.25
--line-height-normal: 1.5
--line-height-relaxed: 1.75
```

---

## Theme-Specific Variables

### Core Color Palette (Foundation)

These are the base colors that other variables reference.

#### Canvas (Backgrounds)
```css
--color-canvas-default      /* Main background surface */
--color-canvas-subtle       /* Secondary background surface */
--color-canvas-inset        /* Inset/recessed areas */
--color-canvas-overlay      /* Overlay/modal backgrounds */
```

#### Borders
```css
--color-border-default      /* Standard borders */
--color-border-muted        /* Subtle borders */
--color-border-subtle       /* Very subtle borders */
```

#### Foreground/Text
```css
--color-fg-default          /* Primary text color */
--color-fg-muted            /* Secondary text color */
--color-fg-subtle           /* Tertiary/muted text */
--color-fg-onEmphasis       /* Text on colored backgrounds */
```

#### Accent Colors
```css
--color-accent-fg           /* Accent text/icon color */
--color-accent-emphasis     /* Accent background color */
--color-accent-muted        /* Muted accent (with transparency) */
--color-accent-subtle       /* Very subtle accent background */
```

#### Status Colors (Success, Danger, Attention, Info)

**Success:**
```css
--color-success-fg          /* Success text color */
--color-success-emphasis    /* Success background/button */
--color-success-muted       /* Muted success (with transparency) */
--color-success-subtle      /* Subtle success background */
```

**Danger:**
```css
--color-danger-fg           /* Error text color */
--color-danger-emphasis     /* Error background/button */
--color-danger-muted        /* Muted error (with transparency) */
--color-danger-subtle       /* Subtle error background */
```

**Attention/Warning:**
```css
--color-attention-fg        /* Warning text color */
--color-attention-emphasis  /* Warning background/button */
--color-attention-muted     /* Muted warning (with transparency) */
--color-attention-subtle    /* Subtle warning background */
```

**Info:**
```css
--color-info-fg             /* Info text color */
--color-info-emphasis       /* Info background/button */
--color-info-muted          /* Muted info (with transparency) */
--color-info-subtle         /* Subtle info background */
```

---

### Semantic Component Variables

These reference the core palette and are used directly in components.

#### General Backgrounds
```css
--primary-bg                /* Main background */
--secondary-bg              /* Secondary surfaces */
--accent-bg                 /* Accent surfaces */
--content-bg                /* Content area background */
```

#### General Text
```css
--primary-text              /* Main text */
--secondary-text            /* Less emphasized text */
--muted-text                /* Subtle/disabled text */
--link-text                 /* Link color */
--link-hover                /* Link hover color */
```

#### Buttons (Default)
```css
--button-bg                 /* Button background */
--button-text               /* Button text */
--button-border             /* Button border */
--button-hover-bg           /* Button hover background */
--button-hover-border       /* Button hover border */
--button-active-bg          /* Button active/pressed */
--button-shadow             /* Button shadow */
```

#### Buttons (Primary)
```css
--button-primary-bg         /* Primary button background */
--button-primary-text       /* Primary button text */
--button-primary-hover      /* Primary button hover */
--button-primary-border     /* Primary button border */
--button-primary-shadow     /* Primary button shadow */
```

#### Form Controls
```css
--form-input-bg             /* Input background */
--form-input-border         /* Input border */
--form-input-text           /* Input text color */
--form-input-placeholder    /* Placeholder text */
--form-input-focus-border   /* Input focus border */
--form-input-focus-shadow   /* Input focus shadow/glow */
--form-input-disabled-bg    /* Disabled input background */
--form-input-disabled-text  /* Disabled input text */
```

---

### Component-Specific Variables

#### Navbar
```css
--navbar-bg                 /* Navbar background */
--navbar-text               /* Navbar text color */
--navbar-text-hover         /* Navbar text hover */
--navbar-border             /* Navbar border */
--navbar-shadow             /* Navbar shadow */
--navbar-button-bg          /* Navbar button background */
--navbar-button-hover       /* Navbar button hover */
--navbar-brand-color        /* Logo/brand text color */
--navbar-search-bg          /* Search input background */
--navbar-search-border      /* Search input border */
--navbar-search-focus       /* Search input focus state */
```

#### Sidebar
```css
--sidebar-bg                /* Sidebar background */
--sidebar-text              /* Sidebar text */
--sidebar-text-hover        /* Sidebar text hover */
--sidebar-border            /* Sidebar border */
--sidebar-shadow            /* Sidebar shadow */
--sidebar-button-bg         /* Sidebar button background */
--sidebar-button-hover      /* Sidebar button hover */
--sidebar-header-color      /* Sidebar section header */
--sidebar-active-bg         /* Active item background */
--sidebar-active-border     /* Active item border/indicator */
--sidebar-active-text       /* Active item text */
--sidebar-icon-color        /* Icon color */
--sidebar-icon-active       /* Active icon color */
```

#### Breadcrumbs
```css
--breadcrumb-bg             /* Breadcrumb background */
--breadcrumb-border         /* Breadcrumb border */
--breadcrumb-text           /* Breadcrumb text */
--breadcrumb-link           /* Breadcrumb link */
--breadcrumb-link-hover     /* Breadcrumb link hover */
--breadcrumb-separator      /* Separator color (/) */
```

#### Tables
```css
--table-bg                  /* Table background */
--table-header-bg           /* Table header background */
--table-header-text         /* Table header text */
--table-border              /* Table border */
--table-border-subtle       /* Subtle table border */
--table-row-hover           /* Row hover background */
--table-row-selected        /* Selected row background */
--table-row-selected-border /* Selected row border */
--table-cell-text           /* Cell text */
--table-cell-muted          /* Muted cell text */
```

#### Table Toolbar
```css
--table-toolbar-bg          /* Toolbar background */
--table-toolbar-border      /* Toolbar border */
--table-toolbar-text        /* Toolbar text */
```

#### Table Pagination
```css
--table-pagination-bg       /* Pagination background */
--table-pagination-border   /* Pagination border */
--table-pagination-text     /* Pagination text */
--table-pagination-button-bg    /* Page button background */
--table-pagination-button-hover /* Page button hover */
--table-pagination-button-active /* Active page background */
--table-pagination-button-border /* Page button border */
```

#### Code Blocks
```css
--code-bg                   /* Code block background */
--code-text                 /* Code text color */
--code-border               /* Code block border */
```

#### Alerts
```css
--alert-info-bg             /* Info alert background */
--alert-info-text           /* Info alert text */
--alert-info-border         /* Info alert border */

--alert-success-bg          /* Success alert background */
--alert-success-text        /* Success alert text */
--alert-success-border      /* Success alert border */

--alert-warning-bg          /* Warning alert background */
--alert-warning-text        /* Warning alert text */
--alert-warning-border      /* Warning alert border */

--alert-danger-bg           /* Danger alert background */
--alert-danger-text         /* Danger alert text */
--alert-danger-border       /* Danger alert border */
```

#### Cards
```css
--card-bg                   /* Card background */
--card-border               /* Card border */
--card-shadow               /* Card shadow */
--card-hover-shadow         /* Card hover shadow */
```

#### Modals
```css
--modal-bg                  /* Modal background */
--modal-backdrop            /* Modal backdrop/overlay */
--modal-border              /* Modal border */
--modal-shadow              /* Modal shadow */
```

#### Tooltips
```css
--tooltip-bg                /* Tooltip background */
--tooltip-text              /* Tooltip text */
--tooltip-shadow            /* Tooltip shadow */
```

#### Badges
```css
--badge-bg                  /* Badge background */
--badge-text                /* Badge text */
--badge-border              /* Badge border */
```

#### Scrollbar
```css
--scrollbar-track           /* Scrollbar track background */
--scrollbar-thumb           /* Scrollbar thumb */
--scrollbar-thumb-hover     /* Scrollbar thumb hover */
```

---

## Usage Examples

### Example 1: Styling a Card Component

```css
.my-card {
  /* Background & Border */
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);

  /* Spacing */
  padding: var(--space-4);
  margin-bottom: var(--space-3);

  /* Shadow & Transition */
  box-shadow: var(--card-shadow);
  transition: box-shadow var(--transition-speed) var(--transition-timing);
}

.my-card:hover {
  box-shadow: var(--card-hover-shadow);
}

.my-card-title {
  color: var(--primary-text);
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}

.my-card-description {
  color: var(--secondary-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}
```

### Example 2: Styling a Button

```css
.my-button {
  /* Colors */
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: 1px solid var(--button-primary-border);

  /* Spacing & Shape */
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);

  /* Typography */
  font-size: var(--font-size-sm);
  font-weight: 500;

  /* Effects */
  box-shadow: var(--button-primary-shadow);
  transition: all var(--transition-speed) var(--transition-timing);
  cursor: pointer;
}

.my-button:hover {
  background: var(--button-primary-hover);
}

.my-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Example 3: Styling an Alert

```css
.my-alert {
  /* Use appropriate alert variables based on type */
  background: var(--alert-info-bg);
  color: var(--alert-info-text);
  border: 1px solid var(--alert-info-border);

  /* Shape & Spacing */
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);

  /* Typography */
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.my-alert.success {
  background: var(--alert-success-bg);
  color: var(--alert-success-text);
  border-color: var(--alert-success-border);
}

.my-alert.warning {
  background: var(--alert-warning-bg);
  color: var(--alert-warning-text);
  border-color: var(--alert-warning-border);
}

.my-alert.danger {
  background: var(--alert-danger-bg);
  color: var(--alert-danger-text);
  border-color: var(--alert-danger-border);
}
```

### Example 4: Styling a Form

```css
.my-form-group {
  margin-bottom: var(--space-4);
}

.my-label {
  display: block;
  color: var(--primary-text);
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: var(--space-2);
}

.my-input {
  width: 100%;
  background: var(--form-input-bg);
  color: var(--form-input-text);
  border: 1px solid var(--form-input-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-family: var(--font-sans);
  transition: all var(--transition-speed) var(--transition-timing);
}

.my-input::placeholder {
  color: var(--form-input-placeholder);
}

.my-input:focus {
  outline: none;
  border-color: var(--form-input-focus-border);
  box-shadow: var(--form-input-focus-shadow);
}

.my-input:disabled {
  background: var(--form-input-disabled-bg);
  color: var(--form-input-disabled-text);
  cursor: not-allowed;
}
```

---

## Color Values by Theme

### Light Theme
- **Backgrounds**: #ffffff, #f6f8fa
- **Text**: #24292f (dark)
- **Borders**: #d0d7de (gray)
- **Accent**: #0969da (blue)
- **Navbar**: #24292f (dark navbar)

### Dark Theme
- **Backgrounds**: #0d1117, #161b22
- **Text**: #e6edf3 (light)
- **Borders**: #30363d (dark gray)
- **Accent**: #58a6ff (bright blue)
- **Navbar**: #161b22

### Dark+ Theme
- **Backgrounds**: #000000, #0d1117 (pure black)
- **Text**: #f0f6fc (very light)
- **Borders**: #30363d (dark gray)
- **Accent**: #79c0ff (very bright blue)
- **Navbar**: #000000 (pure black)

---

## Tips

1. **Always use variables, never hardcode colors**
   - ✅ `color: var(--primary-text);`
   - ❌ `color: #24292f;`

2. **Use semantic variables over core palette when available**
   - ✅ `background: var(--primary-bg);`
   - ⚠️ `background: var(--color-canvas-default);` (works but less semantic)

3. **Compose variables when creating new ones**
   - ✅ `--my-bg: var(--secondary-bg);`
   - ✅ `--my-border: var(--color-border-default);`

4. **Use spacing variables for consistency**
   - ✅ `padding: var(--space-4);`
   - ❌ `padding: 16px;`

5. **Use typography variables**
   - ✅ `font-size: var(--font-size-sm);`
   - ❌ `font-size: 13px;`

6. **Test in all themes**
   - Navigate to `/theme-demo`
   - Switch between themes
   - Verify visual appearance

---

## Quick Search

**To find a specific variable:**
1. Open `/frontend/src/styles/themes.css`
2. Use Cmd+F (Mac) or Ctrl+F (Windows)
3. Search for the property (e.g., "button", "navbar", "alert")

**To see all variables in action:**
- Navigate to `http://localhost:3000/theme-demo`
- View source of sample components in `/frontend/src/components/theme-demo/`

---

**Last Updated:** 2025-01-25
**Total Variables:** 100+ (per theme)
**Themes:** 3 (Light, Dark, Dark+)
