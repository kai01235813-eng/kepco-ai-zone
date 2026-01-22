'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Wind, Trophy, BookOpen, AlertTriangle, Flame, Award, Hand } from 'lucide-react'

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
  angle: number
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
  windBoostUsage: number // 바람 이벤트 활용도 (0~100%)
  totalMWh: number
}

// ==================== Constants ====================
const GAME_DURATION = 60
const FRICTION = 0.93
const MIN_RPM_FOR_COMBO = 50
const SPINS_PER_EXP = 1000
const COMBO_ZONE_THRESHOLD = 70
const MAX_RPM = 250

// 트랙 설정 - 날개 끝과 동기화
const BLADE_LENGTH_PERCENT = 38 // 날개 길이 (중심에서 %)
const TRACK_WIDTH = 12 // 트랙 두께 (%)
const TRACK_RADIUS = BLADE_LENGTH_PERCENT // 트랙 반경 = 날개 끝

// 바람 이벤트 설정
const WIND_EVENT_MIN_TIME = 10 // 시작 후 최소 10초
const WIND_EVENT_MAX_TIME = 50 // 종료 10초 전까지
const WIND_EVENT_DURATION = 5 // 5초간 지속
const WIND_BOOST_MULTIPLIER = 2 // RPM 효율 2배

const COMBO_TIERS = [
  { time: 50, multiplier: 3, color: '#EF4444', name: 'OVERLOAD!', glow: true },
  { time: 30, multiplier: 2, color: '#F97316', name: 'TURBO!' },
  { time: 10, multiplier: 1.5, color: '#FBBF24', name: 'COMBO!' },
]

// 칭호 시스템
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
  } else {
    return { title: '견습 운전원', rank: '열심히 하세요!', color: '#00D4FF' }
  }
}

