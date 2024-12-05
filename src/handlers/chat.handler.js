const { formatTimestamp } = require("../../utils/date.utils");

module.exports = function registerChatHandlers(socket, io, db, lobbyManager) {
  // Updates chat data, needed to initialize chatrooms
  socket.on("updateChatSettings", async (guid, chatData) => {
    console.log("updateChatSettings");
    const foundLobby = lobbyManager.getLobby(guid);

    if (foundLobby) {
      foundLobby.chatSettings = {
        botname: chatData.botname,
        chatLength: chatData.chatLength,
        assertiveness: chatData.assertiveness,
        topic: chatData.topic,
        chatName: chatData.chatName,
        participantsPerRoom: chatData.participantsPerRoom,
        testMode: chatData.testMode,
        botType: chatData.botType,
      };

      // update the bot details to database
      const lobbyRef = db.ref('lobbies').child(guid);
      lobbyRef.update({
          test_mode: chatData.testMode,
          bot_type: chatData.botType,
      });

    } else {
      console.log("Error: Lobby not found.");
    }
  });

  // Create Chatrooms: separates list of users to join separate chatrooms
  socket.on("createChatrooms", async (guid) => {
    console.log("Creating Chatrooms");
    const foundLobby = lobbyManager.getLobby(guid);
    const totalChatrooms = foundLobby.createChatrooms(io);

    if (totalChatrooms === 0) {
      console.log("No chatrooms created.");
      socket.emit("chatroomError", "Error creating chatrooms.");
      return;
    }

    // Send chatroom guid with list of users to frontend
    const chatroomMap = foundLobby.getChatroomMap();
    socket.emit("createChatroomsResponse", chatroomMap);

    // Initialize one bot per chatrooms
    console.log("createChatrooms success, initializing bots...");
    foundLobby.initializeBots(guid, io, db);

    // Begin timer
    foundLobby.startTimer(io, guid);
  });

  // Send messages within a chatroom, use .to(chat_guid) to direct messages
  socket.on("chatMessage", async (lobby_guid, chat_guid, messageData) => {
    console.log("chatMessage: Sending message...");
    const foundLobby = lobbyManager.getLobby(lobby_guid);

    if (foundLobby) {
      const foundChatbot = foundLobby.getChatbot(chat_guid);

      if (foundChatbot) {
        // Send message to chat
        io.to(chat_guid).emit("message", messageData);
        console.log(` > messageData to ${chat_guid}: ${messageData.text}`);

        // Dynamic firebase access, record new message
        const chatroomRef = db.ref(
          `lobbies/${lobby_guid}/chatrooms/${chat_guid}/messages`,
        );
        let newMessageRef = chatroomRef.push();
        newMessageRef.set({
          timestamp: messageData.timestamp,
          sender: messageData.sender,
          text: messageData.text,
        });

        const respond = await foundChatbot.botMessageListener(
          messageData.sender,
          messageData.text,
          messageData.timestamp,
        );

        if (respond) {
          io.to(chat_guid).emit("message", {
            sender: foundChatbot.getBotName(),
            text: respond,
            timestamp: formatTimestamp(new Date().getTime()),
          });

          newMessageRef = chatroomRef.push();
          newMessageRef.set({
            timestamp: messageData.timestamp,
            sender: foundChatbot.getBotName(),
            text: respond,
          });
        }
      } else {
        console.log("Error: Chatroom not found.");
      }
    } else {
      console.log("Error: Lobby not found.");
    }
  });

  // Returns chatSettings: time, topic, and chatroom name
  socket.on("getChatData", async (guid) => {
    console.log("getChatData");
    const foundLobby = lobbyManager.getLobby(guid);

    if (foundLobby) {
      // Can broadcast to entire lobby?
      io.to(guid).emit("chatData", foundLobby.getChatSettings());
    }
  });

  // Prompts chatbot to chime in to an inactive lobby
  socket.on("lobbyInactivity", async (guid, chat_guid) => {
    console.log("lobbyInactivity");
    const foundLobby = lobbyManager.getLobby(guid);

    if (foundLobby) {
      const foundChatbot = foundLobby.getChatbot(chat_guid);

      if (foundChatbot) {
        const inactivityMessage = await foundChatbot.inactivityResponse();

        io.to(chat_guid).emit("message", {
          text: inactivityMessage,
          sender: foundChatbot.getBotName(),
          timestamp: formatTimestamp(new Date().getTime()),
        });

        const chatroomRef = db.ref(
          `lobbies/${guid}/chatrooms/${chat_guid}/messages`,
        );
        let newMessageRef = chatroomRef.push();
        newMessageRef.set({
          timestamp: formatTimestamp(new Date().getTime()),
          sender: foundChatbot.getBotName(),
          text: inactivityMessage,
        });
      }
    }
  });

  // Begin chat conclusion phase, prompt chatbot for conclusion prompt
  socket.on("chatStartConclusionPhase", async (guid, chat_guid, timeLeft) => {
    console.log("chatStartConclusionPhase ON PAUSE");
    const foundLobby = lobbyManager.getLobby(guid);

    if (foundLobby) {
      const foundChatbot = foundLobby.getChatbot(chat_guid);

      if (foundChatbot) {
        const conclusionMessage = await foundChatbot.startConclusion(timeLeft);

        io.to(chat_guid).emit("message", {
          text: conclusionMessage,
          sender: foundChatbot.getBotName(),
          timestamp: formatTimestamp(new Date().getTime()),
        });

        const chatroomRef = database.ref(
          `lobbies/${guid}/chatrooms/${chat_guid}/messages`,
        );
        let newMessageRef = chatroomRef.push();
        newMessageRef.set({
          timestamp: formatTimestamp(new Date().getTime()),
          sender: foundChatbot.getBotName(),
          text: conclusionMessage,
        });
      }
    }
  });
};

