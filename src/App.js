import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://temp-server-jdzm.onrender.com'); // Update this with your server URL

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false); // Track initiator status
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

  useEffect(() => {
    socket.on('offer', handleReceiveOffer);
    socket.on('answer', handleReceiveAnswer);
    socket.on('ice-candidate', handleNewICECandidate);

    return () => {
      socket.off('offer', handleReceiveOffer);
      socket.off('answer', handleReceiveAnswer);
      socket.off('ice-candidate', handleNewICECandidate);
    };
  }, []);

  const handleReceiveOffer = async (offer) => {
    if (!peerConnectionRef.current) {
      const peerConnection = createPeerConnection();
      peerConnectionRef.current = peerConnection;
    }

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socket.emit('answer', answer);
  };

  const handleReceiveAnswer = async (answer) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleNewICECandidate = (candidate) => {
    peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection({ iceServers });
    
    // Listen for remote tracks
    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    // Handle negotiationneeded (especially for the initiator)
    peerConnection.onnegotiationneeded = async () => {
      try {
        if (isInitiator) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit('offer', offer);
        }
      } catch (error) {
        console.error('Error in onnegotiationneeded:', error);
      }
    };

    return peerConnection;
  };

  const startCall = async () => {
    setIsCallActive(true);

    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localAudioRef.current.srcObject = localStream;
    localStreamRef.current = localStream;

    const peerConnection = createPeerConnection();
    peerConnectionRef.current = peerConnection;

    // Add local audio track to peer connection
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    // Set initiator status if no offer is received within 500ms
    setTimeout(async () => {
      if (!isInitiator && !peerConnectionRef.current.remoteDescription) {
        setIsInitiator(true);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer);
      }
    }, 500);
  };

  const endCall = () => {
    setIsCallActive(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    setIsInitiator(false); // Reset initiator status
  };

  return (
    <div>
      <h1>React Voice Call with WebRTC and Socket.io</h1>
      {!isCallActive ? (
        <button onClick={startCall}>Start Call</button>
      ) : (
        <button onClick={endCall}>End Call</button>
      )}
      <div>
        <audio ref={localAudioRef} autoPlay muted></audio>
        <audio ref={remoteAudioRef} autoPlay></audio>
      </div>
    </div>
  );
}

export default App;
