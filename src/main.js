import './style.css';
import FileTransferProtocol from './utils/fileTransferProtocol.js';
import { setupTabs } from './components/tabs.js';
import { setupSendMode } from './components/sendMode.js';
import { setupReceiveMode } from './components/receiveMode.js';

document.addEventListener('DOMContentLoaded', function() {
  // Initialize the file transfer protocol
  const protocol = new FileTransferProtocol();
  
  // Setup UI components
  setupTabs();
  setupSendMode(protocol);
  setupReceiveMode(protocol);
}); 