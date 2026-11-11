using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class AdminNotificationsServices
    {
        public readonly AdminNotificationsRepository _repo;

        public AdminNotificationsServices(AdminNotificationsRepository repo)
        {
            _repo = repo;
        }

        // ── Basic CRUD ───────────────────────────────────────────────────────

        public Admin_Notifications? GetAdminNotificationById(int id)
            => _repo.GetById(id);

        public bool AddAdminNotification(Admin_Notifications notification)
            => _repo.Add(notification);

        public bool DeleteAdminNotification(int id)
            => _repo.Delete(id);

        public List<Admin_Notifications> GetAllAdminNotifications()
            => _repo.GetAll().ToList();

        public bool UpdateAdminNotification(Admin_Notifications notification)
            => _repo.Update(notification);

        public bool MarkAsRead(int id)
            => _repo.MarkAsRead(id);

        public bool MarkAllAsRead()
            => _repo.MarkAllAsRead();

        // ── SP: SP_Unread_Maintenance_Notifications_Per_Truck ────────────────
        // Used in the Alerts page — "Unread Maintenance Alerts Per Truck" table
        public IEnumerable<dynamic> GetUnreadMaintenanceNotificationsPerTruck()
            => _repo.GetUnreadMaintenanceNotificationsPerTruck();

        // ── VIEW: VW_Notification_Acknowledgement_Rate ───────────────────────
        // Used in the Alerts page — "Notification Acknowledgement Rate" table
        public IEnumerable<dynamic> GetNotificationAcknowledgementRate()
            => _repo.GetNotificationAcknowledgementRate();

        // ── SP: SP_Notification_Acknowledgement_Rate ─────────────────────────
        // SP version — same data as the view, called via stored procedure
        public IEnumerable<dynamic> GetAcknowledgementRateViaSP()
            => _repo.GetAcknowledgementRateViaSP();

        // ── SP: SP_Admin_Dashboard_Truck_Overview ────────────────────────────
        // Used for summary counts: urgent / warning / information per truck
        public IEnumerable<dynamic> GetAdminDashboardTruckOverview()
            => _repo.GetAdminDashboardTruckOverview();
    }
}