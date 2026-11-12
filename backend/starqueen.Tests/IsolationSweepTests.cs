using System.Net;
using System.Net.Http.Json;

namespace starqueen.Tests;

// Collects every record Swift Riders can see, then tries each one as Northwind
// through every id-based route. Nothing may succeed or leak.
[Collection("api")]
public class IsolationSweepTests(ApiFactory api)
{
    static async Task<List<int>> Ids(HttpClient client, string url) =>
        (await (await client.GetAsync(url)).Json()).EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToList();

    [Fact]
    public async Task EveryEndpoint_HidesOtherOrganization()
    {
        // ── Swift Riders' ids ────────────────────────────────────────────────
        using (var c = DbFixtures.OpenAs(SeedTests.OrgOf("owner@swiftriders.demo")))
            c.Execute("INSERT dbo.Notifications (type, message) VALUES ('Information', 'Sweep target')");

        var swift = await api.LoginAs("owner@swiftriders.demo");
        var swiftIds = new Dictionary<string, List<int>>
        {
            ["vehicles"] = await Ids(swift, "/api/vehicles"),
            ["drivers"] = await Ids(swift, "/api/drivers"),
            ["schedules"] = await Ids(swift, "/api/schedules"),
            ["vehicle-types"] = await Ids(swift, "/api/vehicle-types"),
            ["trips"] = await Ids(swift, "/api/trips"),
            ["expenses"] = await Ids(swift, "/api/expenses"),
            ["notifications"] = await Ids(swift, "/api/notifications"),
        };
        Assert.All(swiftIds, kv => Assert.NotEmpty(kv.Value));

        // ── Northwind's view ─────────────────────────────────────────────────
        var owner = await api.LoginAs("owner@northwind.demo");
        var driver = await api.LoginAs("driver1@northwind.demo");

        // Lists never contain Swift ids
        foreach (var (resource, ids) in swiftIds)
        {
            var mine = await Ids(owner, $"/api/{resource}");
            Assert.Empty(mine.Intersect(ids));
        }

        int ownType = (await Ids(owner, "/api/vehicle-types")).First();
        int ownSchedule = (await Ids(owner, "/api/schedules")).First();
        var attempts = new List<(string What, HttpResponseMessage Response)>();
        async Task Try(string what, Task<HttpResponseMessage> call) => attempts.Add((what, await call));

        foreach (int id in swiftIds["vehicles"])
        {
            await Try($"GET vehicle {id}", owner.GetAsync($"/api/vehicles/{id}"));
            await Try($"PUT vehicle {id}", owner.PutAsJsonAsync($"/api/vehicles/{id}",
                new { name = "x", plate_number = "SWEEP-" + id, vehicle_type_id = ownType, is_active = true }));
            await Try($"assign vehicle {id}", owner.PutAsJsonAsync($"/api/vehicles/{id}/assign", new { driver_id = (int?)null }));
            await Try($"service vehicle {id}", owner.PostAsJsonAsync($"/api/vehicles/{id}/services",
                new { schedule_id = ownSchedule, service_date = DateTime.UtcNow.ToString("yyyy-MM-dd") }));
            await Try($"maintenance status {id}", owner.GetAsync($"/api/maintenance/status?vehicle_id={id}"));
            await Try($"DELETE vehicle {id}", owner.DeleteAsync($"/api/vehicles/{id}"));
        }
        foreach (int id in swiftIds["drivers"])
        {
            await Try($"PUT driver {id}", owner.PutAsJsonAsync($"/api/drivers/{id}",
                new { full_name = "x", email = $"sweep{id}@x.test", is_active = false }));
            await Try($"reset driver {id}", owner.PostAsJsonAsync($"/api/drivers/{id}/reset-password",
                new { temporary_password = "Sweep12345" }));
        }
        foreach (int id in swiftIds["schedules"])
        {
            await Try($"PUT schedule {id}", owner.PutAsJsonAsync($"/api/schedules/{id}",
                new { vehicle_type_id = ownType, task = "x", km_replace = 100 }));
            await Try($"DELETE schedule {id}", owner.DeleteAsync($"/api/schedules/{id}"));
        }
        foreach (int id in swiftIds["vehicle-types"])
        {
            await Try($"PUT type {id}", owner.PutAsJsonAsync($"/api/vehicle-types/{id}", new { name = "Sweep " + id }));
            await Try($"DELETE type {id}", owner.DeleteAsync($"/api/vehicle-types/{id}"));
        }
        foreach (int id in swiftIds["trips"])
        {
            await Try($"depart trip {id}", driver.PutAsync($"/api/trips/{id}/depart", null));
            await Try($"arrive trip {id}", driver.PutAsync($"/api/trips/{id}/arrive", null));
        }
        foreach (int id in swiftIds["expenses"])
        {
            await Try($"process photo {id}", owner.GetAsync($"/api/expenses/{id}/photos/process"));
            await Try($"receipt photo {id}", owner.GetAsync($"/api/expenses/{id}/photos/receipt"));
        }
        foreach (int id in swiftIds["notifications"])
            await Try($"read notification {id}", owner.PutAsync($"/api/notifications/{id}/read", null));

        // Maintenance status for another org's vehicle returns rows only for Northwind (i.e. none)
        var leaks = new List<string>();
        foreach (var (what, res) in attempts)
        {
            if (what.StartsWith("maintenance status"))
            {
                if ((await res.Json()).GetArrayLength() != 0) leaks.Add($"{what} → returned rows");
            }
            else if (res.StatusCode != HttpStatusCode.NotFound)
                leaks.Add($"{what} → {(int)res.StatusCode}");
        }
        Assert.Empty(leaks);

        // Swift's data is unchanged
        Assert.Equal(swiftIds["vehicles"].OrderBy(x => x), (await Ids(swift, "/api/vehicles")).OrderBy(x => x));
        Assert.Equal(swiftIds["schedules"].Count, (await Ids(swift, "/api/schedules")).Count);
    }
}
