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
import { OrganizationStructuredData, WebSiteStructuredData } from "@/components/seo/structured-data"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _unbounded = Unbounded({ subsets: ["latin"] })

const siteUrl = "https://weeb-x.com"

export const metadata: Metadata = {
  title: "Weeb-X — Смотреть аниме онлайн",
  description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги и новости аниме. Бесплатно на Weeb-X.",
  generator: "Weeb-X_stream",
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
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Weeb-X — Смотреть аниме онлайн",
    description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги и новости аниме.",
    type: "website",
    url: siteUrl,
    siteName: "Weeb-X",
    locale: "ru_RU",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Weeb-X — аниме стриминг платформа",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Weeb-X — Смотреть аниме онлайн",
    description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги.",
    images: ["/og-image.svg"],
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
    <html lang="ru" suppressHydrationWarning>
<head>
    <OrganizationStructuredData />
    <WebSiteStructuredData />
  </head>
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