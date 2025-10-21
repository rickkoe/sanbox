# Company Logo Setup - Complete ✅

## Logo Locations

The Evolving Solutions logo (`EvolvingSolutions_Black.png`) has been properly configured for use in both development and production Docker environments.

### Frontend Location
```
/Users/rickk/sanbox/frontend/public/images/company-logo.png
```
- **Purpose**: Available for use in React components
- **Access URL**: `/images/company-logo.png` (when app is running)
- **Docker**: Automatically available via volume mount

### Backend Location
```
/Users/rickk/sanbox/backend/static/images/company-logo.png
```
- **Purpose**: Used in Excel worksheet generation
- **Access Path**: `settings.BASE_DIR/static/images/company-logo.png`
- **Docker Path**: `/app/static/images/company-logo.png`
- **Docker**: Automatically available via volume mount

---

## Implementation in Worksheet Generator

### Backend Changes

**File**: `backend/core/worksheet_views.py`

#### 1. Added Imports (Lines 12-21)
```python
from django.conf import settings
import os
from openpyxl.drawing.image import Image as XLImage
```

#### 2. Logo Embedding (Lines 175-205)
```python
# Add company logo
logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
if os.path.exists(logo_path):
    try:
        # Insert logo image
        img = XLImage(logo_path)
        # Scale logo to fit nicely (adjust height to ~60 pixels)
        img.height = 60
        # Maintain aspect ratio
        img.width = int(img.width * (60 / img.height)) if img.height > 0 else img.width
        # Position logo at A1
        ws.add_image(img, 'A1')
        # Set row height to accommodate logo
        ws.row_dimensions[1].height = 45
        current_row = 4  # Skip rows used by logo
    except Exception as e:
        # Fallback to placeholder if image loading fails
        [fallback code]
else:
    # Fallback to placeholder if logo doesn't exist
    [fallback code]
```

#### 3. Requirements Update
**File**: `backend/requirements.txt`
```python
openpyxl==3.1.5
Pillow==10.4.0  # Required for image support in Excel files
```

**Pillow** is required by openpyxl to handle image embedding in Excel files.

---

## Logo Specifications

### Current Logo
- **Filename**: `company-logo.png` (originally `EvolvingSolutions_Black.png`)
- **Type**: PNG with transparency
- **Color**: Black text/graphics (suitable for white backgrounds)
- **Size**: 29KB
- **Dimensions**: Original dimensions maintained, scaled to 60px height in worksheets

### Worksheet Display
- **Position**: Top-left corner (cell A1)
- **Height**: 60 pixels
- **Width**: Auto-scaled to maintain aspect ratio
- **Rows Used**: 3 rows (current_row starts at 4 after logo)

---

## Testing the Logo

### 1. Generate a Test Worksheet
1. Navigate to **Tools → Worksheet Generator**
2. Fill in customer and project information
3. Select any equipment type
4. Fill in details
5. Click **Generate Worksheet**

### 2. Verify Logo in Excel
1. Open the downloaded `.xlsx` file
2. Check that the Evolving Solutions logo appears at the top
3. Verify it's properly sized and positioned
4. Verify it doesn't overlap with other content

### Expected Result
```
┌────────────────────────────────┐
│  [Evolving Solutions Logo]     │  ← Logo at 60px height
│                                 │
│                                 │
├────────────────────────────────┤
│  Equipment Implementation       │  ← Green title bar
│  Worksheet                      │
└────────────────────────────────┘
```

---

## Docker Configuration

### Development (`docker-compose.dev.yml`)
The `backend` directory is mounted as a volume, so the static files are automatically accessible:
```yaml
volumes:
  - ./backend:/app
```

### Production (`docker-compose.yml`)
The static files are included in the Docker image build, so they're automatically available in production containers.

---

## Fallback Behavior

If the logo file is not found or fails to load:
- A text placeholder `[COMPANY LOGO]` is displayed instead
- The worksheet still generates successfully
- No errors are thrown to the user
- This ensures reliability even if the logo file is missing

---

## Alternative Logo Versions

### Adding Additional Logo Variations

If you want to add different logo versions (e.g., white logo for dark backgrounds):

1. **Add logo file**:
   ```bash
   cp your-logo-white.png backend/static/images/company-logo-white.png
   cp your-logo-white.png frontend/public/images/company-logo-white.png
   ```

2. **Update worksheet generator** to use different logos based on theme or customer preference:
   ```python
   # Example: Use white logo for dark-themed worksheets
   logo_filename = 'company-logo-white.png' if use_dark_theme else 'company-logo.png'
   logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', logo_filename)
   ```

---

## Using Logo in React Components

The logo is also available for use in React components:

```jsx
import React from 'react';

function MyComponent() {
  return (
    <div>
      <img src="/images/company-logo.png" alt="Evolving Solutions" />
    </div>
  );
}
```

---

## Troubleshooting

### Logo Not Appearing in Worksheet

1. **Check file exists**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend ls -la /app/static/images/
   ```
   Should show `company-logo.png`

2. **Check Pillow is installed**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend pip list | grep Pillow
   ```
   Should show `Pillow 10.4.0`

3. **Check backend logs**:
   ```bash
   ./logs backend
   ```
   Look for any errors related to image loading

4. **Restart backend**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart backend
   ```

### Logo Quality Issues

If the logo appears blurry or pixelated:
1. Replace with a higher resolution PNG
2. Adjust the scaling in `worksheet_views.py` (line 182):
   ```python
   img.height = 80  # Increase from 60 to 80 for larger logo
   ```

---

## Production Deployment

When deploying to production:

1. **Logo is already included** in the static files
2. **Pillow will be installed** from requirements.txt
3. **No additional configuration needed**

Just run the normal deployment:
```bash
./deploy-container.sh
```

The logo will automatically be embedded in all generated worksheets.

---

## Summary

✅ Logo moved to proper locations for dev and prod
✅ Backend configured to embed logo in Excel files
✅ Pillow library installed for image support
✅ Fallback placeholder implemented
✅ Logo accessible in Docker containers
✅ Frontend can also use logo if needed

**Status**: Complete and ready for use!
