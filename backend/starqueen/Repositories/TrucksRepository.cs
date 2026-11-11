using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    public class TrucksRepository : GenericRepositories<Trucks>
    {
        public TrucksRepository(IDbConnectionFactory db) : base(db) { }
        // All methods (GetAll, GetById, Add, Update, Delete)
        // are handled by GenericRepositories<Trucks>
    }
}