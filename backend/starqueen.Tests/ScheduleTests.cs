using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class ScheduleTests(ApiFactory api)
{
    static async Task<int> FirstTypeId(HttpClient client) =>
        (await (await client.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().First().GetProperty("id").GetInt32();

    [Fact]
    public async Task Schedules_ListForOrg_FromTemplates()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        var schedules = (await (await admin.GetAsync("/api/schedules")).Json()).EnumerateArray().ToList();
        Assert.Contains(schedules, s => s.GetProperty("task").GetString() == "Engine Oil & Filter Replacement");
        Assert.DoesNotContain(schedules, s => s.GetProperty("task").GetString() == "Chain Cleaning & Lubrication"); // motorcycle-only
    }

    [Fact]
    public async Task Schedules_FilterByVehicleType()
    {
        var owner = await api.SignupNewOrg("Truck,Motorcycle");
        var types = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().ToList();
        int moto = types.Single(t => t.GetProperty("name").GetString() == "Motorcycle").GetProperty("id").GetInt32();

        var schedules = (await (await owner.GetAsync($"/api/schedules?vehicle_type_id={moto}")).Json()).EnumerateArray().ToList();
        Assert.NotEmpty(schedules);
        Assert.All(schedules, s => Assert.Equal(moto, s.GetProperty("vehicle_type_id").GetInt32()));
    }

    [Fact]
    public async Task CreateSchedule_Valid_Gets201()
    {
        var owner = await api.SignupNewOrg();
        var res = await owner.PostAsJsonAsync("/api/schedules", new
        {
            vehicle_type_id = await FirstTypeId(owner), task = "Wiper Blades", km_warning = 8000, km_replace = 10000, km_overdue = 10001, month_interval = 12
        });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [Fact]
    public async Task CreateSchedule_InvalidThresholds_Gets400()
    {
        var owner = await api.SignupNewOrg();
        int typeId = await FirstTypeId(owner);

        var backwards = await owner.PostAsJsonAsync("/api/schedules", new
        {
            vehicle_type_id = typeId, task = "Bad", km_warning = 20000, km_replace = 10000, km_overdue = 10001
        });
        Assert.Equal(HttpStatusCode.BadRequest, backwards.StatusCode);

        var nothingDue = await owner.PostAsJsonAsync("/api/schedules", new { vehicle_type_id = typeId, task = "Never due" });
        Assert.Equal(HttpStatusCode.BadRequest, nothingDue.StatusCode);
    }

    [Fact]
    public async Task CreateSchedule_TypeFromOtherOrg_Gets400()
    {
        var owner = await api.SignupNewOrg();
        int otherOrgType;
        using (var c = OpenAs(SeedTests.OrgOf("owner@swiftriders.demo")))
            otherOrgType = c.QuerySingle<int>("SELECT TOP 1 id FROM dbo.VehicleTypes");

        var res = await owner.PostAsJsonAsync("/api/schedules", new
        {
            vehicle_type_id = otherOrgType, task = "Sneaky", km_replace = 1000
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Driver_CannotEditSchedules_Gets403()
    {
        var driver = await api.LoginAs("driver1@northwind.demo");
        var res = await driver.PostAsJsonAsync("/api/schedules", new { vehicle_type_id = 1, task = "X", km_replace = 1000 });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await driver.GetAsync("/api/schedules")).StatusCode);   // reading is allowed
    }

    [Fact]
    public async Task VehicleType_CreateRenameDelete()
    {
        var owner = await api.SignupNewOrg();
        var created = await owner.PostAsJsonAsync("/api/vehicle-types", new { name = "Reefer" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        int id = (await created.Json()).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/vehicle-types/{id}", new { name = "Refrigerated" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.DeleteAsync($"/api/vehicle-types/{id}")).StatusCode);
    }

    [Fact]
    public async Task DeleteVehicleType_InUse_Gets409()
    {
        var owner = await api.LoginAs("owner@northwind.demo");
        var types = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray();
        int truck = types.Single(t => t.GetProperty("name").GetString() == "Truck").GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.Conflict, (await owner.DeleteAsync($"/api/vehicle-types/{truck}")).StatusCode);
    }

    [Fact]
    public async Task Schedule_FromOtherOrg_Gets404()
    {
        var owner = await api.SignupNewOrg();
        int otherSchedule;
        using (var c = OpenAs(SeedTests.OrgOf("owner@swiftriders.demo")))
            otherSchedule = c.QuerySingle<int>("SELECT TOP 1 id FROM dbo.MaintenanceSchedules");

        var put = await owner.PutAsJsonAsync($"/api/schedules/{otherSchedule}", new
        {
            vehicle_type_id = await FirstTypeId(owner), task = "Hijack", km_replace = 1000
        });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.DeleteAsync($"/api/schedules/{otherSchedule}")).StatusCode);
    }
}
