// For test files
// require('dotenv').config();

const { OpenAI } = require("openai");
const {readFileContent } = require('../../../utils/file.utils');
const {formatTimestamp } = require('../../../utils/date.utils');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const { Worker } = require('worker_threads');
// const { MessageFilesPage } = require("openai/resources/beta/threads/messages/files.mjs");

class WorkerManager {
    constructor(rulesOrder) {
        this.worker = new Worker('./src/handlers/workers.js');
        this.promises = new Map();
        this.rulesOrder = rulesOrder;
        this.worker.on('error', (error) => console.error("Worker error:", error));
        this.worker.on('exit', (code) => console.log(`Worker exited with code: ${code}`));
        this.worker.on('message', (response) => this.handleTask(response));

    }

    async sendTask(data) {
        return new Promise((resolve, reject) => {
            const messageId = Math.random().toString(36).substring(2, 15);
            this.promises.set(messageId, { resolve, reject });
            this.worker.postMessage({ ...data, messageId, rulesOrder: this.rulesOrder});
        });
    }

    handleTask(message) {
        const { messageId, result, error } = message;
        const promise = this.promises.get(messageId);
        if (promise) {
            if (error){
                promise.reject(error);
            }else{
                promise.resolve(result);
            }

            this.promises.delete(messageId);
        }
    }

    terminate() {
        this.worker.terminate();
    }
}

class Chatbot {
    /**
     * Constructs a new instance of the ChatBot class.
     * Uses OpenAI API to generate prompts and responses,
     * manages user participation.
     * @param {Array} users - A list of users participating in the chat.
     * @param {String} topic - The topic of the chat discussion.
     * @param {String} [botname='ChatZot'] - The name of the bot.
     * @param {Number} [assertiveness=2] - The bot's assertiveness level, affects participation ratio.
     */
    constructor(users, topic, botname="ChatZot", assertiveness=2, rulesOrder = ["cognitive", "collaborative", "productivity"]) {
        this.users = users;
        console.log("Users in chat:", this.users);
        this.topic = topic;
        this.initialQuestion = '';
        this.explanation = ''; 
        this.example = '';
        this.manager = new WorkerManager(rulesOrder);

        // Initialize the time tracker worker
        this.timeTracker = new Worker('./src/handlers/time_tracker.js');
		// Send the initial list of users to the timeTracker worker

        
        this.botname = botname;
        this.assertiveness = assertiveness;

        // assertiveness is 2 in parameter
        this.participationRatio = this.assertiveness === 1 ? 0.05 : (this.assertiveness === 2 ? 0.15 : 0.25);

        this.messageRatios = Array(users.length).fill(0);
        this.countPerUser = Array(users.length).fill(0);
        this.messageCount = 0;

        this.behaviorPrompt = readFileContent(
            'src/models/chatbot/prompts/behavior_prompt.txt'
        );
        // this.chimePrompt = readFileContent(
        //     'src/models/chatbot/prompts/chime_prompt.txt'
        // );
        this.participationPrompt = readFileContent(
            'src/models/chatbot/prompts/participation_prompt.txt'
        );
        this.classificationPrompt = readFileContent(
            'src/models/chatbot/prompts/classification_prompt.txt'
            // 'src/models/chatbot/prompts/classification_prompt.txt'
        );
        this.helperPrompt = readFileContent(
            'src/models/chatbot/prompts/helper_prompt.txt'
        )
        
        this.conclusionPrompt = "There is only {{time}} minute left in this discussion. Please prompt the users to WRAP UP THEIR DISCUSSION by supplying their final remarks.";

        this.behaviorPrompt = this.behaviorPrompt.replace("{{users}}", users.toString());
        this.behaviorPrompt = this.behaviorPrompt.replace("{{topic}}", topic);
        // this.chimePrompt = this.chimePrompt.replace("{{botname}}", botname);
        this.classificationPrompt = this.classificationPrompt.replace("{{topic}}", topic);

        this.behaviorMessages = [{role: "system", content: this.behaviorPrompt}];
        // this.chimeMessages = [{role: "system", content: this.chimePrompt}];
        this.classificationMessages = [{role: "system", content: this.classificationPrompt}];

        // CALL INITIALIZE PROMPTING AFTER CONSTRUCTOR
    }

    initializeTimeTracker(io, chat_guid) {
        this.timeTracker.postMessage({
            type: 'initializeUsers',
            users: this.users
        });

        
        // Set up the worker's message listener
        // This method gets called by time_tracker.js every 30 seconds to check inactive participant
        this.timeTracker.on('message', async (message) => {
            if (message.type === 'inactiveParticipants') {
                let inactiveUsers = message.participants.join(', ');
                console.log(`Notifying Message for Inclusivity to users: "${inactiveUsers}"`);
                let response = await this.sendMessage(4, inactiveUsers);
                console.log(` > messageData to ${chat_guid}: ${response}`);
                if (response) {
                    io.to(chat_guid).emit('message', { 
                        sender: this.getBotName(), 
                        text: response, 
                        timestamp: formatTimestamp(new Date().getTime()) 
                    });
                    response = null;
                }
            }
        });    
    }

