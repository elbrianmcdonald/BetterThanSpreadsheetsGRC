using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public interface IAuditableEntity
    {
        DateTime CreatedAt { get; set; }
        DateTime UpdatedAt { get; set; }
        string CreatedBy { get; set; }
        string UpdatedBy { get; set; }
        
        [Timestamp]
        byte[]? RowVersion { get; set; }
    }
}