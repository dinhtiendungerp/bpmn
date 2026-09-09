import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BPMN Studio · Thiết kế quy trình",
  description: "Không gian thiết kế BPMN 2.0: chỉnh sửa, kiểm tra, mô phỏng và trình bày quy trình nghiệp vụ.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
