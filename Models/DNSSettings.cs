using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ApplicationDomain
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        [Display(Name = "Domain Name")]
        public string DomainName { get; set; } = string.Empty;

        [Display(Name = "Is Primary Domain")]
        public bool IsPrimary { get; set; } = false;

        [Display(Name = "Is Active")]
        public bool IsActive { get; set; } = true;

        [Range(1, 65535)]
        [Display(Name = "HTTP Port")]
        public int HttpPort { get; set; } = 80;

        [Range(1, 65535)]
        [Display(Name = "HTTPS Port")]
        public int HttpsPort { get; set; } = 443;

        [Display(Name = "Force HTTPS")]
        public bool ForceHttps { get; set; } = false;

        [Display(Name = "Enable HSTS")]
        public bool EnableHSTS { get; set; } = false;

        [Range(1, 31536000)]
        [Display(Name = "HSTS Max Age (seconds)")]
        public int HSTSMaxAge { get; set; } = 31536000;

        [StringLength(500)]
        [Display(Name = "Custom Headers")]
        public string? CustomHeaders { get; set; }

        [Column(TypeName = "text")]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime? UpdatedAt { get; set; }

        [StringLength(100)]
        public string? UpdatedBy { get; set; }

        // Navigation properties
        public virtual ICollection<DomainAlias> Aliases { get; set; } = new List<DomainAlias>();

        // Computed properties
        [NotMapped]
        public string FullHttpUrl => $"http://{DomainName}{(HttpPort != 80 ? $":{HttpPort}" : "")}";

        [NotMapped]
        public string FullHttpsUrl => $"https://{DomainName}{(HttpsPort != 443 ? $":{HttpsPort}" : "")}";

        [NotMapped]
        public List<string> CustomHeadersList => 
            string.IsNullOrEmpty(CustomHeaders) 
                ? new List<string>() 
                : CustomHeaders.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .Select(h => h.Trim()).ToList();

        [NotMapped]
        public string SecurityStatus => 
            ForceHttps && EnableHSTS ? "High Security" : 
            ForceHttps ? "HTTPS Only" : 
            "HTTP Allowed";
    }

    public class DomainAlias
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        [Display(Name = "Alias Domain")]
        public string AliasName { get; set; } = string.Empty;

        [Display(Name = "Redirect Type")]
        public RedirectType RedirectType { get; set; } = RedirectType.Permanent;

        [Display(Name = "Is Active")]
        public bool IsActive { get; set; } = true;

        [Required]
        public int ApplicationDomainId { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime? UpdatedAt { get; set; }

        [StringLength(100)]
        public string? UpdatedBy { get; set; }

        // Navigation properties
        public virtual ApplicationDomain ApplicationDomain { get; set; } = null!;
    }

    public enum RedirectType
    {
        Permanent = 301,
        Temporary = 302,
        SeeOther = 303,
        Found = 307,
        PermanentRedirect = 308
    }

    public class DomainAccessLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string RequestedDomain { get; set; } = string.Empty;

        [StringLength(45)]
        public string? ClientIP { get; set; }

        [StringLength(500)]
        public string? UserAgent { get; set; }

        [StringLength(500)]
        public string? RequestPath { get; set; }

        [StringLength(10)]
        public string? RequestMethod { get; set; }

        [Required]
        public DateTime AccessTime { get; set; } = DateTime.UtcNow;

        [Required]
        public int ResponseCode { get; set; }

        public bool WasRedirected { get; set; } = false;

        [StringLength(255)]
        public string? RedirectedTo { get; set; }

        [StringLength(100)]
        public string? MatchedDomainName { get; set; }
    }

    public class DomainStatistics
    {
        public int TotalDomains { get; set; }
        public int ActiveDomains { get; set; }
        public int TotalAliases { get; set; }
        public string? PrimaryDomain { get; set; }
        public int TotalRequests { get; set; }
        public int HttpsRequests { get; set; }
        public int RedirectedRequests { get; set; }
        public List<string> TopDomains { get; set; } = new();
        public Dictionary<string, int> RequestsByDomain { get; set; } = new();
    }
}