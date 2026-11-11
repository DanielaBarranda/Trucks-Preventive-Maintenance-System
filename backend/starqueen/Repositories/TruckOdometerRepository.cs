using starqueen.Data;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Repositories
{
    public class TruckOdometerRepository : GenericRepositories<Truck_Odometer>
    {
        public TruckOdometerRepository(IDbConnectionFactory db) : base(db) { }
    }
}