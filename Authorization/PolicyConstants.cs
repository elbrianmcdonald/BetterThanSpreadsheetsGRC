namespace CyberRiskApp.Authorization
{
    public static class PolicyConstants
    {
        public const string RequireAdminRole = "RequireAdminRole";
        public const string RequireGRCRole = "RequireGRCRole"; // Legacy - kept for backward compatibility
        public const string RequireGRCOrAdminRole = "RequireGRCOrAdminRole"; // Legacy - kept for backward compatibility
        public const string RequireGRCAnalystOrAbove = "RequireGRCAnalystOrAbove";
        public const string RequireGRCManagerOrAdmin = "RequireGRCManagerOrAdmin";
        public const string RequireAnyRole = "RequireAnyRole";
    }
}