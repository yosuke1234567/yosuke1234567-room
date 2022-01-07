const Peer = window.Peer;

const first = document.getElementById('first');
const okTrigger = document.getElementById('js-ok-trigger');
const userId = document.getElementById('js-username');
const roomId = document.getElementById('js-room-id');
const audioSource = document.getElementById('audio-source');
const videoSource = document.getElementById('video-source');
const joinTrigger = document.getElementById('js-join-trigger');
const leaveTrigger = document.getElementById('js-leave-trigger');

joinTrigger.style.visibility = 'hidden';
leaveTrigger.style.visibility = 'hidden';

//カメラ・マイクの種類の取得
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(function(){
  navigator.mediaDevices.enumerateDevices().then(e => {
    var devices = e.filter(device => device.kind === 'audioinput').map(device => {
      var deviceInfo = {
        deviceId: device.deviceId,
        label: device.label
      }
      return deviceInfo;
    });
    devices.forEach(val => {
      const select = document.createElement('option');
      select.setAttribute('value', `${val.deviceId}`);
      select.textContent = `${val.label}`;
      audioSource.appendChild(select);
    });
  });
  navigator.mediaDevices.enumerateDevices().then(e => {
    var devices = e.filter(device => device.kind === 'videoinput').map(device => {
      var deviceInfo = {
        deviceId: device.deviceId,
        label: device.label
      }
      return deviceInfo;
    });
    devices.forEach(val => {
      const select = document.createElement('option');
      select.setAttribute('value', `${val.deviceId}`);
      select.textContent = `${val.label}`;
      videoSource.appendChild(select);
    });
  });
});

