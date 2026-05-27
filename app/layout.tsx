import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Unbounded } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { GlobalLoading } from "@/components/layout/global-loading"
import { BookmarksProvider } from "@/components/providers/bookmarks-provider"
import { HistoryProvider } from "@/components/providers/history-provider"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import "./globals.css"
import { WelcomeModal } from "@/components/auth/welcome-modal"
import { AuthProvider } from "@/components/auth/auth-provider"
import { UserDataLoadingBar } from "@/components/shared/user-data-loading-bar"
import { LogoutLoadingScreen } from "@/components/layout/logout-loading-screen"
import { CookieConsent } from "@/components/layout/cookie-consent"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "sonner"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _unbounded = Unbounded({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Weeb.X",
  description: "Your distraction-free streaming destination for anime and movies",
  generator: "Weeb.X_stream",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <GlobalLoading />
          </Suspense>
          <WelcomeModal />
          <CookieConsent />
          <AuthProvider>
            <UserDataLoadingBar />
            <LogoutLoadingScreen />
            <HistoryProvider>
              <BookmarksProvider>
                <ErrorBoundary name="Main App">{children}</ErrorBoundary>
              </BookmarksProvider>
            </HistoryProvider>
          </AuthProvider>
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}