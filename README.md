# StarQueen PMTS

A preventive maintenance and truck tracking system for a trucking fleet. Admins monitor trucks, maintenance schedules, expenses and alerts. Drivers log odometer readings, truck activity, expenses and maintenance.

## Project structure

```
backend/   ASP.NET Core 8 Web API (Dapper + SQL Server)
  starqueen/      Models, repositories, services
  starqueenAPI/   API controllers
web/       Static HTML/CSS/JS front end
  ADMIN/          Dashboard, pending maintenance, expenses, alerts, activity logs, profile
  DRIVERS/        Dashboard, maintenance log, truck activity, expenses, odometer
```

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8 Web API (C#) |
| Data access | Dapper + Microsoft.Data.SqlClient, stored procedures and views |
| Database | SQL Server (LocalDB for development) |
| Auth | Cookie authentication (HttpOnly, SameSite=Strict), role-based (`Admin`, `Driver`), PBKDF2 password hashing via ASP.NET Core Identity's `PasswordHasher` |
| Front end | Static HTML, CSS and vanilla JavaScript, served by the API |
| API docs | Swagger / OpenAPI (Development only, at `/swagger`) |

## Running locally

**Requirements:** .NET 8 SDK and SQL Server LocalDB (comes with Visual Studio).

1. Make sure the `Starqueen_PMTS` database exists in `(localdb)\MSSQLLocalDB`.
   The connection string is in `backend/starqueenAPI/appsettings.json` under `ConnectionStrings:DefaultConnection`.
2. Trust the local HTTPS certificate (one time only):
   ```
   dotnet dev-certs https --trust
   ```
3. Run the app:
   ```
   cd backend/starqueenAPI
   dotnet run --launch-profile https
   ```
4. Open **https://localhost:7273** and log in. The API serves both the web pages and the data, so there is no separate front-end server.

On first start, any passwords still stored as plain text are hashed automatically; users keep logging in with the same password.

> Never commit real database credentials. For a remote database, set the connection string through `dotnet user-secrets` or the `ConnectionStrings__DefaultConnection` environment variable.

## Credits

This started as a school group project. The original team:

- Daniela Barranda ([@DanielaBarranda](https://github.com/DanielaBarranda))
- [@heartdenise](https://github.com/heartdenise)
- [@dhanicka](https://github.com/dhanicka)
- [@Cil816](https://github.com/Cil816)

This repository is the updated version, independently maintained and enhanced by Daniela Barranda, separate from the original school project repositories.
