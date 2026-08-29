import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Eyebrow } from '../components/Eyebrow';
import { ChevronIcon, SparkIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { curveballFor, dayKey } from '../data/curveballs';
import { canStartRound } from '../monetization/gate';
import { RootStackParamList } from '../navigation/types';
import {
  cancelDailyCurveball,
  isDailyCurveballScheduled,
  REMINDER_HOUR,
  scheduleDailyCurveball,
} from '../notifications/curveball';
import { scoreCurveball } from '../round/engine';
import { CurveballRecord, loadCurveball, saveCurveball } from '../store/curveball';
import { bestScore, loadRounds, RoundRecord, trainingDays } from '../store/rounds';
import { countdownLabel, loadUpcoming, Upcoming, whenLabel } from '../store/upcoming';
import { colors, fonts, radius, type } from '../theme/tokens';
import { contentColumn } from '../theme/layout';

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
  const [upcoming, setUpcoming] = useState<Upcoming | null>(null);

  const today = dayKey();
  const curveball = curveballFor();
  const [response, setResponse] = useState('');
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<CurveballRecord | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const remindersSupported = Platform.OS !== 'web';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadRounds().then((all) => {
        if (active) setRounds(all);
      });
      loadUpcoming().then((value) => {
        if (active) setUpcoming(value);
      });
      loadCurveball(today).then((saved) => {
        if (active) setResult(saved);
      });
      return () => {
        active = false;
      };
    }, [today]),
  );

  useEffect(() => {
    if (!remindersSupported) return;
    isDailyCurveballScheduled().then(setReminderOn);
  }, [remindersSupported]);

  const best = bestScore(rounds);
  const days = trainingDays(rounds);
  const hasRounds = rounds.length > 0;

  const heroTitle = upcoming
    ? `${whenLabel(upcoming.at)} —\n${upcoming.title}.`
    : hasRounds
      ? 'Ready for the next\nhard conversation.'
      : 'The first round\nis the hardest.';

  let heroSubtitle: string;
  if (upcoming) {
    heroSubtitle = `${upcoming.temperament} ${upcoming.role.toLowerCase()} · from your countdown`;
  } else if (hasRounds) {
    heroSubtitle = `Last round: ${rounds[0].title} · scored ${rounds[0].overall}`;
  } else {
    heroSubtitle = 'Describe who is across the table and go three minutes.';
  }

  let cardBody: string;
  if (upcoming) {
    cardBody = 'Rehearse it now, while getting it wrong is free.';
  } else if (hasRounds) {
    cardBody = 'Three minutes of practice tonight keeps the streak alive.';
  } else {
    cardBody = 'Three minutes of practice tonight beats an hour of dread on Monday.';
  }

  const startRehearsal = async () => {
    if (!(await canStartRound())) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate(
      'Persona',
      upcoming
        ? {
            scenario: {
              id: 'upcoming',
              title: upcoming.title,
              brief: 'This one is real, and it is coming.',
              role: upcoming.role,
              temperament: upcoming.temperament,
              stakes: upcoming.stakes,
              pressure: 2,
            },
          }
        : undefined,
    );
  };

  const submitCurveball = async () => {
    const text = response.trim();
    if (!text || scoring) return;
    setScoring(true);
    const scored = await scoreCurveball(curveball.line, text);
    setScoring(false);
    if (!scored) return;
    const record: CurveballRecord = { ...scored, response: text, line: curveball.line };
    setResult(record);
    await saveCurveball(today, record);
  };

  const toggleReminder = async (value: boolean) => {
    setReminderOn(value);
    const ok = value ? await scheduleDailyCurveball() : (await cancelDailyCurveball(), false);
    setReminderOn(ok);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 , ...contentColumn }} keyboardShouldPersistTaps="handled">
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
          {heroTitle}
        </Text>
        <Text style={[type.bodySmall, { fontSize: 13, marginTop: 8 }]}>
          {heroSubtitle}
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
                {upcoming ? countdownLabel(upcoming.at) : 'TONIGHT'}
              </Eyebrow>
            </View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.inkMeta }}>
              {best != null ? `BEST ${best}` : 'FIRST ROUND'}
            </Text>
          </View>
          <Text style={[type.body, { marginTop: 11 }]}>
            {cardBody}
          </Text>
          <Button
            label="Rehearse tonight"
            style={{ marginTop: 13, height: 50 }}
            onPress={startRehearsal}
          />
          <Pressable onPress={() => navigation.navigate('Upcoming', { existing: upcoming ?? undefined })}>
            <Text
              style={[
                type.bodySmall,
                { fontSize: 12, textAlign: 'center', marginTop: 12, color: colors.inkFaint },
              ]}
            >
              {upcoming
                ? 'Change the real conversation'
                : 'Have a real one coming up? Count it down →'}
            </Text>
          </Pressable>
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <SparkIcon color={colors.ember} />
          <Eyebrow>TODAY'S CURVEBALL</Eyebrow>
        </View>
        <Card style={{ marginTop: 8 }}>
          <Text style={type.spoken}>“{curveball.line}”</Text>
          {result ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                    {result.score}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.label}>{result.verdict}</Text>
                  <Text style={[type.bodySmall, { marginTop: 2 }]}>{result.note}</Text>
                </View>
              </View>
              <Eyebrow size={9} style={{ marginTop: 12 }}>
                STRONGER
              </Eyebrow>
              <Text style={[type.spoken, { fontSize: 15, lineHeight: 20, color: colors.inkSerif, marginTop: 4 }]}>
                “{result.stronger}”
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                value={response}
                onChangeText={setResponse}
                placeholder="Type your one-line response…"
                placeholderTextColor={colors.inkFaint}
                multiline
                style={{
                  marginTop: 11,
                  borderWidth: 1,
                  borderColor: colors.outline,
                  borderRadius: radius.row,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  minHeight: 48,
                  fontFamily: fonts.ui,
                  fontSize: 13,
                  color: colors.ink,
                }}
              />
              <Button
                label={scoring ? 'Coach is reading…' : 'Score it'}
                variant="ghost"
                style={{ marginTop: 10, opacity: response.trim() ? 1 : 0.5 }}
                onPress={submitCurveball}
              />
            </>
          )}
        </Card>

        {remindersSupported && (
          <Pressable
            onPress={() => toggleReminder(!reminderOn)}
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
            }}
          >
            <Text style={[type.bodySmall, { fontSize: 12 }]}>
              {`Daily curveball · ${REMINDER_HOUR > 12 ? REMINDER_HOUR - 12 : REMINDER_HOUR}:00 ${REMINDER_HOUR >= 12 ? 'PM' : 'AM'}`}
            </Text>
            <Switch
              value={reminderOn}
              onValueChange={toggleReminder}
              trackColor={{ false: colors.surface2, true: colors.ember }}
              thumbColor={colors.ink}
            />
          </Pressable>
        )}

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
