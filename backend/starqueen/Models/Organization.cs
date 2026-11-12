namespace starqueen.Models
{
    public class Organization
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CurrencyCode { get; set; } = "PHP";
        public string DistanceUnit { get; set; } = "km";
    }

    // Thrown when an email is already used by any account (in any organization)
    public class DuplicateEmailException : Exception
    {
        public DuplicateEmailException() : base("Email is already registered.") { }
    }
}
