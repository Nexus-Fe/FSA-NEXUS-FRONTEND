"use client";

import { Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { ReputationHistoryBlock, ReputationPolicyBlock } from "@/features/account/ReputationDetails";
import { semanticStatusTone } from "@/lib/status-labels";
import { reviewService } from "./services/review.service";
import { ErrorState, LoadingState } from "@/components/ui/States";

const TRUST_LEVEL: Record<string, string> = {
  untrusted: "Chưa tin cậy",
  probation: "Đang thử thách",
  standard: "Tiêu chuẩn",
  trusted: "Tin cậy",
  verified: "Đã xác minh",
  premium: "Cao cấp",
};
const trustLabel = (level: string) => TRUST_LEVEL[level.trim().toLowerCase()] ?? level;
const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

function Track({
  title,
  score,
  rawLevel,
  level,
  positive,
  negative,
  penalties,
  next,
  eligible,
  eligibleText,
  ineligibleText,
}: {
  title: string;
  score: number;
  rawLevel: string;
  level: string;
  positive: number;
  negative: number;
  penalties: number;
  next?: number | null;
  eligible: boolean;
  eligibleText: string;
  ineligibleText: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const barColor = eligible ? "#16a34a" : "#d97706";

  return (
    <Card className="card-pad" style={{ display: "grid", gap: "16px", alignContent: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "17px" }}>{title}</h2>
        <Badge tone={eligible ? "green" : "amber"}>
          {eligible ? eligibleText : ineligibleText}
        </Badge>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <strong style={{ fontSize: "34px", lineHeight: 1, fontWeight: 850, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {score}
            </strong>
            <span style={{ fontSize: "14px", color: "var(--muted)", fontWeight: 600 }}>/ 100 điểm</span>
          </div>
          <Badge tone={semanticStatusTone(rawLevel)}>Mức: {level}</Badge>
        </div>

        <div
          aria-hidden="true"
          style={{
            height: 8,
            borderRadius: 999,
            background: "var(--surface-muted, #e2e8f0)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              background: barColor,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        <p className="status-note" style={{ margin: 0, fontSize: "12.5px" }}>
          {next
            ? `Cần thêm ${Math.max(0, next - score)} điểm nữa (đạt ${next} điểm) để lên mức tiếp theo.`
            : "Bạn đã đạt mức uy tín cao nhất."}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <span style={{ display: "block", fontSize: "11.5px", color: "#166534", fontWeight: 600 }}>Tích cực</span>
          <strong style={{ fontSize: "20px", color: "#15803d", fontVariantNumeric: "tabular-nums" }}>{positive}</strong>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
          <span style={{ display: "block", fontSize: "11.5px", color: "#991b1b", fontWeight: 600 }}>Tiêu cực</span>
          <strong style={{ fontSize: "20px", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>{negative}</strong>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <span style={{ display: "block", fontSize: "11.5px", color: "#92400e", fontWeight: 600 }}>Bị phạt</span>
          <strong style={{ fontSize: "20px", color: "#b45309", fontVariantNumeric: "tabular-nums" }}>{penalties}</strong>
        </div>
      </div>
    </Card>
  );
}

/** The signed-in user's own reputation on both tracks. Points move only through reviews of finished orders and penalties. */
export function MyReputationScreen() {
  const reputation = useApiResource("my-reputation", (signal) => reviewService.myReputation(signal));
  const data = reputation.data;
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeading
        title="Uy tín của tôi"
        description="Điểm uy tín thay đổi theo đánh giá từ các đơn đã hoàn tất và theo chế tài. Mỗi vai trò có điểm riêng."
      />
      {reputation.error && <ErrorState cause={reputation.error} onRetry={reputation.reload} />}
      {reputation.loading && !data && <LoadingState label="Đang tải điểm uy tín…" />}
      {data && (
        <>
          <div className="split split-even">
            <Track
              title="Với vai trò người mua"
              score={data.currentScore}
              rawLevel={data.trustLevel}
              level={trustLabel(data.trustLevel)}
              positive={data.totalPositiveReviews}
              negative={data.totalNegativeReviews}
              penalties={data.penaltyCount}
              next={data.nextLevelThreshold}
              eligible={data.canBid}
              eligibleText="Đủ điều kiện đấu giá"
              ineligibleText="Chưa đủ điều kiện đấu giá"
            />
            <Track
              title="Với vai trò người bán"
              score={data.sellerScore}
              rawLevel={data.sellerTrustLevel}
              level={trustLabel(data.sellerTrustLevel)}
              positive={data.sellerPositiveReviews}
              negative={data.sellerNegativeReviews}
              penalties={data.sellerPenaltyCount}
              next={data.sellerNextLevelThreshold}
              eligible={data.canSell}
              eligibleText="Đủ điều kiện bán hàng"
              ineligibleText="Chưa đủ điều kiện bán hàng"
            />
          </div>
          <ReputationPolicyBlock />
          <ReputationHistoryBlock />
          {data.updatedAt && (
            <p className="status-note" style={{ margin: 0 }}>
              Cập nhật lần cuối {DATE.format(new Date(data.updatedAt))}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
