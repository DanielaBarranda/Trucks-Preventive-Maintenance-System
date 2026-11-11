using starqueen.Data;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Repositories
{
    public class AdminMaintenanceViewRepository : GenericRepositories<Admin_Maintenance_View>
    {
        public AdminMaintenanceViewRepository(IDbConnectionFactory db) : base(db) { }
    }
}