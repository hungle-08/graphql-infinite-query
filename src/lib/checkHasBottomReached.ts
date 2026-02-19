/**
 * Determines whether a scroll container has been scrolled to (or near) its bottom.
 *
 * Designed to be used directly in a React `onScroll` handler to trigger
 * infinite-load behavior when the user reaches the end of a list.
 *
 * @example
 * ```tsx
 * <div
 *   onScroll={event => {
 *     if (checkHasBottomReached(event)) {
 *       loadNextPage();
 *     }
 *   }}
 * >
 *   {items.map(item => <Row key={item.id} {...item} />)}
 * </div>
 * ```
 *
 * @param event       - The React `UIEvent` fired by the scrollable `<div>`.
 * @param bottomOffset - Distance in pixels from the true bottom that still
 *                       counts as "reached". A larger value triggers the load
 *                       earlier, giving the impression of seamless loading.
 *                       Defaults to `30`.
 *
 * @returns `true` when the remaining scroll distance is within `bottomOffset` pixels.
 */
export function checkHasBottomReached(
  event: React.UIEvent<HTMLDivElement>,
  bottomOffset = 30,
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
  return scrollHeight - scrollTop - clientHeight <= bottomOffset;
}
