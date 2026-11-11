using Dapper;
using starqueen.Data;
using starqueen.Models;
using System.Data;
using System.Transactions;

namespace starqueen.Repositories
{
    public class AdminNotificationsRepository : GenericRepositories<Admin_Notifications>
    {
        public AdminNotificationsRepository(IDbConnectionFactory db) : base(db) { }

        // ── Mark single notification as read ────────────────────────────────
        public bool MarkAsRead(int id)
        {
            using IDbConnection connection = CreateConnection();
            int rows = connection.Execute(
                "UPDATE [Admin_Notifications] SET is_read = 1 WHERE admin_notification_id = @Id",
                new { Id = id }
            );
            return rows > 0;
        }

        // ── Mark all notifications as read ──────────────────────────────────
        public bool MarkAllAsRead()
        {
            using IDbConnection connection = CreateConnection();
            connection.Execute(
                "UPDATE [Admin_Notifications] SET is_read = 1 WHERE is_read = 0"
            );
            return true;
        }

        // ── SP: SP_Unread_Maintenance_Notifications_Per_Truck ────────────────
        public IEnumerable<dynamic> GetUnreadMaintenanceNotificationsPerTruck()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<dynamic>(
                "EXEC SP_Unread_Maintenance_Notifications_Per_Truck"
            ).ToList();
        }

