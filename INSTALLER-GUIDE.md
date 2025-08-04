# 🚀 Complete Step-by-Step Installer Guide

## ✅ **Method 1: Simple VS Code Approach (WORKING)**

### **Step 1: Install Prerequisites**
1. **Download Inno Setup**: https://jrsoftware.org/isdl.php
2. **Run installer** as Administrator
3. **Install to default location**: `C:\Program Files (x86)\Inno Setup 6\`

### **Step 2: Open Project in VS Code**
```bash
cd C:\Dev\CyberRiskPlatform\CyberRiskApp\CyberRiskApp\CyberRiskApp
code .
```

### **Step 3: Build Installer (3 Commands)**
Open VS Code terminal (`Ctrl+``) and run:

```powershell
# 1. Build the application
.\publish-simple.ps1

# 2. Create installer configuration
.\create-simple-installer.ps1

# 3. Compile installer
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\CyberRiskApp-Simple.iss
```

### **Step 4: Test Your Installer**
Your installer is ready at: `installer\installer\CyberRiskApp-Setup-v1.0.0.exe`

**Test it**:
1. Run installer as Administrator
2. Follow installation wizard
3. Service will be installed and setup page will open
4. Complete setup at http://localhost:5000/Setup

---

## 🔧 **Method 2: VS Code Tasks (One-Click)**

### **Step 1: Set Up VS Code Tasks**
The `.vscode\tasks.json` file provides these commands:

1. **Open Command Palette**: `Ctrl+Shift+P`
2. **Type**: "Tasks: Run Task"
3. **Available tasks**:
   - `build-app` - Builds the .NET application
   - `build-installer-inno` - Creates Inno Setup installer
   - `build-all-packages` - Creates all distribution formats

### **Step 2: One-Click Build**
```bash
# In VS Code:
# Press F1 → Type "Tasks: Run Task" → Select "build-installer-inno"
```

---

## 📦 **Method 3: GitHub Actions (Automated)**

The `.github\workflows\build-installer.yml` automatically:
1. Builds application on tag push
2. Creates installer
3. Uploads to GitHub Releases

**Usage**:
```bash
git tag v1.0.0
git push origin v1.0.0
# Wait for GitHub Actions to complete
```

---

## 🎯 **Quick Start (5 Minutes)**

**For immediate results**:

1. **Install Inno Setup** (2 minutes): https://jrsoftware.org/isdl.php
2. **Open VS Code** in project folder
3. **Run these commands** in terminal:
   ```powershell
   .\publish-simple.ps1
   .\create-simple-installer.ps1
   & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\CyberRiskApp-Simple.iss
   ```
4. **Done!** Installer at: `installer\installer\CyberRiskApp-Setup-v1.0.0.exe`

---

## 🔍 **Troubleshooting**

### **Problem: "ISCC.exe not found"**
```powershell
# Check installation
Test-Path "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
# If false, reinstall Inno Setup
```

### **Problem: "Build failed"**
```powershell
# Clean and retry
Remove-Item -Recurse -Force .\publish, .\installer -ErrorAction SilentlyContinue
.\publish-simple.ps1
```

### **Problem: "Files not found"**
```powershell
# Verify publish folder exists
ls .\publish\CyberRiskApp\
# Should contain CyberRiskApp.exe and other files
```

---

## 📋 **What the Installer Does**

1. **Copies files** to `C:\Program Files\CyberRiskApp\`
2. **Installs Windows Service** named "CyberRiskApp"
3. **Creates shortcuts** (optional)
4. **Opens setup page** at http://localhost:5000/Setup
5. **User completes** secure configuration wizard

---

## 🎉 **Success Indicators**

**Build Success**:
- ✅ `publish\CyberRiskApp\CyberRiskApp.exe` exists
- ✅ `installer\CyberRiskApp-Simple.iss` created
- ✅ `installer\installer\CyberRiskApp-Setup-v1.0.0.exe` exists

**Installation Success**:
- ✅ Service appears in Windows Services
- ✅ Browser opens to setup page
- ✅ Can complete configuration wizard

---

## 🚀 **VS Code Extensions (Optional)**

Install these for better development experience:
```bash
code --install-extension ms-dotnettools.csharp
code --install-extension ms-vscode.powershell
```

---

## 📊 **File Sizes**

| Component | Size |
|-----------|------|
| Published App | ~44 MB |
| Installer | ~45 MB |
| Total Package | ~45 MB |

The installer is self-contained and includes all dependencies except PostgreSQL.

---

**🎯 Ready to build? Follow Method 1 for guaranteed success!**