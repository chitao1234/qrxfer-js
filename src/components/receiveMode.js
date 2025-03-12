import jsQR from 'jsqr';

export function setupReceiveMode(protocol) {
  const cameraFeed = document.getElementById('camera-feed');
  const cameraCanvas = document.getElementById('camera-canvas');
  const startCameraBtn = document.getElementById('start-camera-btn');
  const stopCameraBtn = document.getElementById('stop-camera-btn');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const downloadBtn = document.getElementById('download-btn');
  const fileInfo = document.getElementById('file-info');
  
  // Camera handling for receiving QR codes
  let cameraStream = null;
  let scanningInterval = null;
  
  // Start the camera for QR code scanning
  startCameraBtn.addEventListener('click', async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      cameraFeed.srcObject = cameraStream;
      startCameraBtn.disabled = true;
      stopCameraBtn.disabled = false;
      
      // Start scanning for QR codes
      scanningInterval = setInterval(scanQRCode, 200);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Error accessing camera: ' + error.message);
    }
  });
  
  // Stop the camera
  stopCameraBtn.addEventListener('click', () => {
    if (scanningInterval) clearInterval(scanningInterval);
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraFeed.srcObject = null;
    }
    
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
  });
  
  // Scan for QR codes in the camera feed
  function scanQRCode() {
    if (!cameraFeed.videoWidth) return;
    
    const canvas = cameraCanvas;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video feed
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    
    // Draw the current video frame to the canvas
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
    
    // Get image data for QR code scanning
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Try to detect QR code in the image
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    
    if (code) {
      // Process the QR code data
      const result = protocol.processReceivedChunk(code.data);
      
      if (result && result.isNewChunk) {
        // Update progress
        progressFill.style.width = `${result.progress}%`;
        progressText.textContent = `${Math.round(result.progress)}%`;
        
        // If all chunks are received, enable download
        if (result.isComplete) {
          const fileData = protocol.reconstructFile();
          if (fileData) {
            downloadBtn.disabled = false;
            fileInfo.textContent = `Ready to download: ${fileData.filename}`;
          }
        }
      }
    }
  }
  
  // Download the reconstructed file
  downloadBtn.addEventListener('click', () => {
    const fileData = protocol.reconstructFile();
    if (!fileData) return;
    
    const url = URL.createObjectURL(fileData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Reset the receiver for a new transfer
    protocol.resetReceiver();
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    downloadBtn.disabled = true;
    fileInfo.textContent = 'No file received yet';
  });
} 