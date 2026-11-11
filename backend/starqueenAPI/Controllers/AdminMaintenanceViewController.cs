using Microsoft.AspNetCore.Mvc;
using starqueen.Models;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminMaintenanceViewController : ControllerBase
    {
        readonly AdminMaintenanceViewServices _services = new AdminMaintenanceViewServices();

        // GET /api/adminmaintenanceview
        // Used by Pending Maintenance page on the dashboard
        [HttpGet]
        public List<Admin_Maintenance_View> GetAllMaintenanceView()
        {
            return _services.GetAllMaintenanceView();
        }

        // GET /api/adminmaintenanceview/{id}
        [HttpGet("{id}")]
        public Admin_Maintenance_View? GetMaintenanceViewById(int id)
        {
            return _services.GetMaintenanceViewById(id);
        }
    }
}