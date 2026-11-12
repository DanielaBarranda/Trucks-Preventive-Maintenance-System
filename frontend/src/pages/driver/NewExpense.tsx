import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function NewExpense() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="New expense" back="/driver/expenses">{gate}</DriverPage>;
}
