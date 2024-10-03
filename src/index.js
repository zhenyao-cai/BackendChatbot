const express = require('express');
const http = require('http');
const { checkEnvironmentVariables } = require('../config/env.config');
const { initializeFirebase } = require('../config/firebase.config');
const initializeSocketIo = require('./socket');
const { port } = require('../config/server.config');

// Load and check environment variables
checkEnvironmentVariables();

// Initialize the express application
const app = express();

// Create a local HTTP server
const server = http.createServer(app);

// Initialize Firebase Admin SDK
const database = initializeFirebase();

// Socket initialized in socket.js
initializeSocketIo(server, database);

// Start the server
server.listen(port, () => console.log(`Listening on port ${port}`));