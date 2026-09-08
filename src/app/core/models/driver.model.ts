// Matches backend user-service DriverInfoResponse exactly
export interface DriverInfo {
  userId: string; // was: driverId: number — backend uses string UUID
  email: string;
  name: string;
  phoneNumber: string;
  vehicleBrand: string; // was: vehicle.brand (nested) — backend returns flat fields
  vehicleModel: string;
  vehiclePlate: string; // was: vehicle.licensePlate
  vehicleColor: string;
}

// Helper — use in templates instead of a single driverName field
export function getDriverFullName(driver: DriverInfo): string {
  return `${driver.name} `;
}
