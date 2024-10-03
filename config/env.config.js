require('dotenv').config();

function checkEnvironmentVariables() {
    if (typeof process.env.OPENAI_API_KEY === 'undefined') {
        throw new Error('Environment variable OPENAI_API_KEY not set.');
    }
}

module.exports = { checkEnvironmentVariables };