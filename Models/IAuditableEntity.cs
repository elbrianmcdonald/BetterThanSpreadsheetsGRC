using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    /// <summary>
    /// Base entity interface that provides Id property
    /// </summary>
    public interface IEntity
    {
        int Id { get; set; }
    }

    /// <summary>
    /// Auditable entity interface that extends IEntity with audit fields
    /// </summary>
    public interface IAuditableEntity : IEntity
    {
        DateTime CreatedAt { get; set; }
        DateTime UpdatedAt { get; set; }
        string CreatedBy { get; set; }
        string UpdatedBy { get; set; }
        
        [Timestamp]
        byte[]? RowVersion { get; set; }
    }
}