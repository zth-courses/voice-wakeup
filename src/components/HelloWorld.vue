<script setup lang="ts">
import { Edit } from './Edit'

defineProps<{ msg: string }>()
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <Edit></Edit>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
