import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Headphones, PhoneOff } from 'lucide-react';
import { useWSStore } from '../stores/wsStore';

interface VoiceChannelProps {
  channelId: string;
  serverId: string;
  onClose: () => void;
}

export function VoiceChannelPanel({ channelId, serverId, onClose }: VoiceChannelProps) {
  const { send, on } = useWSStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    // Join voice channel
    send({ type: 'join_voice', payload: { channel_id: channelId, server_id: serverId } });
    setConnected(true);

    // Get user media
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localStreamRef.current = stream;
    }).catch(() => {
      // Mic permission denied - still allow joining but notify
    });

    const unsub = on('voice_participants', (msg) => {
      setParticipants(msg.payload.participants || []);
    });

    return () => {
      unsub();
      send({ type: 'leave_voice', payload: { channel_id: channelId } });
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnectionsRef.current.forEach(pc => pc.close());
      setConnected(false);
    };
  }, [channelId, serverId, send, on]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => {
      t.enabled = isMuted;
    });
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  return (
    <div className="absolute bottom-0 left-56 right-56 bg-black/80 border-t border-white/10 p-3 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-white">Voice Connected</span>
          </div>
          {participants.length > 0 && (
            <span className="text-xs text-gray-400">{participants.length} in channel</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-all-custom ${isMuted ? 'bg-red-500/50 text-red-200' : 'bg-white/10 text-gray-300 hover:text-white'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={toggleDeafen}
            className={`p-2 rounded-lg transition-all-custom ${isDeafened ? 'bg-red-500/50 text-red-200' : 'bg-white/10 text-gray-300 hover:text-white'}`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <Headphones size={18} className="text-red-200" /> : <Headphones size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all-custom"
            title="Disconnect"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
