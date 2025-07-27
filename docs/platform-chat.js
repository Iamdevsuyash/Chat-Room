// platform-chat.js
// Main logic for coder-themed team chat platform

// Gun setup
const gun = Gun({
  peers: ["https://chatroombackend-jf36.onrender.com/gun"],
});
const user = gun.user();
let currentTeam = null;
let currentRoom = null;
let currentRoomUsers = [];

// Elements
const teamList = document.getElementById("team-list");
const roomList = document.getElementById("room-list");
const addTeamBtn = document.getElementById("add-team-btn");
const addRoomBtn = document.getElementById("add-room-btn");
const roomTitle = document.getElementById("room-title");
const userList = document.getElementById("user-list");
const messagesDiv = document.getElementById("messages");
const form = document.getElementById("input-form");
const messageInput = document.getElementById("message");
const darkToggle = document.getElementById("dark-toggle");
const authSection = document.getElementById("auth-section");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authStatus = document.getElementById("auth-status");
const roomSection = document.getElementById("room-section");
const roomNameInput = document.getElementById("room-name");
const joinRoomBtn = document.getElementById("join-room-btn");
const roomStatus = document.getElementById("room-status");

// Dark mode toggle
const darkPref = localStorage.getItem("dark-theme");
if (darkPref === "false") document.body.classList.remove("dark");
else document.body.classList.add("dark");
darkToggle.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("dark-theme", document.body.classList.contains("dark"));
};

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
}
function selectRoom(room) {
  currentRoom = room;
  roomTitle.textContent = `${currentTeam} / ${room}`;
  messagesDiv.innerHTML = "";
  userList.innerHTML = "";
  listenForMessages();
  listenForUsers();
}

// User presence (simple, not perfect)
function listenForUsers() {
  userList.innerHTML = "";
  const users = gun.get(`team-${currentTeam}-room-${currentRoom}-users`);
  users.map().on((data, id) => {
    if (!data || !data.username) return;
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    avatar.textContent = data.username[0].toUpperCase();
    avatar.title = data.username;
    userList.appendChild(avatar);
  });
  // Add self
  users.get(user.is.alias).put({ username: user.is.alias });
}

// Listen for messages
function listenForMessages() {
  messagesDiv.innerHTML = "";
  const chat = gun.get(`team-${currentTeam}-room-${currentRoom}-chat`);
  chat.map().on((data, id) => {
    if (!data || !data.message || !data.username) return;
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.innerHTML = `<div class='meta'>${
      data.username
    } <span style='float:right;'>${new Date(
      data.timestamp
    ).toLocaleTimeString()}</span></div>${escapeHtml(
      data.message
    )} <button class='copy-btn' title='Copy'>⧉</button>`;
    msg.querySelector(".copy-btn").onclick = () => {
      navigator.clipboard.writeText(data.message);
    };
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Send a message
form.onsubmit = (e) => {
  e.preventDefault();
  if (!currentTeam || !currentRoom) return;
  const message = messageInput.value.trim();
  if (!message) return;
  const chat = gun.get(`team-${currentTeam}-room-${currentRoom}-chat`);
  chat.set({ username: user.is.alias, message, timestamp: Date.now() });
  messageInput.value = "";
};

// Utility
function escapeHtml(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[
        tag
      ])
  );
}

// Show room join for direct join (optional)
joinRoomBtn.onclick = () => {
  const room = roomNameInput.value.trim();
  if (!room || !currentTeam) return;
  selectRoom(room);
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
