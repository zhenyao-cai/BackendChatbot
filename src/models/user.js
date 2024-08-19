class User {
    /**
     * Stores the properties of chatroom users.
     * New features to consider: tracking user scores,
     * behaviors, direct messsaging.
     * @param {String} socketId - The socket.id of the user client.
     * @param {String} username - The name of the new user. 
     */
    constructor(socketId, username) {
        this.socketId = socketId;
        this.username = username;
        //this.assignedGUID = -1;  // To be assigned when host user creates chatrooms.
        this.isActive = true;
    }

    getSocketId() {
        return this.socketId;
    }

    getUsername() {
        return this.username;
    }

    markInactive() {
        this.isActive = false;
        console.log(`User ${this.username} marked as inactive.`);
    }
}

module.exports = User;