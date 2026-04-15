#Requires -Version 7.0
<#!
.SYNOPSIS
    Exports and sanitizes an Azure Logic App (Consumption) template for repeatable deployment.

.DESCRIPTION
    Workflow:
    1) Export template with LogicAppTemplate module
    2) Normalize Logic App + Microsoft.Web/connections resources
    3) Parameterize environment-specific values
    4) Emit a review report for remaining hardcoded references
    5) Optionally decompile sanitized ARM JSON to Bicep

    Designed for Azure Government or Azure Commercial, with Azure Government as default.

.EXAMPLE
    .\Export-LogicAppConsumptionTemplate.ps1 `
      -LogicAppName "la-demo" `
      -ResourceGroupName "rg-demo" `
      -SubscriptionId "00000000-0000-0000-0000-000000000000"

.EXAMPLE
    .\Export-LogicAppConsumptionTemplate.ps1 `
      -LogicAppName "la-demo" `
      -ResourceGroupName "rg-demo" `
      -SubscriptionId "00000000-0000-0000-0000-000000000000" `
      -CloudName "AzureUSGovernment" `
      -OutputDir ".\artifacts\logicapp"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$LogicAppName,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [ValidateSet("AzureCloud", "AzureUSGovernment", "AzureChinaCloud", "AzureGermanCloud")]
    [string]$CloudName = "AzureUSGovernment",

    [Parameter(Mandatory = $false)]
    [string]$OutputDir = ".\artifacts\logicapp-template",

    [Parameter(Mandatory = $false)]
    [switch]$SkipModuleInstall,

    [Parameter(Mandatory = $false)]
    [switch]$SkipBicepDecompile,

    [Parameter(Mandatory = $false)]
    [string]$SentinelManagedApiName = "azuresentinel",

    [Parameter(Mandatory = $false)]
    [string]$AzureMonitorLogsManagedApiName = "azuremonitorlogs"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[STEP] $Message" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[ OK ] $Message" -ForegroundColor Green
}

function Add-OrUpdateParameter {
    param(
        [hashtable]$Template,
        [string]$Name,
        [string]$Type,
        [string]$Description,
        [string]$DefaultValue
    )

    if (-not $Template.ContainsKey("parameters") -or -not ($Template["parameters"] -is [hashtable])) {
        $Template["parameters"] = @{}
    }

    $paramObj = @{
        type = $Type
        metadata = @{ description = $Description }
    }

    if (-not [string]::IsNullOrWhiteSpace($DefaultValue)) {
        $paramObj["defaultValue"] = $DefaultValue
    }

    $Template["parameters"][$Name] = $paramObj
}

function Get-ManagedApiNameFromId {
    param([string]$ManagedApiId)

    if ([string]::IsNullOrWhiteSpace($ManagedApiId)) {
        return $null
    }

    if ($ManagedApiId -match "/managedApis/([^/\]]+)$") {
        return $Matches[1]
    }

    return $null
}

function Get-ConnectionParameterName {
    param([string]$ManagedApiName)

    if ([string]::IsNullOrWhiteSpace($ManagedApiName)) {
        return "connectionName"
    }

    if ($ManagedApiName -match "(?i)sentinel|securityinsights") {
        return "sentinelConnectionName"
    }

    if ($ManagedApiName -match "(?i)azuremonitorlogs|loganalytics") {
        return "azureMonitorLogsConnectionName"
    }

    $clean = ($ManagedApiName -replace "[^a-zA-Z0-9]", "")
    if ([string]::IsNullOrWhiteSpace($clean)) {
        return "connectionName"
    }

    $name = $clean.Substring(0, 1).ToLower() + $clean.Substring(1)
    return "$($name)ConnectionName"
}

function Add-ReviewFinding {
    param(
        [System.Collections.Generic.List[string]]$Findings,
        [string]$Path,
        [string]$Message
    )

    $Findings.Add("- $Path : $Message") | Out-Null
}

