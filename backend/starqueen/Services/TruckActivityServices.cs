using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckActivityServices
    {
        public readonly TruckActivityRepository _truckActivityRepository;

        public TruckActivityServices(TruckActivityRepository truckActivityRepository)
        {
            _truckActivityRepository = truckActivityRepository;
        }

        public Truck_Activity? GetTruckActivityById(int id)
        {
            return _truckActivityRepository.GetById(id);
        }

        public bool AddTruckActivity(Truck_Activity activity)
        {
            return _truckActivityRepository.Add(activity);
        }

        public bool DeleteTruckActivity(int id)
        {
            return _truckActivityRepository.Delete(id);
        }

        public List<Truck_Activity> GetAllTruckActivities()
        {
            return _truckActivityRepository.GetAll().ToList();
        }

        public bool UpdateTruckActivity(Truck_Activity activity)
        {
            return _truckActivityRepository.Update(activity);
        }
    }
}