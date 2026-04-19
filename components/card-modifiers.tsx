import React from "react";

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
  gold: "Золотая рамка",
  neon: "Неоновая рамка",
  crystal: "Кристальная рамка",
  dark: "Тёмная аура",
  blood: "Кровавая рамка",
  inferno: "Адское пламя",
  lightning: "Штормовой разряд",
  divine: "Божественный свет",
  cyber_glitch: "Кибер-глич",
  abyss: "Пульс бездны"
};

export const coatingNames: Record<string, string> = {
  holo: "Голографический узор",
  prismatic: "Призматическая сетка",
  gold_leaf: "Золотая инкрустация",
  blood_stain: "Кровавые брызги",
  void: "Сумрачная вуаль",
  matrix_foil: "Матричная фольга",
  crt_scanlines: "Ретро-помехи",
  falling_ash: "Пепельный ветер",
  heartbeat: "Багровая пульсация",
  ethereal_mist: "Эфирная дымка"
};

// --- КОНФИГУРАЦИЯ МОДИФИКАТОРОВ (СТОИМОСТЬ И БОНУСЫ) ---
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

// --- ФУНКЦИИ ДЛЯ РАСЧЕТА СТОИМОСТИ И БОНУСОВ ---

/**
 * Рассчитывает общую стоимость модификаторов карты
 */
export const getModifiersCost = (frame?: string, coating?: string): number => {
  let totalCost = 0;
  
  if (frame && frameConfigs[frame]) {
    totalCost += frameConfigs[frame].cost;
  }
  
  if (coating && coatingConfigs[coating]) {
    totalCost += coatingConfigs[coating].cost;
  }
  
  return totalCost;
};

/**
 * Применяет бонусы модификаторов к статистике карты
 * Статы могут превышать 100
 */
export const applyModifierStats = (
  baseStats: { hp: number; atk: number; def: number; spd: number; luck: number },
  frame?: string,
  coating?: string
): { hp: number; atk: number; def: number; spd: number; luck: number } => {
  const modifiedStats = { ...baseStats };
  
  // Применяем бонус от рамки
  if (frame && frameConfigs[frame]) {
    const { stat, bonus } = frameConfigs[frame].stats;
    modifiedStats[stat] += bonus;
  }
  
  // Применяем бонус от покрытия
  if (coating && coatingConfigs[coating]) {
    const { stat, bonus } = coatingConfigs[coating].stats;
    modifiedStats[stat] += bonus;
  }
  
  return modifiedStats;
};

/**
 * Получает информацию о бонусах модификаторов для отображения
 */
export const getModifierBonuses = (frame?: string, coating?: string) => {
  const bonuses: Array<{ modifier: string; type: "frame" | "coating"; stat: StatType; bonus: number }> = [];
  
  if (frame && frameConfigs[frame]) {
    const { stat, bonus } = frameConfigs[frame].stats;
    bonuses.push({ modifier: frameNames[frame] || frame, type: "frame", stat, bonus });
  }
  
  if (coating && coatingConfigs[coating]) {
    const { stat, bonus } = coatingConfigs[coating].stats;
    bonuses.push({ modifier: coatingNames[coating] || coating, type: "coating", stat, bonus });
  }
  
  return bonuses;
};

/**
 * Получает название стата на русском языке
 */
export const getStatName = (stat: StatType): string => {
  const names: Record<StatType, string> = {
    hp: "HP",
    atk: "Атака",
    def: "Защита",
    spd: "Скорость",
    luck: "Удача"
  };
  return names[stat];
};

