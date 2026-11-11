using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TruckNotificationsController : ControllerBase
    {
        readonly TruckNotificationsServices _services = new TruckNotificationsServices();

        // POST /api/trucknotifications
        [HttpPost]
        public bool AddNotification(Truck_Notifications notification)
        {
            return _services.AddNotification(notification);
        }

        // GET /api/trucknotifications
        [HttpGet]
        public List<Truck_Notifications> GetAllNotifications()
        {
            return _services.GetAllNotifications();
        }

        // GET /api/trucknotifications/{id}
        [HttpGet("{id}")]
        public Truck_Notifications? GetNotificationById(int id)
        {
            return _services.GetNotificationById(id);
        }

        // PUT /api/trucknotifications/{id}
        [HttpPut("{id}")]
        public bool UpdateNotification(int id, Truck_Notifications notification)
        {
            notification.truck_notification_id = id;
            return _services.UpdateNotification(notification);
        }

        // DELETE /api/trucknotifications/{id}
        [HttpDelete("{id}")]
        public bool DeleteNotification(int id)
        {
            return _services.DeleteNotification(id);
        }
    }
}