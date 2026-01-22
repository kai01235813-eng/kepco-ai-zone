'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Wind, Trophy, BookOpen } from 'lucide-react'

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

// ==================== Constants ====================
const GAME_DURATION = 60
const FRICTION = 0.985
const MIN_RPM_FOR_COMBO = 30
const SPINS_PER_EXP = 10

const COMBO_TIERS = [
  { time: 50, multiplier: 3, color: '#EF4444', name: 'OVERLOAD!' },
  { time: 30, multiplier: 2, color: '#F97316', name: 'TURBO!' },
  { time: 10, multiplier: 1.5, color: '#FBBF24', name: 'COMBO!' },
]

// ==================== Wind Turbine Game Component ====================
export default function WindTurbineGame({ isOpen, onClose, onEarnExp }: WindTurbineGameProps) {
  // Game state
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [rotation, setRotation] = useState(0)
  const [rpm, setRpm] = useState(0)
  const [totalSpins, setTotalSpins] = useState(0)
  const [comboTime, setComboTime] = useState(0)
  const [earnedExp, setEarnedExp] = useState(0)
  const [sparks, setSparks] = useState<Spark[]>([])
  const [shake, setShake] = useState(false)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const totalRotationRef = useRef(0)

  // Get current combo tier
  const getCurrentComboTier = useCallback(() => {
    for (const tier of COMBO_TIERS) {
      if (comboTime >= tier.time) return tier
    }
    return null
  }, [comboTime])

  // Calculate angle from touch/mouse position
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI)
  }, [])

  // Handle touch/mouse start
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing') return
    lastAngleRef.current = getAngleFromCenter(clientX, clientY)
  }, [gameState, getAngleFromCenter])

  // Handle touch/mouse move
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || lastAngleRef.current === null) return

    const currentAngle = getAngleFromCenter(clientX, clientY)
    let deltaAngle = currentAngle - lastAngleRef.current

    // Handle angle wrap-around
    if (deltaAngle > 180) deltaAngle -= 360
    if (deltaAngle < -180) deltaAngle += 360

    // Add to velocity with momentum
    velocityRef.current += deltaAngle * 0.3
    lastAngleRef.current = currentAngle
  }, [gameState, getAngleFromCenter])

  // Handle touch/mouse end
  const handleEnd = useCallback(() => {
    lastAngleRef.current = null
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

      // Apply friction
      velocityRef.current *= FRICTION

      // Update rotation
      const newRotation = rotation + velocityRef.current
      setRotation(newRotation)

      // Track total rotation
      totalRotationRef.current += Math.abs(velocityRef.current)
      const newTotalSpins = totalRotationRef.current / 360
      setTotalSpins(newTotalSpins)

      // Calculate RPM
      const currentRpm = Math.abs(velocityRef.current) * 60 / 6
      setRpm(currentRpm)

      // Update combo
      if (currentRpm >= MIN_RPM_FOR_COMBO) {
        setComboTime(prev => prev + deltaTime)
      } else {
        setComboTime(0)
      }

      // Spark effects at high RPM
      if (currentRpm > 150 && Math.random() < 0.3) {
        const angle = Math.random() * 360
        const spark: Spark = {
          id: Date.now() + Math.random(),
          x: 50 + Math.cos(angle * Math.PI / 180) * 40,
          y: 50 + Math.sin(angle * Math.PI / 180) * 40,
          angle,
        }
        setSparks(prev => [...prev.slice(-10), spark])

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
  }, [gameState, rotation, shake])

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
      const finalExp = Math.floor(baseExp * multiplier)
      setEarnedExp(finalExp)
    }
  }, [gameState, totalSpins, getCurrentComboTier])

  // Start game
  const startGame = () => {
    setGameState('playing')
    setTimeLeft(GAME_DURATION)
    setRotation(0)
    setRpm(0)
    setTotalSpins(0)
    setComboTime(0)
    setEarnedExp(0)
    setSparks([])
    velocityRef.current = 0
    totalRotationRef.current = 0
    lastTimeRef.current = 0
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
    if (rpm < 100) return 2
    if (rpm < 150) return 4
    if (rpm < 200) return 8
    return 12
  }

  // Get glow color based on RPM
  const getGlowColor = () => {
    if (rpm > 200) return '#EF4444'
    if (rpm > 150) return '#F97316'
    if (rpm > 100) return '#FBBF24'
    return '#00D4FF'
  }

  const comboTier = getCurrentComboTier()

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

        {/* Game Container */}
        <motion.div
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 ${shake ? 'animate-shake' : ''}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          style={{
            boxShadow: `0 0 60px ${getGlowColor()}40`,
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
              className="p-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-kepco-blue to-kepco-cyan flex items-center justify-center">
                <Wind className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">풍력발전기를 돌려라!</h3>
              <p className="text-slate-400 mb-6 text-sm">
                60초 동안 발전기를 최대한 빠르게 회전시키세요.<br />
                RPM을 유지하면 콤보 보너스가 적용됩니다!
              </p>
              <div className="space-y-2 text-xs text-slate-500 mb-6">
                <p>10초 유지: <span className="text-yellow-400">1.5배 EXP</span></p>
                <p>30초 유지: <span className="text-orange-400">2배 EXP</span></p>
                <p>50초 유지: <span className="text-red-400">3배 EXP</span></p>
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
              <div className="flex justify-between items-center mb-4">
                {/* Time */}
                <div className={`text-center ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                  <p className="text-xs text-slate-500">남은 시간</p>
                  <p className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {timeLeft}s
                  </p>
                </div>

                {/* Combo */}
                {comboTier && (
                  <motion.div
                    className="text-center px-4 py-2 rounded-xl"
                    style={{ backgroundColor: `${comboTier.color}30` }}
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    <p className="text-xs font-bold" style={{ color: comboTier.color }}>
                      {comboTier.name}
                    </p>
                    <p className="text-lg font-black text-white">x{comboTier.multiplier}</p>
                  </motion.div>
                )}

                {/* Spins */}
                <div className="text-center">
                  <p className="text-xs text-slate-500">회전수</p>
                  <p className="text-2xl font-bold text-kepco-cyan">{Math.floor(totalSpins)}</p>
                </div>
              </div>

              {/* RPM Gauge */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>RPM</span>
                  <span style={{ color: getGlowColor() }}>{Math.floor(rpm)}</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(rpm / 2.5, 100)}%`,
                      background: `linear-gradient(90deg, #00D4FF, ${getGlowColor()})`,
                      boxShadow: `0 0 10px ${getGlowColor()}`,
                    }}
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>0</span>
                  <span>100</span>
                  <span>200</span>
                  <span>MAX</span>
                </div>
              </div>

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
                  className="absolute inset-0 rounded-full opacity-30"
                  style={{
                    background: `radial-gradient(circle, ${getGlowColor()}40 0%, transparent 70%)`,
                  }}
                />

                {/* Circular guide */}
                <div className="absolute inset-8 rounded-full border-2 border-dashed border-white/10" />

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

                {/* Turbine */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="relative w-3/4 h-3/4"
                    style={{
                      rotate: rotation,
                      filter: `blur(${getBlurIntensity()}px)`,
                    }}
                  >
                    {/* Blades */}
                    {[0, 120, 240].map((angle, i) => (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-4 origin-bottom"
                        style={{
                          height: '45%',
                          transform: `translateX(-50%) rotate(${angle}deg)`,
                        }}
                      >
                        <div
                          className="w-full h-full rounded-full"
                          style={{
                            background: `linear-gradient(to top, ${getGlowColor()}, white)`,
                            boxShadow: rpm > 100 ? `0 0 20px ${getGlowColor()}` : 'none',
                          }}
                        />
                      </div>
                    ))}
                  </motion.div>

                  {/* Center hub */}
                  <div
                    className="absolute w-12 h-12 rounded-full bg-slate-700 border-4 flex items-center justify-center"
                    style={{
                      borderColor: getGlowColor(),
                      boxShadow: `0 0 20px ${getGlowColor()}60`,
                    }}
                  >
                    <Zap
                      className="w-6 h-6"
                      style={{ color: getGlowColor() }}
                    />
                  </div>
                </div>

                {/* Touch hint */}
                {rpm < 10 && (
                  <motion.p
                    className="absolute bottom-4 left-0 right-0 text-center text-slate-500 text-sm"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    원을 그리며 스와이프하세요!
                  </motion.p>
                )}
              </div>
            </div>
          )}

          {/* Finished State */}
          {gameState === 'finished' && (
            <motion.div
              className="p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.div
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 360] }}
                transition={{ duration: 0.6 }}
              >
                <Trophy className="w-10 h-10 text-white" />
              </motion.div>

              <h3 className="text-2xl font-bold text-white mb-2">게임 종료!</h3>

              <div className="space-y-3 my-6 p-4 bg-white/5 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-slate-400">총 회전수</span>
                  <span className="text-white font-bold">{Math.floor(totalSpins)} 바퀴</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">콤보 보너스</span>
                  <span className="font-bold" style={{ color: comboTier?.color || '#00D4FF' }}>
                    {comboTier ? `x${comboTier.multiplier}` : 'x1'}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between">
                  <span className="text-slate-300 font-medium">오늘의 총 발전량</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    {earnedExp} EXP
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <motion.button
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold flex items-center justify-center gap-2"
                  onClick={handleRecordExp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <BookOpen className="w-5 h-5" />
                  운전일지 기록 (+{earnedExp} EXP)
                </motion.button>
                <motion.button
                  className="w-full py-3 rounded-xl bg-white/10 text-slate-300 font-medium"
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
