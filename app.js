// ======= GLOBAL VARIABLES =======
let pc;
let channel;
let localStream;
let remoteStream;
let qrScanner;

// STUN server for NAT traversal
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ======= INITIALIZE PEER CONNECTION =======
function initPeer() {
  pc = new RTCPeerConnection(config);

  // ICE candidate gathering
  pc.onicecandidate = e => {
    if (!e.candidate) {
      // All candidates gathered
      generateQR(JSON.stringify(pc.localDescription));
    }
  };

  // Remote stream
  pc.ontrack = e => {
    remoteStream = e.streams[0];
    document.getElementById("remoteVideo").srcObject = remoteStream;
  };

  // DataChannel from remote peer
  pc.ondatachannel = e => {
    channel = e.channel;
    setupChannel();
  };
}

// ======= DATA CHANNEL =======
function setupChannel() {
  channel.onmessage = e => {
    const div = document.createElement("div");
    div.className = "msg received";
    div.textContent = e.data;
    document.getElementById("messages").appendChild(div);
    scrollChat();
  };
}

// ======= START CAMERA + MICROPHONE =======
async function startMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  document.getElementById("localVideo").srcObject = localStream;
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

// ======= CREATE OFFER (DEVICE A) =======
async function createOffer() {
  initPeer();
  channel = pc.createDataChannel("chat");
  setupChannel();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await waitForIceComplete();
  generateQR(JSON.stringify(pc.localDescription));
}

// ======= CREATE ANSWER (DEVICE B) =======
async function createAnswer() {
  const offerText = document.getElementById("signalBox").value;
  if (!offerText) return alert("Paste offer QR JSON here!");

  initPeer();

  const offer = JSON.parse(offerText);
  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await waitForIceComplete();
  generateQR(JSON.stringify(pc.localDescription));
}

// ======= SET REMOTE DESCRIPTION (DEVICE A SCANS ANSWER) =======
async function setRemote() {
  const answerText = document.getElementById("signalBox").value;
  if (!answerText) return alert("Paste answer QR JSON here!");
  const answer = JSON.parse(answerText);
  await pc.setRemoteDescription(answer);
}

// ======= WAIT ICE COMPLETE =======
function waitForIceComplete() {
  return new Promise(resolve => {
    if (pc.iceGatheringState === "complete") resolve();
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") resolve();
    };
  });
}

// ======= QR FUNCTIONS =======
function generateQR(text) {
  document.getElementById("qrBox").innerHTML = "";
  new QRCode(document.getElementById("qrBox"), {
    text,
    width: 300,
    height: 300
  });
}

function scanQR() {
  document.getElementById("qrScanner").style.display = "block";

  qrScanner = new Html5Qrcode("qrScanner");

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async qrText => {
      document.getElementById("qrScanner").style.display = "none";
      await handleScannedQR(qrText);
      qrScanner.stop();
    },
    err => {}
  );
}

async function handleScannedQR(text) {
  const desc = JSON.parse(text);

  if (desc.type === "offer") {
    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceComplete();
    generateQR(JSON.stringify(pc.localDescription));
  } else if (desc.type === "answer") {
    await pc.setRemoteDescription(desc);
  }
}

// ======= CHAT FUNCTIONS =======
function sendMessage() {
  const input = document.getElementById("msgInput");
  if (!input.value.trim()) return;

  channel.send(input.value);

  const div = document.createElement("div");
  div.className = "msg sent";
  div.textContent = input.value;
  document.getElementById("messages").appendChild(div);

  input.value = "";
  scrollChat();
}

function scrollChat() {
  const chat = document.getElementById("messages");
  chat.scrollTop = chat.scrollHeight;
}

// ======= FILE TRANSFER =======
function sendFile(input) {
  const file = input.files[0];
  if (!file) return;

  const chunkSize = 16 * 1024; // 16KB per chunk
  const reader = new FileReader();

  reader.onload = () => {
    const data = reader.result;
    let offset = 0;
    while (offset < data.length) {
      channel.send(data.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }
  };

  reader.readAsArrayBuffer(file);
}
