import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/theme.css";
import "@/styles/globals.css";
import "@/styles/home-glass.css";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { FeatureProvider } from "@/lib/features/FeatureProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus | Sàn thương mại điện tử",
  description: "Nền tảng thương mại điện tử Nexus.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <body><FeatureProvider><SessionProvider>{children}</SessionProvider></FeatureProvider></body>
    </html>
  );
}
