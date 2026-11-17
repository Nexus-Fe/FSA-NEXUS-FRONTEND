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
  primary: "#192841",
  primaryHover: "#121e31",
  primaryActive: "#0d1726",
  primarySoft: "#eaf0f6",
  primaryBorder: "#bac9dc",
  primaryRgb: "25, 40, 65",
  primaryAccent: "#5275a5",
  primaryAccentLight: "#7b9cc9",
  primaryAccentRgb: "82, 117, 165",
  heroBgDeep: "#060b13",
} as const;

export type ThemeColors = typeof themeColors;

