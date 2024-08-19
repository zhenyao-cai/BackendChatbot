const Lobby = require('../models/lobby');
const Host = require('../models/host');
const User = require('../models/user');
const { generateGUID } = require('../../utils/utils');

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
    } 

    // Create a new host and assign them to a new lobby
    createLobby(socketId, hostUsername) {
        const guid = generateGUID();
        const newHost = new Host(socketId, hostUsername);
        const newLobby = new Lobby(newHost);
        this.lobbies[guid] = newLobby;
        return guid;
    }

    // Joins a new user to a lobby given the lobby code
    joinLobby(guid, socketId, username) {
        // Format return parameters with messages for easy lobby.handler emit
        const foundLobby = this.lobbies[guid];        
        if (foundLobby) {
            const newUser = new User(socketId, username);
            const isAdded = lobby.addUser(newUser);

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

    // Store user objects by socket.id for easy disconnect handling
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
        if (this.lobbies[guid]){
            return this.lobbies[guid];
        }
        else {
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