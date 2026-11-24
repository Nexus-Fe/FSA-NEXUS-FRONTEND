import { LoadingState } from "@/components/ui/States";

export default function RootLoading() {
  return (
    <div className="page-container" style={{ paddingBlock: 32 }}>
      <LoadingState rows={4} label="Đang tải trang…" />
    </div>
  );
}
