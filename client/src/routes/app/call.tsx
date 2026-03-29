import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { calls as callsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useWSStore } from '../../stores/wsStore';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

export function CallPage() {
  const { callId } = useParams({ strict: false }) as { callId: string };
  const { user } = useAuthStore();
  const { send, on } = useWSStore();
  const navigate = useNavigate();

  const [call, setCall] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    callsApi.join(callId).then((c) => {
      setCall(c);
      setJoined(true);
      send({ type: 'join_call', payload: { call_id: callId } });
    }).catch(() => {});

    return () => {
      send({ type: 'leave_call', payload: { call_id: callId } });
      callsApi.leave(callId).catch(() => {});
    };
  }, [callId]);

  const handleLeave = async () => {
    send({ type: 'leave_call', payload: { call_id: callId } });
    await callsApi.leave(callId).catch(() => {});
    navigate({ to: '/app/timeline' });
  };

  const handleEnd = async () => {
    await callsApi.end(callId).catch(() => {});
    navigate({ to: '/app/timeline' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
      <GlassPanel className="p-8 flex flex-col items-center gap-6 max-w-sm w-full animate-scale-in">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/30 flex items-center justify-center animate-glow">
          <Phone size={40} className="text-green-400" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-white">
            {joined ? 'In Call' : 'Joining...'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Call ID: {callId?.slice(0, 8)}...
          </p>
          {call?.participant_count != null && (
            <p className="text-xs text-gray-500 mt-1">
              {call.participant_count} participant(s)
            </p>
          )}
        </div>

        {/* Call controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all-custom ${
              muted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={() => setVideoOff(!videoOff)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all-custom ${
              videoOff ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={handleLeave}
            className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all-custom"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {call?.creator_id === user?.id && (
          <button onClick={handleEnd} className="btn btn-danger text-sm">
            End Call For Everyone
          </button>
        )}
      </GlassPanel>

      <p className="text-xs text-gray-600 max-w-sm text-center">
        Your IP is hidden via relay. All call signaling passes through the Raider server.
      </p>
    </div>
  );
}
