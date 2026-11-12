namespace starqueen.Auth
{
    // Role-based access control: each role maps to a fixed set of permissions.
    // Endpoints check permissions (never role names), so changing what a role
    // can do is a one-line change here.
    public static class Permissions
    {
        public const string OrgManage = "org.manage";
        public const string AdminsManage = "admins.manage";
        public const string DriversManage = "drivers.manage";
        public const string VehiclesManage = "vehicles.manage";
        public const string SchedulesManage = "schedules.manage";
        public const string ReportsView = "reports.view";
        public const string AlertsManage = "alerts.manage";
        public const string LogsSubmit = "logs.submit";

        public static readonly string[] All =
        {
            OrgManage, AdminsManage, DriversManage, VehiclesManage,
            SchedulesManage, ReportsView, AlertsManage, LogsSubmit
        };

        private static readonly string[] AdminPermissions =
        {
            DriversManage, VehiclesManage, SchedulesManage, ReportsView, AlertsManage
        };

        private static readonly Dictionary<string, string[]> ByRole = new()
        {
            [Roles.Owner] = AdminPermissions.Concat(new[] { OrgManage, AdminsManage }).ToArray(),
            [Roles.Admin] = AdminPermissions,
            [Roles.Driver] = new[] { LogsSubmit },
        };

        public static IReadOnlyList<string> ForRole(string role) =>
            ByRole.TryGetValue(role, out var permissions) ? permissions : Array.Empty<string>();

        public static string[] RolesWith(string permission) =>
            ByRole.Where(kv => kv.Value.Contains(permission)).Select(kv => kv.Key).ToArray();
    }
}
