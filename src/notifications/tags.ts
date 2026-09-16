// Turns what we know about a manager into OneSignal segments.
//
// These are the handles campaigns are built on: "has a real conversation in the
// next two days", "scored under 50 last night", "has never held past Pushback",
// "went quiet for a week". Without them a push is just a reminder.
import { bestScore, loadRounds, roundCount, trainingDays } from '../store/rounds';
import { loadUpcoming } from '../store/upcoming';
import { clearTags, setTags, setTrigger } from './onesignal';

const COUNTDOWN_KEYS = ['has_countdown', 'countdown_at', 'countdown_title', 'countdown_role', 'countdown_temperament'];

/** Everything derivable from local history. Safe to call on every focus. */
export async function syncProfileTags(): Promise<void> {
  try {
    const [rounds, upcoming] = await Promise.all([loadRounds(), loadUpcoming()]);
    const latest = rounds[0];
    const topPressure = rounds.reduce((high, r) => Math.max(high, r.pressure ?? 0), 0);

    setTags({
      rounds_total: rounds.length,
      training_days: trainingDays(rounds),
      best_score: bestScore(rounds) || null,
      last_score: latest?.overall ?? null,
      last_round_at: latest ? Math.floor(new Date(latest.at).getTime() / 1000) : null,
      last_scenario: latest?.title ?? null,
      top_pressure: topPressure || null,
      // Someone who has never gone past Pushback is the one to invite higher.
      holds_pressure: topPressure >= 4 ? 'high' : topPressure >= 3 ? 'medium' : 'low',
    });

    if (upcoming) {
      setTags({
        has_countdown: true,
        countdown_at: Math.floor(new Date(upcoming.at).getTime() / 1000),
        countdown_title: upcoming.title,
        countdown_role: upcoming.role,
        countdown_temperament: upcoming.temperament,
      });
    } else {
      clearTags(COUNTDOWN_KEYS);
    }
  } catch {
    // tags are an optimisation, never a reason to fail a screen
  }
}

/** Called right after a round is scored, so a campaign can react the same evening. */
export async function tagRoundFinished(overall: number, pressure: number, title?: string): Promise<void> {
  setTags({
    last_score: overall,
    last_pressure: pressure,
    last_scenario: title ?? null,
    last_round_at: Math.floor(Date.now() / 1000),
    rounds_total: await roundCount(),
  });
  // Lets an in-app message offer the hotter rerun while the round is still raw.
  setTrigger('last_round_outcome', overall < 55 ? 'rough' : 'strong');
}
