const Lobby = require('../Lobby'); // Import lobby class
const User = require('../../User/User');

function testLobbyClass() {
    const lobby = new Lobby('Kiran');

    console.log("Host: " + lobby.hostUsername);
    console.log(lobby.getAllUsernames());
    
    /* Test adding user */
    user = new User('Sally');
    if(lobby.addUser(user)) {
        console.log("Added user: " + user.username);
    } else {
        console.log("Failed to add " + user.username);
    }

    /* Test duplicate username */
    duplicate = new User('JaneDoe');
    if(lobby.addUser(duplicate)) {
        console.log("Added user: " + duplicate.username);
    } else {
        console.log("Failed to add " + duplicate.username);
    }

    console.log(lobby.getAllUsernames());

    /* Test remove user */
    lobby.removeUser("Sally");
    console.log(lobby.getAllUsernames());

    console.log(lobby.getUserIndex('JaneDoe'));
    lobby.setUserIndex('JaneDoe', 2);
    console.log(lobby.getUserIndex('JaneDoe'));
}


testLobbyClass();