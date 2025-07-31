using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public class SSLCertificate
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string CertificateData { get; set; } = string.Empty; // Base64 encoded certificate

        [Required]
        public string PrivateKeyData { get; set; } = string.Empty; // Base64 encoded private key

        public string? Password { get; set; } // For password-protected certificates

        [Required]
        public DateTime ValidFrom { get; set; }

        [Required]
        public DateTime ValidTo { get; set; }

        [Required]
        [StringLength(100)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Issuer { get; set; } = string.Empty;

        [Required]
        [StringLength(40)]
        public string Thumbprint { get; set; } = string.Empty;

        public bool IsActive { get; set; } = false;

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime? UpdatedAt { get; set; }

        public string? UpdatedBy { get; set; }

        // Validation properties
        public bool IsExpired => DateTime.UtcNow > ValidTo;
        public bool IsValid => DateTime.UtcNow >= ValidFrom && DateTime.UtcNow <= ValidTo;
        public int DaysUntilExpiry => (ValidTo - DateTime.UtcNow).Days;
    }

    public class SSLSettings
    {
        [Key]
        public int Id { get; set; }

        public bool EnableHttpsRedirection { get; set; } = false;

        public bool RequireHttps { get; set; } = false;

        public int HttpsPort { get; set; } = 443;

        public int? ActiveCertificateId { get; set; }

        public SSLCertificate? ActiveCertificate { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime? UpdatedAt { get; set; }

        public string? UpdatedBy { get; set; }
    }
}