function Update-ConnectionResource {
    param(
        [hashtable]$Template,
        [hashtable]$Resource,
        [System.Collections.Generic.List[string]]$Findings,
        [string]$SentinelApi,
        [string]$AzureMonitorApi
    )

    $managedApiName = $null
    if ($Resource.ContainsKey("properties") -and ($Resource["properties"] -is [hashtable])) {
        $props = $Resource["properties"]
        if ($props.ContainsKey("api") -and ($props["api"] -is [hashtable])) {
            $managedApiName = Get-ManagedApiNameFromId -ManagedApiId $props["api"]["id"]
        }
    }

    if ([string]::IsNullOrWhiteSpace($managedApiName)) {
        if ($Resource.ContainsKey("name") -and ($Resource["name"] -is [string])) {
            $managedApiName = ($Resource["name"] -split "/")[-1]
        }
    }

    if ($managedApiName -eq $SentinelApi) {
        $paramName = "sentinelConnectionName"
    }
    elseif ($managedApiName -eq $AzureMonitorApi) {
        $paramName = "azureMonitorLogsConnectionName"
    }
    else {
        $paramName = Get-ConnectionParameterName -ManagedApiName $managedApiName
    }

    Add-OrUpdateParameter -Template $Template -Name $paramName -Type "string" -Description "Connection resource name for managed API '$managedApiName'." -DefaultValue ""

    $Resource["name"] = "[parameters('$paramName')]"
    $Resource["location"] = "[parameters('location')]"

    if (-not $Resource.ContainsKey("properties") -or -not ($Resource["properties"] -is [hashtable])) {
        $Resource["properties"] = @{}
    }

    if (-not $Resource["properties"].ContainsKey("api") -or -not ($Resource["properties"]["api"] -is [hashtable])) {
        $Resource["properties"]["api"] = @{}
    }

    if (-not [string]::IsNullOrWhiteSpace($managedApiName)) {
        $Resource["properties"]["api"]["id"] = "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '$managedApiName')]"
    }

    Add-ReviewFinding -Findings $Findings -Path "resources[type=Microsoft.Web/connections]" -Message "Normalized connection '$managedApiName' to parameter '$paramName' and location parameter."
}

function Update-WorkflowConnections {
    param(
        [hashtable]$Template,
        [hashtable]$WorkflowResource,
        [System.Collections.Generic.List[string]]$Findings,
        [string]$SentinelApi,
        [string]$AzureMonitorApi
    )

    if (-not $WorkflowResource.ContainsKey("properties") -or -not ($WorkflowResource["properties"] -is [hashtable])) {
        return
    }

    $properties = $WorkflowResource["properties"]
    if (-not $properties.ContainsKey("parameters") -or -not ($properties["parameters"] -is [hashtable])) {
        return
    }

    if (-not $properties["parameters"].ContainsKey("`$connections") -or -not ($properties["parameters"]["`$connections"] -is [hashtable])) {
        return
    }

    $connectionsParam = $properties["parameters"]["`$connections"]
    if (-not $connectionsParam.ContainsKey("value") -or -not ($connectionsParam["value"] -is [hashtable])) {
        return
    }

    foreach ($connectionAlias in @($connectionsParam["value"].Keys)) {
        $connectionObj = $connectionsParam["value"][$connectionAlias]
        if (-not ($connectionObj -is [hashtable])) {
            continue
        }

        $managedApiName = $null
        if ($connectionObj.ContainsKey("id")) {
            $managedApiName = Get-ManagedApiNameFromId -ManagedApiId $connectionObj["id"]
        }

        if ([string]::IsNullOrWhiteSpace($managedApiName) -and $connectionObj.ContainsKey("connectionId")) {
            $managedApiName = Get-ManagedApiNameFromId -ManagedApiId $connectionObj["connectionId"]
        }

        if ($managedApiName -eq $SentinelApi) {
            $paramName = "sentinelConnectionName"
        }
        elseif ($managedApiName -eq $AzureMonitorApi) {
            $paramName = "azureMonitorLogsConnectionName"
        }
        else {
            $paramName = Get-ConnectionParameterName -ManagedApiName $managedApiName
        }

        Add-OrUpdateParameter -Template $Template -Name $paramName -Type "string" -Description "Workflow connection name for alias '$connectionAlias'." -DefaultValue ""

        $connectionObj["connectionName"] = "[parameters('$paramName')]"
        $connectionObj["connectionId"] = "[resourceId('Microsoft.Web/connections', parameters('$paramName'))]"

        if (-not [string]::IsNullOrWhiteSpace($managedApiName)) {
            $connectionObj["id"] = "[subscriptionResourceId('Microsoft.Web/locations/managedApis', parameters('location'), '$managedApiName')]"
        }

        Add-ReviewFinding -Findings $Findings -Path "workflow.`$connections.$connectionAlias" -Message "Normalized connection alias '$connectionAlias' with parameter '$paramName'."
    }
}

