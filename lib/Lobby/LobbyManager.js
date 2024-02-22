const Lobby = require('./Lobby');
const User = require('../User/User');
const { generateGUID } = require('../utils/utils');

class LobbyManager {
    /**
     * Constructs a new instance of the LobbyManager class.
     * This class defines operations for the creation of lobbies.
     * Uses generated GUID for unique identifier.
     * @param none
     */
    constructor(io) {
        this.lobbies = {}; // Stores all lobbies, keyed by GUID
        this.io = io
    }

    createLobby(hostUsername, socketId) {
        const guid = generateGUID();
        const newLobby = new Lobby(hostUsername, socketId);
        this.lobbies[guid] = newLobby;

        // Join the host to the lobby's socket room immediately
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            console.log(io.sockets.adapter.rooms);
            socket.join(guid);
            console.log(io.sockets.adapter.rooms);
            socket.emit('lobbyCreated', guid);
        }
        // May need to implement error check, make sure Lobby was created
        return guid; // Return the GUID of the newly created lobby
    }

    joinLobby(guid, username, socketId) {
        console.log(` > Request to join: ${guid} by user: ${username}`);

        const socket = this.io.sockets.sockets.get(socketId);
        const lobby = this.lobbies[guid];
        if (lobby && socket) {                   // Check if lobby and socket exist
            socket.join(guid);
            const addUser = lobby.addUser(new User(username, socketId));

            if (addUser) {
                socket.emit('joinedLobby', guid);
                this.io.to(guid).emit('userJoinedLobby', username);
                return true;
            }
            else {
                socket.emit('lobbyError', 'Error joining lobby');
                return false;
            }
        } 
        else {
            // Lobby not found or username taken, assumes socket exists
            socket.emit('lobbyError', 'Error joining lobby');
            return false;
        }
    }


    joinRoom(guid, username) {
        console.log(` > Joining Chatroom: ${guid} by user: ${username}`);
        const socket = this.io.sockets.sockets.get(socketId);

        // can also check if socketID matches
        if (this.lobbies[guid] && this.lobbies[guid].users[username]) {
            socket.join(guid);
            socket.emit('joinedChatroom', guid);
        } else {
            socket.emit('chatroomError', 'Error joining room.');
        }
    }

    // Sending messages within a lobby
    // this is the primary change to make lobbies work, we use
    // .to(guid) to point the message at the correct chatroom.
    // be sure to do the same with the chatbot messages so they
    // end up in the correct room.
    async lobbyMessage(guid, messageData) {  //added async modifier for await function
        if (this.lobbies[guid]) {
            this.io.to(guid).emit('message', messageData);
            
            this.lobbies[guid].inactivity = false;

            let chatroomRef = database.ref(`chatrooms/${guid}/users/${messageData.sender}/messages`);
            let newMessageRef = chatroomRef.push();
            newMessageRef.set({
                text: messageData.text,
                timestamp: messageData.timestamp,
            });

            console.log(` > BROADCASTING: ${messageData.text} FROM: ${messageData.sender}; TO: ${this.lobbies[guid].users[lobbies[guid].hostUserame]}`);

            let respond = await lobbies[guid].chatbot.botMessageListener(messageData.sender, messageData.text, messageData.timestamp);

            if (respond) {
                io.to(guid).emit('message', { sender: lobbies[guid].chatbot.botname, text: respond, timestamp: formatTimestamp(new Date().getTime())});

                chatroomRef = database.ref(`chatrooms/${guid}/users/BOT/messages`);
                newMessageRef = chatroomRef.push();
                newMessageRef.set({
                    text: respond,
                    timestamp: messageData.timestamp,
                });
            }
        }
    }    


    getAllLobbyGUIDs() {
        return Object.keys(this.lobbies);
    }
}

module.exports = LobbyManager;