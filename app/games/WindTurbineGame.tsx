'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wind, Trophy, BookOpen, Flame, RotateCcw } from 'lucide-react'

// ==================== Types ====================
interface WindTurbineGameProps {
  isOpen: boolean
  onClose: () => void
  onEarnExp: (exp: number) => void
}

interface Spark {
  id: number
  x: number
  y: number
}

interface WindParticle {
  id: number
  y: number
  delay: number
}

interface GameStats {
  totalSpins: number
  maxRpm: number
  maxCombo: number
  deviations: number
  windBoostUsage: number
  totalMWh: number
}

// ==================== Constants ====================
const GAME_DURATION = 60
const FRICTION = 0.94
const MIN_RPM_FOR_COMBO = 50
const SPINS_PER_EXP = 1000
const COMBO_ZONE_THRESHOLD = 70
const MAX_RPM = 250

// 트랙 & 히트박스 설정 - 1.2배 확장
const BLADE_LENGTH_PERCENT = 38
const HITBOX_MULTIPLIER = 1.2 // 히트박스 1.2배 확장
const TRACK_INNER_RADIUS = BLADE_LENGTH_PERCENT * 0.5
const TRACK_OUTER_RADIUS = BLADE_LENGTH_PERCENT * HITBOX_MULTIPLIER

// 바람 이벤트
const WIND_EVENT_MIN_TIME = 10
const WIND_EVENT_MAX_TIME = 50
const WIND_EVENT_DURATION = 5
const WIND_BOOST_MULTIPLIER = 2

const COMBO_TIERS = [
  { time: 50, multiplier: 3, color: '#EF4444', name: 'OVERLOAD!', glow: true },
  { time: 30, multiplier: 2, color: '#F97316', name: 'TURBO!' },
  { time: 10, multiplier: 1.5, color: '#FBBF24', name: 'COMBO!' },
]

const getTitleByStats = (stats: GameStats): { title: string; rank: string; color: string } => {
  const score = stats.totalSpins * (1 + stats.maxCombo * 0.01) - stats.deviations * 10 + stats.windBoostUsage
  if (score >= 600 && stats.deviations <= 2 && stats.windBoostUsage >= 80) {
    return { title: '바람의 지배자', rank: '상위 0.1%', color: '#FF6B6B' }
  } else if (score >= 400 && stats.deviations <= 3) {
    return { title: '전설의 발전기 마스터', rank: '상위 1%', color: '#FFD700' }
  } else if (score >= 250 && stats.deviations <= 5) {
    return { title: '숙련된 운전원', rank: '상위 10%', color: '#C0C0C0' }
  } else if (score >= 100) {
    return { title: '유망한 신입', rank: '상위 30%', color: '#CD7F32' }
  }
  return { title: '견습 운전원', rank: '열심히 하세요!', color: '#00D4FF' }
}

