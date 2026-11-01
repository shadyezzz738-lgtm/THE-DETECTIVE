// Firebase multiplayer for THE DETECTIVE
// Paste your Firebase Web App config in firebase-config.js (see that file).
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, onValue, runTransaction, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let currentRoom = null;
let stopRoomListener = null;
let publishing = false;
let lastRemoteFingerprint = "";

const $ = (id) => document.getElementById(id);
const status = (message, error = false) => {
  const el = $("online-status");
  if (el) {
    el.textContent = message;
    el.style.color = error ? "#ffaaa0" : "#9be2c8";
  }
};
const cleanName = (value) => (value || "محقق").trim().replace(/[.#$\[\]/]/g, "").slice(0, 20) || "محقق";
const makeCode = () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split("").sort(() => Math.random() - .5).slice(0, 6).join("");
const roomRef = (code) => ref(db, "rooms/" + code);

async function ensureUser() {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}
function stopListening() {
  if (stopRoomListener) stopRoomListener();
  stopRoomListener = null;
}
function renderRoom(room) {
  const members = Object.values(room.members || {});
  const isHost = auth.currentUser && room.hostUid === auth.currentUser.uid;
  const names = members.map(m => (m.name || "محقق") + (m.online ? " 🟢" : " ⚪")).join("، ");
  const el = $("online-lobby");
  if (!el) return;
  el.innerHTML = `
    <button class="back" onclick="TDOnline.leaveRoom()">→ مغادرة الغرفة</button>
    <div class="lobby-card">
      <span class="badge">ONLINE CO-OP · ${room.status === "playing" ? "IN GAME" : "WAITING"}</span>
      <h2>🕵️ غرفة التحقيق</h2>
      <p class="lobby-note">ابعت الكود ده لأصحابك عشان يدخلوا نفس الغرفة.</p>
      <div style="direction:ltr;text-align:center;font-size:32px;letter-spacing:7px;font-weight:900;color:#79d9c6;padding:12px">${currentRoom}</div>
      <button class="btn secondary" onclick="navigator.clipboard?.writeText('${currentRoom}').then(()=>alert('تم نسخ الكود')).catch(()=>alert('انسخ الكود يدويًا'))">نسخ الكود</button>
      <p class="lobby-note"><b>المحققون (${members.length}/10):</b><br>${names || "بانتظار اللاعبين"}</p>
      <label for="room-case">اختار القضية</label>
      <select id="room-case" ${isHost ? "" : "disabled"}>${(window.TDGame?.getCaseOptions?.() || []).map(item => `<option value="${item.index}" ${Number(room.caseIndex || 0) === item.index ? "selected" : ""}>القضية ${item.index + 1}: ${item.title}</option>`).join("")}</select>
      ${isHost ? '<button class="btn" onclick="TDOnline.startCase()">بدء التحقيق / فتح القضية</button>' : '<p class="lobby-note">المضيف هو اللي يبدأ القضية. استنى لحظة…</p>'}
      <div id="online-status" class="lobby-note" aria-live="polite">متصل بالغرفة</div>
    </div>`;
}
function listenRoom(code) {
  stopListening();
  stopRoomListener = onValue(roomRef(code), snapshot => {
    const room = snapshot.val();
    if (!room) {
      status("الغرفة اتقفلت أو لم تعد موجودة.", true);
      currentRoom = null;
      return;
    }
    renderRoom(room);
    if (room.status === "playing" && room.gameState && window.TDGame) {
      const fingerprint = JSON.stringify([room.caseIndex, room.gameState]);
      if (fingerprint !== lastRemoteFingerprint) {
        lastRemoteFingerprint = fingerprint;
        window.TDGame.applyRemoteState(Number(room.caseIndex || 0), room.gameState);
      }
      const lobby = $("online-lobby");
      if (lobby) lobby.classList.add("hidden");
      const mode = $("mode-screen");
      if (mode) mode.classList.add("hidden");
      const cases = $("cases");
      if (cases) cases.classList.add("hidden");
    }
  }, error => status("تعذر تحديث الغرفة: " + error.message, true));
}
async function createRoom() {
  const user = await ensureUser();
  const name = cleanName($("player-name")?.value);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const result = await runTransaction(roomRef(code), current => {
      if (current !== null) return;
      return {
        hostUid: user.uid,
        caseIndex: 0,
        status: "waiting",
        createdAt: Date.now(),
        members: { [user.uid]: { name, online: true, joinedAt: Date.now() } }
      };
    });
    if (result.committed) {
      currentRoom = code;
      await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/online`)).set(false);
      listenRoom(code);
      status("اتعملت الغرفة بنجاح. ابعت الكود لصاحبك.");
      return;
    }
  }
  throw new Error("لم نتمكن من إنشاء كود غرفة فريد. حاول مرة أخرى.");
}
async function joinRoom() {
  const user = await ensureUser();
  const code = ($("room-code")?.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("اكتب كود صحيح مكوّن من 6 حروف أو أرقام.");
  const name = cleanName($("player-name")?.value);
  let failure = "";
  const result = await runTransaction(roomRef(code), room => {
    if (!room) { failure = "الغرفة غير موجودة."; return; }
    room.members = room.members || {};
    if (!room.members[user.uid] && Object.keys(room.members).length >= 10) {
      failure = "الغرفة مكتملة؛ الحد الأقصى 10 لاعبين.";
      return;
    }
    room.members[user.uid] = { name, online: true, joinedAt: Date.now() };
    return room;
  });
  if (!result.committed) throw new Error(failure || "تعذر الانضمام للغرفة.");
  currentRoom = code;
  await onDisconnect(ref(db, `rooms/${code}/members/${user.uid}/online`)).set(false);
  listenRoom(code);
  status("انضميت للغرفة بنجاح.");
}
async function startCase() {
  if (!currentRoom || !auth.currentUser) throw new Error("مش متصل بغرفة.");
  const snapshot = await get(roomRef(currentRoom));
  const room = snapshot.val();
  if (!room || room.hostUid !== auth.currentUser.uid) throw new Error("بدء القضية متاح لمضيف الغرفة فقط.");
  const index = Number($("room-case")?.value ?? window.TDGame?.getCaseIndex?.() ?? 0);
  const state = window.TDGame?.getState?.() ?? { c: [], l: [], f: [], r: {} };
  lastRemoteFingerprint = JSON.stringify([index, state]);
  await update(roomRef(currentRoom), { caseIndex: index, status: "playing", gameState: state, startedAt: Date.now() });
  const lobby = $("online-lobby");
  if (lobby) lobby.classList.add("hidden");
  window.TDGame?.openSharedCase(index, state);
}
async function publishGameState(index, state) {
  if (!currentRoom || publishing || !auth.currentUser) return;
  publishing = true;
  try {
    const snap = await get(roomRef(currentRoom));
    const room = snap.val();
    if (!room || room.status !== "playing") return;
    const fingerprint = JSON.stringify([index, state]);
    if (fingerprint === lastRemoteFingerprint) return;
    lastRemoteFingerprint = fingerprint;
    await update(roomRef(currentRoom), { caseIndex: index, gameState: state, updatedAt: Date.now() });
  } catch (error) {
    console.error("Room sync failed:", error);
  } finally {
    publishing = false;
  }
}
async function leaveRoom() {
  if (currentRoom && auth.currentUser) {
    const code = currentRoom;
    const user = auth.currentUser;
    stopListening();
    const snap = await get(roomRef(code));
    const room = snap.val();
    if (room) {
      if (room.hostUid === user.uid) {
        await set(roomRef(code), null);
      } else {
        await set(ref(db, `rooms/${code}/members/${user.uid}`), null);
      }
    }
  }
  currentRoom = null;
  lastRemoteFingerprint = "";
  if (window.TDGame) {
    $("online-lobby")?.classList.add("hidden");
    $("mode-screen")?.classList.remove("hidden");
  }
}
window.TDOnline = {
  createRoom: () => createRoom().catch(e => status(e.message, true)),
  joinRoom: () => joinRoom().catch(e => status(e.message, true)),
  startCase: () => startCase().catch(e => status(e.message, true)),
  leaveRoom: () => leaveRoom().catch(e => status(e.message, true)),
  publishGameState
};
onAuthStateChanged(auth, user => {
  if (user) console.info("Anonymous Firebase session ready.");
});
window.createOnlineRoom = () => window.TDOnline.createRoom();
window.joinOnlineRoom = () => window.TDOnline.joinRoom();
