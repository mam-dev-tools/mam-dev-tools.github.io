<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { formatFileSize, getMimeCategory } from '../utils/fileEncoding.js'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const ALGORITHMS = ['SHA-256', 'SHA-384', 'SHA-512']

// State
const inputType = ref('text')
const algorithm = ref('SHA-256')
const textInput = ref('')
const file = ref(null)
const fileInput = ref(null)
const isDragging = ref(false)
const hashing = ref(false)
const error = ref('')
const results = ref({})
const copyFeedback = ref('')
const verifyMode = ref(false)
const expectedHash = ref('')
const verificationResult = ref(null)

// File preview
const previewUrl = ref('')

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
    sizeBytes: f.size
  }
})

const currentHash = computed(() => results.value[algorithm.value] || '')
const hasResults = computed(() => Object.keys(results.value).length > 0)

const verificationHash = computed(() => {
  if (!verifyMode.value) return ''
  return expectedHash.value.trim()
})

const normalizedExpected = computed(() => verificationHash.value.toLowerCase())
const normalizedActual = computed(() => currentHash.value.toLowerCase())

const hashesMatch = computed(() => {
  if (!normalizedExpected.value || !normalizedActual.value) return null
  return normalizedExpected.value === normalizedActual.value
})

const downloadFilename = computed(() => {
  const algo = algorithm.value.toLowerCase().replace('-', '')
  if (file.value) {
    return `${file.value.name}.${algo}.txt`
  }
  return `${algo}-hash.txt`
})

const downloadAllContent = computed(() => {
  if (!hasResults.value) return ''
  return ALGORITHMS
    .filter(a => results.value[a])
    .map(a => `${a}\n${results.value[a]}`)
    .join('\n\n')
})

const downloadAllFilename = computed(() => {
  if (file.value) return `${file.value.name}.hashes.txt`
  return 'hashes.txt'
})

// Watchers
watch(file, (newFile) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  results.value = {}
  error.value = ''
  verificationResult.value = null
  if (newFile) {
    const cat = getMimeCategory(newFile.type)
    if (cat === 'image' || cat === 'audio') {
      previewUrl.value = URL.createObjectURL(newFile)
    }
  }
})

watch(inputType, () => {
  results.value = {}
  error.value = ''
  verificationResult.value = null
})

watch(algorithm, () => {
  verificationResult.value = null
})

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

// Methods
function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const droppedFile = e.dataTransfer?.files?.[0]
  if (droppedFile) setFile(droppedFile)
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
  if (selectedFile) setFile(selectedFile)
}

function setFile(f) {
  error.value = ''
  results.value = {}
  verificationResult.value = null
  if (f.size === 0) {
    error.value = 'File is empty'
    return
  }
  if (f.size > MAX_FILE_SIZE) {
    error.value = `File is too large. Maximum supported size: ${formatFileSize(MAX_FILE_SIZE)}.`
    return
  }
  file.value = f
}

function triggerFileInput() {
  fileInput.value?.click()
}

function clearFile() {
  file.value = null
  results.value = {}
  error.value = ''
  verificationResult.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  if (fileInput.value) fileInput.value.value = ''
}

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeHash(data, algo) {
  const hashBuffer = await crypto.subtle.digest(algo, data)
  return arrayBufferToHex(hashBuffer)
}

async function generateHashes(algos) {
  error.value = ''
  hashing.value = true
  results.value = {}
  verificationResult.value = null

  try {
    let data
    if (inputType.value === 'text') {
      if (!textInput.value) {
        error.value = 'Please enter some text to hash'
        return
      }
      data = new TextEncoder().encode(textInput.value)
    } else {
      if (!file.value) {
        error.value = 'Please select a file to hash'
        return
      }
      data = await file.value.arrayBuffer()
    }

    for (const algo of algos) {
      results.value[algo] = await computeHash(data, algo)
    }

    if (verifyMode.value && verificationHash.value && algos.length === 1) {
      verificationResult.value = hashesMatch.value
    }
  } catch (err) {
    error.value = err.message || 'Hashing failed'
    results.value = {}
  } finally {
    hashing.value = false
  }
}

function generateHash() {
  generateHashes([algorithm.value])
}

function generateAll() {
  generateHashes([...ALGORITHMS])
}

async function copyHash() {
  if (!currentHash.value) return
  try {
    await navigator.clipboard.writeText(currentHash.value)
    copyFeedback.value = algorithm.value
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = currentHash.value
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = algorithm.value
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  }
}

async function copyAllHashes() {
  if (!downloadAllContent.value) return
  try {
    await navigator.clipboard.writeText(downloadAllContent.value)
    copyFeedback.value = 'all'
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = downloadAllContent.value
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = 'all'
    setTimeout(() => { copyFeedback.value = '' }, 1500)
  }
}

