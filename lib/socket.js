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

        socket.on('joinLobby', async (guid, username) => {
            const isSuccess = lobbyManager.joinLobby(guid, username, socket.id);
            
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
        });

        socket.on('lobbyMessage', async (guid, messageData) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby) {
                io.to(guid).emit('message', messageData);
                foundLobby.inactivity = false;

                // Save message to database
                let chatroomRef = database.ref(`chatrooms/${guid}/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    sender: messageData.sender,
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

                // Handle bot response and save bot message to database
                let respond = await foundLobby.chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);
                if (respond) {
                    const botMessageData = {
                        sender: foundLobby.chatbot.botname,
                        text: respond,
                        timestamp: formatTimestamp(new Date().getTime()),
                    };
                    io.to(guid).emit('message', botMessageData);

                    newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        sender: botMessageData.sender,
                        text: botMessageData.text,
                        timestamp: botMessageData.timestamp,
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

        // Add the getChatHistory event listener
        socket.on('getChatHistory', async (guid) => {
            try {
                const chatroomRef = database.ref(`chatrooms/${guid}/messages`);
                const snapshot = await chatroomRef.once('value');
                const messages = snapshot.val();

                if (messages) {
                    const messageList = Object.values(messages);
                    // Sort messages by timestamp
                    messageList.sort((a, b) => a.timestamp - b.timestamp);
                    console.log(messageList);
                    socket.emit('chatHistory', messageList);
                } else {
                    socket.emit('chatHistory', []);
                }
            } catch (error) {
                console.error('Error retrieving chat history:', error);
                socket.emit('databaseError', 'Error retrieving chat history');
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
        
                    let initialQuestion = chatbotInstance.getInitialQuestion(); // Assuming this returns an array of initial messages
    
                    for (let i = 0; i < initialQuestion.length; i++) {
                        const botPrompt = initialQuestion[i];
                        io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
        
                        let chatroomRef = database.ref(`chatrooms/${guid}/messages`);
                        let newMessageRef = chatroomRef.push();
                        newMessageRef.set({
                            sender: chatbotInstance.botname,
                            text: botPrompt,
                            timestamp: formatTimestamp(new Date().getTime()),
                        });
                    }
        
                    foundLobby.botInitialized = true;
                    foundLobby.chatbot = chatbotInstance;
                    console.log(` > LOBBY STARTED!`);
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

                let chatroomRef = database.ref(`chatrooms/${guid}/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    sender: chatbotInstance.botname,
                    text: inactivityMessage,
                    timestamp: formatTimestamp(new Date().getTime()),
                });
            }
        });

        socket.on('chatStartConclusionPhase', async (guid, timeLeft) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby && foundLobby.botInitialized && !foundLobby.conclusionStarted) {
                foundLobby.conclusionStarted = true;
                console.log("conclusion phase!");
                let chatbotInstance = foundLobby.chatbot;
                let conclusionMessage = await chatbotInstance.startConclusion(timeLeft);
                io.to(guid).emit('message', { text: conclusionMessage, sender: chatbotInstance.botname });

                let chatroomRef = database.ref(`chatrooms/${guid}/messages`);
                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    sender: chatbotInstance.botname,
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
