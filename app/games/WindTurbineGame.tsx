'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wind, Trophy, BookOpen, RotateCcw } from 'lucide-react'

// ==================== Types ====================
interface WindTurbineGameProps {
  isOpen: boolean
  onClose: () => void
  onEarnExp: (exp: number) => void
}

// ==================== Constants ====================
const GAME_DURATION = 60
const FRICTION = 0.94
const SPINS_PER_EXP = 1000
const COMBO_ZONE_THRESHOLD = 70
const MAX_RPM = 250

// 히트박스: 도넛 존 (20% ~ 60%)
const SNAP_INNER_RADIUS = 20
const TRACK_OUTER_RADIUS = 60

// 바람 이벤트
const WIND_EVENT_DURATION = 5
const WIND_BOOST_MULTIPLIER = 2

// ==================== Main Component ====================
export default function WindTurbineGame({ isOpen, onClose, onEarnExp }: WindTurbineGameProps) {
  // === React State (UI 전환용만) ===
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [showStartGuide, setShowStartGuide] = useState(true)
  const [windEventActive, setWindEventActive] = useState(false)
  const [showWrongDirection, setShowWrongDirection] = useState(false)
  const [finalStats, setFinalStats] = useState({ spins: 0, maxRpm: 0, exp: 0, mwh: 0 })

  // === Refs for 60fps Animation (No Re-render) ===
  const containerRef = useRef<HTMLDivElement>(null)
  const bladesRef = useRef<HTMLDivElement>(null)
  const rpmBarRef = useRef<HTMLDivElement>(null)
  const rpmTextRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<HTMLParagraphElement>(null)
  const spinsRef = useRef<HTMLParagraphElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  // === Game State Refs ===
  const rotationRef = useRef(0)
  const velocityRef = useRef(0)
  const totalRotationRef = useRef(0)
  const maxRpmRef = useRef(0)
  const timeLeftRef = useRef(GAME_DURATION)
  const comboTimeRef = useRef(0)
  const lastAngleRef = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const animationRef = useRef<number>()
  const timerIntervalRef = useRef<NodeJS.Timeout>()

  // Wind event refs
  const windEventTimeRef = useRef<number | null>(null)
  const windEventUsedRef = useRef(false)
  const windActiveRef = useRef(false)

  // ==================== 좌표 계산 (iOS 최적화) ====================
  const getCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { dist: 0, angle: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy) / (rect.width / 2) * 100
    const angle = -Math.atan2(dy, dx) * (180 / Math.PI)
    return { dist, angle }
  }, [])

  // ==================== Pointer Events ====================
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing') return
    e.preventDefault()

    const { dist, angle } = getCoords(e.clientX, e.clientY)
    if (dist < SNAP_INNER_RADIUS || dist > TRACK_OUTER_RADIUS) return

    navigator.vibrate?.([10])
    containerRef.current?.setPointerCapture(e.pointerId)
    pointerIdRef.current = e.pointerId
    lastAngleRef.current = angle
    isDraggingRef.current = true
    setShowStartGuide(false)
  }, [gameState, getCoords])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
    if (delta > 0.5) {
      const boost = windActiveRef.current ? WIND_BOOST_MULTIPLIER : 1
      velocityRef.current += delta * 0.8 * boost
    } else if (delta < -3) {
      velocityRef.current *= 0.5
      setShowWrongDirection(true)
      navigator.vibrate?.([20])
      setTimeout(() => setShowWrongDirection(false), 200)
    }

    lastAngleRef.current = angle
  }, [getCoords])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    containerRef.current?.releasePointerCapture(e.pointerId)
    pointerIdRef.current = null
    lastAngleRef.current = null
    isDraggingRef.current = false
  }, [])

  // ==================== 60fps Game Loop (No setState) ====================
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return

    // 물리 계산
    velocityRef.current *= FRICTION
    if (Math.abs(velocityRef.current) < 0.2) velocityRef.current = 0

    rotationRef.current -= velocityRef.current
    totalRotationRef.current += Math.abs(velocityRef.current)

    const rpm = Math.min(Math.abs(velocityRef.current) * 10, MAX_RPM)
    if (rpm > maxRpmRef.current) maxRpmRef.current = rpm

    // 콤보
    const inCombo = (rpm / MAX_RPM) * 100 >= COMBO_ZONE_THRESHOLD
    if (inCombo && rpm > 50) {
      comboTimeRef.current += 1 / 60
    } else {
      comboTimeRef.current = 0
    }

    // === Direct DOM Updates (No Re-render) ===
    if (bladesRef.current) {
      bladesRef.current.style.transform = `rotate(${rotationRef.current}deg)`
    }
    if (rpmBarRef.current) {
      const pct = Math.min((rpm / MAX_RPM) * 100, 100)
      rpmBarRef.current.style.width = `${pct}%`
      rpmBarRef.current.style.background = rpm > 175 ? 'linear-gradient(90deg, #EF4444, #FF6B6B)'
        : rpm > 100 ? 'linear-gradient(90deg, #FBBF24, #F97316)'
        : 'linear-gradient(90deg, #00D4FF, #0EA5E9)'
    }
    if (rpmTextRef.current) {
      rpmTextRef.current.textContent = Math.floor(rpm).toString()
    }
    if (spinsRef.current) {
      spinsRef.current.textContent = Math.floor(totalRotationRef.current / 360).toString()
    }
    if (comboRef.current) {
      const combo = Math.floor(comboTimeRef.current)
      comboRef.current.textContent = combo > 0 ? `${combo}s` : '-'
      comboRef.current.style.color = combo >= 30 ? '#EF4444' : combo >= 10 ? '#FBBF24' : '#94a3b8'
    }

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameState])

  // ==================== Timer & Wind Event ====================
  useEffect(() => {
    if (gameState !== 'playing') return

    // Wind event 시간 설정
    if (!windEventUsedRef.current && windEventTimeRef.current === null) {
      windEventTimeRef.current = GAME_DURATION - (Math.random() * 30 + 15)
    }

    timerIntervalRef.current = setInterval(() => {
      timeLeftRef.current -= 1

      if (timerRef.current) {
        timerRef.current.textContent = `${timeLeftRef.current}s`
        timerRef.current.style.color = timeLeftRef.current <= 10 ? '#EF4444' : '#ffffff'
      }

      // Wind event 체크
      const windTime = windEventTimeRef.current
      if (windTime && !windEventUsedRef.current) {
        if (timeLeftRef.current <= windTime && timeLeftRef.current > windTime - WIND_EVENT_DURATION) {
          if (!windActiveRef.current) {
            windActiveRef.current = true
            setWindEventActive(true)
            navigator.vibrate?.([100, 50, 100])
          }
        } else if (timeLeftRef.current <= windTime - WIND_EVENT_DURATION && windActiveRef.current) {
          windActiveRef.current = false
          windEventUsedRef.current = true
          setWindEventActive(false)
        }
      }

      if (timeLeftRef.current <= 0) {
        clearInterval(timerIntervalRef.current)
        if (animationRef.current) cancelAnimationFrame(animationRef.current)

        const spins = Math.floor(totalRotationRef.current / 360)
        const exp = Math.floor(spins / SPINS_PER_EXP)
        setFinalStats({
          spins,
          maxRpm: Math.floor(maxRpmRef.current),
          exp,
          mwh: Math.floor(spins * 0.001 * 100) / 100
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

  // Touch event blocking for iOS
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

  // ==================== Game Control ====================
  const startGame = () => {
    rotationRef.current = 0
    velocityRef.current = 0
    totalRotationRef.current = 0
    maxRpmRef.current = 0
    timeLeftRef.current = GAME_DURATION
    comboTimeRef.current = 0
    windEventTimeRef.current = null
    windEventUsedRef.current = false
    windActiveRef.current = false
    setShowStartGuide(true)
    setWindEventActive(false)
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
        {windEventActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="absolute h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-wind"
                style={{
                  top: `${10 + i * 8}%`,
                  left: '-20%',
                  width: '40%',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Wrong Direction Flash */}
        {showWrongDirection && (
          <div className="absolute inset-0 bg-orange-500/30 pointer-events-none z-10" />
        )}

        {/* Main Container */}
        <motion.div
          className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          style={{ boxShadow: windEventActive ? '0 0 80px #00FF8840' : '0 0 40px #00D4FF20' }}
        >
          {gameState !== 'playing' && (
            <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-400">
              <X className="w-6 h-6" />
            </button>
          )}

          <div className="p-4 border-b border-white/10 text-center">
            <div className="flex items-center gap-2 justify-center">
              <Wind className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">풍력 끙차돌리기</h2>
            </div>
          </div>

          {/* Ready */}
          {gameState === 'ready' && (
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <RotateCcw className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">반시계방향으로 돌려라!</h3>
              <p className="text-slate-400 text-sm mb-4">
                빨간 트랙 위를 <span className="text-cyan-400">반시계방향</span>으로 스와이프!
              </p>
              <button
                onClick={startGame}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold text-lg"
              >
                게임 시작!
              </button>
            </div>
          )}

          {/* Playing */}
          {gameState === 'playing' && (
            <div className="p-4">
              {/* Stats */}
              <div className="flex justify-between items-center mb-3">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">남은 시간</p>
                  <p ref={timerRef} className="text-xl font-bold text-white">{GAME_DURATION}s</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">콤보</p>
                  <p ref={comboRef} className="text-lg font-bold text-slate-400">-</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">회전수</p>
                  <p ref={spinsRef} className="text-xl font-bold text-cyan-400">0</p>
                </div>
              </div>

              {/* Wind Banner */}
              {windEventActive && (
                <div className="mb-3 py-2 rounded-xl bg-green-500/20 border border-green-400/50 text-center">
                  <span className="text-green-400 font-bold">🌪️ WIND BOOST x2!</span>
                </div>
              )}

              {/* RPM Gauge */}
              <div className="mb-3 bg-slate-800/50 rounded-xl p-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-400">RPM</span>
                  <span ref={rpmTextRef} className="text-sm font-bold text-cyan-400">0</span>
                </div>
                <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    ref={rpmBarRef}
                    className="h-full rounded-full transition-none"
                    style={{ width: '0%', willChange: 'width, background' }}
                  />
                </div>
              </div>

              {/* Turbine Container */}
              <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-2xl bg-slate-900/50 overflow-hidden select-none"
                style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {/* Track (빨간 도넛) */}
                <div
                  className="absolute rounded-full border-[12px] pointer-events-none"
                  style={{
                    left: `${50 - TRACK_OUTER_RADIUS}%`,
                    top: `${50 - TRACK_OUTER_RADIUS}%`,
                    width: `${TRACK_OUTER_RADIUS * 2}%`,
                    height: `${TRACK_OUTER_RADIUS * 2}%`,
                    borderColor: isDraggingRef.current ? '#FF6B6B' : '#EF444480',
                  }}
                />
                <div
                  className="absolute rounded-full border-4 border-dashed pointer-events-none"
                  style={{
                    left: `${50 - SNAP_INNER_RADIUS}%`,
                    top: `${50 - SNAP_INNER_RADIUS}%`,
                    width: `${SNAP_INNER_RADIUS * 2}%`,
                    height: `${SNAP_INNER_RADIUS * 2}%`,
                    borderColor: '#64748b40',
                  }}
                />

                {/* Tower */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                  <path d="M48 50 L46 90 L54 90 L52 50 Z" fill="#94a3b8" />
                  <ellipse cx="50" cy="50" rx="6" ry="2.5" fill="#64748b" />
                </svg>

                {/* Blades (GPU 가속) */}
                <div
                  ref={bladesRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotate(0deg)',
                  }}
                >
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="bg" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>
                    {[0, 120, 240].map((a, i) => (
                      <g key={i} transform={`rotate(${a} 50 50)`}>
                        <path d="M49 50 L46 15 Q50 10 54 15 L51 50 Z" fill="url(#bg)" />
                      </g>
                    ))}
                    <circle cx="50" cy="50" r="5" fill="#334155" stroke="#60a5fa" strokeWidth="2" />
                  </svg>
                </div>

                {/* Start Guide */}
                {showStartGuide && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="animate-pulse text-center">
                      <RotateCcw className="w-12 h-12 text-cyan-400 mx-auto mb-2" />
                      <p className="text-cyan-400 text-sm font-bold">반시계방향!</p>
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

              <div className="bg-white/5 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">총 회전수</p>
                  <p className="text-lg font-bold text-cyan-400">{finalStats.spins}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">최고 RPM</p>
                  <p className="text-lg font-bold text-yellow-400">{finalStats.maxRpm}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">총 발전량</p>
                  <p className="text-lg font-bold text-blue-400">{finalStats.mwh} MWh</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <p className="text-[10px] text-slate-500">획득 EXP</p>
                  <p className="text-lg font-bold text-orange-400">{finalStats.exp}</p>
                </div>
              </div>

              <button
                onClick={handleRecord}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold mb-2"
              >
                <BookOpen className="w-5 h-5 inline mr-2" />
                기록하기 (+{finalStats.exp} EXP)
              </button>
              <button
                onClick={startGame}
                className="w-full py-2.5 rounded-xl bg-white/10 text-slate-300"
              >
                다시 하기
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes wind {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(150vw); opacity: 0; }
        }
        .animate-wind { animation: wind 1.5s linear infinite; }
      `}</style>
    </AnimatePresence>
  )
}
