const socketIo = require('socket.io');
const registerLobbyHandlers = require('./handlers/lobby.handler');
const registerChatHandlers = require('./handlers/chat.handler');
const LobbyManager = require('./managers/lobby.manager');
const lobbyManager = new LobbyManager();

const ChatBot = require("./models/chatbot.js");
const { formatTimestamp } = require('../utils/utils.js');

/**
 * Initializes Socket.IO and configures all socket event listeners.
 * @param {Object} server - The HTTP server.
 * @param {Object} database - The database connetion.
 * @return {Object} The initialized Socket.IO instance.
*/
module.exports = function initializeSocketIO(server, db) {
    
    const corsOptions = {
        origin: "*",
        methods: ["GET", "POST"]
    };

    const io = socketIo(server, {
        cors: corsOptions
    });

    io.on('connection', (socket) => {
        console.log(`User ${socket.id} connected`);

        // Register event handlers
        registerLobbyHandlers(socket, io, db, lobbyManager);
        registerChatHandlers(socket, io, db, lobbyManager);


        // FOR DEMO, NEEDS TO BE IMPLEMENTED: retrieving one classroom code, demo does not require users to enter classroom code.
        socket.on('getLobbyCode', () => {
            console.log("DEMO VERSION returning single classroom GUID");
            const guid = lobbyManager.getFirstLobbyGUID();
            socket.emit('getLobbyCodeResponse', guid);
        });

        /**
         *  5/30: Changed event to store the settings on BotSettings and LobbySettings pages, 
         *        settings stored in Lobby obect for later use.
         *        Event "chatStarted" moved to createChatrooms event.
         */
        socket.on('updateBotSettings', async (guid, lobbyData) => {
            console.log("updateBotSettings");
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
            console.log("chatStartConclusionPhase ON PAUSE");
            // const foundLobby = lobbyManager.getLobby(class_guid);

            // if (foundLobby){ 
            //     const foundChatroom = foundLobby.getChatroom(chat_guid);

            //     if (foundChatroom && foundChatroom.botInitialized 
            //     && foundChatroom.conclusionStarted) {

            //         foundChatroom.conclusionStarted = true;
            //         let chatbotInstance = foundChatroom.chatbot;
            //         let conclusionMessage = await chatbotInstance.startConclusion(timeLeft);

            //         io.to(chat_guid).emit('message', { text: conclusionMessage, sender: chatbotInstance.botname });

            //         let chatroomRef = database.ref(`chatrooms/${chat_guid}/users/BOT/messages`);
            //         let newMessageRef = chatroomRef.push();
            //         newMessageRef.set({
            //             text: conclusionMessage,
            //             timestamp: formatTimestamp(new Date().getTime()),
            //         });
            //     }
            // }
        });

        socket.on('disconnect', (reason) => {
            console.log(`User ${socket.id} disconnected because of ${reason}`);
             
            if (socket.id in lobbyManager.getAllUserIdsMasterList()) {
                const foundUser = lobbyManager.getUserFromMasterList(socket.id);
                // remove from master list
                // remove from chatroom and lobby
                // or if in chat, mark as inactive
            }
            else if (socket.id in lobbyManager.getAllHostIds()) {
                const foundLobby = lobbyManager.getLobbyByHostSocketId(socket.id);
                // send all lobby participants to home page? maybe display message
                // remove all host, user, lobby, chatroom, and chatbot data
            }
        });

    });

    return io;
};