module.exports = function registerLobbyHandlers(socket, io, db, lobbyManager) {

    // Assign a new host object to a lobby object, join host socket to GUID
    socket.on('createLobby', async (hostUsername) => {
        const guid = lobbyManager.createLobby(socket.id, hostUsername);
        console.log('Lobby created with GUID:', guid);
        socket.join(guid);
        socket.emit('lobbyCreated', guid);

        const foundLobby = lobbyManager.getLobby(guid);
        
        // Dynamic firebase access, set up new lobbby entry
        const lobbyRef = db.ref('lobbies').child(guid);
        lobbyRef.set({
            timestamp: Date.now(),
            host: foundLobby.getHostUsername(),
        });
    });

    // Create new user object, join user socket to existing GUID (lobbyId)
    socket.on('joinLobby', async (guid, username) => {

        if (!guid) { 
            console.log(`> Missing lobbyId for user: ${username}`);
            socket.emit('joinLobbyError', 'Missing lobbyId, cannot join lobby');
            return;
        }

        console.log(`> Request to join: ${guid} by user: ${username}`);
        console.log('Existing lobbies: ' + lobbyManager.getAllLobbyGUIDs());

        const result = lobbyManager.joinLobby(guid, socket.id, username);

        if (result.success) {
            console.log(`> Success: ${result.message}`);
            socket.join(guid);
            socket.emit('joinedLobby', guid);
            io.to(guid).emit('userJoinedLobby', username);
        } else {
            console.log(`> Failure: ${result.message}`);
            socket.emit('joinLobbyError', result.message);
        }
    });

    // Return list of all usernames from an existing lobbby
    socket.on('getUserListOfLobby', async (guid) => {
        const foundLobby = lobbyManager.getLobby(guid);
    
        if (foundLobby) {
            const foundUserList = foundLobby.getAllUsernames();
            socket.emit('userListOfLobbyResponse', foundUserList);
        } 
    });

    // CHECK IF STILL NEEDED
    socket.on('getHostName', async (guid) => {
        const foundLobby = lobbyManager.getLobby(guid);
        const foundHostUsername = foundLobby.getHostUsername();

        if(foundHostUsername) {
            socket.emit('hostNameResponse', foundHostUsername);
        }
        else {
            socket.emit('hostNameResponse', 'Lobby not found');
        }
    });

    socket.on('leaveLobby', async ({ guid, name }) => {
        console.log("User attempting to leave lobby:");
        console.log("guid:", guid);
        console.log("socketId:", socket.id);
        console.log("leaveLobby username:", name);
    
        const foundLobby = lobbyManager.getLobby(guid);
        console.log("foundLobby:", foundLobby);
    
        if (foundLobby) {
            const isRemoved = foundLobby.removeUser(name);
    
            if (isRemoved) {
                console.log(`User with socketId ${socket.id} removed from lobby ${guid}`);
                
                io.to(guid).emit('userLeftLobby', socket.id);
    
                socket.leave(guid);
    
                if (foundLobby.getUserCount() === 0) {
                    console.log(`Lobby ${guid} is now empty and will be removed.`);
                    lobbyManager.removeLobby(guid);
                }
            } else {
                console.log(`User with socketId ${socket.id} not found in lobby ${guid}.`);
            }
        } else {
            console.log(`Lobby ${guid} not found.`);
        }
    });      
};