const LobbyManager = require('./Lobby/LobbyManager');
const ChatBot = require("./ChatBot/ChatBot.js");
const { formatTimestamp } = require('./utils/utils');
const socketIo = require('socket.io');

module.exports = function (server, database) {
    const io = socketIo(server, {
        cors: {
            origin: "*",                          // replace with list of allowed domains for enhanced security
            methods: ["GET", "POST"],
        }
    });

    const lobbyManager = new LobbyManager();    // initialize a single manager for all lobbies

    // Socket.IO logic -  WITH UPDATED CLASSES
    io.on('connection', (socket) => {
        socket.on('createLobby', async (username) => {
            const guid = lobbyManager.createLobby(username, socket.id);
            socket.join(guid);
            socket.emit('lobbyCreated', guid);
        });

        // Join lobby: user joins main classroom server room
        socket.on('joinLobby', async (guid, username) => {
            const isSuccess = lobbyManager.joinLobby(guid, username);

            if (isSuccess) {
                socket.join(guid);
                socket.emit('joinedLobby', guid);
                io.to(guid).emit('userJoinedLobby', username);
            } else {
                socket.emit('lobbyError', 'Error joining lobby');
            }
        });

        socket.on('joinRoom', async (guid, username) => {
            console.log(` > Joining Chatroom: ${guid} by user: ${username}`);
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby && foundLobby.getUser(username)) {
                socket.join(guid);
                socket.emit('joinedChatroom', guid);
            } else {
                socket.emit('chatroomError', 'Error joining room.');
            }
            else {
                socket.emit('createChatroomsResponse', totalChatrooms); // respond to client, send total chatrooms made
            }

            // HOST DOES NOT JOIN NEW CHATROOMS YET
        });

        // Users in one classroom lobby will join their preassigned chatroom
        socket.on('joinChatroom', async (lobbyGuid, username) => {
            const foundLobby = lobbyManager.getLobby(lobbyGuid);
            const roomIndex = foundLobby.getUserIndex(username);

            if (foundLobby && roomIndex > -1) {
                const chatGuid = foundLobby.chatroomGuids[roomIndex]; // fetch the correct assignement of user to chatroom GUID
                socket.join(chatGuid);
                socket.emit('joinedChatroom', chatGuid);
                io.to(chatGuid).emit('userJoinedChatroom', username);
            } else {
                socket.emit('chatroomError', 'Error joining chatroom');
            }
        });

        // FUTURE IMPLEMENTATION Host must join any lobby, must leeve lobby and back to monitor page?
        socket.on('hostJoinChatroom', (lobbyGuid, chatGuid) => {
            const foundLobby = lobbyManager.getLobby(lobbyGuid);
            const foundChatroom = foundLobby.getChatroom(chatGuid);

            // IMPLEMENT JOIN CHATROOM IN LOBBY.JS
            // JOIN host socket to chatroom
        });

        // FOR DEMO: retrieving one classroom code, demo does not require users to enter code.
        socket.on('getLobbyCode', () => {
            console.log("DEMO VERSION returning single classroom GUID");
            const guid = lobbyManager.getFirstLobbyGUID();
            socket.emit('getLobbyCodeResponse', guid);
        });

        // Update socket.username MAY NOT NEED IF 'joinChatroom' WORKS
        socket.on('clientUrlUpdate', (urlData) => {
            console.log('Received URL data from client:', urlData);

            socket.username = "New Name"; // PLACEHOLDER
            // Use urlData.pathname, urlData.search
        });

        socket.on('lobbyMessage', async (guid, messageData) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby) {
                io.to(guid).emit('message', messageData);
                foundLobby.inactivity = false;

                let chatroomRef = database.ref(`chatrooms/${guid}/users/${messageData.sender}/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: messageData.text,
                    timestamp: messageData.timestamp,
                }, (error) => {
                    if (error) {
                        console.error('Error writing message to Firebase:', error);
                        socket.emit('databaseError', 'Error writing message to database');
                    } else {
                        console.log(` > Message written to database: ${messageData.text}`);
                    }
                });

                let respond = await foundLobby.chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);
                if (respond) {
                    io.to(guid).emit('message', { sender: foundLobby.chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime()) });

                    chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                    newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        text: respond,
                        timestamp: messageData.timestamp,
                    }, (error) => {
                        if (error) {
                            console.error('Error writing bot message to Firebase:', error);
                        } else {
                            console.log(` > Bot message written to database: ${respond}`);
                        }
                    });
                }
            }
        });

        socket.on('getHostName', async (guid) => {
            const hostName = lobbyManager.getHostName(guid);
            if (hostName) {
                socket.emit('hostNameResponse', { hostName });
            } else {
                socket.emit('hostNameResponse', { error: 'Lobby not found' });
            }
        });

        socket.on('updateBotSettings', async (guid, lobbyData) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby) {
                foundLobby.setTime(lobbyData.chatLength);
                foundLobby.startTimer(io, guid);

                socket.to(guid).emit('chatStarted');
                foundLobby.roomStarted = true;
                foundLobby.chatData = { time: lobbyData.chatLength, chatName: lobbyData.chatName, chatTopic: lobbyData.topic };

                if (!foundLobby.botInitialized) {
                    console.log(` > LOBBY STARTED, CODE: ${guid}`);
                    let chatbotInstance = new ChatBot(foundLobby.getAllUsers(), lobbyData.topic, lobbyData.botname, lobbyData.assertiveness);
                    let isSuccess = chatbotInstance.initializePrompting();
                    // TODO: Error handling

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

                    io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
                }
            }
        });

        socket.on('getUserListOfLobby', async (guid) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby && foundLobby.users) {
                const userList = foundLobby.getAllUsers();
                socket.emit('userListOfLobbyResponse', { userList });
            } else {
                socket.emit('userListOfLobbyResponseError');
            }
        });

        socket.on('getChatData', async (guid) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby) {
                io.to(guid).emit('chatData', foundLobby.chatData);
            }
        });

        socket.on('lobbyInactivity', async (guid) => {
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

        socket.on('chatStartConclusionPhase', async (guid, timeLeft) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby && foundLobby.botInitialized && !foundLobby.conclusionStarted) {
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

        socket.on('leaveLobby', (guid, username) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby && (username in foundLobby.users)) {
                foundLobby.removeUser(username);
                socket.leave(guid);
                socket.emit('leftLobby', guid);
                io.to(guid).emit('userLeftLobby', username);
                if (Object.keys(foundLobby.users).length === 0) {
                    lobbyManager.removeLobby(guid); // Delete the lobby if empty
                }
            }
        });

        socket.on('disconnect', async (reason) => {
            console.log(`User ${socket.id} disconnected because of ${reason}`);
            // Implement logic to handle user disconnection from lobbies
        });
    });

    return io;
};
