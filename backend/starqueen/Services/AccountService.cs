using Microsoft.Data.SqlClient;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    // Creates and manages Admin and Driver accounts in the current organization.
    // New accounts and password resets use a temporary password that must be changed at first login.
    public class AccountService
    {
        private readonly UserRepository _users;
        private readonly PasswordService _passwords;

        public AccountService(UserRepository users, PasswordService passwords)
        {
            _users = users;
            _passwords = passwords;
        }

        public IEnumerable<AccountSummary> List(string role) => _users.ListByRole(role);

        // Throws DuplicateEmailException when the email is used by any account
        public int Create(string role, string fullName, string email, string temporaryPassword)
        {
            if (_users.EmailExists(email)) throw new DuplicateEmailException();
            try
            {
                return _users.Create(role, fullName, email, _passwords.Hash(temporaryPassword), mustChangePassword: true);
            }
            catch (SqlException ex) when (ex.Number is 2627 or 2601)
            {
                throw new DuplicateEmailException();
            }
        }

        public bool Update(int id, string role, string fullName, string email, bool isActive)
        {
            var other = _users.FindByEmailForLogin(email);
            if (other != null && other.Id != id) throw new DuplicateEmailException();
            return _users.UpdateProfile(id, role, fullName, email, isActive);
        }

        public bool ResetPassword(int id, string role, string temporaryPassword) =>
            _users.SetPasswordForRole(id, role, _passwords.Hash(temporaryPassword), mustChange: true);
    }
}
