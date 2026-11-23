import { RoleGate } from "@/components/auth/RoleGate";
import { SellerDocumentsScreenClient } from "@/components/client/ClientScreens";

export default function Page() {
  return <RoleGate allowedRoles={["Buyer", "Seller", "Staff", "Admin"]}><SellerDocumentsScreenClient /></RoleGate>;
}
