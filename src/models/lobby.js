const Chatbot = require('./chatbot/chatbot');
const { generateGUID } = require("../../utils/guid.utils");
const { shuffle } = require("../../utils/shuffle.utils");
const { formatTimestamp } = require("../../utils/date.utils");

class Lobby {
    /**
     * Manages lobby properties, chatroom objects, 
     * user objects, and host object.
     * @param {Host} hostObject - The lobby's host object.
     */
    constructor(hostObject) {
        this.host = hostObject;
        
        // Stores Users objects in lobby, keyed by socket.id
        this.users = {}; 
        
        // Stores list of usernames in each chatroom, keyed by chatroom guid
        this.chatrooms = {}; 

        // Stores all chatbot objects, keyed by chatroom guid
        this.chatbots = {};

        // Stores chat settings: botName, chatLength, assertiveness, topic, chatName
        this.chatSettings = null;

        // fix for host to select MAX chat size
        this.minChatroomSize = 4; // SET TO 4 users per chatroom

        // Initialize time property
        this.timerInterval = 0;

        // not needed, botS initialized?
        this.chatbot = null;  // NOT NEEDED for main lobby
        this.inactivity = false; // NOT NEEDED for main lobby
    }

    // Timer functions help track the progress of all active chats within a lobby
    startTimer(io, guid) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Convert minutes to seconds
        let time = this.chatSettings.chatLength * 60;

        this.timerInterval = setInterval(() => {
            if (time > 0) {
                time -= 1;
                io.to(guid).emit('timerUpdate', time);
            } else {
                clearInterval(this.timerInterval);
                io.to(guid).emit('timerEnded');
            }
        }, 1000);
    }

    // UNUSED FUNCTION, close chat logic not implemented
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    addUser(userObject) {
        if (!this.users[userObject.username]) {
            this.users[userObject.username] = userObject;
            return true;
        }
        return false;
    }

    removeUser(username) {
        const safeUsername = username ? username.trim() : "NAME";
    
        console.log("Attempting to remove user:", safeUsername);
        
        const userKeys = Object.keys(this.users);
        
        console.log("User exists:", userKeys.includes(safeUsername));
    
        if (safeUsername && userKeys.includes(safeUsername)) {
            console.log("Removing user:", safeUsername);
            delete this.users[safeUsername];
            // Additional logic when a user leaves the lobby
            return true;
        } else {
            console.log("Remove User: User not found.");
            return false;
        }
    }    

    getUser(username) {
        if (this.users[username]){
            return this.users[username];
        } else {
            console.log("User not found.");
            return "";
        }
    }

    getAllUsernames() {
        return Object.keys(this.users);
    }

    getUserCount() {
        return Object.keys(this.users).length;
    }

    getHostId() {
        return this.host.getSocketId();
    }

    getHostUsername() {
        return this.host.getHostUsername();
    }

    getChatbot(guid) {
        if (this.chatbots[guid]){
            return this.chatbots[guid];
        } else {
            console.log("Get chatbot: Chatbot not found.");
            return null;
        }
    }

    getChatSettings() {
        return this.chatSettings;
    }

    getChatroomMap(){
        return this.chatrooms;
    }

    // Create the correct number of chatrooms, join users to the room
    createChatrooms(io) {
        // Count number of users in lobby
        const totalUsers = this.getUserCount();
        if (totalUsers === 0) {
            console.log("No users in lobby.");
            return 0;
        }

        // Divide into correct number of chatrooms
        let totalChatrooms = 0;
        if (totalUsers < this.minChatroomSize){
            totalChatrooms = 1;
        } else {
            totalChatrooms = Math.floor(totalUsers/this.minChatroomSize);
        }

        // Initialize chatrooms with GUIDS
        let chatroomGuids = []; // Easy access to chatroom guids
        for (let i = 0; i < totalChatrooms; i++) {
            const guid = generateGUID();
            this.chatrooms[guid] = [];
            chatroomGuids.push(guid);
        }

        // Randomly assign users per chat
        let usernames = Object.keys(this.users);
        shuffle(usernames);
        usernames.forEach((username, index) => {
            // Determine the room index in a round-robin fashion
            const roomIndex = index % totalChatrooms;
            const currentRoomGUID = chatroomGuids[roomIndex];

            // Record username in chatroom map
            const user = this.users[username];
            const userSocketId = user.getSocketId();
            this.chatrooms[currentRoomGUID].push(username);

            // Join user socket to guid server room
            const socketObject = io.sockets.sockets.get(userSocketId);
            if (socketObject && socketObject.connected) {
                socketObject.join(currentRoomGUID);
                socketObject.emit('joinedChatroom', currentRoomGUID);
                io.to(currentRoomGUID).emit('userJoinedChatroom', username);
                console.log(`${username} has joined room ${currentRoomGUID}`);
            } else {
                console.error(`Socket for ${username} not found or is not connected.`);
            }
        });

        console.log('Chatrooms created.');
        return totalChatrooms;
    }

    // Initialize a chatbot object for each chatroom within the lobby
    async initializeBots(lobby_guid, io, db) {
        if (!this.chatSettings) {
            console.log('Chat settings not initialized.');
            return;
        }

        for (let chat_guid in this.chatrooms) {
            console.log('Creating chatbot for room: ' + chat_guid);
            console.log('Users:');
            for (let usernames of this.chatrooms[chat_guid]){
                console.log(usernames);
            }

            const chatbotInstance = new Chatbot(
                this.chatrooms[chat_guid], this.chatSettings.topic,
                this.chatSettings.botName, this.chatSettings.assertiveness
            );

            // Method initialize time tracker, can't be async
            chatbotInstance.initializeTimeTracker(io, chat_guid);

            // Signal for users to jump to chatroom page
            io.to(chat_guid).emit('chatStarted', lobby_guid, chat_guid);

            // Create the initial prompt to begin the chat
            const isSuccess = await chatbotInstance.initializePrompting();
            if (isSuccess) {
                const botPrompt =
                    chatbotInstance.getInitialQuestion();
                console.log(` > InitialPrompt: ${botPrompt}`);

                const messageData = {
                    text: botPrompt,
                    sender: chatbotInstance.getBotName(),
                    timestamp: formatTimestamp(new Date().getTime())
                };

                // Send to frontend to display prompt in the chatroom
                io.to(chat_guid).emit('message', messageData);

                // Dynamic firebase access, set up new chatroom entry
                const chatroomRef = db.ref(
                    `lobbies/${lobby_guid}/chatrooms/${chat_guid}/messages`
                );
                const newMessageRef = chatroomRef.push();
                newMessageRef.set(messageData);

                // Map chatbot object to chatroom code
                this.chatbots[chat_guid] = chatbotInstance;
            } else {
                console.log("Error: Prompt failed to initialize.");
            }
        }
    }
}

module.exports = Lobby;