const fs = require('fs');

// Function to generate a unique 4-character GUID
function generateGUID() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Function to format a timestamp into a more readable form
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const options = {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    };

    return date.toLocaleString('en-US', options);
}

function readFileContent(fileName) {
    try {
      const fileContent = fs.readFileSync(fileName, 'utf8');
      return fileContent;
    } catch (err) {
      console.error('Error reading the file:', err);
      return null;
    }
}

module.exports = { generateGUID, formatTimestamp, readFileContent };