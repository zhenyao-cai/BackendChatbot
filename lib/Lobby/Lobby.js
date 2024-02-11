/**
 * The Lobby class contains the logic for the management and operation for a single chatroom lobby.
 * This includes handling user connections and disconnections, managing real-time messaging,
 * and providing methods to broadcast messages to all users in the lobby.
 */

const User = require('./User'); // adjust

class Lobby {
    constructor(hostUsername, guid) {
        this.guid = guid;
        this.users = {};
        this.roomStarted = false;
        this.botInitialized = false;
        this.hostUsername = hostUsername;
        this.chatbot = null;
        this.chatData = null;
        this.conclusionStarted = false;
        this.inactivity = false;
    }

    addUser(username) {
        if (!this.users[username]) {
            this.users[username] = 0; // Or any other initial value relevant to the user
            return true;
        }
        return false;
    }

    removeUser(username) {
        if (this.users[username]) {
            delete this.users[username];
            // Additional logic for when a user leaves a lobby
            return true;
        }
        return false;
    }

    broadcastMessage(io, messageData) {
        io.to(this.guid).emit('message', messageData);
        // Additional logic for handling message broadcasting
    }

    startChatSession(chatData) {
        this.roomStarted = true;
        this.chatData = chatData;
        // Initialize chat session or game session here
    }

    // Additional methods as needed for your application
}

module.exports = Lobby;