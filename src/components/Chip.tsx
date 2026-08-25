import { Pressable, Text } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.ember : colors.outline,
        backgroundColor: selected ? colors.emberChipBg : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: selected ? fonts.uiMedium : fonts.ui,
          fontSize: 13,
          color: selected ? colors.ink : colors.inkDim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
