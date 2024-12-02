const Lobby = require('./lobby');
const Host = require('./host');
const User = require('./user');
const { generateGUID } = require('../../utils/guid.utils');

class LobbyManager {
    /**
     * Defines operations for the creation and management of lobbies.
     * Functions used in lobby.handler.js
     * @param none
     */
    constructor() {
        // Map structures used for efficient room assignment and disconnect
        this.lobbies = {}; // Stores all Lobby objects, keyed by GUID
        this.userMasterList = {}; // Store all User Objects, keyed by socket.id
        this.MAX_USERS = 300;  
    } 

    // Create a new host and assign them to a new lobby
    createLobby(socketId, hostUsername) {
        const guid = generateGUID();
        const newHost = new Host(socketId, hostUsername);
        const newLobby = new Lobby(newHost);
        this.lobbies[guid] = newLobby;
        return guid;
    }

    // Adds a new user object to a lobby using the lobby code
    joinLobby(guid, socketId, username) {
        // Format return parameters with messages for easy lobby.handler emit
        const foundLobby = this.lobbies[guid];        
        if (foundLobby) {
            // First check if lobby has reached capacity
            if (foundLobby.getUserCount() >= this.MAX_USERS) {
                return { success: false, message: `Lobby ${guid} is full` };
            }

            const newUser = new User(socketId, username);
            const isAdded = foundLobby.addUser(newUser);
            console.log(
                'User ' + username + ', ' + socketId +
                ' added to lobby ' + guid
            )

            if (isAdded ) {
                this.addUserMasterList(newUser);
                return { success: true, 
                    message: `${username} added to lobby ${guid}` };
            }
            else {
                return { success: false, 
                    message: `Invalid username: ${username} already taken` };
            }
        } 
        else {
            return { success: false, message: `Lobby ${guid} not found` };
        }
    }   

    // HELPER: Store user objects by socket.id for easy disconnect handling
    addUserMasterList(userObject) {
        // Different from lobby.js, master list organizes users by socket.id
        if (!this.userMasterList[userObject.socketId]) {
            this.userMasterList[userObject.socketId] = userObject;
            return true;
        }
        return false;
    }

    getAllUserIdsMasterList(){
        return Object.keys(this.userMasterList);
    }

    getUserFromMasterList(socketId) {
        return this.userMasterList[socketId];
    }

    getLobby(guid) {
        console.log("this.lobbies guid:", guid);
        console.log("this.lobbies:", this.lobbies);
    
        const trimmedGuid = guid ? guid.trim() : "GUID";
        const normalizedGuid = trimmedGuid.toUpperCase(); 
    
        const lobbyKeys = Object.keys(this.lobbies);
    
        console.log("GUID matches:", lobbyKeys.includes(normalizedGuid));
    
        if (lobbyKeys.includes(normalizedGuid)) {
            return this.lobbies[normalizedGuid];
        } else {
            console.log("Get Lobby: Lobby not found.");
            return null;
        }
    }    
    
    getLobbyByHostSocketId(socketId) {
        for (const guid in this.lobbies) {
            const lobby = this.lobbies[guid];
            
            if (lobby.getHostId() === socketId) {
                return lobby;
            }
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

    // FOR DEMO: use only the first lobby
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