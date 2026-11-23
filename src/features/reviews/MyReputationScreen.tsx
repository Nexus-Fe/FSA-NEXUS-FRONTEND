"use client";

import { Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { ReputationHistoryBlock, ReputationPolicyBlock } from "@/features/account/ReputationDetails";
import { reviewService } from "./services/review.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

function Track({ title, score, level, positive, negative, penalties, next, note }: {
  title: string; score: number; level: string; positive: number; negative: number; penalties: number; next?: number | null; note: string;
}) {
  return <Card className="card-pad">
    <h2>{title}</h2>
    <p><strong className="seller-money-amount">{score}</strong> điểm · mức <strong>{level}</strong></p>
    <div className="info-row"><span>Đánh giá tích cực</span><strong>{positive}</strong></div>
    <div className="info-row"><span>Đánh giá tiêu cực</span><strong>{negative}</strong></div>
    <div className="info-row"><span>Số lần bị phạt</span><strong>{penalties}</strong></div>
    {next ? <p className="status-note">Cần {Math.max(0, next - score)} điểm nữa để lên mức tiếp theo.</p> : <p className="status-note">Đã ở mức cao nhất.</p>}
    <p className="status-note">{note}</p>
  </Card>;
}

/** The signed-in user's own reputation on both tracks. Points move only through reviews of finished orders and penalties. */
export function MyReputationScreen() {
  const reputation = useApiResource("my-reputation", (signal) => reviewService.myReputation(signal));
  const data = reputation.data;
  return <>
    <PageHeading title="Uy tín của tôi" description="Điểm uy tín thay đổi theo đánh giá từ các đơn đã hoàn tất và theo chế tài. Mỗi vai trò có điểm riêng." />
    {reputation.error && <p className="notice" role="alert">{reputation.error.message} <button type="button" className="button button-secondary" onClick={reputation.reload}>Thử lại</button></p>}
    {reputation.loading && !data && <NoData title="Đang tải điểm uy tín…" />}
    {data && <>
      <div className="split">
        <Track title="Với vai trò người mua" score={data.currentScore} level={data.trustLevel} positive={data.totalPositiveReviews}
          negative={data.totalNegativeReviews} penalties={data.penaltyCount} next={data.nextLevelThreshold}
          note={data.canBid ? "Bạn đủ điều kiện tham gia đấu giá." : "Điểm hiện tại chưa đủ để tham gia đấu giá."} />
        <Track title="Với vai trò người bán" score={data.sellerScore} level={data.sellerTrustLevel} positive={data.sellerPositiveReviews}
          negative={data.sellerNegativeReviews} penalties={data.sellerPenaltyCount} next={data.sellerNextLevelThreshold}
          note={data.canSell ? "Bạn đủ điều kiện bán hàng." : "Điểm hiện tại chưa đủ để bán hàng."} />
      </div>
      <ReputationPolicyBlock />
      <ReputationHistoryBlock />
      {data.updatedAt && <p className="status-note">Cập nhật lần cuối {DATE.format(new Date(data.updatedAt))}.</p>}
    </>}
  </>;
}
