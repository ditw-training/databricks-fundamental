/**
 * The participant's track (SQL / PySpark) per workshop (SPEC section 11): remembered in
 * localStorage per browser, user and workshop; SQL until the participant picks another one.
 */
import { trackSchema, type Track } from '../../../shared/guide-schema';
import { readStored, useStoredState, writeStored } from './storage';

export const DEFAULT_TRACK: Track = 'sql';

export const trackKey = (email: string, workshop: string) => `wg:${email}:${workshop}:track`;

/** A stored value that is not a known track (old or edited by hand) means the default. */
export const parseTrack = (value: unknown): Track => {
  const parsed = trackSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_TRACK;
};

export const readTrack = (email: string, workshop: string): Track => parseTrack(readStored<unknown>(trackKey(email, workshop), null));

export const writeTrack = (email: string, workshop: string, track: Track) => writeStored(trackKey(email, workshop), track);

/** True once the participant picked a track for this workshop (a known track is stored). */
export const isTrackChosen = (value: unknown): boolean => trackSchema.safeParse(value).success;

export const hasChosenTrack = (email: string, workshop: string): boolean =>
  isTrackChosen(readStored<unknown>(trackKey(email, workshop), null));

/**
 * [track, setTrack, chosen] for one workshop, mirrored to localStorage. `chosen` is false until the
 * participant picks a track (the workshop then asks first); `track` is SQL until then.
 */
export function useTrack(email: string, workshop: string) {
  const [stored, setStored] = useStoredState<unknown>(trackKey(email, workshop), null);
  return [parseTrack(stored), (t: Track) => setStored(t), isTrackChosen(stored)] as const;
}

/** "pyspark,sql" (progress row) -> ["pyspark", "sql"], unknown names dropped. */
export function parseTracks(value: string | null | undefined): Track[] {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is Track => trackSchema.safeParse(t).success);
}
