const { generateGUID } = require("../utils/utils");
const Chatroom = require('../Chatroom/Chatroom');

class Lobby {
    /**
     * Constructs a new instance of the Lobby class.
     * This class manages the operations of a chatroom lobby, including user management.
     * 
     * @param {String} hostUsername - The username of the lobby's host.
     */
    constructor(hostUsername) {
        this.hostUsername = hostUsername;
        this.users = {}; // Initialize users object
        this.chatrooms = {}; // One "classroom lobby" now contains multiple chatrooms, keys are new genarated GUIDs
        this.chatroomGuids = []; // Easier access to chatroom guids

        // 3/19: not adding host as user,
        //this.users[hostUsername] = new User(hostUsername); // Add host as first user, key=hostUsername

        this.minChatroomSize = 4; // SET TO 4 users per chatroom

        this.roomStarted = false;
        this.botInitialized = false;
        this.chatbot = null;
        this.chatData = null;
        this.conclusionStarted = false;
        this.inactivity = false;
    }

    createChatrooms(){
        // count number of users
        const usernames = Object.keys(this.users); // Get all the users in the lobby
        const totalUsers = usernames.length;

        if (totalUsers === 0) {
            console.log("No users in lobby.");
            return 0; // or return an appropriate message indicating no users are in the lobbyb
        }

        // divide into correct number of chatrooms
        let totalChatrooms = 0;
        
        if (totalUsers < this.minChatroomSize){
            totalChatrooms = 1;
        }
        else {
            totalChatrooms = Math.floor(totalUsers/this.minChatroomSize);
        }

        // initialize chatrooms with GUIDS
        for (let i = 0; i < totalChatrooms; i++) {
            const guid = generateGUID();
            this.chatrooms[guid] = new Chatroom();
            this.chatroomGuids.push(guid); // Storing for easy access
        }

        usernames.forEach((username, index) => {
            const roomIndex = index % totalChatrooms; // Determine the room index in a round-robin fashion
            const currentRoomGuid = this.chatroomGuids[roomIndex]; // Use the easy array from the previous block
            let userObject = this.users[username]; // Fetch the user object by username
            this.chatrooms[currentRoomGuid].addUser(userObject); // Add the user object to the chatroom
            userObject.chatroomIndex = roomIndex; // Set index for easy assignement of socket.join
        });

        console.log('Chatrooms created.');
        return totalChatrooms;
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

    getUserIndex(username) {
        if (this.users[username]){
            let user = this.users[username];
            return user.chatroomIndex;
        }
        else {
            console.log("User not found.");
            return -1;
        }
    }

    setUserIndex(username, index) {
        if (this.users[username]){
            let user = this.users[username];
            user.chatroomIndex = index;
            return true;
        }
        else {
            console.log("User not found.");
            return false;
        }
    }

    getChatroom(guid) {
        if (this.chatrooms[guid]){
            return this.chatrooms[guid];
        }
        else {
            console.log("Get Chatroom: Chatroom not found.");
            return null;
        }
    }
}


module.exports = Lobby;