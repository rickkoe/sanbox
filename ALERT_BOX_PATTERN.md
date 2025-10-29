# Theme-Aware Alert Box Pattern

**Purpose:** Standard pattern for creating info, warning, success, and error alert boxes that work perfectly with the theme system.

**Reference Implementation:** `/frontend/src/styles/backup.css` (lines 1025-1115)

---

## The Problem

Bootstrap's default Alert components use hardcoded colors that don't respect the theme system and create visual inconsistencies. We need a custom pattern that:

1. Uses theme variables for all colors
2. Works in Light, Dark, and Dark+ themes
3. Provides clear visual hierarchy with colored left borders
4. Has proper override specificity to beat Bootstrap defaults
5. Maintains readability and accessibility

---

## The Solution: Custom Alert Classes

Create custom alert classes with theme variables instead of using Bootstrap's `.alert-*` classes.

### Pattern Structure

```css
.your-component-alert-type {
  /* Triple background declaration - ensures Bootstrap override */
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;

  /* Border with colored left accent */
  border: 1px solid var(--color-border-default) !important;
  border-left: 4px solid var(--color-TYPE-emphasis) !important;

  /* Text color */
  color: var(--primary-text) !important;

  /* Spacing & Shape */
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.your-component-alert-type strong {
  color: var(--primary-text) !important;
}

.your-component-alert-type p {
  color: var(--primary-text) !important;
}
```

---

## Complete Implementation

### Step 1: Define Alert Classes in CSS

Add these to your component's CSS file (e.g., `/styles/your-component.css`):

```css
/* ========== CUSTOM THEMED ALERTS ========== */
/* Replace Bootstrap Alert hardcoded colors with theme variables */

/* Info Alert (Blue) - For informational messages */
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

.your-component-info-alert strong {
  color: var(--primary-text) !important;
}

/* Warning/Attention Alert (Yellow/Orange) - For warnings */
.your-component-warning-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-border-default) !important;
  border-left: 4px solid var(--color-attention-emphasis) !important;
  color: var(--primary-text) !important;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.your-component-warning-alert strong {
  color: var(--primary-text) !important;
}

/* Success Alert (Green) - For success messages */
.your-component-success-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-success-muted) !important;
  border-left: 4px solid var(--color-success-emphasis) !important;
  color: var(--color-success-fg) !important;
  padding: 1rem 1.25rem;
  padding-right: 3rem; /* Extra space for close button if needed */
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  position: relative; /* For close button positioning */
}

/* Error/Danger Alert (Red) - For errors */
.your-component-error-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-danger-muted) !important;
  border-left: 4px solid var(--color-danger-emphasis) !important;
  color: var(--color-danger-fg) !important;
  padding: 1rem 1.25rem;
  padding-right: 3rem; /* Extra space for close button if needed */
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  position: relative; /* For close button positioning */
}

/* Optional: Close Button for Dismissible Alerts */
.your-component-alert-close {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: inherit;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  opacity: 0.5;
  transition: opacity var(--transition-speed) ease;
}

.your-component-alert-close:hover {
  opacity: 1;
}
```

### Step 2: Use in JSX

```jsx
import './your-component.css';

const YourComponent = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  return (
    <div>
      {/* Error Alert */}
      {error && (
        <div className="your-component-error-alert">
          <button
            className="your-component-alert-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
          {error}
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="your-component-success-alert">
          <button
            className="your-component-alert-close"
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
          {success}
        </div>
      )}

      {/* Info Alert (Static) */}
      <div className="your-component-info-alert">
        <strong>📅 Next Scheduled Backup:</strong>
        <div className="mt-1">
          Wednesday, October 29, 2025 at 08:00 AM
        </div>
        <small className="text-muted">(3 minutes from now)</small>
      </div>

      {/* Warning Alert (Static) */}
      <div className="your-component-warning-alert">
        <strong>⚠️ Important:</strong>
        <p className="mb-0">
          Backups will be deleted if they exceed 10 total backups OR are older than 30 days
          (whichever comes first).
        </p>
      </div>
    </div>
  );
};
```

---

## Key Features

### 1. **Triple Background Declaration**
```css
background-color: var(--secondary-bg) !important;
background-image: none !important;
background: var(--secondary-bg) !important;
```

**Why?** Bootstrap uses multiple background properties. This ensures complete override:
- `background-color` - Overrides direct background color
- `background-image` - Removes any gradient or image
- `background` - Shorthand that overrides all background properties

### 2. **Colored Left Border for Visual Hierarchy**
```css
border: 1px solid var(--color-border-default) !important;
border-left: 4px solid var(--color-TYPE-emphasis) !important;
```

The thick left border provides:
- Clear visual identification of alert type
- Modern, clean aesthetic
- Better than full colored backgrounds (less visual noise)

### 3. **Proper Text Colors**

**For Info/Warning Alerts:**
```css
color: var(--primary-text) !important;
```
Uses primary text color for readability.

**For Success/Error Alerts:**
```css
color: var(--color-success-fg) !important;
color: var(--color-danger-fg) !important;
```
Uses colored text for emphasis (green for success, red for error).

### 4. **Theme Variables Used**

| Type | Background | Border | Left Border | Text Color |
|------|-----------|--------|-------------|------------|
| **Info** | `--secondary-bg` | `--color-border-default` | `--color-accent-emphasis` (blue) | `--primary-text` |
| **Warning** | `--secondary-bg` | `--color-border-default` | `--color-attention-emphasis` (orange) | `--primary-text` |
| **Success** | `--secondary-bg` | `--color-success-muted` | `--color-success-emphasis` (green) | `--color-success-fg` |
| **Error** | `--secondary-bg` | `--color-danger-muted` | `--color-danger-emphasis` (red) | `--color-danger-fg` |

