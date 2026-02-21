let cursorX = window.innerWidth / 2;  // mid hor
let cursorY = window.innerHeight / 2; // mid vert
let cursorSpeed = 10; // pixels

let fakeCursor = null;

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
  
  document.addEventListener('keydown', handleKeyboardInput);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFakeCursor);
} else {
  initializeFakeCursor();
}