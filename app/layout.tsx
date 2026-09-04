import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Unbounded } from "next/font/google"
import { AnalyticsWrapper } from "@/components/layout/analytics-wrapper"
import { Suspense } from "react"
import { GlobalLoading } from "@/components/layout/global-loading"
import { BookmarksProvider } from "@/components/providers/bookmarks-provider"
import { HistoryProvider } from "@/components/providers/history-provider"
import { EpisodeUpdatesProvider } from "@/components/providers/episode-updates-provider"
import { AccountStatsProvider } from "@/components/providers/account-stats-provider"
import { CoverProvider } from "@/components/providers/cover-provider"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import "./globals.css"
import { WelcomeModal } from "@/components/auth/welcome-modal"
import { AuthProvider } from "@/components/auth/auth-provider"
import { UserDataLoadingBar } from "@/components/shared/user-data-loading-bar"
import { LogoutLoadingScreen } from "@/components/layout/logout-loading-screen"
import { CookieConsent } from "@/components/layout/cookie-consent"
import { ConsentProvider } from "@/components/providers/consent-provider"
import { ServiceWorkerRegister } from "@/components/layout/sw-register"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "sonner"
import { OrganizationStructuredData, WebSiteStructuredData } from "@/components/seo/structured-data"
import NextTopLoader from "nextjs-toploader"
import { Navbar } from "@/components/layout/navbar" 
import { ChibiGuide } from "@/components/shared/chibi-guide"
import { GiftCardReceivedModal } from "@/components/gacha/gift-card-received-modal"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _unbounded = Unbounded({ subsets: ["latin"] })

const siteUrl = "https://weeb-x.com"

export const metadata: Metadata = {
  title: "Weebx — Смотреть аниме онлайн",
  description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги и новости аниме. Бесплатно на Weebx.",
  keywords: ["weebx", "weeb x", "WeebX", "Weeb-X", "weeb-x", "weebx аниме", "weeb x аниме", "weeb x смотреть", "weebx онлайн"],
  generator: "Weeb-x",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_SITE_VERIFICATION,
    other: {
      "p:domain_verify": "50d489c5f1a10b166c295b5d8cba3aef",
    },
  },
  openGraph: {
    title: "Weebx — Смотреть аниме онлайн",
    description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги и новости аниме.",
    type: "website",
    url: siteUrl,
    siteName: "Weebx",
    locale: "ru_RU",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Weebx — Смотреть аниме онлайн в HD с русской озвучкой",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Weebx — Смотреть аниме онлайн",
    description: "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги.",
    images: ["/og-image.png"],
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
        <script
          dangerouslySetInnerHTML={{
            __html: `if(localStorage.getItem('lite-mode')==='true')document.documentElement.classList.add('lite-mode');`,
          }}
        />
      </head>
      
      <body className={`font-sans antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Индикатор загрузки в самом верху экрана при кликах по любой ссылке */}
          <NextTopLoader
            color="#3b82f6"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #3b82f6,0 0 5px #3b82f6"
          />

          <Suspense fallback={null}>
            <GlobalLoading />
          </Suspense>
          {/* <WelcomeModal /> */}
          <ConsentProvider>
            <CookieConsent />
            <AuthProvider>
              <AccountStatsProvider>
                <UserDataLoadingBar />
                <LogoutLoadingScreen />
                <CoverProvider>
                  <HistoryProvider>
                    <BookmarksProvider>
                      <EpisodeUpdatesProvider>
                        <Navbar/>
                        {/* Персонаж-гид размещен внутри провайдеров, чтобы карточка случайного аниме могла использовать useBookmarks */}
                        <ChibiGuide/>
                        <ErrorBoundary name="Main App">{children}</ErrorBoundary>
                      </EpisodeUpdatesProvider>
                    </BookmarksProvider>
                  </HistoryProvider>
                </CoverProvider>
              </AccountStatsProvider>
            </AuthProvider>
            <AnalyticsWrapper />
          </ConsentProvider>
          <Toaster />
          <GiftCardReceivedModal />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}