using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace starqueen.Tests;

// The API serves the built React app and falls back to index.html for client routes
public class FrontEndHostingTests : IClassFixture<FrontEndHostingTests.SpaFactory>
{
    public class SpaFactory : ApiFactory
    {
        public string WebRoot { get; } = Path.Combine(Path.GetTempPath(), "fleet-spa-" + Guid.NewGuid().ToString("N"));

        public SpaFactory()
        {
            Directory.CreateDirectory(Path.Combine(WebRoot, "assets"));
            File.WriteAllText(Path.Combine(WebRoot, "index.html"), "<!doctype html><title>SPA-OK</title>");
            File.WriteAllText(Path.Combine(WebRoot, "assets", "app.js"), "console.log('asset');");
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?> { ["FrontEndPath"] = WebRoot }));
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            try { Directory.Delete(WebRoot, recursive: true); } catch { }
        }
    }

    private readonly SpaFactory _factory;

    public FrontEndHostingTests(SpaFactory factory) => _factory = factory;

    [Theory]
    [InlineData("/")]
    [InlineData("/admin")]
    [InlineData("/driver")]
    [InlineData("/change-password")]
    public async Task ClientRoute_ServesIndexHtml(string path)
    {
        var res = await _factory.NewClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("SPA-OK", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task StaticAsset_IsServed()
    {
        var res = await _factory.NewClient().GetAsync("/assets/app.js");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("asset", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UnknownApiRoute_IsNotHtml()
    {
        var res = await _factory.NewClient().GetAsync("/api/nope");
        Assert.NotEqual(HttpStatusCode.OK, res.StatusCode);
        Assert.DoesNotContain("SPA-OK", await res.Content.ReadAsStringAsync());
    }
}
