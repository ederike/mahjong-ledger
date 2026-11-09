/**
 * 规则算例验证：node --experimental-strip-types scripts/verify.ts
 * 每个算例打印四家净分、马命中、结算转账，并断言「零和」不变量。
 */
import assert from 'node:assert/strict'
import { RULES, SEATS, horseCountFor, type Seat } from '../lib/rules.ts'
import { scoreRound, type RoundInput } from '../lib/score.ts'
import { minTransfers, assertBalanced } from '../lib/settle.ts'

const NAME: Record<Seat, string> = { E: '东', S: '南', W: '西', N: '北' }

function show(title: string, input: RoundInput) {
  const d = scoreRound(input)
  const row = SEATS.map((s) => `${NAME[s]} ${d.perPlayer[s] > 0 ? '+' : ''}${d.perPlayer[s]}`).join('  ')
  const hits = d.horseHits.length
    ? d.horseHits.map((h) => `${h.tile}→${NAME[h.seat]}${h.winnerSelf ? '(赢家本人,不计)' : ''}`).join(' ')
    : '无'
  const transfers = minTransfers(d.perPlayer, RULES)
  assertBalanced(d.perPlayer, transfers)

  console.log(`\n【${title}】`)
  console.log(`  胡法=${d.tierName} ${d.hasGhost ? '有鬼' : '硬胡(无鬼)'}  基数=${d.base}分  每家付=${d.zimoPerLoser}分`)
  console.log(`  马: ${hits}`)
  if (d.gangLines.length) console.log(`  杠: ${d.gangLines.join('; ')}`)
  console.log(`  四家净分: ${row}`)
  console.log(`  零和校验: ${d.totalCheck}  ${d.totalCheck === 0 ? 'OK' : 'FAIL'}`)
  console.log(`  结算: ${transfers.map((t) => `${NAME[t.from]}→${NAME[t.to]} ${t.points}分/${t.amount}元`).join('  ') || '无需转账'}`)

  assert.equal(d.totalCheck, 0, `${title} 账不平`)
  return d
}

// 例 1：鸡胡、有鬼、无马、庄家=赢家=东 → base 2，三家各付 2
show('例1 鸡胡有鬼·无马', {
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true, horses: [],
})

// 例 2：鸡胡有鬼 + 4 张马（庄家=东，赢家=东）
// 5万→东(赢家本人,不计) 红中→南 西风→西 9筒→东(赢家本人,不计)
show('例2 鸡胡有鬼·中马2匹', {
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true,
  horses: ['5万', '红中', '西风', '9筒'],
})

// 例 3：清一色、硬胡、无马 → base 16，赢家收 48
show('例3 清一色硬胡·无马', {
  winner: 'S', dealer: 'E', pattern: '清一色', hasGhost: false, horses: [],
})

// 例 4：七对有鬼 + 赢家自己暗杠
// 底分 2 → 暗杠「2 倍底分」= 其余三家各付 4 分（v1.2 前误按各 2 分）
show('例4 七对有鬼·带暗杠', {
  winner: 'W', dealer: 'E', pattern: '七对', hasGhost: true, horses: [],
  gangEvents: [{ type: 'an', by: 'W' }],
})

// 例 5：庄家不是东时马牌映射（庄家=南，6条→下家=西，红中→下家=西）
show('例5 庄家=南·马映射', {
  winner: 'N', dealer: 'S', pattern: '碰碰胡', hasGhost: true,
  horses: ['6条', '红中'],
})

// 例 6：确认页手改兜底
const d6 = show('例6 手改覆盖', {
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true, horses: [],
  manualOverride: { E: 6, S: -2, W: -3, N: -1 },
})
assert.equal(d6.isManual, true)

// 例 7：非法胡法必须报错（用户只报表内档位）
assert.throws(() => scoreRound({
  winner: 'E', dealer: 'E', pattern: '不存在的牌型', hasGhost: true, horses: [],
}), /未知胡法/)

// 例 8：底分 = 2，鸡胡 = 1 倍底分 = 2 分（用户口径「鸡胡就是底分 2」）
assert.equal(RULES.baseUnit, 2)
assert.equal(RULES.hardMultiplier, 2)
assert.equal(RULES.scoreTable[0].times, 1)
assert.equal(RULES.scoreTable[0].withGhost, 2)
assert.equal(RULES.scoreTable[0].withoutGhost, 4)

