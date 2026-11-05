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
        "fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/20 backdrop-blur-md transition-all duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:bottom-6 md:right-6 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90",
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
