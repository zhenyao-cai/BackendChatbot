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

module.exports = { formatTimestamp };