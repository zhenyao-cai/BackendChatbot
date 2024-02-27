const express = require('express');
const http = require('http');
const initializeSocketIo = require('./lib/socket');
const admin = require('firebase-admin');  

// Initialize the express application
const app = express();

// Create a local HTTP server
const server = http.createServer(app);

// Initialize Firebase Admin SDK 
const serviceAccount = require('./database.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ai-chatbot-65272-default-rtdb.firebaseio.com"
});

// DATABASE NOT USED YET
const database = admin.database();

// Socket initialized in socket.js
initializeSocketIo(server, database);


// Start the server
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Listening on port ${port}`));