'use client';

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { MicCapture, Player } from './audio';
import { useAppTools, type AssistantControls } from './useAppTools';
import type { ChatMessage } from '@/lib/types';

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';

const MSG_KEY = 'rf_msgs';
const HANDLE_KEY = 'rf_resume';
const uid = () => Math.random().toString(36).slice(2, 10);

function guessLanguage(msgs: ChatMessage[]) {
  const text = msgs.filter((m) => m.role === 'user').map((m) => m.text).join(' ');
  if (!text) return null;
  if (/[؀-ۿ]/.test(text)) return /[ٹڈڑںےۓ]/.test(text) ? 'ur' : 'ar';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[¿¡ñ]/i.test(text)) return 'es';
  if (/[çœàèùâêîôû]/i.test(text)) return 'fr';
  return null; // the close-session summary fills the real language
}

/**
 * Full-duplex Gemini Live session: mic → Gemini, Gemini audio → speaker,
 * live transcripts as chat bubbles, barge-in, tool calls, and transparent reconnects
 * (session resumption) so a session stays open until the user closes it.
 */
export function useGeminiLive(opts: { onPanel?: (open: boolean) => void } = {}) {
  const app = useApp();
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [micAvailable, setMicAvailable] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');

  const session = useRef<Session | null>(null);
  const mic = useRef<MicCapture | null>(null);
  const player = useRef(new Player());
  const handle = useRef<string | null>(null);
  const closing = useRef(false);
  const pending = useRef<string[]>([]);
  const sessionId = useRef<string | null>(app.sessionId);
  const retries = useRef(0);
  sessionId.current = app.sessionId;

  // ── restore after reload ──
  useEffect(() => {
    try {
      const m = sessionStorage.getItem(MSG_KEY);
      if (m) setMessages(JSON.parse(m));
      handle.current = sessionStorage.getItem(HANDLE_KEY);
    } catch {}
    player.current.onIdle = () => setAiSpeaking(false);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(MSG_KEY, JSON.stringify(messages.slice(-200)));
    } catch {}
  }, [messages]);

  const append = useCallback((role: 'user' | 'ai', text: string) => {
    if (!text) return;
    setMessages((ms) => {
      const last = ms[ms.length - 1];
      if (last && last.role === role && last.open) return [...ms.slice(0, -1), { ...last, text: last.text + text }];
      const closed = ms.map((m) => (m.open ? { ...m, open: false } : m));
      return [...closed, { id: uid(), role, text: text.trimStart(), at: Date.now(), open: true }];
    });
  }, []);

  const closeBubbles = useCallback(() => setMessages((ms) => (ms.some((m) => m.open) ? ms.map((m) => (m.open ? { ...m, open: false } : m)) : ms)), []);

  const addAction = useCallback((text: string, action?: { label: string; href: string }) => {
    setMessages((ms) => [...ms.map((m) => (m.open ? { ...m, open: false } : m)), { id: uid(), role: 'ai', text, at: Date.now(), action }]);
  }, []);

  const controls = useRef<AssistantControls | null>(null);
  const runTool = useAppTools(addAction, controls);

  // ── connection ──
  const connectRef = useRef<(resume: boolean) => Promise<void>>(async () => {});

  const onMessage = useCallback(
    async (msg: LiveServerMessage) => {
      if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
        handle.current = msg.sessionResumptionUpdate.newHandle;
        try {
          sessionStorage.setItem(HANDLE_KEY, handle.current);
        } catch {}
      }
      if (msg.goAway) {
        // Server will drop this socket soon: move to a fresh one carrying the conversation.
        setTimeout(() => connectRef.current(true), 500);
      }
      const sc = msg.serverContent;
      if (sc) {
        if (sc.interrupted) {
          player.current.interrupt();
          setAiSpeaking(false);
          closeBubbles();
        }
        if (sc.inputTranscription?.text) append('user', sc.inputTranscription.text);
        if (sc.outputTranscription?.text) append('ai', sc.outputTranscription.text);
        for (const p of sc.modelTurn?.parts ?? []) {
          if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('audio/')) {
            player.current.play(p.inlineData.data, p.inlineData.mimeType);
            setAiSpeaking(true);
          }
        }
        if (sc.turnComplete) closeBubbles();
      }
      const calls = msg.toolCall?.functionCalls ?? [];
      if (calls.length) {
        const responses = await Promise.all(
          calls.map(async (c) => {
            let result: Record<string, unknown>;
            try {
              result = await runTool(c.name ?? '', (c.args ?? {}) as Record<string, unknown>);
            } catch (e) {
              result = { error: (e as Error).message };
            }
            return { id: c.id, name: c.name, response: { result } };
          }),
        );
        session.current?.sendToolResponse({ functionResponses: responses });
      }
    },
    [append, closeBubbles, runTool],
  );

  const connect = useCallback(
    async (resume: boolean) => {
      const sid = sessionId.current;
      if (!sid) return;
      const old = session.current;
      session.current = null;
      try {
        old?.close();
      } catch {}

      setStatus(resume ? 'reconnecting' : 'connecting');
      const r = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, handle: resume ? handle.current : null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not start the voice assistant.');

      const ai = new GoogleGenAI({ apiKey: d.token, httpOptions: { apiVersion: 'v1alpha' } });
      let s: Session | null = null;
      s = await ai.live.connect({
        model: d.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (m: LiveServerMessage) => void onMessage(m),
          onerror: (e: ErrorEvent) => console.warn('live error', e.message),
          onclose: () => {
            if (closing.current || !s || session.current !== s) return;
            session.current = null;
            if (retries.current < 4 && handle.current) {
              retries.current += 1;
              setTimeout(() => connectRef.current(true).catch(fail), 400 * retries.current);
            } else {
              setStatus('error');
              setError('Connection lost. Tap the mic to reconnect.');
            }
          },
        },
      });
      session.current = s;
      retries.current = 0;
      setStatus('live');
      setError('');

      if (!resume) {
        s.sendClientContent({ turns: [{ role: 'user', parts: [{ text: '(The visitor just opened the assistant. Greet them briefly.)' }] }], turnComplete: true });
      }
      for (const t of pending.current.splice(0)) s.sendRealtimeInput({ text: t });
    },
    [onMessage],
  );
  connectRef.current = connect;

  const fail = useCallback((e: unknown) => {
    setStatus('error');
    setError((e as Error).message || 'Something went wrong.');
  }, []);

  const startMic = useCallback(async () => {
    if (mic.current) return;
    const m = new MicCapture();
    try {
      await m.start((b64) => session.current?.sendRealtimeInput({ audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } }));
      mic.current = m;
      m.enabled = true;
      setMicOn(true);
      setMicAvailable(true);
    } catch {
      setMicAvailable(false);
      setMicOn(false);
    }
  }, []);

  /** Start (or resume) the session. Must be called from a click so audio can play on mobile. */
  const start = useCallback(async () => {
    player.current.unlock();
    closing.current = false;
    try {
      let sid = app.sessionId;
      let resume = !!sid && !!handle.current;
      if (!sid) {
        const r = await fetch('/api/sessions', { method: 'POST' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        sid = d.sessionId as string;
        sessionId.current = sid;
        app.setSessionId(sid);
        resume = false;
      }
      await Promise.all([connect(resume), startMic()]);
    } catch (e) {
      fail(e);
    }
  }, [app, connect, startMic, fail]);

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setMessages((ms) => [...ms.map((m) => (m.open ? { ...m, open: false } : m)), { id: uid(), role: 'user', text: t, at: Date.now() }]);
      player.current.interrupt();
      if (session.current && status === 'live') session.current.sendRealtimeInput({ text: t });
      else {
        pending.current.push(t);
        if (status === 'idle' || status === 'error') void start();
      }
    },
    [status, start],
  );

  const toggleMic = useCallback(async () => {
    if (!mic.current) return startMic();
    const on = !mic.current.enabled;
    mic.current.enabled = on;
    setMicOn(on);
    if (!on) session.current?.sendRealtimeInput({ audioStreamEnd: true });
  }, [startMic]);

  /** End the session: stop audio, save transcript; the server summarises it in the background. */
  const closeSession = useCallback(async () => {
    closing.current = true;
    try {
      session.current?.close();
    } catch {}
    session.current = null;
    mic.current?.stop();
    mic.current = null;
    player.current.interrupt();
    setAiSpeaking(false);
    const sid = app.sessionId;
    const transcript = messages.filter((m) => m.role !== 'system');
    if (sid) {
      await fetch('/api/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, transcript, language: guessLanguage(transcript) }),
        keepalive: true,
      }).catch(() => {});
    }
    handle.current = null;
    try {
      sessionStorage.removeItem(HANDLE_KEY);
      sessionStorage.removeItem(MSG_KEY);
    } catch {}
    app.setSessionId(null);
    setMessages([]);
    setStatus('idle');
  }, [app, messages]);

  const setMicEnabled = useCallback((on: boolean) => {
    if (!mic.current) return;
    mic.current.enabled = on;
    setMicOn(on);
    if (!on) session.current?.sendRealtimeInput({ audioStreamEnd: true });
  }, []);

  controls.current = {
    panel: (action) => {
      if (action === 'minimize') opts.onPanel?.(false);
      else if (action === 'expand') opts.onPanel?.(true);
      else if (action === 'mute_mic') setMicEnabled(false);
      else if (action === 'unmute_mic') setMicEnabled(true);
      else if (action === 'clear_chat') setMessages([]);
    },
  };

  /** Live bands for the equalizer: assistant voice while it speaks, otherwise the microphone. */
  const getBands = useCallback((n: number) => {
    if (player.current.speaking) return { values: player.current.bands(n), source: 'ai' as const };
    if (mic.current?.enabled) return { values: mic.current.bands(n), source: 'mic' as const };
    return { values: new Array(n).fill(0), source: 'idle' as const };
  }, []);

  // mic level meter for the UI
  useEffect(() => {
    if (status !== 'live') return;
    const t = setInterval(() => setLevel(mic.current?.enabled ? mic.current.level() : 0), 120);
    return () => clearInterval(t);
  }, [status]);

  // tidy up if the component unmounts (e.g. full page unload)
  useEffect(
    () => () => {
      closing.current = true;
      session.current?.close();
      mic.current?.stop();
    },
    [],
  );

  return {
    status,
    messages,
    micOn,
    micAvailable,
    aiSpeaking,
    level,
    error,
    hasSession: !!app.sessionId,
    start,
    sendText,
    toggleMic,
    closeSession,
    getBands,
  };
}
