<script setup lang="ts">
import { SunIcon, MoonIcon } from 'lucide-vue-next'
const icon = computed(() => (isDark.value ? MoonIcon : SunIcon))
defineOptions({ name: 'About' })
// hue 0-360 随机变化, 1秒变化累加2
const hue = ref(Math.floor(Math.random() * 360))
setInterval(() => {
  hue.value += 2
  if (hue.value > 360) {
    hue.value = 0
  }
}, 1000)
</script>

<template>
  <component :is="icon" class="size-6" @click="toggleDark()" />
  <div class="w-[400px] h-[400px]">
    <Orb force-hover-state :hue="hue" />
  </div>
</template>
