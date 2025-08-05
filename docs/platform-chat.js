// platform-chat.js
// Main logic for coder-themed team chat platform

// Gun setup
const gun = Gun({
  peers: ["https://chatroombackend-jf36.onrender.com/gun"],
});

const user = gun.user();

// Restore Gun user session on load (before any UI logic)
user.recall({ localStorage: true }, () => {
// Initial
const mainSection = document.getElementById("main");
let logoutBtn;
function showChatUI() {
  authSection.style.display = "none";
  mainSection.style.display = "flex";
  loadTeams();
  // Add logout button if not present
  if (!logoutBtn) {
    logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "add-btn";
    logoutBtn.style.marginLeft = "16px";
    logoutBtn.onclick = () => {
      user.leave();
      showLoginUI();
      // Clear UI state
      teamList.innerHTML = "";
      roomList.innerHTML = "";
      messagesDiv.innerHTML = "";
      userList.innerHTML = "";
      roomTitle.textContent = "Select a room";
      authStatus.textContent = "";
      authUsername.value = "";
      authPassword.value = "";
    };
    document.getElementById("sidebar").appendChild(logoutBtn);
  }
  // Always reload rooms for current team
  if (currentTeam) loadRooms();
}
function showLoginUI() {
  authSection.style.display = "flex";
  mainSection.style.display = "none";
  if (logoutBtn) logoutBtn.remove();
  logoutBtn = null;
}
function isAuthenticated() {
  return user.is && user.is.alias;
}
if (isAuthenticated()) {
  showChatUI();
} else {
  showLoginUI();
}

// Dark mode toggle
const darkPref = localStorage.getItem("dark-theme");
if (darkPref === "false") document.body.classList.remove("dark");
else document.body.classList.add("dark");
darkToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("dark-theme", document.body.classList.contains("dark"));
};

// Auth handlers
loginBtn.onclick = async () => {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) {
    authStatus.textContent = "Username and password required.";
    return;
  }
  user.auth(username, password, (ack) => {
    if (ack.err) {
      authStatus.textContent = "Login failed!";
    } else {
      authStatus.textContent = "Logged in!";
      showChatUI();
    }
  });
};
registerBtn.onclick = async () => {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) {
    authStatus.textContent = "Username and password required.";
    return;
  }
  user.create(username, password, (ack) => {
    if (ack.err) {
      authStatus.textContent = "Register failed!";
    } else {
      authStatus.textContent = "Registered! Please login.";
    }
  });
};

// Team/Room logic
addTeamBtn.onclick = () => {
  const name = prompt("Team name?");
  if (!name) return;
  gun.get("teams").set({ name });
};
addRoomBtn.onclick = () => {
  if (!currentTeam) return alert("Select a team first");
  const name = prompt("Room name?");
  if (!name) return;
  gun.get(`team-${currentTeam}-rooms`).set({ name });
  setTimeout(loadRooms, 500); // Refresh room list after adding
};

function loadTeams() {
  teamList.innerHTML = "";
  gun
    .get("teams")
    .map()
    .once((data, id) => {
      if (!data || !data.name) return;
      const li = document.createElement("li");
      li.textContent = data.name;
      li.onclick = () => selectTeam(data.name);
      if (data.name === currentTeam) li.classList.add("active");
      teamList.appendChild(li);
    });
}
function selectTeam(team) {
  currentTeam = team;
  loadTeams();
  loadRooms();
  // Clear current room selection
  currentRoom = null;
  roomTitle.textContent = `${currentTeam} / Select a room`;
  messagesDiv.innerHTML = "";
  userList.innerHTML = "";
}
function loadRooms() {
  roomList.innerHTML = "";
  gun
    .get(`team-${currentTeam}-rooms`)
    .map()
    .once((data, id) => {
      if (!data || !data.name) return;
      const li = document.createElement("li");
      li.textContent = data.name;
      li.onclick = () => selectRoom(data.name);
      if (data.name === currentRoom) li.classList.add("active");
      roomList.appendChild(li);
    });
  watchAllRoomsForUnread();
}
function selectRoom(room) {
  currentRoom = room;
  roomTitle.textContent = `${currentTeam} / ${room}`;
  messagesDiv.innerHTML = "";
  userList.innerHTML = "";
  document.getElementById("chat-panel").style.display = "flex";
  document.getElementById("input-form").style.display = "flex";
  listenForMessages();
  listenForUsers();
  showRoomTopic();
  showPinnedMessages();
}

