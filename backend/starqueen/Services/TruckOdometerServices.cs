using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckOdometerServices
    {
        public readonly TruckOdometerRepository _truckOdometerRepository;

        public TruckOdometerServices(TruckOdometerRepository truckOdometerRepository)
        {
            _truckOdometerRepository = truckOdometerRepository;
        }

        public Truck_Odometer? GetOdometerById(int id)
        {
            return _truckOdometerRepository.GetById(id);
        }

        public bool AddOdometer(Truck_Odometer odometer)
        {
            return _truckOdometerRepository.Add(odometer);
        }

        public bool DeleteOdometer(int id)
        {
            return _truckOdometerRepository.Delete(id);
        }

        public List<Truck_Odometer> GetAllOdometers()
        {
            return _truckOdometerRepository.GetAll().ToList();
        }

        public bool UpdateOdometer(Truck_Odometer odometer)
        {
            return _truckOdometerRepository.Update(odometer);
        }
    }
}