# Simple API Endpoint

**Route**: `/api/simple`  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Basic test endpoint for API debugging and verification. Returns a simple message to confirm the API is functional.

## 📄 Files

- `__init__.py` - Function implementation
- `function.json` - Function binding configuration

## 🔧 Function Details

### Request
```http
GET /api/simple HTTP/1.1
Host: your-site.azurestaticapps.net
```

### Response
```json
{
  "message": "This HTTP triggered function executed successfully."
}
```

### Response Headers
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS enabled)

### Status Codes
- **200 OK**: Always returns success

## 🎯 Usage

### Quick API Test
```bash
# Test API responsiveness
curl https://your-site.azurestaticapps.net/api/simple

# Verify JSON response
curl -s https://your-site.azurestaticapps.net/api/simple | jq .
```

### Frontend Testing
```javascript
// Verify API is reachable
async function testApi() {
  const response = await fetch('/api/simple');
  const data = await response.json();
  console.log('API Test:', data.message);
}
```

## 📝 Notes

- Minimal endpoint for testing deployment
- No dependencies or complex logic
- Useful for troubleshooting routing or CORS issues
- Can be used as a template for new API endpoints
