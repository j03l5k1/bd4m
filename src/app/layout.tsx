import "./globals.css";

export const metadata = {
  title: "Briars Fixtures",
  description: "Briars fixtures & results (auto-scraped)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
