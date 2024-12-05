const { RulesetMetadataList } = require('firebase-admin/security-rules');
const { parentPort } = require('worker_threads');

let secLastCategory = null;
let lastCategory = null;
let countdownTimer = null;
let currentMessageId = null;
const rulesMap = new Map();

function collaborativeRules(cognitive_code, collaborative_code, currentMessageId){
    let action = false;

    try{
        if (cognitive_code === 'Incomplete' && collaborative_code === 'Agree'){
            action = true;
            parentPort.postMessage({ messageId: currentMessageId, result: 'build'});
        }else if (collaborative_code === 'Agree' && secLastCategory && secLastCategory.collaborative_code === 'Agree'){
            action = true;
            parentPort.postMessage({ messageId: currentMessageId, result: 'challenge'});
        }else if (cognitive_code === 'Confusion'){
            action = true;

            console.log("\nconfusion triggered");
            countdownTimer = setTimeout(() => {
                console.log("countdown finish :", new Date());
                parentPort.postMessage({ messageId: currentMessageId, result: 'peers_encourage'});
            }, 3000);
            
        }
    }catch (error) {
        console.error("Error in handleCategory:", error);
        parentPort.postMessage("error");
    }
    return action;
}

function cognitiveRules(cognitive_code, collaborative_code, currentMessageId){
    let action = false;

    try{
        if (cognitive_code === 'Incomplete'){
            action = true;

            console.log("\n incomplete triggered"); 
            countdownTimer = setTimeout(() => {
                parentPort.postMessage({ messageId: currentMessageId, result: 'comprehension'});
            }, 3000);
        }else if (cognitive_code === 'Incorrect'){
            action = true;

            console.log("\n incorrect triggered"); 
            countdownTimer = setTimeout(() => {
                parentPort.postMessage({ messageId: currentMessageId, result: 'prompt'});
            }, 3000);
        }else if (cognitive_code === 'Confusion'){
            action = true;

            console.log("\n confusion triggered");
            countdownTimer = setTimeout(() => {
                parentPort.postMessage({ messageId: currentMessageId, result: 'hint'});
            }, 3000);
        }
    }catch (error) {
        console.error("Error in handleCategory:", error);
        parentPort.postMessage("error");
    }
    return action;
}

function productivityRules(cognitive_code, collaborative_code, currentMessageId){
    let action = false;

    try{
        if (lastCategory &&  secLastCategory && cognitive_code === lastCategory.cognitive_code 
            === secLastCategory.cognitive_code === "Off-topic"){
            action = true;

            console.log("\n off-topic triggered")
            parentPort.postMessage({ messageId: currentMessageId, result: 'redirect'});
        }
    }catch (error) {
        console.error("Error in handleCategory:", error);
        parentPort.postMessage("error");
    }
    return action;
}

rulesMap.set("collaborative", collaborativeRules);
rulesMap.set("cognitive", cognitiveRules);
rulesMap.set("productivity", productivityRules);

function handleCategory({cognitive_code, collaborative_code, messageId, rulesOrder}){
    
    try{
        if (countdownTimer){
            clearTimeout(countdownTimer);
            countdownTimer = null;
            parentPort.postMessage({ messageId: currentMessageId, error: 'timeout cleared' });
        }

        console.log("\nlast category: ", lastCategory)
        console.log("\n lastsec category: ", secLastCategory)

        currentMessageId = messageId;

        let action = false;
        for (let i = 0; i < rulesOrder.length; i++){
            if (rulesMap.get(rulesOrder[i])(cognitive_code, collaborative_code, currentMessageId)){
                action = true;
                break;
            }
        }

        if (! action){
            parentPort.postMessage({ messageId: currentMessageId, result: 'NA'});
        }

        secLastCategory = lastCategory;
        lastCategory = {'cognitive_code': cognitive_code, 'collaborative_code': collaborative_code};
    } catch (error) {
        console.error("Error in handleCategory:", error);
        parentPort.postMessage("error");
    }
}

parentPort.on('message', (message) => {
    handleCategory(message);
});