const io = require("socket.io-client");

function simulateUser(userToken, room) {
    const socket = io("http://localhost:3000", {
        auth: {
            token: userToken
        }
    });

    socket.on('connect', () => {
        console.log(`${userToken} connected`);
        socket.emit('joinRoom', room);
    });

    socket.on('message', (msg) => {
        console.log(`${userToken} received message: ${msg}`);
    });

    // You can define more events based on your application needs
}

// Simulate multiple users
simulateUser('user1Token', 'room1');
simulateUser('user2Token', 'room1');
simulateUser('user3Token', 'room2');