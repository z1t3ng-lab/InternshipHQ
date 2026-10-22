import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "InternshipHQ · Your next chapter starts here",
  description:
    "Your personal workspace for internship applications, deadlines, and next steps.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
