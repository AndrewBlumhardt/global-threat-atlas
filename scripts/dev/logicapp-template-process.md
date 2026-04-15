# Repeatable Logic App (Consumption) Template Process

This process exports a Logic App from a demo environment, sanitizes environment-specific values, normalizes connections, and prepares ARM + Bicep artifacts for redeployment.

## Script

Use:

- `scripts/dev/Export-LogicAppConsumptionTemplate.ps1`

## Prerequisites

1. PowerShell 7+
2. Az PowerShell module and an authenticated session
3. `LogicAppTemplate` module (script installs by default)
4. Azure CLI (optional, only needed for Bicep decompile)

## Azure Government login example

```powershell
Connect-AzAccount -EnvironmentName AzureUSGovernment
Set-AzContext -SubscriptionId "<sub-id>"
```

## Run export + sanitize

```powershell
./scripts/dev/Export-LogicAppConsumptionTemplate.ps1 `
  -LogicAppName "<logic-app-name>" `
  -ResourceGroupName "<rg-name>" `
  -SubscriptionId "<sub-id>" `
  -CloudName "AzureUSGovernment" `
  -OutputDir "./artifacts/logicapp-template"
```

## Generated artifacts

- `main.raw.json`: Direct export output
- `main.sanitized.json`: Parameterized + normalized ARM template
- `main.parameters.json`: Deployment parameters scaffold
- `main.bicep`: Decompiled Bicep (when decompile succeeds)
- `sanitize-report.md`: Findings and review checklist

## What the script normalizes

1. Parameters (adds or updates):
   - `logicAppName`
   - `location`
   - `sentinelConnectionName`
   - `azureMonitorLogsConnectionName`
   - `foundryUri`
   - `workspaceResourceId`
   - `targetSubscriptionId`
2. Workflow (`Microsoft.Logic/workflows`):
   - Name and location -> parameter expressions
   - Adds SystemAssigned identity if missing
   - Normalizes `properties.parameters.$connections.value.*`
3. Connections (`Microsoft.Web/connections`):
   - Name and location -> parameter expressions
   - `properties.api.id` -> `subscriptionResourceId(...)`

## Manual review checklist

Review `sanitize-report.md` and specifically verify:

1. `api.id` values and managed API names
2. Authentication blocks and connector auth mode
3. `parameterValues` carrying environment-specific content
4. Embedded subscription/resource-group references inside action definitions
5. Any tenant IDs or external HTTP endpoints
6. Request body values that vary by environment

## Validate before deployment

```powershell
az deployment group what-if `
  --resource-group "<target-rg>" `
  --template-file "./artifacts/logicapp-template/main.sanitized.json" `
  --parameters "@./artifacts/logicapp-template/main.parameters.json"
```

## Notes on connection alignment

For Consumption Logic Apps, deployment is most reliable when:

1. Logic App and `Microsoft.Web/connections` are in the same resource group
2. Logic App and connections use the same location
3. Connector names in workflow `$connections` and connection resources match exactly
