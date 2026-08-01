// Global Material-style ripple for every <button> on the site.
// A single delegated listener injects a clipped ripple layer at the click
// point, so individual buttons need no changes.

let installed = false

export function installRipple() {
  if (installed || typeof document === 'undefined') return
  installed = true

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return // primary button / touch only

      const target = event.target as Element | null
      // Buttons anywhere, plus nav links (e.g. the sidebar navbar).
      const el = target?.closest('button, nav a') as HTMLElement | null
      if (!el) return
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      // The ripple layer needs a positioned ancestor to fill.
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

      const layer = document.createElement('span')
      layer.className = 'ripple-layer'

      const circle = document.createElement('span')
      circle.className = 'ripple'
      const size = Math.max(rect.width, rect.height)
      circle.style.width = `${size}px`
      circle.style.height = `${size}px`
      circle.style.left = `${event.clientX - rect.left - size / 2}px`
      circle.style.top = `${event.clientY - rect.top - size / 2}px`

      layer.appendChild(circle)
      el.appendChild(layer)

      const cleanup = () => layer.remove()
      circle.addEventListener('animationend', cleanup)
      setTimeout(cleanup, 800) // safety net if animationend is missed
    },
    true, // capture phase, so it still fires if a handler stops propagation
  )
}
