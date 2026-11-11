using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminMaintenanceViewController : ControllerBase
    {
        readonly AdminMaintenanceViewServices _services;

        public AdminMaintenanceViewController(AdminMaintenanceViewServices services)
        {
            _services = services;
        }

        // GET /api/adminmaintenanceview
        // Used by Pending Maintenance page on the dashboard
        [HttpGet]
        public List<Admin_Maintenance_View> GetAllMaintenanceView()
            => _services.GetAllMaintenanceView();

        // GET /api/adminmaintenanceview/{id}
        [HttpGet("{id}")]
        public ActionResult<Admin_Maintenance_View> GetMaintenanceViewById(int id)
            => _services.GetMaintenanceViewById(id) is { } v ? v : NotFound();
    }
}
