# config

Reads the Function App's environment variables and returns runtime configuration to the browser as JSON.

## Endpoint

`GET /api/config`

## Response

```json
{
  "azureMapsKey": "<subscription-key>",
  "storageAccountUrl": "https://<account>.blob.core.windows.net",
  "datasetsContainer": "datasets",
  "customLayerDisplayName": "Custom Source"
}
```

The Azure Maps key is served only through this endpoint and is never stored in static files or source control. Response carries `Cache-Control: no-cache`.

## App settings read

| Setting | Used as |
|---|---|
| `AZURE_MAPS_SUBSCRIPTION_KEY` | `azureMapsKey` |
| `STORAGE_ACCOUNT_URL` | `storageAccountUrl` |
| `STORAGE_CONTAINER_DATASETS` | `datasetsContainer` |
| `CUSTOM_LAYER_DISPLAY_NAME` | `customLayerDisplayName` |
