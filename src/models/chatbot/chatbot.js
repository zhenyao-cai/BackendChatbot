const { OpenAI } = require("openai");
require('dotenv').config();
const {readFileContent } = require('../../utils/utils');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class ChatBot {
    /**
     * Constructs a new instance of the ChatBot class.
     * This class facilitates interactive discussions within a group chat, leveraging the OpenAI API to generate 
     * conversation prompts and responses. It manages user participation, initiates discussion topics, 
     * and ensures dynamic interaction throughout the chat session.
     * 
     * @param {Array} users - A list of user identifiers participating in the chat.
     * @param {String} topic - The central topic or theme of the chat discussion.
     * @param {String} [botname='ChatZot'] - The name of the bot.
     * @param {Number} [assertiveness=2] - The bot's assertiveness level, affecting its participation ratio.
     */
    constructor(users, topic, botname="ChatZot", assertiveness=2) {
        this.users = users;
        console.log("Users in chat:", this.users);
        this.topic = topic;
        this.initialQuestion = '';
        this.botname = botname;
        this.assertiveness = assertiveness;

        // assertiveness is 2 in parameter
        if (this.assertiveness == 1) {
            this.participationRatio = 0.05;
        } else if (this.assertiveness == 2) {
            this.participationRatio = 0.15;
        } else {this.participationRatio = 0.25;}

        this.messageRatios = [];
        this.countPerUser = [];
        this.messageCount = 0;

        this.behaviorPrompt = readFileContent("lib/ChatBot/Prompts/behavior_prompt.txt");
        this.chimePrompt = readFileContent("lib/ChatBot/Prompts/chime_prompt.txt");
        this.participationPrompt = readFileContent("lib/ChatBot/Prompts/participation_prompt.txt");
        
        this.conclusionPrompt = "There is only {{time}} minute left in this discussion. Please prompt the users to WRAP UP THEIR DISCUSSION by supplying their final remarks.";

        this.behaviorPrompt = this.behaviorPrompt.replace("{{users}}", users.toString());
        this.behaviorPrompt = this.behaviorPrompt.replace("{{topic}}", topic);
        this.chimePrompt = this.chimePrompt.replace("{{botname}}", botname);

        this.behaviorMessages = [{role: "system", content: this.behaviorPrompt}];
        this.chimeMessages = [{role: "system", content: this.chimePrompt}];

        // CALL INITIALIZE PROMPTING AFTER CONSTRUCTOR
    }

    async initializePrompting() {
        try {
            console.log("Starting question generation...");
            
            let completion = await openai.chat.completions.create({
                messages: this.behaviorMessages,
                model: "gpt-3.5-turbo-1106",
            });

            console.log("Question generated.");

            this.initialQuestion = completion.choices[0].message.content;
            console.log(` > Prompt: ${this.initialQuestion}`); // check prompt

            this.behaviorMessages.push({role: "assistant", content: completion.choices[0].message.content});
            return true;

        } catch (error) {
            console.error('An error occurred:', error.message);
            return false;
        }
    }

    async botMessageListener(user, message, timestamp) {
        // Recieves messages as input and decides whether to respond
        let lowParticipationUser = this.participationTracker(user);

        this.chimeMessages.push({role: "user", name: user, content: message});
        this.behaviorMessages.push({role: "user", name: user, content: message});
        
        try {
            let completion  = await openai.chat.completions.create({
                messages: this.chimeMessages,
                model: "gpt-3.5-turbo-1106"
            })

            console.log(completion.choices[0].message.content);

            if (completion.choices[0].message.content == "...") {
                this.chimeMessages.push({role: "assistant", content: "..."});
                
                if (lowParticipationUser) {
                    let response = await this.sendMessage(1, user=user);
                    return response;
                }

            } else {
                this.chimeMessages.push({role: "assistant", content: "CHIME."});
                let response = await this.sendMessage(0);
                return response;
            }
        } catch (error) {
            // ERROR
            return 0;
        }
    }

    participationTracker(userName) {
        // refreshes ratios and checks if someone isnt participating enough
        const index = this.users.indexOf(userName);
        this.messageCount++;

        this.countPerUser[index] += 1;
    
        // Update ratios
        for (let i = 0; i < this.users.length; i++) {
          this.messageRatios[i] = this.countPerUser[i] / this.messageCount;
        }
    
        // Check for ratios less than 0.05
        for (let i = 0; i < this.users.length; i++) {
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

                if (completion.choices[0].message.content.length > 200) {
                    this.behaviorMessages.push({role: "system", content: "Please reiterate your last response, but shorten it to less than 150 characters."});

                    completion  = await openai.chat.completions.create({
                        messages: this.behaviorMessages,
                        model: "gpt-3.5-turbo-1106"
                    });

                    this.behaviorMessages.push({role: "assistant", content: completion.choices[0].message.content});

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

        }

        // 0: chime 
        // 1: participation
        // 2: conclusion
        // 3: inactivity
    }

    getInitialQuestion() {
        return this.initialQuestion;
    }
}


module.exports = ChatBot;