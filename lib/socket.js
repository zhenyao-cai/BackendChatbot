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

    const lobbyManager = new LobbyManager();    // initialize a single manager for all lobbies

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