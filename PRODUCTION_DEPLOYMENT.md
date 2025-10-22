# Production Deployment Guide

This guide covers deploying Sanbox to production and populating equipment types.

## Prerequisites

- Production server with Docker and Docker Compose installed
- Git installed on production server
- Domain name configured (optional, for SSL)
- Ports 80 and 443 open (for HTTP/HTTPS)

## Deployment Methods

### Method 1: Container-Based Deployment (Recommended)

This method uses the deployment script that pulls code from GitHub.

#### Step 1: Prepare Your Code

1. **Commit all your changes:**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Tag a release version:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

#### Step 2: Deploy to Production Server

1. **SSH into your production server:**
   ```bash
   ssh user@your-production-server.com
   ```

2. **Navigate to deployment directory:**
   ```bash
   cd /path/to/sanbox
   ```

3. **Run the deployment script:**
   ```bash
   # Deploy specific version
   ./deploy-container.sh v1.0.0

   # Or deploy latest from main branch
   ./deploy-container.sh
   ```

#### Step 3: Load Equipment Types

After deployment, you need to populate the equipment types:

1. **Copy the fixture file to production server:**
   ```bash
   # From your local machine
   scp equipment_types_fixture.json user@your-production-server.com:/path/to/sanbox/
   ```

2. **On production server, load the fixture:**
   ```bash
   docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
   ```

   Or if you need to copy it into the container first:
   ```bash
   docker cp equipment_types_fixture.json sanbox_backend:/app/
   docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
   ```

### Method 2: Manual Git Pull Deployment

If you prefer to manually control the deployment:

#### Step 1: On Production Server

1. **Clone or pull latest code:**
   ```bash
   cd /path/to/sanbox
   git pull origin main
   # Or for specific version
   git checkout v1.0.0
   ```

2. **Stop existing containers:**
   ```bash
   docker-compose down
   ```

3. **Build and start containers:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Run migrations:**
   ```bash
   docker-compose exec backend python manage.py migrate
   ```

5. **Collect static files:**
   ```bash
   docker-compose exec backend python manage.py collectstatic --noinput
   ```

6. **Create superuser (if needed):**
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

7. **Load equipment types fixture:**
   ```bash
   docker cp equipment_types_fixture.json sanbox_backend:/app/
   docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
   ```

## SSL/HTTPS Setup

After deployment, set up HTTPS for secure access.

### Option 1: Let's Encrypt (For Public Servers)

If your server is publicly accessible from the internet:

```bash
sudo ./setup-ssl.sh your-domain.com your-email@example.com
```

This will:
- Install Certbot
- Generate SSL certificates
- Configure nginx for HTTPS
- Set up automatic renewal

### Option 2: Self-Signed Certificate (For Internal/VPN Servers)

If your server is only accessible via VPN or private network:

```bash
sudo ./setup-ssl-selfsigned.sh your-internal-domain.com
```

This will:
- Generate a self-signed certificate (valid 365 days)
- Configure nginx for HTTPS
- Note: Browsers will show security warnings (this is normal)

## Equipment Types Management

### Exporting Equipment Types (From Development)

If you need to export current equipment types from development:

```bash
# Export to JSON fixture
docker-compose -f docker-compose.dev.yml exec backend python manage.py dumpdata core.EquipmentType --indent 2 --output /app/equipment_types_export.json

# Copy to host
docker cp sanbox_dev_backend:/app/equipment_types_export.json ./equipment_types_fixture.json
```

### Importing Equipment Types (To Production)

**Method 1: Using Import Script (Recommended)**

```bash
# Copy fixture to server
scp equipment_types_fixture.json user@production-server:/path/to/sanbox/

# On production server - auto-detects environment
./scripts/import-equipment-types.sh

```

**Method 2: Manual Import**

```bash
# Copy fixture to server
scp equipment_types_fixture.json user@production-server:/path/to/sanbox/

# On production server
docker cp equipment_types_fixture.json sanbox_backend:/app/
docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
```

### Adding New Equipment Types

#### Method 1: Via Django Admin (Recommended)

1. Access admin panel: `https://your-domain.com/admin/`
2. Navigate to: Core > Equipment types
3. Click "Add Equipment Type"
4. Fill in the details:
   - **Name**: Equipment name (e.g., "SAN Switch - Cisco")
   - **Category**: Select from compute/network/storage
   - **Vendor**: Manufacturer name
   - **Fields Schema**: JSON array of field definitions
   - **Display Order**: Numeric order for sorting
   - **Is Active**: Check to make it available

#### Method 2: Via Django Shell

```bash
docker-compose exec backend python manage.py shell
```

