# Repository Cleanup Summary

Cleanup performed: February 15, 2026

## Backups Created

All markdown files backed up to `docs-backup/` directory before changes.

## Documentation Consolidation

### Before (13 files):
- Root: README.md, MANUAL_DATA_IMPORT.md, TESTING_AND_DEPLOYMENT.md
- docs/: 9 separate documentation files
- web/: README.md

### After (3 files):
- **README.md** - Main project README with quick start
- **docs/README.md** - Comprehensive documentation (deployment, configuration, architecture, troubleshooting)
- **web/README.md** - Frontend-specific documentation

## Files Removed

### Development/Sample Files:
- sample-data-template.geojson
- sample-data-template.tsv

### Consolidated Documentation:
- MANUAL_DATA_IMPORT.md ➜ docs/README.md
- TESTING_AND_DEPLOYMENT.md ➜ docs/README.md
- docs/QUICKSTART.md ➜ docs/README.md
- docs/DEPLOYMENT.md ➜ docs/README.md
- docs/DEPLOYMENT_CHECKLIST.md ➜ docs/README.md
- docs/LOCAL_DEVELOPMENT.md ➜ docs/README.md
- docs/MAXMIND_SETUP.md ➜ docs/README.md
- docs/CUSTOM_SOURCE.md ➜ docs/README.md
- docs/SIGNIN_DATA_SOURCES.md ➜ docs/README.md
- docs/ARCHITECTURE_CHANGES.md ➜ docs/README.md
- docs/architecture.md ➜ docs/README.md

## Files Kept

### Generator Scripts (for demo data regeneration):
- generate_device_locations.py
- generate_mde_devices.py
- generate_signin_data.py

### Deployment Scripts:
- deploy.ps1
- deploy.sh

### License and Core:
- LICENSE
- README.md
- .gitignore

### Application Code:
- api/ - Azure Functions backend
- web/ - Static web app frontend
- tests/ - Test suite
- .github/ - GitHub Actions workflows

## Repository Structure After Cleanup

```
sentinel-activity-maps/
├── README.md                          # Main project documentation
├── LICENSE                            # MIT License
├── deploy.ps1                         # PowerShell deployment script
├── deploy.sh                          # Bash deployment script
├── generate_*.py                      # Demo data generators
├── docs/
│   └── README.md                      # Comprehensive documentation
├── docs-backup/                       # Backup of all original .md files
├── web/
│   ├── README.md                      # Frontend documentation
│   ├── index.html
│   ├── config.sample.js
│   ├── staticwebapp.config.json
│   ├── src/                           # JavaScript modules
│   ├── styles/                        # CSS
│   └── data/                          # Static data files
├── api/
│   ├── function_app.py                # Main function handler
│   ├── sources.yaml                   # Data source configuration
│   ├── host.json                      # Function host config
│   ├── requirements.txt               # Python dependencies
│   ├── shared/                        # Shared modules
│   └── test_local.py                  # Local test script
├── tests/
│   ├── test_direct_api.py
│   └── test_geo_debug.py
└── .github/
    └── workflows/                     # GitHub Actions
        ├── deploy-function.yml
        └── azure-static-web-apps-*.yml
```

## Redeploy Testing Checklist

For next week's full redeploy test:

### Preparation:
- [ ] Backup current Azure resource group configuration
- [ ] Document current resource names
- [ ] Export current app settings
- [ ] Export current role assignments

### Cleanup:
```powershell
# Delete all Azure resources
az group delete --name YOUR-RESOURCE-GROUP --yes --no-wait
```

### Fresh Deploy:
```powershell
# Deploy from scratch
.\deploy.ps1 -WorkspaceId "YOUR-WORKSPACE-ID"
```

### Validation:
- [ ] Resource group created
- [ ] Storage Account with 3 containers
- [ ] Function App running
- [ ] Static Web App deployed
- [ ] Managed Identity configured
- [ ] Role assignments applied
- [ ] GitHub Actions working
- [ ] Health endpoint accessible
- [ ] Data refresh successful
- [ ] Map displays data
- [ ] Demo mode functional

## Documentation Quality

All documentation now follows consistent structure:
- **Quick Start** sections for 5-minute setup
- **Detailed Configuration** with code examples
- **Troubleshooting** sections
- **Architecture diagrams** (ASCII art for compatibility)
- **Complete API reference**
- **Deployment checklists**

## Benefits

1. **Single source of truth** - One README per directory
2. **Easier maintenance** - No duplicate content
3. **Better navigation** - Clear hierarchy
4. **Faster onboarding** - Comprehensive docs/README.md
5. **Clean repository** - No leftover dev files
6. **Preserves history** - All originals in docs-backup/

---

## Recovery

If you need to restore original documentation:

```powershell
# Restore from backup
Copy-Item -Path docs-backup\* -Destination . -Recurse -Force
```

## Next Steps

1. Review consolidated documentation
2. Test redeploy procedure next week
3. Update any external links to documentation
4. Consider adding PDF export of docs/README.md
