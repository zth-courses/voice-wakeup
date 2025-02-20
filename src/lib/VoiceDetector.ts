// 声音检测器，用于预先检测是否有声音
export class VoiceDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private isListening = false
  private volumeThreshold: number
  private onVoiceStart: () => void

  constructor(options: { volumeThreshold?: number; onVoiceStart: () => void }) {
    this.volumeThreshold = options.volumeThreshold || 50
    this.onVoiceStart = options.onVoiceStart
  }

  async start() {
    if (this.isListening) return

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()

      source.connect(this.analyser)
      this.isListening = true
      this.detectSound()
    } catch (error) {
      throw new Error('无法访问麦克风')
    }
  }

  stop() {
    this.isListening = false
    this.stream?.getTracks().forEach((track) => track.stop())
    this.audioContext?.close()
    this.audioContext = null
    this.analyser = null
    this.stream = null
  }

  private detectSound() {
    if (!this.isListening || !this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)

    // 计算平均音量
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length

    if (average > this.volumeThreshold) {
      this.onVoiceStart()
      return
    }

    // 使用 requestAnimationFrame 而不是 setInterval，性能更好
    requestAnimationFrame(() => this.detectSound())
  }
}
