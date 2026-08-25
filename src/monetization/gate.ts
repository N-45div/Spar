import { roundCount } from '../store/rounds';
import { FREE_ROUNDS, isPro } from './purchases';

// One answer for every "can they start another round?" moment in the app.
export async function canStartRound(): Promise<boolean> {
  if (await isPro()) return true;
  return (await roundCount()) < FREE_ROUNDS;
}

export async function canOpenProPack(): Promise<boolean> {
  return isPro();
}
