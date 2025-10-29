# Alert Box Pattern - Quick Reference

**Created:** 2025-10-29
**Status:** Production-ready pattern
**Reference:** Backup Scheduler component

---

## Why This Pattern?

Bootstrap's default alert components use hardcoded colors that don't work with our theme system. This pattern provides:
- ✅ Theme-aware colors (Light, Dark, Dark+)
- ✅ Clear visual hierarchy with colored left borders
- ✅ Consistent styling across all components
- ✅ Better readability than full colored backgrounds

---

## Pattern at a Glance

### Visual Design
```
┌─────────────────────────────────────┐
│ ████ Content here                   │  ← 4px colored left border
│      Strong text in primary color   │  ← Secondary background
│      Regular text in primary color  │  ← 1px border all around
└─────────────────────────────────────┘
```

### Color Scheme
| Type | Border Color | Example Use |
|------|-------------|-------------|
| Info | Blue | "Next backup: Oct 29, 2025 at 8:00 AM" |
| Tip | Green | "Tip: Schedule backups during low-traffic hours" |
| Warning | Orange | "⚠️ Backups will be deleted after 30 days" |
| Error | Red | "Failed to save configuration" |

---

## Implementation (30 seconds)

### 1. Add to your CSS file:
```css
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
```

### 2. Use in JSX:
```jsx
<div className="your-component-info-alert">
  <strong>Info:</strong> Your message here
</div>
```

---

## Alert Types Template

Copy-paste this into your CSS file and replace `your-component` with your actual component name:

```css
/* ========== CUSTOM THEMED ALERTS ========== */

/* Info (Blue) */
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

/* Tip (Green) */
.your-component-tip-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-border-default) !important;
  border-left: 4px solid var(--color-success-emphasis) !important;
  color: var(--primary-text) !important;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.your-component-tip-alert strong {
  color: var(--primary-text) !important;
}

/* Warning (Orange) */
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

/* Error (Red) */
.your-component-error-alert {
  background-color: var(--secondary-bg) !important;
  background-image: none !important;
  background: var(--secondary-bg) !important;
  border: 1px solid var(--color-danger-muted) !important;
  border-left: 4px solid var(--color-danger-emphasis) !important;
  color: var(--color-danger-fg) !important;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}
```

---

## Key Rules

### ✅ DO
- Use component-scoped class names: `.backup-scheduler-info-alert`
- Include triple background declaration
- Use `!important` on all color properties
- Use theme variables for ALL colors

### ❌ DON'T
- Don't use Bootstrap's `.alert-*` classes
- Don't hardcode colors
- Don't forget the 4px left border
- Don't skip the `!important` flags

---

## Visual Example

To see this in action:
1. Navigate to **Settings → Backup & Restore → Configure Schedule**
2. Look at the blue "Next Scheduled Backup" box
3. Look at the orange "Retention Policy" box

---

## Complete Documentation

For full details, examples, and troubleshooting:
- **Full Guide:** `/ALERT_BOX_PATTERN.md`
- **System Docs:** `/THEME_SYSTEM_DOCUMENTATION.md` (Alert Box Pattern section)
- **Reference Code:** `/frontend/src/styles/backup.css` (lines 1025-1115)

---

## Already Using This Pattern

✅ Backup Scheduler
✅ User Manual
⬜ Your next component here!
