# Theme System Audit & Fix Guide

**Quick reference for finding and fixing components that aren't using the theme system**

---

## Quick Audit Process

### Step 1: Find Hardcoded Colors

Run these commands from `/Users/rickk/sanbox/frontend/src`:

```bash
# Find hex colors in CSS files
find . -name "*.css" -not -path "*/node_modules/*" -exec grep -l "#[0-9a-fA-F]\{3,6\}" {} \;

# Find rgb/rgba colors in CSS files
find . -name "*.css" -not -path "*/node_modules/*" -exec grep -l "rgba\?(" {} \;

# Find inline styles in JSX/JS files
find . -name "*.jsx" -o -name "*.js" -not -path "*/node_modules/*" | xargs grep -l "style={{"

# Combined search - most comprehensive
grep -rn --include="*.css" --include="*.jsx" --include="*.js" \
  -e "background.*#[0-9a-fA-F]" \
  -e "color:.*#[0-9a-fA-F]" \
  -e "border.*#[0-9a-fA-F]" \
  -e "style={{" \
  . | grep -v node_modules | grep -v ".backup"
```

### Step 2: Prioritize Files to Fix

Files to fix **first** (highest impact):
1. `styles/navbar.css` - Already done ✅
2. `styles/sidebar.css` - Already done ✅
3. `styles/generictable.css` - Check tables
4. `styles/pages.css` - Check page layouts
5. Component-specific CSS files
6. JSX files with inline styles

### Step 3: Fix Each File

For each file with hardcoded colors:

1. **Identify what the color is for** (background, text, border, etc.)
2. **Find the appropriate CSS variable** in `/frontend/src/styles/themes.css`
3. **Replace the hardcoded value** with the CSS variable
4. **Test in all 3 themes**

---

## Common Patterns & Fixes

### Pattern 1: Background Colors

**Before:**
```css
.my-component {
  background: #ffffff;
  background-color: #f3f4f6;
}
```

**After:**
```css
.my-component {
  background: var(--primary-bg);
  background-color: var(--secondary-bg);
}
```

**Available Background Variables:**
- `--primary-bg` - Main background
- `--secondary-bg` - Secondary surfaces
- `--content-bg` - Content areas
- `--card-bg` - Card backgrounds
- `--table-bg` - Table backgrounds
- `--navbar-bg` - Navbar background
- `--sidebar-bg` - Sidebar background

### Pattern 2: Text Colors

**Before:**
```css
.my-text {
  color: #24292f;
  color: #6b7280;
  color: #9ca3af;
}
```

**After:**
```css
.my-text {
  color: var(--primary-text);
  color: var(--secondary-text);
  color: var(--muted-text);
}
```

**Available Text Variables:**
- `--primary-text` - Main text
- `--secondary-text` - Less emphasis
- `--muted-text` - Subtle/disabled text
- `--link-text` - Hyperlinks
- `--color-fg-default` - Default foreground
- `--color-fg-muted` - Muted foreground

### Pattern 3: Borders

**Before:**
```css
.my-border {
  border: 1px solid #e5e7eb;
  border-color: #d1d5db;
}
```

**After:**
```css
.my-border {
  border: 1px solid var(--color-border-default);
  border-color: var(--color-border-muted);
}
```

**Available Border Variables:**
- `--color-border-default` - Standard borders
- `--color-border-muted` - Subtle borders
- `--color-border-subtle` - Very subtle borders
- `--table-border` - Table borders
- `--card-border` - Card borders

### Pattern 4: Buttons

**Before:**
```css
.btn-primary {
  background: #2563eb;
  color: white;
  border: 1px solid #1e40af;
}

.btn-primary:hover {
  background: #1d4ed8;
}
```

**After:**
```css
.btn-primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: 1px solid var(--button-primary-border);
}

.btn-primary:hover {
  background: var(--button-primary-hover);
}
```

**Available Button Variables:**
- `--button-bg` - Default button
- `--button-text` - Button text
- `--button-border` - Button border
- `--button-hover-bg` - Hover state
- `--button-primary-bg` - Primary button
- `--button-primary-text` - Primary text
- `--button-primary-hover` - Primary hover

### Pattern 5: Status Colors

**Before:**
```css
.success { background: #10b981; color: #065f46; }
.error { background: #ef4444; color: #991b1b; }
.warning { background: #f59e0b; color: #92400e; }
.info { background: #3b82f6; color: #1e3a8a; }
```

**After:**
```css
.success {
  background: var(--alert-success-bg);
  color: var(--alert-success-text);
}
.error {
  background: var(--alert-danger-bg);
  color: var(--alert-danger-text);
}
.warning {
  background: var(--alert-warning-bg);
  color: var(--alert-warning-text);
}
.info {
  background: var(--alert-info-bg);
  color: var(--alert-info-text);
}
```

