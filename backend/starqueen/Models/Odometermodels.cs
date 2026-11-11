using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// ============================================================
//  STARQUEEN PMTS — OdometerModels.cs
//  Add to your Models folder
// ============================================================

namespace starqueen.Models
{
    // Used by: POST /api/TruckOdometer/month
    // Represents one component's last maintenance date
    public class ComponentMaintenanceDate
    {
        public int reference_id { get; set; }
        public DateTime last_maintenance_date { get; set; }
    }

    // Request body for month-based odometer submission
    public class MonthOdometerRequest
    {
        public int truck_id { get; set; }
        public List<ComponentMaintenanceDate> components { get; set; } = new();
    }
}