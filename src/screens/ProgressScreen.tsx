import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Eyebrow } from '../components/Eyebrow';
import { Screen } from '../components/Screen';
import { bestScore, loadRounds, RoundRecord, trainingDays } from '../store/rounds';
import { colors, fonts, radius, type } from '../theme/tokens';
import { contentColumn } from '../theme/layout';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function meta(record: RoundRecord) {
  const date = new Date(record.at);
  return `PRESSURE ${record.pressure} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function ProgressScreen() {
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
  const spark = rounds.slice(0, 10).reverse();

  const stats = [
    { label: 'ROUNDS', value: String(rounds.length) },
    { label: 'BEST', value: best != null ? String(best) : '—' },
    { label: 'DAYS', value: String(trainingDays(rounds)) },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 , ...contentColumn }}>
        <Eyebrow>PROGRESS</Eyebrow>
        <Text style={[type.display, { marginTop: 12 }]}>Your form over time</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          {stats.map((stat) => (
            <Card key={stat.label} style={{ flex: 1, padding: 14 }}>
              <Eyebrow size={9}>{stat.label}</Eyebrow>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: 6 }}>
                {stat.value}
              </Text>
            </Card>
          ))}
        </View>

        {rounds.length > 0 ? (
          <>
            {spark.length > 1 && (
            <Card style={{ marginTop: 12 }}>
              <Eyebrow size={9}>{`LAST ${spark.length} ROUNDS`}</Eyebrow>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56, marginTop: 12 }}>
                {spark.map((record, index) => (
                  <View
                    key={record.id}
                    style={{
                      flex: 1,
                      maxWidth: 36,
                      height: 8 + (record.overall / 100) * 48,
                      borderRadius: 3,
                      backgroundColor: index === spark.length - 1 ? colors.ember : colors.surface2,
                    }}
                  />
                ))}
              </View>
            </Card>
            )}

            <Eyebrow style={{ marginTop: 20 }}>HISTORY</Eyebrow>
            <View style={{ marginTop: 8, gap: 8 }}>
              {rounds.map((record) => (
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
                      {meta(record)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : (
          <Text style={[type.body, { marginTop: 16 }]}>
            No rounds yet. The ring is waiting.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
