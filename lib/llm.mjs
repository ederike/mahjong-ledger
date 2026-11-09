/**
 * LLM 接入层：OpenAI 兼容 /chat/completions（DeepSeek / 通义千问 / 任意兼容端点）。
 *
 * 密钥只存服务端 data/llm-config.json 或环境变量，绝不回传前端、不写进前端代码。
 * 发布环境无法注入环境变量，故以「网页设置里填一次」为主要配置方式；
 * 有环境变量时以环境变量为准（方便本地开发）。
 *
 * 铁律：本层只负责「自然语言 → 结构化字段」，绝不产出分数。
 * 分数一律由 lib/score.ts 的可验证纯函数计算。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, 'data')
// 配置路径可外置（本地联调时与线上服务隔离）
const CONF_PATH = process.env.MJ_LLM_CONF || join(DATA_DIR, 'llm-config.json')

export const PRESETS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  custom: { label: '自定义端点', baseUrl: '', model: '' },
}

function envConfig() {
  const apiKey = (process.env.MJ_LLM_API_KEY || '').trim()
  if (!apiKey) return null
  return {
    enabled: process.env.MJ_LLM_DISABLED !== '1',
    provider: 'custom',
    baseUrl: (process.env.MJ_LLM_BASE_URL || PRESETS.deepseek.baseUrl).trim(),
    model: (process.env.MJ_LLM_MODEL || PRESETS.deepseek.model).trim(),
    apiKey,
    source: 'env',
  }
}

function fileConfig() {
  try {
    if (!existsSync(CONF_PATH)) return null
    const c = JSON.parse(readFileSync(CONF_PATH, 'utf8'))
    if (!c || typeof c !== 'object') return null
    return {
      enabled: c.enabled !== false,
      provider: c.provider || 'deepseek',
      baseUrl: String(c.baseUrl || ''),
      model: String(c.model || ''),
      apiKey: String(c.apiKey || ''),
      source: 'file',
    }
  } catch {
    return null
  }
}

/** 完整配置（含密钥），仅供服务端内部使用 */
export function secretConfig() {
  return envConfig() || fileConfig()
}

/** 公开配置（不含密钥），可安全返回给前端 */
export function getConfig() {
  const c = secretConfig()
  const base = { presets: PRESETS }
  if (!c) {
    return { ...base, configured: false, enabled: false, source: 'none', provider: null, baseUrl: '', model: '', hasKey: false }
  }
  return {
    ...base,
    configured: !!(c.enabled && c.apiKey && c.baseUrl && c.model),
    enabled: c.enabled,
    source: c.source,
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: !!c.apiKey,
  }
}

export function saveConfig(body = {}) {
  if (envConfig()) throw new Error('当前密钥由服务端环境变量提供，需在服务端修改')
  const old = fileConfig() || {}
  const provider = String(body.provider || old.provider || 'deepseek').trim()
  if (!PRESETS[provider]) throw new Error('未知服务商')
  const preset = PRESETS[provider]
  const changedProvider = provider !== old.provider
  const baseUrl = String(
    body.baseUrl ?? (changedProvider ? preset.baseUrl : (old.baseUrl || preset.baseUrl))
  ).trim().replace(/\/+$/, '')
  const model = String(
    body.model ?? (changedProvider ? preset.model : (old.model || preset.model))
  ).trim()
  const keyRaw = body.apiKey
  const apiKey = (keyRaw === undefined || keyRaw === null || String(keyRaw).trim() === '')
    ? (old.apiKey || '')
    : String(keyRaw).trim()
  const enabled = body.enabled === undefined ? (old.enabled !== false) : !!body.enabled
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('接口地址需以 http:// 或 https:// 开头')
  if (!model) throw new Error('请填写模型名')
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONF_PATH, JSON.stringify({ enabled, provider, baseUrl, model, apiKey }, null, 2), 'utf8')
  return getConfig()
}

/** 调用一次对话补全，返回文本 content */
export async function chat(messages, { temperature = 0, maxTokens = 700, timeout = 25000 } = {}) {
  const c = secretConfig()
  if (!c || !c.enabled || !c.apiKey) throw new Error('LLM 未配置')
  const url = `${c.baseUrl.replace(/\/+$/, '')}/chat/completions`
  let r
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.apiKey}`,
      },
      body: JSON.stringify({ model: c.model, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(timeout),
    })
  } catch (e) {
    const why = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? '请求超时' : (e?.message || '网络不通')
    throw new Error(`LLM 连接失败：${why}`)
  }
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).slice(0, 200)
    throw new Error(`LLM 返回 ${r.status}：${t}`)
  }
  let j
  try { j = await r.json() } catch { throw new Error('LLM 返回不是合法 JSON') }
  const content = j?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('LLM 返回内容为空')
  return content.trim()
}

export async function testConnection() {
  const c = secretConfig()
  if (!c || !c.apiKey) throw new Error('还没有填写 API Key')
  const t0 = Date.now()
  const out = await chat([{ role: 'user', content: '只回复两个字：可用' }], { maxTokens: 20, timeout: 15000 })
  return { ok: true, ms: Date.now() - t0, model: c.model, sample: out.slice(0, 30) }
}
