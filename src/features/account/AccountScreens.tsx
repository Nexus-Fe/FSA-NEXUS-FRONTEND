"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { accountService } from "./account.service";
import { canToggle, changedPreferences, otherSessionCount, preferenceKey, sortSessions, validateKycFile, type ActiveSession, type PreferenceRow } from "./account-rules";

const when = (value: string) => new Date(value).toLocaleString("vi-VN");

/** Where the account is signed in. Another device can be signed out, and "sign out everywhere" also ends this session. */
export function SessionsScreen() {
  const router = useRouter();
  const { clearSession } = useSession();
  const sessions = useApiResource("my-sessions", (signal) => accountService.sessions(signal));
  const [target, setTarget] = useState<ActiveSession | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const list = sessions.data ? sortSessions(sessions.data) : [];

  async function confirm() {
    if (!target || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      if (target === "all") {
        await accountService.logoutAll();
        clearSession();
        router.replace(ROUTES.auth.login);
        return;
      }
      await accountService.revokeSession(target.sessionId);
      setNotice("Đã đăng xuất thiết bị đó.");
      setTarget(null);
      sessions.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ width: "min(960px, 100%)", marginInline: "auto", display: "grid", gap: "18px" }}>
    <PageHeading title="Phiên đăng nhập" description="Các thiết bị đang đăng nhập tài khoản của bạn. Đăng xuất thiết bị bạn không nhận ra." />
    {notice && <p className="form-success" role="status">{notice}</p>}
    {sessions.error != null && <ErrorState cause={sessions.error} operation="read" onRetry={sessions.reload} />}
    {sessions.loading && !sessions.data ? <NoData title="Đang tải phiên đăng nhập…" /> : list.length ? <Card className="card-pad">
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Thiết bị</th><th>Địa chỉ IP</th><th>Hoạt động gần nhất</th><th></th></tr></thead>
        <tbody>{list.map((item) => <tr key={item.sessionId}>
          <td>{item.deviceInfo || "Thiết bị không rõ"} {item.isCurrent && <Badge tone="green">Thiết bị này</Badge>}</td>
          <td>{item.ipAddress ?? "—"}</td><td>{when(item.lastActiveAt)}</td>
          <td>{item.isCurrent ? "—" : <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setTarget(item); }}>Đăng xuất thiết bị</button>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="action-row" style={{ marginTop: 12 }}>
        <button type="button" className="button button-secondary" onClick={() => { setFailure(null); setTarget("all"); }}>Đăng xuất tất cả thiết bị{otherSessionCount(list) ? ` (${otherSessionCount(list)} thiết bị khác)` : ""}</button>
      </div>
    </Card> : !sessions.error && <NoData title="Không có phiên đăng nhập nào." />}
    <ConfirmDialog open={target !== null} title={target === "all" ? "Đăng xuất tất cả thiết bị?" : "Đăng xuất thiết bị này?"} confirmLabel="Đăng xuất" busy={busy} error={failure} onConfirm={() => void confirm()} onClose={() => setTarget(null)}>
      <p>{target === "all" ? "Mọi thiết bị, kể cả thiết bị này, sẽ bị đăng xuất và bạn phải đăng nhập lại." : "Thiết bị đó sẽ phải đăng nhập lại. Phiên của bạn ở đây không bị ảnh hưởng."}</p>
    </ConfirmDialog>
  </div>;
}

const TYPE_LABEL: Readonly<Record<string, string>> = {
  OrderPaid: "Thanh toán đơn hàng",
  OrderShipped: "Cập nhật vận chuyển",
  OrderDecision: "Xác nhận đơn hàng",
  OrderRefunded: "Hoàn tiền đơn hàng",
  OrderCompleted: "Hoàn tất đơn hàng",
  OrderSellerSettled: "Đối soát tiền bán hàng",
  OrderPaymentExpired: "Hết hạn thanh toán đơn",
  OrderBuyerCancelled: "Người mua huỷ đơn",
  AuctionStart: "Phiên đấu giá bắt đầu",
  AuctionStarted: "Phiên đấu giá bắt đầu",
  AuctionOutbid: "Bị vượt giá đấu giá",
  AuctionWon: "Thắng đấu giá",
  AuctionCancelled: "Huỷ phiên đấu giá",
  AuctionFailed: "Phiên đấu giá không thành công",
  AuctionPaymentTimedOut: "Quá hạn thanh toán đấu giá",
  AuctionSellerResult: "Kết quả phiên đấu giá",
  AuctionWinnerOffer: "Lời mời mua lại từ đấu giá",
  AuctionWatchlistBid: "Có lượt trả giá mới ở phiên theo dõi",
  AuctionReportResolved: "Xử lý báo cáo đấu giá",
  AuctionDeposit: "Đặt cọc đấu giá",
  AuctionReserveApprovalNeeded: "Cần duyệt giá dưới sàn",
  AuctionReserveRestriction: "Giới hạn giá sàn đấu giá",
  WithdrawalResult: "Kết quả rút tiền",
  ProductBannedByReport: "Sản phẩm bị khoá do báo cáo",
  ProductReportResolved: "Xử lý báo cáo sản phẩm",
  ProductReportDismissed: "Bác bỏ báo cáo sản phẩm",
  ProductApproved: "Sản phẩm được duyệt",
  ProductRejected: "Sản phẩm bị từ chối",
  ProductSuspended: "Sản phẩm bị tạm ngưng",
  ProductBanned: "Sản phẩm bị cấm",
  NewProductReview: "Đánh giá sản phẩm mới",
  ReviewHidden: "Đánh giá bị ẩn",
  ReputationPenalty: "Biến động điểm uy tín",
  SecurityAlert: "Cảnh báo bảo mật",
  Otp: "Mã xác thực",
  Promotion: "Khuyến mãi",
};
const CHANNEL_ORDER = ["InApp", "Email", "Push"] as const;
const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  InApp: "Trong ứng dụng",
  Email: "Email",
  Push: "Thông báo đẩy",
};