        // ── VIEW: VW_Notification_Acknowledgement_Rate ───────────────────────
        public IEnumerable<dynamic> GetNotificationAcknowledgementRate()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<dynamic>(
                "SELECT * FROM VW_Notification_Acknowledgement_Rate"
            ).ToList();
        }

        // ── SP: SP_Notification_Acknowledgement_Rate ─────────────────────────
        public IEnumerable<dynamic> GetAcknowledgementRateViaSP()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<dynamic>(
                "EXEC SP_Notification_Acknowledgement_Rate"
            ).ToList();
        }

        // ── SP: SP_Admin_Dashboard_Truck_Overview ────────────────────────────
        public IEnumerable<dynamic> GetAdminDashboardTruckOverview()
        {
            using IDbConnection connection = CreateConnection();
            return connection.Query<dynamic>(
                "EXEC SP_Admin_Dashboard_Truck_Overview"
            ).ToList();
        }

        // ── Check thresholds and insert notifications (no duplicates) ────────
        public void CheckAndInsertNotifications(int truckId, int currentKm)
        {
            // All writes below succeed or fail together
            using var scope = new TransactionScope();
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckType = truck.truck_type ?? "";
            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";

            var references = connection.Query<Maintenance_Reference>(
                "SELECT * FROM Maintenance_Reference WHERE truck_type = @TruckType",
                new { TruckType = truckType }
            ).ToList();

            foreach (var reference in references)
            {
                string status = CalculateStatus(currentKm, reference);

                if (status == "Good" || status == "No Data")
                {
                    connection.Execute(@"
                        UPDATE Admin_Notifications
                        SET    is_resolved = 1, resolved_at = @Now
                        WHERE  truck_id         = @TruckId
                          AND  maintenance_task = @Task
                          AND  is_resolved      = 0
                          AND  type IN ('Urgent', 'Warning')",
                        new { TruckId = truckId, Task = reference.maintenance_task, Now = DateTime.Now }
                    );
                    continue;
                }

                int existing = connection.ExecuteScalar<int>(@"
                    SELECT COUNT(1) FROM Admin_Notifications
                    WHERE  truck_id         = @TruckId
                      AND  maintenance_task = @Task
                      AND  is_resolved      = 0",
                    new { TruckId = truckId, Task = reference.maintenance_task }
                );

                if (existing > 0) continue;

                string type = (status == "Overdue" || status == "Replace") ? "Urgent" : "Warning";
                string message = status == "Overdue"
                    ? $"{reference.maintenance_task} overdue for replacement on {truckName} ({truckType})"
                    : status == "Replace"
                    ? $"{reference.maintenance_task} needs replacement on {truckName} ({truckType})"
                    : $"{reference.maintenance_task} approaching replacement interval on {truckName} ({truckType})";

                int maintenanceId = connection.ExecuteScalar<int>(@"
                    INSERT INTO Truck_Maintenance_Logs
                        (current_km, status, resolved, truck_id, reference_id, created_at)
                    VALUES (@CurrentKm, @Status, 'No', @TruckId, @ReferenceId, @Now);
                    SELECT SCOPE_IDENTITY();",
                    new
                    {
                        CurrentKm = currentKm,
                        Status = status,
                        TruckId = truckId,
                        ReferenceId = reference.reference_id,
                        Now = DateTime.Now
                    }
                );

                connection.Execute(@"
                    INSERT INTO Admin_Notifications
                        (truck_id, maintenance_id, type, message, maintenance_task,
                         is_read, is_resolved, resolved_at, created_at)
                    VALUES (@TruckId, @MaintenanceId, @Type, @Message, @MaintenanceTask,
                            0, 0, NULL, @Now)",
                    new
                    {
                        TruckId = truckId,
                        MaintenanceId = maintenanceId,
                        Type = type,
                        Message = message,
                        MaintenanceTask = reference.maintenance_task,
                        Now = DateTime.Now
                    }
                );
            }

            scope.Complete();
        }

        // ── Insert odometer update notification ──────────────────────────────
        public void InsertOdometerNotification(int truckId, int currentKm)
        {
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            string message = $"Odometer updated: {truckName} ({truckType}) {plateNumber} " +
                             $"logged {currentKm:N0} KM on {DateTime.Now:MMMM dd, yyyy hh:mm tt}.";

            connection.Execute(@"
                INSERT INTO Admin_Notifications
                    (truck_id, maintenance_id, type, message, maintenance_task,
                     is_read, is_resolved, resolved_at, created_at)
                VALUES (@TruckId, NULL, 'Information', @Message, 'Odometer Update',
                        0, 0, NULL, @Now)",
                new { TruckId = truckId, Message = message, Now = DateTime.Now }
            );
        }

        // ── Insert expense notification ───────────────────────────────────────
        public void InsertExpenseNotification(int truckId, string expenseType, decimal amount)
        {
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            string message = $"Expense submitted: {truckName} ({truckType}) {plateNumber} — " +
                             $"{expenseType} worth ₱{amount:N2} on {DateTime.Now:MMMM dd, yyyy hh:mm tt}.";

            connection.Execute(@"
                INSERT INTO Admin_Notifications
                    (truck_id, maintenance_id, type, message, maintenance_task,
                     is_read, is_resolved, resolved_at, created_at)
                VALUES (@TruckId, NULL, 'Information', @Message, @ExpenseType,
                        0, 0, NULL, @Now)",
                new
                {
                    TruckId = truckId,
                    Message = message,
                    ExpenseType = expenseType,
                    Now = DateTime.Now
                }
            );
        }

        // ── Resolve notification and insert resolution notification ───────────
        // FIXED: Now also updates Truck_Maintenance_Logs.resolved = 'Yes'
        // so the admin modal and driver maintenance log both reflect resolved state
        public void ResolveNotificationAndNotify(int truckId, string expenseType)
        {
            // All writes below succeed or fail together
            using var scope = new TransactionScope();
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            // Prefer an exact task match (the driver form pre-fills the exact task name).
            // Fall back to a partial match only when nothing matches exactly, so a short
            // category like "Oil" can't resolve unrelated tasks when an exact one exists.
            const string exactFilter = "maintenance_task = @Task";
            const string likeFilter  = "maintenance_task LIKE @LikeTask";
            var taskParams = new { TruckId = truckId, Task = expenseType, LikeTask = $"%{expenseType}%" };

            string taskFilter = exactFilter;
            var resolved = FindOpenAlerts(connection, taskFilter, taskParams);
            if (!resolved.Any())
            {
                taskFilter = likeFilter;
                resolved = FindOpenAlerts(connection, taskFilter, taskParams);
            }

            if (!resolved.Any()) return;

            // ── Step 1: Resolve Admin_Notifications ──────────────────────────
            connection.Execute($@"
                UPDATE Admin_Notifications
                SET    is_resolved = 1, resolved_at = @Now
                WHERE  truck_id    = @TruckId
                  AND  {taskFilter}
                  AND  is_resolved = 0
                  AND  type        IN ('Urgent', 'Warning')",
                new { TruckId = truckId, taskParams.Task, taskParams.LikeTask, Now = DateTime.Now }
            );

            // ── Step 2: FIXED — Also resolve Truck_Maintenance_Logs ──────────
            // This ensures the admin modal and driver maintenance log
            // both show the correct resolved state after expense submission
            connection.Execute($@"
                UPDATE Truck_Maintenance_Logs
                SET    resolved = 'Yes'
                WHERE  truck_id     = @TruckId
                  AND  reference_id IN (
                      SELECT reference_id
                      FROM   Maintenance_Reference
                      WHERE  {taskFilter}
                  )
                  AND  resolved = 'No'",
                taskParams
            );

            // ── Step 3: Insert resolution notification ───────────────────────
            string actualTask = resolved[0].maintenance_task ?? expenseType;
            string resolveMessage =
                $"Maintenance resolved: {truckName} ({truckType}) {plateNumber} — " +
                $"{actualTask} resolved by driver on {DateTime.Now:MMMM dd, yyyy hh:mm tt}.";

            connection.Execute(@"
                INSERT INTO Admin_Notifications
                    (truck_id, maintenance_id, type, message, maintenance_task,
                     is_read, is_resolved, resolved_at, created_at)
                VALUES (@TruckId, NULL, 'Information', @Message, @MaintenanceTask,
                        0, 0, NULL, @Now)",
                new
                {
                    TruckId = truckId,
                    Message = resolveMessage,
                    MaintenanceTask = actualTask,
                    Now = DateTime.Now
                }
            );

            scope.Complete();
        }

        private static List<dynamic> FindOpenAlerts(IDbConnection connection, string taskFilter, object param)
            => connection.Query<dynamic>($@"
                SELECT admin_notification_id, maintenance_task
                FROM   Admin_Notifications
                WHERE  truck_id    = @TruckId
                  AND  {taskFilter}
                  AND  is_resolved = 0
                  AND  type        IN ('Urgent', 'Warning')", param).ToList();

        // ── Threshold calculator (KM-based) ──────────────────────────────────
        private string CalculateStatus(int currentKm, Maintenance_Reference reference)
        {
            if (reference.km_overdue.HasValue && currentKm >= reference.km_overdue.Value)
                return "Overdue";
            if (reference.km_replace.HasValue && currentKm >= reference.km_replace.Value)
                return "Replace";
            if (reference.km_warning.HasValue && currentKm >= reference.km_warning.Value)
                return "Warning";
            return "Good";
        }

        // ── Check thresholds by MONTH per component ──────────────────────────
        public void CheckAndInsertNotificationsByMonth(
            int truckId,
            List<ComponentMaintenanceDate> components)
        {
            // All writes below succeed or fail together
            using var scope = new TransactionScope();
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckType = truck.truck_type ?? "";
            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";

            foreach (var comp in components)
            {
                var reference = connection.QueryFirstOrDefault<Maintenance_Reference>(
                    "SELECT * FROM Maintenance_Reference WHERE reference_id = @ReferenceId",
                    new { ReferenceId = comp.reference_id }
                );
                if (reference == null) continue;
                if (!reference.month_interval.HasValue) continue;

                int monthsElapsed = WholeMonthsBetween(comp.last_maintenance_date, DateTime.Now);

                string status = CalculateStatusByMonth(monthsElapsed, reference.month_interval.Value);

                if (status == "Good")
                {
                    connection.Execute(@"
                        UPDATE Admin_Notifications
                        SET    is_resolved = 1, resolved_at = @Now
                        WHERE  truck_id         = @TruckId
                          AND  maintenance_task = @Task
                          AND  is_resolved      = 0
                          AND  type IN ('Urgent', 'Warning')",
                        new { TruckId = truckId, Task = reference.maintenance_task, Now = DateTime.Now }
                    );
                    continue;
                }

                int existing = connection.ExecuteScalar<int>(@"
                    SELECT COUNT(1) FROM Admin_Notifications
                    WHERE  truck_id         = @TruckId
                      AND  maintenance_task = @Task
                      AND  is_resolved      = 0",
                    new { TruckId = truckId, Task = reference.maintenance_task }
                );
                if (existing > 0) continue;

                string type = (status == "Overdue" || status == "Replace") ? "Urgent" : "Warning";
                string message = status == "Overdue"
                    ? $"{reference.maintenance_task} is overdue on {truckName} ({truckType}) — {monthsElapsed} month(s) since last maintenance (interval: {reference.month_interval} months)"
                    : status == "Replace"
                    ? $"{reference.maintenance_task} needs replacement on {truckName} ({truckType}) — {monthsElapsed} month(s) since last maintenance (interval: {reference.month_interval} months)"
                    : $"{reference.maintenance_task} approaching replacement on {truckName} ({truckType}) — {monthsElapsed} month(s) since last maintenance (interval: {reference.month_interval} months)";

                int maintenanceId = connection.ExecuteScalar<int>(@"
                    INSERT INTO Truck_Maintenance_Logs
                        (current_km, status, resolved, truck_id, reference_id, created_at)
                    VALUES (NULL, @Status, 'No', @TruckId, @ReferenceId, @Now);
                    SELECT SCOPE_IDENTITY();",
                    new
                    {
                        Status = status,
                        TruckId = truckId,
                        ReferenceId = reference.reference_id,
                        Now = DateTime.Now
                    }
                );

                connection.Execute(@"
                    INSERT INTO Admin_Notifications
                        (truck_id, maintenance_id, type, message, maintenance_task,
                         is_read, is_resolved, resolved_at, created_at)
                    VALUES (@TruckId, @MaintenanceId, @Type, @Message, @MaintenanceTask,
                            0, 0, NULL, @Now)",
                    new
                    {
                        TruckId = truckId,
                        MaintenanceId = maintenanceId,
                        Type = type,
                        Message = message,
                        MaintenanceTask = reference.maintenance_task,
                        Now = DateTime.Now
                    }
                );
            }

            scope.Complete();
        }

        // ── Insert month-based odometer notification ─────────────────────────
        public void InsertMonthOdometerNotification(int truckId, DateTime lastMaintenanceDate)
        {
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            int monthsElapsed = WholeMonthsBetween(lastMaintenanceDate, DateTime.Now);

            string message = $"Month-based check submitted: {truckName} ({truckType}) {plateNumber} " +
                             $"— last maintenance: {lastMaintenanceDate:MMMM yyyy} " +
                             $"({monthsElapsed} month(s) ago) on {DateTime.Now:MMMM dd, yyyy hh:mm tt}.";

            connection.Execute(@"
                INSERT INTO Admin_Notifications
                    (truck_id, maintenance_id, type, message, maintenance_task,
                     is_read, is_resolved, resolved_at, created_at)
                VALUES (@TruckId, NULL, 'Information', @Message, 'Month-based Check',
                        0, 0, NULL, @Now)",
                new { TruckId = truckId, Message = message, Now = DateTime.Now }
            );
        }

        // Whole calendar months from 'from' to 'to'. Jan 31 → Feb 1 is 0 months, not 1.
        internal static int WholeMonthsBetween(DateTime from, DateTime to)
        {
            int months = (to.Year - from.Year) * 12 + to.Month - from.Month;
            if (to.Day < from.Day) months--;
            return Math.Max(0, months);
        }

        // ── Threshold calculator (Month-based) ────────────────────────────────
        private string CalculateStatusByMonth(int monthsElapsed, int monthInterval)
        {
            if (monthsElapsed >= monthInterval + 1) return "Overdue";
            if (monthsElapsed >= monthInterval) return "Replace";
            if (monthsElapsed >= (int)(monthInterval * 0.8)) return "Warning";
            return "Good";
        }

        // ── Insert activity notification ──────────────────────────────────────
        public void InsertActivityNotification(int truckId, string farm, string address, string driverName)
        {
            using IDbConnection connection = CreateConnection();

            var truck = connection.QueryFirstOrDefault<dynamic>(
                @"SELECT truck_id, truck_name, plate_number, truck_type
                  FROM   Trucks WHERE truck_id = @TruckId",
                new { TruckId = truckId }
            );
            if (truck == null) return;

            string truckName = truck.truck_name ?? "";
            string plateNumber = truck.plate_number ?? "";
            string truckType = truck.truck_type ?? "";

            string message = $"New activity logged: {truckName} ({truckType}) {plateNumber} " +
                             $"— Driver: {driverName}, Farm: {farm}, Address: {address} " +
                             $"on {DateTime.Now:MMMM dd, yyyy hh:mm tt}.";

            connection.Execute(@"
                INSERT INTO Admin_Notifications
                    (truck_id, maintenance_id, type, message, maintenance_task,
                     is_read, is_resolved, resolved_at, created_at)
                VALUES (@TruckId, NULL, 'Information', @Message, 'Activity Log',
                        0, 0, NULL, @Now)",
                new { TruckId = truckId, Message = message, Now = DateTime.Now }
            );
        }
    }
}