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
    const socketIo = require('socket.io');
    const io = socketIo(server, {
        cors: {
            origin: "*",                         // replace with list of allowed domains for enhanced security
            methods: ["GET", "POST"],
        }
    });

    // Socket.IO logic
    io.on('connection', (socket) => {
        // Create lobby
        socket.on('createLobby', async (username) => {
            const guid = generateGUID();
            
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

        // Join lobby
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

    });

    return io;
};