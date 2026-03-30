import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { calls as callsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useWSStore } from '../../stores/wsStore';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ShieldCheck } from 'lucide-react';

// ICE servers: only TURN relay entries prevent direct IP leakage.
// Deployers should add their own TURN server credentials here.
// Without a TURN server the call still works on the same network or via
// the server's WebSocket relay for signalling, but media will be P2P.
const ICE_SERVERS: RTCIceServer[] = [
  // Example TURN server entry (replace with your own):
  // { urls: 'turn:your-turn-server.example.com:3478', username: 'user', credential: 'pass' },
];

// True only when at least one TURN server is configured (url starts with turn: or turns:)
const hasTurnServer = ICE_SERVERS.some((s) => {
  const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
  return urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:'));
});

export function CallPage() {
  const { callId } = useParams({ strict: false }) as { callId: string };
  const { user } = useAuthStore();
  const { send, on } = useWSStore();
  const navigate = useNavigate();

  const [call, setCall] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [joined, setJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // peerConnections: one RTCPeerConnection per remote participant
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Create or retrieve a peer connection for a given remote user
  const getOrCreatePC = (remoteId: string): RTCPeerConnection => {
    if (pcsRef.current.has(remoteId)) return pcsRef.current.get(remoteId)!;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      // When no TURN servers are configured this has no effect, but once
      // a TURN server is added this enforces relay-only transport.
      iceTransportPolicy: hasTurnServer ? 'relay' : 'all',
    });

    // Attach local tracks to this peer connection
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Forward ICE candidates through server relay (no direct IP exchange)
    pc.onicecandidate = (evt) => {
      if (!evt.candidate) return;
      const candidate = evt.candidate.candidate;
      // Drop host and srflx candidates client-side as extra defence
      if (candidate.includes(' host ') || candidate.includes(' srflx ')) return;
      callsApi.signal({
        call_id: callId,
        target_id: remoteId,
        type: 'ice-candidate',
        data: evt.candidate.toJSON(),
      }).catch(() => {});
    };

    pc.ontrack = (evt) => {
      if (remoteVideoRef.current && evt.streams[0]) {
        remoteVideoRef.current.srcObject = evt.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pcsRef.current.delete(remoteId);
      }
    };

    pcsRef.current.set(remoteId, pc);
    return pc;
  };

  const cleanupPCs = () => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
  };

  useEffect(() => {
    let active = true;

    // Acquire local media (audio + optional video)
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // no echo
        }
      })
      .catch(() => {});

    // Join call on backend
    callsApi.join(callId).then((c) => {
      if (!active) return;
      setCall(c);
      setJoined(true);
      setParticipantCount(c?.participant_count ?? 0);
      send({ type: 'join_call', payload: { call_id: callId } });
    }).catch(() => {});

    return () => {
      active = false;
      send({ type: 'leave_call', payload: { call_id: callId } });
      callsApi.leave(callId).catch(() => {});
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      cleanupPCs();
    };
  }, [callId]);

  // Subscribe to WebRTC signalling messages
  useEffect(() => {
    const unsub = on('webrtc_signal', async (msg) => {
      const { from, type, data } = msg.payload as any;
      if (!from || !type) return;

      const pc = getOrCreatePC(from);

      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data)).catch(() => {});
        const answer = await pc.createAnswer().catch(() => null);
        if (!answer) return;
        await pc.setLocalDescription(answer).catch(() => {});
        callsApi.signal({ call_id: callId, target_id: from, type: 'answer', data: answer }).catch(() => {});
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data)).catch(() => {});
      } else if (type === 'ice-candidate' && data) {
        await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
      }
    });

    const unsubJoined = on('user_joined_call', async (msg) => {
      const { user_id } = msg.payload as any;
      if (!user_id || user_id === user?.id) return;
      setParticipantCount((n) => n + 1);
      // Initiate offer to the newly joined user
      const pc = getOrCreatePC(user_id);
      const offer = await pc.createOffer().catch(() => null);
      if (!offer) return;
      await pc.setLocalDescription(offer).catch(() => {});
      callsApi.signal({ call_id: callId, target_id: user_id, type: 'offer', data: offer }).catch(() => {});
    });

    const unsubLeft = on('user_left_call', (msg) => {
      const { user_id } = msg.payload as any;
      if (user_id) {
        pcsRef.current.get(user_id)?.close();
        pcsRef.current.delete(user_id);
        setParticipantCount((n) => Math.max(0, n - 1));
      }
    });

    const unsubEnded = on('call_ended', () => {
      cleanupPCs();
      navigate({ to: '/app/timeline' });
    });

    return () => { unsub(); unsubJoined(); unsubLeft(); unsubEnded(); };
  }, [callId, user?.id]);

  // Toggle mute
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, [muted]);

  // Toggle video
  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !videoOff; });
  }, [videoOff]);

  const handleLeave = async () => {
    send({ type: 'leave_call', payload: { call_id: callId } });
    await callsApi.leave(callId).catch(() => {});
    cleanupPCs();
    navigate({ to: '/app/timeline' });
  };

  const handleEnd = async () => {
    await callsApi.end(callId).catch(() => {});
    cleanupPCs();
    navigate({ to: '/app/timeline' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
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
          <p className="text-xs text-gray-500 mt-1">
            {participantCount} participant{participantCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Video panels */}
        <div className="w-full flex gap-2">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`flex-1 rounded-xl bg-black/40 aspect-video object-cover ${videoOff ? 'opacity-30' : ''}`}
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="flex-1 rounded-xl bg-black/40 aspect-video object-cover"
          />
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

      <div className="flex items-center gap-2 text-xs text-gray-500 max-w-sm text-center">
        <ShieldCheck size={14} className="text-green-500 shrink-0" />
        <p>
          All signalling passes through the Raider server. Host &amp; public-IP ICE
          candidates are filtered to protect your IP address. For full relay-only
          media, configure a TURN server in the server settings.
        </p>
      </div>
    </div>
  );
}

