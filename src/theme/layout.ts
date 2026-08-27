// One reading column, centered. Phones fill the width; unfolded foldables,
// tablets and multi-window keep a comfortable measure instead of stretching.
export const CONTENT_MAX_WIDTH = 672;

export const contentColumn = {
  width: '100%' as const,
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center' as const,
};
