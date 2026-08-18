<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import QRCodeStyling from 'qr-code-styling'
import jsQR from 'jsqr'
import { Html5Qrcode } from 'html5-qrcode'
import { formatFileSize, getExtensionFromMime, getMimeCategory } from '../utils/fileEncoding.js'

const MAX_QR_PAYLOAD_BYTES = 100 * 1024

const EC_LEVELS = [
  { label: 'Low (7%)', value: 'L' },
  { label: 'Medium (15%)', value: 'M' },
  { label: 'Quartile (25%)', value: 'Q' },
  { label: 'High (30%)', value: 'H' }
]

const SIZE_OPTIONS = [
  { label: 'Small', width: 200 },
  { label: 'Medium', width: 300 },
  { label: 'Large', width: 400 }
]

// QR capacity estimates per EC level (approximate byte capacity for version 40)
const QR_CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 }

// State - Generator
const mode = ref('generate') // 'generate' | 'scan'
const contentType = ref('text') // 'text' | 'url' | 'base64'
const textInput = ref('')
const ecLevel = ref('M')
const qrSize = ref(300)
const qrInstance = ref(null)
const qrDataUrl = ref('')
const generating = ref(false)
const generateError = ref('')
const copyFeedback = ref(false)
const file = ref(null)
const fileInput = ref(null)
const isDragging = ref(false)

// State - Scanner
const scannerActive = ref(false)
const scanResult = ref('')
const scanError = ref('')
const scanFileInput = ref(null)
const decodedPreview = ref(null)
const decodedMime = ref('')
const decodedFileName = ref('')
const rawBase64Mode = ref(false)
const rawBase64Mime = ref('')
let html5QrInstance = null

// Computed
const payloadBytes = computed(() => {
  const text = textInput.value
  return new TextEncoder().encode(text).length
})

const capacityForLevel = computed(() => QR_CAPACITY[ecLevel.value] || 2331)

const isOverCapacity = computed(() => payloadBytes.value > capacityForLevel.value)

const canGenerate = computed(() => {
  if (!textInput.value) return false
  if (isOverCapacity.value) return false
  return true
})

const fileDataUrl = computed(() => {
  if (!file.value) return ''
  return `data:${file.value.type};base64,`
})

// Watchers
watch([contentType, ecLevel], () => {
  qrDataUrl.value = ''
  generateError.value = ''
})

watch(mode, (val) => {
  if (val !== 'scan' && scannerActive.value) {
    stopCamera()
  }
})

onBeforeUnmount(() => {
  if (scannerActive.value) stopCamera()
})

//  Generator Methods 

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
  generateError.value = ''
  if (f.size === 0) {
    generateError.value = 'File is empty'
    return
  }
  if (f.size > 10 * 1024 * 1024) {
    generateError.value = 'File too large for QR encoding. Maximum practical size is about 10 MB.'
    return
  }
  file.value = f
}

function triggerFileInput() {
  fileInput.value?.click()
}

function clearFile() {
  file.value = null
  qrDataUrl.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function fileToDataUrl(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(f)
  })
}

async function generateQR() {
  generateError.value = ''
  qrDataUrl.value = ''
  generating.value = true

  try {
    let data = ''

    if (contentType.value === 'text' || contentType.value === 'url') {
      data = textInput.value
    } else if (contentType.value === 'base64') {
      data = textInput.value
    } else if (contentType.value === 'file' && file.value) {
      data = await fileToDataUrl(file.value)
    }

    if (!data) {
      generateError.value = 'No data to encode'
      return
    }

    const byteLength = new TextEncoder().encode(data).length
    if (byteLength > QR_CAPACITY[ecLevel.value]) {
      generateError.value = `Data is too large for a single QR Code. Data size: ${formatFileSize(byteLength)}. Maximum capacity for ${ecLevel.value} level: ~${formatFileSize(QR_CAPACITY[ecLevel.value])}.`
      return
    }

    const sizeOpt = SIZE_OPTIONS.find(s => s.width === qrSize.value) || SIZE_OPTIONS[1]

    const qr = new QRCodeStyling({
      width: sizeOpt.width,
      height: sizeOpt.width,
      data: data,
      margin: 4,
      qrOptions: {
        errorCorrectionLevel: ecLevel.value
      },
      dotsOptions: {
        color: '#000000',
        type: 'square'
      },
      backgroundOptions: {
        color: '#ffffff'
      }
    })

    qrInstance.value = qr

    const blob = await qr.getRawData('png')
    if (blob) {
      qrDataUrl.value = URL.createObjectURL(blob)
    }
  } catch (err) {
    generateError.value = err.message || 'Failed to generate QR code'
  } finally {
    generating.value = false
  }
}

