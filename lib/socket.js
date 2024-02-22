/**
 * Initializes and configures Socket.IO for the server. This setup includes
 * the necessary CORS configuration to allow connections from any domain (note: for
 * production, it's recommended to specify allowed domains to enhance security).
 * 
 * The function sets up the main Socket.IO logic, including event listeners for client
 * connections and other Socket.IO events. It's structured to allow easy addition of 
 * more event listeners and to modularize the real-time communication logic.
 * 
 * @param {Object} server - The HTTP or HTTPS server to attach Socket.IO to.
 * @return {Object} io - The initialized Socket.IO instance, with all configurations and
 * event listeners set up.
 */
module.exports = function (server) {
    const LobbyManager = require('./Lobby/LobbyManager');
    const socketIo = require('socket.io');
    const io = socketIo(server, {
        cors: {
            origin: "*",                         // replace with list of allowed domains for enhanced security
            methods: ["GET", "POST"],
        }
    });

    const lobbyManager = new LobbyManager(io);    // initialize a single manager for all lobbies

    // Socket.IO logic -  TO BE CHANGED WITH UPDATED CLASSES
    io.on('connection', (socket) => {
        // Create lobby
        socket.on('createLobby', async (username) => {
            const guid = lobbyManager.createLobby(username, socket.id, io);
            console.log("Lobby created with GUID:", guid);
        });

        // Join lobby
        socket.on('joinLobby', async (guid, username) => {
            console.log(` > Request to join: ${guid} by user: ${username}`);
            console.log("Existing lobbies: " + lobbyManager.getAllLobbyGUIDs());

            const success = lobbyManager.joinLobby(guid, username, socket.id, io);
            if (success) {
                socket.emit('joinedLobby', guid);
            } else {
                socket.emit('lobbyError', 'Error joining lobby');
            }
        });

        // Test broadcast
        socket.on('testBroadcast', () => {
            const testMessage = "This is a test message to all users.";
            io.emit('message', { sender: 'Server', text: testMessage });
            console.log(` > BROADCASTING TEST MESSAGE TO ALL USERS`);
        });

        // Join room
        socket.on('joinRoom', async (guid, username) => {
            console.log(` > Joining Chatroom: ${guid} by user: ${username}`);
    
            if (lobbies[guid] && lobbies[guid].users[username]) {
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
            const success = lobbyManager.lobbyMessage(guid, messageData);



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

    });

    return io;
};