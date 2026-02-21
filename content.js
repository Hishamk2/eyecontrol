let cursorX = window.innerWidth / 2;  // mid hor
let cursorY = window.innerHeight / 2; // mid vert
let cursorSpeed = 10; // pixels

let fakeCursor = null;

// video stuff
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let webcamRunning = false;

// set from netural position on startup 
// so be aware
let irisCenterX = null;
let irisCenterY = null;
let isCalibrated = false;

// collect first few frames to average out a stable center
const CALIBRATION_FRAMES = 30;
let calibrationSamples = [];



// changing


// how far iris moves from center in canvas pixels (measured)
// x has more range than y cuzzzzz idk
const IRIS_RANGE_X = 13;
const IRIS_RANGE_Y = 3;  // small, nodding barely moves iris vertically

// multiplier on top of the range mapping
// 1.0 = edge of iris range maps to edge of screen
// higher = more sensitive, less head movement needed
const SENSITIVITY_X = 1.0;
const SENSITIVITY_Y = 1.0;

// smoothing factor: 0 = no smoothing, 1 = no movement
// helps reduce jitter, try 0.3-0.7
const SMOOTHING = 0.3;






// just a div
function createFakeCursor() {
  fakeCursor = document.createElement('div');
  fakeCursor.id = 'fake-cursor';
  
  fakeCursor.style.position = 'fixed'; // yes
  fakeCursor.style.width = '20px';
  fakeCursor.style.height = '20px';
  fakeCursor.style.backgroundColor = 'green';
  fakeCursor.style.borderRadius = '50%'; // circle
  fakeCursor.style.zIndex = '999999'; // yes
  fakeCursor.style.pointerEvents = 'none'; // maybe, depends if want my actual mouse to do stuff begind wherever the fake cursor is
fakeCursor.style.transition = 'none'; // No animation for instant movement

  
  document.body.appendChild(fakeCursor);
  
  updateCursorPosition();
  
  console.log('init fake cursor:', cursorX, cursorY);
}

function createVideoElements() {
  videoElement = document.createElement('video');
  videoElement.style.display = 'none'; // hidden, just for stream
  document.body.appendChild(videoElement);

  canvasElement = document.createElement('canvas');
  canvasElement.style.position = 'fixed';
  canvasElement.style.top = '10px';
  canvasElement.style.right = '10px';
  canvasElement.style.width = '320px';
  canvasElement.style.height = '240px';
  canvasElement.style.zIndex = '999998';
  // canvasElement.style.transform = 'scaleX(-1)'; // mirror cuz webcam or not
  document.body.appendChild(canvasElement);
  
  canvasCtx = canvasElement.getContext('2d');
}

function injectFaceTracker() {
  const scriptTag = document.createElement('script');
  scriptTag.src = chrome.runtime.getURL('inject.js');
  scriptTag.id = 'face-inject';
  document.documentElement.appendChild(scriptTag);
  
  console.log('face tracker injected');
}

function handleMessageFromPage(event) {
  if (!event.data || !event.data.type) return;
  
  if (event.data.type === 'FACE_STATUS') {
    console.log('face status:', event.data.status);
    
    if (event.data.error) {
      console.error('face error:', event.data.error);
    }
  }
  
  if (event.data.type === 'FACE_DATA') {
    if (!event.data.data) return;
    
    const irisXNormalized = event.data.data.irisX;
    const irisYNormalized = event.data.data.irisY;
    
    // normalized 0-1, need to scale to canvas size
    const irisXCanvas = irisXNormalized * canvasElement.width;
    const irisYCanvas = irisYNormalized * canvasElement.height;

    console.log("iris canvas coords:", irisXCanvas, irisYCanvas);
    
    // first N frames: collect samples to figure out where "center" actually is
    if (!isCalibrated) {
      calibrationSamples.push({ x: irisXCanvas, y: irisYCanvas });
      
      if (calibrationSamples.length >= CALIBRATION_FRAMES) {
        // average all samples to get a stable center
        let totalX = 0;
        let totalY = 0;
        for (let i = 0; i < calibrationSamples.length; i++) {
          totalX += calibrationSamples[i].x;
          totalY += calibrationSamples[i].y;
        }
        irisCenterX = totalX / calibrationSamples.length;
        irisCenterY = totalY / calibrationSamples.length;
        isCalibrated = true;
        
        console.log('calibrated center:', irisCenterX.toFixed(1), irisCenterY.toFixed(1));
      }
      return; // don't move cursor until calibrated
    }
    
    // how far the iris is from YOUR center
    const irisOffsetX = irisXCanvas - irisCenterX;
    const irisOffsetY = irisYCanvas - irisCenterY;
    
    // normalize to -1 to 1 using per-axis range
    const normalizedOffsetX = irisOffsetX / IRIS_RANGE_X;
    const normalizedOffsetY = irisOffsetY / IRIS_RANGE_Y;
    
    // map iris position to screen position
    // negate x because 
    const targetX = (window.innerWidth  / 2) + (-normalizedOffsetX * SENSITIVITY_X * window.innerWidth  / 2);
    const targetY = (window.innerHeight / 2) + ( normalizedOffsetY * SENSITIVITY_Y * window.innerHeight / 2);
    
    // smooth it out so cursor doesnt jump around
    cursorX = cursorX + (targetX - cursorX) * (1 - SMOOTHING);
    cursorY = cursorY + (targetY - cursorY) * (1 - SMOOTHING);
    
    // clamp to screen
    cursorX = Math.max(0, Math.min(window.innerWidth,  cursorX));
    cursorY = Math.max(0, Math.min(window.innerHeight, cursorY));
    
    updateCursorPosition();
  }
}


