// ============================================================
//  STARQUEEN PMTS — TruckMaintenanceLogsServices.cs
// ============================================================

using starqueen.Models;
using starqueen.Repositories;

namespace starqueen.Services
{
    public class TruckMaintenanceLogsServices
    {
        public readonly TruckMaintenanceLogsRepository _repo = new TruckMaintenanceLogsRepository();

        // ── Basic CRUD ───────────────────────────────────────────────────────

        public Truck_Maintenance_Logs GetMaintenanceLogById(int id)
            => _repo.GetById(id);

        public bool AddMaintenanceLog(Truck_Maintenance_Logs log)
            => _repo.Add(log);

        public bool DeleteMaintenanceLog(int id)
            => _repo.Delete(id);

        public List<Truck_Maintenance_Logs> GetAllMaintenanceLogs()
            => (List<Truck_Maintenance_Logs>)_repo.GetAll();

        public bool UpdateMaintenanceLog(Truck_Maintenance_Logs log)
            => _repo.Update(log);

        // ── SP: SP_Maintenance_Monitoring_Alert_Detection ────────────────────
        public List<MaintenanceAlert> GetMaintenanceAlerts()
            => _repo.GetMaintenanceAlerts();

        // ── SP: SP_Trucks_With_Multiple_Near_Replacement ─────────────────────
        public List<NearReplacement> GetNearReplacement()
            => _repo.GetNearReplacement();

        // ── SP: SP_Oldest_Installed_Components_Per_Month ─────────────────────
        public List<OldestComponent> GetOldestComponents()
            => _repo.GetOldestComponents();

        // ── SP: SP_Components_Overdue_for_Replacement ────────────────────────
        public List<OverdueComponent> GetComponentsOverdueForReplacement()
            => _repo.GetComponentsOverdueForReplacement();

        // ── SP: SP_Number_Of_Truck_Components_With_Good_Status ───────────────
        public List<GoodStatusComponent> GetComponentsWithGoodStatus()
            => _repo.GetComponentsWithGoodStatus();

        // ── SP: SP_Total_Number_Of_Components_Installed_On_Each_Truck ────────
        public List<TotalComponents> GetTotalComponentsPerTruck()
            => _repo.GetTotalComponentsPerTruck();
    }
}