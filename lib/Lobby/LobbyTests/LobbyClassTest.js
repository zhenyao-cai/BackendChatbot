const Lobby = require('../Lobby'); // Import lobby class
const User = require('../../User/User');

function testLobbyClass() {
    const lobby = new Lobby('JaneDoe', 'socket123');

    console.log("Host: " + lobby.hostUsername);
    console.log("GUID: " + lobby.guid);
    console.log(lobby.getAllUsernames());
    
    /* Test adding user */
    user = new User('Sally', 'soket456');
    if(lobby.addUser(user)) {
        console.log("Added user: " + user.username);
    } else {
        console.log("Failed to add " + user.username);
    }

    /* Test duplicate username */
    duplicate = new User('JaneDoe', 'socket789');
    if(lobby.addUser(duplicate)) {
        console.log("Added user: " + duplicate.username);
    } else {
        console.log("Failed to add " + duplicate.username);
    }

    console.log(lobby.getAllUsernames());

    /* Test remove user */
    lobby.removeUser("Sally");
    console.log(lobby.getAllUsernames());
}


testLobbyClass();