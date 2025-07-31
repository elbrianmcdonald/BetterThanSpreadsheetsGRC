namespace CyberRiskApp.Authorization
{
    public static class PolicyConstants
    {
        public const string RequireAdminRole = "RequireAdminRole";
        public const string RequireGRCRole = "RequireGRCRole";
        public const string RequireGRCOrAdminRole = "RequireGRCOrAdminRole";
        public const string RequireAnyRole = "RequireAnyRole";
    }
}