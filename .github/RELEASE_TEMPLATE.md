# CyberRisk Management Platform v{VERSION}

## 🔐 Enterprise Cyber Risk & GRC Platform

A comprehensive cybersecurity risk management and governance platform built with ASP.NET Core 8.0.

### 🆕 What's New in v{VERSION}
- Feature 1
- Feature 2
- Bug fixes and improvements

### 📋 System Requirements
- **Windows**: 10/11 (x64)
- **Database**: PostgreSQL 16+
- **.NET Runtime**: 8.0+ (for framework-dependent packages)

### 🚀 Installation Options

#### 🔧 **Windows Installer (Recommended)**
**File**: `CyberRiskApp-Setup-v{VERSION}.exe`
- ✅ Automated installation and service setup
- ✅ Dependency checking (PostgreSQL, .NET)
- ✅ Web-based secure configuration
- ✅ Windows Service integration

**Installation Steps**:
1. Download and run `CyberRiskApp-Setup-v{VERSION}.exe`
2. Follow installation wizard
3. Complete setup at http://localhost:5000/Setup

#### 📦 **Portable Packages**

| Package Type | File | Use Case |
|--------------|------|----------|
| **Self-Contained** | `CyberRiskApp-v{VERSION}-Self-Contained-Win-x64.zip` | No .NET required |
| **Framework-Dependent** | `CyberRiskApp-v{VERSION}-Framework-Dependent.zip` | Smaller download |
| **Single File** | `CyberRiskApp-v{VERSION}-Single-File.zip` | Ultra-portable |

**Manual Installation**:
```powershell
# Extract package
Expand-Archive CyberRiskApp-v{VERSION}-*.zip -DestinationPath C:\CyberRiskApp

# Install as service (optional)
cd C:\CyberRiskApp
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -UseWebSetup

# Or run directly
.\CyberRiskApp.exe
```

#### 🐳 **Docker**
```bash
# Download docker-compose.yml from this release
export DB_PASSWORD=your_secure_password
docker-compose up -d

# Access at http://localhost:5000
```

### 🔑 **First-Time Setup**
1. **Install PostgreSQL 16**: https://www.postgresql.org/download/
2. **Run Application**: Use any installation method above
3. **Web Setup**: Navigate to http://localhost:5000/Setup
4. **Configure**: 
   - Admin email and secure password
   - Database connection
   - Organization settings
5. **Access**: Log in with created credentials

### 🛡️ **Security Features**
- 🔐 Secure password generation
- 🔒 Windows Service isolation
- 🛡️ CSRF protection
- 🔑 Role-based access control (Admin/GRC/IT)
- 📝 Audit logging

### 📊 **Key Features**
- **Risk Management**: Qualitative & Quantitative (FAIR) assessments
- **Compliance**: ISO27001, NIST, SOX, GDPR, HIPAA frameworks
- **Maturity Assessments**: NIST CSF 2.0, C2M2
- **Threat Modeling**: MITRE ATT&CK integration
- **Executive Dashboards**: Risk metrics and KPIs
- **Finding Management**: SLA tracking and remediation

### 🆘 **Support & Documentation**
- 📖 **Documentation**: [Wiki](https://github.com/{REPO}/wiki)
- 🐛 **Issues**: [Report bugs](https://github.com/{REPO}/issues)
- 💬 **Discussions**: [Community support](https://github.com/{REPO}/discussions)

### 🔄 **Upgrading**
1. Stop the service: `sc stop CyberRiskApp`
2. Backup database: Use built-in backup feature
3. Install new version (will preserve data)
4. Run database migrations if prompted

### 📝 **Changelog**
See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

---

**Download the appropriate package for your environment and follow the installation guide above.**