    getBotName() {
        return this.botname;
    }

    getInitialQuestion() {
        return this.initialQuestion;
    }

    getUsers() {
        return this.users;
    }

    async initializePrompting() {
        try {
            console.log("Starting question generation...");

            let completion = await openai.chat.completions.create({
                messages: this.behaviorMessages,
                model: "gpt-3.5-turbo-1106",
            });

            this.initialQuestion = completion.choices[0].message.content;
            this.behaviorMessages.push({role: "assistant", content: completion.choices[0].message.content});
            this.classificationMessages.push({role: "user", name: "teacher", content: completion.choices[0].message.content});

            return this.initialQuestion;

        } catch (error) {
            console.error('An error occurred:', error.message);
            return false;
        }
    }

    async botMessageListener(user, message, timestamp) {
        // Recieves messages as input and decides whether to respond
        let lowParticipationUser = this.participationTracker(user);
        console.log("lowParticipationUser")
        // this.chimeMessages.push({role: "user", name: user, content: message});
        this.behaviorMessages.push({role: "user", name: user, content: message});
        this.classificationMessages.push({role: "user", name: user, content: message});

        console.log("\nclassification prompts", this.classificationMessages);

        try {
            console.log(`"this.classificationMessages.length is "${this.classificationMessages.length}"`);
            // Start time tracking when the first message arrives
            // if (this.classificationMessages.length === 3 ) {
            //     this.timeTracker.postMessage({ type: 'start' });
            // }

            // Update participant's activity in the time tracker
            

            // Use the latest K messages to classify
            while ( this.classificationMessages.length > 11 ) {
                this.classificationMessages.splice(1, 1);
            }
            
            const classificationResponse = await openai.chat.completions.create({
                messages: this.classificationMessages,
                model: "gpt-3.5-turbo-1106"
            });

            const classificationResult = classificationResponse.choices[0].message.content.trim();
            console.log(`\n\nClassification result for "${message}": ${classificationResult}\n\n`);

            this.classificationMessages.push({role: "assistant", content: classificationResult});
            const resultDict = {}, regex = /(\w+ Code): \[([^\]]+)\]/g;
            let match;
            while ((match = regex.exec(classificationResult)) !== null) {
                // const key = match[1], value = match[2];
                const key = match[1].toLowerCase().replace(/ /g, "_"), value = match[2];
                resultDict[key] = value;
            }

            this.timeTracker.postMessage({
                type: 'activity',
                participantId: user,
                cognitive_code: resultDict['cognitive_code'] || 'NA',
                timestamp
            });

            try{
                const workerMessage = await this.manager.sendTask(resultDict);

                console.log("\n\nworker classify result", workerMessage);
                let temphelper = this.helperPrompt;

                switch (workerMessage){
                    case 'build':
                        temphelper = temphelper.replace("{{explanation}}", "Encourage students to extend from others idea");
                        temphelper = temphelper.replace("{{example}}", "Why do you agree on ... Do you have any additional thoughts?");
                        break;
                    case 'challenge':
                        temphelper = temphelper.replace("{{explanation}}", "Encourage students to pose counterarguments");
                        temphelper = temphelper.replace("{{example}}", "Does anyone see this differently?");
                        break;
                    case 'peers_encourage':
                        temphelper = temphelper.replace("{{explanation}}", "Encourage group discussion when students ask for hint or express confusion");
                        temphelper = temphelper.replace("{{example}}", "Does anyone want to jump in and help out with this?");
                        break;
                    case 'comprehension':
                        temphelper = temphelper.replace("{{explanation}}", "Asks for a process, reasons or term to be described or defined");
                        temphelper = temphelper.replace("{{example}}", "Can you explain your thinking to the group?");
                        break;
                    case 'hint':
                        temphelper = temphelper.replace("{{explanation}}", "If the student's knowledge of the material is incomplete.");
                        temphelper = temphelper.replace("{{example}}", "'Can anyone help?' or 'Have you thought about … ?' or 'How about … ?'");
                        break;
                    case 'prompt':
                        temphelper = temphelper.replace("{{explanation}}", "Help students when students display misconceptions, gaps in understanding, or errors in reasoning");
                        temphelper = temphelper.replace("{{example}}", "'What led you to this conclusion?' or 'Does anyone have different opinions?'");
                        break;
                    case 'redirect':
                        temphelper = temphelper.replace("{{explanation}}", "Steer a conversation back to the topic in a discussion");
                        temphelper = temphelper.replace("{{example}}", "Thank you for sharing, now let's bring our focus back to [topic]");
                        break;
                }
                

                if (workerMessage != 'NA'){
                    this.behaviorMessages.push({role: "system", content: temphelper});
                    let response = await this.sendMessage(0);
                    return response;
                }
            }catch (error){
                console.log('\nWorker Error: ', error);
            }

        } catch (error) {
            // ERROR
            return 0;
        }
    }

    participationTracker(userName) {
        // refreshes ratios and checks if someone isnt participating enough
        const index = this.users.indexOf(userName);
        console.log("index is"+index);
        this.messageCount++;

        this.countPerUser[index] += 1;

        console.log(userName + this.countPerUser[index])

        // Update ratios
        for (let i = 0; i < this.users.length; i++) {
          this.messageRatios[i] = this.countPerUser[i] / this.messageCount;
        }

        // Check for ratios less than 0.05
        for (let i = 0; i < this.users.length; i++) {
            console.log(this.messageRatios[i])
          if (this.messageRatios[i] < this.participationRatio) {
            return this.users[i];
          }
        }
        return null;
    }

    // Alert if time is running out, starts the conclusion phase
    async startConclusion(timeLeft) {
        let response = await this.sendMessage(2, timeLeft);
        return response;
    }

    // when no one has sent a message in a while
    async inactivityResponse() {
        let response = await this.sendMessage(3);
        return response;
    }

    async sendMessage(messageCase, user="", time=0) {
        // recieves input and sends response to groupchat
        switch (messageCase) {
            case 0:
                let completion  = await openai.chat.completions.create({
                    messages: this.behaviorMessages,
                    model: "gpt-3.5-turbo-1106"
                });

                this.behaviorMessages.push({role: "assistant", content: completion.choices[0].message.content});
                this.classificationMessages.push({role: "user", name: "teacher", content: completion.choices[0].message.content});

                if (completion.choices[0].message.content.length > 200) {
                    this.behaviorMessages.push({role: "system", content: "Please reiterate your last response, but shorten it to less than 150 characters."});
                    
                    completion  = await openai.chat.completions.create({
                        messages: this.behaviorMessages,
                        model: "gpt-3.5-turbo-1106"
                    });

                    this.behaviorMessages.push({role: "assistant", content: completion.choices[0].message.content});
                    this.classificationMessages.push({role: "user", content: completion.choices[0].message.content});


                    return completion.choices[0].message.content;
                }

                return completion.choices[0].message.content;

            case 1:
                // Participation prompt. replace with students name
                let participationPromptSpecific = this.participationPrompt.replace("{{user}}", user)
                this.behaviorMessages.push({role: "system", content: participationPromptSpecific});

                let completion1  = await openai.chat.completions.create({
                    messages: this.behaviorMessages,
                    model: "gpt-3.5-turbo-1106"
                });

                this.behaviorMessages.push({role: "assistant", content: completion1.choices[0].message.content});

                return completion1.choices[0].message.content;

            case 2:
                // Conclusion prompt. replace with time (minutes) left in discussion
                let conclusionPrompt = this.conclusionPrompt.replace("{{time}}", time);

                this.behaviorMessages.push({role: "system", content: conclusionPrompt});

                let completion2  = await openai.chat.completions.create({
                    messages: this.behaviorMessages,
                    model: "gpt-3.5-turbo-1106"
                });

                this.behaviorMessages.push({role: "assistant", content: completion2.choices[0].message.content});

                return completion2.choices[0].message.content;
            case 3:
                // inactivity prompt
                this.behaviorMessages.push({role: "system", content: "No messages have been sent in some time. Please bring this up to the users and ask them a follow up question."});

                let completion3  = await openai.chat.completions.create({
                    messages: this.behaviorMessages,
                    model: "gpt-3.5-turbo-1106"
                });

                this.behaviorMessages.push({role: "assistant", content: completion3.choices[0].message.content});

                return completion3.choices[0].message.content;
            
            case 4:
                // Inclusivity prompt targeting a specific inactive user
                let inclusivityPrompt = `Tell users to give the response in the chat like this - Hey {{user}}, we’d love to hear your thoughts on the discussion. Don’t hesitate to share!`;
                inclusivityPrompt = inclusivityPrompt.replace("{{user}}", user);
                console.log(inclusivityPrompt);
                
                // this.behaviorMessages.push({ role: "system", content: inclusivityPrompt });
    
                let completion4 = await openai.chat.completions.create({
                    messages: [{ role: "system", content: inclusivityPrompt }], // this.behaviorMessages,
                    model: "gpt-3.5-turbo-1106"
                });
                console.log("$$$$$$$$$$$$$$$$$$$" + completion4.choices[0].message.content);
                // this.behaviorMessages.push({ role: "assistant", content: completion4.choices[0].message.content });
    
                return completion4.choices[0].message.content;
        }

        // 0: chime
        // 1: participation
        // 2: conclusion
        // 3: inactivity
    }
}

module.exports = Chatbot;

