# Phase 4 & 5 - Quick Reference

## New API Endpoints

### Active Users
```bash
GET http://localhost:8000/api/core/active-users/
```
Returns list of users active in last 5 minutes with their active customer/project.

### Heartbeat
```bash
POST http://localhost:8000/api/core/heartbeat/
```
Updates user's last activity timestamp (requires authentication).

---

## Optimistic Locking - Request Format

When saving Zones or Aliases, **always include the version field**:

```json
{
  "project_id": 10,
  "zones": [
    {
      "id": 123,
      "name": "Zone_A",
      "version": 5,  // ⚠️ IMPORTANT: Include current version
      "members": [...]
    }
  ]
}
```

---

## Conflict Error Response

```json
{
  "error": "Some zones could not be saved.",
  "details": [
    {
      "zone": "Zone_A",
      "errors": {
        "version": "Conflict: This zone was modified by john at 2025-10-23 12:30:00. Please refresh and try again.",
        "current_version": 6,
        "last_modified_by": "john",
        "last_modified_at": "2025-10-23T12:30:00Z"
      }
    }
  ]
}
```

---

## Models with Optimistic Locking

| Model | Fields | Save Endpoint | Status |
|-------|--------|---------------|--------|
| **Zone** | `version`, `last_modified_by`, `last_modified_at` | POST `/api/san/zones/save/` | ✅ Implemented |
| **Alias** | `version`, `last_modified_by`, `last_modified_at` | POST `/api/san/aliases/save/` | ✅ Implemented |
| **Storage** | `version`, `last_modified_by`, `last_modified_at` | PUT `/api/storage/{id}/` | ✅ Already Working |
| **Host** | `version`, `last_modified_by`, `last_modified_at` | N/A (import only) | ℹ️ Fields exist |
| **Volume** | `version`, `last_modified_by`, `last_modified_at` | N/A (import only) | ℹ️ Fields exist |

---

## Testing

### Test Active Users API
```bash
curl http://localhost:8000/api/core/active-users/ | python3 -m json.tool
```

### Test Heartbeat API
Requires session cookie - test via browser DevTools Console:
```javascript
fetch('/api/core/heartbeat/', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log);
```

### Test Optimistic Locking
1. Open two browser windows
2. Both load the same zone (version N)
3. Window 1 saves → version becomes N+1
4. Window 2 tries to save with version N → **CONFLICT ERROR**

---

## File Locations

| File | What's There |
|------|--------------|
| [backend/core/views.py:2012-2092](backend/core/views.py#L2012-L2092) | `active_users_view()` and `heartbeat_view()` |
| [backend/core/urls.py:111-112](backend/core/urls.py#L111-L112) | URL routes for new endpoints |
| [backend/san/views.py:1602-1632](backend/san/views.py#L1602-L1632) | Alias optimistic locking |
| [backend/san/views.py:1959-1989](backend/san/views.py#L1959-L1989) | Zone optimistic locking |
| [backend/storage/views.py:250-274](backend/storage/views.py#L250-L274) | Storage optimistic locking |

---

## Frontend TODO

### 1. Heartbeat Polling
Add to `App.js`:
```javascript
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/api/core/heartbeat/', { method: 'POST', credentials: 'include' });
  }, 30000);  // Every 30 seconds
  return () => clearInterval(interval);
}, []);
```

### 2. Include Version in Saves
When saving zones/aliases:
```javascript
const saveData = {
  ...zoneData,
  version: zoneData.version  // Don't forget this!
};
```

### 3. Handle Conflicts
```javascript
if (response.data.details) {
  const conflicts = response.data.details.filter(d => d.errors?.version);
  if (conflicts.length > 0) {
    showConflictDialog(conflicts[0].errors);
  }
}
```

---

## Documentation

- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Quick overview
- **[PHASE_4_5_IMPLEMENTATION.md](PHASE_4_5_IMPLEMENTATION.md)** - Full details
- **[COMPLETED_CHANGES.md](COMPLETED_CHANGES.md)** - Phases 1-3
- **[test_optimistic_locking.py](test_optimistic_locking.py)** - Test script

---

**Status**: ✅ Backend Complete - Frontend Integration Needed
