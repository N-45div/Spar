import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

export function Screen({ children, style }: Props) {
  return (
    <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}
