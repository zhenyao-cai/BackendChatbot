class Host {
    /**
     * Stores properties of host user, return socketId for 
     * Host obejects have access to all chatrooms within their Lobby.
     * @param {String} socketId - The socket.id of the host client.
     * @param {String} hostUsername - The name of the lobby host. 
     */
    constructor(socketId, hostUsername) {
        this.socketId = socketId;
        this.hostUsername = hostUsername;  
        // this.isActive = true; Hosts MUST be active for Lobby to exist
    }

    getSocketId() {
        return this.socketId;
    }

    getHostUsername() {
        return this.hostUsername;
    }

    // if host is inactive, the host, entire lobby, chatrooms, and users must be
    // deleted. active users in lobby are returned to the home page
    // markInactive() {
    //     this.isActive = false;
    //     console.log(`Host ${this.hostUsername} marked as inactive.`);
    // }
}

module.exports = Host;