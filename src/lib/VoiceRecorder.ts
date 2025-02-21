interface VoiceRecorderOptions {
  maxDuration?: number
  onDataAvailable?: (audioBlob: Blob) => void
  onRecordingComplete: (audioBlob: Blob) => void
}

class VoiceRecorder {
  private options: Required<VoiceRecorderOptions>
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private audioChunks: Blob[] = []
  private durationTimer: number | null = null
  private isRecording: boolean = false

  constructor(options: VoiceRecorderOptions) {
    this.options = {
      maxDuration: 60000,
      onDataAvailable: () => {},
      ...options,
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) return

    try {
      await this.initializeRecorder()
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

  private async initializeRecorder(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000, // 适合语音识别的采样率
      },
    })

    const options = {
      mimeType: this.getSupportedMimeType(),
      audioBitsPerSecond: 16000,
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options)
    this.setupMediaRecorderEvents()
  }

  private startRecording(): void {
    if (!this.mediaRecorder) return

    this.isRecording = true
    this.audioChunks = []
    this.mediaRecorder.start(100)

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

  private processRecording(): void {
    const audioBlob = new Blob(this.audioChunks, {
      type: this.getSupportedMimeType(),
    })
    this.options.onRecordingComplete(audioBlob)
  }

  private cleanup(): void {
    this.isRecording = false

    if (this.durationTimer) {
      clearTimeout(this.durationTimer)
      this.durationTimer = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

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
  maxDuration: 30000, // 30 秒最大录音时长
  onRecordingComplete: (audioBlob) => {
    // 处理录音结果
    console.log('录音完成', audioBlob);
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
