import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Bookly - Authentication",
  description: "Sign in or register for Bookly",
  icons: {
    icon: "/img/smallBlackLogo.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-poppins" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
