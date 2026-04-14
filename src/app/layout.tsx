import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";

export const metadata = {
  title: "Briars Snr Masters",
  description: "Briars Snr Masters fixtures & results",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.add('light')}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
