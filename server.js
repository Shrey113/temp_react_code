const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins; adjust for production
  }
});
const users = new Map(); // Store users by socket ID
// Simple route for server health check
app.get('/', (req, res) => {
  res.send('Server is running');
});


io.on('connection', (socket) => {
    socket.on('registerUser', (email) => {
      users.set(socket.id, email);
      io.emit('updateUserList', Array.from(users.values()));
    });
  
    socket.on('disconnect', () => {
      users.delete(socket.id);
      io.emit('updateUserList', Array.from(users.values()));
    });
  
    socket.on('callUser', ({ to, from, offer }) => {
      const recipientSocketId = Array.from(users.keys()).find(id => users.get(id) === to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('incomingCall', { from });
        io.to(recipientSocketId).emit('offer', { from, offer });
      }
    });
  
    socket.on('answer', ({ to, answer }) => {
      const callerSocketId = Array.from(users.keys()).find(id => users.get(id) === to);
      if (callerSocketId) {
        io.to(callerSocketId).emit('answer', { answer });
      }
    });
  
    socket.on('iceCandidate', ({ to, candidate }) => {
      const recipientSocketId = Array.from(users.keys()).find(id => users.get(id) === to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('iceCandidate', { candidate });
      }
    });

    
  });

  const os = require('os');
  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const net of interfaces[interfaceName]) {
            // Check if the interface is an IPv4 address and is not a loopback
            if (net.family === 'IPv4' && !net.internal) {
                return net.address
            }
        }
    }
  }


const PORT = 4000;
const HOST = '0.0.0.0';
server.listen(PORT,HOST, () => {
  console.log(`\nServer running at \n`);
  console.log(`\tLocal:            http://localhost:${PORT}`);
  console.log(`\tOn Your Network:  http://${getLocalIP()}:${PORT}\n`);
});
