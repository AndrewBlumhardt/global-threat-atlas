# Config API Endpoint

**Route**: \/api/config\  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Returns Azure Maps configuration for the frontend application.
Primary model proxies to Function App `/api/config` so SWA does not need to store Maps key.

## 🔧 Function Details

### Request
\\\http
GET /api/config HTTP/1.1
Host: your-site.azurestaticapps.net
\\\

### Response
\\\json
{
  "azureMapsKey": "your-subscription-key",
  "storageAccountUrl": "https://sentinelmapsstore.blob.core.windows.net",
  "datasetsContainer": "datasets"
}
\\\

### Response Headers
- \Content-Type: application/json\
- \Access-Control-Allow-Origin: *\ (CORS enabled)

## 🔑 Environment Variables

Recommended in Static Web App settings:
- \FUNCTION_APP_BASE_URL\ - Function App base URL (example: `https://func-sentinel-activity-maps.azurewebsites.net`)
- \REQUIRE_FUNCTION_CONFIG_PROXY\ - Set `true` to block local SWA fallback and require Function-provided config

Optional SWA fallback settings:
- \AZURE_MAPS_SUBSCRIPTION_KEY\ - Used only if Function proxy is unavailable
- \STORAGE_ACCOUNT_URL\ - Optional fallback value
- \STORAGE_CONTAINER_DATASETS\ - Optional fallback value (default: "datasets")

## 🎨 Frontend Usage

\\\javascript
// Fetch configuration
const configResponse = await fetch('/api/config');
const config = await configResponse.json();

// Use Azure Maps key
const map = new atlas.Map('map-container', {
  authOptions: {
    authType: 'subscriptionKey',
    subscriptionKey: config.azureMapsKey
  }
});
\\\

## 📝 How It Works

1. API checks \FUNCTION_APP_BASE_URL\ and calls `FUNCTION_APP_BASE_URL/api/config`
2. If proxy succeeds, returns Function-provided config (preferred)
3. If proxy fails, falls back to local SWA app settings
4. Frontend uses returned key to authenticate with Azure Maps

Response includes `configSource` for verification:
- `function-proxy` when config was proxied from Function App
- `swa-fallback` when local SWA fallback was used
- `proxy-required-error` when strict mode is enabled and proxy is unavailable

## 🔐 Security Model

- Function App owns data access and can source Maps key from Function app settings or Key Vault.
- SWA config endpoint acts as a lightweight proxy.
- This avoids SWA managed identity/key-vault limitations for custom API code.

## 🔧 Troubleshooting

### Maps not loading?

**1. Verify proxy target is configured:**
\\\powershell
az staticwebapp appsettings list --name swa-sentinel-maps --resource-group rg-sentinel-activity-maps --query "properties.FUNCTION_APP_BASE_URL"
\\\

**2. Verify Function config endpoint responds:**
\\\powershell
curl https://func-sentinel-activity-maps.azurewebsites.net/api/config
\\\

**3. Check browser console for config API response:**
\\\powershell
fetch('/api/config').then(r => r.json()).then(c => {
  console.log('Maps key present:', !!c.azureMapsKey);
  console.log('Key length:', c.azureMapsKey?.length);
})
\\\

**Expected output:**
- \Key length: 84\


**4. If empty, troubleshoot:**
- Verify Function App has \AZURE_MAPS_SUBSCRIPTION_KEY\ or Key Vault setup
- Verify \FUNCTION_APP_BASE_URL\ is set correctly in SWA app settings
- Wait a few seconds for SWA to restart after updating settings
- Hard refresh browser (Ctrl+Shift+R)
- Check browser network tab: \/api/config\ response should include the key

### Maps showing 401 errors?
- Check Azure Maps subscription still has credit and S1 tier active
- Verify subscription key hasn't expired
- Check that APIs are enabled in Azure Maps resource
