import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Weeb-X — Смотреть аниме онлайн",
    short_name: "Weeb-X",
    description:
      "Стриминг аниме в HD с русской озвучкой. Гача-крутки, PvP-арена, каталог манги и новости аниме. Бесплатно на Weeb-X.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "ru",
    dir: "ltr",
    categories: ["entertainment", "games", "books"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-light-32x32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Каталог аниме",
        short_name: "Каталог",
        url: "/catalog",
        description: "Каталог аниме с фильтрами по жанрам и годам",
      },
      {
        name: "Гача-крутки",
        short_name: "Гача",
        url: "/gacha",
        description: "Крути гачу и собирай легендарных аниме-персонажей",
      },
      {
        name: "PvP-арена",
        short_name: "PvP",
        url: "/battle",
        description: "Сражайся на PvP-арене с другими игроками",
      },
      {
        name: "Манга",
        short_name: "Манга",
        url: "/manga",
        description: "Читать мангу онлайн в удобном ридере",
      },
      {
        name: "Расписание",
        short_name: "Расписание",
        url: "/schedule",
        description: "Календарь выхода новых серий аниме",
      },
    ],
  }
}
