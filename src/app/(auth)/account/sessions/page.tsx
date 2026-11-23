import { RoleGate } from "@/components/auth/RoleGate";
import { SessionsScreenClient } from "@/components/client/ClientScreens";

export default function Page() {
  return <RoleGate allowedRoles={["Buyer", "Seller", "Staff", "Admin"]}><SessionsScreenClient /></RoleGate>;
}
