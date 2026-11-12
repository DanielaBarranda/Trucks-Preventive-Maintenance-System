namespace starqueen.Tests;

[Collection("db")]
public class RlsTests
{
    public RlsTests() => TestDatabase.EnsureCreated();

    // ── helpers ──────────────────────────────────────────────────────────
    internal static SqlConnection OpenAs(int? organizationId)
    {
        var c = new SqlConnection(TestDatabase.ConnectionString);
        c.Open();
        if (organizationId is int id)
            c.Execute("EXEC sp_set_session_context @key = N'organization_id', @value = @id, @read_only = 1", new { id });
        return c;
    }

    internal static (int OrgId, int UserId, string Email) CreateOrg(
        string categories = "Truck", string unit = "km", string? email = null)
    {
        email ??= $"{Guid.NewGuid():N}@test.local";
        using var c = OpenAs(null);
        var row = c.QuerySingle<(int organization_id, int user_id)>(
            "EXEC auth.CreateOrganization @org_name, @currency_code, @distance_unit, @owner_name, @email, @password_hash, @template_categories",
            new
            {
                org_name = "Org " + email[..6],
                currency_code = "PHP",
                distance_unit = unit,
                owner_name = "Owner",
                email,
                password_hash = "hash",
                template_categories = categories
            });
        return (row.organization_id, row.user_id, email);
    }

    internal static int AddVehicle(int orgId, string? plate = null)
    {
        using var c = OpenAs(orgId);
        return c.QuerySingle<int>("""
            INSERT dbo.Vehicles (name, plate_number, vehicle_type_id)
            OUTPUT INSERTED.id
            VALUES ('Test vehicle', @plate, (SELECT TOP 1 id FROM dbo.VehicleTypes ORDER BY id))
            """, new { plate = plate ?? Guid.NewGuid().ToString("N")[..10] });
    }

    // ── tests ────────────────────────────────────────────────────────────
    [Fact]
    public void NoSessionContext_SeesNoRows()
    {
        var a = CreateOrg();
        AddVehicle(a.OrgId);

        using var c = OpenAs(null);
        Assert.Equal(0, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Vehicles"));
        Assert.Equal(0, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Users"));
        Assert.Equal(0, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Organizations"));
    }

    [Fact]
    public void OrgA_SeesOnlyOwnRows()
    {
        var a = CreateOrg();
        var b = CreateOrg();
        AddVehicle(a.OrgId);
        AddVehicle(b.OrgId);

        using var c = OpenAs(a.OrgId);
        var orgIds = c.Query<int>("SELECT organization_id FROM dbo.Vehicles").ToList();
        Assert.NotEmpty(orgIds);
        Assert.All(orgIds, id => Assert.Equal(a.OrgId, id));
        Assert.Equal(1, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.Organizations"));
    }

    [Fact]
    public void OrgA_CannotInsertIntoOrgB()
    {
        var a = CreateOrg();
        var b = CreateOrg();
        using var cb = OpenAs(b.OrgId);
        int bType = cb.QuerySingle<int>("SELECT TOP 1 id FROM dbo.VehicleTypes");

        using var c = OpenAs(a.OrgId);
        Assert.Throws<SqlException>(() => c.Execute("""
            INSERT dbo.Vehicles (organization_id, name, plate_number, vehicle_type_id)
            VALUES (@org, 'x', 'BLOCKED-1', @type)
            """, new { org = b.OrgId, type = bType }));
    }

    [Fact]
    public void OrgA_CannotUpdateOrDeleteOrgB()
    {
        var a = CreateOrg();
        var b = CreateOrg();
        int bVehicle = AddVehicle(b.OrgId);

        using var c = OpenAs(a.OrgId);
        Assert.Equal(0, c.Execute("UPDATE dbo.Vehicles SET name = 'hacked' WHERE id = @bVehicle", new { bVehicle }));
        Assert.Equal(0, c.Execute("DELETE dbo.Vehicles WHERE id = @bVehicle", new { bVehicle }));
    }

    [Fact]
    public void DefaultOrganizationId_ComesFromSessionContext()
    {
        var a = CreateOrg();
        int id = AddVehicle(a.OrgId);

        using var c = OpenAs(a.OrgId);
        Assert.Equal(a.OrgId, c.QuerySingle<int>("SELECT organization_id FROM dbo.Vehicles WHERE id = @id", new { id }));
    }

    [Fact]
    public void FindUserByEmail_WorksWithoutContext()
    {
        CreateOrg();
        var b = CreateOrg();

        using var c = OpenAs(null);
        var user = c.QuerySingle("EXEC auth.FindUserByEmail @email", new { email = b.Email });
        Assert.Equal(b.UserId, (int)user.id);
        Assert.Equal(b.OrgId, (int)user.organization_id);
        Assert.Equal("Owner", (string)user.role);
    }

    [Fact]
    public void CreateOrganization_CopiesTemplates()
    {
        var a = CreateOrg("Truck,Motorcycle");

        using var c = OpenAs(a.OrgId);
        Assert.Equal(2, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.VehicleTypes"));
        int templates = c.ExecuteScalar<int>(
            "SELECT COUNT(*) FROM dbo.ScheduleTemplates WHERE category IN (N'Truck', N'Motorcycle')");
        Assert.True(templates > 0);
        Assert.Equal(templates, c.ExecuteScalar<int>("SELECT COUNT(*) FROM dbo.MaintenanceSchedules"));
    }

    [Fact]
    public void CreateOrganization_Miles_ConvertsThresholds()
    {
        var a = CreateOrg("Truck", unit: "mi");

        using var c = OpenAs(a.OrgId);
        int kmReplace = c.QuerySingle<int>(
            "SELECT km_replace FROM dbo.MaintenanceSchedules WHERE task = N'Engine Oil & Filter Replacement'");
        Assert.Equal(11800, kmReplace);   // 19000 × 0.621371 = 11806 → nearest 100
    }

    [Fact]
    public void CreateOrganization_DuplicateEmail_Raises50001()
    {
        var a = CreateOrg();

        var ex = Assert.Throws<SqlException>(() => CreateOrg(email: a.Email));
        Assert.Equal(50001, ex.Number);

        using var c = OpenAs(null);
        var user = c.QuerySingle<(int id, int organization_id)>("EXEC auth.FindUserByEmail @email", new { email = a.Email });
        Assert.Equal(a.OrgId, user.organization_id);
    }
}
