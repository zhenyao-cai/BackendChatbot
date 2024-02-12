const Lobby = require('./Lobby');
const User = require('../User/User');
const { generateGUID } = require('../utils/utils');

class LobbyManager {
    constructor() {
        this.lobbies = {}; // Stores all lobbies, keyed by GUID
    }

    createLobby(hostUsername, socketId, io) {
        const guid = generateGUID();
        const newLobby = new Lobby(hostUsername, socketId);
        this.lobbies[guid] = newLobby;

        // Join the host to the lobby's socket room immediately
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            console.log(io.sockets.adapter.rooms);
            socket.join(guid);
            console.log(io.sockets.adapter.rooms);
            socket.emit('lobbyCreated', guid);
        }
        // May need to implement error check, make sure Lobby was created
        return guid; // Return the GUID of the newly created lobby
    }

    joinLobby(guid, username, socketId, io) {
        const lobby = this.lobbies[guid];
        if (lobby) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.join(guid);
                const user = lobby.addUser(new User(username, socketId));
                io.to(guid).emit('userJoinedLobby', username);
                return true;
            }
        } else { 
            // Lobby not found
            return false;
        }
    }

    getLobby(guid) {
        return this.lobbies[guid];
    }

    getAllLobbyGUIDs() {
        return Object.keys(this.lobbies);
    }

    // Additional methods as needed, such as deleteLobby, listLobbies, etc.
}