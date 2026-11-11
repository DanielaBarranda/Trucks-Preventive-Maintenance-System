using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Services;

namespace starqueenAPI.Controllers
{
    // /api/admins — Owner only
    [Route("api/admins")]
    [Authorize(Policy = Permissions.AdminsManage)]
    public class AdminsController : AccountsControllerBase
    {
        public AdminsController(AccountService accounts) : base(accounts, Roles.Admin) { }
    }

    // /api/drivers — Owner and Admins
    [Route("api/drivers")]
    [Authorize(Policy = Permissions.DriversManage)]
    public class DriversController : AccountsControllerBase
    {
        public DriversController(AccountService accounts) : base(accounts, Roles.Driver) { }
    }
}
