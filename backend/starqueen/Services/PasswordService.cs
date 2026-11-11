using Microsoft.AspNetCore.Identity;
using starqueen.Models;

namespace starqueen.Services
{
    // Hashes and verifies passwords with ASP.NET Core Identity's PasswordHasher
    // (PBKDF2, salted, versioned format). Plain-text passwords are never stored.
    public class PasswordService
    {
        private readonly PasswordHasher<User> _hasher = new();

        public string Hash(string password) => _hasher.HashPassword(null!, password);

        public bool Verify(string storedHash, string password)
        {
            if (!IsHashed(storedHash)) return false;
            var result = _hasher.VerifyHashedPassword(null!, storedHash, password);
            return result != PasswordVerificationResult.Failed;
        }

        // Identity v3 hashes are base64 and start with format marker 0x01.
        public static bool IsHashed(string? value)
        {
            if (string.IsNullOrEmpty(value) || value.Length < 60) return false;
            Span<byte> buffer = stackalloc byte[value.Length];
            return Convert.TryFromBase64String(value, buffer, out int written)
                   && written >= 61
                   && buffer[0] == 0x01;
        }
    }
}