**Available Status Variables:**
- Success: `--alert-success-bg`, `--alert-success-text`, `--alert-success-border`
- Danger: `--alert-danger-bg`, `--alert-danger-text`, `--alert-danger-border`
- Warning: `--alert-warning-bg`, `--alert-warning-text`, `--alert-warning-border`
- Info: `--alert-info-bg`, `--alert-info-text`, `--alert-info-border`

### Pattern 6: Inline Styles (JSX)

**Before:**
```jsx
<div style={{
  backgroundColor: '#f9fafb',
  padding: '20px',
  color: '#111827',
  borderRadius: '8px'
}}>
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
  background-color: var(--secondary-bg);
  padding: var(--space-5);
  color: var(--primary-text);
  border-radius: var(--radius-lg);
}
```

**Or if you must use inline styles:**
```jsx
<div style={{
  backgroundColor: 'var(--secondary-bg)',
  padding: 'var(--space-5)',
  color: 'var(--primary-text)',
  borderRadius: 'var(--radius-lg)'
}}>
  Content
</div>
```

### Pattern 7: Conditional Styles

**Before:**
```jsx
<button style={{
  backgroundColor: isActive ? '#2563eb' : '#e5e7eb',
  color: isActive ? '#ffffff' : '#6b7280'
}}>
  Button
</button>
```

**After:**
```jsx
<button className={isActive ? 'btn-active' : 'btn-inactive'}>
  Button
</button>

/* In CSS: */
.btn-active {
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.btn-inactive {
  background-color: var(--button-bg);
  color: var(--button-text);
}
```

### Pattern 8: Shadows

**Before:**
```css
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
}
```

**After:**
```css
.card {
  box-shadow: var(--shadow-md);
  /* or */
  box-shadow: var(--shadow-lg);
}
```

**Available Shadow Variables:**
- `--shadow-sm` - Small shadow
- `--shadow-md` - Medium shadow
- `--shadow-lg` - Large shadow
- `--shadow-xl` - Extra large shadow
- `--card-shadow` - Card-specific shadow

---

## Variable Reference Quick Lookup

### When You Need... Use This Variable...

| Need | Variable |
|------|----------|
| **White/light background** | `--primary-bg` or `--color-canvas-default` |
| **Slightly darker background** | `--secondary-bg` or `--color-canvas-subtle` |
| **Content area background** | `--content-bg` |
| **Card background** | `--card-bg` |
| **Main text color** | `--primary-text` or `--color-fg-default` |
| **Secondary text** | `--secondary-text` or `--color-fg-muted` |
| **Disabled/muted text** | `--muted-text` or `--color-fg-subtle` |
| **Link color** | `--link-text` or `--color-accent-fg` |
| **Link hover** | `--link-hover` |
| **Border** | `--color-border-default` |
| **Subtle border** | `--color-border-muted` |
| **Button background** | `--button-bg` |
| **Primary button** | `--button-primary-bg` |
| **Button hover** | `--button-hover-bg` |
| **Input background** | `--form-input-bg` |
| **Input border** | `--form-input-border` |
| **Input focus border** | `--form-input-focus-border` |
| **Success color** | `--color-success-fg` or `--alert-success-bg` |
| **Error color** | `--color-danger-fg` or `--alert-danger-bg` |
| **Warning color** | `--color-attention-fg` or `--alert-warning-bg` |
| **Info color** | `--color-info-fg` or `--alert-info-bg` |
| **Small spacing** | `--space-2` (8px) |
| **Medium spacing** | `--space-4` (16px) |
| **Large spacing** | `--space-6` (32px) |
| **Small radius** | `--radius-sm` (4px) |
| **Medium radius** | `--radius-md` (6px) |
| **Large radius** | `--radius-lg` (8px) |

---

## Testing Checklist

After fixing a component, verify:

### Visual Test
- [ ] Component looks correct in **Light** theme
- [ ] Component looks correct in **Dark** theme
- [ ] Component looks correct in **Dark+** theme

### Interactive States
- [ ] Hover states work correctly
- [ ] Active/selected states work correctly
- [ ] Focus states work correctly
- [ ] Disabled states work correctly
- [ ] Loading states work correctly (if applicable)

### Browser DevTools Check
- [ ] Open DevTools > Elements > Styles
- [ ] Verify colors show as `var(--variable-name)`
- [ ] No yellow/pink highlights (indicating undefined variables)
- [ ] No hardcoded color values

### Theme Switching
- [ ] Switch to Dark theme - component updates
- [ ] Switch to Light theme - component updates
- [ ] Switch to Dark+ theme - component updates
- [ ] No "flash" or delay in color changes

---

## Creating New Variables

If you need a variable that doesn't exist:

### Step 1: Design the Variable

