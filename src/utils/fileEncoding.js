/**
 * Binary file Base64 encoding/decoding utilities.
 * All functions operate on raw binary bytes, NOT UTF-8 text.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/avif': 'avif',
  'image/vnd.microsoft.icon': 'ico',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
  'video/webm': 'webm',
}

export function getMaxFileSize() {
  return MAX_FILE_SIZE
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  return `${size} ${units[i]}`
}

export function getExtensionFromMime(mimeType) {
  return MIME_EXTENSIONS[mimeType] || mimeType.split('/').pop() || 'bin'
}

export function getMimeCategory(mimeType) {
  if (!mimeType) return 'unknown'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'other'
}

/**
 * Encode a File to raw Base64 using ArrayBuffer for correct binary handling.
 * Returns a Promise that resolves with the Base64 string.
 */
export function encodeFileToBase64(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'))
      return
    }
    if (file.size === 0) {
      reject(new Error('File is empty'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File is too large. Maximum supported size: ${formatFileSize(MAX_FILE_SIZE)}.`))
      return
    }

    const reader = new FileReader()

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    reader.onload = () => {
      try {
        const arrayBuffer = reader.result
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          for (let j = 0; j < chunk.length; j++) {
            binary += String.fromCharCode(chunk[j])
          }
        }
        const base64 = btoa(binary)
        resolve(base64)
      } catch (err) {
        reject(new Error('Failed to encode file: ' + err.message))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Decode a Base64 string (raw or Data URL) back into a Blob.
 * Returns { blob, mimeType, filename }.
 */
export function decodeBase64ToFile(base64Input, specifiedMimeType, filename) {
  let mimeType = specifiedMimeType || ''
  let base64Data = base64Input.trim()

  // Parse Data URL
  const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1]
    base64Data = dataUrlMatch[2]
  }

  // Validate Base64 characters
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    throw new Error('Invalid Base64 characters')
  }

  if (!base64Data) {
    throw new Error('Empty Base64 data')
  }

  // Decode Base64 to binary
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  // Determine MIME type
  if (!mimeType) {
    mimeType = guessMimeType(bytes)
  }

  const blob = new Blob([bytes], { type: mimeType })

  // Determine filename
  let finalName = filename || 'decoded-file'
  if (!filename) {
    const ext = getExtensionFromMime(mimeType)
    finalName = `decoded-file.${ext}`
  }

  return { blob, mimeType, filename: finalName }
}

/**
 * Simple magic-byte based MIME type detection.
 */
function guessMimeType(bytes) {
  if (bytes.length < 4) return 'application/octet-stream'

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'image/bmp'
  }
  // ICO: 00 00 01 00
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon'
  }
  // MP3: FF FB or FF F3 or FF F2 or ID3
  if ((bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2)) ||
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
    return 'audio/mpeg'
  }
  // WAV: 52 49 46 46 ... 57 41 56 45
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return 'audio/wav'
  }
  // OGG: 4F 67 67 53
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg'
  }
  // FLAC: 66 4C 61 43
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return 'audio/flac'
  }
  // M4A/AAC (ftyp box): usually starts near offset 4 with 'ftyp'
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'audio/mp4'
  }
  // AVIF (ftyp box with avif/avis): similar to M4A
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    // Check for 'avif' or 'avis' at offset 8
    if (bytes.length >= 12) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      if (brand === 'avif' || brand === 'avis') {
        return 'image/avif'
      }
    }
    return 'audio/mp4'
  }
  // SVG: starts with < or <?xml
  if (bytes[0] === 0x3C) {
    return 'image/svg+xml'
  }

  return 'application/octet-stream'
}

export { MIME_EXTENSIONS }
