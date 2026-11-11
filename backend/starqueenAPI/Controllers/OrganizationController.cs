using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using starqueen.Auth;
using starqueen.Models;
using starqueen.Repositories;
using System.ComponentModel.DataAnnotations;

namespace starqueenAPI.Controllers
{
    [Route("api/organization")]
    [ApiController]
    public class OrganizationController : ControllerBase
    {
        public record UpdateOrganizationRequest(
            [Required, MaxLength(100)] string Name,
            [Required, RegularExpression("^[A-Z]{3}$")] string CurrencyCode,
            [Required, RegularExpression("^(km|mi)$")] string DistanceUnit);

        private readonly OrganizationRepository _organizations;

        public OrganizationController(OrganizationRepository organizations) => _organizations = organizations;

        // GET /api/organization — any logged-in user
        [HttpGet]
        public ActionResult<Organization> Get() => _organizations.GetCurrent() is { } org ? org : NotFound();

        // PUT /api/organization — Owner only
        [HttpPut]
        [Authorize(Policy = Permissions.OrgManage)]
        public IActionResult Update(UpdateOrganizationRequest request)
            => _organizations.Update(request.Name.Trim(), request.CurrencyCode, request.DistanceUnit) ? Ok(true) : NotFound();
    }
}
