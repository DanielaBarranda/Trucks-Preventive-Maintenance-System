using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckNotificationsController : ControllerBase
    {
        readonly TruckNotificationsServices _services;

        public TruckNotificationsController(TruckNotificationsServices services)
        {
            _services = services;
        }

        // POST /api/trucknotifications
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddNotification(Truck_Notifications notification)
            => _services.AddNotification(notification) ? Ok(true) : BadRequest("Failed to add notification.");

        // GET /api/trucknotifications
        [HttpGet]
        public List<Truck_Notifications> GetAllNotifications()
            => _services.GetAllNotifications();

        // GET /api/trucknotifications/{id}
        [HttpGet("{id}")]
        public ActionResult<Truck_Notifications> GetNotificationById(int id)
            => _services.GetNotificationById(id) is { } n ? n : NotFound();

        // PUT /api/trucknotifications/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateNotification(int id, Truck_Notifications notification)
        {
            notification.truck_notification_id = id;
            return _services.UpdateNotification(notification) ? Ok(true) : NotFound();
        }

        // DELETE /api/trucknotifications/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteNotification(int id)
            => _services.DeleteNotification(id) ? Ok(true) : NotFound();
    }
}
