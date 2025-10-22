# Scripts Directory

This directory contains utility scripts for managing the Sanbox application.

## Equipment Type Management Scripts

### export-equipment-types.sh

**Purpose:** Export equipment types from development database to a JSON fixture file.

**Usage:**
```bash
./scripts/export-equipment-types.sh
```

**Output:** Creates `equipment_types_fixture.json` in project root

**What it does:**
- Exports all equipment types from dev database
- Shows summary of what was exported
- Provides next steps for importing to production

**Requirements:**
- Development containers must be running (`./start`)

---

### import-equipment-types.sh

**Purpose:** Import equipment types from fixture file (auto-detects dev/prod environment).

**Usage:**
```bash
# Use default fixture file (equipment_types_fixture.json)
./scripts/import-equipment-types.sh

# Use custom fixture file
./scripts/import-equipment-types.sh /path/to/custom_fixture.json
```

**What it does:**
- Auto-detects if you're in development or production
- In production: Creates backup before import (recommended)
- Asks for confirmation before proceeding
- Imports equipment types from fixture
- Verifies import was successful

**Environment Detection:**
- Checks for `sanbox_dev_backend` container → DEVELOPMENT
- Checks for `sanbox_backend` container → PRODUCTION

**Safety Features:**
- Production warning and confirmation
- Automatic backup creation
- Shows what will be imported before proceeding

---

### import-equipment-types-prod.sh

**Purpose:** Import equipment types specifically to PRODUCTION (no auto-detection).

**Usage:**
```bash
# Use default fixture file
./scripts/import-equipment-types-prod.sh

# Use custom fixture file
./scripts/import-equipment-types-prod.sh /path/to/custom_fixture.json
```

**What it does:**
- Forces production environment (no dev detection)
- Always asks for backup confirmation
- Imports equipment types from fixture
- Verifies import was successful

**When to use:**
- When you want to ensure you're importing to production only
- When `import-equipment-types.sh` auto-detection isn't working
- When you want explicit production-only import

**Safety Features:**
- Production-only (won't run on dev)
- Automatic backup creation
- Confirmation prompts

---

## Common Workflows

### Development → Production Sync

1. **Export from development:**
   ```bash
   ./scripts/export-equipment-types.sh
   ```

2. **Copy to production server:**
   ```bash
   scp equipment_types_fixture.json user@prod-server:/path/to/sanbox/
   ```

3. **Import on production:**
   ```bash
   # On production server
   ./scripts/import-equipment-types-prod.sh
   ```

### Testing Equipment Type Changes

1. **Make changes in dev** (via Django admin or shell)

2. **Export and test:**
   ```bash
   ./scripts/export-equipment-types.sh
   cat equipment_types_fixture.json  # Review changes
   ```

3. **Re-import to verify:**
   ```bash
   ./scripts/import-equipment-types.sh
   ```

### Rollback Equipment Types

1. **If backup exists:**
   ```bash
   ./scripts/import-equipment-types.sh equipment_types_backup_20251021_140530.json
   ```

## Container Names Reference

### Development
- Backend: `sanbox_dev_backend`
- Compose file: `docker-compose.dev.yml`

### Production
- Backend: `sanbox_backend`
- Compose file: `docker-compose.yml`

## Troubleshooting

### "No running backend container found"

**Solution:**
```bash
# Check which containers are running
docker ps | grep sanbox

# Start development
./start

# Or start production
docker-compose up -d
```

### "Fixture file not found"

**Solution:**
```bash
# Make sure you've exported first
./scripts/export-equipment-types.sh

# Or specify full path
./scripts/import-equipment-types.sh /full/path/to/fixture.json
```

### Import fails with database errors

**Solution:**
```bash
# Check if backend is healthy
docker ps

# Check backend logs
docker-compose logs backend

# Try running migrations first
docker-compose exec backend python manage.py migrate
```

### Wrong environment detected

**Solution:**
```bash
# Use environment-specific script
./scripts/import-equipment-types-prod.sh  # For production only

# Or check which containers are running
docker ps --format '{{.Names}}' | grep sanbox
```

## Script Details

All scripts:
- Are located in `scripts/` directory
- Are executable (`chmod +x`)
- Use bash shell
- Include error handling (`set -e`)
- Provide helpful error messages
- Show progress and confirmations

## Adding New Scripts

When adding new scripts to this directory:

1. Use bash shebang: `#!/bin/bash`
2. Add description header
3. Use `set -e` for error handling
4. Make executable: `chmod +x script.sh`
5. Update this README
6. Test in both dev and prod (if applicable)
