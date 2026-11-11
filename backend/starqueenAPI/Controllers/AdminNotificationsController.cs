using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;
using Dapper;
using Microsoft.Data.SqlClient;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminNotificationsController : ControllerBase
    {
        readonly AdminNotificationsServices _services = new AdminNotificationsServices();

        readonly string _connectionString =
            "Server=(localdb)\\MSSQLLocalDB;Database=Starqueen_PMTS;" +
            "Trusted_Connection=True;MultipleActiveResultSets=True";

        // ── Basic CRUD ───────────────────────────────────────────────────────

        // POST /api/adminnotifications
        [HttpPost]
        public bool AddAdminNotification(Admin_Notifications notification)
            => _services.AddAdminNotification(notification);

        // GET /api/adminnotifications
        [HttpGet]
        public List<Admin_Notifications> GetAllAdminNotifications()
            => _services.GetAllAdminNotifications();

        // GET /api/adminnotifications/{id}
        [HttpGet("{id}")]
        public Admin_Notifications? GetAdminNotificationById(int id)
            => _services.GetAdminNotificationById(id);

        // PUT /api/adminnotifications/{id}
        [HttpPut("{id}")]
        public bool UpdateAdminNotification(int id, Admin_Notifications notification)
        {
            notification.admin_notification_id = id;
            return _services.UpdateAdminNotification(notification);
        }

        // PUT /api/adminnotifications/{id}/read
        [HttpPut("{id}/read")]
        public bool MarkAsRead(int id)
        {
            using var connection = new SqlConnection(_connectionString);
            int rows = connection.Execute(
                "UPDATE [Admin_Notifications] SET is_read = 1 WHERE admin_notification_id = @Id",
                new { Id = id }
            );
            return rows > 0;
        }

        // PUT /api/adminnotifications/read-all
        [HttpPut("read-all")]
        public bool MarkAllAsRead()
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Execute(
                "UPDATE [Admin_Notifications] SET is_read = 1 WHERE is_read = 0"
            );
            return true;
        }

        // DELETE /api/adminnotifications/{id}
        [HttpDelete("{id}")]
        public bool DeleteAdminNotification(int id)
            => _services.DeleteAdminNotification(id);

        // ── SP: SP_Unread_Maintenance_Notifications_Per_Truck ────────────────
        // GET /api/adminnotifications/unread-per-truck
        // Returns unread urgent/warning count grouped by truck
        // → Used by the "Unread Maintenance Alerts Per Truck" table in Alerts page
        [HttpGet("unread-per-truck")]
        public IEnumerable<dynamic> GetUnreadPerTruck()
            => _services.GetUnreadMaintenanceNotificationsPerTruck();

        // ── VIEW: VW_Notification_Acknowledgement_Rate ───────────────────────
        // GET /api/adminnotifications/acknowledgement-rate
        // Returns read/unread count and % rate per truck
        // → Used by the "Notification Acknowledgement Rate" table in Alerts page
        [HttpGet("acknowledgement-rate")]
        public IEnumerable<dynamic> GetAcknowledgementRate()
            => _services.GetNotificationAcknowledgementRate();

        // ── SP: SP_Admin_Dashboard_Truck_Overview ────────────────────────────
        // GET /api/adminnotifications/dashboard-overview
        // Returns urgent / warning / information summary counts
        // → Used by the 3 summary cards at the top of the Alerts page
        [HttpGet("dashboard-overview")]
        public IEnumerable<dynamic> GetDashboardOverview()
            => _services.GetAdminDashboardTruckOverview();
    }
}