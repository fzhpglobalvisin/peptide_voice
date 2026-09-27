import { after } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { TEXT_MODEL } from '@/lib/live-config';
import { closeSession, getSession, saveSummary } from '@/lib/store';
import { bad, json, readJson, s, verifiedVisitor } from '@/lib/http';
import type { ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';

/** Close a session: store the transcript now, summarise in the background. */
export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  const body = await readJson<{ sessionId?: string; transcript?: ChatMessage[]; language?: string }>(req);
  const session = body?.sessionId ? await getSession(s(body.sessionId, 40)) : undefined;
  if (!visitor || !session || session.visitor_id !== visitor) return bad('Session not found.', 404);
  if (session.status === 'closed') return json({ ok: true });

  const transcript = (Array.isArray(body?.transcript) ? body!.transcript : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string')
    .slice(-400)
    .map((m) => ({ id: '', role: m.role, text: m.text.slice(0, 4000), at: Number(m.at) || Date.now() }));
  const language = s(body?.language, 20) || null;
  await closeSession(session.id, transcript, language);

  if (transcript.length && process.env.GEMINI_API_KEY) {
    after(async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const text = transcript.map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.text}`).join('\n');
        const res = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: `Summarise this research-supply sales conversation for the store team. Return JSON with keys:
intent (one sentence), products (array of product names discussed), research_context (one sentence, lab terms only),
next_steps (array of short actions for the team), compliance_notes (any human-use/dosing questions the assistant declined, else empty string),
language (ISO 639-1 code the customer mainly spoke).
Do not include personal characteristics. Transcript:\n\n${text}`,
          config: { responseMimeType: 'application/json', temperature: 0.2 },
        });
        const parsed = JSON.parse(res.text || '{}');
        await saveSummary(session.id, parsed, typeof parsed.language === 'string' ? parsed.language.slice(0, 10) : null);
      } catch (e) {
        console.error('summary failed', e);
      }
    });
  }
  return json({ ok: true });
}
