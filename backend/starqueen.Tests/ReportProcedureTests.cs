using static starqueen.Tests.DbFixtures;

namespace starqueen.Tests;

[Collection("db")]
public class ReportProcedureTests
{
    const string EngineOil = "Engine Oil & Filter Replacement";   // Truck: 15200 / 19000 / 19001 km, 3 months

    public ReportProcedureTests() => TestDatabase.EnsureCreated();

    (int Org, int Vehicle, int Driver) NewTruck()
    {
        var org = RlsTests.CreateOrg("Truck");
        return (org.OrgId, RlsTests.AddVehicle(org.OrgId), AddDriver(org.OrgId));
    }

    [Fact]
    public void Status_Good_WhenUnderWarning()
    {
        var t = NewTruck();
        AddReading(t.Org, t.Vehicle, t.Driver, 1000);
        Assert.Equal("Good", Status(t.Org, t.Vehicle, EngineOil));
    }

    [Theory]
    [InlineData(15200, "Warning")]
    [InlineData(19000, "Replace")]
    [InlineData(19001, "Overdue")]
    public void Status_Warning_Replace_Overdue_ByDistance(int reading, string expected)
    {
        var t = NewTruck();
        AddReading(t.Org, t.Vehicle, t.Driver, reading);
        Assert.Equal(expected, Status(t.Org, t.Vehicle, EngineOil));
    }

    [Fact]
    public void Status_MeasuredSinceLastService()
    {
        var t = NewTruck();
        AddServiceDone(t.Org, t.Vehicle, ScheduleId(t.Org, EngineOil), 19000, DateTime.UtcNow);
        AddReading(t.Org, t.Vehicle, t.Driver, 20000);
        Assert.Equal("Good", Status(t.Org, t.Vehicle, EngineOil));   // old absolute logic said Overdue
    }

    [Theory]
    [InlineData(2, "Warning")]   // 80% of 3 months = 2
    [InlineData(3, "Replace")]
    [InlineData(4, "Overdue")]
    public void Status_ByMonths(int monthsAgo, string expected)
    {
        var t = NewTruck();
        AddServiceDone(t.Org, t.Vehicle, ScheduleId(t.Org, EngineOil), 5000, DateTime.UtcNow.AddMonths(-monthsAgo));
        AddReading(t.Org, t.Vehicle, t.Driver, 5000);   // 0 distance since service
        Assert.Equal(expected, Status(t.Org, t.Vehicle, EngineOil));
    }

    [Fact]
    public void Status_WorseOfDistanceAndMonth()
    {
        var t = NewTruck();
        AddServiceDone(t.Org, t.Vehicle, ScheduleId(t.Org, EngineOil), 0, DateTime.UtcNow.AddMonths(-4));  // months: Overdue
        AddReading(t.Org, t.Vehicle, t.Driver, 15200);                                                     // distance: Warning
        Assert.Equal("Overdue", Status(t.Org, t.Vehicle, EngineOil));
    }

    [Fact]
    public void Status_NoData_WhenNoReadingAndNoInterval()
    {
        var t = NewTruck();
        using (var c = OpenAs(t.Org))
            c.Execute("""
                INSERT dbo.MaintenanceSchedules (vehicle_type_id, task, km_warning, km_replace, km_overdue, month_interval)
                VALUES ((SELECT vehicle_type_id FROM dbo.Vehicles WHERE id = @v), 'Distance only', 100, 200, 201, NULL)
                """, new { v = t.Vehicle });
        Assert.Equal("No Data", Status(t.Org, t.Vehicle, "Distance only"));
    }

    [Fact]
    public void MonthlyExpenses_AggregatesPerVehicleMonth()
    {
        var t = NewTruck();
        var day = new DateTime(2026, 3, 10);
        AddExpense(t.Org, t.Vehicle, t.Driver, 100m, day);
        AddExpense(t.Org, t.Vehicle, t.Driver, 300m, day.AddDays(5));

        using var c = OpenAs(t.Org);
        var row = c.QuerySingle<(int vehicle_id, string plate_number, int year, int month, decimal total, decimal min, decimal max, int count)>(
            "EXEC dbo.rpt_MonthlyExpenses");
        Assert.Equal((2026, 3), (row.year, row.month));
        Assert.Equal(400m, row.total);
        Assert.Equal(100m, row.min);
        Assert.Equal(300m, row.max);
        Assert.Equal(2, row.count);
    }

    [Fact]
    public void Reports_OnlyIncludeOwnOrganization()
    {
        var a = NewTruck();
        var b = NewTruck();
        AddExpense(b.Org, b.Vehicle, b.Driver, 50m, DateTime.UtcNow);

        using var c = OpenAs(a.Org);
        var vehicleIds = c.Query("EXEC dbo.rpt_FleetOverview").Select(r => (int)r.vehicle_id).ToList();
        Assert.Equal(new[] { a.Vehicle }, vehicleIds);
        Assert.Empty(c.Query("EXEC dbo.rpt_MonthlyExpenses"));
        Assert.DoesNotContain(c.Query("EXEC dbo.rpt_MaintenanceStatus"), r => (int)r.vehicle_id == b.Vehicle);
        Assert.Empty(c.Query("EXEC dbo.rpt_DriverActivity").Where(r => (int)r.driver_id == b.Driver));
    }
}
