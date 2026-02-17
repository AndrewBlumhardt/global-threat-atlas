# Config API Endpoint

**Route**: \/api/config\  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Returns Azure Maps configuration for the frontend application, including subscription key and default settings.

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

Required in Static Web App settings:
- \AZURE_MAPS_SUBSCRIPTION_KEY\ - Azure Maps subscription key (actual value, not encrypted)
- \STORAGE_ACCOUNT_URL\ - Blob storage URL
- \STORAGE_CONTAINER_DATASETS\ - Container name (default: "datasets")

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

1. API reads \AZURE_MAPS_SUBSCRIPTION_KEY\ from SWA app settings
2. Returns the key in the JSON response
3. Frontend uses the key to authenticate with Azure Maps
4. Maps library handles authentication via the subscription key

## ⚠️ Important: Why Not Key Vault?

Azure Static Web Apps has a limitation:
- **SWA doesn't auto-resolve Key Vault references** (\@Microsoft.KeyVault(...)\) in custom app settings
- Only built-in authentication settings leverage Key Vault references
- Custom APIs in SWA cannot use \DefaultAzureCredential()\ and REST API with MI is unreliable

**Solution**: Store the Maps subscription key as a plain value in SWA app settings because:
1. It's not a sensitive credential (rate-limited and publicly available)
2. It can be rotated independently in Azure Maps
3. Azure Maps service controls which APIs are enabled
4. Simplifies deployment and avoids SWA MI limitations

*Note: For other sensitive data (storage connection string, secrets), use app settings or managed identity where possible.*

## 🔧 Troubleshooting

### Maps not loading?

**1. Verify app settings have the key:**
\\\powershell
az staticwebapp appsettings list --name swa-sentinel-maps --resource-group rg-sentinel-activity-maps --query "properties.AZURE_MAPS_SUBSCRIPTION_KEY"
\\\

**2. Check browser console for config API response:**
\\\javascript
fetch('/api/config').then(r => r.json()).then(c => {
  console.log('Maps key present:', !!c.azureMapsKey);
  console.log('Key length:', c.azureMapsKey?.length);
  console.log('First 10 chars:', c.azureMapsKey?.substring(0, 10));
})
\\\

**Expected output:**
- \Key length: 84\
- First 10 chars: alphanumeric (e.g., "8fyBIXhcvT")

**3. If empty, troubleshoot:**
- Verify \AZURE_MAPS_SUBSCRIPTION_KEY\ is set in SWA app settings
- Wait a few seconds for SWA to restart after updating settings
- Hard refresh browser (Ctrl+Shift+R)
- Check browser network tab: \/api/config\ response should include the key

### Maps showing 401 errors?
- Check Azure Maps subscription still has credit and S1 tier active
- Verify subscription key hasn't expired
- Check that APIs are enabled in Azure Maps resource
