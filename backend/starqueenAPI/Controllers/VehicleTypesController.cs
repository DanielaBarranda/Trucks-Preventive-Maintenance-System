using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;
using System.ComponentModel.DataAnnotations;

namespace starqueenAPI.Controllers
{
    [Route("api/vehicle-types")]
    [ApiController]
    public class VehicleTypesController : ControllerBase
    {
        public record VehicleTypeRequest([Required, MaxLength(50)] string Name);

        private readonly VehicleTypeRepository _types;

        public VehicleTypesController(VehicleTypeRepository types) => _types = types;

        [HttpGet]
        public IEnumerable<VehicleType> List() => _types.List();

        [HttpPost]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Create(VehicleTypeRequest request)
            => _types.Create(request.Name.Trim()) is int id
                ? StatusCode(StatusCodes.Status201Created, new { id })
                : Conflict(new { message = "A vehicle type with that name already exists." });

        [HttpPut("{id:int}")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Rename(int id, VehicleTypeRequest request) => _types.Rename(id, request.Name.Trim()) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.Conflict => Conflict(new { message = "A vehicle type with that name already exists." }),
            _ => NotFound()
        };

        [HttpDelete("{id:int}")]
        [Authorize(Policy = Permissions.VehiclesManage)]
        public IActionResult Delete(int id) => _types.Delete(id) switch
        {
            WriteResult.Ok => Ok(true),
            WriteResult.InUse => Conflict(new { message = "Vehicles or service records still use this type." }),
            _ => NotFound()
        };
    }
}