// --- CSS АНИМАЦИИ ---
const animationStyles = `
  @keyframes pulseInferno {
    0%, 100% { box-shadow: inset 0 -10px 20px -10px rgba(255,69,0,0.5); }
    50% { box-shadow: inset 0 -15px 30px -5px rgba(255,140,0,0.8); }
  }
  @keyframes flickerLightning {
    0%, 100% { box-shadow: inset 0 0 2px rgba(200,230,255,0.2); }
    5% { box-shadow: inset 0 0 10px 2px rgba(200,255,255,0.7); }
    10% { box-shadow: inset 0 0 2px rgba(200,230,255,0.2); }
    15% { box-shadow: inset 0 0 8px 1px rgba(200,255,255,0.6); }
    20% { box-shadow: inset 0 0 2px rgba(200,230,255,0.2); }
  }
  @keyframes breatheDivine {
    0%, 100% { box-shadow: inset 0 10px 20px -10px rgba(255,215,0,0.4); }
    50% { box-shadow: inset 0 15px 30px -5px rgba(255,255,255,0.7); }
  }
  @keyframes cyberGlitch {
    0%, 100% { box-shadow: inset 1px 0 0 rgba(255,0,85,0.3), inset -1px 0 0 rgba(0,255,255,0.3); }
    1% { box-shadow: inset -2px 0 0 rgba(255,0,85,0.6), inset 2px 0 0 rgba(0,255,255,0.6); }
    2% { box-shadow: inset 1px 1px 0 rgba(255,0,85,0.3), inset -1px -1px 0 rgba(0,255,255,0.3); }
    3% { box-shadow: inset 0 0 0 transparent; }
  }
  @keyframes pulseAbyss {
    0%, 100% { box-shadow: inset 0 0 20px 5px rgba(20,0,30,0.8); }
    50% { box-shadow: inset 0 0 35px 10px rgba(10,0,15,0.95); }
  }

  @keyframes foilShimmer {
    0% { background-position: 0% 0%; }
    100% { background-position: 200% 200%; }
  }
  @keyframes scanlinesMove {
    0% { background-position: 0 0; }
    100% { background-position: 0 40px; }
  }
  @keyframes ashDrift {
    0% { background-position: 0px 0px, 0px 0px; }
    100% { background-position: 60px 120px, -30px 90px; }
  }
  @keyframes subtlePulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
  @keyframes shiftMist {
    0% { background-position: 0% 0%; }
    50% { background-position: 100% 100%; }
    100% { background-position: 0% 0%; }
  }
`;

// --- КОМПОНЕНТ РАМКИ ---
export const FrameOverlay = ({ frame, className = "" }: { frame?: string, className?: string }) => {
  if (!frame) return null;
  
  // Рамки теперь очень тонкие и деликатные, акцент только на самый край (inset)
  const frameStyles: Record<string, React.CSSProperties> = {
    gold: { boxShadow: "inset 0 0 0 1px rgba(250,204,21,0.6), inset 0 0 15px rgba(250,204,21,0.2)" },
    neon: { boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.7), inset 0 0 12px rgba(34,211,238,0.3)" },
    crystal: { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6), inset 0 0 10px rgba(186,230,253,0.3)" },
    dark: { boxShadow: "inset 0 0 20px 4px rgba(0,0,0,0.85)" },
    blood: { boxShadow: "inset 0 0 15px 2px rgba(185,28,28,0.5)" },
    
    inferno: { animation: "pulseInferno 3s infinite ease-in-out" },
    lightning: { animation: "flickerLightning 5s infinite linear" },
    divine: { animation: "breatheDivine 4s infinite ease-in-out" },
    cyber_glitch: { animation: "cyberGlitch 4s infinite linear" },
    abyss: { animation: "pulseAbyss 5s infinite ease-in-out" }
  };
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      <div 
        className={`absolute inset-0 pointer-events-none rounded-[inherit] z-[25] ${className}`} 
        style={frameStyles[frame]} 
      />
    </>
  );
};