// 例 9：表格数值回归（倍率生成后仍须与规则图完全一致）
assert.deepEqual(
  RULES.scoreTable.map((t) => [t.withGhost, t.withoutGhost]),
  [[2, 4], [4, 8], [8, 16], [12, 24], [16, 32], [20, 40], [24, 48]],
)

// 例 10：杠分按「底分 2」计 —— 点杠 6 / 补杠各 2 / 暗杠各 4
// 用「同一局有无杠分」的差值做精确断言，排除胡牌主分干扰
const baseInput: RoundInput = {
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true, horses: [],
}
const plain = scoreRound(baseInput)
const dian = scoreRound({ ...baseInput, gangEvents: [{ type: 'dian', by: 'E', from: 'S' }] })
const bu = scoreRound({ ...baseInput, gangEvents: [{ type: 'bu', by: 'E' }] })
const an = scoreRound({ ...baseInput, gangEvents: [{ type: 'an', by: 'E' }] })

assert.equal(dian.autoPerPlayer.S - plain.autoPerPlayer.S, -6, '点杠 3 倍底分 = 6 分')
assert.equal(dian.autoPerPlayer.E - plain.autoPerPlayer.E, 6)
for (const s of SEATS.filter((x) => x !== 'E')) {
  assert.equal(bu.autoPerPlayer[s] - plain.autoPerPlayer[s], -2, '补杠每家 1 倍底分 = 2 分')
  assert.equal(an.autoPerPlayer[s] - plain.autoPerPlayer[s], -4, '暗杠每家 2 倍底分 = 4 分')
}
assert.equal(bu.autoPerPlayer.E - plain.autoPerPlayer.E, 6)
assert.equal(an.autoPerPlayer.E - plain.autoPerPlayer.E, 12)
console.log('\n【例10 杠分按底分2】点杠 放杠者付6分 / 补杠 其余三家各付2分 / 暗杠 其余三家各付4分  OK')

// 例 11：摸马张数随有无鬼变化（v1.4）
assert.equal(horseCountFor(true), 4, '有鬼摸 4 张马')
assert.equal(horseCountFor(false), 6, '没鬼/硬胡摸 6 张马')
assert.equal(RULES.horse.countByGhost.withGhost, 4)
assert.equal(RULES.horse.countByGhost.withoutGhost, 6)
console.log('\n【例11 摸马张数】有鬼 4 张 / 没鬼(硬胡) 6 张  OK')

// 例 12：有鬼局摸 4 张马全部中马（庄家=东，赢家=东）
// 5万→东(赢家不计) 红中→南 西风→西 9筒→东(赢家不计)：命中 4 张但只 2 张有效
const d12 = show('例12 鸡胡有鬼·摸满4张马', {
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true,
  horses: ['5万', '红中', '西风', '9筒'],
})
assert.equal(d12.horseCount, 4)
assert.equal(d12.horseHits.length, 4)

// 例 13：硬胡局摸 6 张马 —— 张数上限生效，且逐张结算、零和
// 基数 4（鸡胡硬胡）；1万/5万/9筒→东(赢家不计)，其余映射到各家中马
const d13 = show('例13 清一色硬胡·摸满6张马', {
  winner: 'N', dealer: 'S', pattern: '清一色', hasGhost: false,
  horses: ['1万', '2万', '3万', '4万', '6条', '7条'],
})
assert.equal(d13.horseCount, 6)
assert.equal(d13.horseHits.length, 6)
assert.equal(d13.totalCheck, 0)

// 例 14：超张数必须被机械拦截（有鬼 >4、硬胡 >6）
assert.throws(() => scoreRound({
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: true,
  horses: ['1万', '2万', '3万', '4万', '5万'],
}), /最多摸 4 张马/)
assert.throws(() => scoreRound({
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: false,
  horses: ['1万', '2万', '3万', '4万', '5万', '6万', '7万'],
}), /最多摸 6 张马/)
// 硬胡恰好 6 张合法（不抛错）
assert.doesNotThrow(() => scoreRound({
  winner: 'E', dealer: 'E', pattern: '鸡胡', hasGhost: false,
  horses: ['1万', '2万', '3万', '4万', '5万', '6万'],
}))
console.log('【例14 超张数拦截】有鬼>4 / 硬胡>6 均报错，硬胡恰好6张合法  OK')

console.log('\n全部算例通过：零和、马映射/张数、杠分、手改、非法输入、底分与表值回归均 OK')
