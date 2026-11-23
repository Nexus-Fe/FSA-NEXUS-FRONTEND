import type { ReactNode } from "react";

export function ReputationScore({ score, level, heading = "Điểm uy tín", description = "Điểm hiện tại của tài khoản", children }: {
  score: number | null | undefined;
  level?: string | null;
  heading?: string;
  description?: string;
  children?: ReactNode;
}) {
  return <section className="profile-panel profile-reputation">
    <div><h2>{heading}</h2><p>{description}</p>{children}</div>
    <div className="profile-reputation-value">
      <strong>{typeof score === "number" ? score : "—"}</strong>
      {level && <span>{level}</span>}
    </div>
  </section>;
}
