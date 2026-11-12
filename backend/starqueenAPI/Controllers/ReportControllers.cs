using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;

namespace starqueenAPI.Controllers
{
    // /api/notifications — Owner/Admin alert inbox
    [Route("api/notifications")]
    [ApiController]
    [Authorize(Policy = Permissions.AlertsManage)]
    public class NotificationsController : ControllerBase
    {
        private readonly NotificationRepository _notifications;

        public NotificationsController(NotificationRepository notifications) => _notifications = notifications;

        [HttpGet]
        public IEnumerable<Notification> List([FromQuery(Name = "unread_only")] bool unreadOnly = false)
            => _notifications.List(unreadOnly);

        [HttpPut("{id:int}/read")]
        public IActionResult MarkRead(int id) => _notifications.MarkRead(id) ? Ok(true) : NotFound();

        [HttpPut("read-all")]
        public IActionResult MarkAllRead() => Ok(new { marked = _notifications.MarkAllRead() });
    }

    // /api/reports — Owner/Admin dashboards
    [Route("api/reports")]
    [ApiController]
    [Authorize(Policy = Permissions.ReportsView)]
    public class ReportsController : ControllerBase
    {
        private readonly ReportRepository _reports;

        public ReportsController(ReportRepository reports) => _reports = reports;

        [HttpGet("fleet-overview")]
        public IEnumerable<FleetOverviewRow> FleetOverview() => _reports.FleetOverview();

        [HttpGet("monthly-expenses")]
        public IEnumerable<MonthlyExpenseRow> MonthlyExpenses([FromQuery] int? year) => _reports.MonthlyExpenses(year);

        [HttpGet("driver-activity")]
        public IEnumerable<DriverActivityRow> DriverActivity() => _reports.DriverActivity();
    }
}
