'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'

function CheckInRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // source 파라미터를 유지하면서 메인 페이지로 리다이렉트
    const source = searchParams.get('source')
    const redirectUrl = source ? `/?source=${source}` : '/'
    router.replace(redirectUrl)
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#1e293b]">
      <div className="text-center">
        <motion.div
          className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-white/70">출석 페이지로 이동 중...</p>
      </div>
    </div>
  )
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#1e293b]">
        <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    }>
      <CheckInRedirect />
    </Suspense>
  )
}
