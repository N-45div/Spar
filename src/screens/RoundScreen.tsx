import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Eyebrow } from '../components/Eyebrow';
import { FlagIcon, MicIcon, XIcon } from '../components/icons';
import { IconButton } from '../components/IconButton';
import { RootStackParamList } from '../navigation/types';
import { CounterpartTurn, nextLine, speakUrl, transcribe, Turn } from '../round/engine';
import { PRESSURE_HEAT, PRESSURE_NAMES } from '../round/script';
import { colors, fonts, radius, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Round'>;
type Phase = 'thinking' | 'ready' | 'listening' | 'transcribing';

const WAVE_BASE_HEIGHTS = [14, 26, 34, 22, 12];
const MAX_EXCHANGES = 8;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function useBreathe(duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, value]);
  return value;
}

export function RoundScreen({ navigation, route }: Props) {
  const { role, temperament, stakes, title, brief, pressure: initialPressure } = route.params;
  const [pressure, setPressure] = useState(initialPressure);
  const [turn, setTurn] = useState<CounterpartTurn>({ line: '…', hint: 'Take a breath. They speak first.' });
  const [phase, setPhase] = useState<Phase>('thinking');
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [lastSaid, setLastSaid] = useState('');
  const [seconds, setSeconds] = useState(0);

  const history = useRef<Turn[]>([]);
  const exchanges = useRef(0);
  const pressureRef = useRef(initialPressure);
  const alive = useRef(true);
  const permission = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const speaking = localSpeaking || playerStatus.playing;
  const heat = PRESSURE_HEAT[pressure - 1];

  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const stopSpeaking = () => {
    try {
      player.pause();
    } catch {
      // player may not be loaded yet
    }
    Speech.stop();
    setLocalSpeaking(false);
  };

  const speak = (text: string) => {
    stopSpeaking();
    const url = speakUrl(text);
    if (url) {
      try {
        player.replace({ uri: url });
        player.play();
        return;
      } catch {
        // fall through to system voice
      }
    }
    setLocalSpeaking(true);
    Speech.speak(text, {
      rate: 0.98,
      onDone: () => setLocalSpeaking(false),
      onStopped: () => setLocalSpeaking(false),
      onError: () => setLocalSpeaking(false),
    });
  };

  const spec = () => ({
    role,
    temperament,
    stakes,
    title,
    brief,
    pressure: pressureRef.current,
  });

  const ask = async () => {
    setPhase('thinking');
    const next = await nextLine(spec(), history.current);
    if (!alive.current) return;
    history.current.push({ who: 'them', text: next.line });
    setTurn(next);
    setPhase('ready');
    speak(next.line);
  };

  useEffect(() => {
    alive.current = true;
    requestRecordingPermissionsAsync()
      .then((response) => {
        permission.current = response.granted;
      })
      .catch(() => {
        permission.current = false;
      });
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
    ask();
    return () => {
      alive.current = false;
      stopSpeaking();
    };
  }, []);

  const ringA = useBreathe(4200);
  const ringB = useBreathe(5400);
  const waves = useRef(WAVE_BASE_HEIGHTS.map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    if (!speaking) {
      waves.forEach((wave) => wave.setValue(0.4));
      return;
    }
    const loops = waves.map((wave, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(wave, { toValue: 1, duration: 340, useNativeDriver: true }),
          Animated.timing(wave, { toValue: 0.35, duration: 340, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [speaking, waves]);

  const endRound = () => {
    alive.current = false;
    stopSpeaking();
    navigation.replace('Scorecard', {
      role,
      temperament,
      stakes,
      title,
      pressure,
      durationSec: seconds,
      exchanges: exchanges.current,
      history: history.current,
    });
  };

  const onPressIn = async () => {
    if (phase !== 'ready') return;
    stopSpeaking();
    setPhase('listening');
    if (!permission.current) {
      try {
        permission.current = (await requestRecordingPermissionsAsync()).granted;
      } catch {
        permission.current = false;
      }
    }
    if (!permission.current) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      // recording unavailable on this platform — the round still advances
    }
  };

  const onPressOut = async () => {
    if (phase !== 'listening') return;
    setPhase('transcribing');
    let said = '';
    try {
      if (recorder.isRecording) await recorder.stop();
      if (recorder.uri) said = await transcribe(recorder.uri);
    } catch {
      said = '';
    }
    if (!alive.current) return;
    if (said) {
      history.current.push({ who: 'you', text: said });
      setLastSaid(said);
    }
    exchanges.current += 1;
    if (exchanges.current >= MAX_EXCHANGES) {
      endRound();
      return;
    }
    ask();
  };

  let pttLabel = 'Hold to respond';
  if (phase === 'listening') pttLabel = 'Listening…';
  else if (phase === 'transcribing') pttLabel = 'Got it…';
  else if (phase === 'thinking') pttLabel = 'One second…';

  let pttStatus = 'YOUR MOVE';
  if (phase === 'listening') pttStatus = 'RELEASE TO SEND';
  else if (phase === 'transcribing') pttStatus = 'HEARING YOU';
  else if (phase === 'thinking') pttStatus = "THEY'RE THINKING";
  else if (speaking) pttStatus = "THEY'RE SPEAKING";

  const listening = phase === 'listening';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgStage, paddingHorizontal: 24, paddingTop: 54, paddingBottom: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton onPress={() => navigation.goBack()}>
          <XIcon color={colors.inkDim} />
        </IconButton>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.76, color: colors.inkDim }}>
          ROUND 1 · {formatClock(seconds)}
        </Text>
        <IconButton onPress={endRound}>
          <FlagIcon color={colors.inkDim} />
        </IconButton>
      </View>

      <Eyebrow size={9} style={{ textAlign: 'center', marginTop: 14 }}>
        {title ?? `${temperament} ${role} · ${stakes} stakes`}
      </Eyebrow>

      <View style={{ flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={320} height={320} style={{ position: 'absolute', opacity: 0.35 + heat * 0.65 }}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.ember} stopOpacity={0.16 + heat * 0.12} />
              <Stop offset="65%" stopColor={colors.ember} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={160} cy={160} r={160} fill="url(#glow)" />
        </Svg>
        <Animated.View
          style={{
            position: 'absolute',
            width: 236,
            height: 236,
            borderRadius: 118,
            borderWidth: 1,
            borderColor: 'rgba(228,87,46,0.16)',
            opacity: ringA.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
            transform: [{ scale: ringA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: 196,
            height: 196,
            borderRadius: 98,
            borderWidth: 1,
            borderColor: 'rgba(228,87,46,0.24)',
            opacity: ringB.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
            transform: [{ scale: ringB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
          }}
        />
        <View
          style={{
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: '#22150D',
            borderWidth: 1,
            borderColor: `rgba(228,87,46,${0.3 + heat * 0.35})`,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 5,
          }}
        >
          {WAVE_BASE_HEIGHTS.map((height, index) => (
            <Animated.View
              key={index}
              style={{
                width: 4,
                height,
                borderRadius: 2,
                backgroundColor: colors.wave,
                transform: [{ scaleY: waves[index] }],
              }}
            />
          ))}
        </View>
      </View>

      <Text style={[type.spoken, { fontSize: 21, lineHeight: 28, textAlign: 'center', alignSelf: 'center', maxWidth: 330 }]}>
        “{turn.line}”
      </Text>

      <View
        style={{
          marginTop: 16,
          backgroundColor: 'rgba(33,28,22,0.72)',
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.row,
          paddingVertical: 12,
          paddingHorizontal: 16,
        }}
      >
        <Eyebrow size={9} color={colors.ember}>
          CORNER COACH
        </Eyebrow>
        <Text style={[type.body, { fontSize: 13, lineHeight: 19, marginTop: 6 }]}>{turn.hint}</Text>
        {lastSaid.length > 0 && (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.9, color: colors.inkFaint, marginTop: 8 }}
          >
            {`YOU SAID · ${lastSaid}`}
          </Text>
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Eyebrow>PRESSURE</Eyebrow>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.32, color: colors.ember, textTransform: 'uppercase' }}>
            {PRESSURE_NAMES[pressure - 1]}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => setPressure(level)}
              hitSlop={{ top: 14, bottom: 14 }}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: level <= pressure ? colors.ember : colors.surface2,
              }}
            />
          ))}
        </View>
      </View>

      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          marginTop: 14,
          height: 62,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: listening ? colors.ember : colors.outline,
          backgroundColor: listening ? colors.emberTint : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: phase === 'ready' || listening ? 1 : 0.6,
        }}
      >
        <MicIcon color={colors.ember} />
        <Text style={{ fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.ink }}>{pttLabel}</Text>
      </Pressable>
      <Eyebrow size={9} style={{ textAlign: 'center', marginTop: 9 }}>
        {pttStatus}
      </Eyebrow>
    </View>
  );
}
