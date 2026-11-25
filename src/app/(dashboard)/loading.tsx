import { LoadingState } from "@/components/ui/States";

export default function DashboardLoading() {
  return (
    <div className="page-container" style={{ paddingBlock: 32 }}>
      <LoadingState rows={5} label="Đang tải bảng điều khiển…" />
    </div>
  );
}
