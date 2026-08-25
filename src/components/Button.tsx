import { Pressable, Text, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  label: string;
  variant?: 'primary' | 'ghost';
  onPress?: () => void;
  style?: ViewStyle;
};

export function Button({ label, variant = 'primary', onPress, style }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: primary ? 52 : 44,
          borderRadius: radius.button,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? colors.ember : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: colors.outline,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: primary ? fonts.uiSemiBold : fonts.uiMedium,
          fontSize: 15,
          color: primary ? colors.onEmber : colors.inkSoft,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
