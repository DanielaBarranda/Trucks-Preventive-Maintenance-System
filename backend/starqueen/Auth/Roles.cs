namespace starqueen.Auth
{
    // Values stored in Users.role
    public static class Roles
    {
        public const string Owner = "Owner";
        public const string Admin = "Admin";
        public const string Driver = "Driver";

        public static readonly string[] All = { Owner, Admin, Driver };
    }
}
