const Lobby = require('./Lobby');
const User = require('../User/User');
const { generateGUID } = require('../utils/utils');

class LobbyManager {
    /**
     * Constructs a new instance of the LobbyManager class.
     * This class defines operations for the creation of lobbies.
     * Uses generated GUID for unique identifier.
     * @param none
     */
    constructor() {
        this.lobbies = {}; // Stores all lobbies, keyed by GUID
    }

    createLobby(hostUsername, socketId) {
        const guid = generateGUID();
        const newLobby = new Lobby(hostUsername, socketId);
        this.lobbies[guid] = newLobby;

        console.log("Lobby created with GUID:", guid);
    
        return guid; // Return the GUID of the newly created lobby
    }

    joinLobby(guid, username, socketId) {
        console.log(` > Request to join: ${guid} by user: ${username}`);
        console.log("Existing lobbies: " + this.getAllLobbyGUIDs());

        const lobby = this.lobbies[guid];
        if (lobby) {
            const isAdded = lobby.addUser(new User(username, socketId));

            if (isAdded) {
                console.log(`${username} added to lobby ${guid}`);
                return true;
            }
            else {
                // Username already exists
                console.log(`Invalid username: ${username} already taken`);
                return false;
            }
        } 
        else {
            // Lobby not found
            console.log("Lobby error: Lobby not found");
            return false;
        }
    }

/** Lobby data not manipulated, may not need to define function */
    // joinRoom(guid, username) {
    //     console.log(` > Joining Chatroom: ${guid} by user: ${username}`);
    // }

/**Do something with message, store in database? */
    // lobbyMessage(guid, messageData) {
    //     // Do something...
    // }   
    
    getHostName(guid) {
        const lobby = this.lobbies[guid];

        if (lobby) {
            return lobby.hostUsername;
        }
        else {
            console.log("Lobby not found.");
            return "";
        }
    }

    getLobby(guid) {
        if (this.lobbies[guid]){
            return this.lobbies[guid];
        }
        else {
            console.log("Lobby not found.");
            return null;
        }
    }

    removeLobby(guid) {
        if (this.lobbies[guid]) {
            console.log("Removing lobby: " + guid);
            delete this.lobbies[guid];
            // Additional logic for when a lobby removed
            return true;
        }

        return false;
    }

    getAllLobbyGUIDs() {
        return Object.keys(this.lobbies);
    }
}


module.exports = LobbyManager;