var peer = okTrigger.addEventListener('click', () => {
  const userName = userId.value;
  peer = (window.peer = new Peer(`${userName}`, {
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  if(userId.value === '' || roomId.value === ''){
    userId.style.backgroundColor = '#fcd'
    roomId.style.backgroundColor = '#fcd'
  } else {
    first.style.visibility = 'hidden'
    joinTrigger.style.visibility = 'visible'
    main();
  }

});



async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const remoteVideos = document.getElementById('js-remote-streams');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const toggleVolume = document.getElementById('js-toggle-volume');

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: {deviceId: {exact: audioSource.value}},
      video: {
        deviceId: {exact: videoSource.value},
        width: {max: 426},
        height: {max: 240},
        frameRate: {max: 15},
        aspectRatio: {ideal: 1.7777777778}
      }
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  ////////// ミュート設定 //////////
  const toggleCamera = document.getElementById('js-toggle-camera');
  const toggleMicrophone = document.getElementById('js-toggle-microphone');
  const cameraStatus = document.getElementById('camera-status');
  const microphoneStatus = document.getElementById('microphone-status');
  
  const videoTracks = localStream.getVideoTracks()[0]; // 状態の情報を取り出す
  cameraStatus.textContent = `${videoTracks.enabled ? 'OFF' : 'ON'}`; //カメラの状態は true : false
  toggleCamera.addEventListener('click', () => {
    videoTracks.enabled = !videoTracks.enabled; //!＝反転
    cameraStatus.textContent = `${videoTracks.enabled ? 'OFF' : 'ON'}`;
  });

  const audioTracks = localStream.getAudioTracks()[0];
  microphoneStatus.textContent = `${audioTracks.enabled ? 'OFF' : 'ON'}`;
  toggleMicrophone.addEventListener('click', () => {
    audioTracks.enabled = !audioTracks.enabled;
    microphoneStatus.textContent = `${audioTracks.enabled ? 'OFF' : 'ON'}`;
  });
  //////////

  //p2p用
  const localStream2 = await navigator.mediaDevices
  .getUserMedia({
    audio: { deviceId: {exact: audioSource.value}},
    video: false
  })
  .catch(console.error);
  const localStream3 = await navigator.mediaDevices
  .getUserMedia({
    audio: false,
    video: { width: 1, height: 1, frameRate: 1 }
  })
  .catch(console.error);

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    joinTrigger.style.display = 'none'
    leaveTrigger.style.visibility = 'visible'
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      remoteVideos.textContent = '参加できませんでした。このページを更新して再度お試しください。';
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: 'sfu',
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== あなた : 入室しました。 ===\n';
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} が入室しました。 ===\n`;
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
    });

    
    // 他のユーザのストリームを受信した時
    room.on('stream', async stream => {

      const newContainer = document.createElement('div');
      newContainer.setAttribute('class', 'remote-container');
      remoteVideos.appendChild(newContainer);

      const x = remoteVideos.childElementCount;
      if (x <= 6){remoteVideos.style.gridTemplateColumns = 'repeat(auto-fit, minmax(30%, 1fr))';}
      if (6 < x){remoteVideos.style.gridTemplateColumns = 'repeat(auto-fit, minmax(20%, 1fr))';}

      const newVideo = document.createElement('video'); //<video>要素の追加
      newVideo.setAttribute('playsinline', '');
      // 後でpeerLeaveイベントで見つけるためにpeerIdをマーク
      newVideo.setAttribute('data-peer-id', stream.peerId);
      newContainer.appendChild(newVideo); //newContainerの中に追加

      const audioCtx = new AudioContext();
      const panner = audioCtx.createPanner(); //立体音響のAudioNodeを作成
      const source = audioCtx.createMediaStreamSource(stream);

      panner.positionZ.value = toggleVolume.value;

      source.connect(panner);
      panner.connect(audioCtx.destination);
      
      newVideo.srcObject = stream;
      newVideo.addEventListener('loadedmetadata', () => {
        newVideo.play().catch(console.error);
        newVideo.muted = 'true';
      });

      const newVideoId = document.createElement('span');
      newVideoId.textContent = stream.peerId;
      newContainer.appendChild(newVideoId); //peeridのラベル
      
      // 音量変更
      toggleVolume.addEventListener('input', () => {
        panner.positionZ.value = toggleVolume.value;
      });


      ////サブストリーム////
      const p2pStartTrigger = document.createElement('button');
      p2pStartTrigger.textContent = '話しかける';
      p2pStartTrigger.setAttribute('class', 'p2p-start');
      newContainer.appendChild(p2pStartTrigger);

      const p2pCloseTrigger = document.getElementById('p2p-close-trigger')
      const p2pVolume = document.getElementById('p2p-volume')

      const ssId = document.getElementById('ss-id');
      
      //発信処理
      p2pStartTrigger.addEventListener('click', () => {
        const mediaConnection = peer.call(stream.peerId, localStream2); //発信

        p2pStartTrigger.style.display = 'none';
        p2pCloseTrigger.style.display = 'inline';
        ssId.textContent += `発信 : ${mediaConnection.remoteId}\n`;
        room.send(`---${mediaConnection.remoteId}に発信---`);
        ssId.scrollBy(0, 100);
        messages.textContent += `${peer.id} : ---${mediaConnection.remoteId}に発信---\n`;
        var bottom = messages.scrollHeight - messages.clientHeight;
        messages.scroll(0, bottom);

        mediaConnection.once('close', () => {
          ssId.textContent += `通話終了 : ${mediaConnection.remoteId}\n`;
          ssId.scrollBy(0, 100);
          p2pStartTrigger.style.display = 'inline';
        });
        p2pCloseTrigger.addEventListener('click', () => {
          mediaConnection.close(true);
          p2pCloseTrigger.style.display = 'none';
          p2pStartTrigger.style.display = 'inline';
        });
      });
      
      //着信処理
      peer.on('call', (mediaConnection) => {
        mediaConnection.answer(localStream3);

        let panner2;
        mediaConnection.on('stream', async stream => {
          const audioCtx2 = new AudioContext();
          panner2 = audioCtx2.createPanner(); //立体音響のAudioNodeを作成
          const source2 = audioCtx2.createMediaStreamSource(stream);

          panner2.positionX.value = p2pVolume.value;
          panner2.positionZ.value = 5;

          source2.connect(panner2);
          panner2.connect(audioCtx2.destination);
          
          p2pCloseTrigger.style.display = 'inline';
          ssId.textContent += `着信 : ${mediaConnection.remoteId}\n`;
          ssId.scrollBy(0, 100);
  
          mediaConnection.once('close', () => {
            ssId.textContent += `通話終了 : ${mediaConnection.remoteId}\n`;
            ssId.scrollBy(0, 100);
            p2pStartTrigger.style.display = 'inline';
          });
          p2pCloseTrigger.addEventListener('click', () => {
            mediaConnection.close(true);
            p2pCloseTrigger.style.display = 'none';
            p2pStartTrigger.style.display = 'inline';
          });
        });
        
        p2pVolume.addEventListener('input', () => {
          panner2.positionX.value = p2pVolume.value;
        });
      });
      /////end サブストリーム//////

    });
    ////


    //テキストメッセージ受信
    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src} : ${data}\n`;
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;

      const remoteContainer = remoteVideo.parentNode;
      remoteContainer.remove();

      messages.textContent += `=== ${peerId} が退室しました。 ===\n`;
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '=== あなた : 退室しました。 ===\n';
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
      const remoteVideo = remoteVideos.querySelectorAll("video");
      Array.from(remoteVideo).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
      });
      remoteVideos.innerHTML = '';
    });
    
    leaveTrigger.addEventListener('click', () => {
      room.close()
      leaveTrigger.style.visibility = 'hidden';
    }, { once: true });

    
    sendTrigger.addEventListener('click', onClickSend);
    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id} : ${localText.value}\n`;
      localText.value = '';
      var bottom = messages.scrollHeight - messages.clientHeight;
      messages.scroll(0, bottom);
    }

  });
  
  peer.on('error', console.error);
};
