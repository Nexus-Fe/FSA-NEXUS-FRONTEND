"use client";

import { Card, PageHeading } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { ReputationScore } from "./ReputationScore";
import { profileService } from "./services/profile.service";
import { ErrorState, LoadingState } from "@/components/ui/States";

export function ReputationScreen() {
  const profile = useApiResource("reputation-profile", (signal) => profileService.getProfile(signal));
  const reputation = useApiResource("my-reputation", (signal) => profileService.getMyReputation(signal));
  const policy = useApiResource("reputation-policy", (signal) => profileService.getReputationPolicy(signal));
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
  </div>;
}
