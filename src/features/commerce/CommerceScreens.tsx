"use client";

import { useState } from "react";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { api, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { REPORT_REFUND_STATUS, REPORT_STATUS, statusLabel } from "@/lib/status-labels";

const unwrap = <T,>(value: ApiResponse<T> | T): T => value && typeof value === "object" && "data" in value ? value.data : value;
const errorText = (error: Error | null) => error?.message ?? "";

type UserReport = { refundStatus?: string; refundAmount?: number; reportId?: string; targetType?: string; targetId?: string; reason?: string; status?: string; adminNote?: string; createdAt?: string };


export function BuyerReportsScreen() {
  const [targetId,setTargetId]=useState("");const [violationType,setType]=useState("Fraud");const [description,setDescription]=useState("");const [evidence,setEvidence]=useState<File[]>([]);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
  const reports=useApiResource("/api/v1/me/reports?page=1&limit=20",async()=>{const result=unwrap(await api.get<ApiResponse<{items:UserReport[]}>>('/api/v1/me/reports?page=1&limit=20'));return result.items??[];});
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess("");try{
    let evidenceUrls:string[]=[];
    if(evidence.length){const form=new FormData();evidence.forEach(file=>form.append("files",file));const uploaded=unwrap(await api.post<ApiResponse<{urls:string[]}>|{urls:string[]}>("/api/v1/reports/files/upload",form));evidenceUrls=uploaded.urls;}
    await api.post('/api/v1/users/reports',{reportedUserId:targetId.trim(),violationType,description:description.trim(),evidenceUrls});setSuccess("Đã gửi báo cáo. Trạng thái sẽ cập nhật khi được xử lý.");setTargetId("");setDescription("");setEvidence([]);reports.reload();}catch(reason){setError(errorText(reason as Error));}finally{setBusy(false);}}
  return <div className="buyer-reports-page">
    <PageHeading title="Báo cáo người dùng" />
    <div className="split buyer-reports-layout">
      <Card className="card-pad buyer-report-form-card">
        <h2>Thông tin báo cáo</h2>
        <form className="auth-fields" onSubmit={e=>void submit(e)}>
          <label className="field-wrap">Mã người dùng bị báo cáo<input className="field" required value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="UUID" /></label>
          <label className="field-wrap">Loại vi phạm<select className="select-field" value={violationType} onChange={e=>setType(e.target.value)}><option value="Fraud">Gian lận</option><option value="Harassment">Quấy rối</option><option value="Counterfeit">Hàng giả</option><option value="Spam">Spam</option><option value="Other">Khác</option></select></label>
          <label className="field-wrap">Mô tả<textarea className="textarea-field" required minLength={10} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <label className="field-wrap">Ảnh bằng chứng (tối đa 5 ảnh)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length>5||files.some(file=>file.size>5*1024*1024)){setError("Chọn tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 5 MB.");setEvidence([]);}else{setError("");setEvidence(files);}}} /></label>
          {error&&<p className="notice" role="alert">{error}</p>}
          {success&&<p className="form-success" role="status">{success}</p>}
          <button className="button button-primary" type="submit" disabled={busy||Boolean(error)}>{busy?"Đang gửi…":"Gửi báo cáo"}</button>
        </form>
      </Card>
      <Card className="buyer-report-history-card">
        <div className="card-header"><h2>Báo cáo đã gửi</h2></div>
        {reports.error&&<p className="notice" role="alert">{errorText(reports.error)}</p>}
        {reports.data?.length?reports.data.map((report,index)=><div className="buyer-report-item" key={report.reportId??index}>
          <div className="buyer-report-item-content">
            <strong>{report.reason??report.targetType??"Báo cáo"}</strong>
            <span className="buyer-report-item-id">{report.targetId??"—"}</span>
            {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
            {report.adminNote&&<p>Phản hồi: {report.adminNote}</p>}
            {report.refundStatus&&report.refundStatus!=="None"&&<p>Hoàn tiền: {statusLabel(REPORT_REFUND_STATUS, report.refundStatus)}{typeof report.refundAmount==="number"&&report.refundAmount>0?` (${report.refundAmount.toLocaleString("vi-VN")} ₫)`:""}</p>}
          </div>
          <Badge>{statusLabel(REPORT_STATUS, report.status)}</Badge>
        </div>):<NoData title={reports.loading?"Đang tải báo cáo…":reports.error?"Không tải được báo cáo":"Chưa gửi báo cáo nào"}/>}
      </Card>
    </div>
  </div>;
}
