using starqueen.Models;
using starqueen.Repositories;
using System;

namespace starqueen.Services
{
    public class TrucksServices
    {
        public readonly TrucksRepository _trucksRepository = new TrucksRepository();

        // 1. GetById
        public Trucks GetTruckById(int id)
        {
            return _trucksRepository.GetById(id);
        }

        // 2. Add
        public bool AddTrucks(Trucks truck)
        {
            return _trucksRepository.Add(truck);
        }

        // 3. Delete
        public bool DeleteTrucks(int id)
        {
            return _trucksRepository.Delete(id);
        }

        // 4. Get All
        public List<Trucks> GetAllTrucks()
        {
            return (List<Trucks>)_trucksRepository.GetAll();
        }

        // 5. Update
        public bool UpdateTruck(Trucks truck)
        {
            return _trucksRepository.Update(truck);
        }
    }
}