# GitHub Actions Workflows

This directory contains CI/CD workflows for automated deployment and testing of the Sentinel Activity Maps application.

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
- **Purpose:** Deploys the frontend web application and its associated API
- **Process:**
  - Builds and deploys static web content from `/web`
  - Deploys API functions from `/web/api`
  - Auto-closes preview deployments when PRs are closed
- **Required Secrets:**
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`

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
   az ad app create --display-name "GitHub-Sentinel-Activity-Maps"
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

**Deployment fails with 401/403:**
- Verify federated credentials are configured correctly
- Check that managed identity has required permissions (Storage Blob Data Contributor, Log Analytics Reader)

**Workflow doesn't trigger:**
- Ensure changes are in the correct path (`api/**` or `web/**`)
- Check that the workflow file itself is valid YAML

**Cold start after deployment:**
- Function apps may take 30-60 seconds to fully start after deployment
- Health check endpoint: `https://YOUR-FUNCTION.azurewebsites.net/api/health`
