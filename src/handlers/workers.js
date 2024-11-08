const { parentPort } = require('worker_threads');

let lastCategory = null;
let countdownTimer = null;
let currentMessageId = null;

async function handleCategory({cognitive_code, collaborative_code, messageId}){
    
    try{
        if (countdownTimer){
            clearTimeout(countdownTimer);
            countdownTimer = null;
            parentPort.postMessage({ messageId: currentMessageId, error: 'timeout cleared' });
        }

        console.log("\nlast category: ", lastCategory)

        currentMessageId = messageId;

        if (cognitive_code === 'Incomplete' && collaborative_code === 'Agree'){
            parentPort.postMessage({ messageId: currentMessageId, result: 'build'});
        }else if (collaborative_code === 'Agree' && lastCategory && lastCategory.collaborative_code === 'Agree'){
            parentPort.postMessage({ messageId: currentMessageId, result: 'challenge'});
        }else if (cognitive_code === 'Confusion'){

            console.log("\nconfusion triggered, time is ", new Date());
            countdownTimer = setTimeout(async () => {
                console.log("countdown finish :", new Date());
                parentPort.postMessage({ messageId: currentMessageId, result: 'peers_encourage'});
            }, 6000);
            
        }else{
            parentPort.postMessage({ messageId: currentMessageId, result: 'NA'});
        }

        lastCategory = {'cognitive_code': cognitive_code, 'collaborative_code': collaborative_code};
    } catch (error) {
        console.error("Error in handleCategory:", error);
        parentPort.postMessage("error");
    }
}

parentPort.on('message', (message) => {
    handleCategory(message);
});