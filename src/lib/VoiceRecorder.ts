interface VoiceRecorderOptions {
  silenceThreshold?: number // 静音阈值
  silenceDuration?: number // 静音持续时间
  maxDuration?: number // 最大录音时长
  onSilenceEnd?: (audioBlob: Blob) => void // 静音结束回调
  onDataAvailable?: (audioBlob: Blob) => void // 数据可用回调
  onAmplitude?: (amplitude: number) => void // 音量回调
}

class VoiceRecorder {
  private options: Required<VoiceRecorderOptions>
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private silenceTimer: number | null = null
  private durationTimer: number | null = null
  private audioChunks: Blob[] = []
  private isRecording: boolean = false
  private stream: MediaStream | null = null

  constructor(options: VoiceRecorderOptions = {}) {
    this.options = {
      silenceThreshold: 50,
      silenceDuration: 2000,
      maxDuration: 60000, // 默认最大录音时长 60 秒
      onSilenceEnd: () => {},
      onDataAvailable: () => {},
      onAmplitude: () => {},
      ...options,
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      return
    }

    try {
      await this.initializeAudio()
      this.startRecording()
    } catch (error) {
      this.cleanup()
      throw new Error('无法启动录音：' + (error as Error).message)
    }
  }

  stop(): void {
    this.mediaRecorder?.stop()
    this.cleanup()
  }

  private async initializeAudio(): Promise<void> {
    // 请求麦克风权限
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    // 初始化音频上下文
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)

    // 设置 MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.getSupportedMimeType(),
    })

    // 设置事件监听
    this.setupMediaRecorderEvents()
  }

  private startRecording(): void {
    if (!this.mediaRecorder) return

    this.isRecording = true
    this.audioChunks = []
    this.mediaRecorder.start(100) // 每 100ms 触发一次 dataavailable 事件

    // 开始音量分析
    this.startVolumeAnalysis()

    // 设置最大录音时长
    this.durationTimer = setTimeout(() => {
      this.stop()
    }, this.options.maxDuration)
  }

  private setupMediaRecorderEvents(): void {
    if (!this.mediaRecorder) return

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data)
        this.options.onDataAvailable(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      this.processRecording()
    }
  }

  private startVolumeAnalysis(): void {
    if (!this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const analyzeVolume = () => {
      if (!this.isRecording || !this.analyser) return

      this.analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length

      this.options.onAmplitude(average)

      if (average < this.options.silenceThreshold) {
        this.handleSilence()
      } else {
        this.resetSilenceTimer()
      }

      requestAnimationFrame(analyzeVolume)
    }

    analyzeVolume()
  }

  private handleSilence(): void {
    if (!this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.stop()
      }, this.options.silenceDuration)
    }
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }

  private processRecording(): void {
    const audioBlob = new Blob(this.audioChunks, {
      type: this.getSupportedMimeType(),
    })
    this.options.onSilenceEnd(audioBlob)
  }

  private cleanup(): void {
    this.isRecording = false

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    if (this.durationTimer) {
      clearTimeout(this.durationTimer)
      this.durationTimer = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.mediaRecorder = null
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/wav']

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    throw new Error('没有支持的音频格式')
  }
}

export default VoiceRecorder

/**
 // 使用示例
const recorder = new VoiceRecorder({
  silenceThreshold: 50,
  silenceDuration: 2000,
  maxDuration: 30000, // 30 秒最大录音时长
  onSilenceEnd: (audioBlob) => {
    // 处理录音结果
    console.log('录音完成', audioBlob);
  },
  onAmplitude: (amplitude) => {
    // 实时获取音量
    console.log('当前音量:', amplitude);
  },
  onDataAvailable: (chunk) => {
    // 处理音频数据片段
    console.log('收到数据片段');
  }
});

// 开始录音
await recorder.start();

// 停止录音
recorder.stop();

 */
