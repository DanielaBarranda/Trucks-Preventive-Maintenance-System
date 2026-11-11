using System.Text.RegularExpressions;

namespace starqueen.Tests;

// Creates a fresh FleetPMTS_Test database from database/schema.sql + seed.sql
// once per test run. Never touches any other database.
public static class TestDatabase
{
    public const string Name = "FleetPMTS_Test";
    const string Server = @"(localdb)\MSSQLLocalDB";

    public static readonly string ConnectionString =
        $"Server={Server};Database={Name};Trusted_Connection=True;TrustServerCertificate=True";

    static readonly string MasterConnectionString =
        $"Server={Server};Database=master;Trusted_Connection=True;TrustServerCertificate=True";

    static readonly Lazy<bool> Created = new(Create, LazyThreadSafetyMode.ExecutionAndPublication);

    public static void EnsureCreated() => _ = Created.Value;

    static bool Create()
    {
        using (var master = new SqlConnection(MasterConnectionString))
        {
            master.Execute($"""
                IF DB_ID('{Name}') IS NOT NULL
                BEGIN
                    ALTER DATABASE [{Name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE [{Name}];
                END
                CREATE DATABASE [{Name}];
                """);
        }
        SqlConnection.ClearAllPools();

        RunScript("schema.sql");
        RunScript("seed.sql");
        return true;
    }

    public static void RunScript(string fileName)
    {
        string path = Path.Combine(AppContext.BaseDirectory, "database", fileName);
        string sql = File.ReadAllText(path);
        using var c = new SqlConnection(ConnectionString);
        c.Open();
        foreach (var batch in SplitBatches(sql))
            c.Execute(batch, commandTimeout: 120);
    }

    // Splits a script on lines containing only "GO" (like sqlcmd does)
    public static IEnumerable<string> SplitBatches(string sql) =>
        Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase)
             .Where(b => !string.IsNullOrWhiteSpace(b));
}

[CollectionDefinition("db", DisableParallelization = true)]
public class DbCollection { }
