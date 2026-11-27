"use client";

/*
 * Last resort: the root layout itself failed. This file replaces the layout, so it brings its own document and cannot rely on the
 * app's stylesheets; the styling is inline on purpose.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Nexus tạm thời gặp sự cố</h1>
          <p style={{ margin: 0, maxWidth: 460, color: "#475569", lineHeight: 1.6 }}>
            Trang không thể hiển thị. Dữ liệu của bạn không bị ảnh hưởng. Hãy thử lại sau ít phút.
          </p>
          <button type="button" onClick={() => retry()} style={{ padding: "10px 18px", borderRadius: 10, border: 0, background: "#16a34a", color: "#fff", fontSize: 15, cursor: "pointer" }}>
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
