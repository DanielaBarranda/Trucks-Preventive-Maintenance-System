using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class VehicleTests(ApiFactory api)
{
    static int UserIdOf(string email)
    {
        using var c = OpenAs(null);
        return (int)c.QuerySingle("EXEC auth.FindUserByEmail @email", new { email }).id;
    }

    static int VehicleIdByPlate(string ownerEmail, string plate)
    {
        using var c = OpenAs(SeedTests.OrgOf(ownerEmail));
        return c.QuerySingle<int>("SELECT id FROM dbo.Vehicles WHERE plate_number = @plate", new { plate });
    }

    static async Task<int> CreateVehicle(HttpClient owner, string plate)
    {
        int typeId = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().First().GetProperty("id").GetInt32();
        var res = await owner.PostAsJsonAsync("/api/vehicles", new { name = "Test Truck", plate_number = plate, vehicle_type_id = typeId });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Json()).GetProperty("id").GetInt32();
    }

    static async Task<int> CreateDriver(HttpClient owner)
    {
        var res = await owner.PostAsJsonAsync("/api/drivers",
            new { full_name = "Fleet Driver", email = $"{Guid.NewGuid():N}@driver.test", temporary_password = "TempPass123" });
        return (await res.Json()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task CreateVehicle_DuplicatePlate_Gets409()
    {
        var owner = await api.SignupNewOrg();
        await CreateVehicle(owner, "DUP-001");
        int typeId = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().First().GetProperty("id").GetInt32();
        var res = await owner.PostAsJsonAsync("/api/vehicles", new { name = "Again", plate_number = "DUP-001", vehicle_type_id = typeId });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task SamePlate_InDifferentOrganizations_IsAllowed()
    {
        var owner = await api.SignupNewOrg();
        await CreateVehicle(owner, "NWL-1001");   // also used by Northwind
    }

    [Fact]
    public async Task Assign_DriverAlreadyAssigned_Gets409()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        int urvan = VehicleIdByPlate("owner@northwind.demo", "NWL-2002");
        var res = await admin.PutAsJsonAsync($"/api/vehicles/{urvan}/assign", new { driver_id = UserIdOf("driver1@northwind.demo") });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("That driver already has a vehicle.", (await res.Json()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Assign_DriverFromOtherOrg_Gets400()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        int urvan = VehicleIdByPlate("owner@northwind.demo", "NWL-2002");
        var res = await admin.PutAsJsonAsync($"/api/vehicles/{urvan}/assign", new { driver_id = UserIdOf("rider1@swiftriders.demo") });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Assign_ThenUnassign()
    {
        var owner = await api.SignupNewOrg();
        int vehicle = await CreateVehicle(owner, "ASN-001");
        int driver = await CreateDriver(owner);

        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/vehicles/{vehicle}/assign", new { driver_id = driver })).StatusCode);
        var listed = (await (await owner.GetAsync("/api/vehicles")).Json()).EnumerateArray().Single(v => v.GetProperty("id").GetInt32() == vehicle);
        Assert.Equal(driver, listed.GetProperty("assigned_driver_id").GetInt32());

        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync($"/api/vehicles/{vehicle}/assign", new { driver_id = (int?)null })).StatusCode);
        listed = (await (await owner.GetAsync("/api/vehicles")).Json()).EnumerateArray().Single(v => v.GetProperty("id").GetInt32() == vehicle);
        Assert.Equal(JsonValueKind.Null, listed.GetProperty("assigned_driver_id").ValueKind);
    }

    [Fact]
    public async Task Mine_ReturnsDriversVehicle()
    {
        var d1 = await api.LoginAs("driver1@northwind.demo");
        var mine = await d1.GetAsync("/api/vehicles/mine");
        Assert.Equal(HttpStatusCode.OK, mine.StatusCode);
        Assert.Equal("NWL-1001", (await mine.Json()).GetProperty("plate_number").GetString());

        var d3 = await api.LoginAs("driver3@northwind.demo");
        Assert.Equal(HttpStatusCode.NotFound, (await d3.GetAsync("/api/vehicles/mine")).StatusCode);
    }

    [Fact]
    public async Task Driver_CannotListOrEditVehicles_Gets403()
    {
        var driver = await api.LoginAs("driver1@northwind.demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.GetAsync("/api/vehicles")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PostAsJsonAsync("/api/vehicles",
            new { name = "x", plate_number = "x", vehicle_type_id = 1 })).StatusCode);
    }

    [Fact]
    public async Task RecordService_ResolvesOpenAlerts()
    {
        var owner = await api.SignupNewOrg();
        int vehicle = await CreateVehicle(owner, "SRV-001");
        int driver = await CreateDriver(owner);
        int org = await OrgIdOf(owner);
        int schedule = ScheduleId(org, "Engine Oil & Filter Replacement");

        AddReading(org, vehicle, driver, 19001);   // Overdue
        int logId;
        using (var c = OpenAs(org))
        {
            logId = c.QuerySingle<int>("""
                INSERT dbo.MaintenanceLogs (vehicle_id, schedule_id, status, reading_at_log) OUTPUT INSERTED.id
                VALUES (@vehicle, @schedule, 'Overdue', 19001)
                """, new { vehicle, schedule });
            c.Execute("""
                INSERT dbo.Notifications (vehicle_id, maintenance_log_id, type, message, task)
                VALUES (@vehicle, @logId, 'Urgent', 'Engine oil overdue', 'Engine Oil & Filter Replacement')
                """, new { vehicle, logId });
        }
        Assert.Equal("Overdue", Status(org, vehicle, "Engine Oil & Filter Replacement"));

        var res = await owner.PostAsJsonAsync($"/api/vehicles/{vehicle}/services",
            new { schedule_id = schedule, service_date = DateTime.UtcNow.ToString("yyyy-MM-dd"), reading = 19001 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        Assert.Equal("Good", Status(org, vehicle, "Engine Oil & Filter Replacement"));
        using (var c = OpenAs(org))
        {
            Assert.True(c.QuerySingle<bool>("SELECT resolved FROM dbo.MaintenanceLogs WHERE id = @logId", new { logId }));
            Assert.True(c.QuerySingle<bool>("SELECT is_resolved FROM dbo.Notifications WHERE maintenance_log_id = @logId", new { logId }));
        }
    }

    [Fact]
    public async Task RecordService_ScheduleOfOtherType_Gets400()
    {
        var owner = await api.SignupNewOrg("Truck,Motorcycle");
        var types = (await (await owner.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().ToList();
        int truckType = types.Single(t => t.GetProperty("name").GetString() == "Truck").GetProperty("id").GetInt32();
        var res = await owner.PostAsJsonAsync("/api/vehicles", new { name = "T", plate_number = "TYP-001", vehicle_type_id = truckType });
        int vehicle = (await res.Json()).GetProperty("id").GetInt32();
        int motoSchedule = ScheduleId(await OrgIdOf(owner), "Chain Cleaning & Lubrication");

        var service = await owner.PostAsJsonAsync($"/api/vehicles/{vehicle}/services",
            new { schedule_id = motoSchedule, service_date = DateTime.UtcNow.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.BadRequest, service.StatusCode);
    }

    [Fact]
    public async Task Vehicle_FromOtherOrg_Gets404()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        int swiftVehicle = VehicleIdByPlate("owner@swiftriders.demo", "SWR-02");
        int ownVehicle = VehicleIdByPlate("owner@northwind.demo", "NWL-2002");

        var list = (await (await admin.GetAsync("/api/vehicles")).Json()).EnumerateArray().Select(v => v.GetProperty("id").GetInt32()).ToList();
        Assert.Contains(ownVehicle, list);
        Assert.DoesNotContain(swiftVehicle, list);

        var typeId = (await (await admin.GetAsync("/api/vehicle-types")).Json()).EnumerateArray().First().GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"/api/vehicles/{swiftVehicle}",
            new { name = "Hijack", plate_number = "SWR-02", vehicle_type_id = typeId, is_active = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/vehicles/{swiftVehicle}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"/api/vehicles/{swiftVehicle}/assign",
            new { driver_id = (int?)null })).StatusCode);
    }

    static async Task<int> OrgIdOf(HttpClient client) =>
        (await (await client.GetAsync("/api/organization")).Json()).GetProperty("id").GetInt32();
}
