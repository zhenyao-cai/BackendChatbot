/**
 * IMPORTANT!
 * Run from project root folder (package.json script):
 *  > npm run chatBotClassTest
 * otherwise path definitions will not work.
 */

const readline = require('readline');
const ChatBot = require('../../src/models/ChatBot');

async function testChatBotClass() {
    const chatBot = new ChatBot(["Student"], "Is AI ethical?");
    const botname = chatBot.botname;

    // Create readline interface for command line input/output
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Prepare ChatBot
    const isSuccess = await chatBot.initializePrompting();
    if (isSuccess) {
        console.log("New bot '" + botname + "' initialized and ready.");
        console.log(botname + ": " + chatBot.getInitialQuestion()); // Display initial question
        // Initial call to start the interaction
        promptUserInput();
    } 
    else {
        console.log("Failed to initialize the ChatBot:");
        rl.close();
    }

    // Function to handle sending messages to the chatbot and displaying responses
    async function handleUserInput(input) {
        // Assuming 'botMessageListener' is the method to handle incoming messages and decide on responses
        // Adjust the method call according to your ChatBot class's API
        const response = await chatBot.botMessageListener("Student", input, new Date().toISOString());
        if (response){
            console.log(botname + ": " + response);
        } else {
            console.log(" > NO RESPONSE");
        }

        // Prompt for the next input
        promptUserInput();
    }

    // Function to prompt user input from command line
    async function promptUserInput() {
        rl.question("You: ", (input) => {
            if (input.toLowerCase() === "exit") { // Allow the user to type 'exit' to quit the application
                rl.close();
            } else {
                handleUserInput(input);
            }
        });
    }

    // Handle readline close event
    rl.on('close', () => {
        console.log('Exiting chat...');
        process.exit(0);
    });

}

testChatBotClass();