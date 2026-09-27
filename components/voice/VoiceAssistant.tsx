'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { useGeminiLive } from './useGeminiLive';
import { Equalizer } from './Equalizer';

const QUICK_PROMPTS: { label: string; text: string; card?: 'bulk_quote' | 'view_coa' | 'quick_checkout' }[] = [
  { label: '⭐ Best sellers', text: 'Show me your best sellers.' },
  { label: '⚖️ Compare specs', text: 'I want to compare the specifications of two products.' },
  { label: '📄 Find a COA', text: 'Show me the certificates of analysis.', card: 'view_coa' },
  { label: '🧪 Bulk / lab quote', text: 'I need a bulk quote for my lab.', card: 'bulk_quote' },
  { label: '🚚 Shipping', text: 'How does shipping work?' },
  { label: '🛒 Checkout', text: 'I am ready to check out my cart.', card: 'quick_checkout' },
  { label: '💬 WhatsApp quote', text: 'Send my cart as a quote on WhatsApp.' },
];

const STATUS_LABEL = {
  idle: 'Tap to talk',
  connecting: 'Connecting…',
  live: 'Listening',
  reconnecting: 'Reconnecting…',
  error: 'Disconnected',
} as const;

export function VoiceAssistant() {
  const { verified, openCard } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const live = useGeminiLive({ onPanel: setOpen });
  const [text, setText] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [live.messages]);

  if (!verified || path.startsWith('/admin')) return null;

  const active = live.status === 'live' || live.status === 'connecting' || live.status === 'reconnecting';

  return (
    <>
      {/* Floating launcher: mic icon when idle; equalizer + End button while a session is running */}
      {!open && (
        <div data-ai-skip className="fixed bottom-5 right-4 z-[60] flex items-center gap-2 sm:bottom-6 sm:right-6">
          {live.hasSession && (
            <EndButton
              onEnd={async () => {
                await live.closeSession();
              }}
            />
          )}
          <button
            onClick={() => {
              setOpen(true);
              if (!active) void live.start();
            }}
            aria-label={live.hasSession ? 'Open assistant chat' : 'Start voice research assistant'}
            className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-brand to-[#1f59c9] text-white shadow-[0_0_24px_rgba(61,184,217,0.6)]"
          >
            {active && live.aiSpeaking && <span className="absolute inset-0 animate-pulseRing rounded-full bg-cyan-brand motion-reduce:animate-none" aria-hidden />}
            {active ? (
              <Equalizer getBands={live.getBands} color="#ffffff" idleColor="rgba(255,255,255,0.55)" className="relative h-6 w-7" />
            ) : (
              <MicIcon className="relative h-6 w-6" />
            )}
          </button>
        </div>
      )}

      {open && (
        <section
          aria-label="Voice research assistant"
          data-ai-skip
          className="fixed inset-x-0 bottom-0 z-[60] flex h-[78vh] flex-col overflow-hidden rounded-t-2xl border border-cyan-brand/40 bg-[#04090f]/95 text-white shadow-[0_0_40px_rgba(61,184,217,0.35)] backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[380px] sm:rounded-2xl"
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <div className={`relative grid h-9 w-9 place-items-center rounded-full ${live.aiSpeaking ? 'bg-cyan-brand/25' : 'bg-white/10'}`}>
              <Equalizer getBands={live.getBands} className="h-5 w-6" />
              {live.aiSpeaking && <span className="absolute inset-0 animate-pulseRing rounded-full bg-cyan-brand motion-reduce:animate-none" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Ridge · Research Assistant</p>
              <p className="text-[11px] text-white/60" aria-live="polite">
                {live.aiSpeaking ? 'Speaking — just talk to interrupt' : STATUS_LABEL[live.status]}
              </p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Minimise assistant" className="rounded-full p-1.5 text-white/70 hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </header>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
            {!live.messages.length && (
              <div className="mt-6 text-center text-xs text-white/60">
                <p className="text-sm text-white">Hi! Talk or type — I can find compounds, open COAs, compare specs, build your cart and send a quote.</p>
                <p className="mt-2">I speak English, Español, العربية, हिन्दी, اردو, Français and more.</p>
                <p className="mt-3 text-[10px] text-white/40">Research use only. I can&apos;t give dosing, human-use or medical information.</p>
              </div>
            )}
            {live.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  dir="auto"
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                    m.role === 'user' ? 'rounded-br-sm bg-[#1f59c9] text-white' : 'rounded-bl-sm border border-white/10 bg-white/5 text-white/95'
                  } ${m.open ? 'opacity-80' : ''}`}
                >
                  {m.text}
                  {m.open && <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-text align-middle" aria-hidden />}
                  {m.action && (
                    <a
                      href={m.action.href}
                      target={m.action.href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="mt-2 block rounded-full bg-[#25d366] px-3 py-1.5 text-center text-xs font-bold text-black"
                    >
                      {m.action.label}
                    </a>
                  )}
                </div>
              </div>
            ))}
            {live.error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200" role="alert">
                {live.error}
              </p>
            )}
            {!live.micAvailable && <p className="text-center text-[11px] text-white/50">Microphone unavailable — you can type instead.</p>}
          </div>

          {/* Quick prompts */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2" role="list" aria-label="Quick prompts">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q.label}
                role="listitem"
                onClick={() => {
                  if (q.card) openCard(q.card);
                  live.sendText(q.text);
                }}
                className="shrink-0 rounded-full border border-cyan-brand/50 bg-cyan-brand/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-text hover:bg-cyan-brand/25"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <form
            className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              live.sendText(text);
              setText('');
            }}
          >
            <button
              type="button"
              onClick={() => (active ? live.toggleMic() : live.start())}
              aria-label={live.micOn && active ? 'Mute microphone' : 'Start microphone'}
              aria-pressed={live.micOn && active}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full ${live.micOn && active ? 'bg-cyan-brand text-black' : 'bg-white/10 text-white'}`}
              style={live.micOn && active ? { boxShadow: `0 0 0 ${2 + live.level * 10}px rgba(61,184,217,0.35)` } : undefined}
            >
              {live.micOn && active ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              aria-label="Message"
              dir="auto"
              className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/40 focus:ring-1 focus:ring-cyan-brand"
            />
            <button type="submit" aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M3 20.5 21 12 3 3.5v6.9l12 1.6-12 1.6z" />
              </svg>
            </button>
          </form>

          {/* Session lifecycle */}
          {live.hasSession && (
            <div className="border-t border-white/10 px-3 py-2">
              {confirmClose ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/70">End this session and save the conversation?</span>
                  <span className="flex gap-2">
                    <button onClick={() => setConfirmClose(false)} className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10">
                      Keep
                    </button>
                    <button
                      onClick={async () => {
                        setConfirmClose(false);
                        await live.closeSession();
                        setOpen(false);
                      }}
                      className="rounded-full bg-red-500/80 px-3 py-1 font-semibold"
                    >
                      Close session
                    </button>
                  </span>
                </div>
              ) : (
                <button onClick={() => setConfirmClose(true)} className="w-full rounded-full border border-white/15 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10">
                  Close Session
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

/** Red "End" button: first tap asks for confirmation, second tap ends the session. */
function EndButton({ onEnd }: { onEnd: () => void | Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        await onEnd();
        setBusy(false);
        setArmed(false);
      }}
      aria-label={armed ? 'Tap again to end the session' : 'End session'}
      className={`flex h-11 items-center gap-1.5 rounded-full px-4 text-xs font-bold text-white shadow-lg transition ${
        armed ? 'bg-red-600 ring-2 ring-red-300' : 'bg-red-500/90 hover:bg-red-600'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
      {busy ? 'Ending…' : armed ? 'Tap to confirm' : 'End'}
    </button>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m3 3 18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3" />
    </svg>
  );
}
