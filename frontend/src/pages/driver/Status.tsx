import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function Status() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Maintenance">{gate}</DriverPage>;
}
