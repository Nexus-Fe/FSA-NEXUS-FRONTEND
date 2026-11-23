"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { accountService } from "./account.service";
import { canToggle, changedPreferences, otherSessionCount, preferenceKey, sortSessions, validateKycFile, type ActiveSession } from "./account-rules";

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

  return <>
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
  </>;
}

const TYPE_LABEL: Readonly<Record<string, string>> = { OrderPaid: "Thanh toán đơn hàng", SecurityAlert: "Cảnh báo bảo mật", Otp: "Mã xác thực", AuctionStart: "Phiên đấu giá bắt đầu", AuctionOutbid: "Bị vượt giá" };
const CHANNEL_LABEL: Readonly<Record<string, string>> = { Email: "Email", Push: "Thông báo đẩy", InApp: "Trong ứng dụng" };

/** Which notices reach the person on which channel. Mandatory notices and channels the platform has switched off are shown but locked. */
export function NotificationPreferencesScreen() {
  const prefs = useApiResource("my-notification-prefs", (signal) => accountService.preferences(signal));
  const [edited, setEdited] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const rows = prefs.data ?? [];
  const pending = changedPreferences(rows, edited);

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

  return <>
    <PageHeading title="Tuỳ chọn thông báo" description="Chọn kênh nhận từng loại thông báo. Thông báo bắt buộc (thanh toán, bảo mật, mã xác thực) luôn được gửi." />
    {prefs.error != null && <ErrorState cause={prefs.error} operation="read" onRetry={prefs.reload} />}
    {prefs.loading && !prefs.data ? <NoData title="Đang tải tuỳ chọn…" /> : rows.length ? <Card className="card-pad">
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Loại thông báo</th><th>Kênh</th><th>Nhận</th></tr></thead>
        <tbody>{rows.map((row) => {
          const key = preferenceKey(row);
          const disabled = edited.has(key) ? Boolean(edited.get(key)) : row.isDisabled;
          return <tr key={key}>
            <td>{TYPE_LABEL[row.notificationType] ?? row.notificationType}</td>
            <td>{CHANNEL_LABEL[row.channelCode] ?? row.channelCode}</td>
            <td><label><input type="checkbox" checked={row.isMandatory ? true : !disabled} disabled={!canToggle(row) || busy} onChange={(event) => setEdited((current) => new Map(current).set(key, !event.target.checked))} />{" "}
              {row.isMandatory ? "Bắt buộc" : row.isChannelDisabled ? "Kênh đang tắt" : disabled ? "Tắt" : "Bật"}</label></td>
          </tr>;
        })}</tbody>
      </table></div>
      {failure != null && <ErrorState cause={failure} operation="write" />}
      {notice && <p className="form-success" role="status">{notice}</p>}
      <div className="action-row" style={{ marginTop: 12 }}>
        <button type="button" className="button button-primary" disabled={busy || pending.length === 0} onClick={() => void save()}>{busy ? "Đang lưu…" : `Lưu thay đổi${pending.length ? ` (${pending.length})` : ""}`}</button>
      </div>
    </Card> : !prefs.error && <NoData title="Chưa có tuỳ chọn nào." />}
  </>;
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
    } catch (cause) {
      setFailure(cause);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <>
    <PageHeading title="Giấy tờ đăng ký bán hàng" description="Tải ảnh hai mặt căn cước công dân và giấy phép kinh doanh (nếu có) để nhân viên thẩm định. Tệp được lưu riêng tư." />
    <Card className="card-pad">
      <form className="auth-fields" onSubmit={(event) => void submit(event)} noValidate>
        {([["Mặt trước căn cước", setFront, errors.front, true], ["Mặt sau căn cước", setBack, errors.back, true], ["Giấy phép kinh doanh (không bắt buộc)", setLicense, errors.license, false]] as const).map(([label, setter, error]) =>
          <label className="field-wrap" key={label}>{label}
            <input className="field" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} aria-invalid={Boolean(error)} onChange={(event) => { setter(event.target.files?.[0] ?? null); setErrors({}); setDone(false); }} />
            {error && <small className="checkout-field-error" role="alert">{error}</small>}
          </label>)}
        <div className="action-row"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang tải lên…" : "Tải giấy tờ lên"}</button></div>
        {failure != null && <ErrorState cause={failure} operation="write" />}
        {done && <p className="form-success" role="status">Đã tải giấy tờ lên. Nhân viên sẽ thẩm định cùng hồ sơ đăng ký của bạn.</p>}
      </form>
    </Card>
  </>;
}
