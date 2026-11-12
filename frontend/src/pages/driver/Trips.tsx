import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function Trips() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Trips">{gate}</DriverPage>;
}