Choose a clear, semantic name:
- ✅ `--header-gradient` - Clear purpose
- ✅ `--status-badge-bg` - Component-specific
- ❌ `--my-blue` - Too generic
- ❌ `--page-x-button-color` - Too specific

### Step 2: Add to ALL Themes

Open `/frontend/src/styles/themes.css` and add to **EACH** theme:

```css
/* ========== LIGHT THEME ========== */
.theme-light {
  /* ...existing variables... */

  /* Add your new variable */
  --header-gradient: linear-gradient(135deg, #f8fafc 0%, #e8eef5 100%);
}

/* ========== DARK THEME ========== */
.theme-dark {
  /* ...existing variables... */

  /* Add your new variable */
  --header-gradient: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
}

/* ========== DARK PLUS THEME ========== */
.theme-dark-plus {
  /* ...existing variables... */

  /* Add your new variable */
  --header-gradient: linear-gradient(135deg, #000000 0%, #0d1117 100%);
}
```

### Step 3: Use in Component

```css
.page-header {
  background: var(--header-gradient);
}
```

### Step 4: Test in Theme Demo

Add to `/frontend/src/components/theme-demo/SamplePage.jsx`:

```jsx
<section className="sample-section">
  <div className="page-header">
    <h2>Page Header</h2>
  </div>
</section>
```

Test in all 3 themes.

---

## Red Flags 🚩

Watch out for these problematic patterns:

### 🚩 Hardcoded Colors
```css
color: #000000;  /* ❌ */
background: #fff; /* ❌ */
```

### 🚩 RGB/RGBA Without var()
```css
color: rgba(0, 0, 0, 0.5);  /* ❌ */
background: rgb(255, 255, 255); /* ❌ */
```

### 🚩 Inline Styles in JSX
```jsx
<div style={{ backgroundColor: '#f3f4f6' }}>  /* ❌ */
```

### 🚩 Theme-Specific Logic in JS
```js
const color = theme === 'dark' ? '#000' : '#fff';  /* ❌ */
```

### 🚩 !important with Hardcoded Colors
```css
background: #fff !important;  /* ❌ Double bad */
```

### 🚩 Gradients with Hardcoded Colors
```css
background: linear-gradient(to right, #667eea, #764ba2);  /* ❌ */
```

---

## Quick Commands Reference

```bash
# Find all CSS files with hardcoded colors
find frontend/src -name "*.css" -exec grep -l "#[0-9a-fA-F]" {} \;

# Find all JSX files with inline styles
find frontend/src -name "*.jsx" -exec grep -l "style={{" {} \;

# Count hardcoded colors in a file
grep -o "#[0-9a-fA-F]\{3,6\}" frontend/src/styles/navbar.css | wc -l

# View theme demo
# Navigate to: http://localhost:3000/theme-demo

# Restart dev server (if changes not showing)
./stop && ./start
```

---

## Example: Full Component Conversion

### Before (Non-Themed)

**CustomerCard.jsx:**
```jsx
const CustomerCard = ({ customer }) => {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ color: '#111827' }}>{customer.name}</h3>
      <p style={{ color: '#6b7280' }}>{customer.email}</p>
      <button style={{
        backgroundColor: '#2563eb',
        color: '#ffffff',
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px'
      }}>
        View Details
      </button>
    </div>
  );
};
```

### After (Theme-Aware)

**CustomerCard.jsx:**
```jsx
import './CustomerCard.css';

const CustomerCard = ({ customer }) => {
  return (
    <div className="customer-card">
      <h3 className="customer-card-title">{customer.name}</h3>
      <p className="customer-card-email">{customer.email}</p>
      <button className="customer-card-button">
        View Details
      </button>
    </div>
  );
};
```

**CustomerCard.css:**
```css
.customer-card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--card-shadow);
  transition: box-shadow var(--transition-speed) var(--transition-timing);
}

.customer-card:hover {
  box-shadow: var(--card-hover-shadow);
}

.customer-card-title {
  color: var(--primary-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0 0 var(--space-2) 0;
}

.customer-card-email {
  color: var(--secondary-text);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-4) 0;
}

.customer-card-button {
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--button-primary-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-speed) var(--transition-timing);
}

.customer-card-button:hover {
  background-color: var(--button-primary-hover);
}
```

**Result:**
- ✅ Works in all 3 themes automatically
- ✅ Consistent with other components
- ✅ Easy to maintain
- ✅ Follows spacing/sizing standards
- ✅ Proper hover states

---

## Need Help?

1. **Check the main documentation:** `THEME_SYSTEM_DOCUMENTATION.md`
2. **Look at theme demo components:** `/frontend/src/components/theme-demo/`
3. **Review themes.css:** `/frontend/src/styles/themes.css`
4. **Test in theme demo first:** `http://localhost:3000/theme-demo`

Remember: **When in doubt, check if a variable exists before creating a new one!**
