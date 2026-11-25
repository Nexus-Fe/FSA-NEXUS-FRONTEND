"use client";

import { useState } from "react";
import { AdminPagination, Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { ReputationScore } from "./ReputationScore";
import { profileService } from "./services/profile.service";

const PENALTY_TYPE_LABEL: Record<string, string> = {
  Warning: "Cảnh cáo",
  DeductPoints: "Trừ điểm uy tín",
  Restriction: "Hạn chế tính năng",
  BanAccount: "Khóa tài khoản",
  Other: "Khác",
};

const PENALTY_STATUS_LABEL: Record<string, { label: string; tone: "amber" | "slate" | "green" }> = {
  Active: { label: "Đang hiệu lực", tone: "amber" },
  Expired: { label: "Hết hạn", tone: "slate" },
  Revoked: { label: "Đã thu hồi", tone: "green" },
};

const ROLE_LABEL: Record<string, string> = {
  Buyer: "Người mua",
  Seller: "Người bán",
  Account: "Tài khoản",
};

export function ReputationScreen() {
  const [penaltyPage, setPenaltyPage] = useState(1);
  const profile = useApiResource("reputation-profile", (signal) => profileService.getProfile(signal));
  const reputation = useApiResource("my-reputation", (signal) => profileService.getMyReputation(signal));
  const policy = useApiResource("reputation-policy", (signal) => profileService.getReputationPolicy(signal));
  const penalties = useApiResource(`my-penalties:${penaltyPage}`, (signal) => profileService.getMyPenalties(penaltyPage, 10, signal));
  const score = reputation.data?.currentScore ?? profile.data?.reputationScore;
  const nextLevel = typeof score === "number"
    ? policy.data?.trustLevels.filter((tier) => tier.minScore > score).sort((a, b) => a.minScore - b.minScore)[0]
    : undefined;

  return <div className="reputation-page">
    <PageHeading title="Uy tín của tôi" description="Theo dõi điểm tài khoản và điều kiện tham gia giao dịch trên sàn." />
    {profile.error && <ErrorState title="Không tải được điểm uy tín" cause={profile.error} onRetry={profile.reload} />}
    {profile.loading && <LoadingState label="Đang tải điểm uy tín…" />}
    {reputation.error && <ErrorState title="Không tải được điểm theo vai trò" cause={reputation.error} onRetry={reputation.reload} />}
    {profile.data && <ReputationScore score={score} level={reputation.data?.trustLevel ?? profile.data.trustLevel} heading="Uy tín Buyer" description="Điểm khi mua hàng và tham gia đấu giá" />}
    {profile.data?.isSeller && reputation.data && <ReputationScore score={reputation.data.sellerScore} level={reputation.data.sellerTrustLevel} heading="Uy tín Seller" description="Điểm khi bán hàng và tạo phiên đấu giá" />}
    {policy.error && <ErrorState title="Không tải được chính sách uy tín" cause={policy.error} onRetry={policy.reload} />}
    {policy.loading && <LoadingState label="Đang tải chính sách uy tín…" />}
    {policy.data && <Card className="card-pad reputation-policy">
      <h2>Điều kiện theo chính sách hiện tại</h2>
      {policy.data.enforcementEnabled ? <>
        <div className="info-row"><span>Tham gia đấu giá</span><strong>{policy.data.minScoreToBid} điểm · {reputation.data ? reputation.data.canBid ? "Đủ điều kiện" : "Chưa đủ điều kiện" : "Chưa xác định"}</strong></div>
        <div className="info-row"><span>Bán hàng</span><strong>{policy.data.minScoreToSell} điểm · {reputation.data ? reputation.data.canSell ? "Đủ điều kiện" : "Chưa đủ điều kiện" : "Chưa xác định"}</strong></div>
      </> : <p>Quy tắc giới hạn theo điểm uy tín hiện chưa được áp dụng.</p>}
      <div className="info-row"><span>Mức tiếp theo</span><strong>{nextLevel ? `${nextLevel.level} · từ ${nextLevel.minScore} điểm` : "Đã ở mức cao nhất"}</strong></div>
    </Card>}

    <Card className="card-pad">
      <h2>Lịch sử án phạt của tôi</h2>
      {penalties.error && (
        <ErrorState title="Không tải được lịch sử án phạt" cause={penalties.error} onRetry={penalties.reload} />
      )}
      {penalties.loading && !penalties.data && <LoadingState label="Đang tải lịch sử án phạt…" />}
      {!penalties.loading && !penalties.error && !penalties.data?.items.length && (
        <p className="status-note">Bạn chưa có án phạt vi phạm nào.</p>
      )}
      {!!penalties.data?.items.length && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vai trò</th>
                  <th>Vi phạm &amp; Lý do</th>
                  <th>Hình thức</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {penalties.data.items.map((item) => {
                  const statusInfo = PENALTY_STATUS_LABEL[item.status] ?? { label: item.status, tone: "slate" as const };
                  return (
                    <tr key={item.penaltyId}>
                      <td><Badge tone="slate">{ROLE_LABEL[item.targetRole] ?? item.targetRole}</Badge></td>
                      <td>
                        <strong>{item.violationType}</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>{item.reason}</p>
                        {item.policyClauseCode && <small className="mono">Điều khoản: {item.policyClauseCode}</small>}
                      </td>
                      <td>
                        <span>{PENALTY_TYPE_LABEL[item.penaltyApplied] ?? item.penaltyApplied}</span>
                        {item.pointsDeducted > 0 && <strong style={{ display: "block", color: "#dc2626" }}>-{item.pointsDeducted} điểm</strong>}
                      </td>
                      <td><Badge tone={statusInfo.tone}>{statusInfo.label}</Badge></td>
                      <td>
                        <span>{new Date(item.issuedAt).toLocaleDateString("vi-VN")}</span>
                        {item.expiresAt && <small style={{ display: "block", color: "var(--muted)" }}>Hết hạn: {new Date(item.expiresAt).toLocaleDateString("vi-VN")}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {penalties.data.pagination.totalPages > 1 && (
            <AdminPagination
              page={penalties.data.pagination.currentPage}
              pageSize={penalties.data.pagination.pageSize}
              totalItems={penalties.data.pagination.totalCount}
              totalPages={penalties.data.pagination.totalPages}
              loading={penalties.loading}
              onPageChange={setPenaltyPage}
              itemLabel="án phạt"
            />
          )}
        </>
      )}
    </Card>
  </div>;
}
