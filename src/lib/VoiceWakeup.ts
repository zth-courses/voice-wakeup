import VoiceRecorder from './VoiceRecorder'
import { VoiceDetector } from './VoiceDetector'
interface VoiceWakeupOptions {
  wakeWord: string
  silenceThreshold?: number
  silenceDuration?: number
  onWakeup?: () => void
  onCommand?: (text: string) => void
  onError?: (error: Error) => void
  onStateChange?: (state: 'idle' | 'detecting' | 'recording' | 'processing') => void
}

export default class VoiceWakeup {
  private options: VoiceWakeupOptions
  private recorder: VoiceRecorder
  private detector: VoiceDetector
  private isActivated: boolean = false
  private speechSynth: SpeechSynthesis
  private state: 'idle' | 'detecting' | 'recording' | 'processing' = 'idle'

  constructor(options: VoiceWakeupOptions) {
    this.options = {
      silenceThreshold: 50,
      silenceDuration: 2000,
      ...options,
    }

    this.detector = new VoiceDetector({
      volumeThreshold: this.options.silenceThreshold,
      onVoiceStart: this.startRecording.bind(this),
    })

    this.recorder = new VoiceRecorder({
      silenceThreshold: this.options.silenceThreshold,
      silenceDuration: this.options.silenceDuration,
      onSilenceEnd: this.handleSpeechEnd.bind(this),
    })

    this.speechSynth = window.speechSynthesis
  }
  // 开始监听
  async start() {
    try {
      this.setState('detecting')
      await this.detector.start()
    } catch (error) {
      this.options.onError?.(error as Error)
      this.setState('idle')
    }
  }
  stop() {
    this.detector.stop()
    this.recorder.stop()
    this.setState('idle')
  }
  private setState(state: 'idle' | 'detecting' | 'recording' | 'processing') {
    this.state = state
    this.options.onStateChange?.(state)
  }
  private async startRecording() {
    this.detector.stop() // 停止检测
    this.setState('recording')
    await this.recorder.start()
  }
  // 处理语音结束
  private async handleSpeechEnd(audioBlob: Blob) {
    try {
      this.setState('processing')
      const text = await this.speechToText(audioBlob)

      if (this.containsWakeWord(text)) {
        await this.handleWakeup()
      } else if (this.isActivated) {
        await this.handleCommand(text)
      }

      // 重新开始检测声音
      this.setState('detecting')
      await this.detector.start()
    } catch (error) {
      this.options.onError?.(error as Error)
      this.setState('idle')
    }
  }

  // 判断是否包含唤醒词
  private containsWakeWord(text: string): boolean {
    return text.toLowerCase().includes(this.options.wakeWord.toLowerCase())
  }

  // 处理唤醒
  private async handleWakeup() {
    this.isActivated = true
    this.options.onWakeup?.()
    await this.speak('我在呢')
  }

  // 处理命令
  private async handleCommand(text: string) {
    this.options.onCommand?.(text)
    // 这里可以添加命令处理逻辑
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
