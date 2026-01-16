'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  Shield,
  Gamepad2,
  User,
  Home,
  Bell,
  UserCircle,
  ChevronRight,
  Sparkles,
  Trophy,
  Zap,
  Rocket,
  Construction,
  MapPin,
  Check,
  X,
  CalendarCheck,
  Gift,
  Target,
  Clock,
  TestTube,
  Crown,
} from 'lucide-react'

// ==================== Types ====================
interface UserData {
  nickname: string
  characterId: number
  level: number
  exp: number
  badges: number
  totalExp: number
}

interface CheckInRecord {
  morning: boolean
  lunch: boolean
  evening: boolean
}

interface CheckInHistory {
  [date: string]: CheckInRecord
}

type TimeSlot = 'morning' | 'lunch' | 'evening'

interface Character {
  id: number
  name: string
  file: string
  description: string
}

// ==================== Constants ====================
const CHARACTERS: Character[] = [
  { id: 1, name: 'Tobby', file: '1. Tobby.png', description: '신입사원' },
  { id: 2, name: 'Volty', file: '2. Volty.png', description: '신입사원' },
  { id: 3, name: 'Lumi', file: '3. Lumi.png', description: '신입사원' },
  { id: 4, name: 'Windy', file: '4. Windy.png', description: '신입사원' },
  { id: 5, name: 'Solar', file: '5. Solar.png', description: '신입사원' },
  { id: 6, name: 'Green', file: '7. Green.png', description: '신입사원' },
]

const STORAGE_KEY = 'kepco_ai_zone_user'
const CHECKIN_HISTORY_KEY = 'checkInHistory'
const TEST_MODE_KEY = 'kepco_test_mode'

// GPS 설정 - 한전 경남본부 좌표 (필요시 수정)
const TARGET_LAT = 35.1795
const TARGET_LNG = 129.0756
const ALLOWED_RADIUS = 100

// EXP 설정
const EXP_NFC = 20
const EXP_GPS = 10
const EXP_PER_LEVEL = 100

// 타임슬롯 설정
const TIME_SLOTS: { id: TimeSlot; name: string; startHour: number; endHour: number; icon: string }[] = [
  { id: 'morning', name: '출근', startHour: 8, endHour: 10, icon: '🌅' },
  { id: 'lunch', name: '점심', startHour: 11, endHour: 13, icon: '🍱' },
  { id: 'evening', name: '퇴근', startHour: 17, endHour: 19, icon: '🌆' },
]

// ==================== Animation Variants ====================
const pageTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.05 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
}

// ==================== Check-In Utilities ====================
const getTodayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const getCurrentTimeSlot = (testMode: boolean = false): TimeSlot | null => {
  if (testMode) return 'morning' // 테스트 모드에서는 항상 출석 가능
  const hour = new Date().getHours()
  for (const slot of TIME_SLOTS) {
    if (hour >= slot.startHour && hour < slot.endHour) {
      return slot.id
    }
  }
  return null
}

const getCheckInHistory = (): CheckInHistory => {
  if (typeof window === 'undefined') return {}
  const stored = localStorage.getItem(CHECKIN_HISTORY_KEY)
  return stored ? JSON.parse(stored) : {}
}

