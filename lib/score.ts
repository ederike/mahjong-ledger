/**
 * 计分引擎：纯函数，无 IO、无状态。
 * 输入「用户报的胡法档位 + 有无鬼 + 本局摸马牌面 + 杠分事件」，输出四家净分与逐项明细。
 * 摸马张数由 horseCountFor(hasGhost) 决定（有鬼 4 / 没鬼 6），引擎只遍历数组、不假设张数。
 */
import {
  RULES, SEATS, horseCountFor, horseOffsetOf, seatFromOffset,
  type RuleConfig, type Seat,
} from './rules.ts'

export type GangType = 'dian' | 'bu' | 'an'

export interface GangEvent {
  type: GangType
  by: Seat // 杠的人
  from?: Seat // 点杠时的放杠者
}

export interface RoundInput {
  winner: Seat
  dealer: Seat
  pattern: string // 用户报的胡法档位名（必须是 scoreTable 中的别名）
  hasGhost: boolean // true = 有鬼；false = 硬胡（无鬼）
  horses: string[] // 本局中马的马牌牌面，最多 = horseCountFor(hasGhost) 张
  gangEvents?: GangEvent[]
  manualOverride?: Partial<Record<Seat, number>> // 确认页手改：直接给最终净分
}

export interface HorseHit {
  tile: string
  seat: Seat
  winnerSelf: boolean // 中马者就是赢家本人 → 自己付自己，不计
}

export interface ScoreDetail {
  tierName: string
  base: number // 该局胡法分数
  hasGhost: boolean
  horseCount: number // 本局摸马张数上限
  zimoPerLoser: number
  horseHits: HorseHit[]
  gangLines: string[]
  autoPerPlayer: Record<Seat, number> // 自动算出的四家净分
  perPlayer: Record<Seat, number> // 手改后的最终净分
  isManual: boolean
  totalCheck: number // 必须 = 0（零和），否则账不平
}

function zero(): Record<Seat, number> {
  return { E: 0, S: 0, W: 0, N: 0 }
}

export function scoreRound(input: RoundInput, rules: RuleConfig = RULES): ScoreDetail {
  if (!rules.allowDianpao && 'winType' in input) {
    throw new Error('本桌不启用点炮')
  }

  const tier = rules.scoreTable.find((t) => t.patterns.includes(input.pattern))
  if (!tier) {
    const all = rules.scoreTable.flatMap((t) => t.patterns).join('、')
    throw new Error(`未知胡法「${input.pattern}」，可报：${all}`)
  }

  const base = input.hasGhost ? tier.withGhost : tier.withoutGhost
  const horseCount = horseCountFor(input.hasGhost, rules)
  if (input.horses.length > horseCount) {
    throw new Error(`本局${input.hasGhost ? '有鬼' : '硬胡(没鬼)'}最多摸 ${horseCount} 张马，实际录入 ${input.horses.length} 张`)
  }

  const per = zero()
  const gangLines: string[] = []
  const gangUnit = rules.baseUnit // 1 底分 = 1 分

  // 1) 胡牌主分：只有自摸，三家各付 1 份，赢家收 3 份
  const oneShare = base * rules.share.zimoPerLoser
  for (const s of SEATS) {
    if (s === input.winner) per[s] += oneShare * 3
    else per[s] -= oneShare
  }

  // 2) 摸马：每张中马牌映射到座位；中马者额外付赢家 1 份（中马者=赢家则不计）
  const horseHits: HorseHit[] = []
  for (const tile of input.horses) {
    const offset = horseOffsetOf(tile, rules)
    if (offset === null) throw new Error(`无法识别马牌「${tile}」`)
    const seat = seatFromOffset(offset, input.dealer)
    const winnerSelf = seat === input.winner
    horseHits.push({ tile, seat, winnerSelf })
    if (winnerSelf) continue
    const extra = base * rules.horse.perHit
    per[seat] -= extra
    per[input.winner] += extra
  }

  // 3) 杠分：立即结算，独立流水，单位固定为「底分」，不随胡法分数缩放
  for (const g of input.gangEvents ?? []) {
    if (g.type === 'dian') {
      if (!g.from) throw new Error('点杠必须提供放杠者 from')
      const amount = rules.gang.dianGang * gangUnit
      per[g.from] -= amount
      per[g.by] += amount
      gangLines.push(`点杠：${g.from} 付 ${g.by} ${amount} 分`)
    } else {
      const times = g.type === 'bu' ? rules.gang.buGang : rules.gang.anGang
      const amount = times * gangUnit
      for (const s of SEATS) {
        if (s === g.by) continue
        per[s] -= amount
        per[g.by] += amount
      }
      gangLines.push(`${g.type === 'bu' ? '补杠' : '暗杠'}：其余三家各付 ${g.by} ${amount} 分`)
    }
  }

  const autoPerPlayer = { ...per }
  const isManual = !!input.manualOverride && Object.keys(input.manualOverride).length > 0
  const perPlayer = isManual ? { ...per, ...input.manualOverride } : { ...per }
  const totalCheck = SEATS.reduce((sum, s) => sum + perPlayer[s], 0)

  return {
    tierName: input.pattern,
    base,
    hasGhost: input.hasGhost,
    horseCount,
    zimoPerLoser: oneShare,
    horseHits,
    gangLines,
    autoPerPlayer,
    perPlayer,
    isManual,
    totalCheck,
  }
}
