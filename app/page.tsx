'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Shield,
  Gamepad2,
  User,
  Home,
  Bell,
  UserCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Trophy,
  Zap,
  Rocket,
  Construction,
  MapPin,
  Check,
  X,
  CalendarCheck,
  Target,
  TestTube,
  Crown,
  Star,
  Settings,
  RotateCcw,
  AlertTriangle,
  Youtube,
  Telescope,
  Newspaper,
  ExternalLink,
  Wind,
  Wrench,
  BookOpen,
  Code2,
  Video,
  Music,
  ShieldAlert,
} from 'lucide-react'

// Games
import { WindTurbineGame } from './games'

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

interface AIClickRecord {
  date: string
  count: number
}

interface LinkClickRecord {
  date: string
  clickedLinks: string[]
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
const AI_CLICK_KEY = 'kepco_ai_click'
const LINK_CLICK_KEY = 'kepco_link_click'

// GPS 설정 - 한전 경남본부 좌표 (필요시 수정)
const TARGET_LAT = 35.1795
const TARGET_LNG = 129.0756
const ALLOWED_RADIUS = 100

// EXP 설정
const EXP_NFC = 20
const EXP_GPS = 10
const EXP_AI_CLICK = 2
const EXP_AI_CLICK_MAX_DAILY = 5
const EXP_LINK_CLICK = 5
const EXP_PER_LEVEL = 100

// 타임슬롯 설정
const TIME_SLOTS: { id: TimeSlot; name: string; startHour: number; endHour: number; icon: string }[] = [
  { id: 'morning', name: '출근', startHour: 8, endHour: 10, icon: '🌅' },
  { id: 'lunch', name: '점심', startHour: 11, endHour: 13, icon: '🍱' },
  { id: 'evening', name: '퇴근', startHour: 17, endHour: 19, icon: '🌆' },
]

// AI TOOL 설정
interface AITool {
  id: string
  name: string
  category: string
  url: string
  bgClass: string
  hoverShadow: string
  icon: 'BookOpen' | 'Code2' | 'Video' | 'Music'
}

const AI_TOOLS: AITool[] = [
  // 자료조사
  { id: 'notebooklm', name: 'NotebookLM', category: '자료조사', url: 'https://notebooklm.google/', bgClass: 'bg-blue-500/20 hover:bg-blue-500/30', hoverShadow: 'rgba(59, 130, 246, 0.4)', icon: 'BookOpen' },
  // 바이브코딩 (4개)
  { id: 'claude-ai', name: 'Claude AI', category: '바이브코딩', url: 'https://claude.ai/new', bgClass: 'bg-purple-500/20 hover:bg-purple-500/30', hoverShadow: 'rgba(168, 85, 247, 0.4)', icon: 'Code2' },
  { id: 'google-ai-studio', name: 'Google AI Studio', category: '바이브코딩', url: 'https://aistudio.google.com/', bgClass: 'bg-violet-500/20 hover:bg-violet-500/30', hoverShadow: 'rgba(139, 92, 246, 0.4)', icon: 'Code2' },
  { id: 'bolt-new', name: 'Bolt.new', category: '바이브코딩', url: 'https://bolt.new/', bgClass: 'bg-indigo-500/20 hover:bg-indigo-500/30', hoverShadow: 'rgba(99, 102, 241, 0.4)', icon: 'Code2' },
  { id: 'cursor-ai', name: 'Cursor AI', category: '바이브코딩', url: 'https://cursor.com/agents', bgClass: 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30', hoverShadow: 'rgba(217, 70, 239, 0.4)', icon: 'Code2' },
  // 영상생성
  { id: 'invideo', name: 'Invideo', category: '영상생성', url: 'https://ai.invideo.io', bgClass: 'bg-red-500/20 hover:bg-red-500/30', hoverShadow: 'rgba(239, 68, 68, 0.4)', icon: 'Video' },
  // 음악생성
  { id: 'suno', name: 'Suno AI', category: '음악생성', url: 'https://suno.com/', bgClass: 'bg-green-500/20 hover:bg-green-500/30', hoverShadow: 'rgba(34, 197, 94, 0.4)', icon: 'Music' },
]

const AI_TOOL_CLICK_KEY = 'kepco_ai_tool_click'

interface AIToolClickRecord {
  date: string
  clickedTools: string[]
}

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

const getAIClickRecord = (): AIClickRecord => {
  if (typeof window === 'undefined') return { date: '', count: 0 }
  const stored = localStorage.getItem(AI_CLICK_KEY)
  if (stored) {
    const record = JSON.parse(stored)
    if (record.date === getTodayKey()) {
      return record
    }
  }
  return { date: getTodayKey(), count: 0 }
}

const saveAIClickRecord = (record: AIClickRecord) => {
  localStorage.setItem(AI_CLICK_KEY, JSON.stringify(record))
}

const getLinkClickRecord = (): LinkClickRecord => {
  if (typeof window === 'undefined') return { date: '', clickedLinks: [] }
  const stored = localStorage.getItem(LINK_CLICK_KEY)
  if (stored) {
    const record = JSON.parse(stored)
    if (record.date === getTodayKey()) {
      return record
    }
  }
  return { date: getTodayKey(), clickedLinks: [] }
}

const saveLinkClickRecord = (record: LinkClickRecord) => {
  localStorage.setItem(LINK_CLICK_KEY, JSON.stringify(record))
}

const getAIToolClickRecord = (): AIToolClickRecord => {
  if (typeof window === 'undefined') return { date: '', clickedTools: [] }
  const stored = localStorage.getItem(AI_TOOL_CLICK_KEY)
  if (stored) {
    const record = JSON.parse(stored)
    if (record.date === getTodayKey()) {
      return record
    }
  }
  return { date: getTodayKey(), clickedTools: [] }
}

const saveAIToolClickRecord = (record: AIToolClickRecord) => {
  localStorage.setItem(AI_TOOL_CLICK_KEY, JSON.stringify(record))
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

// ==================== Settings Panel ====================
const SettingsPanel = ({
  isOpen,
  onClose,
  testMode,
  onToggleTestMode,
  onResetData,
}: {
  isOpen: boolean
  onClose: () => void
  testMode: boolean
  onToggleTestMode: () => void
  onResetData: () => void
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[500] flex items-start justify-end p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          className="relative mt-12 w-72 glass-strong rounded-2xl p-5 shadow-2xl"
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          transition={springConfig}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-white">설정</h3>
            </div>
            <motion.button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Test Mode Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  testMode ? 'bg-yellow-500/20' : 'bg-slate-500/20'
                }`}>
                  <TestTube className={`w-4 h-4 ${testMode ? 'text-yellow-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">테스트 모드</p>
                  <p className="text-xs text-slate-500">시간/위치 제한 해제</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <motion.button
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  testMode ? 'bg-yellow-500' : 'bg-slate-600'
                }`}
                onClick={onToggleTestMode}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                  animate={{ left: testMode ? '26px' : '4px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>

            {/* Test Mode Active Indicator */}
            <AnimatePresence>
              {testMode && (
                <motion.div
                  className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <p className="text-xs text-yellow-400">
                    테스트 모드 활성화됨 - 출석 제한이 해제됩니다
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-4" />

          {/* Reset Data Button */}
          <motion.button
            className="w-full flex items-center justify-between p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/30 transition-colors"
            onClick={() => setShowResetConfirm(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-red-400">데이터 초기화</p>
                <p className="text-xs text-slate-500">모든 데이터 삭제</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </motion.button>

          {/* Reset Confirmation Modal */}
          <AnimatePresence>
            {showResetConfirm && (
              <motion.div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-center"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">데이터 초기화</h4>
                  <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                    모든 경험치, 닉네임, 캐릭터 정보가<br />
                    영구 삭제됩니다.<br />
                    <span className="text-red-400 font-medium">초기화할까요?</span>
                  </p>
                  <div className="flex gap-2">
                    <motion.button
                      className="flex-1 py-2 px-4 bg-white/10 rounded-xl text-sm text-slate-300"
                      onClick={() => setShowResetConfirm(false)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      취소
                    </motion.button>
                    <motion.button
                      className="flex-1 py-2 px-4 bg-red-500 rounded-xl text-sm text-white font-medium"
                      onClick={() => {
                        onResetData()
                        setShowResetConfirm(false)
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      초기화
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ==================== Settings Button ====================
const SettingsButton = ({
  onClick,
  testMode,
}: {
  onClick: () => void
  testMode: boolean
}) => (
  <motion.button
    className={`fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center ${
      testMode
        ? 'bg-yellow-500/20 border border-yellow-500/50'
        : 'bg-white/5 border border-white/10'
    }`}
    onClick={onClick}
    whileHover={{ scale: 1.1, rotate: 90 }}
    whileTap={{ scale: 0.9 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
  >
    <Settings className={`w-5 h-5 ${testMode ? 'text-yellow-400' : 'text-slate-400'}`} />
    {/* Test Mode Indicator Dot */}
    {testMode && (
      <motion.div
        className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    )}
  </motion.button>
)

// ==================== Floating EXP Animation ====================
const FloatingPointAnimation = ({ show, x, y, amount }: { show: boolean; x: number; y: number; amount: number }) => {
  if (!show) return null

  return (
    <motion.div
      className="fixed z-[300] pointer-events-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -60, scale: 1.5 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-kepco-cyan to-green-400 drop-shadow-lg">
        +{amount}
      </span>
    </motion.div>
  )
}

// ==================== Link EXP Celebration Animation ====================
const LinkExpCelebration = ({ show, onComplete }: { show: boolean; onComplete: () => void }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 2000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show) return null

  return (
    <motion.div
      className="fixed inset-0 z-[350] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Particle Burst */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: ['#00D4FF', '#A855F7', '#22C55E', '#FBBF24', '#EC4899'][i % 5],
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
            scale: [0, 1.5, 0],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1, delay: i * 0.03, ease: 'easeOut' }}
        />
      ))}

      {/* Main Content */}
      <motion.div
        className="text-center"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div
          className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.3, repeat: 3 }}
        >
          +{EXP_LINK_CLICK} EXP!
        </motion.div>
        <motion.p
          className="text-white/80 text-sm mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          미션 보너스 획득!
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

// ==================== AI Tool EXP Toast ====================
const AIToolExpToast = ({ show, onComplete }: { show: boolean; onComplete: () => void }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 2500)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show) return null

  return (
    <motion.div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[450] pointer-events-none"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
    >
      <div className="glass-strong rounded-2xl px-6 py-4 shadow-2xl border border-green-500/30">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <p className="text-green-400 font-semibold text-sm" style={{ wordBreak: 'keep-all' }}>오늘의 AI 학습 포인트</p>
            <p className="text-white font-bold">+{EXP_LINK_CLICK} EXP 지급 완료!</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ==================== Security Consent Modal ====================
interface SecurityConsentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  toolName: string
}

const SecurityConsentModal = ({ isOpen, onClose, onConfirm, toolName }: SecurityConsentModalProps) => {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[500] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative glass-strong rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-yellow-500/30"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={springConfig}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white" style={{ wordBreak: 'keep-all' }}>보안 준수 확인</h3>
              <p className="text-xs text-slate-400">{toolName}</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-200 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                외부 AI 서비스 이용 시 아래 사항을 준수해 주세요.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2" style={{ wordBreak: 'keep-all' }}>
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span>회사 내부 자료 입력 금지</span>
              </li>
              <li className="flex items-start gap-2" style={{ wordBreak: 'keep-all' }}>
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span>개인정보 및 민감정보 입력 금지</span>
              </li>
              <li className="flex items-start gap-2" style={{ wordBreak: 'keep-all' }}>
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span>업무용 비밀번호 입력 금지</span>
              </li>
              <li className="flex items-start gap-2" style={{ wordBreak: 'keep-all' }}>
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>학습 및 업무 효율화 목적으로만 사용</span>
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <motion.button
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-slate-300 font-medium"
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              취소
            </motion.button>
            <motion.button
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg"
              onClick={onConfirm}
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(34, 197, 94, 0.5)' }}
              whileTap={{ scale: 0.98 }}
            >
              동의 및 이동
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ==================== Level Up Popup ====================
const LevelUpPopup = ({ show, level, onClose }: { show: boolean; level: number; onClose: () => void }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  if (!show) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[400] flex items-center justify-center pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Confetti Particles */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              backgroundColor: ['#FFD700', '#00D4FF', '#FF6B6B', '#4ECDC4', '#A855F7'][i % 5],
            }}
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: (Math.random() - 0.5) * 400,
              y: (Math.random() - 0.5) * 400,
              scale: [0, 1.5, 0],
              opacity: [1, 1, 0],
              rotate: Math.random() * 360,
            }}
            transition={{
              duration: 2,
              delay: i * 0.03,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Main Content */}
        <motion.div
          className="relative z-10 text-center p-8"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: [0, 1.2, 1], rotate: [10, -5, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            className="flex items-center justify-center gap-3 mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <Star className="w-16 h-16 text-yellow-400 fill-yellow-400" />
          </motion.div>

          <motion.h2
            className="text-5xl font-black mb-2"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500">
              LEVEL UP!
            </span>
          </motion.h2>

          <motion.div
            className="text-6xl font-black text-white mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Lv.{level}
          </motion.div>

          <motion.p
            className="text-slate-300 text-lg mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            축하합니다! 🎉
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

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

// ==================== EXP Accordion Section ====================
const ExpAccordion = ({ aiClickCount }: { aiClickCount: number }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <motion.button
        className="w-full flex items-center justify-between text-sm"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <span className="text-slate-300 font-medium">EXP 획득 방법</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-3">
              {/* NFC */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-400">NFC 키링 태그</span>
                </div>
                <span className="text-sm font-bold text-yellow-400">+{EXP_NFC}</span>
              </div>

              {/* GPS */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-kepco-cyan" />
                  <span className="text-sm text-slate-300">일반 GPS 인증</span>
                </div>
                <span className="text-sm font-bold text-kepco-cyan">+{EXP_GPS}</span>
              </div>

              {/* AI 프롬프트 보안검증 */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <div className="flex flex-col">
                    <span className="text-sm text-blue-400">AI 프롬프트 보안검증 활용</span>
                    <span className="text-xs text-slate-500">오늘 {aiClickCount}/{EXP_AI_CLICK_MAX_DAILY}회</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-400">+{EXP_AI_CLICK}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== Intro Video Modal ====================
const IntroVideoModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) => {
  const handleVideoEnd = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[600] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Video Container */}
        <motion.div
          className="relative w-full max-w-2xl z-10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={springConfig}
        >
          {/* Neon Border Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-kepco-blue via-kepco-cyan to-kepco-blue rounded-2xl blur-sm opacity-75" />
          <div className="absolute -inset-0.5 bg-gradient-to-r from-kepco-blue via-kepco-cyan to-kepco-blue rounded-2xl opacity-50" />

          {/* Video Wrapper */}
          <div className="relative bg-deep-navy rounded-2xl overflow-hidden">
            {/* Close Button */}
            <motion.button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Video Player */}
            <video
              className="w-full aspect-video"
              autoPlay
              controls
              onEnded={handleVideoEnd}
              playsInline
            >
              <source src="/videos/intro.mp4" type="video/mp4" />
              브라우저가 비디오를 지원하지 않습니다.
            </video>
          </div>

          {/* Title */}
          <motion.p
            className="text-center text-slate-400 text-sm mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            KEPCO AI ZONE 소개 영상
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ==================== Onboarding Screen ====================
const OnboardingScreen = ({
  onComplete,
}: {
  onComplete: (data: UserData) => void
}) => {
  const [nickname, setNickname] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null)
  const [step, setStep] = useState<'nickname' | 'character'>('nickname')
  const [showIntroVideo, setShowIntroVideo] = useState(false)

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
      {/* Intro Video Modal */}
      <IntroVideoModal
        isOpen={showIntroVideo}
        onClose={() => setShowIntroVideo(false)}
      />

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

        {/* YouTube Intro Button */}
        <motion.button
          className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          onClick={() => setShowIntroVideo(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* YouTube Icon with Glow */}
          <motion.div
            className="relative"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-[#FF0000] rounded-full blur-md opacity-50" />
            <Youtube className="w-6 h-6 text-[#FF0000] relative z-10" />
          </motion.div>
          <span className="text-sm text-slate-300">인트로 영상 보기</span>
        </motion.button>
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
  onResetData,
}: {
  userData: UserData
  onUpdateUserData: (data: UserData) => void
  isNFCAccess: boolean
  testMode: boolean
  onToggleTestMode: () => void
  onResetData: () => void
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [newLevel, setNewLevel] = useState(1)
  const [floatingPoint, setFloatingPoint] = useState<{ show: boolean; x: number; y: number; amount: number }>({ show: false, x: 0, y: 0, amount: 2 })
  const [aiClickRecord, setAIClickRecord] = useState<AIClickRecord>({ date: '', count: 0 })
  const [linkClickRecord, setLinkClickRecord] = useState<LinkClickRecord>({ date: '', clickedLinks: [] })
  const [showSettings, setShowSettings] = useState(false)
  const [showLinkCelebration, setShowLinkCelebration] = useState(false)
  const [showWindTurbineGame, setShowWindTurbineGame] = useState(false)
  // AI TOOL 관련 state
  const [aiToolClickRecord, setAIToolClickRecord] = useState<AIToolClickRecord>({ date: '', clickedTools: [] })
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [pendingTool, setPendingTool] = useState<AITool | null>(null)
  const [showAIToolToast, setShowAIToolToast] = useState(false)

  const selectedCharacter = CHARACTERS.find((c) => c.id === userData.characterId)

  // 레벨 계산: 누적 EXP 기반
  const calculatedLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
  const expPercent = (userData.totalExp % EXP_PER_LEVEL) / EXP_PER_LEVEL * 100
  const currentLevelExp = userData.totalExp % EXP_PER_LEVEL

  useEffect(() => {
    setAIClickRecord(getAIClickRecord())
    setLinkClickRecord(getLinkClickRecord())
    setAIToolClickRecord(getAIToolClickRecord())
  }, [])

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId)
  }

  const handleCheckInSuccess = (exp: number) => {
    const newTotalExp = userData.totalExp + exp
    const oldLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
    const newLvl = Math.floor(newTotalExp / EXP_PER_LEVEL) + 1

    const updatedData: UserData = {
      ...userData,
      exp: newTotalExp % EXP_PER_LEVEL,
      level: newLvl,
      totalExp: newTotalExp,
    }
    onUpdateUserData(updatedData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))

    // 레벨업 체크
    if (newLvl > oldLevel) {
      setNewLevel(newLvl)
      setShowLevelUp(true)
    }
  }

  // 게임에서 EXP 획득 처리
  const handleGameExp = useCallback((exp: number) => {
    if (exp <= 0) return

    const newTotalExp = userData.totalExp + exp
    const oldLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
    const newLvl = Math.floor(newTotalExp / EXP_PER_LEVEL) + 1

    const updatedData: UserData = {
      ...userData,
      exp: newTotalExp % EXP_PER_LEVEL,
      level: newLvl,
      totalExp: newTotalExp,
    }
    onUpdateUserData(updatedData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))

    // 레벨업 체크
    if (newLvl > oldLevel) {
      setTimeout(() => {
        setNewLevel(newLvl)
        setShowLevelUp(true)
      }, 500)
    }
  }, [userData, onUpdateUserData])

  // 외부 링크 클릭 처리 (Simulation, News 등)
  const handleExternalLinkClick = (e: React.MouseEvent, linkId: string, url: string) => {
    e.stopPropagation()

    // 오늘 이 링크를 클릭했는지 확인
    const record = getLinkClickRecord()
    const alreadyClicked = record.clickedLinks.includes(linkId)

    // 아직 클릭 안한 경우 EXP 적립
    if (!alreadyClicked) {
      // 클릭 기록 업데이트
      const newRecord: LinkClickRecord = {
        date: getTodayKey(),
        clickedLinks: [...record.clickedLinks, linkId],
      }
      saveLinkClickRecord(newRecord)
      setLinkClickRecord(newRecord)

      // EXP 추가
      const newTotalExp = userData.totalExp + EXP_LINK_CLICK
      const oldLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
      const newLvl = Math.floor(newTotalExp / EXP_PER_LEVEL) + 1

      const updatedData: UserData = {
        ...userData,
        exp: newTotalExp % EXP_PER_LEVEL,
        level: newLvl,
        totalExp: newTotalExp,
      }
      onUpdateUserData(updatedData)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))

      // 화려한 EXP 애니메이션
      setShowLinkCelebration(true)

      // 레벨업 체크
      if (newLvl > oldLevel) {
        setTimeout(() => {
          setNewLevel(newLvl)
          setShowLevelUp(true)
        }, 2000)
      }
    }

    // 외부 링크로 이동
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 링크 보상 가능 여부 확인
  const canEarnLinkExp = (linkId: string) => {
    return !linkClickRecord.clickedLinks.includes(linkId)
  }

  // AI Tool 보상 가능 여부 확인
  const canEarnToolExp = (toolId: string) => {
    return !aiToolClickRecord.clickedTools.includes(toolId)
  }

  // AI Tool 클릭 시 보안 모달 열기
  const handleToolClick = (e: React.MouseEvent, tool: AITool) => {
    e.stopPropagation()
    setPendingTool(tool)
    setShowSecurityModal(true)
  }

  // 보안 동의 후 외부 링크로 이동
  const handleSecurityConfirm = () => {
    if (!pendingTool) return

    const toolId = pendingTool.id
    const url = pendingTool.url

    // 오늘 이 툴을 클릭했는지 확인
    const record = getAIToolClickRecord()
    const alreadyClicked = record.clickedTools.includes(toolId)

    // 아직 클릭 안한 경우 EXP 적립
    if (!alreadyClicked) {
      // 클릭 기록 업데이트
      const newRecord: AIToolClickRecord = {
        date: getTodayKey(),
        clickedTools: [...record.clickedTools, toolId],
      }
      saveAIToolClickRecord(newRecord)
      setAIToolClickRecord(newRecord)

      // EXP 추가
      const newTotalExp = userData.totalExp + EXP_LINK_CLICK
      const oldLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
      const newLvl = Math.floor(newTotalExp / EXP_PER_LEVEL) + 1

      const updatedData: UserData = {
        ...userData,
        exp: newTotalExp % EXP_PER_LEVEL,
        level: newLvl,
        totalExp: newTotalExp,
      }
      onUpdateUserData(updatedData)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))

      // 토스트 메시지 표시
      setShowAIToolToast(true)

      // 레벨업 체크
      if (newLvl > oldLevel) {
        setTimeout(() => {
          setNewLevel(newLvl)
          setShowLevelUp(true)
        }, 2500)
      }
    }

    // 모달 닫고 외부 링크로 이동
    setShowSecurityModal(false)
    setPendingTool(null)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleAIClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    // 오늘 클릭 횟수 확인
    const record = getAIClickRecord()
    const canEarnExp = record.count < EXP_AI_CLICK_MAX_DAILY

    // EXP 획득 가능한 경우에만 점수 추가
    if (canEarnExp) {
      // 클릭 기록 업데이트
      const newRecord = {
        date: getTodayKey(),
        count: record.count + 1,
      }
      saveAIClickRecord(newRecord)
      setAIClickRecord(newRecord)

      // EXP 추가
      const newTotalExp = userData.totalExp + EXP_AI_CLICK
      const oldLevel = Math.floor(userData.totalExp / EXP_PER_LEVEL) + 1
      const newLvl = Math.floor(newTotalExp / EXP_PER_LEVEL) + 1

      const updatedData: UserData = {
        ...userData,
        exp: newTotalExp % EXP_PER_LEVEL,
        level: newLvl,
        totalExp: newTotalExp,
      }
      onUpdateUserData(updatedData)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData))

      // +2 플로팅 애니메이션
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setFloatingPoint({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        amount: EXP_AI_CLICK,
      })
      setTimeout(() => setFloatingPoint({ show: false, x: 0, y: 0, amount: EXP_AI_CLICK }), 1200)

      // 레벨업 체크
      if (newLvl > oldLevel) {
        setTimeout(() => {
          setNewLevel(newLvl)
          setShowLevelUp(true)
        }, 500)
      }
    }

    // 외부 링크로 이동 (EXP 획득 여부와 관계없이 항상 이동)
    window.open('https://knai-safetyprompt-web.vercel.app/', '_blank', 'noopener,noreferrer')
  }

  // EGG: 에너지그리드 게임 핸들러 (향후 EXP API 연동 대비)
  const handleEnergyGridGame = (e: React.MouseEvent) => {
    e.stopPropagation()

    // TODO: 추후 게임 완료 후 EXP 데이터를 받아올 API 연동 예정
    // 현재는 외부 배포 URL로 이동만 처리
    window.open('https://energy-grid-game.vercel.app/', '_blank', 'noopener,noreferrer')
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
      {/* Settings Button */}
      <SettingsButton onClick={() => setShowSettings(true)} testMode={testMode} />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        testMode={testMode}
        onToggleTestMode={onToggleTestMode}
        onResetData={onResetData}
      />

      {/* Level Up Popup */}
      <LevelUpPopup
        show={showLevelUp}
        level={newLevel}
        onClose={() => setShowLevelUp(false)}
      />

      {/* Link EXP Celebration */}
      <LinkExpCelebration
        show={showLinkCelebration}
        onComplete={() => setShowLinkCelebration(false)}
      />

      {/* Floating EXP Animation */}
      <FloatingPointAnimation show={floatingPoint.show} x={floatingPoint.x} y={floatingPoint.y} amount={floatingPoint.amount} />

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
                <div className="text-2xl font-bold text-kepco-cyan">Lv.{calculatedLevel}</div>
                <div className="text-xs text-slate-400">레벨</div>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">EXP</span>
                  <span className="text-xs text-kepco-cyan">{currentLevelExp}/{EXP_PER_LEVEL}</span>
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
              <span className="text-sm font-medium text-kepco-cyan">{userData.totalExp} EXP</span>
            </div>

            {/* EXP Accordion */}
            <ExpAccordion aiClickCount={aiClickRecord.count} />
          </GlassCard>
        </motion.div>

        {/* 4-Grid Bento Layout */}
        <div className="grid grid-cols-2 gap-4">
          {/* AI App Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer min-h-[160px]"
              onClick={() => toggleCard('ai')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">AI app</h3>
              <p className="text-[10px] text-slate-400 mb-2">AI 서비스 List</p>

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
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-kepco-blue/50 to-kepco-cyan/50 text-[10px] text-left flex items-center justify-between relative overflow-hidden group"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAIClick}
                      >
                        {/* Neon glow effect on hover */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-kepco-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="relative z-10 flex items-center gap-1">
                          AI 보안검증 <ExternalLink className="w-3 h-3" />
                        </span>
                        {aiClickRecord.count < EXP_AI_CLICK_MAX_DAILY && (
                          <span className="relative z-10 text-green-400 text-[10px] font-medium">+{EXP_AI_CLICK}</span>
                        )}
                      </motion.button>
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-[10px] text-slate-400 text-left flex items-center gap-2"
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
                className="flex justify-end mt-auto pt-2"
                animate={{ rotate: expandedCard === 'ai' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>

          {/* GAME Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer min-h-[160px]"
              onClick={() => toggleCard('game')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mb-2">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">GAME</h3>
              <p className="text-[10px] text-slate-400 mb-1">보상형 에너지 학습</p>
              <p className="text-[10px] text-purple-400">참여 시 EXP 적립</p>

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
                      {/* 풍력 끙차돌리기 게임 */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-[10px] text-left flex items-center justify-between relative overflow-hidden group"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowWindTurbineGame(true)
                        }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="relative z-10 flex items-center gap-1.5 text-cyan-300">
                          <Wind className="w-3.5 h-3.5" />
                          풍력 끙차돌리기
                        </span>
                        <span className="relative z-10 text-green-400 font-medium">EXP</span>
                      </motion.button>

                      {/* EGG: 에너지그리드 게임 (BETA) */}
                      <motion.button
                        className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-[10px] text-left relative overflow-hidden group border border-yellow-400/30"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(250, 204, 21, 0.5)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEnergyGridGame}
                        style={{ wordBreak: 'keep-all' }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        {/* BETA Badge */}
                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-md rounded-tr-lg">
                          BETA
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            <div className="flex flex-col">
                              <span className="text-yellow-300 font-semibold leading-tight">EGG: 에너지그리드</span>
                              <span className="text-[8px] text-slate-400 leading-tight mt-0.5">경남 전력망 운영 시뮬레이션</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-yellow-400/70" />
                        </div>
                      </motion.button>

                      {/* 개발중인 게임 슬롯 */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-[10px] text-slate-500 text-left flex items-center gap-2 cursor-not-allowed"
                        whileTap={{ scale: 0.98 }}
                      >
                        <Construction className="w-3 h-3" /> 추가 예정
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-auto pt-2"
                animate={{ rotate: expandedCard === 'game' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>

          {/* SIMULATION Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer min-h-[160px]"
              onClick={() => toggleCard('simulation')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-2">
                <Telescope className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">SIMULATION</h3>
              <p className="text-[10px] text-slate-400 mb-1">미래기술 경험해보기</p>
              <p className="text-[10px] text-emerald-400">하루 1회 +{EXP_LINK_CLICK} EXP</p>

              <AnimatePresence>
                {expandedCard === 'simulation' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springConfig}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {/* V2G System */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-[10px] text-left flex items-center justify-between relative overflow-hidden group"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => handleExternalLinkClick(e, 'v2g', 'https://kepco-v2g-game.vercel.app/')}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="relative z-10 flex items-center gap-1 text-emerald-300">
                          V2G System <ExternalLink className="w-3 h-3" />
                        </span>
                        {canEarnLinkExp('v2g') && (
                          <span className="relative z-10 text-green-400 font-medium">+{EXP_LINK_CLICK}</span>
                        )}
                      </motion.button>

                      {/* VPP 가상발전소 */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-[10px] text-left flex items-center justify-between relative overflow-hidden group"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(20, 184, 166, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => handleExternalLinkClick(e, 'vpp', 'https://vpp-game.vercel.app/')}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="relative z-10 flex items-center gap-1 text-teal-300">
                          VPP 가상발전소 <ExternalLink className="w-3 h-3" />
                        </span>
                        {canEarnLinkExp('vpp') && (
                          <span className="relative z-10 text-green-400 font-medium">+{EXP_LINK_CLICK}</span>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-auto pt-2"
                animate={{ rotate: expandedCard === 'simulation' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>

          {/* NEWS Card */}
          <motion.div variants={fadeInUp}>
            <GlassCard
              className="p-4 cursor-pointer min-h-[160px]"
              onClick={() => toggleCard('news')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-2">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">News</h3>
              <p className="text-[10px] text-slate-400 mb-1">에너지 소식</p>
              <p className="text-[10px] text-orange-400">하루 1회 +{EXP_LINK_CLICK} EXP</p>

              <AnimatePresence>
                {expandedCard === 'news' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springConfig}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {/* 에너지인사이트 */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-orange-500/30 to-red-500/30 text-[10px] text-left flex items-center justify-between relative overflow-hidden group"
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(249, 115, 22, 0.4)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => handleExternalLinkClick(e, 'energy-insight', 'https://www.youtube.com/@energy-insight')}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="relative z-10 flex items-center gap-1 text-orange-300">
                          에너지인사이트 <ExternalLink className="w-3 h-3" />
                        </span>
                        {canEarnLinkExp('energy-insight') && (
                          <span className="relative z-10 text-green-400 font-medium">+{EXP_LINK_CLICK}</span>
                        )}
                      </motion.button>

                      {/* 모집중 - 비활성 */}
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-[10px] text-slate-500 text-left flex items-center gap-2 cursor-not-allowed opacity-60"
                        whileTap={{ scale: 0.98 }}
                      >
                        <Construction className="w-3 h-3" /> 모집중
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-auto pt-2"
                animate={{ rotate: expandedCard === 'news' ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </motion.div>
            </GlassCard>
          </motion.div>

          {/* AI TOOL Card - 전체 너비 */}
          <motion.div variants={fadeInUp} className="col-span-2">
            <GlassCard
              className="p-4 cursor-pointer"
              onClick={() => toggleCard('aitool')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm" style={{ wordBreak: 'keep-all' }}>AI TOOL</h3>
                  <p className="text-[10px] text-slate-400" style={{ wordBreak: 'keep-all' }}>AI 도구로 업무 효율 UP</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-purple-400" style={{ wordBreak: 'keep-all' }}>도구별 하루 1회</p>
                  <p className="text-[10px] text-green-400 font-medium">+{EXP_LINK_CLICK} EXP</p>
                </div>
              </div>

              <AnimatePresence>
                {expandedCard === 'aitool' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springConfig}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                      {AI_TOOLS.map((tool) => {
                        const IconComponent = tool.icon === 'BookOpen' ? BookOpen
                          : tool.icon === 'Code2' ? Code2
                          : tool.icon === 'Video' ? Video
                          : Music
                        return (
                          <motion.button
                            key={tool.id}
                            className={`py-3 px-3 rounded-xl ${tool.bgClass} text-left relative overflow-hidden transition-colors`}
                            whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${tool.hoverShadow}` }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => handleToolClick(e, tool)}
                          >
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-400 font-medium" style={{ wordBreak: 'keep-all' }}>[{tool.category}]</span>
                                {canEarnToolExp(tool.id) && (
                                  <span className="text-[10px] text-green-400 font-bold">+{EXP_LINK_CLICK}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <IconComponent className="w-4 h-4 text-white/80" />
                                <span className="text-xs text-white font-medium" style={{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>{tool.name}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end mt-auto pt-2"
                animate={{ rotate: expandedCard === 'aitool' ? 90 : 0 }}
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

      {/* Wind Turbine Game */}
      <WindTurbineGame
        isOpen={showWindTurbineGame}
        onClose={() => setShowWindTurbineGame(false)}
        onEarnExp={handleGameExp}
      />

      {/* Security Consent Modal */}
      <SecurityConsentModal
        isOpen={showSecurityModal}
        onClose={() => {
          setShowSecurityModal(false)
          setPendingTool(null)
        }}
        onConfirm={handleSecurityConfirm}
        toolName={pendingTool?.name || ''}
      />

      {/* AI Tool EXP Toast */}
      <AnimatePresence>
        {showAIToolToast && (
          <AIToolExpToast
            show={showAIToolToast}
            onComplete={() => setShowAIToolToast(false)}
          />
        )}
      </AnimatePresence>
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
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isNFCAccess, setIsNFCAccess] = useState(false)
  const [testMode, setTestMode] = useState(false)
  // 신규 사용자가 온보딩을 완료했는지 추적 (NFC 이벤트 방지용)
  const justCompletedOnboarding = useRef(false)

  useEffect(() => {
    // 테스트 모드 확인
    const savedTestMode = localStorage.getItem(TEST_MODE_KEY)
    if (savedTestMode === 'true') {
      setTestMode(true)
    }

    // NFC 접속 확인
    const source = searchParams.get('source')
    const isNFC = source === 'nfc'

    // Check localStorage for existing user
    const storedData = localStorage.getItem(STORAGE_KEY)
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        // totalExp가 없으면 초기화
        if (parsed.totalExp === undefined) {
          parsed.totalExp = 0
        }
        // 레벨 동기화
        parsed.level = Math.floor(parsed.totalExp / EXP_PER_LEVEL) + 1
        parsed.exp = parsed.totalExp % EXP_PER_LEVEL
        setUserData(parsed)

        // 기존 사용자 + NFC 접속 = NFC 출석 이벤트 발생
        if (isNFC) {
          setIsNFCAccess(true)
        }
      } catch {
        setShowOnboarding(true)
        // 신규 사용자 (파싱 실패) + NFC 접속 = 온보딩 먼저, NFC 이벤트 발생 안함
      }
    } else {
      setShowOnboarding(true)
      // 신규 사용자 (데이터 없음) + NFC 접속 = 온보딩 먼저, NFC 이벤트 발생 안함
    }

    // URL 파라미터 정리 (주소창 깔끔하게 유지)
    if (isNFC) {
      router.replace('/', { scroll: false })
    }

    setIsLoading(false)
  }, [searchParams, router])

  const handleOnboardingComplete = useCallback((data: UserData) => {
    // 온보딩 완료 시 NFC 이벤트 방지 플래그 설정
    justCompletedOnboarding.current = true
    setUserData(data)
    setShowOnboarding(false)
    // isNFCAccess는 false로 유지 (신규 사용자이므로 NFC 출석 이벤트 발생 안함)
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

  const handleResetData = useCallback(() => {
    localStorage.clear()
    window.location.reload()
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
          onResetData={handleResetData}
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
