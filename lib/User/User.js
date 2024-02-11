/**
 * The User class stores the properties of the chatroom users,
 * created for future scalable operations (i.e. tracking user scores, 
 * status, behaviors, direct messsaging etc.)
 * Username and socketId only have getters, 
 * so they cannot be modified once constructed.
 */
class User {
    #username; // Private variables declared for encapsulation
    #socketId;
    #score;

    constructor(username, socketId) {
        this.#username = username;
        this.#socketId = socketId; // Unique identifier, can be user for direct messaging
        this.#score = 0; // Default score, exprerimental attribute
    }

    get username() {
        return this.#username;
    }

    get socketId() {
        return this.#socketId;
    }

    get score() {
        return this.#score;
    }
    
    /** 
     * Experimental setter for score property,
     * checks if newScore is an integer, 
     * otherwise throws an error.
     * 
     * @param newScore - The updated integer score
     */
    set score(newScore) {
        if (!Number.isInteger(newScore)) {
            throw new Error("Score must be an integer.");
        }
        this.#score = newScore;
    }
}

function testUserClass() {
    const user = new User('JaneDoe', 'socket123');

    // Testing encapsulation
    user.username = "Sally"; // Should not be renamed

    console.log(user.username); // Accesses get username() "JaneDoe"
    console.log(user.socketId); // Accesses get socketId() "socket123"
    console.log(user.score); // Accesses get score() 0
    user.score = 10; // Accesses set score(newScore) 
    console.log(user.score); // 10
}

testUserClass();