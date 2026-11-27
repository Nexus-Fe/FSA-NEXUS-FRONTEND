# Kế hoạch Tổng kiểm tra & Nghiệm thu Toàn bộ Giao diện 4 Roles (Master Verification Plan)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2030-plan-ui-master-verification-acceptance.md`
> **Design System gốc:** `DESIGN.md`
> **Kế hoạch con liên kết:**
> - `.agents/plans/2026-11-27_2030-plan-ui-buyer-public-standardization.md`
> - `.agents/plans/2026-11-27_2030-plan-ui-seller-standardization.md`
> - `.agents/plans/2026-11-27_2030-plan-ui-staff-standardization.md`
> - `.agents/plans/2026-11-27_2030-plan-ui-admin-standardization.md`
> **Trạng thái:** Chờ duyệt triển khai (Plan-First)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
Thực hiện kiểm định toàn diện (tĩnh, động, trình duyệt thực tế đa kích thước màn hình, đối soát GitNexus) sau khi hoàn tất 4 plan của 4 role (**Buyer/Public**, **Seller**, **Staff**, **Admin**) để bảo đảm 100% các trang khớp `DESIGN.md`, chuẩn một form như `/admin/withdrawals`, bo góc Card/Table/Cart chuẩn, Sidebar Staff gom nhóm dropdown với icon đúng, và không gây hồi quy chức năng hay build.

## 2. Thứ tự Triển khai & Phụ thuộc (Execution Sequence)
1. **Bước 0 — Nền tảng Design Tokens & Shared CSS:** Thực thi chỉnh sửa nền `.card`, `.table-scroll`, `.data-table`, `.portal-shell-operations`, dọn mã hex cũ trong `src/styles/globals.css`, `src/styles/home-glass.css`, `src/config/theme.ts`.
2. **Bước 1 — Staff Sidebar & Staff Portal:** Thực hiện Plan Staff (gom nhóm dropdown + icon chuẩn + chuẩn hóa các trang Staff).
3. **Bước 2 — Admin Portal:** Thực hiện Plan Admin (bổ sung Card bị thiếu ở `SubsidyBudgets`, tách Card bảng ở Ledger/Operations, đồng bộ toàn bộ màn hình Admin).
4. **Bước 3 — Seller Portal:** Thực hiện Plan Seller (áp dụng `portal-shell-operations`, chuẩn hóa icon sidebar, dọn mã màu xanh dương cũ ở Studio/Orders/Inventory).
5. **Bước 4 — Buyer, Public & Auth/Account:** Thực hiện Plan Buyer (chuẩn hóa Cart bo góc `20px` + glass header, Table trong Card, dọn mã màu xanh/vàng chanh cũ).
6. **Bước 5 — Chạy Plan Nghiệm thu Tổng thể này.**

## 3. Checklist Kiểm tra & Nghiệm thu (Verification & Acceptance Gates)

### Cổng 1: Kiểm tra Mã nguồn Tĩnh & GitNexus
- [ ] **Check 1.1 (Zero Legacy Colors):** Quét `src/styles/` và `src/features/` bảo đảm không còn các hex lạc tông (`#eff4ff`, `#7dd3fc`, `#0284c7`, `#e0f2fe`, `#c8e71f`, `#0f2b47`, `#007db7`, `#f8fbff`, `#f8fdff`, `#1e3a8a`, `#e3f4ff`, `rgba(245, 252, 247`).
- [ ] **Check 1.2 (Zero Unwrapped Tables):** Mọi `<table className="data-table">` đều nằm trong `<div className="table-scroll">` và được bọc bởi `<Card>` (trừ bảng phụ trong modal có bo góc riêng) để bảo đảm bo tròn 4 góc.
- [ ] **Check 1.3 (Breadcrumbs Coverage):** Toàn bộ route hợp lệ trong `ROUTES` của Buyer, Seller, Staff, Admin đều có nhãn tiếng Việt tương ứng trong `src/components/layout/Breadcrumbs.tsx`.
- [ ] **Check 1.4 (GitNexus Change Analysis):** Chạy `node .gitnexus/run.cjs detect-changes --scope all --repo .` kiểm tra không có regression ngoài phạm vi.

