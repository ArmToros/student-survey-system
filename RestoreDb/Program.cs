using System;
using Microsoft.Data.SqlClient;

class Program
{
    static void Main()
    {
        var password = Environment.GetEnvironmentVariable("MSSQL_SA_PASSWORD")
            ?? throw new InvalidOperationException("Set MSSQL_SA_PASSWORD before running the restore helper.");
        var connString = $"Server=db;Database=master;User Id=sa;Password={password};TrustServerCertificate=True;";
        try
        {
            using (var connection = new SqlConnection(connString))
            {
                connection.Open();
                Console.WriteLine("Connected to master DB.");

                string sql = System.IO.File.ReadAllText("/app/scripts/restore.sql");
                // ADO.NET doesn't like 'GO', we must split by GO
                string[] commands = sql.Split(new[] { "GO\r\n", "GO\n", "GO" }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach(var cmdText in commands)
                {
                    if (string.IsNullOrWhiteSpace(cmdText)) continue;
                    using (var command = new SqlCommand(cmdText, connection))
                    {
                        Console.WriteLine($"Executing: {cmdText.Substring(0, Math.Min(50, cmdText.Length))}...");
                        command.ExecuteNonQuery();
                    }
                }
                Console.WriteLine("Database restored successfully!");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.ToString());
        }
    }
}
