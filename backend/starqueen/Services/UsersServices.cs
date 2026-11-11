using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class UsersServices
    {
        public readonly UsersRepository _usersRepository;
        private readonly PasswordService _passwords;

        public UsersServices(UsersRepository usersRepository, PasswordService passwords)
        {
            _usersRepository = usersRepository;
            _passwords = passwords;
        }

        public Users? GetUserById(int id) => _usersRepository.GetById(id);

        public List<Users> GetAllUsers() => _usersRepository.GetAll().ToList();

        public bool DeleteUser(int id) => _usersRepository.Delete(id);

        // Hashes the password before saving
        public bool AddUser(Users user)
        {
            user.password = _passwords.Hash(user.password);
            return _usersRepository.Add(user);
        }

        // Updates profile fields only. The stored password hash is always kept.
        public bool UpdateUser(int id, UserUpdateRequest request, bool allowRoleChange)
        {
            var existing = _usersRepository.GetById(id);
            if (existing == null) return false;

            existing.username = request.username.Trim();
            existing.email = request.email.Trim();
            if (allowRoleChange && !string.IsNullOrWhiteSpace(request.role))
                existing.role = request.role;

            return _usersRepository.Update(existing);
        }

        // Returns the user when the email/password pair is valid, otherwise null
        public Users? Authenticate(string email, string password)
        {
            var user = _usersRepository.GetByEmail(email);
            if (user == null) return null;
            return _passwords.Verify(user.password, password) ? user : null;
        }

        public bool ChangePassword(int userId, string currentPassword, string newPassword)
        {
            var user = _usersRepository.GetById(userId);
            if (user == null || !_passwords.Verify(user.password, currentPassword)) return false;

            return _usersRepository.UpdatePassword(userId, _passwords.Hash(newPassword));
        }

        // One-time upgrade: hashes any password still stored as plain text.
        // Users keep logging in with the same password. Safe to run on every startup.
        public int HashLegacyPasswords()
        {
            int upgraded = 0;
            foreach (var user in _usersRepository.GetAll())
            {
                if (PasswordService.IsHashed(user.password)) continue;
                _usersRepository.UpdatePassword(user.user_id, _passwords.Hash(user.password));
                upgraded++;
            }
            return upgraded;
        }
    }
}
