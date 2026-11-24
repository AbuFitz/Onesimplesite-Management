/** The thing that scrolls the page: the body on phones (the page scrolls inside its frame there), the window everywhere else. */
export function pageScroller(): HTMLElement | Window {
  if (typeof document === "undefined") return window;
  return getComputedStyle(document.documentElement).overflowY === "hidden" ? document.body : window;
}
export function scrollPageTop(smooth = true) {
  pageScroller().scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" as ScrollBehavior });
}
