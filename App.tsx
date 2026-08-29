import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CornerIcon, GymIcon, ProgressIcon } from './src/components/icons';
import { configurePurchases } from './src/monetization/purchases';
import { RootStackParamList } from './src/navigation/types';
import { GymScreen } from './src/screens/GymScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { PersonaScreen } from './src/screens/PersonaScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { UpcomingScreen } from './src/screens/UpcomingScreen';
import { RoundScreen } from './src/screens/RoundScreen';
import { ScorecardScreen } from './src/screens/ScorecardScreen';
import { colors, fonts } from './src/theme/tokens';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.ember,
    background: colors.bg,
    card: colors.bg,
    border: colors.hairline,
    text: colors.ink,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ember,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.hairline,
          height: 74,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 1.1,
        },
      }}
    >
      <Tab.Screen
        name="Corner"
        component={HomeScreen}
        options={{
          tabBarLabel: 'CORNER',
          tabBarIcon: ({ color }) => <CornerIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Gym"
        component={GymScreen}
        options={{
          tabBarLabel: 'GYM',
          tabBarIcon: ({ color }) => <GymIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'PROGRESS',
          tabBarIcon: ({ color }) => <ProgressIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    configurePurchases();
  }, []);

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <RootStack.Navigator
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        >
          <RootStack.Screen name="Tabs" component={Tabs} />
          <RootStack.Screen name="Persona" component={PersonaScreen} />
          <RootStack.Screen name="Round" component={RoundScreen} options={{ gestureEnabled: false }} />
          <RootStack.Screen name="Scorecard" component={ScorecardScreen} />
          <RootStack.Screen name="Paywall" component={PaywallScreen} />
          <RootStack.Screen name="Upcoming" component={UpcomingScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
