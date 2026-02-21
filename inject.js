// runs in page context to bypass CSP restrictions
(function () {
  'use strict';

  let faceMeshDetector = null;
  let videoElement = null;
  let isRunning = false;

  function loadExternalScript(scriptUrl) {
    return new Promise((resolve, reject) => {
      const alreadyLoaded = document.querySelector('script[src="' + scriptUrl + '"]');
      if (alreadyLoaded) {
        resolve();
        return;
      }
      
      const scriptTag = document.createElement('script');
      scriptTag.src = scriptUrl;
      scriptTag.crossOrigin = 'anonymous';
      scriptTag.onload = resolve;
      scriptTag.onerror = () => reject(new Error('failed to load ' + scriptUrl));
      
      document.head.appendChild(scriptTag);
    });
  }

  async function startFaceTracking() {
    if (isRunning) return;
    
    isRunning = true;

    try {
      await loadExternalScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadExternalScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');

      // hidden, just for webcam stream
      videoElement = document.createElement('video');
      videoElement.setAttribute('autoplay', '');
      videoElement.setAttribute('playsinline', '');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);

      faceMeshDetector = new window.FaceMesh({
        locateFile: fileName => 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + fileName
      });

      faceMeshDetector.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // needed for iris tracking
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMeshDetector.onResults(handleFaceDetectionResults);

      const cameraHelper = new window.Camera(videoElement, {
        onFrame: async () => {
          if (isRunning && faceMeshDetector) {
            await faceMeshDetector.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480
      });
      
      await cameraHelper.start();

      sendMessageToContentScript('FACE_STATUS', { status: 'running' });
      
    } catch (error) {
      console.error('face tracking fail:', error);
      sendMessageToContentScript('FACE_STATUS', { status: 'error', error: error.message });
    }
  }

  function stopFaceTracking() {
    isRunning = false;
    
    if (faceMeshDetector) {
      try {
        faceMeshDetector.close();
      } catch (_) {}
    }
    
    if (videoElement) {
      const streamTracks = videoElement.srcObject && videoElement.srcObject.getTracks();
      if (streamTracks) {
        streamTracks.forEach(track => track.stop());
      }
      videoElement.remove();
      videoElement = null;
    }
    
    faceMeshDetector = null;
    sendMessageToContentScript('FACE_STATUS', { status: 'stopped' });
  }

  function handleFaceDetectionResults(results) {
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
      sendMessageToContentScript('FACE_DATA', { data: null });
      return;
    }

    const faceLandmarks = results.multiFaceLandmarks[0];

    // 468 = left iris center, 473 = right iris center
    const leftIrisLandmark = faceLandmarks[468];
    const rightIrisLandmark = faceLandmarks[473];

    const averageIrisX = (leftIrisLandmark.x + rightIrisLandmark.x) / 2;
    const averageIrisY = (leftIrisLandmark.y + rightIrisLandmark.y) / 2;

    sendMessageToContentScript('FACE_DATA', {
      data: {
        irisX: averageIrisX,
        irisY: averageIrisY
      }
    });
  }

  function sendMessageToContentScript(messageType, payload) {
    window.postMessage({ type: messageType, ...payload }, '*');
  }

  function handleCommandFromContentScript(event) {
    if (!event.data || event.data.type !== 'FACE_CMD') return;
    
    if (event.data.cmd === 'start') {
      startFaceTracking();
    } 
    else if (event.data.cmd === 'stop') {
      stopFaceTracking();
    }
  }

  window.addEventListener('message', handleCommandFromContentScript);

  // start right away
  startFaceTracking();
})();
