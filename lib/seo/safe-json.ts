/** Serialize JSON for an HTML script data block without permitting `</script>` breakout. */
export function safeSerializeJson(value: unknown): string {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) return "null"

  return serialized
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
