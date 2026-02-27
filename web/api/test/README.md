# Test API Endpoint

**Route**: `/api/test`  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

API functionality test endpoint for debugging and development. Returns confirmation message.

## 📄 Files

- `__init__.py` - Function implementation
- `function.json` - Function binding configuration

## 🔧 Function Details

### Request
```http
GET /api/test HTTP/1.1
Host: your-site.azurestaticapps.net
```

### Response
```json
{
  "message": "Test endpoint working"
}
```

### Response Headers
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS enabled)

### Status Codes
- **200 OK**: Always returns success

## 🎯 Usage

```bash
# Test API availability
curl https://your-site.azurestaticapps.net/api/test

# Integration testing
curl -f https://your-site.azurestaticapps.net/api/test && echo "✓ API test passed"
```

## 📝 Notes

- Similar to `/api/simple` but distinct for testing purposes
- Can be extended to include environment information
- Useful for CI/CD pipeline verification
