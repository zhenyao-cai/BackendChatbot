/**
 * The User class stores the properties of the chatroom users,
 * created for future scalable operations (i.e. tracking user status,
 * user behaviors, etc.)
 */
class User {
    constructor(username, socketId) {
        this.username = username;
        this.socketId = socketId;
        this.status = 'online'; // Default status
    }

    // Example method to update the user's status
    updateStatus(status) {
        this.status = status;
    }

    // Additional methods as needed, e.g., sendMessage, disconnect
}