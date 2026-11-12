using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("api")]
public class DriverLogTests(ApiFactory api)
{
    const string EngineOil = "Engine Oil & Filter Replacement";
    static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4 };

    static MultipartFormDataContent ExpenseForm(string category = "Fuel", int? scheduleId = null, byte[]? photo = null, string fileName = "photo.png")
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(DateTime.UtcNow.ToString("yyyy-MM-dd")), "expense_date" },
            { new StringContent(category), "category" },
            { new StringContent("250.50"), "amount" },
            { new StringContent("test"), "notes" }
        };
        if (scheduleId is int s) form.Add(new StringContent(s.ToString()), "schedule_id");
        foreach (var field in new[] { "process_photo", "receipt_photo" })
        {
            var file = new ByteArrayContent(photo ?? Png);
            file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(file, field, fileName);
        }
        return form;
    }

    // A fresh organization with one driver assigned to one truck
    async Task<(HttpClient Owner, HttpClient Driver, int Org, int Vehicle)> FreshFleet()
    {
        var owner = await api.SignupNewOrg("Truck,Motorcycle");
        var (driver, driverId) = await api.NewDriver(owner);
        int vehicle = await ApiFactory.NewVehicle(owner, driverId, "Truck");
        return (owner, driver, await ApiFactory.OrgIdOf(owner), vehicle);
    }

    [Fact]
    public async Task Driver_WithoutVehicle_Gets409()
    {
        var d3 = await api.LoginAs("driver3@northwind.demo");
        var res = await d3.PostAsJsonAsync("/api/odometer-readings", new { reading = 100 });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("No vehicle is assigned to you.", (await res.Json()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Odometer_LowerThanLatest_Gets400()
    {
        var d1 = await api.LoginAs("driver1@northwind.demo");   // latest seeded reading 16,000
        var res = await d1.PostAsJsonAsync("/api/odometer-readings", new { reading = 100 });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Odometer_CrossingThreshold_CreatesNotification()
    {
        var f = await FreshFleet();
        var res = await f.Driver.PostAsJsonAsync("/api/odometer-readings", new { reading = 16000 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var c = OpenAs(f.Org);
        Assert.True(c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Notifications WHERE vehicle_id = @v AND type = 'Urgent'", new { v = f.Vehicle }) > 0);
        Assert.Equal(1, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Notifications WHERE vehicle_id = @v AND type = 'Information'", new { v = f.Vehicle }));
    }

    [Fact]
    public async Task Trip_DepartThenArrive_Works()
    {
        var f = await FreshFleet();
        var created = await f.Driver.PostAsJsonAsync("/api/trips", new
        {
            trip_date = DateTime.UtcNow.ToString("yyyy-MM-dd"), pickup_location = "Warehouse",
            pickup_address = "1 Main St", destination = "Port", scheduled_time = "06:30"
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        int id = (await created.Json()).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.BadRequest, (await f.Driver.PutAsync($"/api/trips/{id}/arrive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Driver.PutAsync($"/api/trips/{id}/depart", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Driver.PutAsync($"/api/trips/{id}/arrive", null)).StatusCode);

        var trips = (await (await f.Driver.GetAsync("/api/trips")).Json()).EnumerateArray().ToList();
        var trip = trips.Single(t => t.GetProperty("id").GetInt32() == id);
        Assert.Equal(System.Text.Json.JsonValueKind.String, trip.GetProperty("arrived_at").ValueKind);
    }

    [Fact]
    public async Task Trip_OfOtherDriver_Gets404()
    {
        var f = await FreshFleet();
        var created = await f.Driver.PostAsJsonAsync("/api/trips", new
        {
            trip_date = DateTime.UtcNow.ToString("yyyy-MM-dd"), pickup_location = "A", pickup_address = "B", destination = "C"
        });
        int id = (await created.Json()).GetProperty("id").GetInt32();

        var (other, otherId) = await api.NewDriver(f.Owner);
        await ApiFactory.NewVehicle(f.Owner, otherId, "Truck");
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"/api/trips/{id}/depart", null)).StatusCode);
        Assert.DoesNotContain((await (await other.GetAsync("/api/trips")).Json()).EnumerateArray(),
            t => t.GetProperty("id").GetInt32() == id);
    }

    [Fact]
    public async Task Expense_WithSchedule_ResolvesAlert()
    {
        var f = await FreshFleet();
        await f.Driver.PostAsJsonAsync("/api/odometer-readings", new { reading = 19001 });   // oil Overdue → alert
        Assert.Equal("Overdue", Status(f.Org, f.Vehicle, EngineOil));

        var res = await f.Driver.PostAsync("/api/expenses", ExpenseForm(EngineOil, ScheduleId(f.Org, EngineOil)));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        Assert.Equal("Good", Status(f.Org, f.Vehicle, EngineOil));
        using var c = OpenAs(f.Org);
        Assert.Equal(0, c.ExecuteScalar<int>("""
            SELECT COUNT(*) FROM dbo.MaintenanceLogs l JOIN dbo.MaintenanceSchedules s ON s.id = l.schedule_id
            WHERE l.vehicle_id = @v AND s.task = @task AND l.resolved = 0
            """, new { v = f.Vehicle, task = EngineOil }));
    }

    [Fact]
    public async Task Expense_ScheduleOfOtherType_Gets400()
    {
        var f = await FreshFleet();
        var res = await f.Driver.PostAsync("/api/expenses", ExpenseForm(scheduleId: ScheduleId(f.Org, "Chain Cleaning & Lubrication")));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Expense_NonImagePhoto_Gets400()
    {
        var f = await FreshFleet();
        var res = await f.Driver.PostAsync("/api/expenses", ExpenseForm(photo: "not an image"u8.ToArray()));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task ExpensePhoto_OwnOrgOnly()
    {
        var rider = await api.LoginAs("rider1@swiftriders.demo");
        var created = await rider.PostAsync("/api/expenses", ExpenseForm());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        int id = (await created.Json()).GetProperty("id").GetInt32();

        var swiftOwner = await api.LoginAs("owner@swiftriders.demo");
        var own = await swiftOwner.GetAsync($"/api/expenses/{id}/photos/receipt");
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        Assert.Equal(Png, await own.Content.ReadAsByteArrayAsync());

        var northwind = await api.LoginAs("admin@northwind.demo");
        Assert.Equal(HttpStatusCode.NotFound, (await northwind.GetAsync($"/api/expenses/{id}/photos/receipt")).StatusCode);
    }

    [Fact]
    public async Task Admin_CannotSubmitDriverLogs_Gets403()
    {
        var admin = await api.LoginAs("admin@northwind.demo");
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/odometer-readings", new { reading = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsync("/api/expenses", ExpenseForm())).StatusCode);
    }

    [Fact]
    public async Task MaintenanceStatus_DriverSeesOnlyOwnVehicle()
    {
        var d1 = await api.LoginAs("driver1@northwind.demo");
        var rows = (await (await d1.GetAsync("/api/maintenance/status")).Json()).EnumerateArray().ToList();
        Assert.NotEmpty(rows);
        Assert.All(rows, r => Assert.Equal("NWL-1001", r.GetProperty("plate_number").GetString()));
    }

    [Fact]
    public async Task Evaluate_Endpoint_CreatesAlertsForFleet()
    {
        var f = await FreshFleet();
        AddReading(f.Org, f.Vehicle, DriverIdOfVehicle(f.Org, f.Vehicle), 16000);   // inserted directly, no evaluation yet
        var res = await f.Owner.PostAsync("/api/maintenance/evaluate", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(4, (await res.Json()).GetProperty("new_alerts").GetInt32());
    }

    static int DriverIdOfVehicle(int org, int vehicle)
    {
        using var c = OpenAs(org);
        return c.QuerySingle<int>("SELECT assigned_driver_id FROM dbo.Vehicles WHERE id = @vehicle", new { vehicle });
    }
}
