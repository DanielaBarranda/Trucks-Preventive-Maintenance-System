// Shapes returned by the API. Field names match the API's snake_case JSON exactly.

export type DistanceUnit = 'km' | 'mi';

export interface Session {
  user: {
    id: number;
    full_name: string;
    email: string;
    role: string;
    must_change_password: boolean;
  };
  organization: {
    id: number;
    name: string;
    currency_code: string;
    distance_unit: DistanceUnit;
  };
  permissions: string[];
}

export interface FleetOverviewRow {
  vehicle_id: number;
  vehicle_name: string;
  plate_number: string;
  vehicle_type: string;
  assigned_driver_name: string | null;
  latest_reading: number | null;
  total_expenses: number | null;
  min_expense: number | null;
  max_expense: number | null;
  expense_count: number;
  last_expense_date: string | null;
  open_alerts: number;
  unread_notifications: number;
  last_trip_at: string | null;
}

export type MaintenanceStatus = 'Good' | 'Warning' | 'Replace' | 'Overdue' | 'No Data';

export interface MaintenanceStatusRow {
  vehicle_id: number;
  plate_number: string;
  schedule_id: number;
  task: string;
  last_service_date: string | null;
  last_service_reading: number | null;
  current_reading: number | null;
  distance_since: number | null;
  months_since: number | null;
  status: MaintenanceStatus;
}

export interface NotificationItem {
  id: number;
  vehicle_id: number | null;
  maintenance_log_id: number | null;
  type: 'Urgent' | 'Warning' | 'Information';
  message: string;
  task: string | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: number;
  name: string;
  plate_number: string;
  vehicle_type_id: number;
  vehicle_type: string;
  assigned_driver_id: number | null;
  assigned_driver_name: string | null;
  is_active: boolean;
}

export interface MonthlyExpenseRow {
  vehicle_id: number;
  plate_number: string;
  year: number;
  month: number;
  total: number;
  min: number;
  max: number;
  count: number;
}

export interface OdometerReading {
  id: number;
  vehicle_id: number;
  driver_id: number;
  reading: number;
  recorded_at: string;
}

export interface Trip {
  id: number;
  vehicle_id: number;
  driver_id: number;
  driver_name: string | null;
  trip_date: string;            // "YYYY-MM-DDT00:00:00"
  pickup_location: string;
  pickup_address: string;
  destination: string;
  scheduled_time: string | null; // "HH:mm:ss"
  departed_at: string | null;
  arrived_at: string | null;
}

export interface NewTrip {
  trip_date: string;            // YYYY-MM-DD
  pickup_location: string;
  pickup_address: string;
  destination: string;
  scheduled_time?: string;      // HH:mm
}

export interface Expense {
  id: number;
  vehicle_id: number;
  driver_id: number;
  schedule_id: number | null;
  expense_date: string;         // "YYYY-MM-DDT00:00:00"
  category: string;
  amount: number;
  notes: string | null;
  created_at: string;
}