// --- КОМПОНЕНТ ПОКРЫТИЯ (ПАТТЕРНЫ И ФОЛЬГА) ---
export const CoatingOverlay = ({ coating, className = "" }: { coating?: string, className?: string }) => {
  if (!coating) return null;
  
  // КЛЮЧЕВАЯ ФИШКА: Эта маска делает так, чтобы в центре (на лице персонажа)
  // покрытие было прозрачным на 90%, а по краям карты — на 100% плотным.
  // Это сохраняет идеальную видимость арта.
  const artFocusMask = {
    WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,1) 90%)",
    maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,1) 90%)"
  };

  let style: React.CSSProperties = { ...artFocusMask };
  
  // --- СТАТИЧНЫЕ ПАТТЕРНЫ ---
  if (coating === "holo") {
    // Диагональные линии (эффект фольги) + легкий радужный отблеск
    style = { 
      ...style,
      background: `
        repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 4px),
        linear-gradient(105deg, rgba(255,0,0,0.05), rgba(0,255,0,0.05), rgba(0,0,255,0.05))
      `,
      mixBlendMode: "color-dodge" 
    };
  } else if (coating === "prismatic") {
    // Узор в ромбик (пересекающиеся диагонали)
    style = { 
      ...style,
      background: `
        repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px),
        repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px),
        linear-gradient(to bottom right, rgba(255,100,200,0.1), rgba(100,200,255,0.1))
      `,
      mixBlendMode: "overlay" 
    };
  } else if (coating === "gold_leaf") {
    // Редкая россыпь золотых точек
    style = { 
      ...style,
      backgroundImage: "radial-gradient(circle, rgba(255,215,0,0.6) 1px, transparent 1px)", 
      backgroundSize: "16px 16px", 
      backgroundPosition: "0 0, 8px 8px",
      mixBlendMode: "overlay" 
    };
  } else if (coating === "blood_stain") {
    // Запекшиеся пятна строго по углам (чтобы не пачкать лицо)
    style = {
      background: `
        radial-gradient(circle at 10% 10%, rgba(139,0,0,0.6) 0%, transparent 15%),
        radial-gradient(ellipse at 90% 90%, rgba(100,0,0,0.5) 0%, transparent 25%)
      `,
      mixBlendMode: "multiply"
    };
  } else if (coating === "void") {
    // Очень тонкая темная сетка (миллиметровка) + легкое затемнение
    style = { 
      ...style,
      background: `
        linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)
      `,
      backgroundSize: "6px 6px",
      backgroundColor: "rgba(0,0,0,0.15)",
      mixBlendMode: "multiply" 
    };
  } 
  
  // --- АНИМИРОВАННЫЕ ПАТТЕРНЫ ---
  else if (coating === "matrix_foil") {
    // Переливающаяся техническая сетка, плавно плывущая по диагонали
    style = { 
      ...style,
      background: `
        linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,0,255,0.1) 1px, transparent 1px),
        linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.1) 45%, transparent 60%)
      `,
      backgroundSize: "8px 8px, 8px 8px, 200% 200%",
      animation: "foilShimmer 5s infinite linear",
      mixBlendMode: "overlay"
    };
  } else if (coating === "crt_scanlines") {
    // Тончайшие горизонтальные полосы, медленно ползущие вниз
    style = { 
      ...style,
      background: "repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)",
      backgroundSize: "100% 40px",
      animation: "scanlinesMove 6s infinite linear",
      mixBlendMode: "overlay"
    };
  } else if (coating === "falling_ash") {
    // Мягкие, редкие белые пылинки (снег/пепел)
    style = {
      ...style,
      backgroundImage: `
        radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px), 
        radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)
      `,
      backgroundSize: "50px 50px, 30px 30px",
      animation: "ashDrift 8s infinite linear",
      mixBlendMode: "overlay"
    };
  } else if (coating === "heartbeat") {
    // Мягкий геометрический ромб, тихо пульсирующий на фоне
    style = {
      ...style,
      background: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(220,38,38,0.05) 10px, rgba(220,38,38,0.05) 20px)",
      animation: "subtlePulse 2s infinite ease-in-out",
      mixBlendMode: "multiply"
    };
  } else if (coating === "ethereal_mist") {
    // Размытые пятна света, плавно перетекающие по карте
    style = {
      ...style,
      background: "radial-gradient(circle at 30% 30%, rgba(138,43,226,0.15) 0%, transparent 40%), radial-gradient(circle at 70% 70%, rgba(0,255,255,0.15) 0%, transparent 40%)",
      backgroundSize: "200% 200%",
      animation: "shiftMist 8s infinite ease-in-out",
      mixBlendMode: "screen"
    };
  }
  
  return (
    <div 
      className={`absolute inset-0 pointer-events-none rounded-[inherit] z-[22] ${className}`} 
      style={style} 
    />
  );
};