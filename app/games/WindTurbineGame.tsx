'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wind, Trophy, BookOpen, RotateCcw, Zap } from 'lucide-react'

interface WindTurbineGameProps {
  isOpen: boolean
  onClose: () => void
  onEarnExp: (exp: number) => void
}

// ==================== Constants ====================
const GAME_DURATION = 60
const SPINS_PER_EXP = 1000

// 플라이휠 물리 상수
const INERTIA = 0.15 // 관성 (낮을수록 무거움) - 기존 0.8 → 0.15
const BASE_FRICTION = 0.96 // 기본 마찰
const HIGH_SPEED_DRAG = 0.0008 // 고속 공기저항 계수
const MAX_RPS = 70 // 최대 RPS

// 콤보 구간
const COMBO_L1_RPS = 50 // Blue Spark
const COMBO_L2_RPS = 60 // Golden Overload

// 히트박스
const SNAP_INNER = 20
const TRACK_OUTER = 60

// ==================== Component ====================
export default function WindTurbineGame({ isOpen, onClose, onEarnExp }: WindTurbineGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [showGuide, setShowGuide] = useState(true)
  const [comboLevel, setComboLevel] = useState(0) // 0, 1, 2
  const [showShake, setShowShake] = useState(false)
  const [finalStats, setFinalStats] = useState({
    spins: 0, avgRps: 0, maxRps: 0, maxComboTime: 0, exp: 0
  })

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const bladesRef = useRef<HTMLDivElement>(null)
  const rpmBarRef = useRef<HTMLDivElement>(null)
  const rpmTextRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<HTMLParagraphElement>(null)
  const spinsRef = useRef<HTMLParagraphElement>(null)
  const comboGaugeRef = useRef<HTMLDivElement>(null)
  const comboTimeRef = useRef<HTMLParagraphElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)

  // Physics Refs
  const rotationRef = useRef(0)
  const velocityRef = useRef(0)
  const torqueRef = useRef(0) // 입력 토크
  const totalRotRef = useRef(0)
  const timeLeftRef = useRef(GAME_DURATION)
  const lastAngleRef = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const animationRef = useRef<number>()
  const timerIntervalRef = useRef<NodeJS.Timeout>()

  // Stats Refs
  const maxRpsRef = useRef(0)
  const rpsHistoryRef = useRef<number[]>([])
  const comboStartRef = useRef<number | null>(null)
  const maxComboTimeRef = useRef(0)
  const currentComboRef = useRef(0)

  // Wind event
  const windActiveRef = useRef(false)
  const windTimeRef = useRef<number | null>(null)
  const windUsedRef = useRef(false)
  const [windActive, setWindActive] = useState(false)

  // ==================== Coords ====================
  const getCoords = useCallback((x: number, y: number) => {
    if (!containerRef.current) return { dist: 0, angle: 0 }
    const r = containerRef.current.getBoundingClientRect()
    const dx = x - (r.left + r.width / 2)
    const dy = y - (r.top + r.height / 2)
    return {
      dist: Math.sqrt(dx * dx + dy * dy) / (r.width / 2) * 100,
      angle: -Math.atan2(dy, dx) * (180 / Math.PI)
    }
  }, [])

  // ==================== Pointer ====================
  const onDown = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing') return
    e.preventDefault()
    const { dist, angle } = getCoords(e.clientX, e.clientY)
    if (dist < SNAP_INNER || dist > TRACK_OUTER) return

    navigator.vibrate?.([8])
    containerRef.current?.setPointerCapture(e.pointerId)
    pointerIdRef.current = e.pointerId
    lastAngleRef.current = angle
    isDraggingRef.current = true
    setShowGuide(false)
  }, [gameState, getCoords])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || pointerIdRef.current !== e.pointerId) return
    e.preventDefault()

    const { angle } = getCoords(e.clientX, e.clientY)
    if (lastAngleRef.current === null) {
      lastAngleRef.current = angle
      return
    }

    let delta = angle - lastAngleRef.current
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360

    // 반시계방향(CCW) = delta > 0
    if (delta > 0.3) {
      // 플라이휠: 토크 누적 (무거운 느낌)
      const boost = windActiveRef.current ? 2 : 1
      torqueRef.current += delta * INERTIA * boost
    } else if (delta < -2) {
      // 역방향: 급감속
      velocityRef.current *= 0.4
      torqueRef.current = 0
      navigator.vibrate?.([15])
    }

    lastAngleRef.current = angle
  }, [getCoords])

  const onUp = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    containerRef.current?.releasePointerCapture(e.pointerId)
    pointerIdRef.current = null
    lastAngleRef.current = null
    isDraggingRef.current = false
  }, [])

  // ==================== Game Loop ====================
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return

    // 플라이휠 물리: 토크 → 속도 (무거운 가속)
    velocityRef.current += torqueRef.current * 0.3
    torqueRef.current *= 0.5 // 토크 감쇠

    // 마찰 + 공기저항 (고속일수록 급격히 증가)
    const rps = Math.abs(velocityRef.current) / 6
    const drag = 1 - (HIGH_SPEED_DRAG * rps * rps) // 제곱 저항
    velocityRef.current *= BASE_FRICTION * Math.max(drag, 0.9)

    if (Math.abs(velocityRef.current) < 0.1) velocityRef.current = 0

    // 회전 적용
    rotationRef.current -= velocityRef.current
    totalRotRef.current += Math.abs(velocityRef.current)

    const currentRps = Math.min(rps, MAX_RPS)
    rpsHistoryRef.current.push(currentRps)
    if (currentRps > maxRpsRef.current) maxRpsRef.current = currentRps

    // 콤보 체크
    let newCombo = 0
    if (currentRps >= COMBO_L2_RPS) newCombo = 2
    else if (currentRps >= COMBO_L1_RPS) newCombo = 1

    if (newCombo > 0) {
      if (comboStartRef.current === null) comboStartRef.current = Date.now()
      currentComboRef.current = (Date.now() - comboStartRef.current) / 1000
      if (currentComboRef.current > maxComboTimeRef.current) {
        maxComboTimeRef.current = currentComboRef.current
      }
    } else {
      comboStartRef.current = null
      currentComboRef.current = 0
    }

    if (newCombo !== comboLevel) setComboLevel(newCombo)

    // 60 RPS 화면 흔들림
    if (currentRps >= 60 && !showShake) {
      setShowShake(true)
      navigator.vibrate?.([30])
      setTimeout(() => setShowShake(false), 100)
    }

    // === Direct DOM ===
    if (bladesRef.current) {
      const blur = currentRps > 55 ? 6 : currentRps > 45 ? 4 : currentRps > 30 ? 2 : 0
      bladesRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      bladesRef.current.style.filter = `blur(${blur}px)`
    }
    if (hubRef.current) {
      // 축 발열 효과
      const heat = Math.min((currentRps - 50) / 20, 1)
      hubRef.current.style.boxShadow = heat > 0
        ? `0 0 ${20 * heat}px rgba(255, ${100 - heat * 100}, 0, ${heat})`
        : 'none'
    }
    if (rpmBarRef.current) {
      const pct = (currentRps / MAX_RPS) * 100
      rpmBarRef.current.style.width = `${pct}%`
      rpmBarRef.current.style.background = currentRps >= 60
        ? 'linear-gradient(90deg, #FFD700, #FF6B6B)'
        : currentRps >= 50
        ? 'linear-gradient(90deg, #60A5FA, #3B82F6)'
        : 'linear-gradient(90deg, #00D4FF, #0EA5E9)'
    }
    if (rpmTextRef.current) {
      rpmTextRef.current.textContent = currentRps.toFixed(1)
      rpmTextRef.current.style.color = currentRps >= 60 ? '#FFD700' : currentRps >= 50 ? '#60A5FA' : '#00D4FF'
    }
    if (spinsRef.current) {
      spinsRef.current.textContent = Math.floor(totalRotRef.current / 360).toString()
    }
    if (comboGaugeRef.current) {
      // 콤보 유지 게이지 (50 RPS 기준)
      const gauge = Math.max(0, Math.min(100, ((currentRps - 40) / 20) * 100))
      comboGaugeRef.current.style.width = `${gauge}%`
      comboGaugeRef.current.style.background = newCombo === 2 ? '#FFD700' : newCombo === 1 ? '#60A5FA' : '#334155'
    }
    if (comboTimeRef.current) {
      comboTimeRef.current.textContent = currentComboRef.current > 0
        ? `${currentComboRef.current.toFixed(1)}s`
        : '-'
    }

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameState, comboLevel, showShake])

  // ==================== Timer ====================
  useEffect(() => {
    if (gameState !== 'playing') return

    // Wind event 설정
    if (!windUsedRef.current && windTimeRef.current === null) {
      windTimeRef.current = GAME_DURATION - (Math.random() * 30 + 15)
    }

    timerIntervalRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      if (timerRef.current) {
        timerRef.current.textContent = `${timeLeftRef.current}s`
        timerRef.current.style.color = timeLeftRef.current <= 10 ? '#EF4444' : '#fff'
      }

      // Wind check
      const wt = windTimeRef.current
      if (wt && !windUsedRef.current) {
        if (timeLeftRef.current <= wt && timeLeftRef.current > wt - 5) {
          if (!windActiveRef.current) {
            windActiveRef.current = true
            setWindActive(true)
            navigator.vibrate?.([80, 40, 80])
          }
        } else if (timeLeftRef.current <= wt - 5) {
          windActiveRef.current = false
          windUsedRef.current = true
          setWindActive(false)
        }
      }

      if (timeLeftRef.current <= 0) {
        clearInterval(timerIntervalRef.current)
        if (animationRef.current) cancelAnimationFrame(animationRef.current)

        const spins = Math.floor(totalRotRef.current / 360)
        const avgRps = rpsHistoryRef.current.length > 0
          ? rpsHistoryRef.current.reduce((a, b) => a + b, 0) / rpsHistoryRef.current.length
          : 0
        const comboBonus = Math.floor(maxComboTimeRef.current / 5) // 5초당 1 EXP
        const exp = Math.floor(spins / SPINS_PER_EXP) + comboBonus

        setFinalStats({
          spins,
          avgRps: Math.round(avgRps * 10) / 10,
          maxRps: Math.round(maxRpsRef.current * 10) / 10,
          maxComboTime: Math.round(maxComboTimeRef.current * 10) / 10,
          exp
        })
        setGameState('finished')
      }
    }, 1000)

    animationRef.current = requestAnimationFrame(gameLoop)

    return () => {
      clearInterval(timerIntervalRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [gameState, gameLoop])

  // Touch blocking
  useEffect(() => {
    const el = containerRef.current
    if (!el || gameState !== 'playing') return
    const prevent = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => {
      el.removeEventListener('touchstart', prevent)
      el.removeEventListener('touchmove', prevent)
    }
  }, [gameState])

  const startGame = () => {
    rotationRef.current = 0
    velocityRef.current = 0
    torqueRef.current = 0
    totalRotRef.current = 0
    maxRpsRef.current = 0
    rpsHistoryRef.current = []
    comboStartRef.current = null
    maxComboTimeRef.current = 0
    currentComboRef.current = 0
    timeLeftRef.current = GAME_DURATION
    windTimeRef.current = null
    windUsedRef.current = false
    windActiveRef.current = false
    setShowGuide(true)
    setComboLevel(0)
    setWindActive(false)
    setGameState('playing')
  }

  const handleRecord = () => {
    if (finalStats.exp > 0) onEarnExp(finalStats.exp)
    onClose()
    setGameState('ready')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[700] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/90" onClick={gameState === 'ready' ? onClose : undefined} />

        {/* Wind Particles */}
        {windActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-wind"
                style={{ top: `${15 + i * 10}%`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        <motion.div
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 ${showShake ? 'animate-shake' : ''}`}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          style={{ boxShadow: comboLevel === 2 ? '0 0 60px #FFD70050' : comboLevel === 1 ? '0 0 40px #60A5FA30' : '0 0 30px #00D4FF15' }}
        >
          {gameState !== 'playing' && (
            <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-400"><X className="w-6 h-6" /></button>
          )}

          <div className="p-4 border-b border-white/10 text-center">
            <div className="flex items-center gap-2 justify-center">
              <Wind className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">풍력 끙차돌리기</h2>
              {comboLevel > 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${comboLevel === 2 ? 'bg-yellow-500/30 text-yellow-400' : 'bg-blue-500/30 text-blue-400'}`}>
                  {comboLevel === 2 ? '🔥 OVERLOAD' : '⚡ COMBO'}
                </span>
              )}
            </div>
          </div>

          {/* Ready */}
          {gameState === 'ready' && (
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <RotateCcw className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">묵직하게 돌려라!</h3>
              <p className="text-slate-400 text-sm mb-2">플라이휠 물리 - 가속에 근성이 필요합니다</p>
              <div className="text-xs text-slate-500 mb-4 space-y-1">
                <p>⚡ <span className="text-blue-400">50 RPS</span> = Blue Combo</p>
                <p>🔥 <span className="text-yellow-400">60 RPS</span> = Golden Overload</p>
              </div>
              <button onClick={startGame} className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold text-lg">
                게임 시작!
              </button>
            </div>
          )}

          {/* Playing */}
          {gameState === 'playing' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">남은 시간</p>
                  <p ref={timerRef} className="text-xl font-bold text-white">{GAME_DURATION}s</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">콤보 시간</p>
                  <p ref={comboTimeRef} className="text-lg font-bold text-slate-400">-</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">회전수</p>
                  <p ref={spinsRef} className="text-xl font-bold text-cyan-400">0</p>
                </div>
              </div>

              {/* Wind Banner */}
              {windActive && (
                <div className="mb-2 py-1.5 rounded-lg bg-green-500/20 border border-green-400/50 text-center">
                  <span className="text-green-400 font-bold text-sm">🌪️ WIND BOOST x2</span>
                </div>
              )}

              {/* RPS Gauge */}
              <div className="mb-2 bg-slate-800/50 rounded-xl p-2">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-slate-400">RPS (초당 회전)</span>
                  <span ref={rpmTextRef} className="text-sm font-bold text-cyan-400">0.0</span>
                </div>
                <div className="relative h-3 bg-slate-900 rounded-full overflow-hidden">
                  {/* 콤보 구간 표시 */}
                  <div className="absolute h-full bg-blue-500/20" style={{ left: `${(50/MAX_RPS)*100}%`, width: `${(10/MAX_RPS)*100}%` }} />
                  <div className="absolute h-full bg-yellow-500/20" style={{ left: `${(60/MAX_RPS)*100}%`, width: `${(10/MAX_RPS)*100}%` }} />
                  <div ref={rpmBarRef} className="absolute h-full rounded-full" style={{ width: '0%', willChange: 'width' }} />
                </div>
                {/* 콤보 유지 게이지 */}
                <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div ref={comboGaugeRef} className="h-full rounded-full transition-all duration-150" style={{ width: '0%' }} />
                </div>
              </div>

              {/* Turbine */}
              <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-2xl bg-slate-900/50 overflow-hidden select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={onUp}
              >
                {/* Track */}
                <div className="absolute rounded-full border-[10px] pointer-events-none"
                  style={{
                    left: `${50 - TRACK_OUTER}%`, top: `${50 - TRACK_OUTER}%`,
                    width: `${TRACK_OUTER * 2}%`, height: `${TRACK_OUTER * 2}%`,
                    borderColor: comboLevel === 2 ? '#FFD70060' : comboLevel === 1 ? '#60A5FA50' : '#EF444440',
                  }} />
                <div className="absolute rounded-full border-2 border-dashed border-slate-600/30 pointer-events-none"
                  style={{ left: `${50 - SNAP_INNER}%`, top: `${50 - SNAP_INNER}%`, width: `${SNAP_INNER * 2}%`, height: `${SNAP_INNER * 2}%` }} />

                {/* Tower */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                  <path d="M48 50 L46 90 L54 90 L52 50 Z" fill="#94a3b8" />
                </svg>

                {/* Blades */}
                <div ref={bladesRef} className="absolute inset-0 pointer-events-none"
                  style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'rotate(0deg)' }}>
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="bl" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor={comboLevel === 2 ? '#FFD700' : comboLevel === 1 ? '#60A5FA' : '#60a5fa'} />
                        <stop offset="100%" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>
                    {[0, 120, 240].map((a, i) => (
                      <g key={i} transform={`rotate(${a} 50 50)`}>
                        <path d="M49 50 L46 15 Q50 10 54 15 L51 50 Z" fill="url(#bl)" />
                      </g>
                    ))}
                  </svg>
                  {/* Hub with heat effect */}
                  <div ref={hubRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[10%] h-[10%] rounded-full bg-slate-700 border-2 border-blue-400" />
                </div>

                {/* Guide */}
                {showGuide && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
                    <div className="text-center">
                      <RotateCcw className="w-10 h-10 text-cyan-400 mx-auto mb-1" />
                      <p className="text-cyan-400 text-xs font-bold">반시계방향!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Finished */}
          {gameState === 'finished' && (
            <div className="p-6 text-center">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-4">게임 종료!</h3>

              <div className="bg-white/5 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">총 회전수</p>
                  <p className="text-lg font-bold text-cyan-400">{finalStats.spins}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">최고 RPS</p>
                  <p className="text-lg font-bold text-yellow-400">{finalStats.maxRps}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">평균 RPS</p>
                  <p className="text-lg font-bold text-blue-400">{finalStats.avgRps}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">최장 콤보</p>
                  <p className="text-lg font-bold text-orange-400">{finalStats.maxComboTime}s</p>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">획득 EXP</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    {finalStats.exp} EXP
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ({Math.floor(finalStats.spins / SPINS_PER_EXP)} 기본 + {Math.floor(finalStats.maxComboTime / 5)} 콤보 보너스)
                </p>
              </div>

              <button onClick={handleRecord} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold mb-2">
                <BookOpen className="w-5 h-5 inline mr-2" />기록하기 (+{finalStats.exp} EXP)
              </button>
              <button onClick={startGame} className="w-full py-2.5 rounded-xl bg-white/10 text-slate-300">다시 하기</button>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes wind { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200vw);opacity:0} }
        .animate-wind{animation:wind 1.8s linear infinite;width:30%}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
        .animate-shake{animation:shake 0.1s ease-in-out}
      `}</style>
    </AnimatePresence>
  )
}
