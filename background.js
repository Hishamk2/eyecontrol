// background.js - runs as a service worker
// content script message handlers don't count as user gestures, so element.click()
// gets blocked for things like file dialogs. the chrome debugger api sends a real
// trusted mouse event that the browser accepts as a genuine user action.

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== 'simulateClick') return;

  sendTrustedClick(sender.tab.id, msg.x, msg.y);
});

async function sendTrustedClick(tabId, x, y) {
  try {
    await chrome.debugger.attach({ tabId }, '1.3');

    // press then release = a full click
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 1,
      clickCount: 1
    });

    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 0,
      clickCount: 1
    });

  } catch (err) {
    console.error('trusted click failed:', err);
  } finally {
    // always detach so the "being debugged" bar goes away
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}
