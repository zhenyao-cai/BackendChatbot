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
 * @param {Object} database - The initialized Firebase admin
 * @return {Object} io - The initialized Socket.IO instance, with all configurations and
 * event listeners set up.
 */
module.exports = function (server, database) {
    const LobbyManager = require('./Lobby/LobbyManager');
    const ChatBot = require("./ChatBot/ChatBot.js");
    const { formatTimestamp } = require('./utils/utils');
    const socketIo = require('socket.io');

    const io = socketIo(server, {
        cors: {
            origin: "*",                          // replace with list of allowed domains for enhanced security
            methods: ["GET", "POST"],
        }
    });

    const lobbyManager = new LobbyManager();    // initialize a single manager for all lobbies

    // Socket.IO logic -  WITH UPDATED CLASSES
    io.on('connection', (socket) => {
        console.log("url: " + socket.handshake.headers.referer);

        // Create lobby
        socket.on('createLobby', async (username) => {
            const guid = lobbyManager.createLobby(username, socket.id);

            // Join the host to the lobby's socket room immediately
            console.log(io.sockets.adapter.rooms);
            socket.join(guid);
            console.log(io.sockets.adapter.rooms);
            socket.emit('lobbyCreated', guid);
        });

        // Join lobby
        socket.on('joinLobby', async (guid, username) => {
            const isSuccess = lobbyManager.joinLobby(guid, username, socket.id);
            
            if (isSuccess) {
                socket.join(guid);
                socket.emit('joinedLobby', guid);
                io.to(guid).emit('userJoinedLobby', username);
            }
            else {
                socket.emit('lobbyError', 'Error joining lobby');
            }
        });

        // Test broadcast
        socket.on('testBroadcast', () => {
            const testMessage = "This is a test message to all users.";
            io.emit('message', { sender: 'Server', text: testMessage });
            console.log(` > BROADCASTING TEST MESSAGE TO ALL USERS`);
        });

        // Join room **2/26 notes: should Lobby.roomStarted be set to true?
        socket.on('joinRoom', async (guid, username) => {
            console.log(` > Joining Chatroom: ${guid} by user: ${username}`);

            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby && foundLobby.getUser(username)) {
                // let foundUser = foundLobby.getUser(username);
                // foundUser.inChatroom = true;                    // 3/6: added for disconnect logic
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
            //const isSuccess = lobbyManager.lobbyMessage(guid, messageData); // not using lobby Message funtion
            console.log("lobbyMessage");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby) {
                io.to(guid).emit('message', messageData);

                foundLobby.inactivity = false;

                let chatroomRef = database.ref(`chatrooms/${guid}/users/${messageData.sender}/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: messageData.text,
                    timestamp: messageData.timestamp,
                });

                console.log(` > BROADCASTING: ${messageData.text} FROM: ${messageData.sender}; TO: ${foundLobby.users[foundLobby.hostUserame]}`);

                let respond = await foundLobby.chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);

                if (respond) {
                    io.to(guid).emit('message', { sender: foundLobby.chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime())});

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
            const hostName = lobbyManager.getHostName(guid);

            if(hostName) {
                // Sending back an object with the host name
                socket.emit('hostNameResponse', { hostName });
            }
            else {
                // Handle the case where the lobby doesn't exist
                socket.emit('hostNameResponse', { error: 'Lobby not found' });
            }
        });

        socket.on('updateBotSettings', async (guid, lobbyData) => {
            console.log("updateBotSettings");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby) {
                socket.to(guid).emit('chatStarted');
                foundLobby.roomStarted = true;
                foundLobby.chatData = {time: lobbyData.chatLength, chatName: lobbyData.chatName, chatTopic: lobbyData.topic};
    
                if (!foundLobby.botInitialized) {
                    console.log(` > LOBBY STARTED, CODE: ${guid}`);
                    let chatbotInstance = new ChatBot(foundLobby.getAllUsernames(), lobbyData.topic, lobbyData.botname, lobbyData.assertiveness);
                    let isSuccess = chatbotInstance.initializePrompting();
                    // TODO : ERROR HANDLING
    
                    let botPrompt = await chatbotInstance.getInitialQuestion();
    
                    io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
    
                    let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                    let newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        text: botPrompt,
                        timestamp: formatTimestamp(new Date().getTime()),
                    });
        
                    foundLobby.botInitialized = true;
                    foundLobby.chatbot = chatbotInstance;
                    console.log(` > LOBBY STARTED!`);
                }
            }
        });

        // returns a list of users in the lobby
        socket.on('getUserListOfLobby', async (guid) => {
            console.log("getUserListOfLobby");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby && foundLobby.users) {
                // Get all usernames from the 'users' object
                const userList = foundLobby.getAllUsernames();

                // Send back the list of usernames
                socket.emit('userListOfLobbyResponse', { userList });
            } else {
                // Handle the case where the lobby doesn't exist or has no users
                socket.emit('userListOfLobbyResponseError');
            }
         });

         // returns chat data: time, topic, chatroom name
        socket.on('getChatData', async (guid) => {
            console.log("getChatData");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby) {
                io.to(guid).emit('chatData',foundLobby.chatData);
            }

        });


        socket.on('lobbyInactivity', async (guid) => {
            console.log("lobbyInactivity");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby && !foundLobby.inactivity) {
                foundLobby.inactivity = true;
    
                let chatbotInstance = foundLobby.chatbot;
                let inactivityMessage = await chatbotInstance.inactivityResponse();
    
                io.to(guid).emit('message', { text: inactivityMessage, sender: chatbotInstance.botname });
    
                let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: inactivityMessage,
                    timestamp: formatTimestamp(new Date().getTime()),
                });
            }
        });

         // starts chat conclusion, prompts chatbot
        socket.on('chatStartConclusionPhase', async (guid, timeLeft) => {
            console.log("chatStartConclusionPhase");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby && foundLobby.botInitialized 
                && foundLobby.conclusionStarted) {

                foundLobby.conclusionStarted = true;
                let chatbotInstance = foundLobby.chatbot;
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
            console.log("leaveLobby");
            const foundLobby = lobbyManager.getLobby(guid);

            if (foundLobby && (username in foundLobby.users)) {
                foundLobby.removeUser(username);
                socket.leave(guid);
                socket.emit('leftLobby', guid);
                io.to(guid).emit('userLeftLobby', username);

                if (Object.keys(foundLobby.users).length === 0) {
                    const isSuccess = lobbyManager.removeLobby(guid); // Delete the lobby if empty
                    // can add additional code for error check
                }
            }
        });

        // Disconnect logic
        // 3/6: modified to remove user from lobby when user is disconnected from chatroom
        socket.on('disconnect', async(reason) => {
            console.log(`User ${socket.id} disconnected because of ${reason}`);
            
            // only matters when user disconnects from chatroom, must know when it was a chatroom

            // Object.entries(lobbyManager.lobbies).forEach(([guid, lobby]) => {
            //      Object.entries(lobby.users).forEach(([username, user]) => {
            //          if (user.socketId === socket.id && user.inChatroom === true) { // 3/6: Found user AND user was in a chatroom
            //              lobby.removeUser(username); // Remove the user from the lobby
            //              console.log("diconnecting " +  username);
            //              io.to(guid).emit('userLeftLobby', username); // Notify other users in the lobby
        
            //              // If the lobby is now empty, consider deleting it
            //              if (Object.keys(lobby.users).length === 0) {
            //                  lobbyManager.removeLobby(guid); // Delete the lobby if empty
            //              }
            //          }
            //      });
            //  });     
        });

    });

    return io;
};