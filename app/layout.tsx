import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react" // ✅ Import Suspense
import { GlobalLoading } from "@/components/global-loading"
import { BookmarksProvider } from "@/components/bookmarks-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Anix",
  description: "Your distraction-free streaming destination for anime and movies",
  generator: "Anix_stream",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased bg-black min-h-screen`}>
        {/* ✅ Fix: Wrap GlobalLoading in Suspense because it uses searchParams */}
        <Suspense fallback={null}>
          <GlobalLoading />
        </Suspense>
        
        <BookmarksProvider>{children}</BookmarksProvider>
        <Analytics />
      </body>
    </html>
  )
}