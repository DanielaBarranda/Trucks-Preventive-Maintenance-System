import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function Odometer() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Log odometer" back="/driver">{gate}</DriverPage>;
}
