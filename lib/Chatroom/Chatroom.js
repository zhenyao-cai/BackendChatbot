class Chatroom {
    /**
     * Constructs a new instance of the Chatroom class.
     * This class manages the operations of a chatroom, including user management,
     * real-time messaging, and session control.
     * 
     * @param none
     */
    constructor() {
        this.users = {}; // Initialize users object

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

    getAllUsernames() {
        if (this.users){
            return Object.keys(this.users); // This will return an array of usernames
        }
        else {
            console.log("No users in lobby.");
            return null;
        }
        
    }
}


module.exports = Chatroom;