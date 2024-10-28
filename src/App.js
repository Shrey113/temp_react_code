import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://temp-server-ple8.onrender.com/');

const stunConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const App = () => {
  const [userEmail, setUserEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteAudio, setRemoteAudio] = useState(null); // Track the remote audio element

  useEffect(() => {
    const getUserMediaPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please allow audio access to use this feature.');
      }
    };

    getUserMediaPermissions();

    if (emailSubmitted) {
      socket.emit('registerUser', userEmail);
    }
  }, [userEmail, emailSubmitted]);

  useEffect(() => {
    if (emailSubmitted) {
      socket.emit('registerUser', userEmail);
    }

    socket.on('updateUserList', (users) => {
      setAvailableUsers(users.filter(email => email !== userEmail));
    });

    socket.on('incomingCall', ({ from }) => {
      setIncomingCall(from);
    });

    socket.on('offer', async ({ from, offer }) => {
      if (!peerConnection) {
        const pc = new RTCPeerConnection(stunConfig);
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('iceCandidate', { to: from, candidate: event.candidate });
          }
        };
        pc.ontrack = (event) => {
          const audio = new Audio();
          audio.srcObject = event.streams[0];
          audio.play();
          setRemoteAudio(audio);
        };

        setPeerConnection(pc);

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { to: from, answer });
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    socket.on('answer', async ({ answer }) => {
      if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error setting remote description for answer:', error);
        }
      }
    });

    socket.on('iceCandidate', async ({ candidate }) => {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off('updateUserList');
      socket.off('incomingCall');
      socket.off('offer');
      socket.off('answer');
      socket.off('iceCandidate');
    };
  }, [peerConnection, userEmail, emailSubmitted]);

  const submitEmail = () => {
    if (userEmail) {
      setEmailSubmitted(true);
    }
  };

  const callUser = async (callEmail) => {
    const pc = new RTCPeerConnection(stunConfig);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', { to: callEmail, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
      setRemoteAudio(audio);
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        setLocalStream(stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('callUser', { to: callEmail, from: userEmail, offer });

        setPeerConnection(pc);
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    } else {
      console.error("getUserMedia is not supported on this browser.");
    }
  };

  const pickCall = async () => {
    if (!peerConnection) return;
    setIncomingCall(null);
  };

  const endCall = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      setRemoteAudio(null);
    }
    setIncomingCall(null);
  };

  return (
    <div>
      {!emailSubmitted ? (
        <div>
          <input
            type="text"
            placeholder="Enter your email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <button onClick={submitEmail}>Submit</button>
        </div>
      ) : (
        <div>
          <h3>Available Users</h3>
          <ul>
            {availableUsers.map((email) => (
              <li key={email}>
                {email}
                <button onClick={() => callUser(email)}>Call</button>
              </li>
            ))}
          </ul>
          {incomingCall && (
            <div>
              <p>Incoming call from: {incomingCall}</p>
              <button onClick={pickCall}>Pick up</button>
              <button onClick={endCall}>End</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
