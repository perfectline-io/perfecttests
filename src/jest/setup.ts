import '@testing-library/jest-dom'

// DOM-only stubs — skipped in node environment (e.g. API route tests)
if (typeof Element !== 'undefined') {
  // userEvent v14 uses pointer events; JSDOM doesn't implement these APIs,
  // causing the pointer simulation to hang indefinitely without these mocks.
  Element.prototype.setPointerCapture = jest.fn()
  Element.prototype.releasePointerCapture = jest.fn()
  Element.prototype.hasPointerCapture = jest.fn().mockReturnValue(false)

  // matchMedia is not implemented in jsdom — needed by @perfectline-io/ui FadeIn.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // scrollIntoView is not implemented in jsdom.
  Element.prototype.scrollIntoView = jest.fn()

  // IntersectionObserver is not implemented in jsdom.
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver

  // ResizeObserver is not implemented in jsdom.
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
