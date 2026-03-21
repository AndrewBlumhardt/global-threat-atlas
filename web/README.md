# web

Static frontend for the Sentinel Activity Maps application. Deployed as an Azure Static Web App.

## Files

| File | Description |
|---|---|
| `index.html` | Application shell - loads the Azure Maps CSS, the app's CSS, and the ES module entry point |
| `config.js` | Fallback values for `STORAGE_ACCOUNT_URL` and `DATASETS_CONTAINER` used when the API is unavailable |
| `config.sample.js` | Template for `config.js` |
| `staticwebapp.config.json` | SWA routing rules - all 404s are rewritten to `/index.html` and `/api/*` is proxied to the linked Function App backend |

## Custom Domain

After deployment, you can bind a custom domain to the Static Web App:

```bash
# Add the custom domain (creates a free managed TLS certificate)
az staticwebapp hostname set --name <swa-name> --resource-group <rg> --hostname www.yourdomain.com
```

Or in the portal: Static Web App -> Custom domains -> Add.

## Subfolders

| Folder | Description |
|---|---|
| `src/` | Application JavaScript source (ES modules) |
| `styles/` | Application CSS |


