const socketIo = require('socket.io');
const registerLobbyHandlers = require('./handlers/lobby.handler');
const registerChatHandlers = require('./handlers/chat.handler');
// const { formatTimestamp } = require('../utils/utils.js');
// const ChatBot = require("./models/chatbot.js");
const LobbyManager = require('./models/lobby.manager.js');

// Initialize lobby manager to handle all active lobbies
const lobbyManager = new LobbyManager();

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

        // Implement disconnect process to free wasted memory
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