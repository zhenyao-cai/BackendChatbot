# Backend EduChatBot Web-Application

## How to run on Git Bash
1) Navigate to local repository
2) Run the following command: > node src/index.js

## Directory Structure
#### src/
Contains all source code, organized into models and managers. Contains entry-point file index.js, and socket.js for WebSocket logic.  
Naming conventions: lowerCamelCase.js, {name}.handler.js, {name}.manager.js
#### tests/
Contains all tests, mirroring the structure of the src/ directory.  
Naming conventions: {name}.test.js
#### utils
Contains utility code, separated into different files for reusability.  
Naming conventions: {name}.util.js
#### config/
For configuration files (database configuration, environment-specific settings).
#### scripts/
Empty folder, for build scripts, deployment scripts, etc.
