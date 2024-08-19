class Chatroom {
    /**
     * Constructs a new instance of the Chatroom class.
     * This class manages the operations of a chatroom, including user management,
     * real-time messaging, and session control.
     * 
     * @param none
     */
    constructor() {
        this.usernameList = []; // Store the username identifiers for all User objects aded to the room

        this.roomStarted = false;
        this.botInitialized = false;
        this.chatbot = null;
        this.chatSettings = null;
        this.conclusionStarted = false;
        this.inactivity = false;
    }

    addUser(username) {
        if (!this.usernameList.includes(username)) {
            this.usernameList.push(username);
            return true;
        }
        return false;
    }

    removeUser(username) {
        const index = this.usernameList.indexOf(username);

        if (index !== -1) {
            console.log("Removing user: " + username);
            this.usernameList.splice(index, 1); // Remove username from array
            return true;
        }
        return false;
    }

    getUser(username) {
        if (this.usernameList.includes(username)) {
            return username;
        } else {
            console.log("User not found.");
            return null;
        }
    }

    getAllUsernames() {
        if (this.usernameList.length > 0) {
            return this.usernameList;
        } else {
            console.log("No users in lobby.");
            return null;
        }
    }

}

module.exports = Chatroom;