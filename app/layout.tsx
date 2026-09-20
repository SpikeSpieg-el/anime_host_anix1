import type React from "react"
import type { Metadata, Viewport } from "next"
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
import { BookmarkAuthPrompt } from "@/components/shared/bookmark-auth-prompt"
import { GuestHooksController } from "@/components/shared/guest-hooks-controller"

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
    site: "@WeebX_official",
    creator: "@WeebX_official",
  },
  other: {
    // Подтверждение владения соцсетями и поисковиками
    "article:publisher": "https://vk.ru/WeebX_official",
    "vk:group": "https://vk.ru/WeebX_official",
    // rel=me ссылки для подтверждения авторства/владения в Mastodon и других сетях
  },
}

// Ссылки rel="me" на официальные соцсети (подтверждение владения для поисковиков)
const socialMeLinks = [
  "https://t.me/Weebix",
  "https://vk.ru/WeebX_official",
  "https://www.youtube.com/@WeebX_official",
  "https://www.instagram.com/weebx_official/",
  "https://www.tiktok.com/@weebx_official",
]

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
        {/* rel=me — подтверждение владения аккаунтами в соцсетях для Google и сервисов IndieWeb */}
        {socialMeLinks.map((href) => (
          <link key={href} rel="me" href={href} />
        ))}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(localStorage.getItem('lite-mode')==='true')document.documentElement.classList.add('lite-mode');`,
          }}
        />
        {/* Google Fonts с улучшенной конфигурацией */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Unbounded:wght@400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* Системные фоллбеки для когда Google Fonts недоступен */}
        <style>{`
          @font-face {
            font-family: 'Inter';
            src: local('SF Pro Display'), local('Segoe UI'), local('Roboto'), local('Arial');
            font-display: swap;
          }
          @font-face {
            font-family: 'JetBrains Mono';
            src: local('SFMono-Regular'), local('Cascadia Code'), local('Roboto Mono'), local('Consolas'), local('Courier New');
            font-display: swap;
          }
          @font-face {
            font-family: 'Unbounded';
            src: local('Arial Black'), local('Segoe UI Black'), local('Arial');
            font-display: swap;
          }
        `}</style>
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
                        <BookmarkAuthPrompt />
                        <GuestHooksController />
                        <ErrorBoundary name="Main App">{children}</ErrorBoundary>
                      </EpisodeUpdatesProvider>
                    </BookmarksProvider>
                  </HistoryProvider>
                </CoverProvider>
              </AccountStatsProvider>
              <Suspense fallback={null}>
                <AnalyticsWrapper />
              </Suspense>
            </AuthProvider>
          </ConsentProvider>
          <Toaster />
          <GiftCardReceivedModal />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}