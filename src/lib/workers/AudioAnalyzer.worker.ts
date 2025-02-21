const POWER_THRESHOLD = 0.01
const NOISE_THRESHOLD = 0.3

interface AudioAnalyzerConfig {
  sampleRate: number
  fftSize: number
  volumeThreshold: number
  powerThreshold?: number
  noiseThreshold?: number
  energySavingMode?: boolean
}

let config: AudioAnalyzerConfig
let lastProcessTime = 0
const ENERGY_SAVING_INTERVAL = 100 // 节能模式下的处理间隔(ms)

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'config') {
    config = e.data.config
    return
  }

  if (e.data.type === 'analyze') {
    const audioData = e.data.data

    // 节能模式下降低处理频率
    const now = Date.now()
    if (config.energySavingMode && now - lastProcessTime < ENERGY_SAVING_INTERVAL) {
      return
    }
    lastProcessTime = now

    const result = analyzeAudio(audioData)
    self.postMessage(result)
  }
}

function analyzeAudio(audioData: Uint8Array) {
  // 计算音频功率
  const power = calculatePower(audioData)

  // 如果功率太低，直接返回
  if (power < (config.powerThreshold || POWER_THRESHOLD)) {
    return { volume: 0, hasVoice: false }
  }

  // 计算音量
  const volume = calculateVolume(audioData)

  // 噪音过滤
  const noiseLevel = calculateNoiseLevel(audioData)
  const isNoise = noiseLevel > (config.noiseThreshold || NOISE_THRESHOLD)

  console.log('analyzeAudio', volume, isNoise)

  // 判断是否有声音, 声音大于阈值，且不是噪音
  const hasVoice = volume >= config.volumeThreshold && !isNoise

  return {
    volume, // 音量
    hasVoice, // 是否有声音
    noiseLevel, // 噪音水平
    power, // 功率
  }
}

// 计算音频功率
function calculatePower(data: Uint8Array): number {
  const sum = data.reduce((acc, val) => acc + val * val, 0)
  return Math.sqrt(sum / data.length) / 128.0 // 归一化
}

// 计算音量
function calculateVolume(data: Uint8Array): number {
  const sum = data.reduce((acc, val) => acc + Math.abs(val - 128), 0)
  return sum / data.length
}

// 计算频谱的标准差作为噪音指标
function calculateNoiseLevel(data: Uint8Array): number {
  const mean = data.reduce((acc, val) => acc + val, 0) / data.length
  const variance = data.reduce((acc, val) => acc + (val - mean) ** 2, 0) / data.length
  return Math.sqrt(variance) / 128.0 // 归一化
}
