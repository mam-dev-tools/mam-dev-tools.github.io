/**
 * Encoding/Decoding utilities for Base64, Hex, and Binary
 * All functions operate on UTF-8 bytes for correct Unicode support.
 */

// Helpers 

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function isValidHexChar(c) {
  return /[0-9a-fA-F]/.test(c);
}

function isValidBinaryChar(c) {
  return c === '0' || c === '1';
}

// Base64

export function encodeBase64(text) {
  const bytes = textToBytes(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64(encoded) {
  const trimmed = encoded.trim();
  if (!trimmed) return '';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) {
    throw new Error('Invalid Base64 characters');
  }
  try {
    const binary = atob(trimmed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytesToText(bytes);
  } catch {
    throw new Error('Invalid Base64 string');
  }
}

// Hexadecimal

export function encodeHex(text) {
  const bytes = textToBytes(text);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function decodeHex(encoded) {
  const hex = encoded.replace(/\s+/g, '');
  if (!hex) return '';
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid Hex: odd number of characters');
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Invalid Hex characters');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytesToText(bytes);
}

// Binary

export function encodeBinary(text) {
  const bytes = textToBytes(text);
  return Array.from(bytes)
    .map(b => b.toString(2).padStart(8, '0'))
    .join(' ');
}

export function decodeBinary(encoded) {
  const bits = encoded.replace(/[\s\n]+/g, '');
  if (!bits) return '';
  if (!/^[01]+$/.test(bits)) {
    throw new Error('Invalid Binary: only 0 and 1 are allowed');
  }
  if (bits.length % 8 !== 0) {
    throw new Error('Invalid Binary: length must be a multiple of 8 bits');
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i += 8) {
    bytes[i / 8] = parseInt(bits.substring(i, i + 8), 2);
  }
  return bytesToText(bytes);
}

// Direction Detection

export function detectDirection(text) {
  if (!text) return 'ltr';
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  for (const ch of text) {
    if (rtlChars.test(ch)) return 'rtl';
  }
  return 'ltr';
}
