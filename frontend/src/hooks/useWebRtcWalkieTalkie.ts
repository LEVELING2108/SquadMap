'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRtcSignal } from '../types/squad';

interface UseWebRtcWalkieTalkieProps {
  sessionCode: string;
  userId: string;
  displayName: string;
  onSendSignal: (type: WebRtcSignal['type'], targetId?: string | null, payload?: any) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRtcWalkieTalkie({
  sessionCode,
  userId,
  displayName,
  onSendSignal,
}: UseWebRtcWalkieTalkieProps) {
  const [isMicReady, setIsMicReady] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<{ id: string; name: string } | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const onSendSignalRef = useRef(onSendSignal);
  onSendSignalRef.current = onSendSignal;

  // Initialize microphone stream
  const enableMicrophone = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported in this browser environment');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Default to muted until PTT is held
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      setIsMicReady(true);
      setIsMuted(true);

      // Announce ready in voice channel
      onSendSignalRef.current('join', null, { ready: true });
      return true;
    } catch (err: any) {
      console.warn('Microphone permission denied or unavailable:', err.message);
      return false;
    }
  }, []);

  // Setup peer connection for another member
  const getOrCreatePeerConnection = useCallback(
    (peerId: string) => {
      let pc = peerConnectionsRef.current.get(peerId);
      if (pc) return pc;

      pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local audio tracks if ready
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc!.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onSendSignalRef.current('candidate', peerId, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        remoteAudio.play().catch((e) => console.debug('Audio autoplay error:', e));
      };

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    },
    []
  );

  // Handle incoming STOMP signaling messages
  const handleIncomingSignal = useCallback(
    async (signal: WebRtcSignal) => {
      if (signal.senderId === userId) return;

      switch (signal.type) {
        case 'talking-start':
          setActiveSpeaker({ id: signal.senderId, name: signal.senderName });
          break;

        case 'talking-stop':
          setActiveSpeaker((curr) => (curr?.id === signal.senderId ? null : curr));
          break;

        case 'join': {
          // If we have mic, send offer to newcomer
          if (localStreamRef.current) {
            const pc = getOrCreatePeerConnection(signal.senderId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            onSendSignalRef.current('offer', signal.senderId, offer);
          }
          break;
        }

        case 'offer': {
          if (signal.targetId && signal.targetId !== userId) return;
          const pc = getOrCreatePeerConnection(signal.senderId);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onSendSignalRef.current('answer', signal.senderId, answer);
          break;
        }

        case 'answer': {
          if (signal.targetId && signal.targetId !== userId) return;
          const pc = peerConnectionsRef.current.get(signal.senderId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          }
          break;
        }

        case 'candidate': {
          if (signal.targetId && signal.targetId !== userId) return;
          const pc = peerConnectionsRef.current.get(signal.senderId);
          if (pc && signal.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
          }
          break;
        }

        case 'leave': {
          const pc = peerConnectionsRef.current.get(signal.senderId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(signal.senderId);
          }
          setActiveSpeaker((curr) => (curr?.id === signal.senderId ? null : curr));
          break;
        }
      }
    },
    [userId, getOrCreatePeerConnection]
  );

  // Push-To-Talk: Start Speaking
  const startTalking = useCallback(async () => {
    if (!localStreamRef.current) {
      const ok = await enableMicrophone();
      if (!ok) return;
    }

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    setIsTalking(true);
    setIsMuted(false);
    onSendSignalRef.current('talking-start', null, null);
  }, [enableMicrophone]);

  // Push-To-Talk: Stop Speaking
  const stopTalking = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    setIsTalking(false);
    setIsMuted(true);
    onSendSignalRef.current('talking-stop', null, null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      onSendSignalRef.current('leave', null, null);
    };
  }, []);

  return {
    isMicReady,
    isTalking,
    isMuted,
    activeSpeaker,
    enableMicrophone,
    startTalking,
    stopTalking,
    handleIncomingSignal,
  };
}
