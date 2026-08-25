import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/tokens';

type Props = {
  children: ReactNode;
  variant?: 'card' | 'row';
  style?: ViewStyle;
};

export function Card({ children, variant = 'card', style }: Props) {
  const card = variant === 'card';
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: card ? radius.card : radius.row,
          padding: card ? 16 : 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
