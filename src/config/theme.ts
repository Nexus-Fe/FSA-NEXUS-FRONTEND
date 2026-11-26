/**
 * =========================================================================
 * BẢNG MÀU CHỦ ĐẠO TOÀN TRANG WEB NEXUS (THEME CONFIGURATION)
 * =========================================================================
 *
 * Bạn có thể tự chỉnh sửa các mã màu trực tiếp tại file:
 *   src/styles/theme.css
 *
 * Mọi thay đổi ở theme.css sẽ ngay lập tức được áp dụng cho toàn bộ:
 * - Nút bấm (buttons, submit, actions)
 * - Tabs, danh mục, menu bên
 * - Huy hiệu (badges), avatar, biểu tượng
 * - Viền focus, hộp nhập liệu (inputs)
 * - Nền phát sáng, hiệu ứng chuyển màu (gradients & glow)
 */

export const themeColors = {
  primary: "#6e1e2b",
  primaryHover: "#541520",
  primaryActive: "#3d0e17",
  primarySoft: "#f5e9eb",
  primaryBorder: "#c49099",
  primaryRgb: "110, 30, 43",
  primaryAccent: "#b98b93",
  primaryAccentLight: "#f7f1e8",
  primaryAccentRgb: "185, 139, 147",
  heroBgDeep: "#18181b",
} as const;

export type ThemeColors = typeof themeColors;
