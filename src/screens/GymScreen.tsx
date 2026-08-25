import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Eyebrow } from '../components/Eyebrow';
import { ChevronIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { PACKS, Scenario } from '../data/packs';
import { canOpenProPack, canStartRound } from '../monetization/gate';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, type } from '../theme/tokens';

export function GymScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const open = async (scenario: Scenario, pro: boolean) => {
    if (pro && !(await canOpenProPack())) {
      navigation.navigate('Paywall');
      return;
    }
    if (!(await canStartRound())) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Persona', { scenario });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        <Eyebrow>THE GYM</Eyebrow>
        <Text style={[type.display, { marginTop: 12 }]}>Scenario packs</Text>
        <Text style={[type.body, { marginTop: 8 }]}>Pick the conversation. We'll pick the fight.</Text>

        <View style={{ marginTop: 20, gap: 12 }}>
          {PACKS.map((pack) => (
            <Card key={pack.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>
                  {pack.name}
                </Text>
                {pack.pro && (
                  <View
                    style={{
                      backgroundColor: colors.emberTint,
                      borderRadius: radius.pill,
                      paddingVertical: 4,
                      paddingHorizontal: 9,
                    }}
                  >
                    <Eyebrow size={8} color={colors.ember}>
                      PRO
                    </Eyebrow>
                  </View>
                )}
              </View>
              <Text style={[type.bodySmall, { marginTop: 4 }]}>{pack.tagline}</Text>

              <View style={{ marginTop: 12, gap: 6 }}>
                {pack.scenarios.map((scenario) => (
                  <Pressable
                    key={scenario.id}
                    onPress={() => open(scenario, pack.pro)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: colors.surface2,
                      borderRadius: radius.badge,
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[type.label, { color: pack.pro ? colors.inkDim : colors.ink }]}>
                        {scenario.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 9,
                          letterSpacing: 0.9,
                          color: colors.inkMeta,
                          marginTop: 3,
                        }}
                      >
                        {`PRESSURE ${scenario.pressure} · ${scenario.role.toUpperCase()}`}
                      </Text>
                    </View>
                    <ChevronIcon color={colors.inkFaint} />
                  </Pressable>
                ))}
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
