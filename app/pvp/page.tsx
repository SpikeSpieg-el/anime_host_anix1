"use client";

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { usePvPBattle } from "@/hooks/use-pvp-battle";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";

export const metadata: Metadata = {
  title: "PvP Арена — Weeb.X",
  description: "Онлайн арена для поединков между игроками. Сражайтесь, поднимайтесь в рейтинге и получайте награды.",
  canonical: "https://weeb.x/pvp",
};

const navItems = [
  { id: "pvp", label: "PvP", icon: Shield },
  { id: "catalog", label: "Каталог", icon: Shield },
  { id: "faq", label: "FAQ", icon: Shield },
];

export default function PvPPage() {
  const router = useRouter();
  const { user, sessionLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isPvPMode, setIsPvPMode] = useState(false);
  
  const {
    pvpState,
    resetPvP,
    joinQueue,
    leaveQueue,
    isConnected,
    placeCards,
    isPvPAvailable,
  } = usePvPBattle({
    onRoundResolved: (results) => {
      console.log("[PvP Direct Callback] Round resolved event received:", results);
    },
    onStartNewRound: (data) => {
      console.log("[PvP Direct Callback] Starting new round:", data.round);
    },
    onMatchEnded: (data) => {
      console.log("[PvP Direct Callback] Match ended event received:", data);
    },
  });

  const handleSharePage = async () => {
    const shareText = `⚔️ WEEB.X PVP - Сражайся с реальными игроками в онлайн-арене! Поднимайся в рейтинге и докажи своё мастерство! Зарегистрируй аккаунт и начни бой! За первую регистрацию получи 10,000 монет бесплатно.`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "WEEB.X PvP",
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.error("[Share] Error sharing:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert("Ссылка скопирована в буфер обмена!");
      } catch (error) {
        console.error("[Share] Error copying to clipboard:", error);
        alert("Не удалось скопировать ссылку");
      }
    }
  };

  if (!sessionLoading && !user) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#05050A]">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase">
            Требуется <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">Авторизация</span>
          </h1>
          
          <p className="text-slate-400 text-sm md:text-base max-w-sm mx-auto">
            Для доступа к арене и битвам PVE необходимо войти в аккаунт
          </p>
          
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Shield className="w-5 h-5" />
            Войти в аккаунт
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">PvP Арена</h1>
          </div>
          <p className="text-muted-foreground">
            Онлайн арена для поединков между игроками. Сражайтесь, поднимайтесь в рейтинге и получайте награды.
          </p>
        </div>
        
        <div className="grid gap-6">
          {navItems.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-1">{item.label}</h2>
                  <p className="text-sm text-muted-foreground mb-3">{item.label === "PvP" ? "Онлайн арена для поединков между игроками" : ""}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Как это работает?
          </h3>
          <p className="text-muted-foreground mb-4">
            Выбирайте соперников, ставьте карты в зоны атаки и защиты, и смотрите, как развивается битва в реальном времени. 
            Каждый раунд — это новая возможность продемонстрировать стратегическое мышление.
          </p>
        </div>
        
        <div className="mt-8">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Shield className="w-5 h-5" />
              Войти в аккаунт
            </button>
          </div>
        </div>
        
        <div className="mt-12">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => joinQueue()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl shadow-sm hover:shadow-indigo-500 transition-all"
              disabled={!isPvPAvailable}
            >
              <Shield className="w-5 h-5" />
              Войти в PvP-арену
            </button>
            <button
              onClick={() => leaveQueue()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 border border-gray-500/20 rounded-xl shadow-sm hover:shadow-gray-500 transition-all"
              disabled={!isConnected}
            >
              <Shield className="w-5 h-5" />
              Выход из PvP
            </button>
          </div>
        </div>
        
        <div className="mt-16">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-3xl blur-3xl -z-10" />
            <div className="relative p-8 md:p-12 bg-white/5 border border-orange-500/20 rounded-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="relative p-4 bg-white/5 rounded-xl border border-orange-500/30">
                <h2 className="text-xl font-bold text-foreground mb-2">Текущий статус PvP</h2>
                <div className="flex items-center gap-3 mb-4">
                  {isPvPMode ? (
                    <div className="flex items-center space-x-4">
                      <div className="w-5 h-5 bg-orange-500 rounded-full">
                        <span className="text-white">В очереди</span>
                      </div>
                      <div className="ml-3">
                        <span className="text-sm text-slate-400">Статус: <span className="text-orange-500">В очереди</span></span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <div className="w-5 h-5 bg-gray-500 rounded-full">
                        <span className="text-gray-400">Не в очереди</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
        </div>
        
        <Footer />
      </div>
    </div>
  );
}