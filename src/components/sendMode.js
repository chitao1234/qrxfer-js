import QRCode from 'qrcode';

export function setupSendMode(protocol) {
  const fileInput = document.getElementById('file-input');
  const generateBtn = document.getElementById('generate-btn');
  const chunkSizeInput = document.getElementById('chunk-size');
  const displayDelayInput = document.getElementById('display-delay');
  const qrDisplay = document.getElementById('qr-display');
  const chunkCount = document.getElementById('chunk-count');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  
  // Set a safer default chunk size
  chunkSizeInput.value = "200";
  
  // Enable/disable buttons based on file selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      generateBtn.disabled = false;
    } else {
      generateBtn.disabled = true;
      startBtn.disabled = true;
    }
  });
  
  // Generate QR codes for the selected file
  generateBtn.addEventListener('click', async () => {
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const chunkSize = parseInt(chunkSizeInput.value);
    
    if (chunkSize > 500) {
      alert('Warning: Large chunk sizes may cause QR code generation to fail. Consider using 200-500 bytes for reliable operation.');
    }
    
    try {
      const totalChunks = await protocol.processFile(file, chunkSize);
      chunkCount.textContent = `Chunk 1 of ${totalChunks}`;
      startBtn.disabled = false;
      
      // Generate and display the first QR code
      const firstChunk = protocol.getCurrentChunk();
      await generateQRCode(firstChunk);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file: ' + error.message);
    }
  });
  
  // Start QR code transmission
  startBtn.addEventListener('click', () => {
    const delay = parseInt(displayDelayInput.value);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    // Start cycling through QR codes
    protocol.transmissionInterval = setInterval(async () => {
      const chunk = protocol.nextChunk();
      const index = protocol.currentChunkIndex;
      chunkCount.textContent = `Chunk ${index + 1} of ${protocol.chunks.length}`;
      await generateQRCode(chunk);
    }, delay);
  });
  
  // Stop QR code transmission
  stopBtn.addEventListener('click', () => {
    clearInterval(protocol.transmissionInterval);
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
  
  // Generate a QR code from chunk data
  async function generateQRCode(chunkData) {
    qrDisplay.innerHTML = '';
    
    if (!chunkData) return;
    
    const jsonString = JSON.stringify(chunkData);
    
    try {
      // Check data size before attempting to create QR code
      if (jsonString.length > 1000) {
        qrDisplay.innerHTML = `<p>Error: Data chunk too large (${jsonString.length} bytes).<br>Please use a smaller chunk size.</p>`;
        return;
      }
      
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, jsonString, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'H'
      });
      qrDisplay.appendChild(canvas);
    } catch (error) {
      console.error('Error generating QR code:', error);
      qrDisplay.innerHTML = `<p>Error generating QR code: ${error.message}</p>`;
    }
  }
} 