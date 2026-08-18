<script setup>
import { ref, computed, watch } from 'vue'
import {
  decodeBase64ToFile,
  getExtensionFromMime,
  MIME_EXTENSIONS
} from '../utils/fileEncoding.js'

const base64Input = ref('')
const mimeType = ref('')
const filename = ref('')
const error = ref('')
const detectedMimeType = ref('')
const detectedExt = ref('')

// Predefined MIME types for the dropdown
const commonMimeTypes = [
  { group: 'Images', items: [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/x-icon', 'image/avif'
  ]},
  { group: 'Audio', items: [
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
    'audio/x-m4a', 'audio/aac', 'audio/webm'
  ]},
]

// Watch for Data URL auto-detection
watch(base64Input, (val) => {
  error.value = ''
  detectedMimeType.value = ''
  detectedExt.value = ''

  const dataUrlMatch = val.trim().match(/^data:([^;]+);base64,/)
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1]
    detectedMimeType.value = mime
    detectedExt.value = getExtensionFromMime(mime)
    // Auto-fill filename if empty
    if (!filename.value) {
      filename.value = `decoded-file.${detectedExt.value}`
    }
  }
})

const selectedMime = computed(() => {
  return detectedMimeType.value || mimeType.value || ''
})

const suggestedFilename = computed(() => {
  if (filename.value) return filename.value
  if (selectedMime.value) {
    return `decoded-file.${getExtensionFromMime(selectedMime.value)}`
  }
  return 'decoded-file.bin'
})

const canDecode = computed(() => {
  return base64Input.value.trim().length > 0 && (selectedMime.value || detectedMimeType.value)
})

function handleDecode() {
  error.value = ''
  try {
    const result = decodeBase64ToFile(
      base64Input.value,
      selectedMime.value,
      suggestedFilename.value
    )

    // Download the file
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message || 'Failed to decode Base64'
  }
}

function clearAll() {
  base64Input.value = ''
  mimeType.value = ''
  filename.value = ''
  error.value = ''
  detectedMimeType.value = ''
  detectedExt.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Base64 Input -->
    <div class="flex flex-col">
      <label for="b64-to-file-input" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        Base64 Input
      </label>
      <textarea
        id="b64-to-file-input"
        v-model="base64Input"
        dir="ltr"
        rows="10"
        placeholder="Paste Base64 string or Data URL here..."
        class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 font-mono theme-transition"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Auto-detected MIME type -->
    <div v-if="detectedMimeType" class="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm">
      Detected MIME type: <span class="font-mono font-medium">{{ detectedMimeType }}</span>
    </div>

    <!-- MIME Type Selector (only when not a Data URL) -->
    <div v-if="!detectedMimeType" class="flex flex-col">
      <label for="mime-type-select" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        MIME Type
      </label>
      <select
        id="mime-type-select"
        v-model="mimeType"
        class="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 theme-transition"
      >
        <option value="">Select MIME type...</option>
        <optgroup v-for="group in commonMimeTypes" :key="group.group" :label="group.group">
          <option v-for="mime in group.items" :key="mime" :value="mime">{{ mime }}</option>
        </optgroup>
      </select>
    </div>

    <!-- Filename -->
    <div class="flex flex-col">
      <label for="output-filename" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        Filename
      </label>
      <input
        id="output-filename"
        v-model="filename"
        type="text"
        :placeholder="suggestedFilename"
        class="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
      />
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
        Suggested: {{ suggestedFilename }}
      </p>
    </div>

    <!-- Error -->
    <div v-if="error"
      class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Actions -->
    <div class="flex flex-wrap gap-2">
      <button
        @click="handleDecode"
        :disabled="!canDecode"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Decode &amp; Download
      </button>

      <button
        @click="clearAll"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        aria-label="Clear input"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Clear
      </button>
    </div>
  </div>
</template>
