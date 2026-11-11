using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class AdminMaintenanceViewServices
    {
        public readonly AdminMaintenanceViewRepository _repo = new AdminMaintenanceViewRepository();

        // Read-only — no Add, Update, Delete since this is a SQL View
        public List<Admin_Maintenance_View> GetAllMaintenanceView()
        {
            return (List<Admin_Maintenance_View>)_repo.GetAll();
        }

        public Admin_Maintenance_View GetMaintenanceViewById(int id)
        {
            return _repo.GetById(id);
        }
    }
}