### Cổng 2: Build, Typecheck, Lint & Unit Tests
- [ ] `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck` -> 0 errors.
- [ ] `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint` -> 0 errors.
- [ ] `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build` -> Build production thành công 100%.
- [ ] `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run test:session` -> Pass 100%.
- [ ] `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run test:notification` -> Pass 100%.

### Cổng 3: Kiểm chứng Giao diện Thực tế Trên Trình duyệt (Live Browser Audit tại `localhost:3000`)
Kiểm tra bằng Playwright / Browser ở 3 viewport: **Desktop (`1440×900`)**, **Tablet (`780×1024`)**, **Mobile (`390×844`)**:

| Role | Route đại diện cần nghiệm thu | Tiêu chí kiểm chứng | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Public / Auth** | `/`, `/catalog`, `/catalog/[id]`, `/shops`, `/auctions`, `/login`, `/register` | Top pill nav trượt mượt; card sản phẩm/đấu giá kính mờ `20px`; không còn viền xanh dương cũ; responsive 390px không tràn ngang. | [ ] |
| **Buyer** | `/buyer/cart`, `/buyer/checkout`, `/buyer/orders`, `/buyer/wallet`, `/buyer/deposits`, `/buyer/refunds`, `/buyer/reports` | `/buyer/cart` bo tròn 4 góc `20px` khớp nền kính; bảng trong Ví/Cọc/Hoàn tiền bo góc sạch không lòi góc nhọn `thead`; modal và stepper rõ tương phản. | [ ] |
| **Seller** | `/seller/products`, `/seller/products/new`, `/seller/inventory`, `/seller/orders`, `/seller/shipments`, `/seller/auctions`, `/seller/wallet`, `/seller/withdrawals` | Sidebar icon đúng từng mục; Card/Table đồng bộ chuẩn `20px` như Admin; dropzone & variant cards dùng token Burgundy/Cream; mobile drawer mở/đóng chuẩn. | [ ] |
| **Staff** | `/staff/auctions`, `/staff/auction-ops`, `/staff/sellers`, `/staff/product-moderation`, `/staff/product-reports`, `/staff/product-reviews`, `/staff/reports`, `/staff/penalties`, `/staff/withdrawals`, `/staff/refunds`, `/staff/notification-center` | Sidebar gom 5 nhóm dropdown hoạt động (tự mở nhóm đang active, đóng/mở độc lập, icon đúng từng mục); bảng/filter chuẩn 1 form giống `/admin/withdrawals`; mobile drawer hiển thị 1 cột rõ ràng. | [ ] |
| **Admin** | `/admin/overview`, `/admin/users`, `/admin/categories`, `/admin/withdrawals`, `/admin/subsidy-budgets`, `/admin/platform-fee`, `/admin/ledger`, `/admin/ledger/transactions`, `/admin/reconciliation`, `/admin/shipments`, `/admin/audit-logs`, `/admin/system-health` | `/admin/withdrawals` bo tròn góc bảng khớp Card; `/admin/subsidy-budgets` có Card bọc bảng chuẩn; các trang Ledger & Operations tách rõ filter Card và table Card; tất cả dùng `AdminPagination` & `RowActionsMenu` đồng nhất. | [ ] |

### Cổng 4: Nghiệm thu Hình học DOM & Accessibility (Automated DOM Checks)
- [ ] Kiểm tra computed styles trên ít nhất 1 trang bảng của mỗi role: `getComputedStyle(card).overflow === "hidden"` và `borderRadius === "20px"`.
- [ ] Kiểm tra `document.documentElement.scrollWidth <= window.innerWidth` ở `390px` trên các route đại diện của cả 4 role (zero horizontal overflow).
- [ ] Kiểm tra `prefers-reduced-motion: reduce`: toàn bộ transition/animation dừng đúng quy chuẩn.
- [ ] Kiểm tra tương phản bàn phím (`Tab`, `Escape` đóng modal/dropdown, focus-visible rõ).

## 4. Điều kiện Đóng gói Nghiệm thu (Definition of Done)
- Tất cả 4 Plan con + Plan Tổng kiểm tra đạt 100% checklist.
- `DESIGN.md` phản ánh chính xác 100% hệ thống token và component sau khi chỉnh sửa.
- Git diff sạch, không có file tạm/screenshot rác, báo cáo rõ ràng bằng chứng chạy build/test/DOM.
