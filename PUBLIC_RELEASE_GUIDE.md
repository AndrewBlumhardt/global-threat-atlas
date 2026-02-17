# Public Release Preparation Guide

## ✅ What to KEEP (Required for End Users)

### Core Application Files
- ✅ **`.github/workflows/`** - CI/CD automation (helps users deploy)
  - Serves as deployment documentation
  - Won't run without user's own secrets/credentials
  - Standard practice for open-source Azure projects

### Essential Directories
- ✅ **`api/`** - Main backend function app
- ✅ **`web/`** - Frontend static web app  
- ✅ **`tests/`** - Debugging/testing utilities (documented in README)
- ✅ **`deploy.ps1`** & **`deploy.sh`** - One-command deployment scripts
- ✅ **`README.md`**, **`LICENSE`** - Project documentation

---

## 🗑️ What to REMOVE (Development-Only Files)

### 1. Development Utility Scripts (Root)
Move to `scripts/` directory or remove:
```bash
# Data generation utilities (used during development)
generate_device_locations.py
generate_mde_devices.py
generate_signin_data.py
generate-mde-geojson.py

# Manual enrichment tools (used during development)
manual-geo-enrich.py
manual-geo-enrich-free.py
```

**Recommendation:** 
- Option A: Remove completely (users won't need these)
- Option B: Move to `scripts/dev/` with README explaining they're examples

### 2. Sample/Test Data Files (Root)
```bash
# Generated test data
mde-devices-enriched.tsv
mde-devices-test.tsv
mde-devices.geojson
```

**Recommendation:** Remove - these are development artifacts

### 3. Build Artifacts (Root)
```bash
# Deployment package (should be generated, not committed)
function-deployment.zip
```

**Recommendation:** Remove and add to .gitignore (already done ✅)

### 4. Internal Documentation (Root)
```bash
CLEANUP_SUMMARY.md  # Your internal project notes
```

**Recommendation:** Remove before public release

### 5. Web API Test Endpoints
```bash
web/api/test/      # Diagnostic endpoint
web/api/simple/    # Hello world test
```

**Recommendation:** Remove - these are development/debugging tools

### 6. Configuration Files with Secrets
```bash
web/config.js      # May contain actual Azure Maps keys
```

**Recommendation:** 
- Remove from git history if it contains secrets
- Add to .gitignore (already done ✅)
- Keep `web/config.sample.js` as template

---

## 🔧 Cleanup Commands

### Quick Cleanup (Recommended)
```powershell
# Remove development scripts (move to scripts/ if you want to keep)
Remove-Item generate_device_locations.py
Remove-Item generate_mde_devices.py
Remove-Item generate_signin_data.py
Remove-Item generate-mde-geojson.py
Remove-Item manual-geo-enrich.py
Remove-Item manual-geo-enrich-free.py

# Remove sample data files
Remove-Item mde-devices-enriched.tsv
Remove-Item mde-devices-test.tsv
Remove-Item mde-devices.geojson

# Remove build artifacts
Remove-Item function-deployment.zip -ErrorAction SilentlyContinue

# Remove internal docs
Remove-Item CLEANUP_SUMMARY.md -ErrorAction SilentlyContinue

# Remove web test endpoints
Remove-Item -Path web/api/test -Recurse
Remove-Item -Path web/api/simple -Recurse

# Remove config.js if it contains real keys
# (Keep config.sample.js as template)
Remove-Item web/config.js -ErrorAction SilentlyContinue

# Commit changes
git add -A
git commit -m "Clean up development files for public release"
git push origin main
```

### OR: Organize Instead of Delete
```powershell
# Create scripts directory
New-Item -ItemType Directory -Path scripts/dev -Force

# Move utility scripts
Move-Item generate*.py scripts/dev/
Move-Item manual-geo-enrich*.py scripts/dev/

# Create README for scripts
@"
# Development Utilities

These scripts were used during development for generating test data and manual processing.
They are provided as examples but are not required to run the application.

## Data Generation
- \`generate_device_locations.py\` - Generate sample device location data
- \`generate_mde_devices.py\` - Generate sample MDE device inventory
- \`generate_signin_data.py\` - Generate sample sign-in activity
- \`generate-mde-geojson.py\` - Convert data to GeoJSON format

## Manual Processing
- \`manual-geo-enrich.py\` - Manual geo-enrichment using MaxMind
- \`manual-geo-enrich-free.py\` - Manual geo-enrichment using free services

These are not part of the automated function workflow.
"@ | Out-File -FilePath scripts/dev/README.md
```

---

## 📊 Space Savings

By removing development files:
- **Utility scripts:** ~50 KB
- **Sample data files:** ~500 KB
- **Test endpoints:** ~5 KB
- **Build artifacts:** Variable (could be MBs)

**Total:** ~555+ KB + cleaner repository structure

---

## 🎯 Final Repository Structure (Clean)

```
sentinel-activity-maps/
├── .github/workflows/          ✅ KEEP - Deployment automation
├── api/                        ✅ KEEP - Backend function
├── web/                        ✅ KEEP - Frontend app
├── tests/                      ✅ KEEP - Testing utilities
├── deploy.ps1                  ✅ KEEP - Deployment script
├── deploy.sh                   ✅ KEEP - Deployment script
├── README.md                   ✅ KEEP - Documentation
├── LICENSE                     ✅ KEEP - License
└── .gitignore                  ✅ KEEP - Updated

Optional:
├── scripts/dev/                ⚠️  OPTIONAL - Development utilities
```

---

## 💡 Best Practices for Public Repos

### DO Keep:
- ✅ CI/CD workflows (`.github/workflows/`)
- ✅ Deployment automation scripts
- ✅ Clear documentation
- ✅ License file
- ✅ Sample configuration files (`.sample` or `.example`)

### DON'T Keep:
- ❌ Secrets, credentials, connection strings
- ❌ Build artifacts (*.zip, compiled binaries)
- ❌ Personal notes/internal documentation
- ❌ Development utility scripts (unless educational)
- ❌ Sample data files (unless small and illustrative)

### Gray Area (Your Choice):
- ⚠️  Test/debugging endpoints - Usually remove
- ⚠️  Utility scripts - Keep if educational, remove if single-use
- ⚠️  Sample data - Keep if < 100KB and illustrative

---

## 🔐 Security Check Before Publishing

```powershell
# Check for potential secrets in git history
git log --all --full-history --source -- "*config.js" "*settings.json" "*.env"

# Search for potential API keys/secrets in current files
Get-ChildItem -Recurse -File | Select-String -Pattern "(?i)(api[_-]?key|secret|password|token)" | Select-Object Path, LineNumber, Line

# If secrets found in history, consider using git-filter-repo or BFG Repo Cleaner
```

---

## ✅ Checklist Before Public Release

- [ ] Remove development utility scripts (or move to `scripts/dev/`)
- [ ] Remove sample data files
- [ ] Remove build artifacts
- [ ] Remove internal documentation
- [ ] Remove test/debug API endpoints
- [ ] Verify no secrets in `web/config.js`
- [ ] Update `.gitignore` (done ✅)
- [ ] Test clean clone: `git clone <repo> test-clone && cd test-clone`
- [ ] Verify deployment scripts work from clean clone
- [ ] Update README with clear setup instructions
- [ ] Add screenshots/demo if applicable
- [ ] Review LICENSE file
- [ ] Add CONTRIBUTING.md (optional)
- [ ] Create release tag/version

---

## 🎉 After Cleanup

Your repository will contain only what users need to:
1. Understand what the project does (README)
2. Deploy to their own Azure (deployment scripts + workflows)
3. Customize configuration (sample files)
4. Debug issues (test utilities in tests/)

The `.github/workflows/` directory adds value by showing users **how to set up automated deployment**, which is actually a feature, not clutter!