```python
from core.models import EquipmentType

# Create new equipment type
eq_type = EquipmentType.objects.create(
    name="New Switch Type",
    category="network",
    vendor="Vendor Name",
    display_order=10,
    is_active=True,
    icon_name="FaNetworkWired",
    fields_schema=[
        {
            "name": "switch_name",
            "type": "text",
            "label": "Switch Name",
            "required": True
        },
        {
            "name": "management_ip",
            "type": "text",
            "label": "Management IP",
            "required": True
        },
        # Add more fields...
    ]
)
eq_type.save()
```

### Field Schema Reference

The `fields_schema` is a JSON array defining what fields appear in the worksheet generator:

```json
[
  {
    "name": "field_name",          // Field identifier (snake_case)
    "type": "text",                 // Field type: text, textarea, number, select, date
    "label": "Display Label",       // Human-readable label
    "required": true,               // Whether field is required
    "options": ["opt1", "opt2"]    // For select fields only
  }
]
```

**Supported Field Types:**
- `text`: Single-line text input
- `textarea`: Multi-line text input
- `number`: Numeric input
- `select`: Dropdown with predefined options
- `date`: Date picker

**Special Field Names:**
- `management_ip`: Always positioned first after name fields
- `subnet_mask`, `default_gateway`, `vlan`: Network fields auto-positioned after management_ip
- `site_address`: Excluded from worksheets (handled at site level)

## Current Equipment Types

The fixture includes the following equipment types:

1. **SAN Switch - Cisco** (network)
   - Models: MDS 9148, 9396, 9710, 9718
   - 7 fields

2. **SAN Switch - Brocade** (network)
   - Models: G620, G630, G720, X6-4, X7-4, X7-8
   - 7 fields

3. **IBM FlashSystem** (storage)
   - Models: 5015, 5035, 5045, 5100, 5200, 7200, 9200, 9500
   - 8 fields

4. **IBM DS8000** (storage)
   - Models: DS8880, DS8900F
   - 8 fields

5. **Server** (compute)
   - Vendors: IBM, Dell, HP, Lenovo, Cisco
   - 9 fields

## Verification

After deployment, verify everything is working:

1. **Check container status:**
   ```bash
   docker ps
   ```

2. **Check logs:**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

3. **Access the application:**
   - HTTP: `http://your-domain.com`
   - HTTPS: `https://your-domain.com`

4. **Test worksheet generator:**
   - Go to Worksheet Generator page
   - Verify all 5 equipment types appear
   - Test creating a worksheet with different equipment

5. **Verify equipment types in admin:**
   - Go to `/admin/`
   - Navigate to Core > Equipment types
   - Confirm all 5 types are present

## Rollback

If something goes wrong, you can rollback to a previous version:

```bash
./rollback.sh v0.9.0
```

Or manually:

```bash
git checkout v0.9.0
docker-compose down
docker-compose up -d --build
```

## Updating Equipment Types in Production

If you add new equipment types in development and want to sync to production:

1. **Export from dev:**
   ```bash
   ./scripts/export-equipment-types.sh
   ```

2. **Review changes:**
   ```bash
   cat equipment_types_fixture.json
   ```

3. **Copy to production:**
   ```bash
   scp equipment_types_fixture.json user@prod-server:/path/to/sanbox/
   ```

4. **On production, backup existing data:**
   ```bash
   docker-compose exec backend python manage.py dumpdata core.EquipmentType > equipment_types_backup.json
   ```

5. **Load new fixture:**
   ```bash
   docker cp equipment_types_fixture.json sanbox_backend:/app/
   docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
   ```

## Troubleshooting

### Equipment Types Not Appearing

```bash
# Check if they exist in database
docker-compose exec backend python manage.py shell -c "from core.models import EquipmentType; print(EquipmentType.objects.count())"

# Check if they're active
docker-compose exec backend python manage.py shell -c "from core.models import EquipmentType; print(EquipmentType.objects.filter(is_active=True).count())"
```

### Fixture Load Errors

If you get errors loading the fixture, try:

```bash
# Clear existing equipment types first (CAUTION: This deletes all equipment types)
docker-compose exec backend python manage.py shell -c "from core.models import EquipmentType; EquipmentType.objects.all().delete()"

# Then load fixture again
docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json
```

### Database Issues

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Check for pending migrations
docker-compose exec backend python manage.py showmigrations
```

## Support

For issues or questions:
- Check logs: `docker-compose logs backend`
- Review documentation in `/CLAUDE.md`
- Check deployment scripts: `deploy-container.sh`, `setup-ssl.sh`
