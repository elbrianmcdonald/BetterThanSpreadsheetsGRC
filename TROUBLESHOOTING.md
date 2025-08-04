# 🔧 CyberRisk App Troubleshooting Guide

## 🚨 **Problem: "localhost refused to connect"**

### **Quick Diagnosis:**

1. **Check if app is running**:
   ```powershell
   Get-Process -Name "CyberRiskApp" -ErrorAction SilentlyContinue
   ```

2. **Check correct ports**:
   - **Development**: http://localhost:5197 or https://localhost:7212
   - **Production**: http://localhost:5000 or https://localhost:5001
   - **Custom**: Whatever you set in --urls parameter

3. **Check what's listening**:
   ```powershell
   netstat -ano | findstr ":5197"
   ```

---

## 🛠️ **Solution 1: Run App Directly (Recommended)**

### **Step 1: Quick Fix Script**
```powershell
.\quick-fix.ps1
```

### **Step 2: Manual Steps**
```powershell
# Kill any existing processes
Get-Process -Name "CyberRiskApp" -ErrorAction SilentlyContinue | Stop-Process -Force

# Go to published app
cd "publish\CyberRiskApp"

# Run directly on port 5197
.\CyberRiskApp.exe --urls "http://localhost:5197"

# Or try port 8080 if 5197 is busy
.\CyberRiskApp.exe --urls "http://localhost:8080"
```

### **Step 3: Open Browser**
Navigate to: http://localhost:5197/Setup

---

## 🛠️ **Solution 2: Fix Windows Service**

### **Check Service Status**
```powershell
Get-Service -Name "CyberRiskApp"
sc.exe query CyberRiskApp
```

### **Fix Service Configuration**
```powershell
# Stop and delete existing service
sc.exe stop CyberRiskApp
sc.exe delete CyberRiskApp

# Reinstall service with correct parameters
cd "C:\Program Files\CyberRiskApp\scripts"
.\install.ps1 -InstallPath "C:\Program Files\CyberRiskApp" -UseWebSetup
```

---

## 🛠️ **Solution 3: Database Connection Issues**

### **Common Error**: Database connection failed

**Symptoms**:
- App starts but crashes immediately
- Error logs mention PostgreSQL connection

**Fix**:
1. **Install PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Start PostgreSQL service**:
   ```powershell
   Get-Service -Name "postgresql*" | Start-Service
   ```
3. **Create database**:
   ```sql
   -- Connect to PostgreSQL as superuser
   CREATE DATABASE "CyberRiskDB";
   CREATE USER cyberrisk_user WITH PASSWORD 'CyberRisk123!';
   GRANT ALL PRIVILEGES ON DATABASE "CyberRiskDB" TO cyberrisk_user;
   ```

### **Skip Database (Testing)**
```powershell
# Run without database for testing
$env:SKIP_DB_MIGRATION = "true"
.\CyberRiskApp.exe --urls "http://localhost:5197"
```

---

## 🛠️ **Solution 4: Port Conflicts**

### **Check What's Using the Port**
```powershell
netstat -ano | findstr ":5197"
# If something is using it, try a different port
```

### **Use Different Port**
```powershell
.\CyberRiskApp.exe --urls "http://localhost:8080"
# Then open: http://localhost:8080/Setup
```

---

## 🛠️ **Solution 5: Firewall Issues**

### **Allow Through Windows Firewall**
```powershell
# Allow the app through firewall
New-NetFirewallRule -DisplayName "CyberRisk App" -Direction Inbound -Protocol TCP -LocalPort 5197 -Action Allow
```

---

## 🔍 **Advanced Diagnostics**

### **Check Event Logs**
```powershell
# Check for application errors
Get-EventLog -LogName Application -Source "CyberRiskApp" -Newest 10 -ErrorAction SilentlyContinue

# Check system logs
Get-EventLog -LogName System -EntryType Error -Newest 10 | Where-Object { $_.Message -like "*CyberRisk*" }
```

### **Check File Permissions**
```powershell
# Make sure the app has permissions to its folder
icacls "C:\Program Files\CyberRiskApp" /grant "Everyone:(F)"
```

### **Check .NET Runtime**
```powershell
# Verify .NET 8 is installed
dotnet --version
dotnet --list-runtimes
```

---

## 🎯 **Success Checklist**

When everything is working, you should see:

✅ **Process running**: `Get-Process -Name "CyberRiskApp"`  
✅ **Port listening**: `netstat -ano | findstr ":5197"`  
✅ **Browser accessible**: http://localhost:5197/Setup responds  
✅ **Setup page loads**: Shows CyberRisk setup wizard  

---

## 🚀 **Recommended Testing Workflow**

1. **Start simple**: Run the app directly first
   ```powershell
   cd "publish\CyberRiskApp"
   .\CyberRiskApp.exe --urls "http://localhost:5197"
   ```

2. **Test access**: Open http://localhost:5197/Setup in browser

3. **Once working**: Then install as service if needed

4. **For service issues**: Always test direct execution first

---

## 📞 **Still Having Issues?**

1. **Run the quick-fix script**: `.\quick-fix.ps1`
2. **Check the console output** for specific error messages
3. **Try different ports**: 8080, 8090, 5000, etc.
4. **Verify PostgreSQL** is installed and running
5. **Check Windows Firewall** settings

**Most issues are resolved by running the app directly rather than as a service during initial setup.**