import { Route, Routes } from 'react-router-dom';

// Temporary — replaced by the full route table in Task 3
export function AppRoutes() {
  return (
    <Routes>
      <Route path="*" element={<h1 className="p-8 text-2xl font-bold text-blue-700">FleetPMTS</h1>} />
    </Routes>
  );
}
