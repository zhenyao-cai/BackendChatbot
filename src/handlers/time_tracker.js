const { parentPort } = require('worker_threads');

// Object to store each participant's last activity timestamp
const participants = {};

// Interval ID for the periodic check
let checkInterval = null;

// Start listening for messages from the main thread
parentPort.on('message', (message) => {
    const { type, participantId, timestamp, users } = message;

    if (type === 'initializeUsers') {
        // Initialize each user with the current timestamp
        console.log("Initializing users...");
        users.forEach(user => {
            participants[user] = Date.now();
        });

        // Start the 30-second check interval if it's not already running
        if (!checkInterval) {
            console.log("TIMER STARTS RUNNING!!! \n======================\n======================");
            checkInterval = setInterval(checkInactiveParticipants, 30000);
        }
    } else if (type === 'activity') {
        // Update the participant's last activity timestamp
        participants[participantId] = new Date(timestamp).getTime();
    } else if (type === 'stop') {
        // Stop the interval and clear the participant tracking
        clearInterval(checkInterval);
        checkInterval = null;
    }
});

// Function to check inactive participants and notify the main thread
function checkInactiveParticipants() {
    const now = Date.now();
    const inactiveParticipants = [];

    // Check each participant's last activity time
    for (const [participantId, lastActivityTime] of Object.entries(participants)) {
        const timeSinceLastActivity = now - lastActivityTime;

        // If a participant hasn't been active in the last 30 seconds, mark them as inactive
        if (timeSinceLastActivity >= 30000) {
            inactiveParticipants.push(participantId);
        }
    }

    // Notify the main thread if there are any inactive participants
    if (inactiveParticipants.length > 0) {
        parentPort.postMessage({
            type: 'inactiveParticipants',
            participants: inactiveParticipants
        });
    }
}

