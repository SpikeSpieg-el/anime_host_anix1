"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Плавающая кнопка «Наверх».
 *
 * Появляется после 400 px скролла и плавно возвращает к началу ленты.
 * На мобильных стоит выше нижней навигации (bottom-20), на десктопе — в
 * правом нижнем углу. При prefers-reduced-motion скролл без анимации.
 */
export function ScrollToTopButton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Наверх"
      title="Наверх"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 md:bottom-6 md:right-6 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
