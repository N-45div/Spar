import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../components/Button';
import { Eyebrow } from '../components/Eyebrow';
import { XIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import {
  getOffering,
  isConfigured,
  OfferingInfo,
  PlanInfo,
  purchase,
  restore,
} from '../monetization/purchases';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const FEATURES = [
  {
    text: 'Unlimited rounds, all five pressure levels',
    icon: <Path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M18 3v4h-4M6 21v-4h4" />,
  },
  {
    text: 'Every scenario pack — comp talks, conflict, letting someone go',
    icon: <Path d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8" />,
  },
  {
    text: 'Your best lines, delivered to you before the real meeting',
    icon: (
      <>
        <Path d="M6 16v-5a6 6 0 0 1 12 0v5l2 3H4l2-3z" />
        <Path d="M10 21a2.5 2.5 0 0 0 4 0" />
      </>
    ),
  },
];

export function PaywallScreen({ navigation }: Props) {
  const [offering, setOffering] = useState<OfferingInfo | null>(null);
  const [selected, setSelected] = useState<'yearly' | 'monthly'>('yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOffering().then(setOffering);
  }, []);

  const yearlyPrice = offering?.yearly?.priceString || '$39.99';
  const monthlyPrice = offering?.monthly?.priceString || '$4.99';

  const buy = async () => {
    const plan: PlanInfo | undefined =
      selected === 'yearly' ? offering?.yearly : offering?.monthly;
    if (!plan) {
      navigation.goBack();
      return;
    }
    setBusy(true);
    const ok = await purchase(plan);
    setBusy(false);
    if (ok) navigation.goBack();
  };

  const onRestore = async () => {
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    if (ok) navigation.goBack();
  };

  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 14, margin: -14 }}>
            <XIcon size={16} color={colors.inkFaint} />
          </Pressable>
        </View>

        <Eyebrow color={colors.ember} style={{ marginTop: 18, letterSpacing: 2 }}>
          SPAR PRO
        </Eyebrow>
        <Text style={[type.displayLarge, { marginTop: 10 }]}>Walk in{'\n'}prepared.</Text>
        <Text style={[type.body, { marginTop: 12 }]}>
          Your first three rehearsals are free. Pro keeps the gym open every night.
        </Text>

        <View style={{ marginTop: 24, gap: 15 }}>
          {FEATURES.map((feature) => (
            <View key={feature.text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.ember}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginTop: 1 }}
              >
                {feature.icon}
              </Svg>
              <Text style={[type.body, { color: colors.inkSerif, flex: 1 }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 24, gap: 10 }}>
          <Pressable
            onPress={() => setSelected('yearly')}
            style={{
              borderWidth: 1,
              borderColor: selected === 'yearly' ? colors.ember : colors.outline,
              backgroundColor: selected === 'yearly' ? 'rgba(228,87,46,0.07)' : 'transparent',
              borderRadius: radius.row,
              padding: 16,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.ink }}>
                  Yearly
                </Text>
                <View
                  style={{
                    backgroundColor: colors.ember,
                    borderRadius: radius.pill,
                    paddingVertical: 3,
                    paddingHorizontal: 8,
                  }}
                >
                  <Eyebrow size={8} color={colors.onEmber}>
                    4 MONTHS FREE
                  </Eyebrow>
                </View>
              </View>
              <Text style={[type.bodySmall, { marginTop: 4 }]}>Billed once a year</Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>
              {yearlyPrice}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelected('monthly')}
            style={{
              borderWidth: 1,
              borderColor: selected === 'monthly' ? colors.ember : colors.outline,
              backgroundColor: selected === 'monthly' ? 'rgba(228,87,46,0.07)' : 'transparent',
              borderRadius: radius.row,
              padding: 16,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text style={{ fontFamily: fonts.uiMedium, fontSize: 15, color: colors.inkSoft }}>
                Monthly
              </Text>
              <Text style={[type.bodySmall, { marginTop: 4, color: colors.inkFaint }]}>
                Cancel anytime
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.inkSoft }}>
              {monthlyPrice}
            </Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />
        <Button
          label={busy ? 'One second…' : 'Start free — 3 rounds on us'}
          style={{ height: 56 }}
          onPress={buy}
        />
        <Pressable onPress={onRestore}>
          <Text
            style={[
              type.bodySmall,
              { fontSize: 11, textAlign: 'center', color: colors.inkFaint, marginTop: 10 },
            ]}
          >
            {isConfigured()
              ? 'Billed through the Galaxy Store. Cancel anytime.\nRestore purchases'
              : 'Preview build — purchases activate in the store version.\nRestore purchases'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
