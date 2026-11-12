import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';

export function NewTrip() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="New trip" back="/driver/trips">{gate}</DriverPage>;
}
