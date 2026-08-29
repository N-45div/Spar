import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Eyebrow } from '../components/Eyebrow';
import { BackIcon } from '../components/icons';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { RootStackParamList } from '../navigation/types';
import { cancelCountdown, scheduleCountdown } from '../notifications/countdown';
import { clearUpcoming, saveUpcoming, whenLabel } from '../store/upcoming';
import { contentColumn } from '../theme/layout';
import { colors, fonts, radius, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Upcoming'>;

const ROLES = ['Direct report', 'Peer', 'My manager', 'Skip-level'];
const TEMPERAMENTS = ['Defensive', 'Goes quiet', 'Explosive', 'Deflects with humor'];

/** Next occurrence of an hour, `days` from now. */
function at(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const WHENS = [
  { label: 'Tomorrow morning', date: () => at(1, 10) },
  { label: 'Tomorrow afternoon', date: () => at(1, 15) },
  { label: 'In two days', date: () => at(2, 10) },
  { label: 'In three days', date: () => at(3, 10) },
  { label: 'Next week', date: () => at(7, 10) },
];

export function UpcomingScreen({ navigation, route }: Props) {
  const existing = route.params?.existing;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [whenIndex, setWhenIndex] = useState(2);
  const [role, setRole] = useState(existing?.role ?? 'Direct report');
  const [temperament, setTemperament] = useState(existing?.temperament ?? 'Defensive');
  const [busy, setBusy] = useState(false);

  const when = WHENS[whenIndex].date();
  const canSave = title.trim().length > 1;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    const upcoming = {
      title: title.trim(),
      at: when.toISOString(),
      role,
      temperament,
      stakes: 'High',
    };
    await saveUpcoming(upcoming);
    await scheduleCountdown(upcoming);
    setBusy(false);
    navigation.goBack();
  };

  const remove = async () => {
    setBusy(true);
    await clearUpcoming();
    await cancelCountdown();
    setBusy(false);
    navigation.goBack();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, flexGrow: 1, ...contentColumn }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton onPress={() => navigation.goBack()}>
            <BackIcon color={colors.inkDim} />
          </IconButton>
          <Eyebrow>THE REAL ONE</Eyebrow>
        </View>

        <Text style={[type.display, { fontSize: 28, lineHeight: 32, marginTop: 14 }]}>
          What's coming{'\n'}up?
        </Text>
        <Text style={[type.bodySmall, { fontSize: 13, marginTop: 8 }]}>
          Spar will remind you to rehearse the night before, and once more two hours out.
        </Text>

        <Eyebrow style={{ marginTop: 20 }}>THE CONVERSATION</Eyebrow>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="The raise conversation with Priya"
          placeholderTextColor={colors.inkFaint}
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.outline,
            borderRadius: radius.row,
            paddingVertical: 14,
            paddingHorizontal: 16,
            fontFamily: fonts.ui,
            fontSize: 14,
            color: colors.ink,
          }}
        />

        <Eyebrow style={{ marginTop: 18 }}>WHEN</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {WHENS.map((option, index) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={whenIndex === index}
              onPress={() => setWhenIndex(index)}
            />
          ))}
        </View>

        <Eyebrow style={{ marginTop: 18 }}>WHO</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {ROLES.map((value) => (
            <Chip key={value} label={value} selected={role === value} onPress={() => setRole(value)} />
          ))}
        </View>
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

        <Card style={{ marginTop: 18 }}>
          <Eyebrow size={9}>YOUR RUN-UP</Eyebrow>
          <Text style={[type.spoken, { fontSize: 18, lineHeight: 23, color: colors.inkSerif, marginTop: 7 }]}>
            {canSave ? `${title.trim()} — ${whenLabel(when.toISOString())}.` : 'Name it and Spar will count you down.'}
          </Text>
          <Text style={[type.bodySmall, { marginTop: 8 }]}>
            Reminders the evening before and two hours out.
          </Text>
        </Card>

        <View style={{ flex: 1 }} />
        <Button
          label={busy ? 'One second…' : 'Count me down'}
          style={{ marginTop: 20, height: 54, opacity: canSave ? 1 : 0.5 }}
          onPress={save}
        />
        {existing && (
          <Pressable onPress={remove} style={{ paddingVertical: 14 }}>
            <Text style={[type.bodySmall, { textAlign: 'center', color: colors.inkFaint }]}>
              Remove this conversation
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}
