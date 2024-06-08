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
        console.log(`User ${socket.id} connected`);

        // Create lobby: creates the main classroom's server room
        socket.on('createLobby', async (username) => {
            const guid = lobbyManager.createLobby(username, socket.id);
            socket.join(guid);
            socket.emit('lobbyCreated', guid);
        });

        socket.on('joinLobby', async (guid, username) => {
            const isSuccess = lobbyManager.joinLobby(guid, username);

            if (isSuccess) {
                // Must store student sockets to join chatrooms later
                const foundLobby = lobbyManager.getLobby(guid);
                const foundUser = foundLobby.getUser(username);
                foundUser.socketId = socket.id;

                socket.join(guid);
                socket.emit('joinedLobby', guid);
                io.to(guid).emit('userJoinedLobby', username);
            } else {
                socket.emit('lobbyError', 'Error joining lobby');
            }
        });

        // Test broadcast: usable when chat page is open
        socket.on('testBroadcast', () => {
            const testMessage = "This is a test message to all users.";
            io.emit('message', { sender: 'Server', text: testMessage });
            console.log(` > BROADCASTING TEST MESSAGE TO ALL USERS`);
        });

        // Create Chatrooms: separates list of users to join separate chatrooms
        /* HOST does not join chatrooms yet*/
        socket.on('createChatrooms', async (guid) => {
            console.log("Creating Chatrooms.");

            // Fetch classroom GUID
            const foundLobby = lobbyManager.getLobby(guid);
            if (!foundLobby) {
                console.log("Lobby not found.");
                return;
            }

            const totalChatrooms = foundLobby.createChatrooms();

            if (totalChatrooms === 0){
                console.log("No chatrooms created.");
                socket.emit('chatroomError', 'Error creating chatrooms.');
                return;
            }
            // Continue with joining stored user sockets (NOT HOST SOCKET)
            let users = foundLobby.users;
            for (const username in users) {
                const user = users[username]; // Use the key from the for loop to access the User object
                const foundSocket = user.socketId;
                const foundGUID = user.assignedGUID;

                if (foundSocket !== -1){
                    const socketObject = io.sockets.sockets.get(foundSocket);

                    if (socketObject) {
                        socketObject.join(foundGUID);
                        socketObject.emit('joinedChatroom', foundGUID);
                        io.to(foundGUID).emit('userJoinedChatroom', username);
                        console.log(`${username} has joined room ${foundGUID}`);                                
                    } else {
                        // Handle error: the socket ID is not valid or the socket is not connected
                        console.error("Socket not found or is not connected.");
                    }
                } else {
                        foundSocket.emit('chatroomError', 'Error joining chatroom');
                }
            }

            let chatroomUserMap = {};

            // Iterate over each chatroom by their GUID
            for (const [guid, chatroom] of Object.entries(foundLobby.chatrooms)) {
                // Assign the list of usernames to the GUID key in the new object
                chatroomUserMap[guid] = chatroom.usernameList;
            }
            // Now, chatroomUserMap is an object where each key is a chatroom GUID
            // and each value is the corresponding list of usernames in that chatroom
            // Sending the response to the frontend
            socket.emit('createChatroomsResponse', chatroomUserMap);
            //socket.emit('createChatroomsResponse', totalChatrooms); // respond to client, send total chatrooms made
            console.log("createChatrooms success, initializing bots...");
                
            // socket.to(guid).emit('chatStarted');   // NOT NEEDED, updated response is 'joinedChatroom'
            foundLobby.roomStarted = true;             // SINGLE LOBBY VALUE, not in all chatroom objects

            let chatrooms = foundLobby.chatrooms;       // Apply settings to all chatrooms
            let settings = foundLobby.lobbySettings;
          
            foundLobby.setTime(settings.chatLength); // lobby TIMER functions apply to classroom
            foundLobby.startTimer(io, guid);
          
            for (const chatroom in chatrooms) {
                const chat = chatrooms[chatroom]; // Use the key from the for loop to access the Chatroom object
                //chat.chatSettings = foundLobby.lobbySettings;
                if (!chat.botInitialized) {
                    console.log(` > Starting chatroom, CODE: ${chatroom}`); // chatroom contains chatroom code
                    let chatbotInstance = new ChatBot(
                          chat.usernameList, settings.topic, 
                          settings.botName, settings.assertiveness
                        );
                    let isSuccess = chatbotInstance.initializePrompting();
                    if (isSuccess){
                        let botPrompt = await chatbotInstance.getInitialQuestion();
                    
                        io.to(chatroom).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
    
                        let chatroomRef = database.ref(`chatrooms/${chatroom}/users/BOT/messages`);
                        let newMessageRef = chatroomRef.push();
                        newMessageRef.set({
                            text: botPrompt,
                            timestamp: formatTimestamp(new Date().getTime()),
                        });
        
                        chat.botInitialized = true;
                        chat.chatbot = chatbotInstance;
                        console.log(` > Chatroom STARTED!`);
                    } else {
                        console.log("Error: Prompt failed to initialize.");
                    }
                }
            }
        });

        // FOR DEMO, NEEDS TO BE IMPLEMENTED: retrieving one classroom code, demo does not require users to enter classroom code.
        socket.on('getLobbyCode', () => {
            console.log("DEMO VERSION returning single classroom GUID");
            const guid = lobbyManager.getFirstLobbyGUID();
            socket.emit('getLobbyCodeResponse', guid);
        });
        
        // Sending messages within a lobby
        // this is the primary change to make lobbies work, we use
        // .to(guid) to point the message at the correct chatroom.
        // be sure to do the same with the chatbot messages so they
        // end up in the correct room.
        socket.on('chatMessage', async (class_guid, chat_guid, messageData) => {
            console.log("chatMessage: Sending message...");
            const foundLobby = lobbyManager.getLobby(class_guid);   // First find the classroom that contains all relevant chatroom codes

            if (foundLobby) {
                const foundChatroom = foundLobby.getChatroom(chat_guid);    // Find the chatroom
                
                if (foundChatroom){
                    io.to(chat_guid).emit('message', messageData);                   
                    foundChatroom.inactivity = false;
                  
                    let chatroomRef = database.ref(`chatrooms/${chat_guid}/users/${messageData.sender}/messages`);
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
                    
                    let respond = await foundChatroom.chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);

                    if (respond) {
                        io.to(chat_guid).emit('message', { sender: foundChatroom.chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime())});

                        chatroomRef = database.ref(`chatrooms/${chat_guid}/users/BOT/messages`);
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
                } else {
                    console.log("Error: Chatroom not found.");
                }
            } else {
                console.log("Error: Classroom not found.");
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

        /**
         *  5/30: Changed event to store the settings on BotSettings and LobbySettings pages, 
         *        settings stored in Lobby obect for later use.
         *        Event "chatStarted" moved to createChatrooms event.
         */
        socket.on('updateBotSettings', async (guid, lobbyData) => {
            const foundLobby = lobbyManager.getLobby(guid);
            if (foundLobby) {
                // Store the data in Lobby object, to be assigned to individual chatrooms in "createChatrooms" event
                foundLobby.lobbySettings = {
                    botname: lobbyData.botname, chatLength: lobbyData.chatLength, assertiveness: lobbyData.assertiveness,
                    topic: lobbyData.topic, chatName: lobbyData.chatName
                }

                // // Test individual variables
                // foundLobby.botNameSetting = lobbyData.botname;
                // foundLobby.chatLengthSetting = lobbyData.chatLength;
                // foundLobby.assertivenessSetting = lobbyData.assertiveness;
                // foundLobby.topicSetting = lobbyData.topic;
                // foundLobby.chatNameSetting = lobbyData.chatName;
            } else {
                console.log("Error: Lobby not found.")
            }

    //  //// OLD       
    //         console.log("updateBotSettings");
    //         //const foundLobby = lobbyManager.getLobby(guid);

    //         if (foundLobby) {
    //             // MOVE, chat starts after monitor page

    //             // 4/30 SEND STUDENT CHATROOMM GUID
    //             socket.to(guid).emit('chatStarted');
    //             foundLobby.roomStarted = true;
    //             foundLobby.chatData = {time: lobbyData.chatLength, chatName: lobbyData.chatName, chatTopic: lobbyData.topic};
    
    //             if (!foundLobby.botInitialized) {
    //                 console.log(` > LOBBY STARTED, CODE: ${guid}`);
    //                 let chatbotInstance = new ChatBot(foundLobby.getAllUsernames(), lobbyData.topic, lobbyData.botname, lobbyData.assertiveness);
    //                 let isSuccess = chatbotInstance.initializePrompting();
    //                 // TODO : ERROR HANDLING
    
    //                 let botPrompt = await chatbotInstance.getInitialQuestion();
    
    //                 //io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
    
    //                 let chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
    //                 let newMessageRef = chatroomRef.push();
    //                 newMessageRef.set({
    //                     text: botPrompt,
    //                     timestamp: formatTimestamp(new Date().getTime()),
    //                 });
        
    //                 foundLobby.botInitialized = true;
    //                 foundLobby.chatbot = chatbotInstance;
    //                 console.log(` > LOBBY STARTED!`);

    //                 io.to(guid).emit('message', { text: botPrompt, sender: chatbotInstance.botname });
    //             }
    //         }
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

         // FIX must get chatroom code, not lobby code
         // returns chat data: time, topic, chatroom name
        socket.on('getChatData', async (class_guid, chat_guid) => {
            console.log("getChatData");
            const foundLobby = lobbyManager.getLobby(class_guid);
            if (foundLobby) {
                const foundChatroom = foundLobby.getChatroom(chat_guid);
                if (foundChatroom){
                    io.to(chat_guid).emit('chatData', foundLobby.lobbySettings);
                }
            }
        });

        socket.on('lobbyInactivity', async (class_guid, chat_guid) => {
            console.log("lobbyInactivity");
            const foundLobby = lobbyManager.getLobby(class_guid);

            if (foundLobby) {
                const foundChatroom = foundLobby.getChatroom(chat_guid);
                
                if (foundChatroom && !foundChatroom.inactivity) {
                    foundChatroom.inactivity = true;
    
                    let chatbotInstance = foundChatroom.chatbot;
                    let inactivityMessage = await chatbotInstance.inactivityResponse();
    
                    io.to(chat_guid).emit('message', { text: inactivityMessage, sender: chatbotInstance.botname });
    
                    let chatroomRef = database.ref(`chatrooms/${chat_guid}/users/BOT/messages`);
                    let newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        text: inactivityMessage,
                        timestamp: formatTimestamp(new Date().getTime()),
                    });
                }
            }
        });


         // starts chat conclusion, prompts chatbot
        socket.on('chatStartConclusionPhase', async (class_guid, chat_guid, timeLeft) => {
            console.log("chatStartConclusionPhase");
            const foundLobby = lobbyManager.getLobby(class_guid);

            if (foundLobby){ 
                const foundChatroom = foundLobby.getChatroom(chat_guid);

                if (foundChatroom && foundChatroom.botInitialized 
                && foundChatroom.conclusionStarted) {

                    foundChatroom.conclusionStarted = true;
                    let chatbotInstance = foundChatroom.chatbot;
                    let conclusionMessage = await chatbotInstance.startConclusion(timeLeft);

                    io.to(chat_guid).emit('message', { text: conclusionMessage, sender: chatbotInstance.botname });

                    let chatroomRef = database.ref(`chatrooms/${chat_guid}/users/BOT/messages`);
                    let newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        text: conclusionMessage,
                        timestamp: formatTimestamp(new Date().getTime()),
                    });
                }
            }
        });

        // // Leaving a lobby
        // socket.on('leaveLobby', (guid, username) => {
        //     console.log("leaveLobby");
        //     const foundLobby = lobbyManager.getLobby(guid);

        //     if (foundLobby && (username in foundLobby.users)) {
        //         foundLobby.removeUser(username);
        //         socket.leave(guid);
        //         socket.emit('leftLobby', guid);
        //         io.to(guid).emit('userLeftLobby', username);

        //         if (Object.keys(foundLobby.users).length === 0) {
        //             console.log("lobby is removed1");
        //             const isSuccess = lobbyManager.removeLobby(guid); // Delete the lobby if empty
        //             // can add additional code for error check
        //         }
        //     }
        // });

        // Disconnect logic
        socket.on('disconnect', async(reason) => {
             console.log(`User ${socket.id} disconnected because of ${reason}`);  
        });
    });

    return io;
};
