// 声音检测器，用于预先检测是否有声音
interface VoiceDetectorOptions {
  volumeThreshold: number
  silenceDuration: number
  onVoiceStart: () => void
  onVoiceEnd: () => void
  onAmplitude?: (amplitude: number) => void
}

export class VoiceDetector {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private isListening = false
  private silenceTimer: number | null = null
  private options: Required<VoiceDetectorOptions>

  constructor(options: VoiceDetectorOptions) {
    this.options = {
      volumeThreshold: 50,
      silenceDuration: 2000,
      onAmplitude: () => {},
      ...options,
    }
  }

  async start() {
    if (this.isListening) return

    try {
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
      this.isListening = true
      this.startVolumeAnalysis()
    } catch (error) {
      throw new Error('无法访问麦克风')
    }
  }

  stop() {
    this.isListening = false
    this.resetSilenceTimer()

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
  }

  private startVolumeAnalysis() {
    if (!this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    let isVoiceActive = false
    let consecutiveSilenceFrames = 0
    const silenceFrameThreshold = 10 // 连续多少帧低于阈值才算静音

    const analyzeVolume = () => {
      if (!this.isListening || !this.analyser) return

      this.analyser.getByteFrequencyData(dataArray)
      // 使用更精确的音量计算方法
      const average = Math.sqrt(dataArray.reduce((acc, val) => acc + val * val, 0) / dataArray.length)

      this.options.onAmplitude(average)
      console.log('average', average)
      if (average >= this.options.volumeThreshold) {
        consecutiveSilenceFrames = 0
        if (!isVoiceActive) {
          isVoiceActive = true
          this.resetSilenceTimer()
          this.options.onVoiceStart()
        }
      } else {
        consecutiveSilenceFrames++
        if (isVoiceActive && consecutiveSilenceFrames > silenceFrameThreshold) {
          handleSilence()
        }
      }

      requestAnimationFrame(analyzeVolume)
    }

    const handleSilence = () => {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          isVoiceActive = false // 重置说话状态
          this.options.onVoiceEnd()
          this.silenceTimer = null
        }, this.options.silenceDuration)
      }
    }
    analyzeVolume()
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }
}
