import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000'); // Adjust for your server URL

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  
  useEffect(() => {
    // Set up socket listeners for offer, answer, and ICE candidates
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
    const peerConnection = createPeerConnection();
    peerConnectionRef.current = peerConnection;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
  };

  const handleReceiveAnswer = async (answer) => {
    const peerConnection = peerConnectionRef.current;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleNewICECandidate = (candidate) => {
    const peerConnection = peerConnectionRef.current;
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.ontrack = (event) => {
      remoteAudioRef.current.srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
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

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
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