function Update-SanitizedNode {
    param(
        [object]$Node,
        [string]$Path,
        [System.Collections.Generic.List[string]]$Findings
    )

    if ($Node -is [hashtable]) {
        foreach ($k in @($Node.Keys)) {
            $childPath = if ([string]::IsNullOrWhiteSpace($Path)) { "$k" } else { "$Path.$k" }
            $Node[$k] = Update-SanitizedNode -Node $Node[$k] -Path $childPath -Findings $Findings
        }
        return $Node
    }

    if ($Node -is [System.Collections.IList]) {
        for ($i = 0; $i -lt $Node.Count; $i++) {
            $Node[$i] = Update-SanitizedNode -Node $Node[$i] -Path "$Path[$i]" -Findings $Findings
        }
        return $Node
    }

    if ($Node -is [string]) {
        $value = $Node

        if ($Path -match "(?i)workspace(resource)?id$" -and $value -match "(?i)^/subscriptions/.+/providers/microsoft\.operationalinsights/workspaces/.+") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Replaced workspace resource ID with parameter expression."
            return "[parameters('workspaceResourceId')]"
        }

        if ($Path -match "(?i)(foundry|endpoint|uri)$" -and $value -match "^https?://") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Replaced endpoint with foundryUri parameter expression."
            return "[parameters('foundryUri')]"
        }

        if ($value -match "(?i)/subscriptions/[0-9a-f\-]{36}/") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Contains hardcoded subscription ID. Review and parameterize manually if needed."
        }

        if ($value -match "(?i)[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}" -and $Path -match "(?i)tenant") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Contains possible tenant ID. Review and parameterize manually."
        }

        if ($Path -match "(?i)authentication") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Authentication block present. Verify managed identity or target auth model is correct."
        }

        if ($Path -match "(?i)api\.id$" -and $value -match "(?i)microsoft\.web/locations/managedapis") {
            Add-ReviewFinding -Findings $Findings -Path $Path -Message "Managed API ID present. Verify location alignment."
        }

        return $value
    }

    return $Node
}

Write-Step "Preparing output directory"
New-Item -Path $OutputDir -ItemType Directory -Force | Out-Null

$rawPath = Join-Path $OutputDir "main.raw.json"
$sanitizedPath = Join-Path $OutputDir "main.sanitized.json"
$parametersPath = Join-Path $OutputDir "main.parameters.json"
$bicepPath = Join-Path $OutputDir "main.bicep"
$reportPath = Join-Path $OutputDir "sanitize-report.md"

Write-Step "Checking Azure PowerShell context"
$currentContext = Get-AzContext -ErrorAction SilentlyContinue
if (-not $currentContext) {
    throw "No Az context found. Run Connect-AzAccount -EnvironmentName $CloudName first."
}

if ($currentContext.Subscription.Id -ne $SubscriptionId) {
    Write-Info "Setting Az context subscription to $SubscriptionId"
    Set-AzContext -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null
}

if ($currentContext.Environment.Name -ne $CloudName) {
    Write-Info "Current Az environment is '$($currentContext.Environment.Name)'. If export fails, reconnect with Connect-AzAccount -EnvironmentName $CloudName."
}

if (-not $SkipModuleInstall) {
    Write-Step "Installing LogicAppTemplate module"
    Install-Module LogicAppTemplate -Force -Scope CurrentUser -AllowClobber
}

Write-Step "Importing LogicAppTemplate module"
Import-Module LogicAppTemplate -Force

Write-Step "Acquiring ARM token"
$token = Get-AzAccessToken -ResourceUrl "https://management.azure.com/" | Select-Object -ExpandProperty Token
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Failed to acquire ARM token."
}

