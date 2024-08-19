module.exports = function registerChatHandlers(socket, io, db, lobbyManager) {
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

        if (totalChatrooms === 0) {
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

            if (foundSocket !== -1) {
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
        for (const chat_code in chatrooms) {
            const chat = chatrooms[chat_code]; // Use the key from the for loop to access the Chatroom object
            //chat.chatSettings = foundLobby.lobbySettings;
            if (!chat.botInitialized) {
                console.log(` > Starting chatroom, CODE: ${chat_code}`); // chatroom contains chatroom code
                let chatbotInstance = new ChatBot(
                    chat.usernameList, settings.topic,
                    settings.botName, settings.assertiveness
                );
                let isSuccess = chatbotInstance.initializePrompting();
                if (isSuccess) {
                    let botPrompt = await chatbotInstance.getInitialQuestion();
                    console.log(` > InitialPrompt: ${botPrompt}`); //

                    io.to(chat_code).emit('message', {
                        text: botPrompt, sender: chatbotInstance.botname,
                        lobbyId: chat_code, timestamp: formatTimestamp(new Date().getTime())
                    });

                    let chatroomRef = database.ref(`chatrooms/${chat_code}/users/BOT/messages`);
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

            if (foundChatroom) {
                io.to(chat_guid).emit('message', messageData);
                console.log(` > messageData to ${chat_guid}: ${messageData.text}`); // check if user input received

                foundChatroom.inactivity = false;
                let chatroomRef = database.ref(`chatrooms/${chat_guid}/users/${messageData.sender}/messages`);

                let newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: messageData.text,
                    timestamp: messageData.timestamp,
                });

                //console.log(` > BROADCASTING: ${messageData.text} FROM: ${messageData.sender}; TO: ${foundLobby.users[foundLobby.hostUserame]}`);

                let respond = await foundChatroom.chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);

                if (respond) {
                    io.to(chat_guid).emit('message', { sender: foundChatroom.chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime()) });

                    chatroomRef = database.ref(`chatrooms/${chat_guid}/users/BOT/messages`);
                    newMessageRef = chatroomRef.push();
                    newMessageRef.set({
                        text: respond,
                        timestamp: messageData.timestamp,
                    });
                }
            } else {
                console.log("Error: Chatroom not found.");
            }
        } else {
            console.log("Error: Classroom not found.");
        }
    });


}