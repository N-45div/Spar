import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Eyebrow } from '../components/Eyebrow';
import { ChevronIcon, SparkIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { canStartRound } from '../monetization/gate';
import { RootStackParamList } from '../navigation/types';
import { bestScore, loadRounds, RoundRecord, trainingDays } from '../store/rounds';
import { colors, fonts, radius, type } from '../theme/tokens';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function todayLabel() {
  const now = new Date();
  return `${DAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function roundMeta(record: RoundRecord) {
  const date = new Date(record.at);
  return `PRESSURE ${record.pressure} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rounds, setRounds] = useState<RoundRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadRounds().then((all) => {
        if (active) setRounds(all);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const best = bestScore(rounds);
  const days = trainingDays(rounds);
  const hasRounds = rounds.length > 0;

  const startRehearsal = async () => {
    if (!(await canStartRound())) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Persona');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>{todayLabel()}</Eyebrow>
          {days > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                {[5, 7, 9, 11].map((height, index) => (
                  <View
                    key={height}
                    style={{
                      width: 3,
                      height,
                      borderRadius: 2,
                      backgroundColor: index < Math.min(days, 4) ? colors.ember : colors.surface2,
                    }}
                  />
                ))}
              </View>
              <Eyebrow color={colors.inkDim} style={{ letterSpacing: 1.2 }}>
                {`DAY ${days}`}
              </Eyebrow>
            </View>
          )}
        </View>

        <Text style={[type.display, { marginTop: 20 }]}>
          {hasRounds ? 'Ready for the next\nhard conversation.' : 'The first round\nis the hardest.'}
        </Text>
        <Text style={[type.bodySmall, { fontSize: 13, marginTop: 8 }]}>
          {hasRounds
            ? `Last round: ${rounds[0].title} · scored ${rounds[0].overall}`
            : 'Describe who is across the table and go three minutes.'}
        </Text>

        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View
              style={{
                backgroundColor: colors.emberTint,
                borderRadius: radius.pill,
                paddingVertical: 5,
                paddingHorizontal: 10,
              }}
            >
              <Eyebrow color={colors.ember} size={9} style={{ letterSpacing: 1.26 }}>
                TONIGHT
              </Eyebrow>
            </View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.inkMeta }}>
              {best != null ? `BEST ${best}` : 'FIRST ROUND'}
            </Text>
          </View>
          <Text style={[type.body, { marginTop: 11 }]}>
            {hasRounds
              ? 'Three minutes of practice tonight keeps the streak alive.'
              : 'Three minutes of practice tonight beats an hour of dread on Monday.'}
          </Text>
          <Button
            label="Rehearse tonight"
            style={{ marginTop: 13, height: 50 }}
            onPress={startRehearsal}
          />
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <SparkIcon color={colors.ember} />
          <Eyebrow>TODAY'S CURVEBALL</Eyebrow>
        </View>
        <Card style={{ marginTop: 8 }}>
          <Text style={type.spoken}>
            “With respect — you've never actually done my job.”
          </Text>
          <View
            style={{
              marginTop: 11,
              borderWidth: 1,
              borderColor: colors.outline,
              borderRadius: radius.pill,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: colors.inkFaint }}>
              Type your one-line response…
            </Text>
          </View>
          <Text style={[type.bodySmall, { fontSize: 11, color: colors.inkFaint, marginTop: 8 }]}>
            Or answer straight from the notification — scored either way.
          </Text>
        </Card>

        <Eyebrow style={{ marginTop: 20 }}>RECENT ROUNDS</Eyebrow>
        {hasRounds ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            {rounds.slice(0, 3).map((record) => (
              <Card
                key={record.id}
                variant="row"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: radius.badge,
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>
                    {record.overall}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.label} numberOfLines={1}>
                    {record.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 9,
                      letterSpacing: 0.9,
                      color: colors.inkMeta,
                      marginTop: 2,
                    }}
                  >
                    {roundMeta(record)}
                  </Text>
                </View>
                <ChevronIcon color={colors.inkFaint} />
              </Card>
            ))}
          </View>
        ) : (
          <Text style={[type.bodySmall, { marginTop: 8 }]}>
            No rounds yet — your history lands here after the first one.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
