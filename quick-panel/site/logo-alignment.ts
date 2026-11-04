export type Rect = { x: number; y: number; width: number; height: number };
export type LogoMeasurement = {
  key: string;
  bounds: Rect;
  slot: Rect;
  effectiveScale: number;
  percent: number;
  offset: { x: number; y: number };
};
export function calculateLogoAlignment(
  logos: LogoMeasurement[],
  referenceKey: string,
) {
  const reference = logos.find((logo) => logo.key === referenceKey);
  if (
    !reference ||
    logos.length < 2 ||
    logos.some(
      (logo) =>
        ![
          logo.bounds.x,
          logo.bounds.y,
          logo.bounds.width,
          logo.bounds.height,
          logo.slot.x,
          logo.slot.y,
          logo.slot.width,
          logo.slot.height,
          logo.effectiveScale,
          logo.percent,
          logo.offset.x,
          logo.offset.y,
        ].every(Number.isFinite) ||
        logo.bounds.height <= 0 ||
        logo.effectiveScale <= 0 ||
        logo.percent < 50 ||
        logo.percent > 200,
    )
  )
    throw Error(
      "Logolar ölçülemedi. Görsellerin yüklenmesini bekleyip tekrar deneyin.",
    );
  const heights = logos.map(
    (logo) => logo.bounds.height / (logo.percent / 100),
  );
  const minimum = Math.max(...heights.map((height) => height * 0.5)),
    maximum = Math.min(...heights.map((height) => height * 2));
  const target =
    minimum <= maximum
      ? Math.max(minimum, Math.min(maximum, reference.bounds.height))
      : reference.bounds.height;
  const scales: Record<string, number> = {},
    offsets: Record<string, { x: number; y: number }> = {};
  for (const [i, logo] of logos.entries()) {
    scales[logo.key] = Math.max(
      50,
      Math.min(200, Math.round((target / heights[i]) * 100)),
    );
    const x =
      logo.offset.x -
      (logo.bounds.x +
        logo.bounds.width / 2 -
        (logo.slot.x + logo.slot.width / 2)) /
        logo.effectiveScale;
    const y =
      logo.offset.y -
      (logo.bounds.y +
        logo.bounds.height / 2 -
        (logo.slot.y + logo.slot.height / 2)) /
        logo.effectiveScale;
    offsets[logo.key] = {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  }
  return {
    scales,
    offsets,
    sizesMatched: minimum <= maximum,
    limited:
      minimum > maximum || Math.abs(target - reference.bounds.height) > 1,
  };
}
