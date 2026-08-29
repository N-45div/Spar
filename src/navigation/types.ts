import { Scenario } from '../data/packs';
import { Turn } from '../round/engine';
import { Upcoming } from '../store/upcoming';

export type PersonaSpec = {
  role: string;
  temperament: string;
  stakes: string;
};

export type RootStackParamList = {
  Tabs: undefined;
  Paywall: undefined;
  Upcoming: { existing?: Upcoming } | undefined;
  Persona: { scenario?: Scenario } | undefined;
  Round: PersonaSpec & { pressure: number; title?: string; brief?: string; language?: string };
  Scorecard: PersonaSpec & {
    pressure: number;
    title?: string;
    brief?: string;
    language?: string;
    durationSec: number;
    exchanges: number;
    history: Turn[];
  };
};
