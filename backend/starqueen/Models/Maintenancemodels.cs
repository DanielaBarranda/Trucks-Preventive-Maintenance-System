using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// ============================================================
//  STARQUEEN PMTS — MaintenanceModels.cs
//  Add these model classes to your Models folder
//  (or add to existing models file if you have one)
// ============================================================

namespace starqueen.Models
{
    // SP_Components_Overdue_for_Replacement
    // Returns: truck_id, truck_name, replace_now_components
    public class OverdueComponent
    {
        public int truck_id { get; set; }
        public string truck_name { get; set; } = string.Empty;
        public int replace_now_components { get; set; }
    }

    // SP_Number_Of_Truck_Components_With_Good_Status
    // Returns: truck_id, plate_number (aliased as truck_name in SP), good_maintenance_count
    public class GoodStatusComponent
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = string.Empty;
        public int good_maintenance_count { get; set; }
    }

    // SP_Total_Number_Of_Components_Installed_On_Each_Truck
    // Returns: truck_id, plate_number (aliased as truck_name in SP), total_maintenance_items
    public class TotalComponents
    {
        public int truck_id { get; set; }
        public string plate_number { get; set; } = string.Empty;
        public int total_maintenance_items { get; set; }
    }
}
