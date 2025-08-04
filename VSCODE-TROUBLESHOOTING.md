# 🔧 VS Code Troubleshooting Guide

## ✅ **Fixed Issues**

The VS Code configuration has been updated to fix common issues:

### **1. Launch Configuration Fixed**
- ✅ Updated `.vscode/launch.json` with correct build task references
- ✅ Added multiple launch options: Development, Production, and No Build
- ✅ Fixed task dependencies and program paths

### **2. Task Configuration Enhanced**
- ✅ Added proper build tasks in `.vscode/tasks.json`
- ✅ Added run task for quick development
- ✅ Fixed installer build tasks

### **3. Build Process Verified**
- ✅ `dotnet clean` completed successfully
- ✅ `dotnet build` completed with only warnings (no errors)
- ✅ All dependencies restored properly

## 🚀 **How to Run in VS Code**

### **Method 1: Debug Menu (Recommended)**
1. **Open VS Code** in your project folder
2. **Go to Run and Debug** (Ctrl+Shift+D)
3. **Select configuration**:
   - `Launch CyberRiskApp` - Standard debug with build
   - `Launch CyberRiskApp (Production)` - Production mode
   - `Launch CyberRiskApp (No Build)` - Skip build for faster startup
4. **Press F5** or click the green play button

### **Method 2: Command Palette**
1. **Press F1** or Ctrl+Shift+P
2. **Type**: "Tasks: Run Task"
3. **Select**: "run"
4. **Application starts** in integrated terminal

### **Method 3: Integrated Terminal**
```bash
# Open VS Code terminal (Ctrl+`)
dotnet run

# Or specify URLs
dotnet run --urls "http://localhost:5197"
```

## 🔍 **Troubleshooting Common Issues**

### **Issue: "Build task not found"**
**Solution**: Use "Launch CyberRiskApp (No Build)" configuration

### **Issue: "Port already in use"**
**Solution**: 
```bash
# Check what's using the port
netstat -ano | findstr :5197

# Kill the process if needed
taskkill /PID [process_id] /F
```

### **Issue: "Database connection failed"**
**Solution**: Make sure PostgreSQL is running
```bash
# Check PostgreSQL service
Get-Service -Name "postgresql*"

# Start if needed
Start-Service postgresql-x64-17
```

### **Issue: "Cannot start debugger"**
**Solution**: Clean and rebuild
```bash
dotnet clean
dotnet build
```

## 🎯 **Recommended Development Workflow**

1. **Start Development**:
   - Press F5 in VS Code
   - Select "Launch CyberRiskApp"
   - Application opens at http://localhost:5197

2. **Make Changes**:
   - Edit code in VS Code
   - Hot reload enabled for most changes
   - For major changes, restart debugger (Ctrl+Shift+F5)

3. **Test Changes**:
   - Browser automatically refreshes for view changes
   - For controller/service changes, restart may be needed

## 🛠️ **Available Launch Configurations**

| Configuration | Use Case | Build | Environment |
|---------------|----------|-------|-------------|
| **Launch CyberRiskApp** | Standard development | ✅ Yes | Development |
| **Launch CyberRiskApp (Production)** | Production testing | ✅ Yes | Production |
| **Launch CyberRiskApp (No Build)** | Quick restart | ❌ No | Development |

## 🔧 **Available Tasks**

Press Ctrl+Shift+P → "Tasks: Run Task":

- **build** - Build the application
- **run** - Run without debugging
- **build-app** - Publish release version
- **build-installer-inno** - Create Windows installer
- **build-all-packages** - Create all distribution packages

## 🚨 **If Still Not Working**

1. **Restart VS Code** completely
2. **Reload Window**: Ctrl+Shift+P → "Developer: Reload Window"
3. **Clear cache**: Close VS Code, delete `.vscode/settings.json`, restart
4. **Check Extensions**: Make sure C# extension is installed and enabled

## 🎉 **Success Indicators**

When working correctly, you should see:
- ✅ Build output in terminal
- ✅ Application starts on http://localhost:5197
- ✅ Browser opens automatically
- ✅ Debug breakpoints work
- ✅ Hot reload works for most changes

**Your VS Code environment is now properly configured for CyberRisk development!** 🚀