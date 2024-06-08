class User {
    /**
     * The User class stores the properties of the chatroom users,
     * created for future scalable operations (i.e. tracking user scores, 
     * status, behaviors, direct messsaging etc.)
     * 
     * @param {String} username - The name of the new user. 
     */
    constructor(username) {
        this.username = username;
        this.socketId = -1;         // To store socket.id of users joining lobby, default -1 
        this.assignedGUID = -1;  // To be assigned when host user creates chatrooms.
    }
}

module.exports = User;