type PrefCategory = "ALL" | "ORDER" | "AUCTION" | "PRODUCT" | "ACCOUNT";
const PREF_CATEGORY_OPTIONS: { value: PrefCategory; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "ORDER", label: "Đơn hàng & Thanh toán" },
  { value: "AUCTION", label: "Đấu giá" },
  { value: "PRODUCT", label: "Sản phẩm & Uy tín" },
  { value: "ACCOUNT", label: "Bảo mật & Khác" },
];

function classifyNotificationType(type: string): Exclude<PrefCategory, "ALL"> {
  const t = type.toLowerCase();
  if (t.includes("auction") || t.includes("bid")) return "AUCTION";
  if (t.includes("product") || t.includes("review") || t.includes("reputation")) return "PRODUCT";
  if (t.includes("order") || t.includes("payment") || t.includes("ship") || t.includes("refund") || t.includes("withdraw") || t.includes("wallet") || t.includes("return")) return "ORDER";
  return "ACCOUNT";
}

function PreferenceToggle({
  row,
  disabledState,
  busy,
  onToggle,
}: {
  row: PreferenceRow;
  disabledState: boolean;
  busy: boolean;
  onToggle: (nextDisabled: boolean) => void;
}) {
  if (row.isMandatory) {
    return <Badge tone="green">Bắt buộc</Badge>;
  }
  if (row.isChannelDisabled) {
    return <Badge tone="slate">Kênh tắt</Badge>;
  }
  const enabled = !disabledState;
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        cursor: busy ? "not-allowed" : "pointer",
        userSelect: "none",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: 38,
          height: 22,
          borderRadius: 999,
          background: enabled ? "var(--primary, #6e1e2b)" : "#cbd5e1",
          transition: "background-color 0.18s ease",
          flexShrink: 0,
        }}
      >
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={!canToggle(row) || busy}
          onChange={(e) => onToggle(!e.target.checked)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            margin: 0,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.18s ease",
          }}
        />
      </span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: enabled ? "var(--ink)" : "var(--muted)" }}>
        {enabled ? "Bật" : "Tắt"}
      </span>
    </label>
  );
}

