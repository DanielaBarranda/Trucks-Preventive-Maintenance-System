using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace starqueen.Tests;

// Runs the real API in memory against FleetPMTS_Test.
public class ApiFactory : WebApplicationFactory<Program>
{
    public ApiFactory() => TestDatabase.EnsureCreated();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = TestDatabase.ConnectionString
            }));
    }

    public HttpClient NewClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        HandleCookies = true
    });

    // Signs up a brand-new organization; returns the Owner's logged-in client
    public async Task<HttpClient> SignupNewOrg(string categories = "Truck", string unit = "km")
    {
        var client = NewClient();
        var res = await client.PostAsJsonAsync("/api/auth/signup", new
        {
            organization_name = "Test Org " + Guid.NewGuid().ToString("N")[..6],
            owner_name = "Test Owner",
            email = $"{Guid.NewGuid():N}@owner.test",
            password = "LongEnough1",
            distance_unit = unit,
            template_categories = categories.Split(',')
        });
        res.EnsureSuccessStatusCode();
        return client;
    }

    // Returns a client holding the login cookie for this user
    public async Task<HttpClient> LoginAs(string email, string password = SeedTests.DemoPassword)
    {
        var client = NewClient();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        if (!body.GetProperty("success").GetBoolean())
            throw new InvalidOperationException($"Login failed for {email}: {body}");
        return client;
    }
}

[CollectionDefinition("api", DisableParallelization = true)]
public class ApiCollection : ICollectionFixture<ApiFactory> { }

internal static class JsonExtensions
{
    public static async Task<JsonElement> Json(this HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();
}
