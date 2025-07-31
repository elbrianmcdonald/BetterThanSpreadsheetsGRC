using CyberRiskApp.Models;

namespace CyberRiskApp.Data
{
    public static class SampleDataSeeder
    {
        public static void SeedSampleData(CyberRiskContext context)
        {
            if (!context.Findings.Any())
            {
                var sampleFindings = new List<Finding>
                {
                    new Finding
                    {
                        FindingNumber = "2025-0001",
                        Title = "Unpatched Windows Servers",
                        Details = "Critical security patches missing on 15 Windows Server instances. CVE-2024-1234 allows remote code execution with SYSTEM privileges. Affected servers are accessible from the corporate network.",
                        Impact = ImpactLevel.High,
                        Likelihood = LikelihoodLevel.Likely,
                        Exposure = ExposureLevel.ModeratelyExposed,
                        RiskRating = RiskRating.High,
                        Status = FindingStatus.Open,
                        Owner = "IT Operations Team",
                        Domain = "Infrastructure",
                        BusinessUnit = "Corporate IT",
                        BusinessOwner = "John Smith",
                        OpenDate = DateTime.Today.AddDays(-10),
                        SlaDate = DateTime.Today.AddDays(20),
                        Asset = "Windows Server Farm (DC01-DC15)"
                    },
                    new Finding
                    {
                        FindingNumber = "2025-0002",
                        Title = "Weak Password Policy",
                        Details = "Current Active Directory password policy allows passwords as short as 6 characters with no complexity requirements. This significantly increases the risk of successful brute force and dictionary attacks.",
                        Impact = ImpactLevel.Medium,
                        Likelihood = LikelihoodLevel.AlmostCertain,
                        Exposure = ExposureLevel.HighlyExposed,
                        RiskRating = RiskRating.High,
                        Status = FindingStatus.Open,
                        Owner = "Security Team",
                        Domain = "Identity Management",
                        BusinessUnit = "Information Technology",
                        BusinessOwner = "Sarah Johnson",
                        OpenDate = DateTime.Today.AddDays(-5),
                        SlaDate = DateTime.Today.AddDays(30),
                        Asset = "Active Directory Domain Controller"
                    },
                    new Finding
                    {
                        FindingNumber = "2025-0003",
                        Title = "Missing SSL Certificate on Internal Web App",
                        Details = "The HR portal at hr.internal.company.com is using HTTP instead of HTTPS, transmitting login credentials and personal data in clear text.",
                        Impact = ImpactLevel.Medium,
                        Likelihood = LikelihoodLevel.Possible,
                        Exposure = ExposureLevel.Exposed,
                        RiskRating = RiskRating.Medium,
                        Status = FindingStatus.Open,
                        Owner = "Web Development Team",
                        Domain = "Applications",
                        BusinessUnit = "Human Resources",
                        BusinessOwner = "Mike Wilson",
                        OpenDate = DateTime.Today.AddDays(-2),
                        SlaDate = DateTime.Today.AddDays(45),
                        Asset = "HR Portal Application"
                    }
                };

                context.Findings.AddRange(sampleFindings);
                context.SaveChanges();
            }
        }
    }
}