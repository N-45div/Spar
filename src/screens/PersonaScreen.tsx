import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Eyebrow } from '../components/Eyebrow';
import { BackIcon } from '../components/icons';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { RootStackParamList } from '../navigation/types';
import { prefetchOpener } from '../round/engine';
import { colors, fonts, radius, type } from '../theme/tokens';
import { contentColumn } from '../theme/layout';

type Props = NativeStackScreenProps<RootStackParamList, 'Persona'>;

const ROLES = ['Direct report', 'Peer', 'My manager', 'Skip-level'];
const TEMPERAMENTS = ['Defensive', 'Goes quiet', 'Explosive', 'Deflects with humor'];
const STAKES = ['Routine', 'High', 'Career-defining'];

const TEMPERAMENT_CLAUSE: Record<string, string> = {
  Defensive: 'hears feedback as an attack',
  'Goes quiet': 'answers hard questions with silence',
  Explosive: 'turns the volume up when cornered',
  'Deflects with humor': 'jokes their way out of hard moments',
};

const STAKES_CLAUSE: Record<string, string> = {
  Routine: 'Routine on paper — not in your chest.',
  High: 'The stakes feel high to both of you.',
  'Career-defining': 'Careers move on this one.',
};

export function PersonaScreen({ navigation, route }: Props) {
  const scenario = route.params?.scenario;
  const [role, setRole] = useState(scenario?.role ?? 'Direct report');
  const [temperament, setTemperament] = useState(scenario?.temperament ?? 'Defensive');
  const [stakes, setStakes] = useState(scenario?.stakes ?? 'High');
  const [note, setNote] = useState('');
  const [hinglish, setHinglish] = useState(false);

  // Warm the opening line while they are still choosing, so the round can start
  // talking instead of making them watch a spinner.
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchOpener({
        role,
        temperament,
        stakes,
        title: scenario?.title,
        brief: scenario?.brief,
        language: hinglish ? 'hi' : 'en',
        pressure: scenario?.pressure ?? 2,
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [role, temperament, stakes, hinglish, scenario]);

  const article = /^[aeiou]/i.test(temperament) ? 'An' : 'A';
  const file = `${article} ${temperament.toLowerCase()} ${role.toLowerCase()} who ${TEMPERAMENT_CLAUSE[temperament]}. ${STAKES_CLAUSE[stakes]}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, flexGrow: 1 , ...contentColumn }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton onPress={() => navigation.goBack()}>
            <BackIcon color={colors.inkDim} />
          </IconButton>
          <Eyebrow>{scenario ? scenario.title : 'NEW REHEARSAL · 1 OF 2'}</Eyebrow>
        </View>

        <Text style={[type.display, { fontSize: 28, lineHeight: 32, marginTop: 14 }]}>
          Who's across{'\n'}the table?
        </Text>
        {scenario && (
          <Text style={[type.bodySmall, { fontSize: 13, marginTop: 8 }]}>{scenario.brief}</Text>
        )}

        <Eyebrow style={{ marginTop: 16 }}>ROLE</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {ROLES.map((value) => (
            <Chip key={value} label={value} selected={role === value} onPress={() => setRole(value)} />
          ))}
        </View>

        <Eyebrow style={{ marginTop: 16 }}>TEMPERAMENT</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {TEMPERAMENTS.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={temperament === value}
              onPress={() => setTemperament(value)}
            />
          ))}
        </View>

        <Eyebrow style={{ marginTop: 16 }}>STAKES</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {STAKES.map((value) => (
            <Chip key={value} label={value} selected={stakes === value} onPress={() => setStakes(value)} />
          ))}
        </View>

        <Card style={{ marginTop: 18 }}>
          <Eyebrow size={9}>THEIR FILE</Eyebrow>
          <Text style={[type.spoken, { fontSize: 18, lineHeight: 23, color: colors.inkSerif, marginTop: 7 }]}>
            {file}
          </Text>
        </Card>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything else about them…"
          placeholderTextColor={colors.inkFaint}
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: colors.outline,
            borderRadius: radius.row,
            paddingVertical: 13,
            paddingHorizontal: 16,
            fontFamily: fonts.ui,
            fontSize: 13,
            color: colors.ink,
          }}
        />

        <Pressable
          onPress={() => setHinglish((value) => !value)}
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: hinglish ? colors.ember : colors.outline,
            backgroundColor: hinglish ? 'rgba(228,87,46,0.07)' : 'transparent',
            borderRadius: radius.row,
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <View>
            <Text style={{ fontFamily: fonts.uiMedium, fontSize: 14, color: colors.ink }}>Rehearse in Hinglish</Text>
            <Text style={[type.bodySmall, { marginTop: 2 }]}>They talk like an Indian office colleague</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 24,
              borderRadius: 12,
              backgroundColor: hinglish ? colors.ember : colors.surface2,
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: hinglish ? colors.onEmber : colors.inkFaint,
                alignSelf: hinglish ? 'flex-end' : 'flex-start',
              }}
            />
          </View>
        </Pressable>

        <View style={{ flex: 1 }} />
        <Button
          label="Begin round one"
          style={{ marginTop: 24, height: 54 }}
          onPress={() =>
            navigation.navigate('Round', {
              role,
              temperament,
              stakes,
              title: scenario?.title,
              brief: scenario?.brief,
              language: hinglish ? 'hi' : 'en',
              pressure: scenario?.pressure ?? 2,
            })
          }
        />
      </ScrollView>
    </Screen>
  );
}
