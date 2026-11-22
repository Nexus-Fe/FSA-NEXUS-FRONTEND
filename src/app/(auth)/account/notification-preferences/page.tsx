import { RoleGate } from "@/components/auth/RoleGate";
import { NotificationPreferencesScreenClient } from "@/components/client/ClientScreens";

export default function Page() {
  return <RoleGate allowedRoles={["Buyer", "Seller", "Staff", "Admin"]}><NotificationPreferencesScreenClient /></RoleGate>;
}
