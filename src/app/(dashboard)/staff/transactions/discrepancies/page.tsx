import { Card, NoData, PageHeading } from "@/components/ui/Primitives";

export default function StaffDiscrepanciesPage() {
  return (
    <>
      <PageHeading
        overline="Nhân viên vận hành"
        title="Đối soát giao dịch"
        description="Chức năng đối soát sổ cái và sai lệch tài chính được giới hạn cho Quản trị viên (Admin)."
      />
      <Card className="card-pad">
        <NoData title="Chức năng chỉ dành cho Quản trị viên" />
        <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 8 }}>
          Theo phân quyền hệ thống tài chính, các thao tác chạy đối soát và xử lý sai lệch chỉ được thực hiện tại cổng Quản trị viên.
        </p>
      </Card>
    </>
  );
}
