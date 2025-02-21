import VoiceRecorder from './VoiceRecorder'
import { VoiceDetector } from './VoiceDetector'
// import { VoiceDetector } from './VoiceDetector.worker'
export type VoiceWakeupState = 'idle' | 'detecting' | 'recording' | 'processing' | 'error'

interface VoiceWakeupOptions {
  wakeWord: string
  silenceThreshold?: number
  silenceDuration?: number
  onWakeup?: () => void
  onCommand?: (text: string) => void
  onError?: (error: Error) => void
  onStateChange?: (state: VoiceWakeupState) => void
}

export default class VoiceWakeup {
  private options: VoiceWakeupOptions
  private recorder: VoiceRecorder
  private detector: VoiceDetector
  private isActivated: boolean = false
  private speechSynth: SpeechSynthesis
  private state: VoiceWakeupState = 'idle'
  private isStopped: boolean = false

  constructor(options: VoiceWakeupOptions) {
    this.options = {
      silenceThreshold: 100,
      silenceDuration: 2000,
      ...options,
    }

    this.detector = new VoiceDetector({
      volumeThreshold: this.options.silenceThreshold,
      silenceDuration: this.options.silenceDuration,
      onVoiceStart: this.startRecording.bind(this),
      onVoiceEnd: this.stopRecording.bind(this),
      onAmplitude: (amplitude) => {
        // 可以用来更新UI显示音量等
      },
    })

    this.recorder = new VoiceRecorder({
      maxDuration: 30000, // 30秒最大录音时长
      onRecordingComplete: this.handleSpeechEnd.bind(this),
    })

    this.speechSynth = window.speechSynthesis
  }
  // 开始监听
  async start() {
    try {
      this.isStopped = false
      this.setState('detecting')
      await this.detector.start()
    } catch (error) {
      this.options.onError?.(error as Error)
      this.setState('error')
      // 尝试自动恢复
      this.scheduleReconnect()
    }
  }
  stop() {
    this.isStopped = true
    this.detector.stop()
    this.recorder.stop()
    this.setState('idle')
  }
  private setState(state: VoiceWakeupState) {
    if (this.isStopped && state !== 'idle') {
      return
    }
    this.state = state
    this.options.onStateChange?.(state)
  }
  // 检测到声音, 开始录音
  private async startRecording() {
    try {
      this.setState('recording')
      await this.recorder.start()
    } catch (error) {
      this.options.onError?.(error as Error)
      this.setState('error')
      this.scheduleReconnect()
    }
  }
  // 当录音结束时, 处理逻辑
  private async handleSpeechEnd(audioBlob: Blob) {
    try {
      if (this.isStopped) {
        return
      }

      this.setState('processing')
      const text = await this.speechToText(audioBlob)

      if (this.isStopped) {
        return
      }

      if (this.containsWakeWord(text)) {
        await this.handleWakeup()
      } else if (this.isActivated) {
        await this.handleCommand(text)
      }

      if (!this.isStopped) {
        this.setState('detecting')
      }
    } catch (error) {
      this.options.onError?.(error as Error)
      if (!this.isStopped) {
        this.setState('error')
        this.scheduleReconnect()
      }
    }
  }

  // 判断是否包含唤醒词
  private containsWakeWord(text: string): boolean {
    return text.toLowerCase().includes(this.options.wakeWord.toLowerCase())
  }

  // 处理唤醒
  private async handleWakeup() {
    if (this.isStopped) return
    this.isActivated = true
    this.options.onWakeup?.()
    await this.speak('你好，我是小助手')
  }

  // 处理命令
  private async handleCommand(text: string) {
    if (this.isStopped) return
    this.options.onCommand?.(text)
  }

  // 语音播报
  private async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.onend = () => resolve()
      this.speechSynth.speak(utterance)
    })
  }

  // 假设这是你提供的语音转文本服务
  private async speechToText(audioBlob: Blob): Promise<string> {
    // 这里需要实现你的语音转文本逻辑
    // throw new Error('需要实现语音转文本服务')
    return '小助手'
  }
  // 添加自动重新连接逻辑

  private async reconnect() {
    if (this.state === 'idle') return

    try {
      await this.detector.stop()

      await new Promise((resolve) => setTimeout(resolve, 1000))

      await this.start()
    } catch (error) {
      this.options.onError?.(error as Error)

      // 如果重连失败，等待后再试

      setTimeout(() => this.reconnect(), 5000)
    }
  }
  private async stopRecording() {
    if (this.state === 'recording') {
      this.recorder.stop()
    }
  }

  private scheduleReconnect(delay: number = 5000) {
    if (this.isStopped) return
    setTimeout(() => {
      if (!this.isStopped && this.state === 'error') {
        this.reconnect()
      }
    }, delay)
  }
}
/**
 * 使用示例
 const wakeup = new VoiceWakeup({
  wakeWord: '小助手',
  onWakeup: () => {
    console.log('唤醒成功！')
  },
  onCommand: (text) => {
    console.log('收到命令:', text)
  },
  onError: (error) => {
    console.error('发生错误:', error)
  },
   onStateChange: (newStatus) => {
    console.log('当前状态:', newStatus)
  }
})

// 开始监听
wakeup.start()
*/
