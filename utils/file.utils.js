const fs = require('fs');

function readFileContent(fileName) {
    try {
      const fileContent = fs.readFileSync(fileName, 'utf8');
      return fileContent;
    } catch (err) {
      console.error('Error reading the file:', err);
      return null;
    }
}

module.exports = { readFileContent };