---

## Visual Examples (by Theme)

### Light Theme
- **Info:** Light gray background, thin gray border, thick blue left border, dark text
- **Warning:** Light gray background, thin gray border, thick orange left border, dark text
- **Success:** Light gray background, thin green border, thick green left border, green text
- **Error:** Light gray background, thin red border, thick red left border, red text

### Dark Theme
- **Info:** Dark gray background, thin gray border, thick blue left border, light text
- **Warning:** Dark gray background, thin gray border, thick orange left border, light text
- **Success:** Dark gray background, thin green border, thick green left border, green text
- **Error:** Dark gray background, thin red border, thick red left border, red text

### Dark+ Theme
- **Info:** Black background, thin gray border, thick bright blue left border, white text
- **Warning:** Black background, thin gray border, thick bright orange left border, white text
- **Success:** Black background, thin green border, thick bright green left border, bright green text
- **Error:** Black background, thin red border, thick bright red left border, bright red text

---

## Do's and Don'ts

### ✅ DO

1. **Use custom classes with component prefix**
   ```css
   .backup-scheduler-info-alert { }
   .user-profile-warning-alert { }
   .import-monitor-success-alert { }
   ```

2. **Include the triple background declaration**
   ```css
   background-color: var(--secondary-bg) !important;
   background-image: none !important;
   background: var(--secondary-bg) !important;
   ```

3. **Use theme variables for ALL colors**
   ```css
   border-left: 4px solid var(--color-success-emphasis) !important;
   ```

4. **Add strong and p selectors for nested text**
   ```css
   .your-alert strong { color: var(--primary-text) !important; }
   .your-alert p { color: var(--primary-text) !important; }
   ```

5. **Use `!important` to override Bootstrap**
   ```css
   color: var(--primary-text) !important;
   ```

### ❌ DON'T

1. **Don't use Bootstrap's alert classes directly**
   ```jsx
   {/* ❌ DON'T */}
   <Alert variant="info">Message</Alert>
   <div className="alert alert-warning">Warning</div>
   ```

2. **Don't hardcode colors**
   ```css
   /* ❌ DON'T */
   .my-alert {
     background: #f0f9ff;
     border-left: 4px solid #0ea5e9;
   }
   ```

3. **Don't forget the border-left accent**
   ```css
   /* ❌ DON'T - too subtle, no visual hierarchy */
   .my-alert {
     background: var(--secondary-bg);
     border: 1px solid var(--color-border-default);
   }
   ```

4. **Don't use only one background property**
   ```css
   /* ❌ DON'T - Bootstrap will override this */
   .my-alert {
     background-color: var(--secondary-bg);
   }
   ```

---

## Naming Convention

**Pattern:** `{component-name}-{alert-type}-alert`

**Examples:**
- `.backup-scheduler-info-alert`
- `.backup-scheduler-warning-alert`
- `.backup-scheduler-success-alert`
- `.backup-scheduler-error-alert`
- `.import-monitor-info-alert`
- `.user-profile-warning-alert`

**Why component prefixes?**
- Prevents CSS conflicts
- Clear ownership/scope
- Easy to find in codebase
- Follows existing patterns

---

## Complete Working Example

See reference implementation:
- **Component:** `/frontend/src/components/backup/BackupScheduler.jsx`
- **CSS:** `/frontend/src/styles/backup.css` (lines 1025-1115)
- **Visual Example:** Navigate to Backup Management → Configure Schedule

---

## When to Use

Use this pattern for:
- ✅ Informational messages (schedules, next actions, tips)
- ✅ Warning messages (retention policies, important notes)
- ✅ Success confirmations (save successful, import complete)
- ✅ Error messages (save failed, validation errors)
- ✅ Static alerts (always visible)
- ✅ Dismissible alerts (with close button)

Don't use for:
- ❌ Brief toast notifications (use toast library instead)
- ❌ Form validation errors (use inline error messages)
- ❌ Loading states (use spinners/skeletons)

---

## Quick Start Template

```css
/* Add to your component CSS file */
.my-component-info-alert {
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

.my-component-info-alert strong {
  color: var(--primary-text) !important;
}
```

```jsx
// Use in your component
<div className="my-component-info-alert">
  <strong>Info:</strong> Your message here
</div>
```

---

## Testing Checklist

After implementing, verify:
- [ ] Alert appears with correct colors in **Light** theme
- [ ] Alert appears with correct colors in **Dark** theme
- [ ] Alert appears with correct colors in **Dark+** theme
- [ ] Left border is thick (4px) and properly colored
- [ ] Background is subtle and not distracting
- [ ] Text is readable in all themes
- [ ] Close button works (if dismissible)
- [ ] No gray boxes or hardcoded colors visible
- [ ] Matches the style of Backup Scheduler alerts

---

## Troubleshooting

**Problem:** Alert has gray/white background in dark theme
- **Solution:** Check triple background declaration with `!important`

**Problem:** Left border doesn't show or is wrong color
- **Solution:** Verify `border-left: 4px solid var(--color-TYPE-emphasis) !important;`

**Problem:** Text is hard to read
- **Solution:** Use `--primary-text` for info/warning, colored text for success/error

**Problem:** Alert doesn't match theme
- **Solution:** Ensure all colors use `var(--...)` theme variables

---

**Last Updated:** 2025-10-29
**Status:** Production-ready pattern used in Backup Management
**Approved for:** All new components
