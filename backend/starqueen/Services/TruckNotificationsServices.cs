using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckNotificationsServices
    {
        public readonly TruckNotificationsRepository _repo;

        public TruckNotificationsServices(TruckNotificationsRepository repo)
        {
            _repo = repo;
        }

        public Truck_Notifications? GetNotificationById(int id)
        {
            return _repo.GetById(id);
        }

        public bool AddNotification(Truck_Notifications notification)
        {
            return _repo.Add(notification);
        }

        public bool DeleteNotification(int id)
        {
            return _repo.Delete(id);
        }

        public List<Truck_Notifications> GetAllNotifications()
        {
            return _repo.GetAll().ToList();
        }

        public bool UpdateNotification(Truck_Notifications notification)
        {
            return _repo.Update(notification);
        }
    }
}
