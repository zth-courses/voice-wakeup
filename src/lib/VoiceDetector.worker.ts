// 声音检测器，用于预先检测是否有声音
interface VoiceDetectorOptions {
  volumeThreshold: number
  silenceDuration: number
  onVoiceStart: () => void
  onVoiceEnd: () => void
  onAmplitude?: (amplitude: number) => void
  energySavingMode?: boolean // 新增节能模式选项
}

export class VoiceDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private isListening = false
  private silenceTimer: number | null = null
  private options: Required<VoiceDetectorOptions>
  private worker: Worker | null = null
  private consecutiveVoiceFrames = 0
  private consecutiveSilenceFrames = 0
  private readonly MIN_VOICE_FRAMES = 3 // 连续几帧检测到声音才算说话
  private readonly MIN_SILENCE_FRAMES = 10 // 连续几帧静音才算静音

  constructor(options: VoiceDetectorOptions) {
    this.options = {
      volumeThreshold: 20,
      silenceDuration: 2000,
      onAmplitude: () => {},
      energySavingMode: false,
      ...options,
    }
  }

  async start() {
    if (this.isListening) return

    try {
      await this.initializeAudio()
      await this.initializeWorker()
      this.startAnalysis()
    } catch (error) {
      this.cleanup()
      throw new Error('无法访问麦克风')
    }
  }

  private async initializeAudio() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)
  }

  private async initializeWorker() {
    this.worker = new Worker(new URL('./workers/AudioAnalyzer.worker.ts', import.meta.url), { type: 'module' })

    this.worker.postMessage({
      type: 'config',
      config: {
        sampleRate: this.audioContext!.sampleRate,
        fftSize: this.analyser!.fftSize,
        volumeThreshold: this.options.volumeThreshold,
        energySavingMode: this.options.energySavingMode,
      },
    })

    this.worker.onmessage = (e) => {
      const { volume, hasVoice } = e.data
      this.options.onAmplitude(volume)
      this.handleVoiceDetection(hasVoice)
    }
  }

  private handleVoiceDetection(hasVoice: boolean) {
    // 如果当前有声音，则增加连续说话的帧数
    if (hasVoice) {
      this.consecutiveVoiceFrames++
      this.consecutiveSilenceFrames = 0

      // 如果连续说话的帧数大于等于最小说话帧数，则认为说话开始
      if (this.consecutiveVoiceFrames >= this.MIN_VOICE_FRAMES) {
        console.log('有声音', hasVoice, this.consecutiveVoiceFrames)
        this.resetSilenceTimer()
        this.options.onVoiceStart()
      }
    } else {
      // 如果当前没有声音，则增加连续静音的帧数
      this.consecutiveSilenceFrames++
      this.consecutiveVoiceFrames = 0

      // 如果连续静音的帧数大于等于最小静音帧数，则认为说话结束
      if (this.consecutiveSilenceFrames >= this.MIN_SILENCE_FRAMES) {
        console.log('没有声音', hasVoice, this.consecutiveSilenceFrames)
        this.handleSilence()
      }
    }
  }

  private startAnalysis() {
    if (!this.analyser || !this.worker) return
    this.isListening = true

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const analyze = () => {
      if (!this.isListening || !this.analyser || !this.worker) return

      this.analyser.getByteFrequencyData(dataArray)
      this.worker.postMessage({
        type: 'analyze',
        data: dataArray,
      })

      requestAnimationFrame(analyze)
    }

    analyze()
  }

  stop() {
    this.isListening = false
    this.resetSilenceTimer()
    this.cleanup()
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.analyser = null
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }

  private handleSilence() {
    if (!this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.options.onVoiceEnd()
        this.silenceTimer = null
      }, this.options.silenceDuration)
    }
  }
}
