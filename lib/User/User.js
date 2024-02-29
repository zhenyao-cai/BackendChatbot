class User {
    /**
     * The User class stores the properties of the chatroom users,
     * created for future scalable operations (i.e. tracking user scores, 
     * status, behaviors, direct messsaging etc.)
     * 
     * @param {String} username - The name of the new user. 
     * @param {String} socketId - The socket.id of the connected client.
     */
    constructor(username, socketId) {
        this.username = username;
        this.socketId = socketId; // Unique identifier, can be user for direct messaging
        //this._score = 0; // Default score, exprerimental "private" property.
    }

/**UNUSED FIELD */
    // get score() {
    //     return this._score;
    // }

    // /** 
    //  * Experimental setter for score property,
    //  * checks if newScore is an integer, 
    //  * otherwise logs an error.
    //  * 
    //  * @param {Number} newScore - The updated integer score
    //  */
    // set score(newScore) {
    //     if (!Number.isInteger(newScore)) {
    //         console.error("Score must be an integer.");
    //     } else {
    //         this._score = newScore;
    //     }
    // }
}


module.exports = User;