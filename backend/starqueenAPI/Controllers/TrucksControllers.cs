using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TrucksController : ControllerBase
    {
        readonly TrucksServices _trucksServices;

        public TrucksController(TrucksServices trucksServices)
        {
            _trucksServices = trucksServices;
        }

        // POST /api/trucks
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddTrucks(Trucks truck)
            => _trucksServices.AddTrucks(truck) ? Ok(true) : BadRequest("Failed to add truck.");

        // GET /api/trucks
        [HttpGet]
        public List<Trucks> GetAllTrucks()
            => _trucksServices.GetAllTrucks();

        // GET /api/trucks/{id}
        [HttpGet("{id}")]
        public ActionResult<Trucks> GetTruckById(int id)
            => _trucksServices.GetTruckById(id) is { } truck ? truck : NotFound();

        // PUT /api/trucks/{id}  (send the full truck — every column is overwritten)
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateTruck(int id, Trucks truck)
        {
            truck.truck_ID = id;
            return _trucksServices.UpdateTruck(truck) ? Ok(true) : NotFound();
        }

        // DELETE /api/trucks/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteTruck(int id)
            => _trucksServices.DeleteTrucks(id) ? Ok(true) : NotFound();
    }
}
