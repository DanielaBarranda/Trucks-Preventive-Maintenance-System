using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TrucksController : ControllerBase
    {
        readonly TrucksServices _trucksServices = new TrucksServices();

        // POST /api/trucks
        [HttpPost]
        public bool AddTrucks(Trucks truck)
        {
            return _trucksServices.AddTrucks(truck);
        }

        // GET /api/trucks
        [HttpGet]
        public List<Trucks> GetAllTrucks()
        {
            return _trucksServices.GetAllTrucks();
        }

        // GET /api/trucks/{id}
        [HttpGet("{id}")]
        public Trucks? GetTruckById(int id)
        {
            return _trucksServices.GetTruckById(id);
        }

        // PUT /api/trucks/{id}
        [HttpPut("{id}")]
        public bool UpdateTruck(int id, Trucks truck)
        {
            truck.truck_ID = id;
            return _trucksServices.UpdateTruck(truck);
        }

        // DELETE /api/trucks/{id}
        [HttpDelete("{id}")]
        public bool DeleteTruck(int id)
        {
            return _trucksServices.DeleteTrucks(id);
        }
    }
}