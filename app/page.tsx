'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
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
} from 'lucide-react'

// ==================== Types ====================
interface UserData {
  nickname: string
  characterId: number
  level: number
  exp: number
  badges: number
}

interface Character {
  id: number
  name: string
  file: string
  description: string
}

// ==================== Constants ====================
const CHARACTERS: Character[] = [
  { id: 1, name: 'Tobby', file: '1. Tobby.png', description: '에너지 수호자' },
  { id: 2, name: 'Volty', file: '2. Volty.png', description: '전기의 정령' },
  { id: 3, name: 'Lumi', file: '3. Lumi.png', description: '빛의 요정' },
  { id: 4, name: 'Windy', file: '4. Windy.png', description: '바람의 친구' },
  { id: 5, name: 'Solar', file: '5. Solar.png', description: '태양의 힘' },
  { id: 6, name: 'Green', file: '7. Green.png', description: '자연의 수호자' },
]

const STORAGE_KEY = 'kepco_ai_zone_user'

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

// ==================== Utility Components ====================
const GlassCard = ({
  children,
  className = '',
  onClick,
  layoutId,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  layoutId?: string
}) => (
  <motion.div
    layoutId={layoutId}
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

              <motion.div
                className="relative mb-6"
                whileFocus={{ scale: 1.02 }}
              >
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
              </motion.div>

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
const DashboardScreen = ({ userData }: { userData: UserData }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const selectedCharacter = CHARACTERS.find((c) => c.id === userData.characterId)

  const expPercent = (userData.exp / 100) * 100 // 100 exp per level

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId)
  }

  return (
    <motion.div
      className="min-h-screen pb-24 relative"
      initial="initial"
      animate="animate"
      variants={pageTransition}
      transition={{ duration: 0.5 }}
    >
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
          {/* Character Orb */}
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

          {/* User Info */}
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
        {/* MY PAGE Card - Large */}
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
              <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full">
                추후 개발예정
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {/* Level */}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-kepco-cyan">Lv.{userData.level}</div>
                <div className="text-xs text-slate-400">레벨</div>
              </div>

              {/* EXP */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">EXP</span>
                  <span className="text-xs text-kepco-cyan">{userData.exp}/100</span>
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

              {/* Badges */}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{userData.badges}</span>
                </div>
                <div className="text-xs text-slate-400">뱃지</div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Bottom Row - Two Square Cards */}
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
              <p className="text-xs text-slate-400 mb-3">AI 보안의 핵심</p>

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
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-kepco-blue/50 to-kepco-cyan/50 text-xs text-left"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        AI 프롬프트 보안검증
                      </motion.button>
                      <motion.button
                        className="w-full py-2 px-3 rounded-lg bg-white/5 text-xs text-slate-400 text-left flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Construction className="w-3 h-3" /> 개발중
                      </motion.button>
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
              <p className="text-[10px] text-kepco-cyan">참여 시 마일리지 적립</p>

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
    </motion.div>
  )
}

// Navigation Button Component
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
export default function KepcoAIZone() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Check localStorage for existing user
    const storedData = localStorage.getItem(STORAGE_KEY)
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        setUserData(parsed)
      } catch {
        setShowOnboarding(true)
      }
    } else {
      setShowOnboarding(true)
    }
    setIsLoading(false)
  }, [])

  const handleOnboardingComplete = useCallback((data: UserData) => {
    setUserData(data)
    setShowOnboarding(false)
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
    <main className="min-h-screen noise-overlay">
      <AnimatePresence mode="wait">
        {showOnboarding || !userData ? (
          <OnboardingScreen
            key="onboarding"
            onComplete={handleOnboardingComplete}
          />
        ) : (
          <DashboardScreen key="dashboard" userData={userData} />
        )}
      </AnimatePresence>
    </main>
  )
}
