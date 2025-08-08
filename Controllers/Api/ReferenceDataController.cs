using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Controllers.Api
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class ReferenceDataController : ControllerBase
    {
        private readonly IReferenceDataService _referenceDataService;
        private readonly ILogger<ReferenceDataController> _logger;

        public ReferenceDataController(
            IReferenceDataService referenceDataService,
            ILogger<ReferenceDataController> logger)
        {
            _referenceDataService = referenceDataService;
            _logger = logger;
        }

        // GET: api/referencedata/search/{category}?q=searchTerm
        [HttpGet("search/{category}")]
        public async Task<IActionResult> Search(ReferenceDataCategory category, [FromQuery] string? q)
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
                var result = await _referenceDataService.SearchAsync(category, q ?? string.Empty, userId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching reference data for category {Category}", category);
                return StatusCode(500, new { error = "An error occurred while searching reference data" });
            }
        }

        // GET: api/referencedata/{category}
        [HttpGet("{category}")]
        public async Task<IActionResult> GetByCategory(ReferenceDataCategory category)
        {
            try
            {
                var entries = await _referenceDataService.GetByCategoryAsync(category);
                return Ok(entries);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving reference data for category {Category}", category);
                return StatusCode(500, new { error = "An error occurred while retrieving reference data" });
            }
        }

        // POST: api/referencedata
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create([FromBody] CreateReferenceDataViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var entry = await _referenceDataService.CreateAsync(model, userId);
                
                return Ok(new ReferenceDataViewModel
                {
                    Id = entry.Id,
                    Value = entry.Value,
                    Description = entry.Description
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating reference data entry");
                return StatusCode(500, new { error = "An error occurred while creating the reference data entry" });
            }
        }

        // PUT: api/referencedata/{id}
        [HttpPut("{id}")]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateReferenceDataViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var entry = await _referenceDataService.UpdateAsync(id, model.Value, model.Description ?? string.Empty, userId);
                
                return Ok(new ReferenceDataViewModel
                {
                    Id = entry.Id,
                    Value = entry.Value,
                    Description = entry.Description
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating reference data entry {Id}", id);
                return StatusCode(500, new { error = "An error occurred while updating the reference data entry" });
            }
        }

        // DELETE: api/referencedata/{id}
        [HttpDelete("{id}")]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var result = await _referenceDataService.DeleteAsync(id, userId);
                
                if (!result)
                {
                    return NotFound(new { error = "Reference data entry not found" });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting reference data entry {Id}", id);
                return StatusCode(500, new { error = "An error occurred while deleting the reference data entry" });
            }
        }

        // POST: api/referencedata/migrate
        [HttpPost("migrate")]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> MigrateExistingData()
        {
            try
            {
                var count = await _referenceDataService.MigrateExistingDataAsync();
                return Ok(new { message = $"Successfully migrated {count} reference data entries" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error migrating existing data");
                return StatusCode(500, new { error = "An error occurred while migrating existing data" });
            }
        }

        // GET: api/referencedata/stats
        [HttpGet("stats")]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                var counts = await _referenceDataService.GetCategoryCountsAsync();
                var unusedEntries = await _referenceDataService.GetUnusedEntriesAsync();
                
                return Ok(new
                {
                    categoryCounts = counts,
                    unusedCount = unusedEntries.Count(),
                    categories = Enum.GetValues<ReferenceDataCategory>()
                        .Select(c => new { id = (int)c, name = c.ToString() })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving reference data statistics");
                return StatusCode(500, new { error = "An error occurred while retrieving statistics" });
            }
        }

        // POST: api/referencedata/usage/{id}
        [HttpPost("usage/{id}")]
        public async Task<IActionResult> IncrementUsage(int id)
        {
            try
            {
                await _referenceDataService.IncrementUsageAsync(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error incrementing usage for reference data entry {Id}", id);
                // Don't fail the main operation if usage tracking fails
                return NoContent();
            }
        }

        // POST: api/referencedata/seed
        [HttpPost("seed")]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> SeedData()
        {
            try
            {
                var userId = "System Migration";
                var seededCount = 0;

                // Assets
                var assets = new[]
                {
                    ("Web Application Server", "Main web application hosting server"),
                    ("Database Server", "Primary database server for application data"),
                    ("File Server", "Network file storage server"),
                    ("Email Server", "Corporate email server"),
                    ("Active Directory", "Domain controller and authentication service"),
                    ("Customer Portal", "External customer-facing web portal"),
                    ("CRM System", "Customer relationship management system"),
                    ("ERP System", "Enterprise resource planning system"),
                    ("Backup Server", "Data backup and recovery server"),
                    ("VPN Gateway", "Remote access VPN gateway")
                };

                foreach (var (value, description) in assets)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.Asset,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Business Owners
                var businessOwners = new[]
                {
                    ("John Smith", "IT Director"),
                    ("Sarah Johnson", "Finance Manager"),
                    ("Mike Brown", "Operations Manager"),
                    ("Lisa Davis", "HR Manager"),
                    ("Tom Wilson", "Security Manager"),
                    ("Emily Chen", "Compliance Officer"),
                    ("David Miller", "VP of Technology"),
                    ("Jennifer Taylor", "Customer Service Manager"),
                    ("Robert Garcia", "Sales Director"),
                    ("Amanda White", "Marketing Manager")
                };

                foreach (var (value, description) in businessOwners)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.BusinessOwner,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Business Units
                var businessUnits = new[]
                {
                    ("Information Technology", "IT department and infrastructure"),
                    ("Finance", "Financial operations and accounting"),
                    ("Human Resources", "HR and employee management"),
                    ("Operations", "Business operations and logistics"),
                    ("Sales", "Sales and business development"),
                    ("Marketing", "Marketing and communications"),
                    ("Customer Service", "Customer support and service"),
                    ("Legal", "Legal and compliance department"),
                    ("Executive", "Executive leadership and management"),
                    ("Research & Development", "Product development and innovation")
                };

                foreach (var (value, description) in businessUnits)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.BusinessUnit,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Technical Controls
                var technicalControls = new[]
                {
                    ("Firewall Rules", "Network firewall access control rules"),
                    ("Antivirus Software", "Endpoint antivirus and malware protection"),
                    ("Multi-Factor Authentication", "MFA for user access control"),
                    ("Data Encryption", "Data encryption at rest and in transit"),
                    ("Access Control Lists", "File and system access permissions"),
                    ("Security Monitoring", "SIEM and security event monitoring"),
                    ("Patch Management", "System and software patch management"),
                    ("Backup and Recovery", "Data backup and disaster recovery systems"),
                    ("VPN Access Control", "Remote access VPN restrictions"),
                    ("Database Access Controls", "Database user permissions and roles"),
                    ("Network Segmentation", "Network isolation and segmentation"),
                    ("Intrusion Detection", "Network and host intrusion detection"),
                    ("Security Awareness Training", "Employee security training program"),
                    ("Vulnerability Scanning", "Automated vulnerability assessment tools"),
                    ("Incident Response Plan", "Security incident response procedures")
                };

                foreach (var (value, description) in technicalControls)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.TechnicalControl,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Protective Controls (for threat frequency reduction)
                var protectiveControls = new[]
                {
                    ("Network Firewall", "Perimeter firewall blocking unauthorized network access"),
                    ("Email Security Gateway", "Email filtering and anti-phishing protection"),
                    ("Web Application Firewall", "Application-layer filtering and protection"),
                    ("Access Controls", "User authentication and authorization systems"),
                    ("Network Segmentation", "Isolated network zones and micro-segmentation"),
                    ("Security Awareness Training", "Employee cybersecurity education programs"),
                    ("Endpoint Protection", "Antivirus and endpoint detection/response"),
                    ("Vulnerability Management", "Regular vulnerability scanning and patching"),
                    ("Privileged Access Management", "Elevated access controls and monitoring"),
                    ("Data Loss Prevention", "Outbound data monitoring and blocking"),
                    ("Multi-Factor Authentication", "Additional authentication factor requirements"),
                    ("VPN Access Controls", "Secure remote access restrictions"),
                    ("Physical Security Controls", "Facility access controls and monitoring"),
                    ("Supply Chain Security", "Third-party vendor security requirements"),
                    ("Configuration Management", "Secure system configuration standards")
                };

                foreach (var (value, description) in protectiveControls)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.ProtectiveControl,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Detective Controls (for vulnerability reduction through detection)
                var detectiveControls = new[]
                {
                    ("Security Information Event Management (SIEM)", "Centralized log analysis and correlation for fast attack detection"),
                    ("Intrusion Detection System", "Network-based attack detection and alerting"),
                    ("Host-Based Intrusion Detection", "Endpoint-based threat detection and response"),
                    ("Security Operations Center (SOC)", "24/7 security monitoring and rapid incident response"),
                    ("Network Traffic Analysis", "Real-time behavioral analysis of network communications"),
                    ("User Behavior Analytics", "AI-driven anomalous user activity detection"),
                    ("File Integrity Monitoring", "Real-time critical file and system change detection"),
                    ("Database Activity Monitoring", "Real-time database access and query monitoring"),
                    ("Endpoint Detection and Response (EDR)", "Advanced endpoint threat detection and response"),
                    ("Threat Intelligence Feeds", "Real-time external threat indicator integration"),
                    ("Deception Technology", "Honeypots and decoy systems for early attack detection"),
                    ("Cloud Security Monitoring", "Multi-cloud environment threat detection"),
                    ("Application Performance Monitoring", "Application security and attack detection"),
                    ("Security Orchestration (SOAR)", "Automated threat detection and response coordination"),
                    ("Continuous Security Assessment", "Ongoing vulnerability and threat detection")
                };

                foreach (var (value, description) in detectiveControls)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.DetectiveControl,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Response Controls (for loss magnitude reduction)
                var responseControls = new[]
                {
                    ("Incident Response Plan", "Structured incident response procedures to minimize impact"),
                    ("Data Backup and Recovery", "Regular backups and fast recovery capabilities"),
                    ("Business Continuity Plan", "Procedures to maintain operations during incidents"),
                    ("Disaster Recovery Plan", "IT system recovery and restoration procedures"),
                    ("Cybersecurity Insurance", "Financial protection against cyber losses"),
                    ("Communication Crisis Plan", "Stakeholder communication during security incidents"),
                    ("Legal Response Team", "Legal expertise for breach notification and compliance"),
                    ("Forensic Investigation Capability", "Digital forensics and evidence collection"),
                    ("Public Relations Response", "Reputation management during security incidents"),
                    ("Vendor/Supplier Notification", "Third-party communication and coordination"),
                    ("Customer Notification System", "Rapid customer communication capabilities"),
                    ("Regulatory Compliance Response", "Meeting regulatory notification requirements"),
                    ("Data Loss Minimization", "Procedures to limit data exposure during breaches"),
                    ("System Isolation Procedures", "Rapid containment of compromised systems"),
                    ("Alternative Processing Capabilities", "Backup systems and workaround procedures")
                };

                foreach (var (value, description) in detectiveControls)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.DetectiveControl,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                foreach (var (value, description) in responseControls)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.ResponseControl,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Threat Communities
                var threatCommunities = new[]
                {
                    ("External Hackers", "Malicious actors outside the organization"),
                    ("Nation-State Actors", "Government-sponsored advanced persistent threats"),
                    ("Cybercriminals", "Financially motivated threat actors"),
                    ("Hacktivists", "Ideologically motivated threat actors"),
                    ("Insider Threats", "Malicious or negligent employees and contractors"),
                    ("Competitors", "Business competitors seeking advantage"),
                    ("Organized Crime", "Criminal organizations conducting cyber operations"),
                    ("Script Kiddies", "Inexperienced attackers using existing tools"),
                    ("Terrorist Organizations", "Groups using cyber means for terrorist activities"),
                    ("State-Sponsored Groups", "Government-backed cyber espionage groups")
                };

                foreach (var (value, description) in threatCommunities)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.ThreatCommunity,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                // Threat Actions
                var threatActions = new[]
                {
                    ("Phishing", "Deceptive emails designed to steal credentials or install malware"),
                    ("Malware Deployment", "Installation of malicious software on target systems"),
                    ("Data Exfiltration", "Unauthorized extraction of sensitive information"),
                    ("System Intrusion", "Unauthorized access to computer systems"),
                    ("Denial of Service", "Attacks designed to disrupt system availability"),
                    ("Credential Theft", "Stealing usernames, passwords, and authentication tokens"),
                    ("Social Engineering", "Manipulating people to divulge information or perform actions"),
                    ("SQL Injection", "Exploiting database vulnerabilities through malicious queries"),
                    ("Ransomware", "Encrypting data and demanding payment for decryption"),
                    ("Man-in-the-Middle", "Intercepting communications between two parties"),
                    ("Zero-Day Exploits", "Attacks using previously unknown vulnerabilities"),
                    ("Privilege Escalation", "Gaining higher level access than initially granted"),
                    ("Lateral Movement", "Moving through network after initial compromise"),
                    ("Data Manipulation", "Unauthorized modification of data integrity"),
                    ("Website Defacement", "Unauthorized modification of web content")
                };

                foreach (var (value, description) in threatActions)
                {
                    var model = new CreateReferenceDataViewModel
                    {
                        Category = ReferenceDataCategory.ThreatAction,
                        Value = value,
                        Description = description
                    };
                    await _referenceDataService.CreateAsync(model, userId);
                    seededCount++;
                }

                return Ok(new { message = $"Successfully seeded {seededCount} reference data entries" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding reference data");
                return StatusCode(500, new { error = "An error occurred while seeding reference data" });
            }
        }
    }

    // View model for update operations
    public class UpdateReferenceDataViewModel
    {
        [Required]
        [StringLength(200)]
        [RegularExpression(@"^[a-zA-Z0-9\s\-\._\(\)\[\]&/]+$", ErrorMessage = "Value contains invalid characters")]
        public string Value { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }
    }
}