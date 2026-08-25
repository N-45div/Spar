import { Scenario } from '../data/packs';
import { Turn } from '../round/engine';

export type PersonaSpec = {
  role: string;
  temperament: string;
  stakes: string;
};

export type RootStackParamList = {
  Tabs: undefined;
  Paywall: undefined;
  Persona: { scenario?: Scenario } | undefined;
  Round: PersonaSpec & { pressure: number; title?: string; brief?: string };
  Scorecard: PersonaSpec & {
    pressure: number;
    title?: string;
    durationSec: number;
    exchanges: number;
    history: Turn[];
  };
};