// Room topic logic
function showRoomTopic() {
  if (!currentTeam || !currentRoom) {
    roomTopicBar.style.display = "none";
    return;
  }
  const topicRef = gun.get(`team-${currentTeam}-room-${currentRoom}-topic`);
  topicRef.once((data) => {
    if (data && data.topic) {
      roomTopicBar.textContent = "Topic: " + data.topic;
      roomTopicBar.style.display = "block";
    } else {
      roomTopicBar.textContent = "No topic set. ";
      roomTopicBar.style.display = "block";
    }
    // Allow setting topic if user is in room
    roomTopicBar.onclick = () => {
      const t = prompt("Set room topic:", data && data.topic ? data.topic : "");
      if (t !== null) topicRef.put({ topic: t });
    };
    roomTopicBar.title = "Click to set/change topic";
  });
}

// Pinned messages logic
function showPinnedMessages() {
  if (!currentTeam || !currentRoom) {
    pinnedMessagesDiv.style.display = "none";
    return;
  }
  pinnedMessagesDiv.innerHTML = "";
  const pinRef = gun.get(`team-${currentTeam}-room-${currentRoom}-pins`);
  pinRef.map().once((data, id) => {
    if (!data || !data.message) return;
    const pin = document.createElement("div");
    pin.className = "msg";
    pin.style.borderLeft = "4px solid var(--accent)";
    pin.innerHTML = `<div class='meta'>📌 ${
      data.username
    } <span style='float:right;'>${new Date(
      data.timestamp
    ).toLocaleTimeString()}</span></div>${escapeHtml(data.message)}`;
    pinnedMessagesDiv.appendChild(pin);
  });
  pinnedMessagesDiv.style.display = pinnedMessagesDiv.innerHTML
    ? "block"
    : "none";
}

// Copy room link
copyRoomLinkBtn.onclick = () => {
  if (!currentTeam || !currentRoom) return;
  const url = `${location.origin}${location.pathname}?team=${encodeURIComponent(
    currentTeam
  )}&room=${encodeURIComponent(currentRoom)}`;
  navigator.clipboard.writeText(url);
  copyRoomLinkBtn.textContent = "✅";
  setTimeout(() => (copyRoomLinkBtn.textContent = "🔗"), 1200);
};

// Send a message
form.onsubmit = (e) => {
  e.preventDefault();
  if (!currentTeam || !currentRoom) return;
  if (!user.is || !user.is.alias) {
    authStatus.textContent = "You are not logged in. Please login again.";
    showLoginUI();
    return;
  }
  const message = messageInput.value.trim();
  if (!message) return;
  const chat = gun.get(`team-${currentTeam}-room-${currentRoom}-chat`);
  chat.set({ username: user.is.alias, message, timestamp: Date.now() });
  messageInput.value = "";
};

// Track Gun listeners to prevent duplicates
let messagesListenerNode = null;
let usersListenerNode = null;
let shownMessageIds = new Set();

