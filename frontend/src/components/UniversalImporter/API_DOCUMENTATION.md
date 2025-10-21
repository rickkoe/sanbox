# Universal Importer - API Documentation

Complete API reference for the Universal Importer backend endpoints.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Parse Preview](#parse-preview)
   - [Import SAN Config](#import-san-config)
   - [Import Progress](#import-progress)
   - [Import Logs](#import-logs)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [WebSocket Events](#websocket-events)
7. [Rate Limiting](#rate-limiting)

---

## Overview

The Universal Importer API provides endpoints for importing SAN configuration data from various vendors (Cisco, Brocade) into the database.

**Base URL**: `/api/importer/`

**Content Type**: `application/json`

**Authentication**: Session-based (Django authentication)

---

## Authentication

All API endpoints require authentication. The frontend automatically includes session credentials.

```javascript
// Axios automatically includes cookies
axios.post('/api/importer/import-san-config/', data);
```

---

## Endpoints

### Parse Preview

**Endpoint**: `POST /api/importer/parse-preview/`

**Purpose**: Parse and preview data before importing

**Request Body**:
```json
{
  "data": "string",           // Raw text data to parse
  "import_type": "san"        // Type of import (currently only "san")
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "preview": {
    "aliases": [
      {
        "name": "string",
        "wwpn": "string",
        "exists": false
      }
    ],
    "zones": [
      {
        "name": "string",
        "members": ["string"],
        "exists": false
      }
    ],
    "fabrics": [
      {
        "name": "string",
        "vsan": 100
      }
    ],
    "metadata": {
      "vendor": "cisco|brocade",
      "total_aliases": 100,
      "total_zones": 50,
      "total_fabrics": 1
    }
  },
  "conflicts": {
    "aliases": ["alias1", "alias2"],
    "zones": ["zone1", "zone2"]
  }
}
```

**Error Response** (400):
```json
{
  "error": "Invalid data format",
  "details": "Expected Cisco or Brocade configuration format"
}
```

---

### Import SAN Config

**Endpoint**: `POST /api/importer/import-san-config/`

**Purpose**: Start the import process for SAN configuration

**Request Body**:
```json
{
  "customer_id": 1,                    // Customer ID (required)
  "data": "string",                     // Configuration data (required)
  "fabric_id": 1,                       // Existing fabric ID (optional)
  "fabric_name": "Production_Fabric",   // New fabric name (optional)
  "create_new_fabric": false,           // Create new fabric flag
  "selected_items": {                   // Items to import (optional)
    "aliases": ["alias1", "alias2"],
    "zones": ["zone1", "zone2"],
    "fabrics": ["fabric1"]
  },
  "conflict_resolutions": {              // How to resolve conflicts
    "alias1": "skip|overwrite|rename",
    "zone1": "skip|overwrite|merge"
  },
  "project_id": 1                       // Project ID (optional)
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "SAN import started",
  "import_id": 123,
  "task_id": "celery-task-uuid-here"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "customer_id required"
}
```

---

### Import Progress

**Endpoint**: `GET /api/importer/import-progress/<import_id>/`

**Purpose**: Get real-time progress of an import job

**URL Parameters**:
- `import_id`: Integer ID of the import job

**Response** (200 OK):

#### During Import (Running State):
```json
{
  "import_id": 123,
  "status": "running",
  "started_at": "2024-10-20T12:00:00Z",
  "completed_at": null,
  "duration": null,
  "error_message": null,
  "progress": {
    "current": 150,
    "total": 300,
    "message": "Processing zone: PROD_ZONE_150"
  }
}
```

#### After Completion (Success):
```json
{
  "import_id": 123,
  "status": "completed",
  "started_at": "2024-10-20T12:00:00Z",
  "completed_at": "2024-10-20T12:03:45Z",
  "duration": "0:00:03.450123",
  "error_message": null,
  "aliases_imported": 320,
  "zones_imported": 340,
  "fabrics_created": 1,
  "stats": {
    "aliases_created": 320,
    "zones_created": 340,
    "fabrics_created": 1,
    "fabrics_updated": 0,
    "processing_time": 3.45
  }
}
```

#### After Failure:
```json
{
  "import_id": 123,
  "status": "failed",
  "started_at": "2024-10-20T12:00:00Z",
  "completed_at": "2024-10-20T12:00:15Z",
  "duration": "0:00:15.123456",
  "error_message": "Database connection failed",
  "aliases_imported": 0,
  "zones_imported": 0,
  "fabrics_created": 0
}
```

**Status Values**:
- `pending`: Import queued but not started
- `running`: Import in progress
- `completed`: Import finished successfully
- `failed`: Import failed with error

---

### Import Logs

**Endpoint**: `GET /api/importer/logs/<import_id>/`

**Purpose**: Retrieve detailed logs for an import job

**URL Parameters**:
- `import_id`: Integer ID of the import job

**Query Parameters**:
- `limit`: Maximum number of log entries (default: 100)
- `since`: ISO timestamp to get logs after
- `level`: Filter by log level (DEBUG|INFO|WARNING|ERROR)

**Request Example**:
```
GET /api/importer/logs/123/?limit=50&since=2024-10-20T12:00:00Z&level=ERROR
```

**Response** (200 OK):
```json
{
  "logs": [
    {
      "timestamp": "2024-10-20T12:00:01.123Z",
      "level": "INFO",
      "message": "Starting SAN import for customer ABC Corp",
      "extra_data": {}
    },
    {
      "timestamp": "2024-10-20T12:00:02.456Z",
      "level": "INFO",
      "message": "Processing 320 aliases",
      "extra_data": {
        "count": 320
      }
    },
    {
      "timestamp": "2024-10-20T12:00:05.789Z",
      "level": "WARNING",
      "message": "Duplicate alias found: SERVER_01_HBA1",
      "extra_data": {
        "alias_name": "SERVER_01_HBA1",
        "action": "skipped"
      }
    },
    {
      "timestamp": "2024-10-20T12:00:10.123Z",
      "level": "ERROR",
      "message": "Failed to create zone: INVALID_ZONE",
      "extra_data": {
        "zone_name": "INVALID_ZONE",
        "error": "Invalid characters in zone name"
      }
    }
  ],
  "total_count": 150,
  "has_more": true
}
```

---

## Data Models

### StorageImport Model

```python
{
  "id": "integer",
  "customer": "foreign_key",
  "status": "string",  # pending|running|completed|failed
  "started_at": "datetime",
  "completed_at": "datetime",
  "celery_task_id": "string",
  "storage_systems_imported": "integer",
  "volumes_imported": "integer",
  "hosts_imported": "integer",
  "error_message": "text",
  "api_response_summary": {
    "import_type": "san_config",
    "stats": {
      "aliases_created": 320,
      "zones_created": 340,
      "fabrics_created": 1
    },
    "metadata": {
      "vendor": "cisco",
      "processing_time": 3.45
    }
  }
}
```

### Import Stats Structure

```javascript
{
  "aliases_created": 320,      // New aliases added
  "aliases_updated": 10,       // Existing aliases modified
  "aliases_skipped": 5,        // Duplicates skipped
  "zones_created": 340,        // New zones added
  "zones_updated": 20,         // Existing zones modified
  "zones_skipped": 3,          // Duplicates skipped
  "fabrics_created": 1,        // New fabrics created
  "fabrics_updated": 0,        // Existing fabrics modified
  "processing_time": 3.45,     // Time in seconds
  "total_items": 665,          // Total items processed
  "errors": 0                  // Number of errors
}
```

---

## Error Handling

### Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Brief error message",
  "details": "Detailed error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-10-20T12:00:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_DATA` | 400 | Data format not recognized |
| `CUSTOMER_NOT_FOUND` | 404 | Customer ID doesn't exist |
| `IMPORT_NOT_FOUND` | 404 | Import ID doesn't exist |
| `PARSE_ERROR` | 400 | Failed to parse configuration |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `CELERY_ERROR` | 500 | Background task failed |
| `PERMISSION_DENIED` | 403 | User lacks permission |
| `RATE_LIMITED` | 429 | Too many requests |

### Error Handling Example

```javascript
try {
  const response = await axios.post('/api/importer/import-san-config/', data);
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Error:', error.response.data.error);
    console.error('Details:', error.response.data.details);

    switch(error.response.status) {
      case 400:
        // Bad request - check data format
        break;
      case 404:
        // Resource not found
        break;
      case 500:
        // Server error - retry later
        break;
    }
  } else if (error.request) {
    // Network error - no response
    console.error('Network error:', error.message);
  }
}
```

---

## WebSocket Events

The import process can optionally use WebSocket for real-time updates.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/import/');

ws.onopen = () => {
  // Subscribe to import updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    import_id: 123
  }));
};
```

### Event Types

#### Progress Update
```json
{
  "type": "progress",
  "import_id": 123,
  "current": 150,
  "total": 300,
  "message": "Processing zone: PROD_ZONE_150"
}
```

#### Status Change
```json
{
  "type": "status_change",
  "import_id": 123,
  "old_status": "running",
  "new_status": "completed"
}
```

#### Error Event
```json
{
  "type": "error",
  "import_id": 123,
  "error": "Database connection lost",
  "severity": "critical"
}
```

---

## Rate Limiting

API endpoints are rate limited to prevent abuse.

### Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| Parse Preview | 10 requests | 1 minute |
| Import SAN Config | 5 requests | 5 minutes |
| Import Progress | 60 requests | 1 minute |
| Import Logs | 30 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1697812800
```

### Rate Limit Response (429)

```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60,
  "limit": 10,
  "window": "1 minute"
}
```

---

## Backend Implementation Notes

### Celery Task Flow

1. **Task Creation**: `run_san_import_task` in `importer/tasks.py`
2. **Processing**: `ImportOrchestrator` in `importer/import_orchestrator.py`
3. **Progress Updates**: `self.update_state()` in Celery task
4. **Completion**: Updates `StorageImport` model with results

### Database Transactions

- Each import runs in a transaction
- Rollback on failure to maintain consistency
- Batch inserts for performance (100 items at a time)

### Performance Considerations

- Large imports (>10,000 items) are chunked
- Progress updates every 2 seconds
- Database indexes on frequently queried fields

---

## Testing

### Test Import Data

```python
# Minimal valid import request
{
  "customer_id": 1,
  "data": "alias name SERVER_01_HBA1 10:00:00:00:00:00:00:01",
  "create_new_fabric": true,
  "fabric_name": "TEST_FABRIC"
}
```

### cURL Examples

```bash
# Start import
curl -X POST http://localhost:8000/api/importer/import-san-config/ \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionid=..." \
  -d '{"customer_id": 1, "data": "..."}'

# Check progress
curl http://localhost:8000/api/importer/import-progress/123/ \
  -H "Cookie: sessionid=..."

# Get logs
curl "http://localhost:8000/api/importer/logs/123/?limit=10" \
  -H "Cookie: sessionid=..."
```

### Postman Collection

Import the [Postman collection](./postman/universal-importer.json) for complete API testing.

---

## Changelog

### Version 2.0.1 (October 2024)
- Added `aliases_imported`, `zones_imported`, `fabrics_created` to progress response
- Fixed stats extraction from `api_response_summary`
- Improved error messages

### Version 2.0.0 (January 2025)
- Initial release of Universal Importer API
- Support for Cisco and Brocade formats
- Real-time progress tracking

---

**Last Updated**: October 2024
**API Version**: 2.0.1
**Maintained By**: Sanbox Development Team