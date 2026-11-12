using starqueen.Data;
using starqueen.Services;
using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

// A tenant context fixed to one organization, for using services directly in tests
internal sealed class FixedTenant(int organizationId) : ITenantContext
{
    public int? OrganizationId => organizationId;
    public int? UserId => null;
    public string? Role => null;
}

[Collection("db")]
public class MaintenanceEvaluatorTests
{
    const string EngineOil = "Engine Oil & Filter Replacement";

    public MaintenanceEvaluatorTests() => TestDatabase.EnsureCreated();

    static MaintenanceEvaluator EvaluatorFor(int org) =>
        new(new SqlConnectionFactory(TestDatabase.ConnectionString, new FixedTenant(org)));

    static (int Org, int Vehicle, int Driver) NewTruck()
    {
        var org = RlsTests.CreateOrg("Truck");
        return (org.OrgId, RlsTests.AddVehicle(org.OrgId), AddDriver(org.OrgId));
    }

    static int Count(int org, string sql, object param)
    {
        using var c = OpenAs(org);
        return c.ExecuteScalar<int>(sql, param);
    }

    [Fact]
    public void Evaluate_CreatesAlertOncePerSchedule()
    {
        var t = NewTruck();
        AddReading(t.Org, t.Vehicle, t.Driver, 16000);   // oil + brakes Warning, tires + chassis Overdue

        var evaluator = EvaluatorFor(t.Org);
        int first = evaluator.Evaluate(t.Vehicle);
        Assert.Equal(4, first);
        Assert.Equal(0, evaluator.Evaluate(t.Vehicle));

        Assert.Equal(4, Count(t.Org, "SELECT COUNT(*) FROM dbo.MaintenanceLogs WHERE vehicle_id = @v AND resolved = 0", new { v = t.Vehicle }));
        Assert.Equal(1, Count(t.Org, """
            SELECT COUNT(*) FROM dbo.Notifications
            WHERE vehicle_id = @v AND task = @task AND type = 'Warning'
            """, new { v = t.Vehicle, task = EngineOil }));
        Assert.Equal(2, Count(t.Org, "SELECT COUNT(*) FROM dbo.Notifications WHERE vehicle_id = @v AND type = 'Urgent'", new { v = t.Vehicle }));
    }

    [Fact]
    public void Evaluate_EscalatesWarningToOverdue()
    {
        var t = NewTruck();
        AddReading(t.Org, t.Vehicle, t.Driver, 15200);   // oil Warning (tires/chassis Overdue too)
        var evaluator = EvaluatorFor(t.Org);
        evaluator.Evaluate(t.Vehicle);

        AddReading(t.Org, t.Vehicle, t.Driver, 19001);   // oil + brakes escalate to Overdue
        Assert.Equal(2, evaluator.Evaluate(t.Vehicle));

        using var c = OpenAs(t.Org);
        Assert.Equal("Overdue", c.QuerySingle<string>("""
            SELECT l.status FROM dbo.MaintenanceLogs l JOIN dbo.MaintenanceSchedules s ON s.id = l.schedule_id
            WHERE l.vehicle_id = @v AND s.task = @task AND l.resolved = 0
            """, new { v = t.Vehicle, task = EngineOil }));
        Assert.Equal(2, c.ExecuteScalar<int>(
            "SELECT COUNT(*) FROM dbo.Notifications WHERE vehicle_id = @v AND task = @task",
            new { v = t.Vehicle, task = EngineOil }));
    }

    [Fact]
    public void Evaluate_IgnoresGoodSchedules()
    {
        var t = NewTruck();
        AddReading(t.Org, t.Vehicle, t.Driver, 1000);
        Assert.Equal(0, EvaluatorFor(t.Org).Evaluate(t.Vehicle));
        Assert.Equal(0, Count(t.Org, "SELECT COUNT(*) FROM dbo.Notifications WHERE vehicle_id = @v", new { v = t.Vehicle }));
    }
}
