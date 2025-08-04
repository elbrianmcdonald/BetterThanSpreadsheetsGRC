# 🛡️ CyberRisk Management Platform

[![Build Status](https://github.com/YourUsername/CyberRiskPlatform/workflows/Build%20and%20Release%20Installer/badge.svg)](https://github.com/YourUsername/CyberRiskPlatform/actions)
[![Release](https://img.shields.io/github/v/release/YourUsername/CyberRiskPlatform)](https://github.com/YourUsername/CyberRiskPlatform/releases)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

## 📋 Overview

Enterprise-grade Cyber Risk Management and GRC (Governance, Risk & Compliance) platform built with ASP.NET Core 8.0. Streamline your organization's cybersecurity risk assessments, compliance management, and maturity evaluations.

### 🔥 Key Features

- **🎯 Risk Assessments**: Qualitative and Quantitative (FAIR methodology)
- **📊 Compliance Management**: ISO27001, NIST, SOX, GDPR, HIPAA frameworks
- **📈 Maturity Assessments**: NIST Cybersecurity Framework 2.0, C2M2
- **🎭 Threat Modeling**: MITRE ATT&CK framework integration
- **📋 Finding Management**: SLA tracking, remediation workflows
- **👥 User Management**: Role-based access (Admin/GRC/IT)
- **📊 Executive Dashboards**: Risk metrics, KPIs, compliance status
- **🔒 Security-First**: CSRF protection, secure authentication

## 🚀 Quick Start

### Option 1: Windows Installer (Recommended)
1. Download `CyberRiskApp-Setup-v{VERSION}.exe` from [Releases](https://github.com/YourUsername/CyberRiskPlatform/releases)
2. Run installer as Administrator
3. Complete setup at http://localhost:5000/Setup

### Option 2: Portable Package
```powershell
# Download and extract
Expand-Archive CyberRiskApp-v{VERSION}-Self-Contained-Win-x64.zip

# Run installation script
cd CyberRiskApp
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -UseWebSetup
```

### Option 3: Docker
```bash
git clone https://github.com/YourUsername/CyberRiskPlatform.git
cd CyberRiskPlatform
export DB_PASSWORD=your_secure_password
docker-compose up -d
```

## 🔧 Development Setup

### Prerequisites
- .NET 8.0 SDK
- PostgreSQL 16+
- Visual Studio 2022 or VS Code

### Local Development
```bash
git clone https://github.com/YourUsername/CyberRiskPlatform.git
cd CyberRiskPlatform/CyberRiskApp/CyberRiskApp/CyberRiskApp

# Restore packages
dotnet restore

# Update database
dotnet ef database update

# Run application
dotnet run

# Navigate to http://localhost:5197/Setup
```

## 📦 Distribution Packages

| Package Type | Best For | Size | Requirements |
|--------------|----------|------|--------------|
| **Windows Installer** | End users | ~150MB | Windows 10/11 |
| **Self-Contained** | Servers without .NET | ~200MB | Windows x64 |
| **Framework-Dependent** | .NET environments | ~50MB | .NET 8 Runtime |
| **Single File** | Portable deployment | ~180MB | Windows x64 |
| **Docker** | Containerized deployment | ~500MB | Docker |

## 🏗️ Building Releases

### Automated (GitHub Actions)
Push a version tag to trigger automated builds:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Manual Build
```powershell
# Build all distribution packages
.\build-release.ps1 -Version "1.0.0" -CreateTag

# Or use specific build scripts
.\publish-simple.ps1        # Framework-dependent
.\create-installer.ps1      # Windows installer
```

## 🔐 Security

- **Authentication**: ASP.NET Core Identity with role-based access
- **Authorization**: Three-tier system (Admin > GRC > IT)
- **Data Protection**: PostgreSQL with encrypted connections
- **CSRF Protection**: Anti-forgery tokens on all forms
- **Audit Logging**: Comprehensive activity tracking
- **Secure Setup**: Web-based configuration with generated passwords

## 📊 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Presentation  │    │   Business Logic │    │   Data Access   │
│                 │    │                  │    │                 │
│ • MVC Views     │◄──►│ • Services       │◄──►│ • Entity Framework│
│ • Controllers   │    │ • Domain Models  │    │ • PostgreSQL    │
│ • ViewModels    │    │ • Workflows      │    │ • Repositories  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Tech Stack
- **Backend**: ASP.NET Core 8.0 MVC
- **Database**: PostgreSQL 16 with Entity Framework Core
- **Frontend**: Bootstrap 5, jQuery, Select2
- **Authentication**: ASP.NET Core Identity
- **Deployment**: Windows Service, Docker, IIS

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is proprietary software. See [LICENSE](LICENSE) for details.

## 🆘 Support

- 📖 **Documentation**: [Wiki](https://github.com/YourUsername/CyberRiskPlatform/wiki)
- 🐛 **Bug Reports**: [Issues](https://github.com/YourUsername/CyberRiskPlatform/issues)
- 💬 **Discussions**: [Community](https://github.com/YourUsername/CyberRiskPlatform/discussions)
- 📧 **Enterprise Support**: contact@cyberrisk.local

## 🎯 Roadmap

- [ ] Multi-tenant support
- [ ] API endpoints for integrations
- [ ] Mobile-responsive dashboards
- [ ] Advanced reporting engine
- [ ] SAML/SSO integration
- [ ] Cloud deployment options

---

<div align="center">
  <strong>Built with ❤️ for cybersecurity professionals</strong>
</div>