async function startWebcam() {
  if (webcamRunning) return;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480 } 
    });
    
    videoElement.srcObject = stream;
    videoElement.addEventListener('loadeddata', () => {
      webcamRunning = true;
      // canvasElement.width = videoElement.videoWidth;
      // canvasElement.height = videoElement.videoHeight;
      // console.log('webcam on:', videoElement.videoWidth, videoElement.videoHeight);
      renderFrame();
    });
    
    await videoElement.play();
  } catch (err) {
    console.error('webcam fail:', err);
  }
}

function renderFrame() {
  if (!webcamRunning) return;
  
  // draw current frame
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(videoElement, -canvasElement.width, 0, canvasElement.width, canvasElement.height);
  canvasCtx.restore();
  
  // keep rendering
  requestAnimationFrame(renderFrame);
}


function updateCursorPosition() {
  if (fakeCursor) {
    // 10 cuz that is half of cursor size, prob make  a var
    fakeCursor.style.left = (cursorX - 10) + 'px';
    fakeCursor.style.top = (cursorY - 10) + 'px';
  }
}

function moveCursorUp() {
  cursorY = cursorY - cursorSpeed;
  
  if (cursorY < 0) {
    cursorY = 0;
  }
  
  updateCursorPosition();
}

function moveCursorDown() {
  cursorY = cursorY + cursorSpeed;
  
  if (cursorY > window.innerHeight) {
    cursorY = window.innerHeight;
  }
  
  updateCursorPosition();
}

function moveCursorLeft() {
  cursorX = cursorX - cursorSpeed;
  
  if (cursorX < 0) {
    cursorX = 0;
  }
  
  updateCursorPosition();
}

function moveCursorRight() {
  cursorX = cursorX + cursorSpeed;
  
  if (cursorX > window.innerWidth) {
    cursorX = window.innerWidth;
  }
  
  updateCursorPosition();
}


function getFakeCursorCenter() {
  if (!fakeCursor) return null;

  const rect = fakeCursor.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}



function simulateClick() {
  const pos = getFakeCursorCenter();
  if (!pos) return;

  const { x, y } = pos;
  const target = document.elementFromPoint(x, y);
  if (!target) return;

  console.log(target.tagName, target);

  // doesnt work for select elemnts since not trusted
  // can work around by cycling through the elements but not for now
  if (target instanceof HTMLElement) {
    target.focus();
    target.click();
  }
}


function handleKeyboardInput(event) {
  
  if (event.key === 'ArrowUp') {
    moveCursorUp();
    event.preventDefault(); // o/w page scrolls
  } 
  else if (event.key === 'ArrowDown') {
    moveCursorDown();
    event.preventDefault(); // o/w page scrolls
  } 
  else if (event.key === 'ArrowLeft') {
    moveCursorLeft();
    event.preventDefault(); // o/w page scrolls
  } 
  else if (event.key === 'ArrowRight') {
    moveCursorRight();
    event.preventDefault(); // o/w page scrolls
  }
  
  // Spacebar triggers a click at the cursor position
  else if (event.key === ' ' || event.key === 'Spacebar') {
    simulateClick();
    event.preventDefault(); // o/w page scrolls
  }
}


function initializeFakeCursor() {
  console.log('...strat');
  
  createFakeCursor();
  createVideoElements();
  injectFaceTracker();
  startWebcam();
  
  window.addEventListener('message', handleMessageFromPage);
  document.addEventListener('keydown', handleKeyboardInput);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFakeCursor);
} else {
  initializeFakeCursor();
}