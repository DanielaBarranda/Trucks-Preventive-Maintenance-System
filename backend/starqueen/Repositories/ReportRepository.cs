using Dapper;
using starqueen.Data;
using starqueen.Models;

namespace starqueen.Repositories
{
    // Report procedures (all scoped to the current organization by Row-Level Security)
    public class ReportRepository
    {
        private readonly IDbConnectionFactory _db;

        public ReportRepository(IDbConnectionFactory db) => _db = db;

        public IEnumerable<FleetOverviewRow> FleetOverview()
        {
            using var c = _db.CreateConnection();
            return c.Query<FleetOverviewRow>("EXEC dbo.rpt_FleetOverview").ToList();
        }

        public IEnumerable<MonthlyExpenseRow> MonthlyExpenses(int? year)
        {
            using var c = _db.CreateConnection();
            return c.Query<MonthlyExpenseRow>("EXEC dbo.rpt_MonthlyExpenses")
                    .Where(r => year == null || r.Year == year)
                    .ToList();
        }

        public IEnumerable<DriverActivityRow> DriverActivity()
        {
            using var c = _db.CreateConnection();
            return c.Query<DriverActivityRow>("EXEC dbo.rpt_DriverActivity").ToList();
        }
    }
}
