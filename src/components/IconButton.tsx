import { ReactNode } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function IconButton({ children, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: radius.iconButton,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
