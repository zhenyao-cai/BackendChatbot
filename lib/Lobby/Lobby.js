const User = require('../User/User'); // Import user class

class Lobby {
    constructor(hostUsername, socketId) {
        this.hostUsername = hostUsername;
        this.users = {}; // Initialize users object
        this.chatrooms = {}; // One "classroom lobby" contains multiple chatrooms, keyed by genarated GUIDs
        this.chatroomGuids = []; // Easy access to chatroom guids

        // 3/19: not adding host as user to classrooms
        // this.users[hostUsername] = new User(hostUsername); // Add host as first user, key=hostUsername

        this.minChatroomSize = 4; // SET TO 4 users per chatroom

        // Store default values for individual chatrooms
        this.roomStarted = false;  // can be use to track if all Chatrooms in classroom started
        this.lobbySettings = null; // stores chat settings: botName, chatlength, assertiveness, topic, chatName
        this.conclusionStarted = false; 

        // not needed
        this.botInitialized = false; // not needed  for main lobby
        this.chatbot = null;  // NOT NEEDED for main lobby
        this.inactivity = false; // NOT NEEDED for main lobby
        this.time = 0; // Initialize time property
        this.timerInterval = null; // Initialize timer interval -> should be in individual chatrooms

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
            this.chatroomGuids.push(guid); // Storing in Lobby object for easy access
        }

        usernames.forEach((username, index) => {
            const roomIndex = index % totalChatrooms; // Determine the room index in a round-robin fashion
            const currentRoomGUID = this.chatroomGuids[roomIndex]; // Use the easy array from the previous block

            // Record chatroom code in User object
            let userObject = this.users[username]; // Fetch the user object by username
            userObject.assignedGUID = currentRoomGUID // Store the assigned chatroom code in the User Object, to be used in socket.join

            // Record user in Chatroom object
            this.chatrooms[currentRoomGUID].addUser(username); // Add the username to the chatroom username list
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

    getAllUsers() {
        if (this.users){
            return Object.values(this.users); // This will return an array of user objects
        }
        else {
            console.log("No users in lobby.");
            return null;
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

