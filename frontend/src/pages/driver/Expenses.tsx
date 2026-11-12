import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function Expenses() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Expenses">{gate}</DriverPage>;
}
