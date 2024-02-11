const express = require('express');
const http = require('http');
// MODULAR const socketIo = require('socket.io'); lib/socket.js
const { OpenAI } = require("openai");
const ChatBot = require("./chatbot/chatbot.js");
const admin = require('firebase-admin');

// Initialize the express application
const app = express();

// Create a local HTTP server
const server = http.createServer(app);

// MODULAR Initialize socket.io
/* const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
}); */

// Initialize Firebase Admin SDK 
const serviceAccount = require('./database.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ai-chatbot-65272-default-rtdb.firebaseio.com"
});

const database = admin.database();

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const options = {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    };

    return date.toLocaleString('en-US', options);
}


// Lobby management
const lobbies = {};

// Function to generate a unique 4-character GUID
// We can modify this to be whatever we want.
function generateGUID() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Socket.io logic
io.on('connection', (socket) => {
    // Lobby creation
    socket.on('createLobby', async (username) => {
        const guid = generateGUID(); // generate in createlobby
        
        console.log("Guid: ", guid);
        console.log(io.sockets.adapter.rooms);
        socket.join(guid);
        console.log(io.sockets.adapter.rooms);

        const roomExists = io.sockets.adapter.rooms.has(guid);
        console.log(roomExists);

        lobbies[guid] = { users: {}, roomStarted: false, botInitialized: false, hostUserame: username, chatbot: null, chatData: null, conclusionStarted: false, inactivity: false };

        lobbies[guid].users[username] = 0;
        socket.emit('lobbyCreated', guid);
    });

    socket.on('testBroadcast', () => {
        const testMessage = "This is a test message to all users.";
        io.emit('message', { sender: 'Server', text: testMessage });
        console.log(` > BROADCASTING TEST MESSAGE TO ALL USERS`);
    });

    // Joining a lobby
    socket.on('joinLobby', async (guid, username) => {
        console.log(` > Request to join: ${guid} by user: ${username}`);
        // console.log(lobbies);
        if (lobbies[guid] && !lobbies[guid].users[username]) {
            socket.join(guid);
            lobbies[guid].users[username] = 0;
            socket.emit('joinedLobby', guid);

            io.to(guid).emit('userJoinedLobby', username);
        } else {
            socket.emit('lobbyError', 'Error joining lobby');
        }
    });

    socket.on('joinRoom', async (guid, username) => {
        console.log(` > Joining Chatroom: ${guid} by user: ${username}`);

        if (lobbies[guid] && lobbies[guid].users[username] == 0) {
            socket.join(guid);
            socket.emit('joinedChatroom', guid);
        } else {
            socket.emit('chatroomError', 'Error joining room.');
        }
    });

    // Sending messages within a lobby
    // this is the primary change to make lobbies work, we use
    // .to(guid) to point the message at the correct chatroom.
    // be sure to do the same with the chatbot messages so they
    // end up in the correct room.
    socket.on('lobbyMessage', async (guid, messageData) => {
        if (lobbies[guid]) {
            io.to(guid).emit('message', messageData);

            lobbies[guid].inactivity = false;

            let chatroomRef = database.ref(`chatrooms/${guid}/users/${messageData.sender}/messages`);
            let newMessageRef = chatroomRef.push();
            newMessageRef.set({
                text: messageData.text,
                timestamp: messageData.timestamp,
            });

            console.log(` > BROADCASTING: ${messageData.text} FROM: ${messageData.sender}; TO: ${lobbies[guid].users[lobbies[guid].hostUserame]}`);

            let respond = await lobbies[guid].chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);

            if (respond) {
                io.to(guid).emit('message', { sender: lobbies[guid].chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime())});

                chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: respond,
                    timestamp: messageData.timestamp,
                });
            }
        }
    });

    // pass in a lobbyID, and get back the host name of the lobby
    socket.on('getHostName', async (guid) => {
        if (lobbies[guid]) {
            const hostName = lobbies[guid].hostUsername;
            // Sending back an object with the host name
            socket.emit('hostNameResponse', { hostName });
        } else {
            // Handle the case where the lobby doesn't exist
            socket.emit('hostNameResponse', { error: 'Lobby not found' });
        }
    });

    socket.on('updateBotSettings', async (guid, lobbyData) => {
        if (lobbies[guid]) {
            socket.to(guid).emit('chatStarted');
            lobbies[guid].roomStarted = true;
            lobbies[guid].chatData = {time: lobbyData.chatLength, chatName: lobbyData.chatName, chatTopic: lobbyData.topic};

            if (!lobbies[guid].botInitialized) {
                console.log(` > LOBBY STARTED, CODE: ${guid}`);

                let chatbotInstance = new ChatBot(Object.keys(lobbies[guid].users), lobbyData.topic, lobbyData.botname, lobbyData.assertiveness);
                let success = await chatbotInstance.initializePrompting();
                // TODO : ERROR HANDLING

                let botPrompt = await chatbotInstance.getInitialQuestion();

                io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });

                let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: botPrompt,
                    timestamp: formatTimestamp(new Date().getTime()),
                });
    
                lobbies[guid].botInitialized = true;

                lobbies[guid].chatbot = chatbotInstance;
                console.log(` > LOBBY STARTED!`);
            }
        }
    });

    // returns a list of users in the lobby
    socket.on('getUserListOfLobby', async (guid) => {
        if (lobbies[guid] && lobbies[guid].users) {
            // Get all usernames from the 'users' object
            const userList = Object.keys(lobbies[guid].users);

            // Send back the list of usernames
            socket.emit('userListOfLobbyResponse', { userList });
        } else {
            // Handle the case where the lobby doesn't exist or has no users
            socket.emit('userListOfLobbyResponseError');
        }
    });

    // returns chat data: time, topic, chatroom name
    socket.on('getChatData', async (guid) => {
        if (lobbies[guid]) {
            io.to(guid).emit('chatData', lobbies[guid].chatData);
        }
    });

    socket.on('lobbyInactivity', async (guid) => {
        if (lobbies[guid] && !lobbies[guid].inactivity) {
            lobbies[guid].inactivity = true;

            let chatbotInstance = lobbies[guid].chatbot;

            let inactivityMessage = await chatbotInstance.inactivityResponse();

            io.to(guid).emit('message', { text: inactivityMessage, sender: chatbotInstance.botname });

            let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
            let newMessageRef = chatroomRef.push();
            newMessageRef.set({
                text: inactivityMessage,
                timestamp: formatTimestamp(new Date().getTime()),
            });
        }
    })

    // starts chat conclusion, prompts chatbot
    socket.on('chatStartConclusionPhase', async (guid, timeLeft) => {
        if (lobbies[guid] && lobbies[guid].botInitialized && !lobbies[guid].conclusionStarted) {
            lobbies[guid].conclusionStarted = true;
            let chatbotInstance = lobbies[guid].chatbot;
            let conclusionMessage = await chatbotInstance.startConclusion(timeLeft);

            io.to(guid).emit('message', { text: conclusionMessage, sender: chatbotInstance.botname });

            let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
            let newMessageRef = chatroomRef.push();
            newMessageRef.set({
                text: conclusionMessage,
                timestamp: formatTimestamp(new Date().getTime()),
            });
        }
    });

    // Leaving a lobby
    socket.on('leaveLobby', (guid, username) => {
        if (lobbies[guid] && (username in lobbies[guid].users)) {
            socket.leave(guid);
            delete lobbies[guid].users[username];
            if (Object.keys(lobbies[guid].users).length === 0) {
                delete lobbies[guid]; // Delete the lobby if empty
            }
            socket.emit('leftLobby', guid);
            io.to(guid).emit('userLeftLobby', username);
        }
    });

    // Disconnect logic
    socket.on('disconnect', () => {
        // Iterate through all lobbies to remove the disconnected user
        for (const guid in lobbies) {
            if (lobbies[guid].users[socket.username]) {
                delete lobbies[guid].users[socket.username];
                if (Object.keys(lobbies[guid].users).length === 0) {
                    delete lobbies[guid]; // Delete the lobby if empty
                }
                io.to(guid).emit('userLeftLobby', socket.username);
            }
        }
    });
});

// Start the server
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Listening on port ${port}`));