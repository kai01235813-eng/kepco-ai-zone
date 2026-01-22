'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Wind, Trophy, BookOpen, AlertTriangle, Flame, Award } from 'lucide-react'

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

interface GameStats {
  totalSpins: number
  maxRpm: number
  maxCombo: number
  deviations: number
  comboTime: number
}

// ==================== Constants ====================
const GAME_DURATION = 60
const FRICTION = 0.92 // 더 강한 마찰력 (0.985 -> 0.92)
const MIN_RPM_FOR_COMBO = 50
const SPINS_PER_EXP = 1000 // 1000바퀴당 1 EXP
const COMBO_ZONE_THRESHOLD = 70 // RPM 70% 이상이면 콤보 존
const MAX_RPM = 250

// 스와이프 트랙 설정
const TRACK_INNER_RADIUS = 25 // %
const TRACK_OUTER_RADIUS = 48 // %

const COMBO_TIERS = [
  { time: 50, multiplier: 3, color: '#EF4444', name: 'OVERLOAD!', glow: true },
  { time: 30, multiplier: 2, color: '#F97316', name: 'TURBO!' },
  { time: 10, multiplier: 1.5, color: '#FBBF24', name: 'COMBO!' },
]

// 칭호 시스템
const getTitleByStats = (stats: GameStats): { title: string; rank: string; color: string } => {
  const score = stats.totalSpins * (1 + stats.maxCombo * 0.01) - stats.deviations * 10

  if (score >= 500 && stats.deviations <= 2) {
    return { title: '전설의 발전기 마스터', rank: '상위 1%', color: '#FFD700' }
  } else if (score >= 300 && stats.deviations <= 5) {
    return { title: '숙련된 운전원', rank: '상위 10%', color: '#C0C0C0' }
  } else if (score >= 150) {
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

  // Stats tracking
  const [gameStats, setGameStats] = useState<GameStats>({
    totalSpins: 0,
    maxRpm: 0,
    maxCombo: 0,
    deviations: 0,
    comboTime: 0,
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

  // Check if position is within track
  const isWithinTrack = useCallback((clientX: number, clientY: number) => {
    const distance = getDistanceFromCenter(clientX, clientY)
    return distance >= TRACK_INNER_RADIUS && distance <= TRACK_OUTER_RADIUS
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

    // 감점: 회전수 5% 감소
    totalRotationRef.current = Math.max(0, totalRotationRef.current * 0.95)

    // 진동 피드백
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50, 30, 100])
    }

    // Stats 업데이트
    setGameStats(prev => ({ ...prev, deviations: prev.deviations + 1 }))

    setTimeout(() => {
      setShowDeviation(false)
      setDeviationFlash(false)
    }, 800)
  }, [gameState])

  // Handle touch/mouse start
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing') return

    if (!isWithinTrack(clientX, clientY)) {
      isInTrackRef.current = false
      return
    }

    isInTrackRef.current = true
    lastAngleRef.current = getAngleFromCenter(clientX, clientY)
  }, [gameState, getAngleFromCenter, isWithinTrack])

  // Handle touch/mouse move
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || lastAngleRef.current === null) return

    // 트랙 이탈 체크
    const inTrack = isWithinTrack(clientX, clientY)

    if (!inTrack && isInTrackRef.current) {
      // 트랙에서 이탈
      triggerDeviation()
      isInTrackRef.current = false
      lastAngleRef.current = null
      return
    }

    if (!inTrack) return

    isInTrackRef.current = true
    const currentAngle = getAngleFromCenter(clientX, clientY)
    let deltaAngle = currentAngle - lastAngleRef.current

    // Handle angle wrap-around
    if (deltaAngle > 180) deltaAngle -= 360
    if (deltaAngle < -180) deltaAngle += 360

    // Add to velocity with momentum (더 즉각적인 반응)
    velocityRef.current += deltaAngle * 0.5
    lastAngleRef.current = currentAngle
  }, [gameState, getAngleFromCenter, isWithinTrack, triggerDeviation])

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
    if (e.buttons !== 1) return // 마우스 버튼이 눌려있을 때만
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const deltaTime = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      // Apply strong friction (빠른 감속)
      velocityRef.current *= FRICTION

      // Stop if very slow
      if (Math.abs(velocityRef.current) < 0.5) {
        velocityRef.current = 0
      }

      // Update rotation
      const newRotation = rotation + velocityRef.current
      setRotation(newRotation)

      // Track total rotation
      totalRotationRef.current += Math.abs(velocityRef.current)
      const newTotalSpins = totalRotationRef.current / 360
      setTotalSpins(newTotalSpins)

      // Calculate RPM (더 직관적인 계산)
      const currentRpm = Math.min(Math.abs(velocityRef.current) * 8, MAX_RPM)
      setRpm(currentRpm)

      // Update max RPM stat
      if (currentRpm > gameStats.maxRpm) {
        setGameStats(prev => ({ ...prev, maxRpm: Math.floor(currentRpm) }))
      }

      // Combo zone (RPM이 70% 이상일 때)
      const inComboZone = (currentRpm / MAX_RPM) * 100 >= COMBO_ZONE_THRESHOLD

      // Update combo
      if (currentRpm >= MIN_RPM_FOR_COMBO && inComboZone) {
        setComboTime(prev => prev + deltaTime)

        // 콤보 카운트 (1초마다 증가)
        const newComboCount = Math.floor(comboTime + deltaTime)
        if (newComboCount > comboCountRef.current) {
          comboCountRef.current = newComboCount
          setComboCount(newComboCount)

          // 50콤보 이상 황금 글로우
          if (newComboCount >= 50 && !goldenGlow) {
            setGoldenGlow(true)
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100])
            }
          }

          // Max combo stat 업데이트
          if (newComboCount > gameStats.maxCombo) {
            setGameStats(prev => ({ ...prev, maxCombo: newComboCount }))
          }
        }
      } else if (comboTime > 0) {
        // 콤보 끊김
        setComboTime(0)
        setComboCount(0)
        comboCountRef.current = 0
        setGoldenGlow(false)
      }

      // Spark effects at high RPM
      if (currentRpm > 150 && Math.random() < 0.4) {
        const angle = Math.random() * 360
        const radius = 30 + Math.random() * 15
        const spark: Spark = {
          id: Date.now() + Math.random(),
          x: 50 + Math.cos(angle * Math.PI / 180) * radius,
          y: 50 + Math.sin(angle * Math.PI / 180) * radius,
          angle,
        }
        setSparks(prev => [...prev.slice(-15), spark])

        // Screen shake at very high RPM
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

  // Calculate final EXP when game ends
  useEffect(() => {
    if (gameState === 'finished') {
      const comboTier = getCurrentComboTier()
      const multiplier = comboTier?.multiplier || 1
      const baseExp = Math.floor(totalSpins / SPINS_PER_EXP)
      const comboBonus = Math.floor(gameStats.maxCombo / 10)
      const deviationPenalty = gameStats.deviations
      const finalExp = Math.max(0, Math.floor((baseExp + comboBonus) * multiplier) - deviationPenalty)

      setEarnedExp(finalExp)
      setGameStats(prev => ({
        ...prev,
        totalSpins: Math.floor(totalSpins),
        comboTime: Math.floor(comboTime)
      }))
    }
  }, [gameState, totalSpins, comboTime, getCurrentComboTier, gameStats.maxCombo, gameStats.deviations])

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
    setGameStats({
      totalSpins: 0,
      maxRpm: 0,
      maxCombo: 0,
      deviations: 0,
      comboTime: 0,
    })
    velocityRef.current = 0
    totalRotationRef.current = 0
    lastTimeRef.current = 0
    comboCountRef.current = 0
  }

  // Record EXP and close
  const handleRecordExp = () => {
    if (earnedExp > 0) {
      onEarnExp(earnedExp)
    }
    onClose()
    setGameState('ready')
  }

  // Get motion blur intensity based on RPM
  const getBlurIntensity = () => {
    if (rpm < 50) return 0
    if (rpm < 100) return 1
    if (rpm < 150) return 2
    if (rpm < 200) return 4
    return 6
  }

  // Get glow color based on RPM
  const getGlowColor = () => {
    if (goldenGlow) return '#FFD700'
    if (rpm > 200) return '#EF4444'
    if (rpm > 150) return '#F97316'
    if (rpm > 100) return '#FBBF24'
    return '#00D4FF'
  }

  // RPM percentage for gauge
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

        {/* Deviation Flash Overlay */}
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

        {/* Game Container */}
        <motion.div
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 ${shake ? 'animate-shake' : ''}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          style={{
            boxShadow: goldenGlow
              ? '0 0 80px rgba(255, 215, 0, 0.6)'
              : `0 0 60px ${getGlowColor()}40`,
          }}
        >
          {/* Close button */}
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
                60초 동안 원형 트랙을 따라 스와이프하세요!<br />
                트랙을 벗어나면 <span className="text-red-400">경로 이탈</span> 패널티!
              </p>

              <div className="bg-white/5 rounded-xl p-4 mb-4 text-left">
                <p className="text-xs text-slate-500 mb-2">콤보 보너스</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-yellow-400">10초 유지</span>
                    <span className="text-white">1.5배 EXP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-400">30초 유지</span>
                    <span className="text-white">2배 EXP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">50초 유지</span>
                    <span className="text-white">3배 EXP + 황금빛!</span>
                  </div>
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
                {/* Time */}
                <div className={`text-center ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                  <p className="text-[10px] text-slate-500">남은 시간</p>
                  <p className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {timeLeft}s
                  </p>
                </div>

                {/* Combo Display */}
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

                {/* Spins */}
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">회전수</p>
                  <p className="text-xl font-bold text-kepco-cyan">{Math.floor(totalSpins)}</p>
                </div>
              </div>

              {/* RPM Gauge - 자동차 계기판 스타일 */}
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

                {/* Gauge Bar */}
                <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden">
                  {/* Combo Zone Indicator */}
                  <div
                    className="absolute right-0 h-full bg-yellow-500/20 border-l-2 border-yellow-500/50"
                    style={{ width: `${100 - COMBO_ZONE_THRESHOLD}%` }}
                  />

                  {/* RPM Fill */}
                  <motion.div
                    className="absolute left-0 h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${rpmPercent}%`,
                      background: goldenGlow
                        ? 'linear-gradient(90deg, #FFD700, #FFA500)'
                        : `linear-gradient(90deg, #00D4FF, ${getGlowColor()})`,
                      boxShadow: `0 0 15px ${getGlowColor()}`,
                    }}
                  />

                  {/* Combo Zone Label */}
                  {inComboZone && (
                    <motion.div
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-yellow-400"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      COMBO ZONE!
                    </motion.div>
                  )}
                </div>

                {/* Gauge Labels */}
                <div className="flex justify-between text-[8px] text-slate-600 mt-1">
                  <span>0</span>
                  <span>62</span>
                  <span>125</span>
                  <span className="text-yellow-500">187</span>
                  <span className="text-red-400">MAX</span>
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
                      <Award className="w-4 h-4" /> 50+ COMBO! 황금 발전기 가동 중!
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

                {/* Swipe Track Guide - 네온 트랙 */}
                <div
                  className="absolute rounded-full border-2 border-dashed transition-colors duration-300"
                  style={{
                    left: `${50 - TRACK_OUTER_RADIUS}%`,
                    top: `${50 - TRACK_OUTER_RADIUS}%`,
                    width: `${TRACK_OUTER_RADIUS * 2}%`,
                    height: `${TRACK_OUTER_RADIUS * 2}%`,
                    borderColor: showDeviation ? '#EF4444' : `${getGlowColor()}60`,
                    boxShadow: `0 0 20px ${showDeviation ? '#EF4444' : getGlowColor()}30`,
                  }}
                />
                <div
                  className="absolute rounded-full border-2 border-dashed transition-colors duration-300"
                  style={{
                    left: `${50 - TRACK_INNER_RADIUS}%`,
                    top: `${50 - TRACK_INNER_RADIUS}%`,
                    width: `${TRACK_INNER_RADIUS * 2}%`,
                    height: `${TRACK_INNER_RADIUS * 2}%`,
                    borderColor: showDeviation ? '#EF4444' : `${getGlowColor()}60`,
                  }}
                />

                {/* Track Fill Hint */}
                <div
                  className="absolute rounded-full opacity-10"
                  style={{
                    left: `${50 - TRACK_OUTER_RADIUS}%`,
                    top: `${50 - TRACK_OUTER_RADIUS}%`,
                    width: `${TRACK_OUTER_RADIUS * 2}%`,
                    height: `${TRACK_OUTER_RADIUS * 2}%`,
                    background: `radial-gradient(circle, transparent ${(TRACK_INNER_RADIUS / TRACK_OUTER_RADIUS) * 100}%, ${getGlowColor()} ${(TRACK_INNER_RADIUS / TRACK_OUTER_RADIUS) * 100}%, ${getGlowColor()} 100%)`,
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
                      backgroundColor: goldenGlow ? '#FFD700' : getGlowColor(),
                      boxShadow: `0 0 10px ${goldenGlow ? '#FFD700' : getGlowColor()}`,
                    }}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                ))}

                {/* Tower (Fixed) - 지지대 고정 */}
                <div className="absolute left-1/2 bottom-[10%] -translate-x-1/2 w-4 h-[35%] z-10">
                  <div className="w-full h-full bg-gradient-to-b from-slate-400 to-slate-600 rounded-sm" />
                </div>

                {/* Nacelle (Housing) - 발전기 하우징 */}
                <div
                  className="absolute left-1/2 top-[18%] -translate-x-1/2 w-16 h-8 rounded-full z-20"
                  style={{
                    background: 'linear-gradient(to bottom, #64748b, #334155)',
                    boxShadow: goldenGlow ? '0 0 30px #FFD700' : `0 0 20px ${getGlowColor()}40`,
                  }}
                />

                {/* Blades (Rotating) - 날개만 회전 */}
                <div className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] z-15">
                  <motion.div
                    className="relative w-full h-full"
                    style={{
                      rotate: rotation,
                      filter: `blur(${getBlurIntensity()}px)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    {/* Blades */}
                    {[0, 120, 240].map((angle, i) => (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-3 origin-bottom"
                        style={{
                          height: '48%',
                          transform: `translateX(-50%) translateY(-100%) rotate(${angle}deg)`,
                          transformOrigin: 'bottom center',
                        }}
                      >
                        <div
                          className="w-full h-full rounded-t-full transition-all duration-200"
                          style={{
                            background: goldenGlow
                              ? 'linear-gradient(to top, #FFD700, #FFF8DC)'
                              : `linear-gradient(to top, ${getGlowColor()}, white)`,
                            boxShadow: rpm > 100
                              ? `0 0 20px ${goldenGlow ? '#FFD700' : getGlowColor()}`
                              : 'none',
                          }}
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Center hub */}
                <div
                  className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-700 border-4 flex items-center justify-center z-30"
                  style={{
                    borderColor: goldenGlow ? '#FFD700' : getGlowColor(),
                    boxShadow: `0 0 25px ${goldenGlow ? '#FFD700' : getGlowColor()}60`,
                  }}
                >
                  <Zap
                    className="w-5 h-5"
                    style={{ color: goldenGlow ? '#FFD700' : getGlowColor() }}
                  />
                </div>

                {/* Touch hint */}
                {rpm < 10 && !showDeviation && (
                  <motion.p
                    className="absolute bottom-4 left-0 right-0 text-center text-slate-500 text-xs"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    트랙을 따라 원을 그리며 스와이프!
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

              {/* 칭호 */}
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
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">총 회전수</p>
                    <p className="text-lg font-bold text-kepco-cyan">{gameStats.totalSpins}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">최고 RPM</p>
                    <p className="text-lg font-bold text-yellow-400">{gameStats.maxRpm}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">최대 콤보</p>
                    <p className="text-lg font-bold text-orange-400">{gameStats.maxCombo}초</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">경로 이탈</p>
                    <p className="text-lg font-bold text-red-400">{gameStats.deviations}회</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">오늘의 총 발전량</span>
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

      {/* Custom CSS for shake animation */}
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
