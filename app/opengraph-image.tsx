import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Weeb-X — аниме стриминг платформа с гача-крутками и PvP-ареной"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1030 50%, #0a0a0a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Декоративный градиент */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 30% 40%, rgba(124,58,237,0.25) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(79,70,229,0.2) 0%, transparent 50%)",
            display: "flex",
          }}
        />
        {/* Лого / бренд */}
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            marginBottom: 8,
          }}
        >
          Weeb-X
        </div>
        {/* Подзаголовок */}
        <div
          style={{
            display: "flex",
            fontSize: 38,
            fontWeight: 600,
            color: "#a78bfa",
            marginBottom: 16,
          }}
        >
          Гача-крутки и PvP-арена
        </div>
        {/* Описание */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Собирай легендарных аниме-героев и сражайся на арене
        </div>
        {/* Теги */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#f97316",
            marginTop: 24,
          }}
        >
          Высокий шанс SSR · Ежедневные бонусы · PvP-арена
        </div>
        {/* Домен */}
        <div
          style={{
            display: "flex",
            fontSize: 20,
            color: "#6b7280",
            marginTop: 40,
          }}
        >
          weeb-x.com
        </div>
      </div>
    ),
    { ...size }
  )
}
