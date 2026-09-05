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
import { Animated, Easing, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Eyebrow } from '../components/Eyebrow';
import { FlagIcon, MicIcon, XIcon } from '../components/icons';
import { IconButton } from '../components/IconButton';
import { RootStackParamList } from '../navigation/types';
import { CounterpartTurn, fetchHint, nextLine, speakUrl, transcribe, Turn } from '../round/engine';
import { PRESSURE_HEAT, PRESSURE_NAMES } from '../round/script';
import { colors, fonts, radius, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Round'>;
type Phase = 'thinking' | 'ready' | 'listening' | 'transcribing';

const WAVE_BASE_HEIGHTS = [14, 26, 34, 22, 12];
const MAX_EXCHANGES = 8;
const WIDE_BREAKPOINT = 640;

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
  const language = route.params.language ?? 'en';
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  // A landscape phone or a half-screen multi-window pane is wide but short: same
  // two-pane composition, smaller stage, tighter rhythm.
  const compact = wide && height < 620;
  const roomy = wide && !compact;

  const [pressure, setPressure] = useState(initialPressure);
  const [turn, setTurn] = useState<CounterpartTurn>({ line: '…', hint: 'Take a breath. They speak first.' });
  const [phase, setPhase] = useState<Phase>('thinking');
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [lastSaid, setLastSaid] = useState('');
  const [micBlocked, setMicBlocked] = useState(false);
  const [missed, setMissed] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const history = useRef<Turn[]>([]);
  const exchanges = useRef(0);
  const pressureRef = useRef(initialPressure);
  const alive = useRef(true);
  const permission = useRef(false);
  const pendingUtterance = useRef<string | null>(null);
  const hintTurn = useRef(0);
  const recordingStarted = useRef(false);
  // Bumped on every press and release. A press that is still awaiting permission or
  // prepareToRecordAsync when the finger lifts must not start recording afterwards.
  const pressSeq = useRef(0);
  const playingRef = useRef(false);
  // True once the remote audio has actually advanced. `playing` alone is not proof:
  // Android reports playing while still buffering and web sets it synchronously.
  const progressedRef = useRef(false);
  const voiceFallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const speaking = localSpeaking || playerStatus.playing;
  const heat = PRESSURE_HEAT[pressure - 1];

  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);

  useEffect(() => {
    playingRef.current = playerStatus.playing;
    if (playerStatus.currentTime > 0) {
      progressedRef.current = true;
      if (voiceFallback.current) {
        clearTimeout(voiceFallback.current);
        voiceFallback.current = null;
      }
    }
  }, [playerStatus.playing, playerStatus.currentTime]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const clearVoiceFallback = () => {
    if (voiceFallback.current) {
      clearTimeout(voiceFallback.current);
      voiceFallback.current = null;
    }
  };

  const stopSpeaking = () => {
    clearVoiceFallback();
    try {
      player.pause();
    } catch {
      // player may not be loaded yet
    }
    Speech.stop();
    setLocalSpeaking(false);
  };

  const speakWithSystemVoice = (text: string) => {
    setLocalSpeaking(true);
    Speech.speak(text, {
      rate: 0.98,
      language: language === 'hi' ? 'hi-IN' : undefined,
      onDone: () => setLocalSpeaking(false),
      onStopped: () => setLocalSpeaking(false),
      onError: () => setLocalSpeaking(false),
    });
  };

  const speak = (text: string) => {
    stopSpeaking();
    const url = speakUrl(text, language);
    if (url) {
      try {
        progressedRef.current = false;
        player.replace({ uri: url });
        player.play();
        // play() returns before the audio has loaded, so a failed fetch is silent.
        // If the audio has not advanced by now, say the line with the system voice
        // and drop the remote one so a late arrival cannot speak over it.
        voiceFallback.current = setTimeout(() => {
          voiceFallback.current = null;
          if (!alive.current || progressedRef.current) return;
          try {
            player.pause();
          } catch {
            // nothing loaded
          }
          speakWithSystemVoice(text);
        }, 4000);
        return;
      } catch {
        // fall through to system voice
      }
    }
    speakWithSystemVoice(text);
  };

  const spec = () => ({
    role,
    temperament,
    stakes,
    title,
    brief,
    language,
    pressure: pressureRef.current,
  });

  const ask = async () => {
    setPhase('thinking');
    const next = await nextLine(spec(), history.current);
    if (!alive.current) return;
    history.current.push({ who: 'them', text: next.line });
    const turnId = ++hintTurn.current;
    setTurn({ line: next.line, hint: next.hint });
    setPhase('ready');
    speak(next.line);
    // The coach reads the room while she is still talking.
    fetchHint(spec(), history.current).then((coachHint) => {
      if (alive.current && hintTurn.current === turnId && coachHint) {
        setTurn((current) => ({ ...current, hint: coachHint }));
      }
    });
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
    if (__DEV__ && Platform.OS === 'web') {
      // Dev-only hook so automated demos/QA can feed a manager line instead of live audio.
      (globalThis as { __sparSetUtterance?: (text: string) => void }).__sparSetUtterance = (text) => {
        pendingUtterance.current = text;
      };
    }
    ask();
    return () => {
      alive.current = false;
      clearVoiceFallback();
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
      brief,
      language,
      pressure,
      durationSec: seconds,
      exchanges: exchanges.current,
      history: history.current,
    });
  };

  // Release the native recorder whatever state it is in, so a stuck or half-prepared
  // recorder never survives into the next press (Android throws AlreadyPrepared otherwise).
  const resetRecorder = async () => {
    try {
      await recorder.stop();
    } catch {
      // nothing to stop
    }
  };

  const onPressIn = async () => {
    if (phase !== 'ready') return;
    const seq = ++pressSeq.current;
    stopSpeaking();
    setMissed(false);
    setPhase('listening');
    recordingStarted.current = false;
    // A typed utterance (dev/QA hook) needs no microphone at all.
    if (pendingUtterance.current != null) return;
    if (!permission.current) {
      try {
        permission.current = (await requestRecordingPermissionsAsync()).granted;
      } catch {
        permission.current = false;
      }
    }
    // The permission sheet cancels the touch; the release already happened.
    if (pressSeq.current !== seq || !alive.current) return;
    if (!permission.current) {
      setMicBlocked(true);
      setPhase('ready');
      return;
    }
    setMicBlocked(false);
    try {
      await recorder.prepareToRecordAsync();
      if (pressSeq.current !== seq || !alive.current) {
        // Released while preparing: never start a recording nobody is holding.
        await resetRecorder();
        return;
      }
      recorder.record();
      recordingStarted.current = true;
    } catch {
      recordingStarted.current = false;
      await resetRecorder();
    }
  };

  const onPressOut = async () => {
    if (phase !== 'listening') return;
    pressSeq.current += 1;
    const typed = pendingUtterance.current;
    pendingUtterance.current = null;
    if (!recordingStarted.current && typed == null) {
      // Nothing was captured, so this is not a turn: do not spend an exchange or
      // ask the counterpart to answer silence.
      await resetRecorder();
      setPhase('ready');
      return;
    }
    setPhase('transcribing');
    let said: string | null = '';
    try {
      if (recorder.isRecording) await recorder.stop();
      // Only trust recorder.uri when this turn actually recorded — a stale uri from
      // a previous turn would otherwise be transcribed again.
      const uri = recordingStarted.current ? recorder.uri : null;
      said = typed ?? (uri ? await transcribe(uri, undefined, language) : null);
    } catch {
      said = typed ?? null;
    }
    recordingStarted.current = false;
    if (!alive.current) return;
    if (!said) {
      // Transcription failed or heard nothing. That is not a turn: keep the exchange,
      // keep her last line on screen, and invite another go.
      setMissed(true);
      setPhase('ready');
      return;
    }
    history.current.push({ who: 'you', text: said });
    setLastSaid(said);
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
  // The wide frame in one place, so the stage can be measured against its own pane.
  const padH = roomy ? 32 : 24;
  const paneGap = roomy ? 40 : 24;
  const stagePaneWidth = (width - padH * 2 - paneGap) * (1.15 / 2.15);
  // The stage box is the orb plus the widest breath of its rings (orb * 1.57 * 1.07),
  // so nameplate + orb + spoken line stay one cluster on a Fold, a tablet and a
  // landscape phone alike.
  const stageBox = Math.round(Math.max(150, Math.min(340, height * 0.4, stagePaneWidth)));
  const orbSize = wide ? Math.round(stageBox / 1.72) : 150;

  const header = (
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
  );

  const nameplate = (
    <Eyebrow size={9} style={{ textAlign: 'center', marginTop: wide ? 0 : 14, marginBottom: wide ? 4 : 0 }}>
      {(title ?? `${temperament} ${role} · ${stakes} stakes`) + (language === 'hi' ? ' · HINGLISH' : '')}
    </Eyebrow>
  );

  const stage = (
    <View
      style={
        wide
          ? { width: stageBox, height: stageBox, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }
          : { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' }
      }
    >
      <Svg width={orbSize * 2.13} height={orbSize * 2.13} style={{ position: 'absolute', opacity: 0.35 + heat * 0.65 }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.ember} stopOpacity={0.16 + heat * 0.12} />
            <Stop offset="65%" stopColor={colors.ember} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={orbSize * 1.065} cy={orbSize * 1.065} r={orbSize * 1.065} fill="url(#glow)" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          width: orbSize * 1.57,
          height: orbSize * 1.57,
          borderRadius: orbSize * 0.785,
          borderWidth: 1,
          borderColor: 'rgba(228,87,46,0.16)',
          opacity: ringA.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
          transform: [{ scale: ringA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: orbSize * 1.31,
          height: orbSize * 1.31,
          borderRadius: orbSize * 0.655,
          borderWidth: 1,
          borderColor: 'rgba(228,87,46,0.24)',
          opacity: ringB.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
          transform: [{ scale: ringB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
        }}
      />
      <View
        style={{
          width: orbSize,
          height: orbSize,
          borderRadius: orbSize / 2,
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
  );

  const caption = (
    // Reserving three lines keeps the orb still while the counterpart's line changes
    // length; flexShrink lets an unusually long line spill into the bottom padding
    // instead of pushing the stage off a short pane.
    <View style={{ alignSelf: 'center', flexShrink: 1, maxWidth: wide ? 420 : 330, minHeight: roomy ? 96 : undefined }}>
      <Text
        style={[
          type.spoken,
          {
            fontSize: wide ? (compact ? 20 : 24) : 21,
            lineHeight: wide ? (compact ? 27 : 32) : 28,
            textAlign: 'center',
          },
        ]}
      >
        “{turn.line}”
      </Text>
    </View>
  );

  const coach = (
    <View
      style={{
        marginTop: wide ? 0 : 16,
        // Holds its height through "Reading the room…" -> real hint -> YOU SAID,
        // so the centred corner does not hop between turns.
        minHeight: roomy ? 112 : undefined,
        backgroundColor: 'rgba(33,28,22,0.72)',
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.row,
        paddingVertical: roomy ? 16 : 12,
        paddingHorizontal: wide ? 18 : 16,
      }}
    >
      <Eyebrow size={9} color={colors.ember}>
        CORNER COACH
      </Eyebrow>
      <Text
        style={[
          type.body,
          {
            fontSize: roomy ? 14 : 13,
            lineHeight: roomy ? 20 : 19,
            marginTop: 6,
            color: turn.hint ? colors.inkSoft : colors.inkFaint,
          },
        ]}
      >
        {turn.hint || 'Reading the room…'}
      </Text>
      {lastSaid.length > 0 && (
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.9, color: colors.inkFaint, marginTop: 8 }}
        >
          {`YOU SAID · ${lastSaid}`}
        </Text>
      )}
    </View>
  );

  const dial = (
    <View style={{ marginTop: roomy ? 20 : 14 }}>
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
  );

  const ptt = (
    <>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          marginTop: roomy ? 20 : 14,
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
      {(micBlocked || missed) && (
        <Text
          style={[
            type.bodySmall,
            { fontSize: 11, textAlign: 'center', marginTop: 6, color: colors.ember },
          ]}
        >
          {micBlocked
            ? 'Spar needs the microphone to hear your answer.'
            : 'Didn’t catch that. Hold and try again — this one won’t count.'}
        </Text>
      )}
    </>
  );

  if (wide) {
    // Unfolded foldables, tablets, landscape and multi-window: two composed clusters
    // on one centre line — the counterpart's STAGE (who they are, the orb, the line
    // they just spoke) facing YOUR CORNER (the coach, the dial, the mic).
    return (
      <View
        testID="round-wide"
        style={{
          flex: 1,
          backgroundColor: colors.bgStage,
          paddingHorizontal: padH,
          paddingTop: 40,
          paddingBottom: roomy ? 24 : 18,
        }}
      >
        {header}
        <View style={{ flex: 1, flexDirection: 'row', gap: paneGap, marginTop: roomy ? 12 : 8 }}>
          <View
            style={{
              flex: 1.15,
              alignItems: 'center',
              justifyContent: 'center',
              gap: roomy ? 18 : 12,
            }}
          >
            {nameplate}
            {stage}
            {caption}
          </View>
          <View style={{ flex: 1, maxWidth: 460, justifyContent: 'center' }}>
            {coach}
            {dial}
            {ptt}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="round-stack"
      style={{ flex: 1, backgroundColor: colors.bgStage, paddingHorizontal: 24, paddingTop: 54, paddingBottom: 22 }}
    >
      {header}
      {nameplate}
      {stage}
      {caption}
      {coach}
      {dial}
      {ptt}
    </View>
  );
}
