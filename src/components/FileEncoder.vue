<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  encodeFileToBase64,
  formatFileSize,
  getExtensionFromMime,
  getMimeCategory,
  getMaxFileSize
} from '../utils/fileEncoding.js'

const emit = defineEmits(['copy', 'download'])

// State
const file = ref(null)
const fileInput = ref(null)
const isDragging = ref(false)
const encodingMode = ref('raw') // 'raw' | 'dataurl'
const base64Output = ref('')
const error = ref('')
const encoding = ref(false)
const progress = ref(0)
const copyFeedback = ref(false)

// Preview refs
const previewUrl = ref('')

// Accepted MIME types
const acceptedTypes = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/bmp', 'image/x-icon', 'image/avif', 'image/vnd.microsoft.icon',
  'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/x-m4a', 'audio/mp4',
  'audio/aac', 'audio/webm', 'video/webm'
].join(',')

// Computed
const fileInfo = computed(() => {
  if (!file.value) return null
  const f = file.value
  const mime = f.type || 'application/octet-stream'
  return {
    name: f.name,
    type: getMimeCategory(mime),
    mime,
    size: formatFileSize(f.size),
    sizeBytes: f.size,
    extension: getExtensionFromMime(mime)
  }
})

const displayOutput = computed(() => {
  if (!base64Output.value) return ''
  if (encodingMode.value === 'dataurl' && fileInfo.value) {
    return `data:${fileInfo.value.mime};base64,${base64Output.value}`
  }
  return base64Output.value
})

const outputDirection = computed(() => 'ltr')

// Watchers
watch(file, (newFile) => {
  // Cleanup previous preview
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  base64Output.value = ''
  error.value = ''
  progress.value = 0

  if (newFile) {
    // Create preview for images and audio
    const cat = getMimeCategory(newFile.type)
    if (cat === 'image' || cat === 'audio') {
      previewUrl.value = URL.createObjectURL(newFile)
    }
    encodeFile(newFile)
  }
})

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

// Methods
function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const droppedFile = e.dataTransfer?.files?.[0]
  if (droppedFile) {
    setFile(droppedFile)
  }
}

function handleDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

function handleFileSelect(e) {
  const selectedFile = e.target.files?.[0]
  if (selectedFile) {
    setFile(selectedFile)
  }
}

function setFile(f) {
  error.value = ''
  if (f.size === 0) {
    error.value = 'File is empty'
    return
  }
  if (f.size > getMaxFileSize()) {
    error.value = `File is too large. Maximum supported size: ${formatFileSize(getMaxFileSize())}.`
    return
  }
  file.value = f
}

function triggerFileInput() {
  fileInput.value?.click()
}

function clearFile() {
  file.value = null
  base64Output.value = ''
  error.value = ''
  progress.value = 0
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function encodeFile(f) {
  encoding.value = true
  progress.value = 0
  error.value = ''
  try {
    base64Output.value = await encodeFileToBase64(f, (p) => {
      progress.value = p
    })
  } catch (err) {
    error.value = err.message || 'Encoding failed'
    base64Output.value = ''
  } finally {
    encoding.value = false
    progress.value = 100
  }
}

async function copyOutput() {
  if (!displayOutput.value) return
  try {
    await navigator.clipboard.writeText(displayOutput.value)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = displayOutput.value
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

function downloadOutput() {
  if (!displayOutput.value || !file.value) return
  const blob = new Blob([displayOutput.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${file.value.name}.base64.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Privacy message -->
    <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700/50">
      Your files are processed locally in your browser and are never uploaded.
    </div>

    <!-- Drop Zone -->
    <div
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
      @keydown.enter="triggerFileInput"
      @keydown.space.prevent="triggerFileInput"
      role="button"
      tabindex="0"
      :aria-label="'Choose a file or drag and drop'"
      :class="[
        'relative rounded-xl border-2 border-dashed transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950',
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedTypes"
        @change="handleFileSelect"
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
      />
      <div class="flex flex-col items-center justify-center py-10 px-4 sm:py-14 text-center">
        <!-- Upload icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Drop your file here
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          or
        </p>
        <button
          type="button"
          @click.stop="triggerFileInput"
          class="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Choose File
        </button>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Images and audio supported
        </p>
      </div>
    </div>

    <!-- File Info -->
    <div v-if="fileInfo" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div class="flex flex-col sm:flex-row sm:items-start gap-4">
        <!-- Preview -->
        <div v-if="previewUrl" class="shrink-0">
          <!-- Image preview -->
          <img
            v-if="fileInfo.type === 'image'"
            :src="previewUrl"
            :alt="fileInfo.name"
            class="w-full sm:w-40 h-auto max-h-48 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <!-- Audio preview -->
          <audio
            v-else-if="fileInfo.type === 'audio'"
            :src="previewUrl"
            controls
            class="w-full sm:w-64"
          >
            Your browser does not support the audio element.
          </audio>
        </div>

        <!-- File details -->
        <div class="flex-1 min-w-0 space-y-1">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ fileInfo.name }}</h3>
            <button
              @click="clearFile"
              class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Remove file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{{ fileInfo.type }} file</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ fileInfo.mime }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ fileInfo.size }}</p>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-400 dark:text-gray-500">Status:</span>
            <span v-if="encoding" class="text-xs text-amber-600 dark:text-amber-400 font-medium">Encoding...</span>
            <span v-else-if="base64Output" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
            <span v-else-if="error" class="text-xs text-red-600 dark:text-red-400 font-medium">Error</span>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="encoding" class="mt-4">
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            class="bg-blue-600 h-2 rounded-full transition-all duration-200"
            :style="{ width: progress + '%' }"
          ></div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{{ progress }}%</p>
      </div>
    </div>

    <!-- Encoding Mode Selector -->
    <div v-if="base64Output" class="flex flex-col sm:flex-row sm:items-center gap-3">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Output Mode:</label>
      <div class="flex gap-2">
        <button
          @click="encodingMode = 'raw'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            encodingMode === 'raw'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]"
        >
          Raw Base64
        </button>
        <button
          @click="encodingMode = 'dataurl'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            encodingMode === 'dataurl'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]"
        >
          Data URL
        </button>
      </div>
    </div>

    <!-- Output -->
    <div v-if="base64Output" class="flex flex-col">
      <label for="file-output-area" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        Base64 Output
      </label>
      <textarea
        id="file-output-area"
        :value="displayOutput"
        dir="ltr"
        rows="12"
        readonly
        class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm leading-relaxed focus:outline-none font-mono placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Error -->
    <div v-if="error"
      class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Copy feedback -->
    <div v-if="copyFeedback" class="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
      Copied!
    </div>

    <!-- Action Buttons -->
    <div v-if="base64Output" class="flex flex-wrap gap-2">
      <button
        @click="copyOutput"
        :disabled="!displayOutput"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Copy Base64 output to clipboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        Copy
      </button>

      <button
        @click="downloadOutput"
        :disabled="!displayOutput || !file"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Download Base64 as text file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download .txt
      </button>
    </div>
  </div>
</template>
