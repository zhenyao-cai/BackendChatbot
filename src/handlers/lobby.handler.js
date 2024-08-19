module.exports = function registerLobbyHandlers(socket, io, db, lobbyManager) {

    socket.on('createLobby', async (hostUsername) => {
        const guid = lobbyManager.createLobby(socket.id, hostUsername);
        console.log('Lobby created with GUID:', guid);
        socket.join(guid);
        socket.emit('lobbyCreated', guid);

        const foundLobby = lobbyManager.getLobby(guid);

        // Dynamic firebase access, use only in handler.js files
        const lobbyRef = db.database().ref('lobbies').child(guid);
        lobbyRef.set({
            timestamp: Date.now(),
            code: guid,
            host: foundLobby.getHostUsername(),
        });
    });

    socket.on('joinLobby', async (guid, username) => {
        console.log(`> Request to join: ${guid} by user: ${username}`);
        console.log('Existing lobbies: ' + lobbyManager.getAllLobbyGUIDs());
    
        const result = lobbyManager.joinLobby(guid, socket.id, username);        

        if (result.success) {
            console.log(result.message);

            socket.join(guid);
            socket.emit('joinedLobby', guid);
            io.to(guid).emit('userJoinedLobby', username);
        }
        else {
            console.log(result.message);
            socket.emit('joinLobbyError', result.message);
        }
    });

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

    socket.on('leaveLobby', async (guid) => {
        const foundLobby = lobbyManager.getLobby(guid);
        // disconnect processes
        
        //console.log("leaveLobby");
        //     const foundLobby = lobbyManager.getLobby(guid);

        //     if (foundLobby && (username in foundLobby.users)) {
        //         foundLobby.removeUser(username);
        //         socket.leave(guid);
        //         socket.emit('leftLobby', guid);
        //         io.to(guid).emit('userLeftLobby', username);

        //         if (Object.keys(foundLobby.users).length === 0) {
        //             console.log("lobby is removed1");
        //             const isSuccess = lobbyManager.removeLobby(guid); // Delete the lobby if empty
        //             // can add additional code for error check
        //         }
        //     }
    });
};