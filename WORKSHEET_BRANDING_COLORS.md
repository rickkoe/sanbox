# Worksheet Generator - Company Branding Colors

## Color Palette Applied ✅

The worksheet generator now uses your company's official branding colors throughout the Excel worksheets.

### Color Scheme

| Color | Hex Code | Usage |
|-------|----------|-------|
| **Dark Gray** | `#505050` | Section headers (dark background), all text |
| **Light Gray** | `#B3B3B3` | Subheaders background, borders |
| **Green** | `#A2CA62` | Primary accent (main title background) |
| **Blue** | `#64CAE6` | Secondary accent (data table headers) |
| **White** | `#FFFFFF` | Text on dark backgrounds, general backgrounds |

---

## Where Colors Are Used

### 1. Main Title
- **Background**: Green (`#A2CA62`)
- **Text**: White (`#FFFFFF`)
- **Effect**: Bold, 16pt, creates strong branding presence

### 2. Section Headers (Project Information, Contact Information, Equipment Type Details)
- **Background**: Light Gray (`#B3B3B3`)
- **Text**: Dark Gray (`#505050`)
- **Effect**: Subtle, professional section separators

### 3. Data Table Headers (Column Names)
- **Background**: Blue (`#64CAE6`)
- **Text**: White (`#FFFFFF`)
- **Effect**: Clear data table identification with secondary brand color

### 4. Labels and Body Text
- **Text**: Dark Gray (`#505050`)
- **Font**: Calibri 11pt regular or bold
- **Effect**: Consistent, readable text throughout

### 5. Borders
- **Color**: Light Gray (`#B3B3B3`)
- **Style**: Thin borders on all data cells
- **Effect**: Clean table structure without being too bold

### 6. Alternating Row Colors
- **Even rows**: White (`#FFFFFF`)
- **Odd rows**: Very Light Gray (`#F5F5F5` - derived, very subtle)
- **Effect**: Improved readability in data tables

---

## Visual Hierarchy

```
┌─────────────────────────────────────────┐
│  [COMPANY LOGO PLACEHOLDER]             │  ← Dark Gray text
├─────────────────────────────────────────┤
│  Equipment Implementation Worksheet     │  ← GREEN background, white text
├─────────────────────────────────────────┤
│  Project Information                    │  ← Light Gray background, dark text
│  Customer: ...                          │  ← Dark Gray text
│  Project: ...                           │
│  Date: ...                              │
├─────────────────────────────────────────┤
│  Contact Information                    │  ← Light Gray background
│  Name: ...                              │  ← Dark Gray text
│  Email: ...                             │
├─────────────────────────────────────────┤
│  SAN Switch - Cisco Details             │  ← Light Gray background
│ ┌────────────┬──────────┬──────────┐   │
│ │ Switch Name│ Mgmt IP  │ Model    │   │  ← BLUE headers, white text
│ ├────────────┼──────────┼──────────┤   │
│ │ SW01       │ 10.0.0.1 │ MDS 9396 │   │  ← White background, dark text
│ │ SW02       │ 10.0.0.2 │ MDS 9396 │   │  ← Light gray background (alternating)
│ └────────────┴──────────┴──────────┘   │
└─────────────────────────────────────────┘
```

---

## Changes Made to `worksheet_views.py`

### Line 145-168: Color Definitions
```python
# Define styles - Company Branding Colors
# Color Palette:
# #505050 - Dark Gray (headers, text)
# #b3b3b3 - Light Gray (subheaders, borders)
# #a2ca62 - Green (primary accent)
# #64cae6 - Blue (secondary accent)
# #ffffff - White (backgrounds, text on dark)

header_font = Font(name='Calibri', size=14, bold=True, color='FFFFFF')
header_fill = PatternFill(start_color='505050', end_color='505050', fill_type='solid')
subheader_font = Font(name='Calibri', size=12, bold=True, color='505050')
subheader_fill = PatternFill(start_color='B3B3B3', end_color='B3B3B3', fill_type='solid')
accent_green_fill = PatternFill(start_color='A2CA62', end_color='A2CA62', fill_type='solid')
accent_blue_fill = PatternFill(start_color='64CAE6', end_color='64CAE6', fill_type='solid')
normal_font = Font(name='Calibri', size=11, color='505050')
bold_font = Font(name='Calibri', size=11, bold=True, color='505050')
```

### Line 163-168: Borders
```python
thin_border = Border(
    left=Side(style='thin', color='B3B3B3'),
    right=Side(style='thin', color='B3B3B3'),
    top=Side(style='thin', color='B3B3B3'),
    bottom=Side(style='thin', color='B3B3B3')
)
```

### Line 180-187: Main Title (Green Accent)
```python
# Add title with green accent
ws.merge_cells(f'A{current_row}:D{current_row}')
cell = ws[f'A{current_row}']
cell.value = "Equipment Implementation Worksheet"
cell.font = Font(name='Calibri', size=16, bold=True, color='FFFFFF')
cell.fill = accent_green_fill  # Green accent for title
cell.alignment = center_alignment
```

### Line 264-274: Table Headers (Blue Accent)
```python
# Column headers row - Blue accent
for col_idx, field in enumerate(fields, start=1):
    cell = ws.cell(row=current_row, column=col_idx)
    label = field.replace('_', ' ').title()
    cell.value = label
    cell.font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    cell.fill = accent_blue_fill  # Blue accent for data headers
    cell.alignment = center_alignment
    cell.border = thin_border
```

---

## Testing the Updated Branding

1. Navigate to **Tools → Worksheet Generator**
2. Fill in project information
3. Select any equipment type
4. Fill in equipment details
5. Click **Generate Worksheet**
6. Open the downloaded Excel file
7. **Verify**:
   - Main title has green background (`#A2CA62`)
   - Section headers have light gray background (`#B3B3B3`)
   - Data table headers have blue background (`#64CAE6`)
   - All text is dark gray (`#505050`)
   - Borders are light gray (`#B3B3B3`)
   - Professional, branded appearance

---

## Notes

- Colors are specified without the `#` prefix in openpyxl (e.g., `'A2CA62'` instead of `'#A2CA62'`)
- All colors are applied consistently across the entire worksheet
- The alternating row color (`#F5F5F5`) is a very subtle light gray for better readability - it complements the palette without detracting from the brand colors
- White (`#FFFFFF`) is used for backgrounds and text on colored backgrounds to ensure maximum readability

---

## Future Enhancement Ideas

1. **Add company logo** - When you have the logo file, it can be embedded in the placeholder area
2. **Footer with branding** - Add company name, website, or contact info in footer using brand colors
3. **Custom themes** - Allow users to select different color schemes while maintaining brand consistency
4. **Export as PDF** - Generate PDF versions with the same branding

---

**Status**: ✅ Company branding colors fully applied to all worksheet exports!