// ==================== Wind Turbine Game Component ====================
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
  const [showDeviation, setShowDeviation] = useState(false)
  const [deviationFlash, setDeviationFlash] = useState(false)
  const [goldenGlow, setGoldenGlow] = useState(false)

  // 시작 가이드
  const [showStartGuide, setShowStartGuide] = useState(true)
  const [hasStartedDragging, setHasStartedDragging] = useState(false)

  // 바람 이벤트
  const [windEventActive, setWindEventActive] = useState(false)
  const [windEventUsed, setWindEventUsed] = useState(false)
  const [windEventTime, setWindEventTime] = useState<number | null>(null)
  const [windParticles, setWindParticles] = useState<WindParticle[]>([])
  const [windBoostSpins, setWindBoostSpins] = useState(0)

  // Stats tracking
  const [gameStats, setGameStats] = useState<GameStats>({
    totalSpins: 0,
    maxRpm: 0,
    maxCombo: 0,
    deviations: 0,
    windBoostUsage: 0,
    totalMWh: 0,
  })

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const totalRotationRef = useRef(0)
  const isInTrackRef = useRef(true)
  const comboCountRef = useRef(0)
  const windBoostSpinsRef = useRef(0)

  // Get current combo tier
  const getCurrentComboTier = useCallback(() => {
    for (const tier of COMBO_TIERS) {
      if (comboTime >= tier.time) return tier
    }
    return null
  }, [comboTime])

  // Calculate distance from center (percentage)
  const getDistanceFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = clientX - centerX
    const dy = clientY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxDistance = rect.width / 2
    return (distance / maxDistance) * 100
  }, [])

  // Check if position is within track (날개 끝 반경과 동기화)
  const isWithinTrack = useCallback((clientX: number, clientY: number) => {
    const distance = getDistanceFromCenter(clientX, clientY)
    const innerRadius = TRACK_RADIUS - TRACK_WIDTH / 2
    const outerRadius = TRACK_RADIUS + TRACK_WIDTH / 2
    return distance >= innerRadius && distance <= outerRadius
  }, [getDistanceFromCenter])

  // Calculate angle from touch/mouse position
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI)
  }, [])

  // Trigger deviation penalty
  const triggerDeviation = useCallback(() => {
    if (gameState !== 'playing') return

    setShowDeviation(true)
    setDeviationFlash(true)
    setComboTime(0)
    setComboCount(0)
    comboCountRef.current = 0
    setGoldenGlow(false)

    // 감점: 회전수 5% 감소 + RPM 급격히 감소
    totalRotationRef.current = Math.max(0, totalRotationRef.current * 0.95)
    velocityRef.current *= 0.3 // RPM 급격히 감소

    // 진동 피드백
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50, 30, 100])
    }

    setGameStats(prev => ({ ...prev, deviations: prev.deviations + 1 }))

    setTimeout(() => {
      setShowDeviation(false)
      setDeviationFlash(false)
    }, 800)
  }, [gameState])

  // Handle touch/mouse start
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing') return

    // 첫 드래그 시 가이드 숨김
    if (!hasStartedDragging) {
      setHasStartedDragging(true)
      setShowStartGuide(false)
    }

    if (!isWithinTrack(clientX, clientY)) {
      isInTrackRef.current = false
      return
    }

    isInTrackRef.current = true
    lastAngleRef.current = getAngleFromCenter(clientX, clientY)
  }, [gameState, getAngleFromCenter, isWithinTrack, hasStartedDragging])

  // Handle touch/mouse move
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || lastAngleRef.current === null) return

    const inTrack = isWithinTrack(clientX, clientY)

    if (!inTrack && isInTrackRef.current) {
      triggerDeviation()
      isInTrackRef.current = false
      lastAngleRef.current = null
      return
    }

    if (!inTrack) return

    isInTrackRef.current = true
    const currentAngle = getAngleFromCenter(clientX, clientY)
    let deltaAngle = currentAngle - lastAngleRef.current

    if (deltaAngle > 180) deltaAngle -= 360
    if (deltaAngle < -180) deltaAngle += 360

    // 바람 이벤트 중에는 2배 효율
    const boostMultiplier = windEventActive ? WIND_BOOST_MULTIPLIER : 1
    velocityRef.current += deltaAngle * 0.5 * boostMultiplier
    lastAngleRef.current = currentAngle
  }, [gameState, getAngleFromCenter, isWithinTrack, triggerDeviation, windEventActive])

  // Handle touch/mouse end
  const handleEnd = useCallback(() => {
    lastAngleRef.current = null
    isInTrackRef.current = true
  }, [])

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }, [handleMove])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }, [handleEnd])

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // 바람 이벤트 시간 설정
  useEffect(() => {
    if (gameState === 'playing' && !windEventUsed && windEventTime === null) {
      const randomTime = Math.floor(Math.random() * (WIND_EVENT_MAX_TIME - WIND_EVENT_MIN_TIME)) + WIND_EVENT_MIN_TIME
      setWindEventTime(GAME_DURATION - randomTime)
    }
  }, [gameState, windEventUsed, windEventTime])

  // 바람 이벤트 활성화/비활성화
  useEffect(() => {
    if (gameState !== 'playing' || windEventTime === null || windEventUsed) return

    if (timeLeft <= windEventTime && timeLeft > windEventTime - WIND_EVENT_DURATION) {
      if (!windEventActive) {
        setWindEventActive(true)
        windBoostSpinsRef.current = totalRotationRef.current

        // 바람 파티클 생성
        const particles: WindParticle[] = Array.from({ length: 20 }, (_, i) => ({
          id: Date.now() + i,
          y: Math.random() * 100,
          delay: Math.random() * 0.5,
        }))
        setWindParticles(particles)

        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      }
    } else if (timeLeft <= windEventTime - WIND_EVENT_DURATION && windEventActive) {
      // 바람 이벤트 종료
      setWindEventActive(false)
      setWindEventUsed(true)
      setWindParticles([])

      // 바람 이벤트 중 획득한 회전수 계산
      const boostSpins = totalRotationRef.current - windBoostSpinsRef.current
      setWindBoostSpins(boostSpins)
    }
  }, [timeLeft, windEventTime, windEventActive, windEventUsed, gameState])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const deltaTime = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      velocityRef.current *= FRICTION

      if (Math.abs(velocityRef.current) < 0.5) {
        velocityRef.current = 0
      }

      const newRotation = rotation + velocityRef.current
      setRotation(newRotation)

      totalRotationRef.current += Math.abs(velocityRef.current)
      const newTotalSpins = totalRotationRef.current / 360
      setTotalSpins(newTotalSpins)

      const currentRpm = Math.min(Math.abs(velocityRef.current) * 8, MAX_RPM)
      setRpm(currentRpm)

      if (currentRpm > gameStats.maxRpm) {
        setGameStats(prev => ({ ...prev, maxRpm: Math.floor(currentRpm) }))
      }

      const inComboZone = (currentRpm / MAX_RPM) * 100 >= COMBO_ZONE_THRESHOLD

      if (currentRpm >= MIN_RPM_FOR_COMBO && inComboZone) {
        setComboTime(prev => prev + deltaTime)

        const newComboCount = Math.floor(comboTime + deltaTime)
        if (newComboCount > comboCountRef.current) {
          comboCountRef.current = newComboCount
          setComboCount(newComboCount)

          if (newComboCount >= 50 && !goldenGlow) {
            setGoldenGlow(true)
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100])
            }
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

      // Spark effects
      if (currentRpm > 150 && Math.random() < 0.4) {
        const angle = Math.random() * 360
        const radius = TRACK_RADIUS + Math.random() * 5
        const spark: Spark = {
          id: Date.now() + Math.random(),
          x: 50 + Math.cos(angle * Math.PI / 180) * radius,
          y: 50 + Math.sin(angle * Math.PI / 180) * radius,
          angle,
        }
        setSparks(prev => [...prev.slice(-15), spark])

        if (currentRpm > 200 && !shake) {
          setShake(true)
          setTimeout(() => setShake(false), 100)
        }
      }

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    animationRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, rotation, shake, comboTime, goldenGlow, gameStats.maxRpm, gameStats.maxCombo])

  // Timer
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

  // Calculate final stats when game ends
  useEffect(() => {
    if (gameState === 'finished') {
      const comboTier = getCurrentComboTier()
      const multiplier = comboTier?.multiplier || 1
      const baseExp = Math.floor(totalSpins / SPINS_PER_EXP)
      const comboBonus = Math.floor(gameStats.maxCombo / 10)
      const deviationPenalty = gameStats.deviations
      const finalExp = Math.max(0, Math.floor((baseExp + comboBonus) * multiplier) - deviationPenalty)

      // 바람 이벤트 활용도 계산 (최대 가능 회전수 대비 실제 획득)
      const maxPossibleWindSpins = WIND_EVENT_DURATION * 60 * WIND_BOOST_MULTIPLIER
      const windUsage = windEventUsed ? Math.min(100, Math.floor((windBoostSpins / 360 / maxPossibleWindSpins) * 100 * 50)) : 0

      // MWh 계산 (1회전 = 0.001 MWh 가정)
      const totalMWh = Math.floor(totalSpins * 0.001 * 100) / 100

      setEarnedExp(finalExp)
      setGameStats(prev => ({
        ...prev,
        totalSpins: Math.floor(totalSpins),
        windBoostUsage: windUsage,
        totalMWh,
      }))
    }
  }, [gameState, totalSpins, getCurrentComboTier, gameStats.maxCombo, gameStats.deviations, windEventUsed, windBoostSpins])

  // Start game
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
    setHasStartedDragging(false)
    setWindEventActive(false)
    setWindEventUsed(false)
    setWindEventTime(null)
    setWindParticles([])
    setWindBoostSpins(0)
    setGameStats({
      totalSpins: 0,
      maxRpm: 0,
      maxCombo: 0,
      deviations: 0,
      windBoostUsage: 0,
      totalMWh: 0,
    })
    velocityRef.current = 0
    totalRotationRef.current = 0
    lastTimeRef.current = 0
    comboCountRef.current = 0
    windBoostSpinsRef.current = 0
  }

  const handleRecordExp = () => {
    if (earnedExp > 0) {
      onEarnExp(earnedExp)
    }
    onClose()
    setGameState('ready')
  }

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
  const comboTier = getCurrentComboTier()
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

        {/* Deviation Flash */}
        <AnimatePresence>
          {deviationFlash && (
            <motion.div
              className="absolute inset-0 bg-red-500/30 z-10 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>

        {/* Wind Event Particles */}
        <AnimatePresence>
          {windEventActive && windParticles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute left-0 w-20 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent z-20 pointer-events-none"
              style={{ top: `${particle.y}%` }}
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '100vw', opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 1.5,
                delay: particle.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
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
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white"
            >
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
            <motion.div
              className="p-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-kepco-blue to-kepco-cyan flex items-center justify-center">
                <Wind className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">풍력발전기를 돌려라!</h3>
              <p className="text-slate-400 mb-4 text-sm">
                날개 끝을 잡고 원을 그리며 스와이프!<br />
                <span className="text-green-400">돌풍 이벤트</span>를 놓치지 마세요!
              </p>

              <div className="bg-white/5 rounded-xl p-4 mb-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-green-400">돌풍 이벤트</span>
                  <span className="text-slate-400">- 5초간 RPM 2배!</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-yellow-400">콤보 존</span>
                  <span className="text-slate-400">- RPM 70% 이상 유지</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-red-400">경로 이탈</span>
                  <span className="text-slate-400">- 트랙 밖으로 나가면 패널티</span>
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
                  <p className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {timeLeft}s
                  </p>
                </div>

                <div className="text-center">
                  {comboTier ? (
                    <motion.div
                      className="px-3 py-1 rounded-lg"
                      style={{ backgroundColor: `${comboTier.color}30` }}
                      animate={comboTier.glow ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.3, repeat: Infinity }}
                    >
                      <p className="text-[10px] font-bold" style={{ color: comboTier.color }}>
                        {comboTier.name}
                      </p>
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
                    initial={{ opacity: 0, y: -20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
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
                  <span className="text-lg font-bold" style={{ color: getGlowColor() }}>
                    {Math.floor(rpm)}
                  </span>
                </div>

                <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="absolute right-0 h-full bg-yellow-500/20 border-l-2 border-yellow-500/50"
                    style={{ width: `${100 - COMBO_ZONE_THRESHOLD}%` }}
                  />
                  <motion.div
                    className="absolute left-0 h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${rpmPercent}%`,
                      background: windEventActive
                        ? 'linear-gradient(90deg, #00FF88, #00D4FF)'
                        : goldenGlow
                        ? 'linear-gradient(90deg, #FFD700, #FFA500)'
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

              {/* Golden Glow Indicator */}
              <AnimatePresence>
                {goldenGlow && (
                  <motion.div
                    className="mb-2 text-center py-1 rounded-lg bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className="text-xs font-bold text-yellow-400 flex items-center justify-center gap-1">
                      <Award className="w-4 h-4" /> 50+ COMBO!
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Deviation Warning */}
              <AnimatePresence>
                {showDeviation && (
                  <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                  >
                    <div className="bg-red-500/90 px-6 py-3 rounded-xl text-white font-bold flex items-center gap-2">
                      <AlertTriangle className="w-6 h-6" />
                      경로 이탈!
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Turbine Area */}
              <div
                ref={containerRef}
                className="relative w-full aspect-square rounded-2xl bg-slate-900/50 border border-white/5 overflow-hidden touch-none select-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Background glow */}
                <div
                  className="absolute inset-0 rounded-full opacity-30 transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle, ${getGlowColor()}40 0%, transparent 70%)`,
                  }}
                />

                {/* Swipe Track - 날개 끝 반경과 동기화 */}
                <div
                  className="absolute rounded-full transition-colors duration-300"
                  style={{
                    left: `${50 - TRACK_RADIUS - TRACK_WIDTH / 2}%`,
                    top: `${50 - TRACK_RADIUS - TRACK_WIDTH / 2}%`,
                    width: `${(TRACK_RADIUS + TRACK_WIDTH / 2) * 2}%`,
                    height: `${(TRACK_RADIUS + TRACK_WIDTH / 2) * 2}%`,
                    border: `${TRACK_WIDTH / 2}px solid ${showDeviation ? '#EF444440' : `${getGlowColor()}20`}`,
                    boxShadow: `inset 0 0 30px ${getGlowColor()}10, 0 0 20px ${showDeviation ? '#EF4444' : getGlowColor()}20`,
                  }}
                />

                {/* Track center line */}
                <div
                  className="absolute rounded-full border-2 border-dashed transition-colors duration-300"
                  style={{
                    left: `${50 - TRACK_RADIUS}%`,
                    top: `${50 - TRACK_RADIUS}%`,
                    width: `${TRACK_RADIUS * 2}%`,
                    height: `${TRACK_RADIUS * 2}%`,
                    borderColor: showDeviation ? '#EF4444' : `${getGlowColor()}40`,
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

                {/* Integrated Turbine (Tower + Blades) */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))` }}
                >
                  {/* Tower - 고정 */}
                  <defs>
                    <linearGradient id="towerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="50%" stopColor="#f1f5f9" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="bladeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor={getGlowColor()} />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Tower base */}
                  <path
                    d="M48 50 L46 85 L54 85 L52 50 Z"
                    fill="url(#towerGradient)"
                  />

                  {/* Tower top platform */}
                  <ellipse cx="50" cy="50" rx="6" ry="3" fill="#64748b" />
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
                        <stop offset="0%" stopColor={getGlowColor()} stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#ffffff" />
                      </linearGradient>
                    </defs>

                    {/* Three Blades */}
                    {[0, 120, 240].map((angle, i) => (
                      <g key={i} transform={`rotate(${angle} 50 50)`}>
                        <path
                          d={`M49 50 L47 ${50 - BLADE_LENGTH_PERCENT} Q50 ${50 - BLADE_LENGTH_PERCENT - 3} 53 ${50 - BLADE_LENGTH_PERCENT} L51 50 Z`}
                          fill="url(#bladeGrad)"
                          style={{
                            filter: rpm > 100 ? `drop-shadow(0 0 ${rpm > 200 ? 8 : 4}px ${getGlowColor()})` : 'none',
                          }}
                        />
                      </g>
                    ))}

                    {/* Center Hub */}
                    <circle
                      cx="50"
                      cy="50"
                      r="5"
                      fill="#334155"
                      stroke={getGlowColor()}
                      strokeWidth="1.5"
                      style={{
                        filter: `drop-shadow(0 0 10px ${getGlowColor()})`,
                      }}
                    />
                    <circle cx="50" cy="50" r="2" fill={getGlowColor()} />
                  </svg>
                </div>

                {/* Start Guide - 날개 끝에 표시 */}
                <AnimatePresence>
                  {showStartGuide && gameState === 'playing' && (
                    <motion.div
                      className="absolute z-30 pointer-events-none"
                      style={{
                        left: '50%',
                        top: `${50 - BLADE_LENGTH_PERCENT - 5}%`,
                        transform: 'translateX(-50%)',
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: [1, 1.2, 1] }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <div className="flex flex-col items-center">
                        <motion.div
                          className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                          animate={{ boxShadow: ['0 0 10px #FBBF24', '0 0 30px #FBBF24', '0 0 10px #FBBF24'] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Hand className="w-6 h-6 text-white" />
                        </motion.div>
                        <p className="text-[10px] text-yellow-400 mt-1 whitespace-nowrap">여기를 잡고 돌려요!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Touch hint */}
                {rpm < 10 && !showDeviation && !showStartGuide && (
                  <motion.p
                    className="absolute bottom-4 left-0 right-0 text-center text-slate-500 text-xs"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    트랙을 따라 스와이프!
                  </motion.p>
                )}
              </div>
            </div>
          )}

          {/* Finished State */}
          {gameState === 'finished' && (
            <motion.div
              className="p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${titleInfo?.color}, ${titleInfo?.color}80)`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 360] }}
                transition={{ duration: 0.6 }}
              >
                <Trophy className="w-8 h-8 text-white" />
              </motion.div>

              <h3 className="text-xl font-bold text-white mb-1">게임 종료!</h3>

              {titleInfo && (
                <motion.div
                  className="mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-lg font-bold" style={{ color: titleInfo.color }}>
                    "{titleInfo.title}"
                  </p>
                  <p className="text-xs text-slate-400">{titleInfo.rank}</p>
                </motion.div>
              )}

              {/* 상세 운전일지 */}
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
        .animate-shake {
          animation: shake 0.1s ease-in-out;
        }
      `}</style>
    </AnimatePresence>
  )
}
