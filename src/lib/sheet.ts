/** Downward drag that should close a bottom sheet instead of snapping back. */
export function sheetShouldDismiss(offsetPx: number, velocityPxPerMs: number): boolean {
  return offsetPx >= 72 || velocityPxPerMs >= 0.65;
}