function listenForMessages() {
  messagesDiv.innerHTML = "";
  shownMessageIds.clear();
  if (messagesListenerNode) messagesListenerNode.off();
  const chat = gun.get(`team-${currentTeam}-room-${currentRoom}-chat`);
  // Limit to latest 50 messages
  let messagesArr = [];
  messagesListenerNode = chat.map().on((data, id) => {
    if (!data || !data.message || !data.username) return;
    if (shownMessageIds.has(id)) return;
    shownMessageIds.add(id);
    messagesArr.push({ data, id });
    // Only keep latest 50
    if (messagesArr.length > 50) messagesArr.shift();
    // Clear and re-render
    messagesDiv.innerHTML = "";
    for (const { data, id } of messagesArr) {
      const msg = document.createElement("div");
      msg.className = "msg";
      msg.id = "msg-" + id;
      // Avatar
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = data.username[0].toUpperCase();
      avatar.title = data.username;
      msg.appendChild(avatar);
      // Highlight @mentions and code
      let msgHtml = escapeHtml(data.message)
        // Inline code
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // Code block
        .replace(
          /```([\s\S]*?)```/g,
          (m, code) => `<pre>${escapeHtml(code)}</pre>`
        )
        // Mentions
        .replace(
          /@([a-zA-Z0-9_]+)/g,
          (m, u) =>
            `<span style='color:var(--accent2);font-weight:bold'>@${u}</span>`
        );
      msg.innerHTML += `<div class='meta'>${
        data.username
      } <span class='timestamp'>${new Date(
        data.timestamp
      ).toLocaleTimeString()}</span></div>${msgHtml} <button class='copy-btn' title='Copy'>⧉</button>`;
      // Pin button
      const pinBtn = document.createElement("button");
      pinBtn.textContent = "📌";
      pinBtn.title = "Pin message";
      pinBtn.style =
        "position:absolute;top:8px;right:36px;background:none;border:none;color:var(--accent2);cursor:pointer;";
      pinBtn.onclick = () => {
        gun.get(`team-${currentTeam}-room-${currentRoom}-pins`).set({
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
        });
        showPinnedMessages();
      };
      msg.appendChild(pinBtn);
      msg.querySelector(".copy-btn").onclick = () => {
        navigator.clipboard.writeText(data.message);
      };
      messagesDiv.appendChild(msg);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Unread indicator (basic): mark room as unread if new message arrives and not active
function markRoomUnread(roomName) {
  const roomLis = document.querySelectorAll("#room-list li");
  roomLis.forEach((li) => {
    if (li.textContent === roomName && roomName !== currentRoom) {
      li.classList.add("unread");
    }
  });
}
// Listen for new messages in all rooms for unread indicator
function watchAllRoomsForUnread() {
  if (!currentTeam) return;
  gun
    .get(`team-${currentTeam}-rooms`)
    .map()
    .once((data, id) => {
      if (!data || !data.name) return;
      const chat = gun.get(`team-${currentTeam}-room-${data.name}-chat`);
      chat.map().once((msg, mid) => {
        if (!msg || !msg.timestamp) return;
        // If message is recent and not in current room, mark as unread
        if (data.name !== currentRoom) markRoomUnread(data.name);
      });
    });
}
// Call this after loading rooms
function loadRooms() {
  roomList.innerHTML = "";
  gun
    .get(`team-${currentTeam}-rooms`)
    .map()
    .once((data, id) => {
      if (!data || !data.name) return;
      const li = document.createElement("li");
      li.textContent = data.name;
      li.onclick = () => selectRoom(data.name);
      if (data.name === currentRoom) li.classList.add("active");
      roomList.appendChild(li);
    });
  watchAllRoomsForUnread();
}

// Show room join for direct join (optional)
joinRoomBtn.onclick = () => {
  const room = roomNameInput.value.trim();
  if (!room || !currentTeam) return;
  selectRoom(room);
  // Optionally, add to room list if not present
  gun
    .get(`team-${currentTeam}-rooms`)
    .map()
    .once((data) => {
      if (!data || data.name !== room) {
        gun.get(`team-${currentTeam}-rooms`).set({ name: room });
        setTimeout(loadRooms, 500);
      }
    });
};

// Connection status (optional)
let connected = false;
gun.on("hi", (peer) => {
  connected = true;
  if (roomStatus) roomStatus.textContent = "Connected to relay!";
});
gun.on("bye", (peer) => {
  connected = false;
  if (roomStatus) roomStatus.textContent = "Disconnected from relay!";
});
setTimeout(() => {
  if (!connected && roomStatus) {
    roomStatus.textContent =
      "⚠️ Not connected to relay. Messages will NOT sync!";
  }
}, 5000);
});
