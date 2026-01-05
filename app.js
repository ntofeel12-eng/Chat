let pc;
let channel;
let localStream;
let qrScanner;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

pc = new RTCPeerConnection(config);

pc.onicecandidate = e => {
  if (e.candidate === null) {
    showQR(JSON.stringify(pc.localDescription));
  }
};

pc.ontrack = e => {
  document.getElementById("remoteVideo").srcObject = e.streams[0];
};

pc.ondatachannel = e => {
  channel = e.channel;
  setupChannel();
};

function setupChannel() {
  channel.onmessage = e => {
    const div = document.createElement("div");
    div.className = "msg";
    div.textContent = e.data;
    document.getElementById("messages").appendChild(div);
  };
}

async function startMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  document.getElementById("localVideo").srcObject = localStream;
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}

async function createOffer() {
  channel = pc.createDataChannel("chat");
  setupChannel();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
}

async function createAnswer() {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
}

function showQR(data) {
  document.getElementById("qrBox").innerHTML = "";
  new QRCode(document.getElementById("qrBox"), {
    text: data,
    width: 256,
    height: 256
  });
}

function scanQR() {
  document.getElementById("qrScanner").innerHTML = "";
  qrScanner = new Html5Qrcode("qrScanner");

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async text => {
      const desc = JSON.parse(text);
      await pc.setRemoteDescription(desc);
      qrScanner.stop();
    }
  );
}

function sendMessage() {
  const input = document.getElementById("msgInput");
  channel.send(input.value);
  input.value = "";
}

function sendFile(input) {
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => channel.send(reader.result);
  reader.readAsDataURL(file);
}
