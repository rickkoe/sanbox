# Sanbox Theme System Documentation

**Version:** 2.0
**Date:** 2025-01-25
**Author:** Theme System Implementation
**Purpose:** Complete guide for maintaining, extending, and rolling out the centralized theme system

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Implementation Details](#implementation-details)
4. [How to Update Themes](#how-to-update-themes)
5. [Adding New Components to Theme System](#adding-new-components-to-theme-system)
6. [Finding and Fixing Non-Themed Components](#finding-and-fixing-non-themed-components)
7. [Rolling Out Theme Changes](#rolling-out-theme-changes)
8. [Best Practices](#best-practices)
9. [⚠️ CRITICAL: Bootstrap Background Override Pattern](#️-critical-bootstrap-background-override-pattern) ⭐ **READ THIS FIRST FOR NEW PAGES**
10. [Troubleshooting](#troubleshooting)

---

## System Overview

### What This Is

A **centralized CSS variable-based theme system** that allows the entire application to switch between multiple visual themes (Light, Dark, Dark+) by changing a single CSS class on the root element. All colors, shadows, borders, and visual properties are controlled through CSS custom properties (variables) defined in one central file.

### Key Benefits

- **Single Source of Truth**: All theme colors in `/frontend/src/styles/themes.css`
- **Instant Theme Switching**: Change one CSS class, entire app updates
- **Easy Maintenance**: Update one variable, change propagates everywhere
- **Consistent Design**: All components use the same color palette
- **Future-Proof**: Easy to add new themes without touching component code

### Current Themes

1. **Light** (`.theme-light`) - Clean, professional light theme with dark navbar
2. **Dark** (`.theme-dark`) - Balanced dark theme (#0d1117 backgrounds)
3. **Dark+** (`.theme-dark-plus`) - High contrast dark (#000000 backgrounds)

---

## Architecture

### File Structure

```
frontend/src/
├── styles/
│   ├── themes.css                 # ⭐ CENTRAL THEME FILE - All theme variables
│   ├── theme-demo.css             # Theme demo page styling
│   ├── navbar.css                 # Navbar component styles (uses theme vars)
│   ├── sidebar.css                # Sidebar component styles (uses theme vars)
│   ├── breadcrumbs.css            # Breadcrumbs component styles (uses theme vars)
│   ├── generictable.css           # Table component styles (uses theme vars)
│   └── pages.css                  # Page-specific styles (uses theme vars)
├── context/
│   └── ThemeContext.js            # React context for theme state management
├── components/
│   ├── navigation/
│   │   ├── ThemeDropdown.js       # Theme selector dropdown in navbar
│   │   ├── ThemeDropdown.css      # Theme dropdown styles
│   │   └── ThemeToggle.js         # Alternative theme toggle component
│   └── theme-demo/                # Theme demo components (sandbox)
│       ├── SampleNavbar.jsx       # Demo navbar
│       ├── SampleSidebar.jsx      # Demo sidebar
│       ├── SampleTable.jsx        # Demo table
│       └── SamplePage.jsx         # Demo page with all UI elements
└── pages/
    └── ThemeDemo.js               # Theme demo page (/theme-demo route)
```

### How It Works

1. **ThemeContext** (`context/ThemeContext.js`) manages theme state in React
2. **Theme class applied** to root element: `<div className="app-layout theme-${theme}">`
3. **CSS cascade activates** the correct theme variables based on class
4. **All components** use CSS variables that automatically resolve to current theme
5. **Theme persists** in localStorage across sessions and tabs

---

## Implementation Details

### 1. Theme Context (State Management)

**File:** `/frontend/src/context/ThemeContext.js`

```javascript
// Provides theme state and update function to entire app
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    // Supports: 'light', 'dark', 'dark-plus'
    if (savedTheme === 'dark-plus') return 'dark-plus';
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  const updateTheme = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('dashboard-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Usage in any component:
import { useTheme } from '../context/ThemeContext';
const { theme, updateTheme } = useTheme();
```

### 2. Theme CSS Structure

**File:** `/frontend/src/styles/themes.css` (724 lines)

#### Structure:

```css
/* ========== BASE VARIABLES (ALL THEMES) ========== */
:root {
  /* Shared across all themes: transitions, spacing, typography, shadows */
  --transition-speed: 0.2s;
  --radius-md: 6px;
  --space-4: 16px;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  /* etc. */
}

/* ========== LIGHT THEME ========== */
.theme-light {
  /* Core Palette (GitHub Light inspired) */
  --color-canvas-default: #ffffff;
  --color-border-default: #d0d7de;
  --color-fg-default: #24292f;
  --color-accent-fg: #0969da;

  /* Component-Specific Variables */
  --primary-bg: var(--color-canvas-default);
  --button-bg: #f6f8fa;
  --navbar-bg: #24292f;
  --table-bg: var(--color-canvas-default);
  /* ...100+ variables */
}

/* ========== DARK THEME ========== */
.theme-dark {
  /* Core Palette (GitHub Dark inspired) */
  --color-canvas-default: #0d1117;
  --color-border-default: #30363d;
  --color-fg-default: #e6edf3;
  --color-accent-fg: #58a6ff;

  /* Component-Specific Variables */
  --primary-bg: var(--color-canvas-default);
  --button-bg: #21262d;
  --navbar-bg: #161b22;
  /* ...100+ variables */
}

/* ========== DARK PLUS THEME ========== */
.theme-dark-plus {
  /* High contrast dark theme (VSCode Dark+) */
  --color-canvas-default: #000000;
  --color-fg-default: #f0f6fc;
  /* etc. */
}
```

#### Variable Categories:

**Core Color Palette** (base colors used to build others):
- `--color-canvas-*` - Background surfaces
- `--color-border-*` - Border colors
- `--color-fg-*` - Foreground/text colors
- `--color-accent-*` - Primary accent colors
- `--color-success-*`, `--color-danger-*`, `--color-attention-*`, `--color-info-*` - Status colors

**Component Variables** (reference core palette):
- `--primary-bg`, `--secondary-bg`, `--content-bg`
- `--primary-text`, `--secondary-text`, `--muted-text`
- `--button-*` - Button styles
- `--form-input-*` - Form control styles
- `--navbar-*` - Navbar-specific colors
- `--sidebar-*` - Sidebar-specific colors
- `--table-*` - Table-specific colors
- `--card-*`, `--modal-*`, `--alert-*`, `--badge-*` - Other components

### 3. How Components Use Themes

**Component CSS files should ONLY use CSS variables, never hardcoded colors.**

#### ✅ CORRECT - Using CSS Variables:

```css
/* navbar.css */
.navbar {
  background: var(--navbar-bg);
  color: var(--navbar-text);
  border-bottom: 1px solid var(--navbar-border);
}

.navbar-link:hover {
  color: var(--navbar-text-hover);
  background: var(--navbar-button-hover);
}
```

#### ❌ WRONG - Hardcoded Colors:

```css
/* DON'T DO THIS */
.navbar {
  background: #24292f;  /* ❌ Hardcoded */
  color: #ffffff;        /* ❌ Hardcoded */
}
```

### 4. Root Element Theme Class Application

**File:** `/frontend/src/App.js` (line ~185)

```jsx
function ThemedAppLayout({ breadcrumbMap, setBreadcrumbMap, ... }) {
  const { theme } = useTheme();

  return (
    <div className={`app-layout theme-${theme}`}>
      <Navbar />
      <Sidebar />
      <main className="main-content">
        {/* Content */}
      </main>
    </div>
  );
}
```

This applies `.theme-light`, `.theme-dark`, or `.theme-dark-plus` to the root, which activates the correct CSS variable set.

---

## How to Update Themes

### Scenario 1: Changing a Color Across All Instances

**Goal:** Change the primary accent color in the Dark theme from blue (#58a6ff) to purple.

**Steps:**

1. Open `/frontend/src/styles/themes.css`
2. Find the `.theme-dark` section (line ~258)
3. Update the accent color variables:

```css
.theme-dark {
  /* Change these lines: */
  --color-accent-fg: #a78bfa;           /* Changed from #58a6ff */
  --color-accent-emphasis: #8b5cf6;     /* Changed from #1f6feb */
  --color-accent-muted: rgba(139, 92, 246, 0.4);
  --color-accent-subtle: rgba(139, 92, 246, 0.15);
}
```

4. Save the file
5. **All components using accent colors update instantly**: buttons, links, active states, focus borders, badges, etc.

### Scenario 2: Adjusting Component-Specific Colors

**Goal:** Make the Dark theme sidebar slightly lighter.

**Steps:**

1. Open `/frontend/src/styles/themes.css`
2. Find `.theme-dark` section
3. Find the sidebar variables:

```css
.theme-dark {
  /* ... */

  /* Sidebar - update these */
  --sidebar-bg: var(--color-canvas-default);  /* was #0d1117 */
  --sidebar-bg: #161b22;  /* Make it lighter - use subtle variant */
}
```

4. Save - sidebar background updates everywhere

### Scenario 3: Creating a New Theme Variable

**Goal:** Add a new `--header-gradient` variable for page headers.

**Steps:**

1. Open `/frontend/src/styles/themes.css`
2. Add the variable to **EACH theme**:

```css
.theme-light {
  /* ...existing variables... */

  /* Add new variable */
  --header-gradient: linear-gradient(135deg, #f8fafc 0%, #e8eef5 100%);
}

.theme-dark {
  /* ...existing variables... */

  /* Add new variable */
  --header-gradient: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
}

.theme-dark-plus {
  /* ...existing variables... */

  /* Add new variable */
  --header-gradient: linear-gradient(135deg, #000000 0%, #0d1117 100%);
}
```

3. Use in component CSS:

```css
.page-header {
  background: var(--header-gradient);
}
```

---

## Adding New Components to Theme System

### Process for New Components

When creating a new component that needs styling:

#### Step 1: Design with Variables in Mind

**Before writing CSS, ask:**
- What backgrounds does this component need? → Use `--primary-bg`, `--secondary-bg`, `--card-bg`
- What text colors? → Use `--primary-text`, `--secondary-text`, `--muted-text`
- What borders? → Use `--color-border-default`, `--color-border-muted`
- Interactive states? → Use `--button-*` or similar
- Status indicators? → Use `--color-success-*`, `--color-danger-*`, etc.

#### Step 2: Check if Variables Exist

**Look in `/frontend/src/styles/themes.css`:**
- Do variables exist for what you need?
- If yes, use them
- If no, create them (add to ALL themes)

#### Step 3: Write Component CSS

**Example - New Modal Component:**

```css
/* components/Modal.css */
.modal-overlay {
  background: var(--modal-backdrop);
  /* Uses existing variable */
}

.modal-container {
  background: var(--modal-bg);
  border: 1px solid var(--modal-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--modal-shadow);
  color: var(--primary-text);
}

.modal-header {
  border-bottom: 1px solid var(--color-border-default);
  padding: var(--space-4);
}

.modal-title {
  color: var(--primary-text);
  font-size: var(--font-size-lg);
}

.modal-close-button {
  background: var(--button-bg);
  color: var(--button-text);
  border: 1px solid var(--button-border);
}

.modal-close-button:hover {
  background: var(--button-hover-bg);
}
```

**Key Points:**
- ✅ All colors from CSS variables
- ✅ All spacing from CSS variables (`--space-*`)
- ✅ All border radius from CSS variables (`--radius-*`)
- ✅ All shadows from CSS variables (`--shadow-*`)
- ❌ No hardcoded values

#### Step 4: Test in Theme Demo

**Add to `/frontend/src/components/theme-demo/SamplePage.jsx`:**

```jsx
// Add a modal example to SamplePage
<section className="sample-section">
  <h2 className="sample-section-title">Modal Example</h2>
  <button onClick={() => setModalOpen(true)}>Open Modal</button>

  {modalOpen && (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3 className="modal-title">Modal Title</h3>
          <button className="modal-close-button">×</button>
        </div>
        <div className="modal-body">
          <p>Modal content goes here.</p>
        </div>
      </div>
    </div>
  )}
</section>
```

#### Step 5: Test All Themes

1. Navigate to `/theme-demo`
2. Switch between Light, Dark, Dark+
3. Verify the component looks good in all themes
4. Adjust variables in `themes.css` if needed

---

## Finding and Fixing Non-Themed Components

### The Problem

Old components may have hardcoded colors that don't respect the theme system.

### Finding Non-Themed Components

#### Method 1: Visual Inspection

1. Navigate to `/theme-demo`
2. Switch between themes
3. Look for elements that **don't change** when they should
4. Note the component/page

#### Method 2: Search for Hardcoded Colors

**Search the codebase for hardcoded color values:**

```bash
# In terminal from /frontend/src directory:

# Find hex colors (e.g., #ffffff, #000)
grep -r "#[0-9a-fA-F]\{3,6\}" --include="*.css" --include="*.jsx" --include="*.js" .

# Find rgb/rgba colors
grep -r "rgb\|rgba" --include="*.css" --include="*.jsx" --include="*.js" .

# More specific - find CSS files with hardcoded backgrounds
grep -r "background.*#[0-9a-fA-F]" --include="*.css" .

# Find hardcoded colors in component styles
grep -r "color:.*#[0-9a-fA-F]" --include="*.css" .
```

**Or use Claude Code's Grep tool:**

```
Pattern: (background|color|border-color):\s*(#[0-9a-fA-F]{3,6}|rgb)
Path: /Users/rickk/sanbox/frontend/src
Type: css
```

#### Method 3: Page-by-Page Testing

**Systematic approach:**

1. Create a checklist of all pages in the app
2. Open each page in browser
3. Switch themes using the theme dropdown
4. Document any visual issues
5. Fix them one by one

### Fixing Non-Themed Components

**Example: Found a hardcoded button color in `CustomersPage.css`**

#### Before (Non-Themed):

```css
/* components/CustomersPage.css */
.customer-action-button {
  background: #2563eb;          /* ❌ Hardcoded */
  color: white;                  /* ❌ Hardcoded */
  border: 1px solid #1e40af;    /* ❌ Hardcoded */
}

.customer-action-button:hover {
  background: #1d4ed8;          /* ❌ Hardcoded */
}
```

#### After (Theme-Aware):

```css
/* components/CustomersPage.css */
.customer-action-button {
  background: var(--button-primary-bg);       /* ✅ Uses theme variable */
  color: var(--button-primary-text);          /* ✅ Uses theme variable */
  border: 1px solid var(--button-primary-border); /* ✅ Uses theme variable */
}

.customer-action-button:hover {
  background: var(--button-primary-hover);    /* ✅ Uses theme variable */
}
```

### What If No Variable Exists?

**Example: You need a "highlight" color that doesn't exist yet.**

#### Step 1: Add to ALL themes in `themes.css`

```css
/* themes.css */

.theme-light {
  /* ...existing variables... */
  --highlight-bg: #fef3c7;        /* Light yellow */
  --highlight-text: #92400e;      /* Dark brown */
  --highlight-border: #fbbf24;    /* Amber */
}

.theme-dark {
  /* ...existing variables... */
  --highlight-bg: rgba(251, 191, 36, 0.15);  /* Transparent amber */
  --highlight-text: #fbbf24;                  /* Bright amber */
  --highlight-border: rgba(251, 191, 36, 0.3); /* Subtle amber */
}

.theme-dark-plus {
  /* ...existing variables... */
  --highlight-bg: rgba(255, 166, 87, 0.2);   /* Brighter transparent */
  --highlight-text: #ffa657;                  /* Bright orange */
  --highlight-border: rgba(255, 166, 87, 0.4); /* More visible */
}
```

#### Step 2: Use in Component

```css
.highlighted-row {
  background: var(--highlight-bg);
  color: var(--highlight-text);
  border-left: 3px solid var(--highlight-border);
}
```

### Common Patterns to Fix

#### Pattern 1: Inline Styles in JSX

**Before:**
```jsx
<div style={{ backgroundColor: '#f3f4f6', padding: '20px' }}>
  Content
</div>
```

**After:**
```jsx
<div className="content-container">
  Content
</div>

/* In CSS file: */
.content-container {
  background: var(--secondary-bg);
  padding: var(--space-5);
}
```

#### Pattern 2: Conditional Styling with Hardcoded Colors

**Before:**
```jsx
<button style={{
  backgroundColor: isActive ? '#2563eb' : '#e5e7eb',
  color: isActive ? 'white' : '#6b7280'
}}>
  Button
</button>
```

**After:**
```jsx
<button className={`btn ${isActive ? 'btn-active' : 'btn-inactive'}`}>
  Button
</button>

/* In CSS: */
.btn-active {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.btn-inactive {
  background: var(--button-bg);
  color: var(--button-text);
}
```

#### Pattern 3: Bootstrap Override with Hardcoded Colors

**Before:**
```css
.btn-primary {
  background-color: #0d6efd !important;  /* ❌ Overriding Bootstrap */
  border-color: #0d6efd !important;
}
```

**After:**
```css
.btn-primary {
  background-color: var(--button-primary-bg) !important;
  border-color: var(--button-primary-border) !important;
  color: var(--button-primary-text) !important;
}
```

---

## Rolling Out Theme Changes

### Strategy: Incremental Page-by-Page Rollout

**DO NOT try to fix everything at once.** Use this systematic approach:

### Phase 1: Preparation (Complete ✅)

- [x] Theme system implemented
- [x] Theme demo page created
- [x] Three themes designed and tested
- [x] Documentation written

### Phase 2: Identify Non-Compliant Pages

Create a spreadsheet or checklist:

```
Page/Component               Status    Priority   Notes
─────────────────────────────────────────────────────────
Dashboard                    ✅ Done   High       Already themed
Navbar                       ✅ Done   High       Already themed
Sidebar                      ✅ Done   High       Already themed
Zones Table                  ⚠️ TODO   High       Some hardcoded colors in toolbar
Aliases Table                ⚠️ TODO   High       Row hover color hardcoded
Storage Page                 ❌ TODO   Medium     Inline styles in cards
Customers Page               ❌ TODO   Medium     Button colors hardcoded
Settings Page                ❌ TODO   Low        Uses old theme classes
Tools Page                   ❌ TODO   Low        Mixed inline/CSS styles
```

### Phase 3: Fix Priority Pages First

**Week 1: High Priority**
- Fix pages users see most (Dashboard, main tables)
- Test thoroughly in all 3 themes

**Week 2: Medium Priority**
- Fix secondary pages
- Test in all themes

**Week 3: Low Priority**
- Fix rarely-used pages
- Final comprehensive testing

### Phase 4: Testing Protocol

For each page you fix:

1. **Visual Test in Theme Demo**
   - Add similar component to `/theme-demo` page
   - Verify it works in all 3 themes

2. **Test in Actual Application**
   - Navigate to the actual page
   - Switch between themes
   - Check all interactive states:
     - Hover
     - Active/selected
     - Disabled
     - Focus
     - Loading

3. **Cross-Browser Test** (if needed)
   - Chrome
   - Firefox
   - Safari
   - Edge

4. **Document Issues**
   - Screenshot any problems
   - Note which theme(s) affected
   - Document the fix

### Phase 5: Deployment

**Development:**
```bash
# Test in dev environment
./start
# Navigate and test all fixed pages
```

**Staging:**
```bash
# Deploy to staging for team review
./deploy-container.sh staging-tag
```

**Production:**
```bash
# Deploy to production after approval
./deploy-container.sh v2.0.0
```

---

## Best Practices

> **⚠️ IMPORTANT: Before creating ANY new page component, read the [Bootstrap Background Override Pattern](#️-critical-bootstrap-background-override-pattern) section below. This is a MANDATORY pattern to prevent gray boxes on dark themes.**

### DO ✅

1. **Always use CSS variables for colors**
   ```css
   color: var(--primary-text);  /* ✅ Good */
   ```

2. **Use semantic variable names**
   ```css
   --button-primary-bg    /* ✅ Clear purpose */
   --sidebar-active-bg    /* ✅ Component-specific */
   ```

3. **Add new variables to ALL themes**
   ```css
   /* Add to .theme-light, .theme-dark, AND .theme-dark-plus */
   ```

4. **Test in theme demo first**
   - Build component in demo
   - Perfect the styling
   - Copy to actual app

5. **Use existing variables when possible**
   - Check themes.css before creating new variables
   - Reuse `--primary-bg`, `--secondary-bg`, etc.

6. **Group related variables**
   ```css
   /* Button variables together */
   --button-bg: ...;
   --button-text: ...;
   --button-border: ...;
   --button-hover-bg: ...;
   ```

7. **Use CSS variable composition**
   ```css
   --primary-bg: var(--color-canvas-default);  /* ✅ Reference core colors */
   ```

### DON'T ❌

1. **Never use hardcoded colors**
   ```css
   color: #24292f;  /* ❌ Bad */
   ```

2. **Don't use inline styles for colors**
   ```jsx
   <div style={{ backgroundColor: '#fff' }}>  /* ❌ Bad */
   ```

3. **Don't create one-off variables**
   ```css
   --this-specific-button-on-page-X-bg: #abc;  /* ❌ Too specific */
   ```

4. **Don't forget to add to all themes**
   ```css
   /* If you add to .theme-light, MUST add to .theme-dark and .theme-dark-plus */
   ```

5. **Don't use theme-specific logic in JavaScript**
   ```js
   const bgColor = theme === 'dark' ? '#000' : '#fff';  /* ❌ Bad */
   // Instead: Use CSS variables and let CSS handle it
   ```

6. **Don't modify component CSS directly**
   - If color is wrong, fix the variable in themes.css
   - Don't override with hardcoded colors in component CSS

### Variable Naming Conventions

Follow these patterns:

```css
/* Core palette: --color-{category}-{variant} */
--color-canvas-default
--color-canvas-subtle
--color-border-default
--color-fg-default

/* Component-specific: --{component}-{property}-{state} */
--button-primary-bg
--button-primary-hover
--navbar-text-hover
--sidebar-active-border

/* Status/semantic: --{status}-{property} */
--success-bg
--error-text
--warning-border

/* Generic: --{property}-{variant} */
--primary-bg
--secondary-text
--muted-text
```

---

## ⚠️ CRITICAL: Bootstrap Background Override Pattern

### The Problem

**Bootstrap React components (`Card`, `Table`, `Row`, `Col`, etc.) have built-in white/gray backgrounds** that create visible boxes on dark themes. This is a **RECURRING ISSUE** that happens with every new page.

**Symptoms:**
- Gray or blue-tinted boxes/cards on dark theme
- White table backgrounds
- Components don't look transparent/clean
- Doesn't match the theme-demo style

### The Root Cause

Bootstrap's CSS has default backgrounds:
```css
/* Bootstrap defaults that override your theme */
.card { background-color: #fff; }
.card-body { background-color: rgba(0,0,0,.03); }
.table { background-color: #fff; }
.table-hover tbody tr { background-color: #f8f9fa; }
```

These have **higher specificity** than simple class selectors and are **loaded after** your custom CSS, so they override your transparent backgrounds.

### The Solution Pattern (MANDATORY for all new pages)

**Step 1: Wrap Your Page Component**

```jsx
// In your JSX component
return (
  <Container fluid className="your-component-page mt-4">
    {/* All your content */}
  </Container>
);
```

**Step 2: Create Scoped CSS with Maximum Specificity**

```css
/* your-component.css */

/* ========== CRITICAL BOOTSTRAP OVERRIDES ========== */
/* MUST come first in CSS file */

/* Scope everything to your page class */
.your-component-page {
  background: transparent !important;
}

/* Override ALL Bootstrap backgrounds within your page */
.your-component-page .card,
.your-component-page .card-body,
.your-component-page .row,
.your-component-page [class*="col-"],
.your-component-page .table,
.your-component-page .table tbody,
.your-component-page .table thead,
.your-component-page .table tbody tr,
.your-component-page .table tbody td,
.your-component-page .table thead th {
  background-color: transparent !important;
  background-image: none !important;
  background: transparent !important;
}

/* Override Bootstrap utility classes */
.your-component-page .bg-white,
.your-component-page .bg-light,
.your-component-page .bg-secondary {
  background-color: transparent !important;
  background: transparent !important;
}
```

**Step 3: Scope ALL Your Component Styles**

```css
/* All other styles MUST be scoped */
.your-component-page .stats-card {
  background-color: transparent !important;
  background: transparent !important;
  border: 2px solid var(--color-border-default) !important;
}

.your-component-page .table tbody tr:hover {
  background: var(--table-row-hover) !important;
}
```

### Why This Works

1. **Higher Specificity**: `.your-component-page .card` (specificity 0,2,0) beats `.card` (specificity 0,1,0)
2. **Scoping**: Only affects your page, doesn't interfere with other components
3. **Triple Override**: Uses `background-color`, `background-image`, AND `background` to catch all Bootstrap variations
4. **!important**: Nuclear option to override Bootstrap's specificity tricks

### Text Color Rules (Also Recurring Issue)

**❌ NEVER use gray color variables:**
```css
/* WRONG - Creates dim text */
color: var(--secondary-text);  /* ❌ Gray #6e7681 */
color: var(--muted-text);      /* ❌ Gray #6e7681 */
color: var(--color-fg-subtle); /* ❌ Gray #6e7681 */
```

**✅ ALWAYS use primary text with opacity:**
```css
/* CORRECT - Bright text with subtle dimming */
h1, h2, h3, h4, h5, h6 {
  color: var(--primary-text) !important;  /* Full brightness */
}

small, .label, .descriptive-text {
  color: var(--primary-text) !important;
  opacity: 0.7;  /* Dimmed via opacity, not gray color */
}

.subtitle {
  color: var(--primary-text) !important;
  opacity: 0.85;  /* Slightly less dim */
}
```

### Override Bootstrap's .text-muted

Bootstrap's `.text-muted` class adds gray color. Override it:

```css
.your-component-page .text-muted {
  color: var(--primary-text) !important;
  opacity: 0.7 !important;
}
```

### Complete Checklist for New Pages

When creating a new page component, follow this checklist:

- [ ] **1. Add wrapper class** to Container/root element (`.my-page-name`)
- [ ] **2. Start CSS file** with Bootstrap override section (copy template above)
- [ ] **3. Scope ALL selectors** to wrapper class (`.my-page-name .component`)
- [ ] **4. Use transparent backgrounds** for all cards, tables, rows
- [ ] **5. Use `--primary-text` for all text**, never `--secondary-text` or `--muted-text`
- [ ] **6. Use `opacity`** for dimming, not gray colors
- [ ] **7. Override `.text-muted`** class
- [ ] **8. Add `!important`** to critical overrides (backgrounds, colors)
- [ ] **9. Test in Dark theme** - should see black background, not gray boxes
- [ ] **10. Compare to theme-demo** - should look similar (clean, transparent)

### Example: Import Monitor Page

See `/frontend/src/pages/ImportMonitor.css` and `/frontend/src/pages/ImportMonitor.jsx` for a complete working example of this pattern.

Key elements:
- Wrapper class: `.import-monitor-page`
- Bootstrap overrides at top of CSS
- All selectors scoped: `.import-monitor-page .stats-card`
- Transparent backgrounds everywhere
- Primary text with opacity for hierarchy

### When to Use This Pattern

**Always use this pattern when:**
- Creating a new page component
- Using Bootstrap React components (Card, Table, Modal, etc.)
- Components should blend with dark background (not have visible boxes)
- Following the clean, transparent aesthetic of theme-demo

**Exception: When boxes are intentional**
- Modals should have visible backgrounds (use `var(--modal-bg)`)
- Certain cards that need to stand out (use sparingly)

---

## Troubleshooting

### Issue: Component Not Changing with Theme

**Symptoms:** Component stays the same color when switching themes.

**Diagnosis:**
1. Check if component uses CSS variables
2. Open browser DevTools
3. Inspect the element
4. Look at "Computed" styles
5. If you see hardcoded values (not `var(--...)`), that's the problem

**Fix:**
- Find the CSS rule with hardcoded color
- Replace with appropriate CSS variable
- Test again

### Issue: Variable Not Defined

**Symptoms:** Component appears broken or uses fallback color.

**Diagnosis:**
```css
/* In component CSS: */
background: var(--some-variable);  /* Shows yellow/pink in DevTools if undefined */
```

**Fix:**
1. Check if variable exists in `themes.css`
2. If missing, add to ALL themes
3. If typo, correct the variable name

### Issue: Wrong Color in Dark Theme

**Symptoms:** Dark theme uses wrong shade or looks bad.

**Diagnosis:**
- Component is using correct variable
- Variable value in `.theme-dark` section is wrong

**Fix:**
1. Open `/frontend/src/styles/themes.css`
2. Find `.theme-dark` section
3. Locate the variable
4. Adjust the color value
5. Test in theme demo

### Issue: Theme Not Persisting

**Symptoms:** Theme resets to default after page reload.

**Diagnosis:**
- Check localStorage in browser DevTools
- Look for `dashboard-theme` key
- If missing, ThemeContext isn't saving

**Fix:**
- Check ThemeContext.js implementation
- Ensure `localStorage.setItem` is called in `updateTheme`
- Check browser console for errors

### Issue: CSS Variable Not Updating

**Symptoms:** Changed variable in themes.css, but not seeing changes.

**Fix:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check if CSS file is being loaded (Network tab in DevTools)
3. Check if old CSS is cached
4. Restart dev server if hot reload isn't working

### Issue: Component Works in Demo but Not in App

**Symptoms:** Component looks perfect in `/theme-demo` but broken in actual app.

**Diagnosis:**
- Check if actual component uses same CSS
- Check if there are conflicting styles
- Check if parent component has hardcoded styles

**Fix:**
1. Compare demo component CSS vs actual component CSS
2. Look for differences
3. Ensure actual component imports correct CSS file
4. Check for CSS specificity issues or `!important` rules

---

## Quick Reference Cheat Sheet

### Common Variables

```css
/* Backgrounds */
--primary-bg              /* Main background */
--secondary-bg            /* Secondary surfaces */
--content-bg              /* Content area background */

/* Text */
--primary-text            /* Main text */
--secondary-text          /* Less emphasis */
--muted-text              /* Subtle text */
--link-text               /* Links */

/* Buttons */
--button-bg               /* Default button */
--button-primary-bg       /* Primary action button */
--button-hover-bg         /* Hover state */

/* Forms */
--form-input-bg           /* Input background */
--form-input-border       /* Input border */
--form-input-focus-border /* Input focus */

/* Status */
--color-success-fg        /* Success text */
--color-danger-fg         /* Error text */
--color-attention-fg      /* Warning text */
--color-info-fg           /* Info text */

/* Components */
--navbar-bg               /* Navbar background */
--sidebar-bg              /* Sidebar background */
--table-bg                /* Table background */
--card-bg                 /* Card background */
```

### Quick Commands

```bash
# Start dev environment
./start

# View theme demo
# Navigate to: http://localhost:3000/theme-demo

# Search for hardcoded colors
grep -r "#[0-9a-fA-F]\{3,6\}" --include="*.css" frontend/src/

# Search for inline styles
grep -r "style={{" --include="*.jsx" --include="*.js" frontend/src/
```

### File Locations

```
Theme Variables:     /frontend/src/styles/themes.css
Theme Context:       /frontend/src/context/ThemeContext.js
Theme Dropdown:      /frontend/src/components/navigation/ThemeDropdown.js
Theme Demo:          /frontend/src/pages/ThemeDemo.js
Demo Components:     /frontend/src/components/theme-demo/
```

---

## Future Enhancements

Ideas for extending the theme system:

### 1. Additional Themes

To add a 4th theme (e.g., "High Contrast"):

```css
/* In themes.css, add: */
.theme-high-contrast {
  --color-canvas-default: #000000;
  --color-fg-default: #ffffff;
  --color-border-default: #ffffff;
  /* ...define ALL variables */
}
```

Update ThemeContext.js and ThemeDropdown.js to include the new theme.

### 2. User Custom Themes

Allow users to customize theme colors:
- Store custom color overrides in database
- Apply as inline style overrides
- Provide color picker UI

### 3. Theme Export/Import

Allow sharing themes:
- Export theme as JSON
- Import theme from JSON
- Save custom themes to database

### 4. Automatic Dark Mode

Auto-switch based on system preference:

```javascript
// In ThemeContext.js
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const defaultTheme = prefersDark ? 'dark' : 'light';
```

### 5. Scheduled Theme Switching

Auto-switch theme based on time of day:
- Light theme during day
- Dark theme at night
- User configurable schedule

---

## Alert Box Pattern (Mandatory for All New Components)

### Overview

**DO NOT use Bootstrap's default Alert components** (`.alert-info`, `.alert-warning`, etc.) as they use hardcoded colors that don't respect the theme system.

**INSTEAD:** Use our custom alert box pattern with theme variables and colored left borders.

### Complete Documentation

**See:** `/Users/rickk/sanbox/ALERT_BOX_PATTERN.md` - Complete guide with examples, code templates, and visual references

**Reference Implementation:** `/frontend/src/styles/backup.css` (lines 1025-1115) and `/frontend/src/components/backup/BackupScheduler.jsx`

### Quick Pattern

```css
/* In your component CSS file */
.your-component-info-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-border-default) !important;
  border-left: 4px solid var(--color-accent-emphasis) !important;
  color: var(--primary-text) !important;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}
```

```jsx
// In your component JSX
<div className="your-component-info-alert">
  <strong>Info:</strong> Your message here
</div>
```

### Alert Types & Colors

| Type | Left Border Color | Use Case |
|------|------------------|----------|
| **Info** | `--color-accent-emphasis` (blue) | Informational messages, schedules, tips |
| **Warning** | `--color-attention-emphasis` (orange) | Warnings, important notes, retention policies |
| **Success** | `--color-success-emphasis` (green) | Success confirmations, completed actions |
| **Error** | `--color-danger-emphasis` (red) | Error messages, validation failures |

### Key Features

1. **Triple Background Declaration:** Ensures Bootstrap override
2. **4px Colored Left Border:** Visual hierarchy and type identification
3. **Theme Variables Only:** All colors from theme system
4. **Component-Scoped Naming:** Prevents CSS conflicts
5. **Works in All Themes:** Light, Dark, Dark+

### Visual Reference

To see these alerts in action, navigate to:
- **Settings → Backup & Restore → Configure Schedule**

Look at the "Next Scheduled Backup" (info alert) and "Retention Policy" (warning alert) boxes.

---

## Conclusion

This theme system provides a **maintainable, scalable, and user-friendly** way to manage visual themes across the entire Sanbox application. By following this documentation:

✅ You can update themes in one place
✅ You can add new components that automatically support all themes
✅ You can identify and fix non-themed components systematically
✅ You can roll out changes safely and incrementally

**Key Takeaway:** Everything visual should use CSS variables from `themes.css`. If it doesn't, fix it. When in doubt, test in `/theme-demo` first.

**CRITICAL:** For all new page components, follow the [Bootstrap Background Override Pattern](#️-critical-bootstrap-background-override-pattern) to prevent gray boxes on dark themes.

---

**Last Updated:** 2025-10-29 (Added Alert Box Pattern section)
**Next Review:** When adding new components or themes
