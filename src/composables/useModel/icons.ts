import alibaba from '@/assets/icons/models/alibaba.svg?raw'
import anthropic from '@/assets/icons/models/anthropic.svg?raw'
import baidu from '@/assets/icons/models/baidu.svg?raw'
import bytedance from '@/assets/icons/models/bytedance.svg?raw'
import chatglm from '@/assets/icons/models/chatglm.svg?raw'
import cohere from '@/assets/icons/models/cohere.svg?raw'
import deepseek from '@/assets/icons/models/deepseek.svg?raw'
import doubao from '@/assets/icons/models/doubao.svg?raw'
import gemini from '@/assets/icons/models/gemini.svg?raw'
import google from '@/assets/icons/models/google.svg?raw'
import groq from '@/assets/icons/models/groq.svg?raw'
import hunyuan from '@/assets/icons/models/hunyuan.svg?raw'
import kimi from '@/assets/icons/models/kimi.svg?raw'
import meta from '@/assets/icons/models/meta.svg?raw'
import minimax from '@/assets/icons/models/minimax.svg?raw'
import mistral from '@/assets/icons/models/mistral.svg?raw'
import moonshot from '@/assets/icons/models/moonshot.svg?raw'
import ollama from '@/assets/icons/models/ollama.svg?raw'
import openai from '@/assets/icons/models/openai.svg?raw'
import openrouter from '@/assets/icons/models/openrouter.svg?raw'
import qwen from '@/assets/icons/models/qwen.svg?raw'
import siliconcloud from '@/assets/icons/models/siliconcloud.svg?raw'
import spark from '@/assets/icons/models/spark.svg?raw'
import xai from '@/assets/icons/models/xai.svg?raw'
import yi from '@/assets/icons/models/yi.svg?raw'
import zhipu from '@/assets/icons/models/zhipu.svg?raw'

/** 内置图标以 icon: 开头存进 ModelConf.data.avatar，渲染时再还原成 data URL */
export const ICON_PREFIX = 'icon:'

export interface ModelIcon {
  key: string
  label: string
  token: string
  src: string
}

const svgToDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`

const builtinIcons: { key: string; label: string; svg: string }[] = [
  { key: 'openai', label: 'OpenAI', svg: openai },
  { key: 'deepseek', label: 'DeepSeek', svg: deepseek },
  { key: 'anthropic', label: 'Anthropic', svg: anthropic },
  { key: 'gemini', label: 'Gemini', svg: gemini },
  { key: 'google', label: 'Google', svg: google },
  { key: 'moonshot', label: 'Moonshot', svg: moonshot },
  { key: 'kimi', label: 'Kimi', svg: kimi },
  { key: 'zhipu', label: '智谱', svg: zhipu },
  { key: 'chatglm', label: 'ChatGLM', svg: chatglm },
  { key: 'qwen', label: '通义千问', svg: qwen },
  { key: 'alibaba', label: '阿里百炼', svg: alibaba },
  { key: 'baidu', label: '百度', svg: baidu },
  { key: 'doubao', label: '豆包', svg: doubao },
  { key: 'bytedance', label: '字节跳动', svg: bytedance },
  { key: 'minimax', label: 'MiniMax', svg: minimax },
  { key: 'hunyuan', label: '腾讯混元', svg: hunyuan },
  { key: 'spark', label: '讯飞星火', svg: spark },
  { key: 'yi', label: '零一万物', svg: yi },
  { key: 'siliconcloud', label: '硅基流动', svg: siliconcloud },
  { key: 'mistral', label: 'Mistral', svg: mistral },
  { key: 'meta', label: 'Meta', svg: meta },
  { key: 'xai', label: 'xAI', svg: xai },
  { key: 'cohere', label: 'Cohere', svg: cohere },
  { key: 'groq', label: 'Groq', svg: groq },
  { key: 'ollama', label: 'Ollama', svg: ollama },
  { key: 'openrouter', label: 'OpenRouter', svg: openrouter },
]

export const modelIcons: ModelIcon[] = builtinIcons.map((icon) => ({
  key: icon.key,
  label: icon.label,
  token: `${ICON_PREFIX}${icon.key}`,
  src: svgToDataUrl(icon.svg),
}))

const iconMap = new Map(builtinIcons.map((icon) => [icon.key, svgToDataUrl(icon.svg)]))

/**
 * 把 ModelConf.data.avatar 还原成 <img> 能用的地址。
 * 内置图标（icon:xxx）不会走网络，自定义的 http(s) 地址原样返回。
 */
export function resolveModelAvatar(avatar: string): string
export function resolveModelAvatar(avatar?: string | null): string | undefined
export function resolveModelAvatar(avatar?: string | null): string | undefined {
  if (!avatar) return undefined
  if (!avatar.startsWith(ICON_PREFIX)) return avatar
  return iconMap.get(avatar.slice(ICON_PREFIX.length))
}
