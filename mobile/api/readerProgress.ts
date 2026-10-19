/** 콘텐츠가 짧거나 overscroll이어도 리더 진행선을 0..1 범위로 유지한다. */
export const readerScrollProgress = (
  offset: number,
  contentHeight: number,
  viewportHeight: number,
): number => {
  const maximumOffset = contentHeight - viewportHeight;
  if (maximumOffset <= 0) return 0;
  return Math.min(1, Math.max(0, offset / maximumOffset));
};
