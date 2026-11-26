"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { AdminPagination, Badge, Card, NoData } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { accountService } from "./account.service";
import { reputationReasonLabel, signedPoints } from "./account-rules";

const when = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Người mua",
  SELLER: "Người bán",
  ACCOUNT: "Tài khoản",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role.trim().toUpperCase()] ?? role;
}

function PolicyMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red";
}) {
  const palette =
    tone === "green"
      ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" }
      : tone === "red"
        ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" }
        : { bg: "#f8fafc", border: "var(--line, #e2e8f0)", color: "var(--ink)" };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        display: "grid",
        gap: "4px",
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: "18px", color: palette.color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
    </div>
  );
}

/** What moves the score and the limits to bid or sell, from the platform policy. Shown as read-only facts. */
export function ReputationPolicyBlock() {
  const policy = useApiResource("reputation-policy", (signal) => accountService.reputationPolicy(signal));
  const data = policy.data;
  return (
    <Card className="card-pad" style={{ display: "grid", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "17px" }}>Quy định điểm uy tín</h2>
        {data && (
          <Badge tone={data.enforcementEnabled ? "green" : "slate"}>
            {data.enforcementEnabled ? "Đang áp dụng giới hạn điểm" : "Chưa áp dụng giới hạn điểm"}
          </Badge>
        )}
      </div>
      {policy.error != null && <ErrorState cause={policy.error} operation="read" onRetry={policy.reload} />}
      {policy.loading && !data ? (
        <p>Đang tải…</p>
      ) : (
        data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
              gap: "12px",
            }}
          >
            <PolicyMetric label="Điểm khi mới đăng ký" value={data.initialScore} />
            <PolicyMetric label="Thang điểm" value={`${data.minScore} – ${data.maxScore}`} />
            <PolicyMetric label="Tối thiểu để đấu giá" value={`${data.minScoreToBid} điểm`} />
            <PolicyMetric label="Tối thiểu để bán hàng" value={`${data.minScoreToSell} điểm`} />
            <PolicyMetric label="Hoàn tất đơn hàng" value={signedPoints(data.orderCompletedReward)} tone="green" />
            <PolicyMetric label="Quá hạn thanh toán" value={signedPoints(-Math.abs(data.paymentTimeoutPenalty))} tone="red" />
            <PolicyMetric label="Người bán huỷ đơn" value={signedPoints(-Math.abs(data.sellerCancelPenalty))} tone="red" />
          </div>
        )
      )}
    </Card>
  );
}

/** The signed-in user's own score changes, newest first. */
export function ReputationHistoryBlock() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [page, setPage] = useState(1);
  const history = useApiResource(
    userId ? `reputation-history:${userId}:${page}` : null,
    (signal) => accountService.reputationHistory(userId ?? "", page, signal),
  );
  const rows = history.data ?? [];
  return (
    <Card className="card-pad" style={{ display: "grid", gap: "14px" }}>
      <h2 style={{ margin: 0, fontSize: "17px" }}>Lịch sử thay đổi điểm</h2>
      {history.error != null && <ErrorState cause={history.error} operation="read" onRetry={history.reload} />}
      {history.loading && !history.data ? (
        <p>Đang tải…</p>
      ) : rows.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Vai trò</th>
                <th>Thay đổi</th>
                <th>Điểm sau</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.logId}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "13px", color: "var(--muted)" }}>
                    {when(row.createdAt)}
                  </td>
                  <td>
                    <Badge tone="slate">{roleLabel(row.targetRole)}</Badge>
                  </td>
                  <td>
                    <Badge tone={row.changeAmount > 0 ? "green" : row.changeAmount < 0 ? "red" : "slate"}>
                      {signedPoints(row.changeAmount)}
                    </Badge>
                  </td>
                  <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{row.scoreAfter}</td>
                  <td>{reputationReasonLabel(row.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !history.error && <NoData title="Chưa có thay đổi điểm nào." />
      )}
      <AdminPagination
        page={page}
        pageSize={20}
        totalPages={rows.length === 20 ? page + 1 : page}
        loading={history.loading}
        onPageChange={setPage}
        itemLabel="thay đổi"
      />
    </Card>
  );
}
