using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using starqueen.Data;
using starqueen.Repositories;
using starqueen.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────
// Connection string lives in appsettings.json → ConnectionStrings:DefaultConnection
// (override per machine with user secrets or ConnectionStrings__DefaultConnection env var)
builder.Services.AddSingleton<IDbConnectionFactory>(
    new SqlConnectionFactory(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Repositories ──────────────────────────────────────────────
builder.Services.AddScoped<AdminMaintenanceViewRepository>();
builder.Services.AddScoped<AdminNotificationsRepository>();
builder.Services.AddScoped<MaintenanceReferenceRepository>();
builder.Services.AddScoped<TruckActivityRepository>();
builder.Services.AddScoped<TruckExpensesRepository>();
builder.Services.AddScoped<TruckMaintenanceLogsRepository>();
builder.Services.AddScoped<TruckNotificationsRepository>();
builder.Services.AddScoped<TruckOdometerRepository>();
builder.Services.AddScoped<TrucksRepository>();
builder.Services.AddScoped<UsersRepository>();

// ── Services ──────────────────────────────────────────────────
builder.Services.AddSingleton<PasswordService>();
builder.Services.AddScoped<AdminMaintenanceViewServices>();
builder.Services.AddScoped<AdminNotificationsServices>();
builder.Services.AddScoped<MaintenanceReferenceServices>();
builder.Services.AddScoped<TruckActivityServices>();
builder.Services.AddScoped<TruckExpensesServices>();
builder.Services.AddScoped<TruckMaintenanceLogsServices>();
builder.Services.AddScoped<TruckNotificationsServices>();
builder.Services.AddScoped<TruckOdometerServices>();
builder.Services.AddScoped<TrucksServices>();
builder.Services.AddScoped<UsersServices>();

// ── Authentication: HttpOnly cookie issued by POST /api/auth/login ──
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "starqueen.auth";
        options.Cookie.HttpOnly = true;                       // not readable from JavaScript
        options.Cookie.SameSite = SameSiteMode.Strict;        // not sent on cross-site requests
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(24);      // matches SessionManager in config.js
        options.SlidingExpiration = false;

        // This is an API: answer 401/403 instead of redirecting to a login page
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });

// Every API endpoint requires a logged-in user unless marked [AllowAnonymous].
// Static pages are served before this and stay public (they redirect to login themselves).
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

builder.Services.AddControllers();
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

// ── One-time upgrade: hash any passwords still stored as plain text ──
using (var scope = app.Services.CreateScope())
{
    int upgraded = scope.ServiceProvider.GetRequiredService<UsersServices>().HashLegacyPasswords();
    if (upgraded > 0)
        app.Logger.LogInformation("Hashed {Count} plain-text password(s).", upgraded);
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// ── Front end: serve the web/ folder at the site root ─────────
// so https://localhost:7273/ opens the app and API calls are same-origin (no CORS needed).
string webRoot = Path.GetFullPath(Path.Combine(
    app.Environment.ContentRootPath, app.Configuration["FrontEndPath"] ?? "../../web"));
if (Directory.Exists(webRoot))
{
    var webFiles = new PhysicalFileProvider(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = webFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = webFiles });
}
else
{
    app.Logger.LogWarning("Front-end folder not found at {Path}; only the API will be served.", webRoot);
}

// wwwroot/ — uploaded expense photos (/uploads/...)
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
