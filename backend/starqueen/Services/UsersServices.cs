using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class UsersServices
    {
        public readonly UsersRepository _usersRepository = new UsersRepository();

        // 1. GetById
        public Users GetUserById(int id)
        {
            return _usersRepository.GetById(id);
        }

        // 2. Add
        public bool AddUser(Users user)
        {
            return _usersRepository.Add(user);
        }

        // 3. Delete
        public bool DeleteUser(int id)
        {
            return _usersRepository.Delete(id);
        }

        // 4. Get All
        public List<Users> GetAllUsers()
        {
            return (List<Users>)_usersRepository.GetAll();
        }

        // 5. Update
        public bool UpdateUser(Users user)
        {
            return _usersRepository.Update(user);
        }
    }
}