// ==================== Main Component ====================
export default function WindTurbineGame({ isOpen, onClose, onEarnExp }: WindTurbineGameProps) {
  // Game state
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [rotation, setRotation] = useState(0)
  const [rpm, setRpm] = useState(0)
  const [totalSpins, setTotalSpins] = useState(0)
  const [comboTime, setComboTime] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [earnedExp, setEarnedExp] = useState(0)
  const [sparks, setSparks] = useState<Spark[]>([])
  const [shake, setShake] = useState(false)
  const [showWrongDirection, setShowWrongDirection] = useState(false)
  const [goldenGlow, setGoldenGlow] = useState(false)

  // Guide state
  const [showStartGuide, setShowStartGuide] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // Wind event
  const [windEventActive, setWindEventActive] = useState(false)
  const [windEventUsed, setWindEventUsed] = useState(false)
  const [windEventTime, setWindEventTime] = useState<number | null>(null)
  const [windParticles, setWindParticles] = useState<WindParticle[]>([])
  const [windBoostSpins, setWindBoostSpins] = useState(0)

  // Stats
  const [gameStats, setGameStats] = useState<GameStats>({
    totalSpins: 0, maxRpm: 0, maxCombo: 0, deviations: 0, windBoostUsage: 0, totalMWh: 0,
  })

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const angularVelocityRef = useRef(0)
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const totalRotationRef = useRef(0)
  const comboCountRef = useRef(0)
  const windBoostSpinsRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  // ==================== Pointer Helpers ====================
  const getAngleFromCenter = useCallback((clientX: number, clientY: number): number => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    // 반시계방향을 위해 음수 처리
    return -Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI)
  }, [])

  const getDistancePercent = useCallback((clientX: number, clientY: number): number => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = clientX - centerX
    const dy = clientY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxRadius = rect.width / 2
    return (distance / maxRadius) * 100
  }, [])

  const isInHitbox = useCallback((clientX: number, clientY: number): boolean => {
    const dist = getDistancePercent(clientX, clientY)
    return dist >= TRACK_INNER_RADIUS && dist <= TRACK_OUTER_RADIUS
  }, [getDistancePercent])

  // ==================== Pointer Events (Unified) ====================
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing') return
    e.preventDefault()
    e.stopPropagation()

    const { clientX, clientY, pointerId } = e

    // 히트박스 체크 (넓은 영역)
    if (!isInHitbox(clientX, clientY)) return

    // Pointer Capture - 드래그가 영역 밖으로 나가도 유지
    if (containerRef.current) {
      containerRef.current.setPointerCapture(pointerId)
    }

    pointerIdRef.current = pointerId
    lastAngleRef.current = getAngleFromCenter(clientX, clientY)
    setIsDragging(true)
    setShowStartGuide(false)
  }, [gameState, isInHitbox, getAngleFromCenter])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (gameState !== 'playing' || !isDragging) return
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()

    const { clientX, clientY } = e
    const currentAngle = getAngleFromCenter(clientX, clientY)

    if (lastAngleRef.current !== null) {
      let deltaAngle = currentAngle - lastAngleRef.current

      // 각도 래핑 처리 (-180 ~ 180)
      if (deltaAngle > 180) deltaAngle -= 360
      if (deltaAngle < -180) deltaAngle += 360

      // 반시계방향(CCW) = 양수 deltaAngle
      if (deltaAngle > 0) {
        // 반시계방향 - 가속!
        const boost = windEventActive ? WIND_BOOST_MULTIPLIER : 1
        angularVelocityRef.current += deltaAngle * 0.6 * boost
        setShowWrongDirection(false)
      } else if (deltaAngle < -5) {
        // 시계방향 - 저항 (강한 감속)
        angularVelocityRef.current *= 0.7
        setShowWrongDirection(true)
        setTimeout(() => setShowWrongDirection(false), 300)
      }
    }

    lastAngleRef.current = currentAngle
  }, [gameState, isDragging, getAngleFromCenter, windEventActive])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return

    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId)
    }

    pointerIdRef.current = null
    lastAngleRef.current = null
    setIsDragging(false)
  }, [])

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e)
  }, [handlePointerUp])

  // ==================== Game Loop ====================
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const deltaTime = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      // 마찰 적용 (손을 뗐을 때 빠르게 감속)
      angularVelocityRef.current *= FRICTION

      if (Math.abs(angularVelocityRef.current) < 0.3) {
        angularVelocityRef.current = 0
      }

      // 회전 업데이트 (반시계방향 = 음수 회전)
      const newRotation = rotation - angularVelocityRef.current
      setRotation(newRotation)

      // 총 회전수 누적
      totalRotationRef.current += Math.abs(angularVelocityRef.current)
      setTotalSpins(totalRotationRef.current / 360)

      // RPM 계산
      const currentRpm = Math.min(Math.abs(angularVelocityRef.current) * 10, MAX_RPM)
      setRpm(currentRpm)

      // 최고 RPM 업데이트
      if (currentRpm > gameStats.maxRpm) {
        setGameStats(prev => ({ ...prev, maxRpm: Math.floor(currentRpm) }))
      }

      // 콤보 시스템
      const inComboZone = (currentRpm / MAX_RPM) * 100 >= COMBO_ZONE_THRESHOLD
      if (currentRpm >= MIN_RPM_FOR_COMBO && inComboZone) {
        setComboTime(prev => prev + deltaTime)
        const newComboCount = Math.floor(comboTime + deltaTime)
        if (newComboCount > comboCountRef.current) {
          comboCountRef.current = newComboCount
          setComboCount(newComboCount)
          if (newComboCount >= 50 && !goldenGlow) {
            setGoldenGlow(true)
            navigator.vibrate?.([100, 50, 100])
          }
          if (newComboCount > gameStats.maxCombo) {
            setGameStats(prev => ({ ...prev, maxCombo: newComboCount }))
          }
        }
      } else if (comboTime > 0) {
        setComboTime(0)
        setComboCount(0)
        comboCountRef.current = 0
        setGoldenGlow(false)
      }

      // 스파크 효과
      if (currentRpm > 150 && Math.random() < 0.4) {
        const angle = Math.random() * 360
        setSparks(prev => [...prev.slice(-12), {
          id: Date.now() + Math.random(),
          x: 50 + Math.cos(angle * Math.PI / 180) * BLADE_LENGTH_PERCENT,
          y: 50 + Math.sin(angle * Math.PI / 180) * BLADE_LENGTH_PERCENT,
        }])
        if (currentRpm > 200 && !shake) {
          setShake(true)
          setTimeout(() => setShake(false), 100)
        }
      }

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    animationRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [gameState, rotation, shake, comboTime, goldenGlow, gameStats.maxRpm, gameStats.maxCombo])

  // ==================== Timer ====================
  useEffect(() => {
    if (gameState !== 'playing') return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('finished')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [gameState])

  // ==================== Wind Event ====================
  useEffect(() => {
    if (gameState === 'playing' && !windEventUsed && windEventTime === null) {
      const randomTime = Math.floor(Math.random() * (WIND_EVENT_MAX_TIME - WIND_EVENT_MIN_TIME)) + WIND_EVENT_MIN_TIME
      setWindEventTime(GAME_DURATION - randomTime)
    }
  }, [gameState, windEventUsed, windEventTime])

  useEffect(() => {
    if (gameState !== 'playing' || windEventTime === null || windEventUsed) return

    if (timeLeft <= windEventTime && timeLeft > windEventTime - WIND_EVENT_DURATION) {
      if (!windEventActive) {
        setWindEventActive(true)
        windBoostSpinsRef.current = totalRotationRef.current
        setWindParticles(Array.from({ length: 15 }, (_, i) => ({
          id: Date.now() + i,
          y: Math.random() * 100,
          delay: Math.random() * 0.3,
        })))
        navigator.vibrate?.([200, 100, 200])
      }
    } else if (timeLeft <= windEventTime - WIND_EVENT_DURATION && windEventActive) {
      setWindEventActive(false)
      setWindEventUsed(true)
      setWindParticles([])
      setWindBoostSpins(totalRotationRef.current - windBoostSpinsRef.current)
    }
  }, [timeLeft, windEventTime, windEventActive, windEventUsed, gameState])

  // ==================== Final Stats ====================
  useEffect(() => {
    if (gameState === 'finished') {
      const comboTier = COMBO_TIERS.find(t => comboTime >= t.time)
      const multiplier = comboTier?.multiplier || 1
      const baseExp = Math.floor(totalSpins / SPINS_PER_EXP)
      const comboBonus = Math.floor(gameStats.maxCombo / 10)
      const finalExp = Math.max(0, Math.floor((baseExp + comboBonus) * multiplier))

      const maxWindSpins = WIND_EVENT_DURATION * 60 * WIND_BOOST_MULTIPLIER
      const windUsage = windEventUsed ? Math.min(100, Math.floor((windBoostSpins / 360 / maxWindSpins) * 100 * 50)) : 0
      const totalMWh = Math.floor(totalSpins * 0.001 * 100) / 100

      setEarnedExp(finalExp)
      setGameStats(prev => ({ ...prev, totalSpins: Math.floor(totalSpins), windBoostUsage: windUsage, totalMWh }))
    }
  }, [gameState, totalSpins, comboTime, gameStats.maxCombo, windEventUsed, windBoostSpins])

  // ==================== Game Control ====================
  const startGame = () => {
    setGameState('playing')
    setTimeLeft(GAME_DURATION)
    setRotation(0)
    setRpm(0)
    setTotalSpins(0)
    setComboTime(0)
    setComboCount(0)
    setEarnedExp(0)
    setSparks([])
    setGoldenGlow(false)
    setShowStartGuide(true)
    setIsDragging(false)
    setWindEventActive(false)
    setWindEventUsed(false)
    setWindEventTime(null)
    setWindParticles([])
    setWindBoostSpins(0)
    setGameStats({ totalSpins: 0, maxRpm: 0, maxCombo: 0, deviations: 0, windBoostUsage: 0, totalMWh: 0 })
    angularVelocityRef.current = 0
    totalRotationRef.current = 0
    lastTimeRef.current = 0
    comboCountRef.current = 0
    windBoostSpinsRef.current = 0
    lastAngleRef.current = null
    pointerIdRef.current = null
  }

  const handleRecordExp = () => {
    if (earnedExp > 0) onEarnExp(earnedExp)
    onClose()
    setGameState('ready')
  }

  // ==================== Visual Helpers ====================
  const getBlurIntensity = () => {
    if (rpm < 50) return 0
    if (rpm < 100) return 1
    if (rpm < 150) return 2
    if (rpm < 200) return 4
    return 6
  }

  const getGlowColor = () => {
    if (windEventActive) return '#00FF88'
    if (goldenGlow) return '#FFD700'
    if (rpm > 200) return '#EF4444'
    if (rpm > 150) return '#F97316'
    if (rpm > 100) return '#FBBF24'
    return '#00D4FF'
  }

  const rpmPercent = Math.min((rpm / MAX_RPM) * 100, 100)
  const inComboZone = rpmPercent >= COMBO_ZONE_THRESHOLD
  const comboTier = COMBO_TIERS.find(t => comboTime >= t.time)
  const titleInfo = gameState === 'finished' ? getTitleByStats(gameStats) : null

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[700] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          onClick={gameState === 'ready' ? onClose : undefined}
        />

        {/* Wind Particles */}
        <AnimatePresence>
          {windEventActive && windParticles.map(p => (
            <motion.div
              key={p.id}
              className="absolute left-0 w-24 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent z-20 pointer-events-none"
              style={{ top: `${p.y}%` }}
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '100vw', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, delay: p.delay, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </AnimatePresence>

        {/* Wrong Direction Flash */}
        <AnimatePresence>
          {showWrongDirection && (
            <motion.div
              className="absolute inset-0 bg-orange-500/20 z-10 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Game Container */}
        <motion.div
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 ${shake ? 'animate-shake' : ''}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          style={{
            boxShadow: windEventActive
              ? '0 0 100px rgba(0, 255, 136, 0.6)'
              : goldenGlow
              ? '0 0 80px rgba(255, 215, 0, 0.6)'
              : `0 0 60px ${getGlowColor()}40`,
          }}
        >
          {gameState !== 'playing' && (
            <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          )}

          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 justify-center">
              <Wind className="w-6 h-6 text-kepco-cyan" />
              <h2 className="text-xl font-bold text-white">풍력 끙차돌리기</h2>
            </div>
          </div>

          {/* Ready State */}
          {gameState === 'ready' && (
            <motion.div className="p-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-kepco-blue to-kepco-cyan flex items-center justify-center">
                <RotateCcw className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">반시계방향으로 돌려라!</h3>
              <p className="text-slate-400 mb-4 text-sm">
                트랙 영역을 터치하고 <span className="text-cyan-400 font-bold">반시계방향</span>으로 스와이프!<br />
                <span className="text-green-400">돌풍 이벤트</span>를 놓치지 마세요!
              </p>

              <div className="bg-white/5 rounded-xl p-4 mb-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400">반시계방향</span>
                  <span className="text-slate-400">- 이 방향으로만 가속!</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-green-400">돌풍 이벤트</span>
                  <span className="text-slate-400">- 5초간 RPM 2배!</span>
                </div>
              </div>

              <motion.button
                className="w-full py-4 rounded-xl bg-gradient-to-r from-kepco-blue to-kepco-cyan text-white font-bold text-lg"
                onClick={startGame}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                게임 시작!
              </motion.button>
            </motion.div>
          )}

          {/* Playing State */}
          {gameState === 'playing' && (
            <div className="p-4">
              {/* Stats Bar */}
              <div className="flex justify-between items-center mb-3">
                <div className={`text-center ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                  <p className="text-[10px] text-slate-500">남은 시간</p>
                  <p className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>{timeLeft}s</p>
                </div>

                <div className="text-center">
                  {comboTier ? (
                    <motion.div
                      className="px-3 py-1 rounded-lg"
                      style={{ backgroundColor: `${comboTier.color}30` }}
                      animate={comboTier.glow ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.3, repeat: Infinity }}
                    >
                      <p className="text-[10px] font-bold" style={{ color: comboTier.color }}>{comboTier.name}</p>
                      <p className="text-lg font-black text-white">x{comboTier.multiplier}</p>
                    </motion.div>
                  ) : (
                    <div className="px-3 py-1">
                      <p className="text-[10px] text-slate-500">콤보</p>
                      <p className="text-lg font-bold text-slate-400">{comboCount}s</p>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-slate-500">회전수</p>
                  <p className="text-xl font-bold text-kepco-cyan">{Math.floor(totalSpins)}</p>
                </div>
              </div>

              {/* Wind Event Banner */}
              <AnimatePresence>
                {windEventActive && (
                  <motion.div
                    className="mb-3 py-2 px-4 rounded-xl bg-gradient-to-r from-green-500/30 via-emerald-500/30 to-green-500/30 border border-green-400/50"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <motion.div
                      className="flex items-center justify-center gap-2"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <Wind className="w-5 h-5 text-green-400" />
                      <span className="text-lg font-black text-green-400">WIND BOOST!</span>
                      <span className="text-sm text-white">x2</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* RPM Gauge */}
              <div className="mb-3 bg-slate-800/50 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4" style={{ color: getGlowColor() }} />
                    <span className="text-xs text-slate-400">RPM</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: getGlowColor() }}>{Math.floor(rpm)}</span>
                </div>
                <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="absolute right-0 h-full bg-yellow-500/20 border-l-2 border-yellow-500/50"
                    style={{ width: `${100 - COMBO_ZONE_THRESHOLD}%` }}
                  />
                  <motion.div
                    className="absolute left-0 h-full rounded-full"
                    style={{
                      width: `${rpmPercent}%`,
                      background: windEventActive
                        ? 'linear-gradient(90deg, #00FF88, #00D4FF)'
                        : `linear-gradient(90deg, #00D4FF, ${getGlowColor()})`,
                      boxShadow: `0 0 15px ${getGlowColor()}`,
                    }}
                  />
                  {inComboZone && (
                    <motion.div
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-yellow-400"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      COMBO!
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Turbine Container - Pointer Events */}
              <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-2xl bg-slate-900/50 border border-white/5 overflow-hidden"
                style={{
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerUp}
              >
                {/* Background Glow */}
                <div
                  className="absolute inset-0 rounded-full opacity-30"
                  style={{ background: `radial-gradient(circle, ${getGlowColor()}40 0%, transparent 70%)` }}
                />

                {/* Hitbox Track (확장된 터치 영역) */}
                <div
                  className="absolute rounded-full border-4 border-dashed transition-colors duration-300"
                  style={{
                    left: `${50 - TRACK_OUTER_RADIUS}%`,
                    top: `${50 - TRACK_OUTER_RADIUS}%`,
                    width: `${TRACK_OUTER_RADIUS * 2}%`,
                    height: `${TRACK_OUTER_RADIUS * 2}%`,
                    borderColor: isDragging ? `${getGlowColor()}80` : `${getGlowColor()}30`,
                    boxShadow: isDragging ? `0 0 30px ${getGlowColor()}40` : 'none',
                  }}
                />
                <div
                  className="absolute rounded-full border-2 border-dashed"
                  style={{
                    left: `${50 - TRACK_INNER_RADIUS}%`,
                    top: `${50 - TRACK_INNER_RADIUS}%`,
                    width: `${TRACK_INNER_RADIUS * 2}%`,
                    height: `${TRACK_INNER_RADIUS * 2}%`,
                    borderColor: `${getGlowColor()}20`,
                  }}
                />

                {/* Sparks */}
                {sparks.map(spark => (
                  <motion.div
                    key={spark.id}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      left: `${spark.x}%`,
                      top: `${spark.y}%`,
                      backgroundColor: getGlowColor(),
                      boxShadow: `0 0 10px ${getGlowColor()}`,
                    }}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                ))}

                {/* Tower (Fixed) */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="towerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="50%" stopColor="#f1f5f9" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <filter id="shadow">
                      <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  <path d="M48 50 L46 88 L54 88 L52 50 Z" fill="url(#towerGrad)" filter="url(#shadow)" />
                  <ellipse cx="50" cy="50" rx="7" ry="3" fill="#64748b" />
                </svg>

                {/* Rotating Blades */}
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center 50%',
                    filter: `blur(${getBlurIntensity()}px)`,
                  }}
                >
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="bladeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor={getGlowColor()} stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#ffffff" />
                      </linearGradient>
                      <filter id="bladeGlow">
                        <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={getGlowColor()} floodOpacity="0.5" />
                      </filter>
                    </defs>
                    {[0, 120, 240].map((angle, i) => (
                      <g key={i} transform={`rotate(${angle} 50 50)`}>
                        <path
                          d={`M49 50 L46 ${50 - BLADE_LENGTH_PERCENT} Q50 ${50 - BLADE_LENGTH_PERCENT - 4} 54 ${50 - BLADE_LENGTH_PERCENT} L51 50 Z`}
                          fill="url(#bladeGrad)"
                          filter={rpm > 80 ? 'url(#bladeGlow)' : undefined}
                        />
                      </g>
                    ))}
                    <circle cx="50" cy="50" r="6" fill="#334155" stroke={getGlowColor()} strokeWidth="2" />
                    <circle cx="50" cy="50" r="2.5" fill={getGlowColor()} />
                  </svg>
                </div>

                {/* Start Guide with CCW Arrow */}
                <AnimatePresence>
                  {showStartGuide && gameState === 'playing' && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {/* CCW Arrow Animation */}
                      <motion.div
                        className="absolute"
                        style={{
                          width: `${TRACK_OUTER_RADIUS * 1.8}%`,
                          height: `${TRACK_OUTER_RADIUS * 1.8}%`,
                        }}
                        animate={{ rotate: -360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill="#00D4FF" />
                            </marker>
                          </defs>
                          <path
                            d="M 50 5 A 45 45 0 1 0 95 50"
                            fill="none"
                            stroke="#00D4FF"
                            strokeWidth="3"
                            strokeDasharray="8 4"
                            markerEnd="url(#arrowhead)"
                            opacity="0.8"
                          />
                        </svg>
                      </motion.div>

                      {/* Touch Point Indicator */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: `${50 - BLADE_LENGTH_PERCENT - 8}%` }}
                        animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <motion.div
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center"
                          animate={{ boxShadow: ['0 0 15px #00D4FF', '0 0 35px #00D4FF', '0 0 15px #00D4FF'] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <RotateCcw className="w-6 h-6 text-white" />
                        </motion.div>
                        <p className="text-xs text-cyan-400 mt-2 font-bold whitespace-nowrap">반시계방향!</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Drag Feedback */}
                {isDragging && (
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs text-green-400 font-bold animate-pulse">드래그 중...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Finished State */}
          {gameState === 'finished' && (
            <motion.div className="p-6 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <motion.div
                className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${titleInfo?.color}, ${titleInfo?.color}80)` }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 360] }}
                transition={{ duration: 0.6 }}
              >
                <Trophy className="w-8 h-8 text-white" />
              </motion.div>

              <h3 className="text-xl font-bold text-white mb-1">게임 종료!</h3>
              {titleInfo && (
                <motion.div className="mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <p className="text-lg font-bold" style={{ color: titleInfo.color }}>"{titleInfo.title}"</p>
                  <p className="text-xs text-slate-400">{titleInfo.rank}</p>
                </motion.div>
              )}

              <div className="bg-white/5 rounded-xl p-4 mb-4 text-left">
                <p className="text-xs text-slate-500 mb-3 text-center font-medium">운전일지</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">총 회전수</p>
                    <p className="text-lg font-bold text-kepco-cyan">{gameStats.totalSpins}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">최고 RPM</p>
                    <p className="text-lg font-bold text-yellow-400">{gameStats.maxRpm}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">바람 활용도</p>
                    <p className="text-lg font-bold text-green-400">{gameStats.windBoostUsage}%</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">총 발전량</p>
                    <p className="text-lg font-bold text-blue-400">{gameStats.totalMWh} MWh</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">획득 EXP</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    {earnedExp} EXP
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <motion.button
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold flex items-center justify-center gap-2"
                  onClick={handleRecordExp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <BookOpen className="w-5 h-5" />
                  운전일지 기록 (+{earnedExp} EXP)
                </motion.button>
                <motion.button
                  className="w-full py-2.5 rounded-xl bg-white/10 text-slate-300 font-medium"
                  onClick={startGame}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  다시 하기
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.1s ease-in-out; }
      `}</style>
    </AnimatePresence>
  )
}
