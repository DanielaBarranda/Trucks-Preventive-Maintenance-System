using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminNotificationsController : ControllerBase
    {
        readonly AdminNotificationsServices _services;

        public AdminNotificationsController(AdminNotificationsServices services)
        {
            _services = services;
        }

        // ── Basic CRUD ───────────────────────────────────────────────────────

        // POST /api/adminnotifications
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddAdminNotification(Admin_Notifications notification)
            => _services.AddAdminNotification(notification) ? Ok(true) : BadRequest("Failed to add notification.");

        // GET /api/adminnotifications  (drivers read this too, for their truck's status)
        [HttpGet]
        public List<Admin_Notifications> GetAllAdminNotifications()
            => _services.GetAllAdminNotifications();

        // GET /api/adminnotifications/{id}
        [HttpGet("{id}")]
        public ActionResult<Admin_Notifications> GetAdminNotificationById(int id)
            => _services.GetAdminNotificationById(id) is { } n ? n : NotFound();

        // PUT /api/adminnotifications/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateAdminNotification(int id, Admin_Notifications notification)
        {
            notification.admin_notification_id = id;
            return _services.UpdateAdminNotification(notification) ? Ok(true) : NotFound();
        }

        // PUT /api/adminnotifications/{id}/read
        [HttpPut("{id}/read")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult MarkAsRead(int id)
            => _services.MarkAsRead(id) ? Ok(true) : NotFound();

        // PUT /api/adminnotifications/read-all
        [HttpPut("read-all")]
        [Authorize(Roles = Roles.Admin)]
        public bool MarkAllAsRead()
            => _services.MarkAllAsRead();

        // DELETE /api/adminnotifications/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteAdminNotification(int id)
            => _services.DeleteAdminNotification(id) ? Ok(true) : NotFound();

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