async function downloadPNG() {
  if (!qrInstance.value) return
  try {
    await qrInstance.value.download({ name: 'qrcode', extension: 'png' })
  } catch (err) {
    generateError.value = 'Failed to download PNG: ' + err.message
  }
}

async function downloadSVG() {
  if (!qrInstance.value) return
  try {
    await qrInstance.value.download({ name: 'qrcode', extension: 'svg' })
  } catch (err) {
    generateError.value = 'Failed to download SVG: ' + err.message
  }
}

function copyPayload() {
  const text = textInput.value
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  })
}

// Scanner Methods

async function scanUploadedFile(e) {
  const uploadedFile = e.target.files?.[0]
  if (!uploadedFile) return
  scanError.value = ''
  scanResult.value = ''
  decodedPreview.value = null
  decodedMime.value = ''
  rawBase64Mode.value = false

  try {
    const html5Qr = new Html5Qrcode('qr-file-reader')
    const result = await html5Qr.scanFile(uploadedFile, true)
    handleDecodedResult(result)
  } catch {
    scanError.value = 'Could not detect a QR code in the uploaded image.'
  } finally {
    if (scanFileInput.value) scanFileInput.value.value = ''
  }
}

function handleDecodedResult(data) {
  scanResult.value = data
  decodedPreview.value = null
  decodedMime.value = ''
  rawBase64Mode.value = false

  const dataUrlMatch = data.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1]
    const b64 = dataUrlMatch[2]
    decodedMime.value = mime

    try {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: mime })
      const url = URL.createObjectURL(blob)
      decodedPreview.value = url
      decodedFileName.value = `qr-decoded.${getExtensionFromMime(mime)}`
    } catch {
      // Not valid base64
    }
    return
  }

  // Check if it looks like raw base64 (no data: prefix)
  if (/^[A-Za-z0-9+/=]{20,}$/.test(data.trim())) {
    rawBase64Mode.value = true
    return
  }

  // Plain text or URL
  decodedPreview.value = null
}

function decodeRawBase64() {
  const base64Data = scanResult.value.trim()
  const mime = rawBase64Mime.value || 'application/octet-stream'

  try {
    const binary = atob(base64Data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mime })
    const url = URL.createObjectURL(blob)
    decodedPreview.value = url
    decodedMime.value = mime
    decodedFileName.value = `qr-decoded.${getExtensionFromMime(mime)}`
    rawBase64Mode.value = false
  } catch {
    scanError.value = 'Invalid Base64 data'
  }
}

function downloadDecoded() {
  if (!decodedPreview.value || !decodedFileName.value) return
  const a = document.createElement('a')
  a.href = decodedPreview.value
  a.download = decodedFileName.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function copyScanResult() {
  if (!scanResult.value) return
  navigator.clipboard.writeText(scanResult.value).then(() => {
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = scanResult.value
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 1500)
  })
}

function downloadScanResult() {
  if (!scanResult.value) return
  const blob = new Blob([scanResult.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'qr-content.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function clearScan() {
  scanResult.value = ''
  scanError.value = ''
  decodedPreview.value = null
  decodedMime.value = ''
  decodedFileName.value = ''
  rawBase64Mode.value = false
}

async function startCamera() {
  scanError.value = ''
  scanResult.value = ''
  decodedPreview.value = null
  rawBase64Mode.value = false

  try {
    html5QrInstance = new Html5Qrcode('qr-camera-reader')
    scannerActive.value = true

    await nextTick()

    await html5QrInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        handleDecodedResult(decodedText)
        stopCamera()
      },
      () => { } // ignore errors during scanning
    )
  } catch (err) {
    scannerActive.value = false
    scanError.value = err.message || 'Failed to access camera. Please ensure camera permissions are granted.'
  }
}

