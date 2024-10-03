const Lobby = require('../Lobby'); // Import lobby class
const User = require('../../src/models/user');

function testLobbyClass() {
    const lobby = new Lobby('Kiran');

    console.log("Host: " + lobby.hostUsername);
    console.log(lobby.getAllUsernames()); // Will have no users in lobby, host is not considered user
    
    /* Test adding user */
    user = new User('Sally');
    if(lobby.addUser(user)) {
        console.log("Added user: " + user.username);
    } else {
        console.log("Failed to add " + user.username);
    }

    user = new User('JaneDoe');
    if(lobby.addUser(user)) {
        console.log("Added user: " + user.username);
    } else {
        console.log("Failed to add " + user.username);
    }

    /* Test duplicate username, should not have duplicate names */
    duplicate = new User('Sally');
    if(lobby.addUser(duplicate)) {
        console.log("Added user: " + duplicate.username);
    } else {
        console.log("Failed to add " + duplicate.username);
    }

    console.log(lobby.getAllUsernames());

    /* Test remove user */
    lobby.removeUser("Sally");
    console.log(lobby.getAllUsernames());

    console.log(lobby.getUserAssignedGUID('JaneDoe'));
    lobby.setUserAssignedGUID('JaneDoe', 2);
    console.log(lobby.getUserAssignedGUID('JaneDoe'));
}

testLobbyClass();