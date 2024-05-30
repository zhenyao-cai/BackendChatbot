const User = require('../User/User'); // Import user class

class Lobby {
    constructor(hostUsername, socketId) {
        this.hostUsername = hostUsername;
        this.users = {}; // Initialize users object
        this.users[hostUsername] = new User(hostUsername, socketId); // Add host as first user, key=hostUsername

        this.roomStarted = false;
        this.botInitialized = false;
        this.chatbot = null;
        this.chatData = null;
        this.conclusionStarted = false;
        this.inactivity = false;
        this.time = 0; // Initialize time property
        this.timerInterval = null; // Initialize timer interval
    }

    setTime(minutes) {
        this.time = minutes * 60; // Convert minutes to seconds
    }

    startTimer(io, lobbyId) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            if (this.time > 0) {
                this.time -= 1;
                io.to(lobbyId).emit('timerUpdate', this.time);
            } else {
                clearInterval(this.timerInterval);
                io.to(lobbyId).emit('timerEnded');
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    addUser(newUser) {
        if (!this.users[newUser.username]) {
            this.users[newUser.username] = newUser;
            return true;
        }
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

    getUser(username) {
        if (this.users[username]){
            return this.users[username];
        }
        else {
            console.log("User not found.");
            return "";
        }
    }

    getAllUsers() {
        if (this.users){
            return Object.values(this.users); // This will return an array of user objects
        }
        else {
            console.log("No users in lobby.");
            return [];
        }
    }
}

module.exports = Lobby;
