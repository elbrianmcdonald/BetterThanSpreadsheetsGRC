## 📋 Overview

A Cyber Risk Management and GRC (Governance, Risk & Compliance) platform built with ASP.NET Core 8.0 to be better than using spreadsheets for teams who's budget cannot stretch to enterprise tools.


### 🔥 Key Features

- **🎯 Risk Assessments**: Qualitative and Quantitative (FAIR methodology)
- **📊 Compliance Management**: ISO27001, NIST 800-53r5
- **📈 Maturity Assessments**: NIST Cybersecurity Framework 2.0, C2M2
- **🎭 Threat Modeling**: MITRE ATT&CK framework integration
- **📋 Finding Management**: SLA tracking, remediation workflows
- **👥 User Management**: Role-based access (Admin/GRC/IT)
- **📊 Executive Dashboards**: Risk metrics, KPIs, compliance status
- **🔒 Security-First**: CSRF protection, secure authentication

## 🚀 Quick Start


```

## 🔐 Security

- **Authentication**: ASP.NET Core Identity with role-based access
- **Authorization**: Three-tier system (Admin > GRC > IT)
- **Data Protection**: PostgreSQL with encrypted connections
- **Audit Logging**: Comprehensive activity tracking
- **Secure Setup**: Web-based configuration with generated passwords

## 📊 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Presentation  │    │   Business Logic │    │   Data Access     │
│                 │    │                  │    │                   │
│ • MVC Views     │◄──►│ • Services       │◄──►│ • Entity Framework│
│ • Controllers   │    │ • Domain Models  │    │ • PostgreSQL      │
│ • ViewModels    │    │ • Workflows      │    │ • Repositories    │
└─────────────────┘    └──────────────────┘    └───────────────────┘
```

### Tech Stack
- **Backend**: ASP.NET Core 8.0 MVC
- **Database**: PostgreSQL 16 with Entity Framework Core


## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is proprietary software. See [LICENSE](LICENSE) for details.

## 🆘 Support

## 🎯 Roadmap

- [ ] HIPPA Support
- [ ] SWIFT Support
- [ ] PCI-DSS Support
- [ ] Support features
- [ ] Advanced reporting engine
- [ ] SAML/SSO integration
- [ ] Cloud deployment options

---

