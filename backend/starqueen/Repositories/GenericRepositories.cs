using Dapper;
using Microsoft.Data.SqlClient;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Data;
using System.Reflection;

namespace starqueen.Repositories
{
    public class GenericRepositories<T> : IGenericRepository<T> where T : class
    {
        IDbConnection connection;

        readonly string connectionString =
            "Server=(localdb)\\MSSQLLocalDB;Database=Starqueen_PMTS;" +
            "Trusted_Connection=True;MultipleActiveResultSets=True";

        public GenericRepositories()
        {
            connection = new SqlConnection(connectionString);
        }

        // Get SELECT clause with column aliases (col AS PropertyName)
        public string GetSelectClause()
        {
            var props = typeof(T).GetProperties();
            var clauses = props.Select(p =>
            {
                var colAttr = p.GetCustomAttribute<ColumnAttribute>();
                string colName = colAttr != null ? colAttr.Name : p.Name;
                return $"{colName} AS {p.Name}";
            });
            return string.Join(", ", clauses);
        }

        // ========================================
        // GET BY ID
        // ========================================
        public T GetById(int id)
        {
            string tableName = GetTableName();
            string keyColumn = GetKeyColumnName();
            string selectClause = GetSelectClause();
            string query = $"SELECT {selectClause} FROM {tableName} WHERE {keyColumn} = @Id";
            return connection.QueryFirstOrDefault<T>(query, new { Id = id });
        }

        // ========================================
        // GET ALL
        // ========================================
        public IEnumerable<T> GetAll()
        {
            string tableName = GetTableName();
            string selectClause = GetSelectClause();
            string query = $"SELECT {selectClause} FROM {tableName}";
            return connection.Query<T>(query).ToList();
        }

        // ========================================
        // ADD
        // ========================================
        public bool Add(T Entity)
        {
            string tableName = GetTableName();
            string columns = GetColumnNames();
            string values = GetColumnValues();
            string query = $"INSERT INTO {tableName} ({columns}) VALUES ({values})";
            int affectedRow = connection.Execute(query, Entity);
            return affectedRow == 1;
        }

        // ========================================
        // UPDATE
        // ========================================
        public bool Update(T Entity)
        {
            string tableName = GetTableName();
            string keyColumn = GetKeyColumnName();
            string keyProperty = GetKeyPropertyName();

            // Build SET clause — exclude the key column
            var setClause = typeof(T).GetProperties()
                .Where(p => p.GetCustomAttribute<KeyAttribute>() == null)
                .Select(p =>
                {
                    var columnAttr = p.GetCustomAttribute<ColumnAttribute>();
                    string colName = columnAttr != null ? columnAttr.Name : p.Name;
                    return $"{colName} = @{p.Name}";
                });

            string query = $"UPDATE {tableName} SET {string.Join(", ", setClause)} WHERE {keyColumn} = @{keyProperty}";
            int affectedRow = connection.Execute(query, Entity);
            return affectedRow == 1;
        }

        // ========================================
        // DELETE
        // ========================================
        public bool Delete(int id)
        {
            string tableName = GetTableName();
            string keyColumn = GetKeyColumnName();
            string query = $"DELETE FROM {tableName} WHERE {keyColumn} = @Id";
            int affectedRow = connection.Execute(query, new { Id = id });
            return affectedRow == 1;
        }

        // ========================================
        // HELPERS
        // ========================================

        // Get table name from [Table] attribute
        public string GetTableName()
        {
            var type = typeof(T);
            var tableAttr = type.GetCustomAttribute<TableAttribute>();
            return tableAttr != null ? $"[{tableAttr.Name}]" : $"[{type.Name}]";
        }

        // Get the primary key column name from [Key] + [Column] attributes
        public string GetKeyColumnName()
        {
            var keyProp = typeof(T).GetProperties()
                .FirstOrDefault(p => p.IsDefined(typeof(KeyAttribute)));

            if (keyProp == null) return "Id";

            var columnAttr = keyProp.GetCustomAttribute<ColumnAttribute>();
            return columnAttr != null ? columnAttr.Name : keyProp.Name;
        }

        // Get the primary key property name
        public string GetKeyPropertyName()
        {
            var keyProp = typeof(T).GetProperties()
                .FirstOrDefault(p => p.IsDefined(typeof(KeyAttribute)));
            return keyProp?.Name ?? "Id";
        }

        // Get all column names excluding key
        public string GetColumnNames(bool excludeKey = true)
        {
            var type = typeof(T);
            var columns = string.Join(", ", type.GetProperties()
                .Where(p => !excludeKey || !p.IsDefined(typeof(KeyAttribute)))
                .Select(p =>
                {
                    var columnAttr = p.GetCustomAttribute<ColumnAttribute>();
                    return columnAttr != null ? columnAttr.Name : p.Name;
                }));
            return columns;
        }

        // Get all column value placeholders excluding key
        public string GetColumnValues(bool excludeKey = true)
        {
            var values = string.Join(", ", typeof(T).GetProperties()
                .Where(p => !excludeKey || p.GetCustomAttribute<KeyAttribute>() == null)
                .Select(p => $"@{p.Name}"));
            return values;
        }

        // ── Insert odometer update notification ─────────────────────
        // Called every time a driver submits an odometer reading.
        // Always inserts a new Information notification — keeps full history.
        public void InsertOdometerNotification(int truckId, int currentKm)
        {
            using IDbConnection connection = new SqlConnection(connectionString);

            // Get truck info
            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
          FROM   Trucks
          WHERE  truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            string message = $"{truckName} ({truckType}) {plateNumber} odometer updated to " +
                             $"{currentKm:N0} KM on {DateTime.Now:MMMM dd, yyyy}";

            connection.Execute(@"
        INSERT INTO Admin_Notifications
            (truck_id, maintenance_id, type, message, maintenance_task,
             is_read, is_resolved, resolved_at, created_at)
        VALUES
            (@TruckId, NULL, 'Information', @Message, NULL,
             0, 0, NULL, @Now)",
                new
                {
                    TruckId = truckId,
                    Message = message,
                    Now = DateTime.Now
                }
            );
        }


    }
}