const admin = require('firebase-admin');  
const serviceAccount = require('../database.json');

function initializeFirebase() {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://chatbot-9eb2b-default-rtdb.firebaseio.com'
        });
        console.log('Firebase initialized successfully.')
        return admin.database();
    } catch (error) {
        console.error('Error initializing Firebase:', error);
    }
}

module.exports = { initializeFirebase };