using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MaintenanceReferenceController : ControllerBase
    {
        readonly MaintenanceReferenceServices _services = new MaintenanceReferenceServices();

        // POST /api/maintenancereference
        [HttpPost]
        public bool AddMaintenanceReference(Maintenance_Reference reference)
        {
            return _services.AddMaintenanceReference(reference);
        }

        // GET /api/maintenancereference
        [HttpGet]
        public List<Maintenance_Reference> GetAllMaintenanceReferences()
        {
            return _services.GetAllMaintenanceReferences();
        }

        // GET /api/maintenancereference/{id}
        [HttpGet("{id}")]
        public Maintenance_Reference? GetMaintenanceReferenceById(int id)
        {
            return _services.GetMaintenanceReferenceById(id);
        }

        // PUT /api/maintenancereference/{id}
        [HttpPut("{id}")]
        public bool UpdateMaintenanceReference(int id, Maintenance_Reference reference)
        {
            reference.reference_id = id;
            return _services.UpdateMaintenanceReference(reference);
        }

        // DELETE /api/maintenancereference/{id}
        [HttpDelete("{id}")]
        public bool DeleteMaintenanceReference(int id)
        {
            return _services.DeleteMaintenanceReference(id);
        }
    }
}