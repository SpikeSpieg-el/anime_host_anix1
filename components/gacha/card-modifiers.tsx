import React, { memo } from "react";
import { getProxiedSrc } from "@/lib/image-loader";

// --- CSS АНИМАЦИИ (Вынесены в статический блок для производительности) ---
const animationStyles = `
  @keyframes goldShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes firePulse {
    0%, 100% { box-shadow: inset 0 0 20px #ff4500, 0 0 10px #ff8c00; opacity: 0.8; }
    50% { box-shadow: inset 0 0 40px #ff0000, 0 0 20px #ff4500; opacity: 1; }
  }
  @keyframes electric {
    0%, 100% { filter: drop-shadow(0 0 2px #00ffff); }
    10% { filter: drop-shadow(0 0 8px #fff) brightness(1.2); }
    15% { filter: drop-shadow(0 0 2px #00ffff); }
  }
  @keyframes abyssBreath {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.01); opacity: 1; }
  }
  @keyframes matrixMove {
    0% { background-position: 0 0; }
    100% { background-position: 0 100%; }
  }
  @keyframes glitchStep {
    0% { clip-path: inset(10% 0 30% 0); transform: translateX(-1px); }
    20% { clip-path: inset(40% 0 10% 0); transform: translateX(1px); }
    40% { clip-path: inset(70% 0 5% 0); transform: translateX(-0.5px); }
    100% { clip-path: inset(0% 0 0% 0); transform: translateX(0); }
  }
  @keyframes rainbowFlow {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
  }
  
  .modifier-overlay {
    will-change: opacity;
    backface-visibility: hidden;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .perspective-container {
    perspective: 1000px;
    -webkit-perspective: 1000px;
    transform-style: preserve-3d;
  }
`;

// Компонент для глобальных стилей (рендерится один раз)
export const ModifierStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
);

export type StatType = "hp" | "atk" | "def" | "spd" | "luck";

export interface ModifierStats {
  stat: StatType;
  bonus: number;
}

export interface ModifierConfig {
  cost: number;
  stats: ModifierStats;
}

// --- НАЗВАНИЯ МОДИФИКАТОРОВ ---
export const frameNames: Record<string, string> = {
  gold: "Королевское золото",
  neon: "Неоновый драйв",
  crystal: "Ледяной кристалл",
  dark: "Оболочка тени",
  blood: "Кровавая жатва",
  inferno: "Ярость преисподней",
  lightning: "Гнев шторма",
  divine: "Святой нимб",
  cyber_glitch: "Системный сбой",
  abyss: "Зов бездны"
};

export const coatingNames: Record<string, string> = {
  holo: "Голографическая фольга",
  prismatic: "Призматический спектр",
  gold_leaf: "Сусальное золото",
  blood_stain: "Следы битвы",
  void: "Частицы пустоты",
  matrix_foil: "Цифровой код",
  crt_scanlines: "Сигнал из прошлого",
  falling_ash: "Пепел империи",
  heartbeat: "Пульс жизни",
  ethereal_mist: "Мистический туман"
};

// --- КОНФИГУРАЦИЯ ---
export const frameConfigs: Record<string, ModifierConfig> = {
  gold: { cost: 50, stats: { stat: "atk", bonus: 10 } },
  neon: { cost: 60, stats: { stat: "spd", bonus: 12 } },
  crystal: { cost: 55, stats: { stat: "def", bonus: 10 } },
  dark: { cost: 70, stats: { stat: "hp", bonus: 15 } },
  blood: { cost: 80, stats: { stat: "atk", bonus: 15 } },
  inferno: { cost: 100, stats: { stat: "atk", bonus: 20 } },
  lightning: { cost: 90, stats: { stat: "spd", bonus: 18 } },
  divine: { cost: 120, stats: { stat: "luck", bonus: 25 } },
  cyber_glitch: { cost: 85, stats: { stat: "spd", bonus: 14 } },
  abyss: { cost: 110, stats: { stat: "hp", bonus: 22 } }
};

