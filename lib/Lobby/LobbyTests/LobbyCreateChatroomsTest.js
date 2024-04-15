const Lobby = require('../Lobby'); // Import lobby class
const User = require('../../User/User');

function testLobbyClass() {
    /* GENERAL CASE */
    console.log("GENERAL CASE\n");

    const lobby = new Lobby('Kiran');
    
    /* Add users */
    const userNames = ['Ariel', 'Belle', 'Cinderella', 
        'Mulan', 'Merida', 'Tiana', 'Moana',
        'Aurora', 'Jasmine', 'Snow White']; // 10 users

    userNames.forEach(name => {
        const user = new User(name);
        lobby.addUser(user);
    });
    console.log(lobby.getAllUsernames());

    /* Min chatroom size = 4, should create 2 chatrooms, 5 users each. */
    let chatrooms = lobby.createChatrooms();
    console.log(chatrooms, "chatrooms created.");
    console.log(lobby.chatrooms);

    /* Check if User object overwritten with correct room index. */
    const favPrincess = lobby.getUser('Mulan');
    console.log("Mulan assigned to room index", favPrincess.chatroomIndex);


    /* EDGE CASES */
    console.log("\nEDGE CASES\n");

    /* No users in lobby. */
    const lonelyLobby = new Lobby('Maya');
    console.log(lonelyLobby.getAllUsernames());
    chatrooms = lonelyLobby.createChatrooms();
    console.log(chatrooms, "chatrooms created.");

    /* One user in lobby, < min users per chat. */
    const soloUser = new User('Han Solo');
    lonelyLobby.addUser(soloUser);
    chatrooms = lonelyLobby.createChatrooms();
    console.log(chatrooms, "chatrooms created.");
    console.log(lonelyLobby.chatrooms);
    
    console.log("Han Solo assigned to room index", soloUser.chatroomIndex);
}


testLobbyClass();