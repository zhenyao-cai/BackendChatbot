const User = require('../User/User'); // Import user class, .js assumed
//const { generateGUID } = require('../utils/utils');

class Lobby {
    /**
     * Constructs a new instance of the Lobby class.
     * This class manages the operations of a chatroom lobby, including user management,
     * real-time messaging, and session control.
     * 
     * @param {String} hostUsername - The username of the lobby's host.
     * @param {String} socketId - The socket ID of the lobby's host.
     */
    constructor(hostUsername, socketId) {
        this.hostUsername = hostUsername;
        //this.guid = generateGUID();
        this.users = {}; // Initialize users object
        this.users[hostUsername] = new User(hostUsername, socketId); // Add host as first user, key=hostUsername

        this.roomStarted = false;
        this.botInitialized = false;
        this.chatbot = null;
        this.chatData = null;
        this.conclusionStarted = false;
        this.inactivity = false;
    }


    addUser(newUser) {
        if (!this.users[newUser.username]) {
            this.users[newUser.username] = newUser;
            return true;
        }

        console.error("Username taken.");
        return false;
    }

    removeUser(username) {
        if (this.users[username]) {
            console.log("Removing user: " + username);
            delete this.users[username];
            // Additional logic for when a user leaves a lobby
            return true;
        }

        return false;
    }


    getAllUsernames() {
        return Object.keys(this.users); // This will return an array of usernames
    }



    // broadcastMessage(io, messageData) {
    //     io.to(this.guid).emit('message', messageData);
    //     // Additional logic for handling message broadcasting
    // }
}


module.exports = Lobby;