using starqueen.Data;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Repositories
{
    public class TruckNotificationsRepository : GenericRepositories<Truck_Notifications>
    {
        public TruckNotificationsRepository(IDbConnectionFactory db) : base(db) { }
    }
}