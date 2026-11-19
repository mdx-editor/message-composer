import type { LexicalEditor } from "lexical";

/**
 * Calls `remeasure` whenever something other than an editor update can move content inside the
 * editor on screen: a scroll of the page or of any scrolling ancestor, a window resize, a change
 * of the visual viewport (the on-screen keyboard opening, iOS panning the page to keep the caret
 * visible, pinch zoom), or a resize of the editor root. Anchor rectangles are viewport
 * coordinates, so a rectangle measured only on editor updates goes stale after any of these.
 *
 * Calls are coalesced to one per animation frame. Returns a function that stops watching.
 */
export function watchAnchorPosition(editor: LexicalEditor, remeasure: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) {
      return;
    }
    frame = window.requestAnimationFrame(() => {
      frame = null;
      remeasure();
    });
  };

  const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("scroll", schedule, scrollOptions);
  window.addEventListener("resize", schedule);
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);

  let observer: ResizeObserver | null = null;
  const observeRoot = (root: HTMLElement | null) => {
    observer?.disconnect();
    observer = null;
    if (root && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(root);
    }
  };
  observeRoot(editor.getRootElement());
  const unregisterRoot = editor.registerRootListener((root) => observeRoot(root));

  return () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    window.removeEventListener("scroll", schedule, scrollOptions);
    window.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    unregisterRoot();
    observer?.disconnect();
    observer = null;
  };
}
