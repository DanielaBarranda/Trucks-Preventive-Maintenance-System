using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MaintenanceReferenceController : ControllerBase
    {
        readonly MaintenanceReferenceServices _services;

        public MaintenanceReferenceController(MaintenanceReferenceServices services)
        {
            _services = services;
        }

        // POST /api/maintenancereference
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult AddMaintenanceReference(Maintenance_Reference reference)
            => _services.AddMaintenanceReference(reference) ? Ok(true) : BadRequest("Failed to add reference.");

        // GET /api/maintenancereference
        [HttpGet]
        public List<Maintenance_Reference> GetAllMaintenanceReferences()
            => _services.GetAllMaintenanceReferences();

        // GET /api/maintenancereference/{id}
        [HttpGet("{id}")]
        public ActionResult<Maintenance_Reference> GetMaintenanceReferenceById(int id)
            => _services.GetMaintenanceReferenceById(id) is { } r ? r : NotFound();

        // PUT /api/maintenancereference/{id}  (send the full record)
        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult UpdateMaintenanceReference(int id, Maintenance_Reference reference)
        {
            reference.reference_id = id;
            return _services.UpdateMaintenanceReference(reference) ? Ok(true) : NotFound();
        }

        // DELETE /api/maintenancereference/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.Admin)]
        public IActionResult DeleteMaintenanceReference(int id)
            => _services.DeleteMaintenanceReference(id) ? Ok(true) : NotFound();
    }
}
