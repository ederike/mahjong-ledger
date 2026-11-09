/**
 * 结算：把四家净分化简为最少笔数的转账方案。
 * 贪心最大额配对，转账笔数 ≤ 人数 - 1；分数均为整数，无浮点误差。
 */
import { SEATS, type Seat } from './rules.ts'
import type { RuleConfig } from './rules.ts'

export interface Transfer {
  from: Seat // 净分为负，付钱
  to: Seat // 净分为正，收钱
  points: number
  amount: number // 按 unitPrice 折算成元
}

export function minTransfers(
  net: Record<Seat, number>,
  rules: RuleConfig,
): Transfer[] {
  const debtors = SEATS.filter((s) => net[s] < 0)
    .map((s) => ({ seat: s, amt: -net[s] }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = SEATS.filter((s) => net[s] > 0)
    .map((s) => ({ seat: s, amt: net[s] }))
    .sort((a, b) => b.amt - a.amt)

  const out: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    if (pay > 0) {
      out.push({
        from: debtors[i].seat,
        to: creditors[j].seat,
        points: pay,
        amount: pay * rules.unitPrice,
      })
    }
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt === 0) i++
    if (creditors[j].amt === 0) j++
  }
  return out
}

/** 机械不变量：转账完成后每家净额归零 */
export function assertBalanced(net: Record<Seat, number>, transfers: Transfer[]): void {
  const left = { ...net }
  for (const t of transfers) {
    left[t.from] += t.points
    left[t.to] -= t.points
  }
  const bad = SEATS.filter((s) => left[s] !== 0)
  if (bad.length) throw new Error(`结算不平：${bad.join(',')} 未归零`)
}
