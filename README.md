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

## Running locally

**Requirements:** .NET 8 SDK and SQL Server LocalDB (comes with Visual Studio).

1. Create a LocalDB database named `StarQueen_PMTS`.
2. Run the API:
   ```
   cd backend/starqueenAPI
   dotnet run
   ```
   The API runs at `https://localhost:7273`.
3. Open `web/index.html` in a browser, or serve the `web/` folder with any static server (for example, VS Code Live Server).

> Never commit real database credentials. For a remote database, set the connection string through `dotnet user-secrets` or the `ConnectionStrings__DefaultConnection` environment variable.

## Credits

This started as a school group project. The original team:

- Daniela Barranda ([@DanielaBarranda](https://github.com/DanielaBarranda))
- [@heartdenise](https://github.com/heartdenise)
- [@dhanicka](https://github.com/dhanicka)
- [@Cil816](https://github.com/Cil816)

This repository is the updated version, independently maintained and enhanced by Daniela Barranda, separate from the original school project repositories.