const saveCheckInHistory = (history: CheckInHistory) => {
  localStorage.setItem(CHECKIN_HISTORY_KEY, JSON.stringify(history))
}

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ==================== Utility Components ====================
const GlassCard = ({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) => (
  <motion.div
    className={`glass rounded-2xl overflow-hidden ${className}`}
    onClick={onClick}
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    transition={springConfig}
  >
    {children}
  </motion.div>
)

const GradientButton = ({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) => (
  <motion.button
    className={`
      w-full py-4 px-6 rounded-xl font-semibold text-white
      bg-gradient-to-r from-kepco-blue to-kepco-cyan
      disabled:opacity-50 disabled:cursor-not-allowed
      shadow-lg shadow-kepco-blue/30
      ${className}
    `}
    onClick={onClick}
    disabled={disabled}
    whileHover={!disabled ? { scale: 1.02, boxShadow: '0 20px 40px rgba(0, 69, 140, 0.4)' } : {}}
    whileTap={!disabled ? { scale: 0.98 } : {}}
    transition={springConfig}
  >
    {children}
  </motion.button>
)

// ==================== Test Mode Toggle ====================
const TestModeToggle = ({
  testMode,
  onToggle,
}: {
  testMode: boolean
  onToggle: () => void
}) => (
  <motion.button
    className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium ${
      testMode
        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
        : 'bg-white/5 text-slate-500 border border-white/10'
    }`}
    onClick={onToggle}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <TestTube className="w-4 h-4" />
    {testMode ? 'TEST ON' : 'TEST'}
  </motion.button>
)

// ==================== Golden Pass Animation ====================
const GoldenPassAnimation = ({ show }: { show: boolean }) => {
  if (!show) return null

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Golden particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full"
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: (Math.random() - 0.5) * 300,
            y: (Math.random() - 0.5) * 300,
            scale: [0, 1, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Main text */}
      <motion.div
        className="text-center"
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: [0, 1.2, 1], rotate: [10, -5, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.div
          className="flex items-center justify-center gap-3 mb-2"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1, repeat: 3 }}
        >
          <Crown className="w-12 h-12 text-yellow-400" />
        </motion.div>
        <motion.h2
          className="text-4xl font-black bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500 bg-clip-text text-transparent"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, repeat: 5 }}
        >
          GOLDEN PASS
        </motion.h2>
        <motion.p
          className="text-yellow-400/80 text-lg mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          +{EXP_NFC} EXP 하이패스 보너스!
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

// ==================== Check-In Modal ====================
const CheckInModal = ({
  isOpen,
  onClose,
  isNFC,
  userData,
  onCheckInSuccess,
  selectedCharacter,
  testMode,
}: {
  isOpen: boolean
  onClose: () => void
  isNFC: boolean
  userData: UserData
  onCheckInSuccess: (exp: number, isNFC: boolean) => void
  selectedCharacter: Character | undefined
  testMode: boolean
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'no-slot' | 'already'>('idle')
  const [message, setMessage] = useState('')
  const [earnedExp, setEarnedExp] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const [showGoldenPass, setShowGoldenPass] = useState(false)

  const currentSlot = getCurrentTimeSlot(testMode)
  const currentSlotInfo = TIME_SLOTS.find(s => s.id === currentSlot)
  const todayKey = testMode ? `test-${Date.now()}` : getTodayKey()
  const history = getCheckInHistory()
  const todayRecord = testMode ? { morning: false, lunch: false, evening: false } : (history[todayKey] || { morning: false, lunch: false, evening: false })

  const triggerVibration = () => {
    if (navigator.vibrate) {
      navigator.vibrate(isNFC ? [100, 50, 100, 50, 100] : [100, 50, 100])
    }
  }

  const performCheckIn = async (viaGPS: boolean = false) => {
    if (!currentSlot && !testMode) {
      setStatus('no-slot')
      setMessage('현재는 출석 가능 시간이 아닙니다')
      return
    }

    const checkSlot = currentSlot || 'morning'

    if (todayRecord[checkSlot] && !testMode) {
      setStatus('already')
      setMessage('이미 이 시간대에 출석하셨습니다')
      return
    }

    setStatus('loading')

    // GPS 인증 (NFC가 아닌 경우)
    if (viaGPS && !isNFC && !testMode) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        })

        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          TARGET_LAT,
          TARGET_LNG
        )

        if (distance > ALLOWED_RADIUS) {
          setStatus('error')
          setMessage(`위치 확인 실패 (${Math.round(distance)}m 떨어져 있음)`)
          return
        }
      } catch {
        setStatus('error')
        setMessage('위치 정보를 가져올 수 없습니다')
        return
      }
    }

    // 출석 성공 처리
    const exp = isNFC ? EXP_NFC : EXP_GPS
    setEarnedExp(exp)

    // NFC 골든 패스 애니메이션
    if (isNFC) {
      setShowGoldenPass(true)
      setTimeout(() => setShowGoldenPass(false), 2500)
    }

    // 히스토리 업데이트 (테스트 모드가 아닌 경우만)
    if (!testMode) {
      const newHistory = {
        ...history,
        [todayKey]: {
          ...todayRecord,
          [checkSlot]: true,
        },
      }
      saveCheckInHistory(newHistory)
    }

    // 유저 데이터 업데이트
    onCheckInSuccess(exp, isNFC)

    setStatus('success')
    setMessage(isNFC ? '🏆 GOLDEN PASS!' : '📍 GPS 인증 성공!')
    triggerVibration()

    setTimeout(() => setShowBubble(true), isNFC ? 2000 : 500)
  }

  useEffect(() => {
    if (isOpen && isNFC && status === 'idle') {
      performCheckIn(false)
    }
  }, [isOpen, isNFC])

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle')
      setMessage('')
      setShowBubble(false)
      setShowGoldenPass(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Golden Pass Animation */}
        <GoldenPassAnimation show={showGoldenPass} />

        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          className={`relative w-full max-w-sm rounded-3xl p-6 overflow-hidden ${
            status === 'success' && isNFC
              ? 'bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-pink-500/20 border border-yellow-500/30'
              : 'glass-strong'
          }`}
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          transition={springConfig}
        >
          {/* NFC Rainbow Effect */}
          {status === 'success' && isNFC && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-pink-500/20" />
            </motion.div>
          )}

          {/* Test Mode Badge */}
          {testMode && (
            <div className="absolute top-4 left-4 px-2 py-1 bg-yellow-500/20 rounded-full text-xs text-yellow-400 flex items-center gap-1">
              <TestTube className="w-3 h-3" />
              테스트 모드
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="text-center mb-6 relative z-10 mt-4">
            <motion.div
              className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                isNFC
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                  : 'bg-gradient-to-br from-kepco-blue to-kepco-cyan'
              }`}
              animate={status === 'success' ? { rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: status === 'success' ? 3 : 0 }}
            >
              {isNFC ? <Crown className="w-8 h-8 text-white" /> : <CalendarCheck className="w-8 h-8 text-white" />}
            </motion.div>
            <h2 className="text-2xl font-bold mb-1">
              {isNFC ? '🏆 NFC 하이패스' : '📍 GPS 출석'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isNFC ? `+${EXP_NFC} EXP 보너스!` : currentSlotInfo ? `${currentSlotInfo.icon} ${currentSlotInfo.name} 시간대` : '출석 가능 시간 확인'}
            </p>
          </div>

          {/* Status Display */}
          <div className="mb-6 relative z-10">
            {status === 'idle' && !isNFC && (
              <div className="text-center">
                <p className="text-slate-300 mb-4">현재 위치를 확인하여 출석합니다</p>
                <motion.button
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-kepco-blue to-kepco-cyan text-white font-semibold flex items-center justify-center gap-2"
                  onClick={() => performCheckIn(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MapPin className="w-5 h-5" />
                  GPS 인증하기 (+{EXP_GPS} EXP)
                </motion.button>
              </div>
            )}

            {status === 'loading' && (
              <div className="text-center py-8">
                <motion.div
                  className={`w-12 h-12 mx-auto border-4 rounded-full ${
                    isNFC ? 'border-yellow-400/30 border-t-yellow-400' : 'border-kepco-cyan/30 border-t-kepco-cyan'
                  }`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-slate-400 mt-4">{isNFC ? 'NFC 인증 중...' : '위치 확인 중...'}</p>
              </div>
            )}

            {status === 'success' && !showGoldenPass && (
              <motion.div
                className="text-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springConfig}
              >
                <motion.div
                  className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    isNFC
                      ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500'
                      : 'bg-gradient-to-br from-green-400 to-emerald-500'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  <Check className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h3
                  className={`text-2xl font-bold mb-2 ${
                    isNFC ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-400' : 'text-green-400'
                  }`}
                  animate={isNFC ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {message}
                </motion.h3>

                <motion.div
                  className="flex items-center justify-center gap-2 text-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Zap className={isNFC ? 'text-yellow-400' : 'text-kepco-cyan'} />
                  <span className="font-bold">+{earnedExp} EXP 적립!</span>
                </motion.div>

                {/* Character Bubble */}
                <AnimatePresence>
                  {showBubble && selectedCharacter && (
                    <motion.div
                      className="mt-6 flex items-end gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="w-16 h-16 rounded-full bg-deep-navy overflow-hidden relative flex-shrink-0">
                        <Image
                          src={`/images/character/${selectedCharacter.file}`}
                          alt={selectedCharacter.name}
                          fill
                          className="object-contain p-1"
                          sizes="64px"
                        />
                      </div>
                      <motion.div
                        className="relative bg-white/10 rounded-2xl rounded-bl-none px-4 py-3"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, ...springConfig }}
                      >
                        <p className="text-sm font-medium">
                          {isNFC ? '골든 패스 발동! 최고야! 🌟' : '출석 완료! 에너지 충전! ⚡'}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {(status === 'error' || status === 'no-slot' || status === 'already') && (
              <motion.div
                className="text-center py-4"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-medium">{message}</p>
                {status === 'no-slot' && (
                  <p className="text-slate-500 text-sm mt-2">
                    출석 시간: 08-10시, 11-13시, 17-19시
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* Today's Check-in Status */}
          <div className="border-t border-white/10 pt-4 relative z-10">
            <p className="text-xs text-slate-500 mb-3">오늘의 출석 현황</p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <div
                  key={slot.id}
                  className={`text-center p-2 rounded-lg ${
                    todayRecord[slot.id]
                      ? 'bg-green-500/20 text-green-400'
                      : currentSlot === slot.id
                      ? 'bg-kepco-cyan/20 text-kepco-cyan'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  <span className="text-lg">{slot.icon}</span>
                  <p className="text-xs mt-1">{slot.name}</p>
                  {todayRecord[slot.id] && <Check className="w-3 h-3 mx-auto mt-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* EXP Info */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">NFC 하이패스</span>
              <span className="text-yellow-400 font-medium">+{EXP_NFC} EXP</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">GPS 인증</span>
              <span className="text-kepco-cyan font-medium">+{EXP_GPS} EXP</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ==================== Mission Card ====================
const MissionCard = () => (
  <motion.div variants={fadeInUp} className="mb-4">
    <GlassCard className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">EXP 획득 방법</h3>
          <p className="text-slate-400 text-xs">미션을 완료하고 레벨업하세요!</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* NFC */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-400">NFC 키링 태그</p>
              <p className="text-xs text-slate-500">하이패스 보너스</p>
            </div>
          </div>
          <span className="text-lg font-bold text-yellow-400">+{EXP_NFC}</span>
        </div>

        {/* GPS */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-kepco-cyan/20 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-kepco-cyan" />
            </div>
            <div>
              <p className="text-sm font-medium">일반 GPS 인증</p>
              <p className="text-xs text-slate-500">위치 확인 출석</p>
            </div>
          </div>
          <span className="text-lg font-bold text-kepco-cyan">+{EXP_GPS}</span>
        </div>

        {/* Game - Coming Soon */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Gamepad2 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">게임 참여</p>
              <p className="text-xs text-slate-500">추후 업데이트</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full">COMING</span>
        </div>
      </div>
    </GlassCard>
  </motion.div>
)

// ==================== Onboarding Screen ====================
const OnboardingScreen = ({
  onComplete,
}: {
  onComplete: (data: UserData) => void
}) => {
  const [nickname, setNickname] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null)
  const [step, setStep] = useState<'nickname' | 'character'>('nickname')

  const handleSubmit = () => {
    if (nickname.trim() && selectedCharacter) {
      const userData: UserData = {
        nickname: nickname.trim(),
        characterId: selectedCharacter,
        level: 1,
        exp: 0,
        badges: 0,
        totalExp: 0,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
      onComplete(userData)
    }
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      transition={{ duration: 0.5 }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 -left-20 w-60 h-60 bg-kepco-cyan/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-20 w-80 h-80 bg-kepco-blue/30 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>

      {/* Logo */}
      <motion.div
        className="text-center mb-10 z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 mb-4"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Zap className="w-8 h-8 text-kepco-cyan" />
        </motion.div>
        <h1 className="text-3xl font-bold text-gradient mb-2">KEPCO AI ZONE</h1>
        <p className="text-slate-400 text-sm">경남본부 AI 혁신 플랫폼</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'nickname' ? (
          <motion.div
            key="nickname"
            className="w-full max-w-sm z-10"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="text-center mb-6">
                <Sparkles className="w-10 h-10 text-kepco-cyan mx-auto mb-3" />
                <h2 className="text-xl font-semibold mb-1">환영합니다!</h2>
                <p className="text-slate-400 text-sm">닉네임을 입력해주세요</p>
              </div>

              <div className="relative mb-6">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임 입력"
                  maxLength={10}
                  className="
                    w-full bg-white/5 border border-white/10 rounded-xl
                    px-4 py-4 text-white placeholder-slate-500
                    focus:outline-none focus:border-kepco-cyan/50
                    focus:ring-2 focus:ring-kepco-cyan/20
                    transition-all duration-300
                  "
                />
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-kepco-blue to-kepco-cyan"
                  initial={{ width: '0%' }}
                  animate={{ width: nickname ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <GradientButton
                onClick={() => setStep('character')}
                disabled={!nickname.trim()}
              >
                다음 <ChevronRight className="inline w-5 h-5 ml-1" />
              </GradientButton>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div
            key="character"
            className="w-full max-w-sm z-10"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-1">캐릭터 선택</h2>
                <p className="text-slate-400 text-sm">에너지 프렌즈를 선택해주세요</p>
              </div>

              <motion.div
                className="grid grid-cols-3 gap-3 mb-6"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {CHARACTERS.map((char) => (
                  <motion.div
                    key={char.id}
                    variants={fadeInUp}
                    className={`
                      relative cursor-pointer rounded-xl p-2 transition-all duration-300
                      ${selectedCharacter === char.id
                        ? 'bg-gradient-to-br from-kepco-blue/40 to-kepco-cyan/40 ring-2 ring-kepco-cyan'
                        : 'bg-white/5 hover:bg-white/10'
                      }
                    `}
                    onClick={() => setSelectedCharacter(char.id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={springConfig}
                  >
                    <div className="aspect-square relative mb-1">
                      <Image
                        src={`/images/character/${char.file}`}
                        alt={char.name}
                        fill
                        className="object-contain"
                        sizes="100px"
                      />
                    </div>
                    <p className="text-xs text-center text-slate-300 truncate">{char.name}</p>
                    {selectedCharacter === char.id && (
                      <motion.div
                        className="absolute -top-1 -right-1 w-5 h-5 bg-kepco-cyan rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={springConfig}
                      >
                        <span className="text-xs">✓</span>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300"
                  onClick={() => setStep('nickname')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  이전
                </motion.button>
                <GradientButton
                  onClick={handleSubmit}
                  disabled={!selectedCharacter}
                  className="flex-1"
                >
                  시작하기 <Rocket className="inline w-5 h-5 ml-1" />
                </GradientButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ==================== Dashboard Screen ====================
const DashboardScreen = ({
  userData,
  onUpdateUserData,
  isNFCAccess,
  testMode,
  onToggleTestMode,
}: {
  userData: UserData
  onUpdateUserData: (data: UserData) => void
  isNFCAccess: boolean
  testMode: boolean
  onToggleTestMode: () => void
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const selectedCharacter = CHARACTERS.find((c) => c.id === userData.characterId)

  const expPercent = (userData.exp / EXP_PER_LEVEL) * 100

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId)
  }

  const handleCheckInSuccess = (exp: number) => {
    const newTotalExp = (userData.totalExp || 0) + exp
    const newExp = userData.exp + exp
    const levelUps = Math.floor(newExp / EXP_PER_LEVEL)
    const updatedData: UserData = {
      ...userData,
      exp: newExp % EXP_PER_LEVEL,
      level: userData.level + levelUps,
      totalExp: newTotalExp,
    }
    onUpdateUserData(updatedData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))
  }

  useEffect(() => {
    if (isNFCAccess) {
      setShowCheckInModal(true)
    }
  }, [isNFCAccess])

  return (
    <motion.div
      className="min-h-screen pb-24 relative"
      initial="initial"
      animate="animate"
      variants={pageTransition}
      transition={{ duration: 0.5 }}
    >
      {/* Test Mode Toggle */}
      <TestModeToggle testMode={testMode} onToggle={onToggleTestMode} />

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-kepco-blue/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.header
        className="pt-8 pb-6 px-6 text-center relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 mb-2"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className="w-6 h-6 text-kepco-cyan" />
          <h1 className="text-2xl font-bold text-gradient">KEPCO AI ZONE</h1>
          <Zap className="w-6 h-6 text-kepco-cyan" />
        </motion.div>
        <p className="text-slate-400 text-sm">경남본부 AI 혁신 플랫폼</p>
      </motion.header>

      {/* Profile Section */}
      <motion.section
        className="px-6 mb-6 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            className="character-orb w-20 h-20 flex-shrink-0"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-full h-full rounded-full bg-deep-navy overflow-hidden relative">
              {selectedCharacter && (
                <Image
                  src={`/images/character/${selectedCharacter.file}`}
                  alt={selectedCharacter.name}
                  fill
                  className="object-contain p-1"
                  sizes="80px"
                />
              )}
            </div>
          </motion.div>

          <div className="flex-1">
            <motion.h2
              className="text-xl font-bold text-white mb-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {userData.nickname} <span className="text-slate-400 font-normal">님</span>
            </motion.h2>
            <motion.p
              className="text-sm text-kepco-cyan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {selectedCharacter?.description}
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Bento Grid */}
      <motion.section
        className="px-6 relative z-10"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* MY PAGE Card */}
        <motion.div variants={fadeInUp} className="mb-4">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-kepco-blue to-kepco-cyan flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">MY PAGE</h3>
                  <p className="text-slate-400 text-sm">나의 활동 현황</p>
                </div>
              </div>
              <motion.button
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium"
                onClick={() => setShowCheckInModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <CalendarCheck className="w-4 h-4" />
                출석하기
              </motion.button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-kepco-cyan">Lv.{userData.level}</div>
                <div className="text-xs text-slate-400">레벨</div>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">EXP</span>
                  <span className="text-xs text-kepco-cyan">{userData.exp}/{EXP_PER_LEVEL}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-kepco-blue to-kepco-cyan"
                    initial={{ width: 0 }}
                    animate={{ width: `${expPercent}%` }}
                    transition={{ delay: 0.5, duration: 1 }}
                  />
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{userData.badges}</span>
                </div>
                <div className="text-xs text-slate-400">뱃지</div>
              </div>
            </div>

            {/* Total EXP */}
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs text-slate-500">누적 EXP</span>
              <span className="text-sm font-medium text-kepco-cyan">{userData.totalExp || 0} EXP</span>
            </div>
          </GlassCard>
        </motion.div>

        {/* Mission Card */}
        <MissionCard />

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* AI App Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer"
              onClick={() => toggleCard('ai')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">AI app</h3>
              <p className="text-xs text-slate-400 mb-3">AI 서비스 List</p>

              <AnimatePresence>
                {expandedCard === 'ai' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springConfig}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <motion.a
                        href="https://knai-safetyprompt-web.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-kepco-blue/50 to-kepco-cyan/50 text-xs text-left block"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        AI 프롬프트 보안검증
                      </motion.a>
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-xs text-slate-400 text-left flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Construction className="w-3 h-3" /> 개발중
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-2"
                animate={{ rotate: expandedCard === 'ai' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>

          {/* GAME Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer"
              onClick={() => toggleCard('game')}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mb-3">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">GAME</h3>
              <p className="text-xs text-slate-400 mb-1">보상을 통한 에너지 학습</p>
              <p className="text-[10px] text-kepco-cyan">참여 시 EXP 적립</p>

              <AnimatePresence>
                {expandedCard === 'game' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springConfig}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-xs text-slate-400 text-left flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Construction className="w-3 h-3" /> 개발중
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-2"
                animate={{ rotate: expandedCard === 'game' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>
        </div>
      </motion.section>

      {/* Floating Navigation Bar */}
      <motion.nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, ...springConfig }}
      >
        <div className="glass-strong rounded-2xl px-8 py-4 flex items-center gap-8 shadow-2xl shadow-black/30">
          <NavButton icon={<Home className="w-6 h-6" />} label="홈" active />
          <NavButton icon={<Bell className="w-6 h-6" />} label="알림" />
          <NavButton icon={<UserCircle className="w-6 h-6" />} label="프로필" />
        </div>
      </motion.nav>

      {/* Check-In Modal */}
      <CheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        isNFC={isNFCAccess}
        userData={userData}
        onCheckInSuccess={handleCheckInSuccess}
        selectedCharacter={selectedCharacter}
        testMode={testMode}
      />
    </motion.div>
  )
}

// ==================== Navigation Button ====================
const NavButton = ({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) => (
  <motion.button
    className={`flex flex-col items-center gap-1 ${
      active ? 'text-kepco-cyan' : 'text-slate-500'
    }`}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    transition={springConfig}
  >
    {icon}
    <span className="text-[10px]">{label}</span>
    {active && (
      <motion.div
        className="absolute -bottom-1 w-1 h-1 bg-kepco-cyan rounded-full"
        layoutId="nav-indicator"
      />
    )}
  </motion.button>
)

// ==================== Main App Component ====================
function MainContent() {
  const searchParams = useSearchParams()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isNFCAccess, setIsNFCAccess] = useState(false)
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    // NFC 접속 확인
    const source = searchParams.get('source')
    if (source === 'nfc') {
      setIsNFCAccess(true)
    }

    // 테스트 모드 확인
    const savedTestMode = localStorage.getItem(TEST_MODE_KEY)
    if (savedTestMode === 'true') {
      setTestMode(true)
    }

    // Check localStorage for existing user
    const storedData = localStorage.getItem(STORAGE_KEY)
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        // totalExp가 없으면 초기화
        if (parsed.totalExp === undefined) {
          parsed.totalExp = 0
        }
        setUserData(parsed)
      } catch {
        setShowOnboarding(true)
      }
    } else {
      setShowOnboarding(true)
    }
    setIsLoading(false)
  }, [searchParams])

  const handleOnboardingComplete = useCallback((data: UserData) => {
    setUserData(data)
    setShowOnboarding(false)
  }, [])

  const handleUpdateUserData = useCallback((data: UserData) => {
    setUserData(data)
  }, [])

  const handleToggleTestMode = useCallback(() => {
    setTestMode(prev => {
      const newValue = !prev
      localStorage.setItem(TEST_MODE_KEY, String(newValue))
      return newValue
    })
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="w-16 h-16 border-4 border-kepco-cyan/30 border-t-kepco-cyan rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {showOnboarding || !userData ? (
        <OnboardingScreen
          key="onboarding"
          onComplete={handleOnboardingComplete}
        />
      ) : (
        <DashboardScreen
          key="dashboard"
          userData={userData}
          onUpdateUserData={handleUpdateUserData}
          isNFCAccess={isNFCAccess}
          testMode={testMode}
          onToggleTestMode={handleToggleTestMode}
        />
      )}
    </AnimatePresence>
  )
}

export default function KepcoAIZone() {
  return (
    <main className="min-h-screen noise-overlay">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            className="w-16 h-16 border-4 border-kepco-cyan/30 border-t-kepco-cyan rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      }>
        <MainContent />
      </Suspense>
    </main>
  )
}
