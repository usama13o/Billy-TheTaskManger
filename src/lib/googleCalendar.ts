// Lightweight Google Calendar integration using Google Identity Services (GIS)
// Requires VITE_GOOGLE_CLIENT_ID in environment.

export interface GCalEventRaw {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}

export interface NormalizedGCalEvent {
  id: string; // Google event id
  title: string;
  description: string;
  date: string; // YYYY-MM-DD (start date)
  time?: string; // HH:mm local if timed
  minutes: number; // duration estimate (default 60 for all-day)
  allDay: boolean;
}

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

let accessToken: string | null = null;
let tokenClient: TokenClient | null = null;

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return resolve();
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = () => resolve();
  s.onerror = () => reject(new Error(`Failed to load ${src}`));
  document.head.appendChild(s);
});

export async function ensureGoogleToken(): Promise<string> {
  if (accessToken) return accessToken;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error('Missing VITE_GOOGLE_CLIENT_ID');

  await loadScript('https://accounts.google.com/gsi/client');

  // @ts-ignore
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) throw new Error('Google identity library not available');

  accessToken = await new Promise<string>((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: (resp: any) => {
        if (resp.error) return reject(resp);
        accessToken = resp.access_token;
        resolve(accessToken!);
      }
    });
  (tokenClient as TokenClient).requestAccessToken({ prompt: '' });
  });
  return accessToken;
}

export function signOutGoogle() {
  accessToken = null;
}

export function hasGoogleToken() {
  return !!accessToken;
}

export async function fetchGCalEvents(timeMinISO: string, timeMaxISO: string) {
  const token = await ensureGoogleToken();
  const params = new URLSearchParams({
    timeMin: new Date(timeMinISO).toISOString(),
    timeMax: new Date(timeMaxISO).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime'
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Google API error ${res.status}`);
  const json = await res.json();
  return (json.items || []) as GCalEventRaw[];
}

export function normalizeGCalEvent(e: GCalEventRaw): NormalizedGCalEvent | null {
  if (e.status === 'cancelled') return null;
  const title = e.summary || 'Untitled Event';
  const desc = e.description || '';
  // Determine start
  const startISO = e.start?.dateTime || (e.start?.date ? e.start.date + 'T00:00:00' : undefined);
  const endISO = e.end?.dateTime || (e.end?.date ? e.end.date + 'T00:00:00' : undefined);
  if (!startISO) return null;
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date(start.getTime() + 60 * 60 * 1000);
  const allDay = !!e.start?.date && !e.start?.dateTime;

  const date = start.toISOString().substring(0, 10);
  const time = allDay ? undefined : start.toISOString().substring(11, 16);
  const minutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
  return { id: e.id, title, description: desc, date, time, minutes, allDay };
}

export async function getNormalizedEventsForRange(startISODate: string, endISODate: string): Promise<NormalizedGCalEvent[]> {
  const items = await fetchGCalEvents(startISODate, endISODate);
  const normalized: NormalizedGCalEvent[] = [];
  for (const e of items) {
    const n = normalizeGCalEvent(e);
    if (n) normalized.push(n);
  }
  return normalized;
}
