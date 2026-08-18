<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  encodeBase64, decodeBase64,
  encodeHex, decodeHex,
  encodeBinary, decodeBinary,
  detectDirection
} from './utils/encoding.js'
import { getInitialTheme, applyTheme, toggleTheme } from './utils/theme.js'
import FileEncoder from './components/FileEncoder.vue'
import Base64ToFile from './components/Base64ToFile.vue'
import HashGenerator from './components/HashGenerator.vue'
import QRCodeTool from './components/QRCodeTool.vue'

// State

const theme = ref('dark')
const activeTab = ref('text') // 'text' | 'file-encode' | 'file-decode' | 'hash' | 'qr'
const format = ref('base64')
const operation = ref('encode')
const input = ref('')
const output = ref('')
const error = ref('')
const copyFeedback = ref(false)

// Theme

onMounted(() => {
  theme.value = getInitialTheme()
  applyTheme(theme.value)
})

function handleToggleTheme() {
  theme.value = toggleTheme(theme.value)
}

// Detection

const inputDirection = computed(() => {
  if (operation.value === 'decode') return 'ltr'
  return detectDirection(input.value)
})

const outputDirection = computed(() => {
  if (operation.value === 'encode') return 'ltr'
  return detectDirection(output.value)
})

// Count

const inputCharCount = computed(() => input.value.length)

// EncodingDecoding

const encoders = {
  base64: { encode: encodeBase64, decode: decodeBase64 },
  hex: { encode: encodeHex, decode: decodeHex },
  binary: { encode: encodeBinary, decode: decodeBinary },
}

function process() {
  error.value = ''
  output.value = ''
  if (!input.value) return
  try {
    const fn = encoders[format.value][operation.value]
    output.value = fn(input.value)
  } catch (e) {
    error.value = e.message || 'An error occurred'
  }
}

// Auto-process on input/format/operation change
watch([input, format, operation], () => {
  process()
})

// Copy

async function copyOutput() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = output.value
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  }
}

// Download

function downloadOutput() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'encoded-result.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Swap

function swap() {
  const tmp = input.value
  input.value = output.value
  output.value = tmp
  operation.value = operation.value === 'encode' ? 'decode' : 'encode'
  error.value = ''
}

// Clear

function clearAll() {
  input.value = ''
  output.value = ''
  error.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 theme-transition">
    <!-- Header -->
    <header class="border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">MAM Dev Tools</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">
            Encode and decode text, images, audio, hashes, and QR codes.
          </p>
        </div>
        <button @click="handleToggleTheme"
          class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5" />
            <path
              d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <!-- Tab Navigation -->
      <div class="flex flex-wrap gap-2 mb-6">
        <button v-for="tab in [
          { id: 'text', label: 'Text' },
          { id: 'file-encode', label: 'File \u2192 Base64' },
          { id: 'file-decode', label: 'Base64 \u2192 File' },
          { id: 'hash', label: 'Hash' },
          { id: 'qr', label: 'QR Code' }
        ]" :key="tab.id" @click="activeTab = tab.id" :class="[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          activeTab === tab.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        ]" :aria-pressed="activeTab === tab.id">
          {{ tab.label }}
        </button>
      </div>

      <!-- Text Encoder Tab -->
      <div v-if="activeTab === 'text'">
        <!-- Format & Operation Selectors -->
        <div class="flex flex-col sm:flex-row gap-3 mb-6">
          <div class="flex gap-2">
            <button v-for="f in ['base64', 'hex', 'binary']" :key="f" @click="format = f" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              format === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            ]" :aria-pressed="format === f">
              {{ f }}
            </button>
          </div>

          <div class="flex gap-2 sm:ml-auto">
            <button @click="operation = 'encode'" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              operation === 'encode'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            ]" :aria-pressed="operation === 'encode'">
              Encode
            </button>
            <button @click="operation = 'decode'" :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              operation === 'decode'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            ]" :aria-pressed="operation === 'decode'">
              Decode
            </button>
          </div>
        </div>

        <!-- Text Areas -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <!-- Input -->
          <div class="flex flex-col">
            <label for="input-area" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
              Input
            </label>
            <textarea id="input-area" v-model="input" :dir="inputDirection" rows="12"
              :placeholder="operation === 'encode' ? 'Enter text to encode...' : 'Enter encoded text to decode...'"
              class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
              spellcheck="false"></textarea>
            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right">
              {{ inputCharCount }} characters
            </div>
          </div>

          <!-- Output -->
          <div class="flex flex-col">
            <label for="output-area" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
              Output
            </label>
            <textarea id="output-area" :value="output" :dir="outputDirection" rows="12" readonly
              placeholder="Result will appear here..."
              class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm leading-relaxed focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
              spellcheck="false"></textarea>

            <!-- Error -->
            <div v-if="error"
              class="mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {{ error }}
            </div>

            <!-- Copy feedback -->
            <div v-if="copyFeedback" class="mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              Copied!
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-2 mt-6">
          <button @click="copyOutput" :disabled="!output"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Copy output to clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy
          </button>

          <button @click="downloadOutput" :disabled="!output"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Download output as text file">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download .txt
          </button>

          <button @click="swap"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label="Swap input and output">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            Swap
          </button>

          <button @click="clearAll"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label="Clear input and output">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      <!-- File Encoder Tab -->
      <div v-if="activeTab === 'file-encode'">
        <FileEncoder />
      </div>

      <!-- Base64 to File Tab -->
      <div v-if="activeTab === 'file-decode'">
        <Base64ToFile />
      </div>

      <!-- Hash Generator Tab -->
      <div v-if="activeTab === 'hash'">
        <HashGenerator />
      </div>

      <!-- QR Code Tab -->
      <div v-if="activeTab === 'qr'">
        <QRCodeTool />
      </div>
    </main>
  </div>
</template>
