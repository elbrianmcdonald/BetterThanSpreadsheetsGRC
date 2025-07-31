namespace CyberRiskApp.Models
{
    public class UserManagementViewModel
    {
        public List<User> Users { get; set; } = new List<User>();
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int AdminUsers { get; set; }
        public int GRCUsers { get; set; }
        public int ITUsers { get; set; }
    }
}