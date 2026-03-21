# GitHub Actions Workflows

This directory contains CI/CD workflows for automated deployment and testing of the Global Threat Intelligence Atlas application.

## Workflows

### 🚀 deploy-function.yml
**Primary Function App Deployment**
- **Triggers:** Push to `main` branch (when `api/**` changes), manual dispatch
- **Purpose:** Deploys the Azure Functions backend to Azure
- **Authentication:** OIDC/Federated Credentials (recommended) or Publish Profile (fallback)
- **Process:**
  - Sets up Python 3.11 environment
  - Installs dependencies
  - Deploys to Azure Functions with Oryx build
- **Required Secrets:**
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_SUBSCRIPTION_ID`

### 🌐 azure-static-web-apps.yml
**Static Web App Deployment**
- **Triggers:** Push to `main` branch (when `web/**` changes), pull requests, manual dispatch
- **Purpose:** Deploys frontend static content only
- **Process:**
  - Builds and deploys static web content from `/web`
  - Does not deploy `/web/api` functions
  - Auto-closes preview deployments when PRs are closed
- **Required Secrets:**
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`

**API Ownership:** Runtime API is served by the stand-alone Function App (`/api/*`) deployed via `deploy-function.yml` or CLI.

### ✅ lint-test.yml
**Code Quality Checks**
- **Triggers:** Pull requests to `main` (when `api/**` changes), manual dispatch
- **Purpose:** Runs linting and testing before merging
- **Checks:**
  - Black formatter compliance
  - Flake8 linting (syntax errors and code quality)
  - Unit tests (placeholder - tests to be implemented)
- **Status:** Currently set to `continue-on-error` for gradual adoption

### 📦 azure-function-app.yml
**Alternative Function Deployment**
- **Triggers:** Push to `main` branch (when `api/**` changes), manual dispatch
- **Purpose:** Alternative deployment workflow using publish profile authentication
- **Note:** This appears to be a duplicate/alternative to `deploy-function.yml`. Consider consolidating or removing one to avoid confusion.

## Setup

### For Function App Deployment (OIDC Method - Recommended)

1. Create Azure AD App Registration:
   ```bash
   az ad app create --display-name "GitHub-Global-Threat-Atlas"
   ```

2. Configure federated credentials for GitHub Actions

3. Add repository secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`

### For Static Web App Deployment

1. Get deployment token:
   ```bash
   az staticwebapp secrets list --name YOUR-SWA-NAME --query "properties.apiKey" -o tsv
   ```

2. Add as repository secret:
   - `AZURE_STATIC_WEB_APPS_API_TOKEN`

## Maintenance Notes

- **Duplicate Workflows:** Both `deploy-function.yml` and `azure-function-app.yml` deploy the function app. Recommend keeping only one (preferably `deploy-function.yml` with OIDC authentication).
- **Test Implementation:** The `lint-test.yml` workflow has placeholder test execution. Add pytest tests to the `api/tests/` directory to enable automated testing.
- **Function App Name:** Update the `AZURE_FUNCTIONAPP_NAME` environment variable in the workflow files to match your deployed function app name.

## Troubleshooting

**Start here — health check endpoint:**
After any deployment, verify the function is healthy before debugging further:
```
https://<your-swa>.azurestaticapps.net/api/health
```
- `"azure.identity": "unavailable"` or `"azure.storage.blob": "unavailable"` → Python packages are missing from the deployment. Re-run the function deploy workflow.
- `"data_freshness_hours": { "signin-activity.geojson": null }` → SDKs loaded but MI blob access failing. Check RBAC on the storage account.
- `"storage_url": false` → `STORAGE_ACCOUNT_URL` app setting not set on the Function App.

**Deployment fails with 401/403:**
- Verify federated credentials are configured correctly
- Check that managed identity has required permissions (Storage Blob Data Contributor, Log Analytics Reader)

**Workflow doesn't trigger:**
- Ensure changes are in the correct path (`api/**` or `web/**`)
- Check that the workflow file itself is valid YAML

**Cold start after deployment:**
- Function apps may take 30-60 seconds to fully start after deployment