export const coatingConfigs: Record<string, ModifierConfig> = {
  holo: { cost: 40, stats: { stat: "luck", bonus: 8 } },
  prismatic: { cost: 45, stats: { stat: "def", bonus: 9 } },
  gold_leaf: { cost: 55, stats: { stat: "atk", bonus: 11 } },
  blood_stain: { cost: 65, stats: { stat: "atk", bonus: 13 } },
  void: { cost: 75, stats: { stat: "def", bonus: 16 } },
  matrix_foil: { cost: 70, stats: { stat: "spd", bonus: 15 } },
  crt_scanlines: { cost: 50, stats: { stat: "luck", bonus: 10 } },
  falling_ash: { cost: 60, stats: { stat: "hp", bonus: 12 } },
  heartbeat: { cost: 80, stats: { stat: "hp", bonus: 18 } },
  ethereal_mist: { cost: 95, stats: { stat: "luck", bonus: 20 } }
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
export const getModifiersCost = (frame?: string, coating?: string): number => {
  let totalCost = 0;
  if (frame && frameConfigs[frame]) totalCost += frameConfigs[frame].cost;
  if (coating && coatingConfigs[coating]) totalCost += coatingConfigs[coating].cost;
  return totalCost;
};

export const applyModifierStats = (
  baseStats: { hp: number; atk: number; def: number; spd: number; luck: number },
  frame?: string,
  coating?: string
) => {
  const modifiedStats = { ...baseStats };
  if (frame && frameConfigs[frame]) {
    const { stat, bonus } = frameConfigs[frame].stats;
    modifiedStats[stat] += bonus;
  }
  if (coating && coatingConfigs[coating]) {
    const { stat, bonus } = coatingConfigs[coating].stats;
    modifiedStats[stat] += bonus;
  }
  return modifiedStats;
};

export const getStatName = (stat: StatType): string => {
  const names: Record<StatType, string> = { hp: "HP", atk: "Атака", def: "Защита", spd: "Скорость", luck: "Удача" };
  return names[stat];
};

// --- КОМПОНЕНТ РАМКИ ---
export const FrameOverlay = memo(({ frame, className = "" }: { frame?: string, className?: string }) => {
  if (!frame) return null;

  const getFrameStyle = (): React.CSSProperties => {
    switch (frame) {
      case "gold": return {
        border: "3px solid transparent",
        borderImage: "linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fcf6ba, #bf953f) 1",
        boxShadow: "0 0 15px rgba(191, 149, 63, 0.4)",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        backgroundSize: "200% 100%",
        animation: "goldShimmer 4s infinite linear"
      };
      case "neon": return {
        outline: "2px solid #22d3ee",
        boxShadow: "inset 0 0 10px #22d3ee, 0 0 10px #22d3ee",
      };
      case "crystal": return {
        border: "2px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "inset 0 0 15px rgba(186, 230, 253, 0.4)"
      };
      case "dark": return {
        boxShadow: "inset 0 0 30px 5px #000, 0 0 15px #000",
        border: "1px solid rgba(255,255,255,0.05)"
      };
      case "blood": return {
        border: "2px solid #7f1d1d",
        boxShadow: "inset 0 0 20px #450a0a",
        background: "radial-gradient(circle at center, transparent 60%, rgba(127, 29, 29, 0.3) 100%)"
      };
      case "inferno": return {
        border: "2px solid #ea580c",
        animation: "firePulse 3s infinite ease-in-out"
      };
      case "lightning": return {
        border: "1px solid #bae6fd",
        animation: "electric 5s infinite",
        boxShadow: "inset 0 0 10px rgba(186, 230, 253, 0.4)"
      };
      case "divine": return {
        border: "2px solid #fef08a",
        boxShadow: "0 0 20px #fef08a, inset 0 0 15px #fff",
        background: "linear-gradient(45deg, transparent, rgba(255,255,255,0.2), transparent)"
      };
      case "cyber_glitch": return {
        border: "2px solid #ff0055",
        boxShadow: "1px 0 #00ffff, -1px 0 #ff0055",
        animation: "glitchStep 0.3s infinite alternate-reverse"
      };
      case "abyss": return {
        border: "2px solid #4c1d95",
        boxShadow: "inset 0 0 25px #000, 0 0 15px #4c1d95",
        animation: "abyssBreath 5s infinite ease-in-out"
      };
      default: return {};
    }
  };

  return (
    <div 
      className={`absolute inset-0 pointer-events-none rounded-[inherit] z-[25] modifier-overlay ${className}`} 
      style={getFrameStyle()} 
    />
  );
});

FrameOverlay.displayName = "FrameOverlay";

// --- КОМПОНЕНТ ПОКРЫТИЯ ---
export const CoatingOverlay = memo(({ coating, className = "" }: { coating?: string, className?: string }) => {
  if (!coating) return null;

  // Центр карты остается чистым для арта, края заполнены эффектом
  const artFocusMask = {
    WebkitMaskImage: "radial-gradient(circle, transparent 10%, rgba(0,0,0,0.5) 40%, black 100%)",
    maskImage: "radial-gradient(circle, transparent 10%, rgba(0,0,0,0.5) 40%, black 100%)"
  };

  let style: React.CSSProperties = { ...artFocusMask };

  switch (coating) {
    case "holo":
      style = { ...style,
        background: "linear-gradient(135deg, #ff000015 0%, #00ff0015 25%, #0000ff15 50%, #ff00ff15 75%, #ff000015 100%)",
        backgroundSize: "400% 400%",
        animation: "goldShimmer 8s infinite linear",
        mixBlendMode: "color-dodge"
      };
      break;
    case "prismatic":
      style = { ...style,
        backgroundImage: "repeating-conic-gradient(from 0deg, #ffffff08 0deg 30deg, transparent 30deg 60deg)",
        animation: "rainbowFlow 15s infinite linear",
        mixBlendMode: "overlay"
      };
      break;
    case "gold_leaf":
      style = { ...style,
        backgroundImage: `url('${getProxiedSrc("https://www.transparenttextures.com/patterns/gold-dust.png")}')`,
        backgroundColor: "rgba(255, 215, 0, 0.1)",
        mixBlendMode: "color-dodge"
      };
      break;
    case "blood_stain":
      style = { ...style,
        background: "radial-gradient(circle at 20% 20%, #7f1d1d77 0%, transparent 40%), radial-gradient(circle at 80% 80%, #450a0a77 0%, transparent 40%)",
        mixBlendMode: "multiply"
      };
      break;
    case "matrix_foil":
      style = { ...style,
        background: "linear-gradient(transparent 0%, #00ff4122 50%, transparent 100%)",
        backgroundSize: "100% 20px",
        animation: "matrixMove 3s infinite linear",
        mixBlendMode: "screen"
      };
      break;
    case "crt_scanlines":
      style = { ...style,
        background: "repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)",
        opacity: 0.2,
        mixBlendMode: "overlay"
      };
      break;
    case "void":
      style = { ...style,
        backgroundColor: "#00000044",
        backgroundImage: "radial-gradient(#ffffff11 1px, transparent 1px)",
        backgroundSize: "12px 12px",
        mixBlendMode: "darken"
      };
      break;
    case "falling_ash":
      style = { ...style,
        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        animation: "matrixMove 15s infinite linear reverse",
        opacity: 0.3
      };
      break;
    case "heartbeat":
      style = { ...style,
        boxShadow: "inset 0 0 50px #ef444444",
        animation: "abyssBreath 3s infinite ease-in-out",
        mixBlendMode: "soft-light"
      };
      break;
    case "ethereal_mist":
      style = { ...style,
        background: "linear-gradient(45deg, #8b5cf622, #06b6d422)",
        filter: "blur(8px)",
        animation: "goldShimmer 10s infinite alternate"
      };
      break;
  }

  return (
    <div 
      className={`absolute inset-0 pointer-events-none rounded-[inherit] z-[22] modifier-overlay ${className}`} 
      style={style} 
    />
  );
});

CoatingOverlay.displayName = "CoatingOverlay";