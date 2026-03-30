import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Phone, PhoneOff } from 'lucide-react';
import { useWSStore } from '../stores/wsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { calls as callsApi } from '../lib/api';
import { GlassPanel } from './GlassPanel';

// Synthesise a simple ringtone using the Web Audio API so we never load
// external resources (no IP leak from audio file fetches to third-party CDNs).
function buildRingtonePlayer(ringtone: string): (() => void) | null {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return null;

  let ctx: AudioContext | null = null;
  let stopped = false;
  let timers: ReturnType<typeof setTimeout>[] = [];

  const patterns: Record<string, number[][]> = {
    // [frequency, duration(ms)] pairs repeated every interval
    default: [[880, 300], [0, 150], [880, 300]],
    gentle:  [[440, 500], [0, 300], [660, 500]],
    classic: [[880, 150], [0, 80], [880, 150], [0, 80], [880, 150], [0, 300]],
    pulse:   [[1000, 100], [0, 100]],
    chime:   [[523, 200], [659, 200], [784, 400]],
  };

  const notes = patterns[ringtone] ?? patterns['default'];

  function playPattern() {
    if (stopped) return;
    ctx = new AudioContext();
    let offset = ctx.currentTime;
    notes.forEach(([freq, dur]) => {
      if (freq > 0) {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, offset);
        gain.gain.exponentialRampToValueAtTime(0.001, offset + dur / 1000);
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.start(offset);
        osc.stop(offset + dur / 1000);
      }
      offset += dur / 1000;
    });
    const totalDuration = notes.reduce((s, [, d]) => s + d, 0) + 600;
    const t = setTimeout(() => { if (!stopped) playPattern(); }, totalDuration);
    timers.push(t);
  }

  playPattern();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    ctx?.close().catch(() => {});
  };
}

interface IncomingCall {
  id: string;
  creator_id: string;
  creator_name?: string;
  server_id?: string;
  channel_id?: string;
}

export function IncomingCallModal() {
  const { on } = useWSStore();
  const { settings, fetch: fetchSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const stopRingtone = useRef<(() => void) | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    const unsub = on('incoming_call', (msg) => {
      const payload = msg.payload as IncomingCall;
      setCall(payload);
    });
    return unsub;
  }, [on]);

  // Play ringtone whenever an incoming call arrives
  useEffect(() => {
    if (!call) return;

    const notifCalls = settings?.notification_calls !== false;
    const notifSounds = settings?.notification_sounds !== false;

    if (notifCalls && notifSounds) {
      const ringtone = settings?.ringtone || 'default';
      stopRingtone.current = buildRingtonePlayer(ringtone);
    }

    return () => {
      stopRingtone.current?.();
      stopRingtone.current = null;
    };
  }, [call, settings]);

  const dismiss = () => {
    stopRingtone.current?.();
    stopRingtone.current = null;
    setCall(null);
  };

  const handleAccept = async () => {
    if (!call) return;
    stopRingtone.current?.();
    stopRingtone.current = null;
    const callId = call.id;
    setCall(null);
    await callsApi.join(callId).catch(() => {});
    navigate({ to: '/app/call/$callId', params: { callId } });
  };

  const handleDecline = () => {
    dismiss();
  };

  if (!call) return null;

  const isGroup = !!call.server_id;
  const callerLabel = call.creator_name
    ? call.creator_name
    : isGroup
    ? 'Group Call'
    : 'Unknown Caller';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <GlassPanel className="p-8 flex flex-col items-center gap-6 max-w-xs w-full mx-4 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/30 flex items-center justify-center animate-glow">
          <Phone size={36} className="text-green-400" />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            {isGroup ? 'Incoming Group Call' : 'Incoming Call'}
          </p>
          <h2 className="text-xl font-bold text-white">{callerLabel}</h2>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={handleDecline}
            className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all-custom"
            title="Decline"
          >
            <PhoneOff size={22} />
          </button>
          <button
            onClick={handleAccept}
            className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all-custom"
            title="Accept"
          >
            <Phone size={22} />
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
