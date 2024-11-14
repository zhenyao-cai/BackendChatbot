// Function to generate a unique 4-character GUID
function generateGUID() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

module.exports = { generateGUID };