import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color: string;
};

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

export function CornerIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20V9.5L12 4l8 5.5V20" {...stroke(color)} />
      <Path d="M9 20v-6h6v6" {...stroke(color)} />
    </Svg>
  );
}

export function GymIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 8.5v7M17 8.5v7M4 10v4M20 10v4M7 12h10" {...stroke(color)} />
    </Svg>
  );
}

export function ProgressIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 20v-7M12 20V7M19 20v-9" {...stroke(color)} />
    </Svg>
  );
}

export function SparkIcon({ size = 13, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" {...stroke(color)} strokeWidth={1.8} />
    </Svg>
  );
}

export function ChevronIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" {...stroke(color)} />
    </Svg>
  );
}

export function XIcon({ size = 15, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" {...stroke(color)} />
    </Svg>
  );
}

export function FlagIcon({ size = 15, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 3v18M6 4h11l-2.5 4L17 12H6" {...stroke(color)} />
    </Svg>
  );
}

export function BackIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 6l-6 6 6 6" {...stroke(color)} />
    </Svg>
  );
}

export function MicIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke(color)} />
      <Path d="M5 11a7 7 0 0 0 14 0" {...stroke(color)} />
      <Path d="M12 18v3" {...stroke(color)} />
    </Svg>
  );
}
