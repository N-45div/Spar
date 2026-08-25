import { Text, TextStyle } from 'react-native';
import { colors, fonts } from '../theme/tokens';

type Props = {
  children: string;
  color?: string;
  size?: number;
  style?: TextStyle;
};

export function Eyebrow({ children, color = colors.inkFaint, size = 10, style }: Props) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.mono,
          fontSize: size,
          letterSpacing: size * 0.16,
          color,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
