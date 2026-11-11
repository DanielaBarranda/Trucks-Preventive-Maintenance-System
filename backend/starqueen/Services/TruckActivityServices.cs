using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckActivityServices
    {
        public readonly TruckActivityRepository _truckActivityRepository = new TruckActivityRepository();

        public Truck_Activity GetTruckActivityById(int id)
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
            return (List<Truck_Activity>)_truckActivityRepository.GetAll();
        }

        public bool UpdateTruckActivity(Truck_Activity activity)
        {
            return _truckActivityRepository.Update(activity);
        }
    }
}