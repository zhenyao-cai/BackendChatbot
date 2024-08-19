const User = require('../User'); // Import user class, .js assumed

function testUserClass() {
    const user = new User('JaneDoe', 'socket123');

    console.log(user.username); // Accesses get username() "JaneDoe"
    user.username = "Sally"; // Rename
    console.log(user.username); // Accesses get username() "Sally"
    console.log(user.socketId); // Accesses get socketId() "socket123"
    console.log(user.score); // Accesses get score() 0
    user.score = 10; // Accesses set score(newScore) 
    console.log(user.score); // 10
    user.score = 1.5; // Console log error, invalid value
    console.log(user.score);
}

testUserClass();