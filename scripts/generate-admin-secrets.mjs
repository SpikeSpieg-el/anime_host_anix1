#!/usr/bin/env node
import { randomBytes } from "node:crypto"

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function toBase32(buffer) {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31]
  return output
}

console.log("Generate these values on a trusted machine and store them only in your deployment secret manager:")
console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}`)
console.log(`ADMIN_TOTP_SECRET=${toBase32(randomBytes(20))}`)