async function stopCamera() {
  if (html5QrInstance) {
    try {
      await html5QrInstance.stop()
    } catch { }
    try {
      html5QrInstance.clear()
    } catch { }
    html5QrInstance = null
  }
  scannerActive.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Privacy message -->
    <div
      class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700/50">
      All QR operations are performed locally in your browser. No data is uploaded.
    </div>

    <!-- Mode Selector -->
    <div class="flex gap-2">
      <button @click="mode = 'generate'" :class="[
        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        mode === 'generate'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      ]">
        Generate QR
      </button>
      <button @click="mode = 'scan'" :class="[
        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        mode === 'scan'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      ]">
        Scan QR
      </button>
    </div>

    <!--  GENERATE MODE  -->
    <template v-if="mode === 'generate'">
      <!-- Content Type Selector -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Content Type:</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="ct in [
            { id: 'text', label: 'Text' },
            { id: 'url', label: 'URL' },
            { id: 'base64', label: 'Base64' },
            { id: 'file', label: 'File' }
          ]" :key="ct.id" @click="contentType = ct.id" :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            contentType === ct.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]">
            {{ ct.label }}
          </button>
        </div>
      </div>

      <!-- Text / URL / Base64 Input -->
      <div v-if="contentType !== 'file'" class="flex flex-col">
        <label for="qr-text-input" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
          {{ contentType === 'url' ? 'URL' : contentType === 'base64' ? 'Base64 Data' : 'Text to Encode' }}
        </label>
        <textarea id="qr-text-input" v-model="textInput" :rows="contentType === 'url' ? 3 : 8"
          :placeholder="contentType === 'url' ? 'https://example.com' : contentType === 'base64' ? 'Paste Base64 or Data URL...' : 'Enter text to encode...'"
          class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500 font-mono theme-transition"
          spellcheck="false" dir="ltr"></textarea>
        <div class="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          <span>{{ payloadBytes }} bytes</span>
          <span>Capacity: ~{{ formatFileSize(capacityForLevel) }} (EC: {{ ecLevel }})</span>
        </div>
      </div>

      <!-- File Input -->
      <div v-if="contentType === 'file'">
        <div v-if="!file">
          <div @drop="handleDrop" @dragover="handleDragOver" @dragleave="handleDragLeave" @click="triggerFileInput"
            @keydown.enter="triggerFileInput" @keydown.space.prevent="triggerFileInput" role="button" tabindex="0"
            aria-label="Choose a file or drag and drop" :class="[
              'relative rounded-xl border-2 border-dashed transition-colors cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950',
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
            ]">
            <input ref="fileInput" type="file" accept="image/*,audio/*" @change="handleFileSelect" class="hidden"
              aria-hidden="true" tabindex="-1" />
            <div class="flex flex-col items-center justify-center py-10 px-4 sm:py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-3 text-gray-400 dark:text-gray-500"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Drop your file here</p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">or</p>
              <button type="button" @click.stop="triggerFileInput"
                class="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                Choose File
              </button>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">Images and audio — converted to Data URL for QR
                encoding</p>
            </div>
          </div>
        </div>
        <div v-else class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1 space-y-1">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ file.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ file.type || 'unknown' }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ formatFileSize(file.size) }}</p>
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

      <!-- Error Correction & Size -->
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex flex-col flex-1">
          <label for="qr-ec" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Error Correction:</label>
          <select id="qr-ec" v-model="ecLevel"
            class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 theme-transition">
            <option v-for="ec in EC_LEVELS" :key="ec.value" :value="ec.value">{{ ec.label }}</option>
          </select>
        </div>
        <div class="flex flex-col flex-1">
          <label for="qr-size" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Size:</label>
          <select id="qr-size" v-model="qrSize"
            class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 theme-transition">
            <option v-for="s in SIZE_OPTIONS" :key="s.width" :value="s.width">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <!-- Capacity warning -->
      <div v-if="isOverCapacity && textInput"
        class="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
        Data is too large for a single QR Code. Data size: {{ formatFileSize(payloadBytes) }}. Maximum capacity for {{
          ecLevel }} level: ~{{ formatFileSize(capacityForLevel) }}. Try a smaller input or lower error correction.
      </div>

      <!-- Generate Button -->
      <button @click="generateQR" :disabled="!canGenerate || generating"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <svg v-if="!generating" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Generate QR Code
      </button>

      <!-- Error -->
      <div v-if="generateError"
        class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
        {{ generateError }}
      </div>

      <!-- QR Preview -->
      <div v-if="qrDataUrl" class="flex flex-col items-center space-y-4">
        <div
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex items-center justify-center">
          <img :src="qrDataUrl" alt="Generated QR Code" class="max-w-full h-auto" style="image-rendering: pixelated;" />
        </div>

        <!-- Download Buttons -->
        <div class="flex flex-wrap gap-2 justify-center">
          <button @click="downloadPNG"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PNG
          </button>
          <button @click="downloadSVG"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download SVG
          </button>
          <button v-if="contentType !== 'file'" @click="copyPayload"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy Payload
          </button>
        </div>
        <div v-if="copyFeedback" class="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Copied!</div>
      </div>

      <!-- EC Level explanation -->
      <div
        class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700/50">
        Higher error correction = more resistance to damage, but less data capacity. Levels: L (7%), M (15%), Q (25%), H
        (30%).
      </div>
    </template>

    <!--  SCAN MODE  -->
    <template v-if="mode === 'scan'">
      <!-- Camera Scanner -->
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <button v-if="!scannerActive" @click="startCamera"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Start Camera
          </button>
          <button v-if="scannerActive" @click="stopCamera"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop Camera
          </button>
        </div>

        <div v-if="scannerActive" class="text-xs text-gray-500 dark:text-gray-400">
          Camera frames are processed locally in your browser.
        </div>

        <!-- Camera container -->
        <div v-show="scannerActive"
          class="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-black">
          <div id="qr-camera-reader" class="w-full"></div>
        </div>

        <!-- File Upload -->
        <div class="flex flex-col">
          <label class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Or upload a QR image:</label>
          <input ref="scanFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            @change="scanUploadedFile"
            class="text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer" />
          <div id="qr-file-reader" class="hidden"></div>
        </div>
      </div>

      <!-- Scan Error -->
      <div v-if="scanError"
        class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
        {{ scanError }}
      </div>

      <!-- Scan Result -->
      <div v-if="scanResult" class="space-y-4">
        <div class="flex flex-col">
          <label class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">QR Content</label>
          <textarea :value="scanResult" dir="ltr" rows="4" readonly
            class="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm leading-relaxed focus:outline-none font-mono placeholder-gray-400 dark:placeholder-gray-500 theme-transition"
            spellcheck="false"></textarea>
        </div>

        <!-- Copy feedback -->
        <div v-if="copyFeedback" class="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Copied!</div>

        <!-- Decoded preview (Data URL) -->
        <div v-if="decodedPreview"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium">Detected:</span>
            <span class="font-mono">{{ decodedMime }}</span>
          </div>

          <!-- Image preview -->
          <img v-if="decodedMime.startsWith('image/')" :src="decodedPreview" alt="Decoded QR image"
            class="max-w-full max-h-80 object-contain rounded-lg" />

          <!-- Audio preview -->
          <audio v-else-if="decodedMime.startsWith('audio/')" :src="decodedPreview" controls class="w-full">
            Your browser does not support the audio element.
          </audio>

          <!-- Other file -->
          <div v-else class="text-sm text-gray-500 dark:text-gray-400">
            File type: {{ decodedMime }} — Click download to save.
          </div>

          <button @click="downloadDecoded"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download {{ decodedFileName }}
          </button>
        </div>

        <!-- Raw Base64 detection -->
        <div v-if="rawBase64Mode && !decodedPreview"
          class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400 font-medium">Base64 data detected.</p>
          <div class="flex flex-col">
            <label for="raw-mime-select" class="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Select MIME
              type:</label>
            <select id="raw-mime-select" v-model="rawBase64Mime"
              class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 theme-transition">
              <option value="image/png">image/png</option>
              <option value="image/jpeg">image/jpeg</option>
              <option value="image/gif">image/gif</option>
              <option value="image/webp">image/webp</option>
              <option value="audio/mpeg">audio/mpeg</option>
              <option value="audio/wav">audio/wav</option>
              <option value="audio/ogg">audio/ogg</option>
              <option value="application/octet-stream">application/octet-stream</option>
            </select>
          </div>
          <button @click="decodeRawBase64"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            Decode
          </button>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <button @click="copyScanResult"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy
          </button>
          <button @click="downloadScanResult"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download .txt
          </button>
          <button @click="clearScan"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
