export function setupTabs() {
  const sendTab = document.getElementById('send-tab');
  const receiveTab = document.getElementById('receive-tab');
  const sendPane = document.getElementById('send-pane');
  const receivePane = document.getElementById('receive-pane');
  
  sendTab.addEventListener('click', () => {
    sendTab.classList.add('active');
    receiveTab.classList.remove('active');
    sendPane.classList.add('active');
    receivePane.classList.remove('active');
  });
  
  receiveTab.addEventListener('click', () => {
    receiveTab.classList.add('active');
    sendTab.classList.remove('active');
    receivePane.classList.add('active');
    sendPane.classList.remove('active');
  });
} 