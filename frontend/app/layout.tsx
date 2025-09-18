import type React from "react"
import { Poppins } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import Footer from "@/components/footer"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
})

export const metadata = {
  metadataBase: new URL("https://namehunt.tech"),
  title: "NameHunt - Find the Perfect Domain at the Best Price",
  description:
    "Compare domain prices across multiple registrars in real-time. Find your perfect domain name with NameHunt.",
  openGraph: {
    type: "website",
    url: "https://namehunt.tech/",
    title: "NameHunt - Find the Perfect Domain at the Best Price",
    description:
      "Compare domain prices across multiple registrars in real-time. Find your perfect domain name with NameHunt.",
    images: [
      {
        url: "https://namehunt.tech/preview/landing.png",
        width: 1200,
        height: 630,
        alt: "NameHunt - Find the Perfect Domain at the Best Price",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@abhi__br",
    creator: "@abhi__br",
    title: "NameHunt - Find the Perfect Domain at the Best Price",
    description:
      "Compare domain prices across multiple registrars in real-time. Find your perfect domain name with NameHunt.",
    images: ["https://namehunt.tech/preview/landing.png"],
  },
};

const logo = "https://raw.githubusercontent.com/Abhishek-B-R/NameHunt/main/frontend/public/namehunt.png";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={logo} />
      </head>
      <body className={poppins.className} suppressHydrationWarning>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
        <Footer />
      </body>
    </html>
  )
}
