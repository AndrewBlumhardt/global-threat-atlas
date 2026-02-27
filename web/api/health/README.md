# Health API Endpoint

**Route**: `/api/health`  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Simple health check endpoint to verify the API is running and responsive. Used for monitoring and load balancer health probes.

## 📄 Files

- `__init__.py` - Function implementation
- `function.json` - Function binding configuration

## 🔧 Function Details

### Request
```http
GET /api/health HTTP/1.1
Host: your-site.azurestaticapps.net
```

### Response
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T01:23:45.123456"
}
```

### Response Headers
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS enabled)

### Status Codes
- **200 OK**: API is healthy and operational

## 🎯 Usage

### Frontend Monitoring
```javascript
async function checkApiHealth() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    console.log('API Status:', health.status);
    return health.status === 'healthy';
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}
```

### External Health Probes
```bash
# Check API availability
curl https://your-site.azurestaticapps.net/api/health

# Monitor with HTTP status
curl -f https://your-site.azurestaticapps.net/api/health || echo "API down"
```

## 📝 Notes

- Lightweight endpoint (minimal processing)
- No dependencies on external services
- Returns quickly for load balancer health checks
- Timestamp in ISO 8601 format (UTC)
