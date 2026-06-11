"use client"

import { useEffect, useRef } from "react"

const LOGO_ART = `$$*          $$$$$$$l          $$$$$$                            
$$$          $$$$$$$$         h$$$$$Q                            
$$$$        $$$$$$$$$*        $$$$$$                             
$$$$       )$$$$$$$$$$       L$$$$$v   $$$$$$$$$$$Z        ^$$$$$
$$$$B      $$$$$ b$$$$$      $$$$$$  $$$$$$$$$$$$$$$a    |$$$$$$$
$$$$$_    &$$$$a  $$$$$l    $$$$$$"n$$$$$$I     $$$$$$  $$$$$$$  
$$$$$$   {$$$$$   ^$$$$$    $$$$$$ $$$$$$        a$$$$pU$$$$$x   
L$$$$$.  $$$$$_    $$$$$Z  @$$$$$ W$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
 $$$$$$ W$$$$o      $$$$$^:$$$$$$ Z$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
 \\$$$$$v$$$$$       f$$$$$$$$$$$   $$$$$$.             !$$$$$$   
  $$$$$$$$$$+        @$$$$$$$$$f   \`$$$$$$$#^     aB$$a >$$$$$$$*
  I$$$$$$$$@          $$$$$$$$$      W$$$$$$$$$$$$$$$$a   $$$$$$$
   &$$$$$$$           f$$$$$$$          *$$$$$$$$$$J        ^$$$$
                                                                 
                                                                 
           ;;;;;;                                                
           $$$$$$                       fYYYYYYY         /YYYYYY+
           $$$$$$                        .YYYYYYY       YYYYYYY  
           $$$$$$                          YYYYYYY)   ;YYYYYY|   
$$$$B      $$$$$$  ;$$$$$$$$$\`               YYYYYYY YYYYYYY     
$$$$$$$    $$$$$$/$$$$$$$$$$$$$'              rYYYYYYYYYYY(      
  j$$$$$\`  $$$$$$$$$)   [$$$$$$$                YYYYYYYYY        
    $$$$$  $$$$$$$        >$$$$$$               cYYYYYYYr        
$$$$$$$$$U $$$$$$          &$$$$$             .YYYYYYYYYYY       
$$$$$$$$$U $$$$$$          8$$$$$            YYYYYYY:YYYYYY\\     
           $$$$$$$        i$$$$$$  J@C      YYYYYYn   YYYYYYY    
     O$$$  $$$$$$$$$*   )$$$$$$$ \\$$$$$o  )YYYYYYI     |YYYYYYl  
$$$$$$$$$  $$$$$$^$$$$$$$$$$$$$  a$$$$$$ YYYYYYY        .YYYYYYY 
$$$$$$J    $$$$$$   $$$$$$$$8     B$$$$[YYYYYY{           YYYYYYY
                                                                 
                                                                 
                                                                 `

// Символы высокой плотности для мерцания, чтобы силуэт логотипа не казался "дырявым"
const SHIMMER_CHARS = "S$B8&WM#Q0pdqUYX$@"

const INITIAL_SPACES = LOGO_ART.replace(/[^\n]/g, " ")

export function AnimatedLogo() {
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const lines = LOGO_ART.split("\n")
    const totalLines = lines.length

    let animationFrameId: number
    
    // Индексы для одновременной печати
    let topLineIndex = 0
    let topCharIndex = 0
    let bottomLineIndex = totalLines - 1
    let bottomCharIndex = 0

    const tick = (now: number) => {
      let isDone = topLineIndex > bottomLineIndex

      if (!isDone) {
        // Скорость появления символов
        const speedTop = Math.floor(Math.random() * 3) + 3    
        const speedBottom = Math.floor(Math.random() * 3) + 3 

        if (topLineIndex === bottomLineIndex) {
          topCharIndex += speedTop
          if (topCharIndex >= lines[topLineIndex].length) {
            isDone = true
          }
        } else {
          topCharIndex += speedTop
          if (topCharIndex >= lines[topLineIndex].length) {
            topCharIndex = 0
            topLineIndex++
          }

          bottomCharIndex += speedBottom
          if (bottomCharIndex >= lines[bottomLineIndex].length) {
            bottomCharIndex = 0
            bottomLineIndex--
          }
        }
      }

      const outputLines: string[] = []

      for (let r = 0; r < totalLines; r++) {
        let lineContent = ""

        if (isDone) {
          lineContent = lines[r]
        } else {
          // Выделение только напечатанных участков
          if (r < topLineIndex) {
            lineContent = lines[r]
          } else if (r > bottomLineIndex) {
            lineContent = lines[r]
          } else if (r === topLineIndex && r === bottomLineIndex) {
            lineContent = lines[r].slice(0, topCharIndex)
          } else if (r === topLineIndex) {
            lineContent = lines[r].slice(0, topCharIndex)
          } else if (r === bottomLineIndex) {
            lineContent = lines[r].slice(0, bottomCharIndex)
          } else {
            lineContent = "" // Скрытые строки
          }
        }

        // 1. "Живые символы" (горизонтальная волна мерцания)
        let livingLine = ""
        for (let c = 0; c < lineContent.length; c++) {
          const char = lineContent[c]
          if (char === " ") {
            livingLine += " "
          } else {
            // Формула фазы волны мерцания
            const waveValue = Math.sin(c * 0.12 - now / 150 + r * 0.08)
            // Если символ попадает на пик волны, он с некоторой вероятностью меняет форму
            if (waveValue > 0.85 && Math.random() > 0.25) {
              const shimmerIndex = Math.floor((now + r + c) % SHIMMER_CHARS.length)
              livingLine += SHIMMER_CHARS[shimmerIndex]
            } else {
              livingLine += char
            }
          }
        }

        // 2. "Плавная волна движения" (горизонтальное волновое смещение строки)
        const wiggleOffset = Math.sin(now / 500 + r * 0.25) * 1.8
        const paddingCount = Math.max(0, Math.round(2 + wiggleOffset))
        const paddedLine = " ".repeat(paddingCount) + livingLine

        outputLines.push(paddedLine)
      }

      // Текстовый курсор
      const cursorVisible = Math.floor(now / 150) % 2 === 0
      const cursor = cursorVisible ? "█" : " "

      if (preRef.current) {
        preRef.current.textContent = outputLines.join("\n") + cursor
      }

      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="relative select-none w-full max-w-full overflow-hidden flex justify-center items-center py-4">
      <pre 
        ref={preRef}
        className="relative font-mono text-[8px] xs:text-[9px] sm:text-xs md:text-sm lg:text-base leading-none whitespace-pre text-orange-500 scale-[0.4] xs:scale-[0.45] sm:scale-[0.55] md:scale-[0.65] lg:scale-[0.7] transform-gpu"
        style={{
          fontFamily: '"Courier New", monospace',
          lineHeight: "1.15",
          letterSpacing: "0.02em",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          transformOrigin: "center center",
        }}
      >
        {INITIAL_SPACES}
      </pre>
    </div>
  )
}