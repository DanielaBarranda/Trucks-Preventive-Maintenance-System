using starqueen.Data;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Repositories
{
    public class MaintenanceReferenceRepository : GenericRepositories<Maintenance_Reference>
    {
        public MaintenanceReferenceRepository(IDbConnectionFactory db) : base(db) { }
    }
}