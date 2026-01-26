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
const GAME_DURATION = 30 // 30초 버스트 모드
const SPINS_PER_EXP = 500 // 500바퀴당 1 EXP
const RPS_DISPLAY_BOOST = 1.2 // 시각적 보정 계수

// 플라이휠 물리 (20% 가속 상향)
const INERTIA = 0.15 // 0.12 → 0.15
const BASE_FRICTION = 0.97
const HIGH_SPEED_DRAG = 0.012
const MAX_RPS = 10

// 동적 콤보 기준 (최고 RPS 대비 %)
const COMBO_L1_RATIO = 0.80 // 80%
const COMBO_L2_RATIO = 0.90 // 90%
const COMBO_L3_RATIO = 0.95 // 95%

// 히트박스
const SNAP_INNER = 20
const TRACK_OUTER = 60

export default function WindTurbineGame({ isOpen, onClose, onEarnExp }: WindTurbineGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'finished'>('ready')
  const [countdown, setCountdown] = useState(3)
  const [showGuide, setShowGuide] = useState(true)
  const [comboLevel, setComboLevel] = useState(0)
  const [windActive, setWindActive] = useState(false)
  const [sparks, setSparks] = useState<{id: number, x: number, y: number}[]>([])
  const [finalStats, setFinalStats] = useState({ spins: 0, avgRps: 0, maxRps: 0, maxCombo: 0, exp: 0 })
  const [lastSpurt, setLastSpurt] = useState(false)

  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const bladesRef = useRef<HTMLDivElement>(null)
  const rpmBarRef = useRef<HTMLDivElement>(null)
  const rpmTextRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<HTMLParagraphElement>(null)
  const spinsRef = useRef<HTMLParagraphElement>(null)
  const comboGaugeRef = useRef<HTMLDivElement>(null)

  // Physics
  const rotationRef = useRef(0)
  const velocityRef = useRef(0)
  const torqueRef = useRef(0)
  const totalRotRef = useRef(0)
  const lastFrameRef = useRef(0)
  const timeLeftRef = useRef(GAME_DURATION)
  const lastAngleRef = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const animationRef = useRef<number>()
  const timerIntervalRef = useRef<NodeJS.Timeout>()

  // 동적 난이도용
  const maxRpsReachedRef = useRef(1) // 세션 최고 RPS (최소 1)
  const rpsHistoryRef = useRef<number[]>([])
  const comboStartRef = useRef<number | null>(null)
  const maxComboRef = useRef(0)

  // Wind (5~25초 사이 발생)
  const windActiveRef = useRef(false)
  const windTimeRef = useRef<number | null>(null)
  const windUsedRef = useRef(false)

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
    if (lastAngleRef.current === null) { lastAngleRef.current = angle; return }

    let delta = angle - lastAngleRef.current
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360

    if (delta > 0.2) {
      const boost = windActiveRef.current ? 2.5 : 1
      torqueRef.current += delta * INERTIA * boost
    } else if (delta < -2) {
      velocityRef.current *= 0.3
      torqueRef.current = 0
      navigator.vibrate?.([12])
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
  const gameLoop = useCallback((timestamp: number) => {
    if (gameState !== 'playing') return

    const dt = lastFrameRef.current ? Math.min((timestamp - lastFrameRef.current) / 16.67, 3) : 1
    lastFrameRef.current = timestamp

    // 물리
    velocityRef.current += torqueRef.current * 0.28 * dt // 20% 상향
    torqueRef.current *= Math.pow(0.5, dt)

    const realRps = Math.abs(velocityRef.current) / 6
    const drag = 1 - (HIGH_SPEED_DRAG * realRps * dt)
    velocityRef.current *= Math.pow(BASE_FRICTION, dt) * Math.max(drag, 0.92)

    if (Math.abs(velocityRef.current) < 0.05) velocityRef.current = 0

    rotationRef.current -= velocityRef.current * dt
    totalRotRef.current += Math.abs(velocityRef.current) * dt

    const currentRps = Math.min(realRps, MAX_RPS)
    rpsHistoryRef.current.push(currentRps)

    // 동적 난이도: 최고 RPS 갱신
    if (currentRps > maxRpsReachedRef.current) {
      maxRpsReachedRef.current = currentRps
    }

    // 동적 콤보 체크 (세션 최고 RPS 기준)
    const maxRps = maxRpsReachedRef.current
    let newCombo = 0
    if (currentRps >= maxRps * COMBO_L3_RATIO) newCombo = 3
    else if (currentRps >= maxRps * COMBO_L2_RATIO) newCombo = 2
    else if (currentRps >= maxRps * COMBO_L1_RATIO) newCombo = 1

    if (newCombo > 0) {
      if (comboStartRef.current === null) comboStartRef.current = Date.now()
      const comboTime = (Date.now() - comboStartRef.current) / 1000
      if (comboTime > maxComboRef.current) maxComboRef.current = comboTime
    } else {
      comboStartRef.current = null
    }

    if (newCombo !== comboLevel) {
      setComboLevel(newCombo)
      if (newCombo >= 2) navigator.vibrate?.([20, 10, 20])
    }

    // 전기 스파크 (L3)
    if (newCombo === 3 && Math.random() < 0.35) {
      const ang = Math.random() * 360
      const rad = 35 + Math.random() * 15
      setSparks(prev => [...prev.slice(-8), {
        id: Date.now() + Math.random(),
        x: 50 + Math.cos(ang * Math.PI / 180) * rad,
        y: 50 + Math.sin(ang * Math.PI / 180) * rad
      }])
    }

    // 시각적 RPS (1.2배 보정)
    const displayRps = currentRps * RPS_DISPLAY_BOOST

    // Direct DOM
    if (bladesRef.current) {
      const blur = displayRps > 6 ? 5 : displayRps > 4 ? 3 : displayRps > 2 ? 1 : 0
      bladesRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      bladesRef.current.style.filter = `blur(${blur}px)`
    }
    if (rpmBarRef.current) {
      const pct = (displayRps / (MAX_RPS * RPS_DISPLAY_BOOST)) * 100
      rpmBarRef.current.style.width = `${Math.min(pct, 100)}%`
      rpmBarRef.current.style.background = newCombo === 3 ? 'linear-gradient(90deg,#EF4444,#FF0000)'
        : newCombo === 2 ? 'linear-gradient(90deg,#F97316,#FBBF24)'
        : newCombo === 1 ? 'linear-gradient(90deg,#FBBF24,#FDE047)'
        : 'linear-gradient(90deg,#00D4FF,#0EA5E9)'
    }
    if (rpmTextRef.current) {
      rpmTextRef.current.textContent = displayRps.toFixed(1)
    }
    if (spinsRef.current) {
      spinsRef.current.textContent = Math.floor(totalRotRef.current / 360).toString()
    }
    if (comboGaugeRef.current) {
      // 게이지: 현재 RPS / 최고 RPS 비율
      const gauge = Math.min(100, (currentRps / maxRps) * 100)
      comboGaugeRef.current.style.width = `${gauge}%`
    }

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameState, comboLevel])

  // ==================== Countdown ====================
  useEffect(() => {
    if (gameState !== 'countdown') return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    } else {
      setTimeout(() => setGameState('playing'), 700)
    }
  }, [gameState, countdown])

  // ==================== Timer ====================
  useEffect(() => {
    if (gameState !== 'playing') return

    // Wind: 5~25초 사이 발생
    if (!windUsedRef.current && windTimeRef.current === null) {
      windTimeRef.current = GAME_DURATION - (Math.random() * 20 + 5)
    }

    lastFrameRef.current = 0
    timerIntervalRef.current = setInterval(() => {
      timeLeftRef.current -= 1

      // 라스트 스퍼트 (5초 미만)
      if (timeLeftRef.current <= 5 && !lastSpurt) {
        setLastSpurt(true)
        navigator.vibrate?.([50])
      }

      if (timerRef.current) {
        timerRef.current.textContent = `${timeLeftRef.current}s`
      }

      // Wind check
      const wt = windTimeRef.current
      if (wt && !windUsedRef.current) {
        if (timeLeftRef.current <= wt && timeLeftRef.current > wt - 5) {
          if (!windActiveRef.current) {
            windActiveRef.current = true
            setWindActive(true)
            navigator.vibrate?.([60, 30, 60])
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
          ? rpsHistoryRef.current.reduce((a, b) => a + b, 0) / rpsHistoryRef.current.length : 0
        const comboBonus = Math.floor(maxComboRef.current / 2)
        const exp = Math.floor(spins / SPINS_PER_EXP) + comboBonus

        setFinalStats({
          spins,
          avgRps: Math.round(avgRps * RPS_DISPLAY_BOOST * 10) / 10,
          maxRps: Math.round(maxRpsReachedRef.current * RPS_DISPLAY_BOOST * 10) / 10,
          maxCombo: Math.round(maxComboRef.current * 10) / 10,
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
  }, [gameState, gameLoop, lastSpurt])

  useEffect(() => {
    const el = containerRef.current
    if (!el || gameState !== 'playing') return
    const prevent = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => { el.removeEventListener('touchstart', prevent); el.removeEventListener('touchmove', prevent) }
  }, [gameState])

  const startCountdown = () => {
    rotationRef.current = 0; velocityRef.current = 0; torqueRef.current = 0
    totalRotRef.current = 0; maxRpsReachedRef.current = 1; rpsHistoryRef.current = []
    comboStartRef.current = null; maxComboRef.current = 0
    timeLeftRef.current = GAME_DURATION
    windTimeRef.current = null; windUsedRef.current = false; windActiveRef.current = false
    setShowGuide(true); setComboLevel(0); setWindActive(false); setSparks([]); setLastSpurt(false)
    setCountdown(3); setGameState('countdown')
  }

  const handleRecord = () => {
    if (finalStats.exp > 0) onEarnExp(finalStats.exp)
    onClose(); setGameState('ready')
  }

  if (!isOpen) return null

  const comboColors = ['#00D4FF', '#FBBF24', '#F97316', '#EF4444']
  const glowColor = comboColors[comboLevel]

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[700] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/90" onClick={gameState === 'ready' ? onClose : undefined} />

        {/* 카운트다운 */}
        <AnimatePresence>
          {gameState === 'countdown' && (
            <motion.div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
              <motion.div key={countdown}
                initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                animate={{ scale: 1.3, opacity: 1, rotate: 0 }}
                exit={{ scale: 3, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="text-[140px] font-black"
                style={{
                  color: countdown > 0 ? '#FFD700' : '#00FF88',
                  textShadow: `0 0 60px ${countdown > 0 ? '#FFD700' : '#00FF88'}, 0 0 120px ${countdown > 0 ? '#FF6B00' : '#00D4FF'}`
                }}>
                {countdown > 0 ? countdown : 'GO!'}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wind */}
        {windActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-wind"
                style={{ top: `${15 + i * 10}%`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Main */}
        <motion.div
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 ${comboLevel >= 2 ? 'animate-shake' : ''}`}
          initial={{ scale: 0.9 }} animate={{ scale: 1 }}
          style={{ boxShadow: `0 0 ${30 + comboLevel * 25}px ${glowColor}50` }}>

          {gameState === 'ready' && <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-400"><X className="w-6 h-6" /></button>}

          <div className="p-4 border-b border-white/10 text-center">
            <div className="flex items-center gap-2 justify-center">
              <Wind className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">풍력 끙차돌리기</h2>
              {comboLevel > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`text-xs font-bold px-2 py-0.5 rounded ${comboLevel === 3 ? 'bg-red-500/30 text-red-400' : comboLevel === 2 ? 'bg-orange-500/30 text-orange-400' : 'bg-yellow-500/30 text-yellow-400'}`}>
                  {comboLevel === 3 ? '⚡ x3.0!' : comboLevel === 2 ? '🔥 x2.0' : '✨ x1.5'}
                </motion.span>
              )}
            </div>
          </div>

          {/* Ready */}
          {gameState === 'ready' && (
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <RotateCcw className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">30초 버스트!</h3>
              <p className="text-slate-400 text-sm mb-2">자신의 최고 속도에 도전하세요</p>
              <div className="text-xs text-slate-500 mb-4 space-y-1">
                <p>✨ 최고속도 80% = <span className="text-yellow-400">x1.5</span></p>
                <p>🔥 최고속도 90% = <span className="text-orange-400">x2.0</span></p>
                <p>⚡ 최고속도 95% = <span className="text-red-400">x3.0</span></p>
              </div>
              <button onClick={startCountdown} className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold text-lg">
                게임 시작!
              </button>
            </div>
          )}

          {/* Playing */}
          {(gameState === 'playing' || gameState === 'countdown') && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">남은 시간</p>
                  <p ref={timerRef} className={`text-xl font-bold transition-colors ${lastSpurt ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {GAME_DURATION}s
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">배율</p>
                  <p className="text-lg font-bold" style={{ color: glowColor }}>
                    x{comboLevel === 3 ? '3.0' : comboLevel === 2 ? '2.0' : comboLevel === 1 ? '1.5' : '1.0'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">회전수</p>
                  <p ref={spinsRef} className="text-xl font-bold text-cyan-400">0</p>
                </div>
              </div>

              {windActive && (
                <div className="mb-2 py-1.5 rounded-lg bg-green-500/20 border border-green-400/50 text-center">
                  <span className="text-green-400 font-bold text-sm">🌪️ WIND x2.5</span>
                </div>
              )}

              <div className="mb-2 bg-slate-800/50 rounded-xl p-2">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-slate-400">RPS</span>
                  <span ref={rpmTextRef} className="text-sm font-bold" style={{ color: glowColor }}>0.0</span>
                </div>
                <div className="relative h-3 bg-slate-900 rounded-full overflow-hidden">
                  <div ref={rpmBarRef} className="absolute h-full rounded-full transition-none" style={{ width: '0%' }} />
                </div>
                <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div ref={comboGaugeRef} className="h-full rounded-full transition-all duration-100" style={{ width: '0%', background: glowColor }} />
                </div>
                <p className="text-[8px] text-slate-600 mt-0.5 text-center">콤보 게이지 (최고속도 대비)</p>
              </div>

              {/* Turbine */}
              <div ref={containerRef}
                className="relative w-full aspect-square rounded-2xl bg-slate-900/50 overflow-hidden select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
                onPointerCancel={onUp} onPointerLeave={onUp}>

                <div className="absolute rounded-full border-[8px] pointer-events-none transition-colors duration-200"
                  style={{
                    left: `${50 - TRACK_OUTER}%`, top: `${50 - TRACK_OUTER}%`,
                    width: `${TRACK_OUTER * 2}%`, height: `${TRACK_OUTER * 2}%`,
                    borderColor: `${glowColor}60`
                  }} />
                <div className="absolute rounded-full border-2 border-dashed border-slate-600/30 pointer-events-none"
                  style={{ left: `${50 - SNAP_INNER}%`, top: `${50 - SNAP_INNER}%`, width: `${SNAP_INNER * 2}%`, height: `${SNAP_INNER * 2}%` }} />

                <AnimatePresence>
                  {sparks.map(s => (
                    <motion.div key={s.id} className="absolute pointer-events-none"
                      initial={{ scale: 1, opacity: 1 }} animate={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.4 }} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                      <Zap className="w-5 h-5 text-yellow-300" style={{ filter: 'drop-shadow(0 0 10px #FFD700)' }} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="tw" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#cbd5e1" />
                      <stop offset="50%" stopColor="#f8fafc" />
                      <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>
                  </defs>
                  <path d="M48 52 L46 92 L54 92 L52 52 Z" fill="url(#tw)" />
                </svg>

                <div ref={bladesRef} className="absolute inset-0 pointer-events-none"
                  style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'rotate(0deg)' }}>
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="bl" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor={comboLevel >= 2 ? glowColor : '#e2e8f0'} />
                        <stop offset="100%" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>
                    {[0, 120, 240].map((a, i) => (
                      <g key={i} transform={`rotate(${a} 50 50)`}>
                        <path d="M49 50 L46 12 Q50 7 54 12 L51 50 Z" fill="url(#bl)" />
                      </g>
                    ))}
                    <circle cx="50" cy="50" r="5" fill="#f1f5f9" stroke={glowColor} strokeWidth="2" />
                  </svg>
                </div>

                {showGuide && gameState === 'playing' && (
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
              <h3 className="text-xl font-bold text-white mb-4">30초 완료!</h3>
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
                  <p className="text-lg font-bold text-orange-400">{finalStats.maxCombo}s</p>
                </div>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">획득 EXP</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    {finalStats.exp} EXP
                  </span>
                </div>
              </div>
              <button onClick={handleRecord} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold mb-2">
                <BookOpen className="w-5 h-5 inline mr-2" />기록하기
              </button>
              <button onClick={startCountdown} className="w-full py-2.5 rounded-xl bg-white/10 text-slate-300">다시 도전</button>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes wind{0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200vw);opacity:0}}
        .animate-wind{animation:wind 1.5s linear infinite;width:30%}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
        .animate-shake{animation:shake 0.08s ease-in-out infinite}
      `}</style>
    </AnimatePresence>
  )
}
