// ==================== Games Index ====================
// 새로운 게임을 추가할 때 이 파일에 export 추가하세요

export { default as WindTurbineGame } from './WindTurbineGame'

// 게임 메타데이터 (목록 표시용)
export interface GameInfo {
  id: string
  name: string
  description: string
  icon: string
  color: string
  available: boolean
}

export const GAMES_LIST: GameInfo[] = [
  {
    id: 'wind-turbine',
    name: '풍력 끙차돌리기',
    description: '발전기를 돌려 EXP를 획득하세요!',
    icon: 'Wind',
    color: 'from-cyan-500 to-blue-500',
    available: true,
  },
  // 새 게임 추가 시 여기에 메타데이터 추가
  // {
  //   id: 'solar-catch',
  //   name: '태양광 모으기',
  //   description: '태양빛을 모아 에너지를 생산하세요!',
  //   icon: 'Sun',
  //   color: 'from-yellow-500 to-orange-500',
  //   available: false,
  // },
]