function downloadHash() {
  if (!currentHash.value) return
  const blob = new Blob([currentHash.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFilename.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadAllHashes() {
  if (!downloadAllContent.value) return
  const blob = new Blob([downloadAllContent.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadAllFilename.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Privacy message -->
    <div
      class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700/50">
      Your data is hashed locally in your browser and is never uploaded.
    </div>

    <!-- Info box -->
    <div
      class="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
      <strong>Hashing is not encryption.</strong> A cryptographic hash is a one-way function used to produce a
      fixed-length fingerprint of data. It is not designed to be decrypted back into the original input.
    </div>

    <!-- Input Type Selector -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Input Type:</label>
      <div class="flex gap-2">
        <button @click="inputType = 'text'" :class="[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          inputType === 'text'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        ]">
          Text
        </button>
        <button @click="inputType = 'file'" :class="[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          inputType === 'file'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        ]">
          File
        </button>
      </div>
    </div>

    <!-- Text Input -->
    <div v-if="inputType === 'text'" class="flex flex-col">
      <label for="hash-text-input" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        Text to Hash
      </label>
      <textarea id="hash-text-input" v-model="textInput" rows="10" placeholder="Enter text to hash..."
        class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
        spellcheck="false"></textarea>
      <div class="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right">
        {{ textInput.length }} characters
      </div>
    </div>

    <!-- File Input -->
    <div v-if="inputType === 'file'">
      <!-- Drop Zone -->
      <div v-if="!file" @drop="handleDrop" @dragover="handleDragOver" @dragleave="handleDragLeave"
        @click="triggerFileInput" @keydown.enter="triggerFileInput" @keydown.space.prevent="triggerFileInput"
        role="button" tabindex="0" aria-label="Choose a file or drag and drop" :class="[
          'relative rounded-xl border-2 border-dashed transition-colors cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
        ]">
        <input ref="fileInput" type="file" @change="handleFileSelect" class="hidden" aria-hidden="true" tabindex="-1" />
        <div class="flex flex-col items-center justify-center py-10 px-4 sm:py-14 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop your file here
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">or</p>
          <button type="button" @click.stop="triggerFileInput"
            class="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Choose File
          </button>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Any file type supported
          </p>
        </div>
      </div>

      <!-- File Info -->
      <div v-if="fileInfo" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ fileInfo.name }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ fileInfo.mime }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ fileInfo.size }}</p>
          </div>
          <button @click="clearFile"
            class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Remove file">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Algorithm Selector -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <label for="hash-algo-select" class="text-sm font-medium text-gray-600 dark:text-gray-400">
        Hash Algorithm:
      </label>
      <select id="hash-algo-select" v-model="algorithm"
        class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 theme-transition">
        <option v-for="a in ALGORITHMS" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <!-- Verify Mode Toggle -->
    <div class="flex items-center gap-3">
      <input id="verify-mode" v-model="verifyMode" type="checkbox"
        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
      <label for="verify-mode" class="text-sm font-medium text-gray-600 dark:text-gray-400">
        Verify Hash
      </label>
    </div>

    <!-- Expected Hash Input -->
    <div v-if="verifyMode" class="flex flex-col">
      <label for="expected-hash" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
        Expected Hash
      </label>
      <input id="expected-hash" v-model="expectedHash" type="text" placeholder="Paste the expected hash here..."
        class="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 font-mono theme-transition"
        dir="ltr" />
      <p v-if="expectedHash && expectedHash.length > 0 && expectedHash.length !== (algorithm === 'SHA-256' ? 64 : algorithm === 'SHA-384' ? 96 : 128)"
        class="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
        Expected {{ algorithm }} hash length is {{ algorithm === 'SHA-256' ? '64' : algorithm === 'SHA-384' ? '96' :
        '128' }} characters (current: {{ expectedHash.length }})
      </p>
    </div>

    <!-- Generate Buttons -->
    <div class="flex flex-wrap gap-2">
      <button @click="generateHash"
        :disabled="hashing || (inputType === 'text' && !textInput) || (inputType === 'file' && !file)"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <svg v-if="!hashing" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Generate Hash
      </button>
      <button @click="generateAll"
        :disabled="hashing || (inputType === 'text' && !textInput) || (inputType === 'file' && !file)"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Generate All
      </button>
    </div>

    <!-- Error -->
    <div v-if="error"
      class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Results -->
    <div v-if="hasResults" class="space-y-4">
      <!-- Single algorithm result -->
      <div v-if="Object.keys(results).length === 1" class="flex flex-col">
        <label for="hash-output" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
          {{ algorithm }} Hash
        </label>
        <textarea id="hash-output" :value="currentHash" dir="ltr" rows="4" readonly
          class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm leading-relaxed focus:outline-none font-mono placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
          spellcheck="false"></textarea>

        <!-- Verification result -->
        <div v-if="verifyMode && verificationHash && verificationResult !== null" class="mt-2">
          <div v-if="verificationResult"
            class="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            &#10003; Hash matches
          </div>
          <div v-else
            class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
            &#10007; Hash does not match
          </div>
        </div>

        <!-- Copy feedback -->
        <div v-if="copyFeedback === algorithm" class="mt-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          Copied!
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 mt-3">
          <button @click="copyHash" :disabled="!currentHash"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Copy hash to clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy
          </button>
          <button @click="downloadHash" :disabled="!currentHash"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Download hash as text file">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download .txt
          </button>
        </div>
      </div>

      <!-- Multiple algorithm results -->
      <div v-else class="space-y-4">
        <div v-for="algo in ALGORITHMS" :key="algo" class="flex flex-col">
          <label class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
            {{ algo }}
          </label>
          <textarea :value="results[algo]" dir="ltr" rows="3" readonly
            class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm leading-relaxed focus:outline-none font-mono placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
            spellcheck="false"></textarea>
        </div>

        <!-- Verification for multi -->
        <div v-if="verifyMode && verificationHash && verificationResult !== null" class="mt-2">
          <div v-if="verificationResult"
            class="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            &#10003; Hash matches
          </div>
          <div v-else
            class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
            &#10007; Hash does not match
          </div>
        </div>

        <!-- Copy feedback -->
        <div v-if="copyFeedback === 'all'" class="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          Copied!
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <button @click="copyAllHashes"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label="Copy all hashes to clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy All
          </button>
          <button @click="downloadAllHashes"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            aria-label="Download all hashes as text file">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download All .txt
          </button>
        </div>
      </div>
    </div>

    <!-- Password warning -->
    <div
      class="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
      This is a general-purpose hash generator, not a password storage system. Plain SHA-256/384/512 should not be used
      for password hashing — use a dedicated password hashing algorithm (e.g., Argon2, bcrypt, scrypt) instead.
    </div>
  </div>
</template>
