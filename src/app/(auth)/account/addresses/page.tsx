import { RoleGate } from "@/components/auth/RoleGate";
import { AddressBookScreenClient } from "@/components/client/ClientScreens";

export default function AccountAddressesPage() {
  return <RoleGate allowedRoles={["Buyer", "Seller", "Staff", "Admin"]}><AddressBookScreenClient /></RoleGate>;
}
