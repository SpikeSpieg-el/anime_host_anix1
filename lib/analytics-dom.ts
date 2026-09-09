import { AnalyticsEvent, isAnalyticsEnabled, sanitizeAnalyticsUrl, trackEvent, type UmamiEventData } from "@/lib/analytics"

const SELECTOR = [
  "a[href]", "button", 'input[type="submit"]', 'input[type="button"]',
  '[role="button"]', '[role="link"]', '[role="menuitem"]',
  '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="tab"]',
  '[role="option"]', '[role="switch"]', '[role="checkbox"]', '[role="radio"]',
  "[data-track]", "[data-umami-event]", "summary",
].join(",")

const clean = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, 60)

function label(el: Element): string {
  // Never read field values, placeholder text, passwords or editable content.
  return clean(el.getAttribute("data-track")) || clean(el.getAttribute("aria-label")) ||
    clean(el.getAttribute("title")) ||
    (el.matches("input, select, textarea, [contenteditable]") ? "" : clean(el.textContent))
}

function ignored(el: Element): boolean {
  return Boolean(el.closest('[data-track="off"], [contenteditable="true"]')) ||
    el.matches(':disabled, [aria-disabled="true"]')
}

function description(el: Element): UmamiEventData {
  return {
    element: el.tagName === "A" ? "link" : el.tagName.toLowerCase(),
    role: el.getAttribute("role") ?? undefined,
    label: label(el), path: window.location.pathname,
    id: el.id || undefined, name: el.getAttribute("name") ?? undefined,
  }
}

/** Manual-mode tracker: all handlers are removable and never interfere with Next Link. */
export function installAnalyticsDomTracking(): () => void {
  const onClick = (event: MouseEvent) => {
    if (!isAnalyticsEnabled() || !(event.target instanceof Element)) return
    const el = event.target.closest(SELECTOR)
    if (!el || ignored(event.target) || ignored(el)) return
    const custom = event.target.closest("[data-umami-event]")
    if (custom) {
      const data: UmamiEventData = {}
      for (const name of custom.getAttributeNames()) {
        if (name.startsWith("data-umami-event-")) data[name.slice(17)] = custom.getAttribute(name)
      }
      trackEvent(custom.getAttribute("data-umami-event") ?? "", data)
      return
    }
    const data = description(el)
    if (el instanceof HTMLAnchorElement) data.href = sanitizeAnalyticsUrl(el.href)
    trackEvent(AnalyticsEvent.CLICK, data)
  }
  const onSubmit = (event: Event) => {
    if (!(event.target instanceof HTMLFormElement) || ignored(event.target)) return
    const form = event.target
    trackEvent(AnalyticsEvent.FORM_SUBMIT, {
      path: window.location.pathname, id: form.id || undefined,
      name: form.getAttribute("name") ?? undefined,
      action: sanitizeAnalyticsUrl(form.getAttribute("action") ?? ""),
    })
  }
  const onChange = (event: Event) => {
    const el = event.target
    if (!(el instanceof Element) || ignored(el)) return
    const data = description(el)
    if (el instanceof HTMLSelectElement) {
      data.selected_index = el.selectedIndex
    } else if (el instanceof HTMLInputElement && ["checkbox", "radio", "range"].includes(el.type)) {
      data.type = el.type
      if (el.type !== "range") data.checked = el.checked
      else data.value = el.valueAsNumber
    } else return // No text fields, passwords, emails or keystroke logging.
    trackEvent(AnalyticsEvent.CONTROL_CHANGE, data)
  }
  document.addEventListener("click", onClick, true)
  document.addEventListener("submit", onSubmit, true)
  document.addEventListener("change", onChange, true)
  return () => {
    document.removeEventListener("click", onClick, true)
    document.removeEventListener("submit", onSubmit, true)
    document.removeEventListener("change", onChange, true)
  }
}