Write-Step "Exporting Logic App template"
Get-LogicAppTemplate `
    -LogicApp $LogicAppName `
    -ResourceGroup $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -Token $token `
    -Verbose | Out-File -FilePath $rawPath -Encoding utf8

Write-Ok "Raw template exported: $rawPath"

Write-Step "Loading exported template"
$template = Get-Content -Path $rawPath -Raw | ConvertFrom-Json -AsHashtable -Depth 100
if (-not $template.ContainsKey("resources") -or -not ($template["resources"] -is [System.Collections.IList])) {
    throw "Exported template does not contain a resources array."
}

$findings = [System.Collections.Generic.List[string]]::new()

Write-Step "Injecting baseline parameters"
Add-OrUpdateParameter -Template $template -Name "logicAppName" -Type "string" -Description "Logic App workflow name." -DefaultValue $LogicAppName
Add-OrUpdateParameter -Template $template -Name "location" -Type "string" -Description "Deployment location. Keep same region for workflow and connections." -DefaultValue ""
Add-OrUpdateParameter -Template $template -Name "sentinelConnectionName" -Type "string" -Description "Microsoft.Web/connections resource name for Sentinel connector." -DefaultValue ""
Add-OrUpdateParameter -Template $template -Name "azureMonitorLogsConnectionName" -Type "string" -Description "Microsoft.Web/connections resource name for Azure Monitor Logs connector." -DefaultValue ""
Add-OrUpdateParameter -Template $template -Name "foundryUri" -Type "string" -Description "Base URI for Foundry or other environment-specific HTTP endpoint." -DefaultValue ""
Add-OrUpdateParameter -Template $template -Name "workspaceResourceId" -Type "string" -Description "Log Analytics workspace resource ID." -DefaultValue ""
Add-OrUpdateParameter -Template $template -Name "targetSubscriptionId" -Type "string" -Description "Target subscription ID for cross-subscription references." -DefaultValue ""

Write-Step "Normalizing workflow and connection resources"
foreach ($resource in $template["resources"]) {
    if (-not ($resource -is [hashtable]) -or -not $resource.ContainsKey("type")) {
        continue
    }

    $resourceType = [string]$resource["type"]

    if ($resourceType -ieq "Microsoft.Logic/workflows") {
        $resource["name"] = "[parameters('logicAppName')]"
        $resource["location"] = "[parameters('location')]"

        if (-not $resource.ContainsKey("identity") -or -not ($resource["identity"] -is [hashtable])) {
            $resource["identity"] = @{ type = "SystemAssigned" }
            Add-ReviewFinding -Findings $findings -Path "resources[type=Microsoft.Logic/workflows].identity" -Message "Added SystemAssigned managed identity."
        }

        Update-WorkflowConnections -Template $template -WorkflowResource $resource -Findings $findings -SentinelApi $SentinelManagedApiName -AzureMonitorApi $AzureMonitorLogsManagedApiName
    }

    if ($resourceType -ieq "Microsoft.Web/connections") {
        Update-ConnectionResource -Template $template -Resource $resource -Findings $findings -SentinelApi $SentinelManagedApiName -AzureMonitorApi $AzureMonitorLogsManagedApiName
    }
}

Write-Step "Scanning template for remaining environment-specific references"
$template = Update-SanitizedNode -Node $template -Path "" -Findings $findings

Write-Step "Writing sanitized ARM template"
$template | ConvertTo-Json -Depth 100 | Out-File -FilePath $sanitizedPath -Encoding utf8
Write-Ok "Sanitized template written: $sanitizedPath"

Write-Step "Writing parameters file"
$paramFile = @{
    "`$schema" = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
    contentVersion = "1.0.0.0"
    parameters = @{
        logicAppName = @{ value = $LogicAppName }
        location = @{ value = "usgovvirginia" }
        sentinelConnectionName = @{ value = "sentinel-connection" }
        azureMonitorLogsConnectionName = @{ value = "azuremonitorlogs-connection" }
        foundryUri = @{ value = "https://replace-with-foundry-uri" }
        workspaceResourceId = @{ value = "/subscriptions/replace/resourceGroups/replace/providers/Microsoft.OperationalInsights/workspaces/replace" }
        targetSubscriptionId = @{ value = $SubscriptionId }
    }
}
$paramFile | ConvertTo-Json -Depth 20 | Out-File -FilePath $parametersPath -Encoding utf8
Write-Ok "Parameters file written: $parametersPath"

Write-Step "Writing sanitize review report"
$reportLines = @(
    "# Logic App Template Sanitize Report",
    "",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')",
    "",
    "## Files",
    "- Raw ARM: $rawPath",
    "- Sanitized ARM: $sanitizedPath",
    "- Parameters: $parametersPath",
    "",
    "## Automatic Changes",
    "- Parameterized workflow name and location.",
    "- Parameterized and normalized Microsoft.Web/connections names and managed API IDs.",
    "- Normalized workflow `$connections block connectionName/connectionId/id values.",
    "- Added SystemAssigned managed identity on workflow if missing.",
    "",
    "## Findings To Review"
)

if ($findings.Count -eq 0) {
    $reportLines += "- No additional findings detected by scan logic."
}
else {
    $reportLines += $findings
}

$reportLines += ""
$reportLines += "## Recommended Validation"
$reportLines += "- Validate ARM before deployment: az deployment group what-if --resource-group <rg> --template-file main.sanitized.json --parameters @main.parameters.json"
$reportLines += "- Confirm all Microsoft.Web/connections are in same RG and location as the Logic App."
$reportLines += "- Validate API connections auth model supports managed identity where applicable."

$reportLines | Out-File -FilePath $reportPath -Encoding utf8
Write-Ok "Review report written: $reportPath"

if (-not $SkipBicepDecompile) {
    Write-Step "Attempting Bicep decompile"
    $azPath = Get-Command az -ErrorAction SilentlyContinue
    if (-not $azPath) {
        Write-Info "Azure CLI not found. Skipping bicep decompile."
    }
    else {
        $decompileOutput = az bicep decompile --file $sanitizedPath --outfile $bicepPath 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Bicep decompiled: $bicepPath"
        }
        else {
            Write-Info "Bicep decompile reported issues. See output below."
            Write-Host $decompileOutput
        }
    }
}

Write-Host "`nCompleted. Next steps:" -ForegroundColor Cyan
Write-Host "1) Review findings in: $reportPath"
Write-Host "2) Tune values in: $parametersPath"
Write-Host "3) Validate with what-if before deployment"
