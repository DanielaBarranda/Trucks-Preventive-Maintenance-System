using Dapper;
using System.Data;
using System.Transactions;
using IsolationLevel = System.Transactions.IsolationLevel;

namespace starqueen.Data
{
    public static class DbTransactions
    {
        // `new TransactionScope()` defaults to Serializable, which takes range locks and
        // deadlocks under concurrent requests. All multi-step writes use Read Committed;
        // work that must not run twice at once on the same vehicle takes LockVehicle.
        public static TransactionScope ReadCommitted() => new(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted });

        // Serializes maintenance work on one vehicle (alert evaluation, recording a service)
        // until the surrounding transaction ends. Vehicle ids are unique across organizations.
        public static void LockVehicle(IDbConnection connection, int vehicleId)
        {
            var p = new DynamicParameters();
            p.Add("@Resource", $"vehicle-maintenance:{vehicleId}");
            p.Add("@LockMode", "Exclusive");
            p.Add("@LockOwner", "Transaction");
            p.Add("@LockTimeout", 15000);
            p.Add("@result", dbType: DbType.Int32, direction: ParameterDirection.ReturnValue);
            connection.Execute("sp_getapplock", p, commandType: CommandType.StoredProcedure);

            // 0 = granted, 1 = granted after waiting; negative = timeout/deadlock/error
            if (p.Get<int>("@result") < 0)
                throw new TimeoutException($"Could not lock vehicle {vehicleId} for maintenance updates.");
        }
    }
}
