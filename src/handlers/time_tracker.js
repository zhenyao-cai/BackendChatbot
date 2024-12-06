const { parentPort } = require('worker_threads');

// Object to store each participant's last activity timestamp
const participants = {};

// Interval ID for the periodic check
let checkInterval = null;


let totalMessages = 0; // Total messages sent by all users
let totalQualityScore = 0; // Total quality score for all users
let totalUsers = 0;  // Total User Count

// Start listening for messages from the main thread
parentPort.on('message', (message) => {
    const { type, participantId, cognitive_code, timestamp, users } = message;

    if (type === 'initializeUsers') {
        // Initialize each user with the current timestamp
        console.log("Initializing users...");
        totalUsers = users.length;
        users.forEach(user => {
            participants[user] = {
                lastActivityTime: Date.now(),
                messageCount: 0,
                qualityScore: 0
            };
        });

        // Start the 30-second check interval if it's not already running
        if (!checkInterval) {
            console.log("TIMER STARTS RUNNING!!! \n======================\n======================");
            checkInterval = setInterval(checkInactiveParticipants, 45000);
        }
    } else if (type === 'activity') {
        // Update the participant's last activity timestamp
        const score = codeToScore(cognitive_code);
        if (participants[participantId]) {
            participants[participantId].lastActivityTime = new Date(timestamp).getTime();
            participants[participantId].messageCount += 1;
            participants[participantId].qualityScore += score;
            totalMessages += 1;
            totalQualityScore += score;
        }

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

    // Compute group averages
    const averageMessageCount = totalMessages / totalUsers || 0;
    const averageQualityScore = totalQualityScore / totalUsers || 0;

    console.log(`Class Averages: Message Count = ${averageMessageCount}, Quality Score = ${averageQualityScore}`);

    // Check each participant's last activity time
    for (const [participantId, data] of Object.entries(participants)) {

        const timeSinceLastActivity = now - data.lastActivityTime;
        console.log(`time since last activity: ${timeSinceLastActivity}`);

        // Identify participants for inclusivity reminders
        const isBelowParticipationThreshold = 
        data.messageCount < averageMessageCount * (1 - 0.25) &&
        data.qualityScore < averageQualityScore * (1 - 0.25);

        console.log(`isBelowParticipationThreshold: ${isBelowParticipationThreshold}`);

        // If a participant hasn't been active in the last 30 seconds, mark them as inactive
        if (timeSinceLastActivity >= 45000 && isBelowParticipationThreshold) {
            inactiveParticipants.push(participantId);
        }

        console.log(`inactiveParticipants: ${inactiveParticipants}`);

        
    }

    // Notify the main thread if there are any inactive participants
    if (inactiveParticipants.length > 0) {
        parentPort.postMessage({
            type: 'inactiveParticipants',
            participants: inactiveParticipants
        });
    }
}

function codeToScore(cognitive_code){
    let qualityScore = 0;
    switch (cognitive_code.toLowerCase()) {
        case 'NA':
            qualityScore = 0;
            break;
        case 'off-topic':
            qualityScore = 0;
            break;
        case 'confusion':
            qualityScore = 1;
            break;
        case 'incomplete':
            qualityScore = 2;
            break;
        case 'incorrect':
            qualityScore = 2;
            break;
        case 'complete':
            qualityScore = 3;
            break;
        default:
            qualityScore = 0;
            console.error(`Unknown cognitive code: ${cognitive_code}`);
    }
    return qualityScore;
}

