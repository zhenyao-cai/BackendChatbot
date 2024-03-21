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

    createLobby(hostUsername) {
        const guid = generateGUID();
        const newLobby = new Lobby(hostUsername);
        this.lobbies[guid] = newLobby;

        console.log("Lobby created with GUID:", guid);
    
        return guid; // Return the GUID of the newly created lobby
    }

    joinLobby(guid, username) {
        console.log(` > Request to join: ${guid} by user: ${username}`);
        console.log("Existing lobbies: " + this.getAllLobbyGUIDs());

        const lobby = this.lobbies[guid];
        if (lobby) {
            const isAdded = lobby.addUser(new User(username));

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
            console.log("Join Lobby error: Lobby not found");
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
            console.log("Get Host Name: Lobby not found.");
            return "";
        }
    }

    getLobby(guid) {
        if (this.lobbies[guid]){
            return this.lobbies[guid];
        }
        else {
            console.log("Get Lobby: Lobby not found.");
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

    getFirstLobbyGUID() {
        const lobbyGUIDs = Object.keys(this.lobbies); // Get all the GUID keys of the lobbies
        if (lobbyGUIDs.length === 0) {
            console.log("No lobbies available.");
            return null; // or return an appropriate message indicating no lobbies are available
        }
    
        const firstLobbyGUID = lobbyGUIDs[0]; // Get the GUID of the first lobby
        return firstLobbyGUID; // Return the first lobby object
    }

}


module.exports = LobbyManager;