/** Which notices reach the person on which channel. Mandatory notices and channels the platform has switched off are shown but locked. */
export function NotificationPreferencesScreen() {
  const prefs = useApiResource("my-notification-prefs", (signal) => accountService.preferences(signal));
  const [edited, setEdited] = useState<Map<string, boolean>>(new Map());
  const [category, setCategory] = useState<PrefCategory>("ALL");
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const rows = useMemo(() => prefs.data ?? [], [prefs.data]);
  const pending = changedPreferences(rows, edited);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, PreferenceRow>>();
    for (const row of rows) {
      let channels = map.get(row.notificationType);
      if (!channels) {
        channels = new Map();
        map.set(row.notificationType, channels);
      }
      channels.set(row.channelCode, row);
    }
    const q = keyword.trim().toLowerCase();
    return Array.from(map.entries())
      .map(([type, channels]) => ({
        type,
        label: TYPE_LABEL[type] ?? type,
        category: classifyNotificationType(type),
        channels,
      }))
      .filter((item) => (category === "ALL" || item.category === category))
      .filter((item) => !q || item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q));
  }, [rows, category, keyword]);

  async function save() {
    if (busy || pending.length === 0) return;
    setBusy(true);
    setFailure(null);
    setNotice("");
    try {
      await accountService.savePreferences(pending);
      setEdited(new Map());
      setNotice("Đã lưu tuỳ chọn thông báo.");
      prefs.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "min(960px, 100%)", marginInline: "auto", display: "grid", gap: "18px" }}>
      <PageHeading
        title="Tuỳ chọn thông báo"
        description="Chọn kênh nhận từng loại thông báo. Thông báo bắt buộc (thanh toán, bảo mật, mã xác thực) luôn được gửi."
      />

      {prefs.error != null && <ErrorState cause={prefs.error} operation="read" onRetry={prefs.reload} />}

      {prefs.loading && !prefs.data ? (
        <NoData title="Đang tải tuỳ chọn…" />
      ) : rows.length ? (
        <Card className="card-pad" style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <FluidChoiceBar
              mode="filter"
              ariaLabel="Nhóm thông báo"
              options={PREF_CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
            />
            <input
              className="field"
              style={{ width: "min(260px, 100%)" }}
              placeholder="Tìm loại thông báo..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {grouped.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Loại thông báo</th>
                    {CHANNEL_ORDER.map((ch) => (
                      <th key={ch} style={{ width: 150 }}>{CHANNEL_LABEL[ch]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((item) => (
                    <tr key={item.type}>
                      <td>
                        <strong>{item.label}</strong>
                      </td>
                      {CHANNEL_ORDER.map((ch) => {
                        const row = item.channels.get(ch);
                        if (!row) {
                          return <td key={ch} style={{ color: "var(--muted)" }}>—</td>;
                        }
                        const key = preferenceKey(row);
                        const disabledState = edited.has(key) ? Boolean(edited.get(key)) : row.isDisabled;
                        return (
                          <td key={ch}>
                            <PreferenceToggle
                              row={row}
                              disabledState={disabledState}
                              busy={busy}
                              onToggle={(nextDisabled) =>
                                setEdited((current) => new Map(current).set(key, nextDisabled))
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData title="Không tìm thấy loại thông báo phù hợp." />
          )}

          {failure != null && <ErrorState cause={failure} operation="write" />}
          {notice && <p className="form-success" role="status">{notice}</p>}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              paddingTop: "12px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              {pending.length > 0
                ? `Bạn có ${pending.length} thay đổi chưa lưu.`
                : "Chưa có thay đổi nào."}
            </span>
            <div className="action-row">
              {pending.length > 0 && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => setEdited(new Map())}
                >
                  Hoàn tác
                </button>
              )}
              <button
                type="button"
                className="button button-primary"
                disabled={busy || pending.length === 0}
                onClick={() => void save()}
              >
                {busy ? "Đang lưu…" : `Lưu thay đổi${pending.length ? ` (${pending.length})` : ""}`}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        !prefs.error && <NoData title="Chưa có tuỳ chọn nào." />
      )}
    </div>
  );
}

function sellerDocStatusBadge(status?: string | null): { label: string; tone: "slate" | "amber" | "green" | "red" } {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return { label: "Đã phê duyệt", tone: "green" };
  if (s === "REJECTED") return { label: "Bị từ chối", tone: "red" };
  if (s === "OTP_VERIFICATION_REQUIRED") return { label: "Chờ xác thực OTP", tone: "amber" };
  if (["PENDING", "PENDING_APPROVAL", "UNDER_REVIEW", "VERIFIED"].includes(s)) return { label: "Chờ Staff thẩm định", tone: "amber" };
  return { label: "Chưa có hồ sơ", tone: "slate" };
}

/** Identity card images and the optional business licence for a seller registration. JPG, PNG or PDF, at most 5 MB each. */
export function SellerDocumentsScreen() {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [license, setLicense] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ front?: string; back?: string; license?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  const sellerStatus = useApiResource("seller-documents-status", (signal) => accountService.sellerStatus(signal));
  const statusBadge = sellerDocStatusBadge(sellerStatus.data?.status);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const found = { front: validateKycFile(front, true) ?? undefined, back: validateKycFile(back, true) ?? undefined, license: validateKycFile(license, false) ?? undefined };
    setErrors(found);
    if (found.front || found.back || found.license || !front || !back) return;
    submitting.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await accountService.uploadSellerDocuments({ front, back, license });
      setDone(true);
      sellerStatus.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div style={{ width: "min(960px, 100%)", marginInline: "auto", display: "grid", gap: "18px" }}>
    <PageHeading title="Giấy tờ đăng ký bán hàng" description="Tải ảnh hai mặt căn cước công dân và giấy phép kinh doanh (nếu có) để nhân viên thẩm định. Tệp được lưu riêng tư." />
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>Trạng thái hồ sơ đăng ký: </strong>
          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
          {sellerStatus.data?.rejectionReason && (
            <p className="notice" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
              Lý do từ chối: <strong>{sellerStatus.data.rejectionReason}</strong>
            </p>
          )}
        </div>
        <Link className="button button-secondary button-small" href={ROUTES.buyer.becomeSeller}>
          Xem chi tiết hồ sơ
        </Link>
      </div>
    </Card>
    <Card className="card-pad">
      <form className="auth-fields" onSubmit={(event) => void submit(event)} noValidate>
        {([["Mặt trước căn cước", setFront, errors.front, true], ["Mặt sau căn cước", setBack, errors.back, true], ["Giấy phép kinh doanh (không bắt buộc)", setLicense, errors.license, false]] as const).map(([label, setter, error, req]) =>
          <div className="field-wrap" key={label}>
            <span>{label}</span>
            <FileDropZone
              accept="image/jpeg,image/png,application/pdf"
              disabled={busy}
              required={req}
              ariaInvalid={Boolean(error)}
              hint="JPG, PNG hoặc PDF · tối đa 5 MB"
              onFilesChange={(files) => { setter(files[0] ?? null); setErrors({}); setDone(false); }}
            />
            {error && <small className="checkout-field-error" role="alert">{error}</small>}
          </div>)}
        <div className="action-row"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang tải lên…" : "Tải giấy tờ lên"}</button></div>
        {failure != null && <ErrorState cause={failure} operation="write" />}
        {done && <p className="form-success" role="status">Đã tải giấy tờ lên. Nhân viên sẽ thẩm định cùng hồ sơ đăng ký của bạn.</p>}
      </form>
    </Card>
  </div>;
}
