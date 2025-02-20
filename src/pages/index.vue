<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import VoiceWakeup from '@/lib/VoiceWakeup'

const isListening = ref(false)
const lastCommand = ref('')
const messages = ref<Array<{ text: string; type: 'user' | 'assistant' }>>([])
const error = ref('')

const status = ref<'idle' | 'detecting' | 'recording' | 'processing'>('idle')

const voiceWakeup = new VoiceWakeup({
  wakeWord: '小助手',
  onWakeup: () => {
    addMessage('我在呢', 'assistant')
  },
  onCommand: (text) => {
    addMessage(text, 'user')
    // 模拟处理命令
    setTimeout(() => {
      addMessage('好的，我明白了', 'assistant')
    }, 1000)
  },
  onError: (err) => {
    error.value = err.message
    isListening.value = false
  },
  onStateChange: (newStatus) => {
    status.value = newStatus
  },
})

const addMessage = (text: string, type: 'user' | 'assistant') => {
  messages.value.push({ text, type })
  // 保持最新消息可见
  setTimeout(() => {
    const chatBox = document.querySelector('.chat-box')
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight
    }
  }, 100)
}

const startListening = async () => {
  try {
    error.value = ''
    isListening.value = true
    status.value = 'listening'
    await voiceWakeup.start()
  } catch (err) {
    error.value = (err as Error).message
    isListening.value = false
  }
}

const stopListening = () => {
  isListening.value = false
  status.value = 'idle'
  // 实现停止监听的逻辑
}

onUnmounted(() => {
  stopListening()
})
</script>

<template>
  <div class="voice-assistant">
    <div class="status-panel">
      <div class="status-indicator" :class="status">
        <div v-if="status !== 'idle'" class="status-waves">
          <div class="wave"></div>
          <div class="wave"></div>
          <div class="wave"></div>
        </div>
        <div class="status-text">
          {{
            {
              idle: '未启动',
              detecting: '等待说话',
              recording: '正在录音',
              processing: '处理中',
            }[status]
          }}
        </div>
      </div>

      <button :class="{ active: isListening }" @click="isListening ? stopListening() : startListening()">
        {{ isListening ? '停止监听' : '开始监听' }}
      </button>
    </div>

    <div class="chat-box">
      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.type]">
        {{ msg.text }}
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.voice-assistant {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.status-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.status-indicator {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 20px;
  background: #f5f5f5;
}

.status-waves {
  position: absolute;
  width: 100%;
  height: 100%;
}

.wave {
  position: absolute;
  border: 2px solid #4caf50;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: wave 2s infinite;
  opacity: 0;
}

.wave:nth-child(2) {
  animation-delay: 0.5s;
}

.wave:nth-child(3) {
  animation-delay: 1s;
}

@keyframes wave {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.status-indicator.listening {
  background: #e3f2fd;
}

.status-indicator.activated {
  background: #e8f5e9;
}

.status-indicator.processing {
  background: #fff3e0;
}

button {
  padding: 12px 24px;
  border: none;
  border-radius: 24px;
  background: #4caf50;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

button:hover {
  background: #45a049;
}

button.active {
  background: #f44336;
}

.chat-box {
  height: 300px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.message {
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 16px;
  max-width: 80%;
}

.message.user {
  background: #e3f2fd;
  margin-left: auto;
}

.message.assistant {
  background: #f5f5f5;
  margin-right: auto;
}

.error-message {
  color: #f44336;
  text-align: center;
  padding: 8px;
}
</style>
