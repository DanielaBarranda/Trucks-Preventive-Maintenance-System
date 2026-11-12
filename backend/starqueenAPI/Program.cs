using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using starqueen.Auth;
using starqueen.Data;
using starqueen.Repositories;
using starqueen.Services;
using starqueenAPI.Infrastructure;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);


// ── Tenant context + database ─────────────────────────────────
// Every connection is scoped to the logged-in user's organization (Row-Level Security).
// Connection string: appsettings.json → ConnectionStrings:DefaultConnection
// (override per machine with user secrets or ConnectionStrings__DefaultConnection env var)
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantContext, HttpTenantContext>();
builder.Services.AddScoped<IDbConnectionFactory>(sp => new SqlConnectionFactory(
    sp.GetRequiredService<IConfiguration>().GetConnectionString("DefaultConnection"),
    sp.GetRequiredService<ITenantContext>()));

// ── Repositories and services (every class in those namespaces) ──
builder.Services.AddSingleton<PasswordService>();
foreach (var type in typeof(UserRepository).Assembly.GetTypes()
             .Where(t => t is { IsClass: true, IsAbstract: false, IsPublic: true }
                         && t != typeof(PasswordService)
                         && (t.Namespace == typeof(UserRepository).Namespace
                             || t.Namespace == typeof(PasswordService).Namespace)))
{
    builder.Services.AddScoped(type);
}

// ── Authentication: HttpOnly cookie issued by POST /api/auth/login ──
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "fleet.auth";
        options.Cookie.HttpOnly = true;                       // not readable from JavaScript
        options.Cookie.SameSite = SameSiteMode.Strict;        // not sent on cross-site requests
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(24);
        options.SlidingExpiration = false;

        // This is an API: answer 401/403 instead of redirecting to a login page
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });

// ── Authorization: RBAC ───────────────────────────────────────
// Every endpoint requires login unless marked [AllowAnonymous].
// One policy per permission: [Authorize(Policy = Permissions.VehiclesManage)]
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
    foreach (var permission in Permissions.All)
        options.AddPolicy(permission, policy =>
            policy.RequireAuthenticatedUser().RequireRole(Permissions.RolesWith(permission)));
});

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());
});

// Errors are logged server-side; clients get a generic 500 (no stack traces/SQL in production)
builder.Services.AddProblemDetails();

// ── Max request body size 50MB (two photos of up to 10MB each fit easily) ──
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 52428800;
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// ── Front end: serve the web/ folder at the site root ─────────
string webRoot = Path.GetFullPath(Path.Combine(
    app.Environment.ContentRootPath, app.Configuration["FrontEndPath"] ?? "../../web"));
if (Directory.Exists(webRoot))
{
    var webFiles = new PhysicalFileProvider(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = webFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = webFiles });
}

app.UseAuthentication();
app.UseMiddleware<PasswordChangeGate>();
app.UseAuthorization();
app.MapControllers();
app.Run();

// Exposed for integration tests (WebApplicationFactory<Program>)
public partial class Program { }
