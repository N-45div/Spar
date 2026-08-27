import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Eyebrow } from '../components/Eyebrow';
import { XIcon } from '../components/icons';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { canStartRound } from '../monetization/gate';
import { RootStackParamList } from '../navigation/types';
import { apiBase, scoreRound, ScoreResult } from '../round/engine';
import { appendRound } from '../store/rounds';
import { colors, fonts, radius, type } from '../theme/tokens';
import { contentColumn } from '../theme/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'Scorecard'>;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const VERDICTS = [
  'You kept it human.',
  'You held the standard.',
  'You kept your footing.',
  'You stayed in the ring.',
  'You took the worst of it standing.',
];

type MomentView = { key: string; time: string; tag: string; good: boolean; quote: string; note: string };

export function ScorecardScreen({ navigation, route }: Props) {
  const {
    role,
    temperament,
    stakes,
    title: scenarioTitle,
    brief,
    language,
    pressure,
    durationSec,
    exchanges,
    history,
  } = route.params;

  const [result, setResult] = useState<ScoreResult | null>(null);
  const [coachReached, setCoachReached] = useState(true);
  const [scoring, setScoring] = useState(apiBase() != null && history.length > 1);

  // Heuristic fallback when no coach is reachable.
  const fallback = {
    clarity: clamp(58 + exchanges * 4, 40, 92),
    empathy: clamp(48 + pressure * 3 + exchanges, 40, 90),
    boundaries: clamp(62 + exchanges * 3 + pressure * 2, 40, 95),
  };
  const clarity = result?.clarity ?? fallback.clarity;
  const empathy = result?.empathy ?? fallback.empathy;
  const boundaries = result?.boundaries ?? fallback.boundaries;
  const overall = result?.overall ?? Math.round((clarity + empathy + boundaries) / 3);
  const verdict = result?.verdict ?? VERDICTS[pressure - 1];
  const delta = clamp(pressure * 3, 3, 15);
  const weakest = Math.min(clarity, empathy, boundaries);

  const moments: MomentView[] = result
    ? result.moments.map((m, index) => ({
        key: `${m.turn}-${index}`,
        time: `TURN ${m.turn + 1}`,
        tag: m.tag,
        good: m.good,
        quote: m.quote,
        note: m.note,
      }))
    : [];

  const bars = [
    { label: 'Clarity', value: clarity, fill: colors.inkSerif },
    { label: 'Empathy', value: empathy, fill: colors.ember },
    { label: 'Boundaries', value: boundaries, fill: colors.jade },
  ];

  const title = scenarioTitle ?? `${temperament} ${role.toLowerCase()}`;
  const saved = useRef(false);

  useEffect(() => {
    let active = true;
    const finish = (scored: ScoreResult | null) => {
      if (!active) return;
      setResult(scored);
      setCoachReached(scored != null);
      setScoring(false);
      if (saved.current) return;
      saved.current = true;
      const c = scored?.clarity ?? fallback.clarity;
      const e = scored?.empathy ?? fallback.empathy;
      const b = scored?.boundaries ?? fallback.boundaries;
      appendRound({
        id: Date.now().toString(36),
        at: new Date().toISOString(),
        title,
        role,
        temperament,
        stakes,
        pressure,
        overall: scored?.overall ?? Math.round((c + e + b) / 3),
        clarity: c,
        empathy: e,
        boundaries: b,
        durationSec,
      });
    };
    if (scoring) {
      scoreRound({ role, temperament, stakes, title: scenarioTitle, language, pressure }, history).then(finish);
    } else {
      finish(null);
    }
    return () => {
      active = false;
    };
  }, []);

  const runAgainHotter = async () => {
    if (!(await canStartRound())) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.replace('Round', {
      role,
      temperament,
      stakes,
      title: scenarioTitle,
      brief,
      language,
      pressure: pressure + 1,
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, flexGrow: 1 , ...contentColumn }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>{`ROUND 1 · ${formatClock(durationSec)} · PRESSURE ${pressure}`}</Eyebrow>
          <IconButton onPress={() => navigation.popToTop()} style={{ borderWidth: 0 }}>
            <XIcon size={16} color={colors.inkFaint} />
          </IconButton>
        </View>

        <Text style={[type.display, { fontSize: 26, lineHeight: 31, marginTop: 8 }]}>
          {scoring ? 'Coach is watching the tape…' : verdict}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 14, opacity: scoring ? 0.35 : 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 52, color: colors.ink }}>
            {overall}
          </Text>
          <View style={{ gap: 5, paddingBottom: 3 }}>
            <View
              style={{
                backgroundColor: colors.jadeTint,
                borderRadius: radius.pill,
                paddingVertical: 4,
                paddingHorizontal: 9,
                alignSelf: 'flex-start',
              }}
            >
              <Eyebrow size={9} color={colors.jade}>{`+${delta} VS LAST`}</Eyebrow>
            </View>
            <Eyebrow size={9}>{coachReached ? 'FORM SCORE' : 'ESTIMATED'}</Eyebrow>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 10, opacity: scoring ? 0.35 : 1 }}>
          {bars.map((bar) => (
            <View key={bar.label}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={type.label}>{bar.label}</Text>
                  {!scoring && bar.value === weakest && (
                    <View
                      style={{
                        backgroundColor: colors.emberTint,
                        borderRadius: radius.pill,
                        paddingVertical: 3,
                        paddingHorizontal: 7,
                      }}
                    >
                      <Eyebrow size={8} color={colors.ember}>
                        FOCUS
                      </Eyebrow>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.inkDim }}>{bar.value}</Text>
              </View>
              <View style={{ marginTop: 6, height: 6, borderRadius: 3, backgroundColor: colors.surface2 }}>
                <View
                  style={{ width: `${bar.value}%`, height: 6, borderRadius: 3, backgroundColor: bar.fill }}
                />
              </View>
            </View>
          ))}
        </View>

        {!scoring && !coachReached && (
          <Text style={[type.bodySmall, { fontSize: 11, marginTop: 10, color: colors.inkFaint }]}>
            The coach couldn't review this round, so these are estimates from how far you went.
          </Text>
        )}

        {moments.length > 0 && <Eyebrow style={{ marginTop: 18 }}>KEY MOMENTS</Eyebrow>}
        <View style={{ marginTop: 8, gap: 8, opacity: scoring ? 0.35 : 1 }}>
          {moments.map((moment) => (
            <Card key={moment.key} variant="row" style={{ padding: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.inkMeta }}>
                  {moment.time}
                </Text>
                <View
                  style={{
                    backgroundColor: moment.good ? colors.jadeTint : colors.emberTint,
                    borderRadius: radius.pill,
                    paddingVertical: 3,
                    paddingHorizontal: 7,
                  }}
                >
                  <Eyebrow size={8} color={moment.good ? colors.jade : colors.ember}>
                    {moment.tag}
                  </Eyebrow>
                </View>
              </View>
              <Text style={[type.spoken, { fontSize: 14, lineHeight: 18, color: colors.inkSerif, marginTop: 6 }]}>
                “{moment.quote}”
              </Text>
              <Text style={[type.bodySmall, { marginTop: 4 }]}>{moment.note}</Text>
            </Card>
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ gap: 8, marginTop: 24 }}>
          {pressure < 5 && (
            <Button label={`Run it again at pressure ${pressure + 1}`} onPress={runAgainHotter} />
          )}
          <Button label="Done for tonight" variant="ghost" onPress={() => navigation.popToTop()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
