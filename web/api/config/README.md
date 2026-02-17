# Config API Endpoint

**Route**: `/api/config`  
**Methods**: GET  
**Authentication**: Anonymous (public)

## 📋 Purpose

Returns Azure Maps configuration for the frontend application, including subscription key and default settings.

## 📄 Files

- `__init__.py` - Function implementation
- `function.json` - Function binding configuration

## 🔧 Function Details

### Request
```http
GET /api/config HTTP/1.1
Host: your-site.azurestaticapps.net
```

### Response
```json
{
  "azureMapsKey": "your-subscription-key",
  "storageAccountUrl": "https://sentinelmapsstore.blob.core.windows.net",
  "datasetsContainer": "datasets"
}
```

### Response Headers
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS enabled)

## 🔑 Environment Variables

Required in Static Web App settings:
- `KEY_VAULT_NAME` - Azure Key Vault name (for retrieving Azure Maps key)
- `STORAGE_ACCOUNT_URL` - Blob storage URL
- `STORAGE_CONTAINER_DATASETS` - Container name (default: "datasets")

## 🔐 Secrets Management

**Key Vault Secrets** (accessed via REST API + Managed Identity):
- `AZURE-MAPS-SUBSCRIPTION-KEY` - Azure Maps subscription key

**Fallback** (if Key Vault unavailable):
- `AZURE_MAPS_SUBSCRIPTION_KEY` - Azure Maps subscription key from app settings

## 🎨 Frontend Usage

```javascript
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
```

## 📝 Implementation Details

### How It Works

1. **REST API Approach**: Uses Key Vault REST API instead of SDK because:
   - SWA custom code cannot use `DefaultAzureCredential()`
   - SWA MSI is only available via HTTP endpoint, not as environment credential
   - Reference strings (`@Microsoft.KeyVault(...)`) are NOT auto-resolved for custom app settings

2. **Retrieval Steps**:
   - Get MI token from `IDENTITY_ENDPOINT` (provided by SWA)
   - Call `https://{vault}.vault.azure.net/secrets/AZURE-MAPS-SUBSCRIPTION-KEY?api-version=7.4` with Bearer token
   - Return actual secret value to frontend

3. **Fallback Behavior**:
   - If REST API fails, try `AZURE_MAPS_SUBSCRIPTION_KEY` app setting
   - Check if value is actual key or KV reference string
   - Log status with visual indicators (✅, ⚠️, ❌)

## 🔧 Troubleshooting

### Maps not loading? Verify key retrieval in browser console:

```javascript
fetch('/api/config').then(r => r.json()).then(c => {
  console.log('Maps key:', c.azureMapsKey);
  console.log('Key length:', c.azureMapsKey?.length);
  console.log('First 10 chars:', c.azureMapsKey?.substring(0, 10));
})
```

**Expected output:**
- `azureMapsKey`: Actual subscription key (84 chars, starts with alphanumeric)
- `length`: 84
- First 10 chars: alphanumeric (e.g., "8fyBIXhcvT")

**If shows `@Microsoft.KeyVault(...)`**: REST API failed, fallback to app setting

### Common Issues

**1. MSI endpoint not available**
- `IDENTITY_ENDPOINT` env var missing
- Verify SWA Managed Identity enabled: 
  ```powershell
  az staticwebapp identity show --name swa-sentinel-maps --resource-group rg-sentinel-activity-maps
  ```

**2. Key Vault access denied**
- SWA MI missing "Key Vault Secrets User" role
  ```powershell
  $swaPrincipalId = az staticwebapp identity show --name swa-sentinel-maps --resource-group rg-sentinel-activity-maps --query principalId -o tsv
  az role assignment list --assignee $swaPrincipalId
  ```
- Key Vault network access blocking requests
  - Check `bypass` setting includes "AzureServices":
    ```powershell
    az keyvault show --name kv-sentinel-maps-8615 --query "properties.networkAcls"
    ```

**3. Wrong secret name**
- Verify Key Vault has `AZURE-MAPS-SUBSCRIPTION-KEY` (exact name with hyphens)

**4. KV reference string in app settings**
- Don't use `@Microsoft.KeyVault(...)` format in `AZURE_MAPS_SUBSCRIPTION_KEY`
- SWA doesn't resolve KV references for custom code
- Must be actual subscription key value as fallback
