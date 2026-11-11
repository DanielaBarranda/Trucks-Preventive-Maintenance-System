using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class AdminMaintenanceViewServices
    {
        public readonly AdminMaintenanceViewRepository _repo;

        public AdminMaintenanceViewServices(AdminMaintenanceViewRepository repo)
        {
            _repo = repo;
        }

        // Read-only — no Add, Update, Delete since this is a SQL View
        public List<Admin_Maintenance_View> GetAllMaintenanceView()
        {
            return _repo.GetAll().ToList();
        }

        public Admin_Maintenance_View? GetMaintenanceViewById(int id)
        {
            return _repo.GetById(id);
        }
    }
}