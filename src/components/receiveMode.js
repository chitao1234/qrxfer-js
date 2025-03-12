import jsQR from 'jsqr';

export function setupReceiveMode(protocol) {
  // Get DOM elements
  const cameraFeed = document.getElementById('camera-feed');
  const cameraCanvas = document.getElementById('camera-canvas');
  const toggleCameraBtn = document.getElementById('toggle-camera');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const downloadBtn = document.getElementById('download-btn');
  const fileInfo = document.getElementById('file-info');
  const chunksContainer = document.getElementById('receive-chunks-container');
  
  // Camera handling for receiving QR codes
  let cameraStream = null;
  let scanningInterval = null;
  
  // Track last detected chunk
  let lastDetectedChunk = null;
  let lastDetectedTime = 0;
  
  // Track if we've detected completion
  let completionDetected = false;
  
  // Toggle camera on/off
  toggleCameraBtn.addEventListener('click', async () => {
    const isActive = toggleCameraBtn.classList.contains('active');
    
    if (isActive) {
      // Stop the camera
      if (scanningInterval) clearInterval(scanningInterval);
      
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraFeed.srcObject = null;
      }
      
      toggleCameraBtn.textContent = 'Start Camera';
      toggleCameraBtn.classList.remove('active');
    } else {
      // Start the camera
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        cameraFeed.srcObject = cameraStream;
        toggleCameraBtn.textContent = 'Stop Camera';
        toggleCameraBtn.classList.add('active');
        
        // Clear previous chunks display
        chunksContainer.innerHTML = '';
        completionDetected = false;
        
        // Start scanning for QR codes
        scanningInterval = setInterval(scanQRCode, 200);
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera: ' + error.message);
        toggleCameraBtn.classList.remove('active');
      }
    }
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
      try {
        // Avoid processing the same code too frequently
        const now = Date.now();
        const parsed = JSON.parse(code.data);
        const chunkKey = `${parsed.id}-${parsed.chunkIndex}`;
        
        if (lastDetectedChunk === chunkKey && now - lastDetectedTime < 1000) {
          return; // Skip if same chunk detected within 1 second
        }
        
        lastDetectedChunk = chunkKey;
        lastDetectedTime = now;
        
        // Process the QR code data
        const result = protocol.processReceivedChunk(code.data);
        
        if (result && result.isNewChunk) {
          // Initialize chunk indicators if first chunk
          if (chunksContainer.children.length === 0 && parsed.totalChunks > 0) {
            createChunkIndicators(parsed.totalChunks);
          }
          
          // Update chunk indicator
          updateChunkIndicator(parsed.chunkIndex);
          
          // Update progress
          progressFill.style.width = `${result.progress}%`;
          progressText.textContent = `${Math.round(result.progress)}% (${protocol.totalReceivedChunks}/${parsed.totalChunks})`;
          
          // Check if all chunks are received
          checkCompletionStatus(parsed.totalChunks);
        } else if (result && Math.round(result.progress) === 100 && !completionDetected) {
          // Backup completion check - if progress is 100% but completion not detected
          checkCompletionStatus(parsed.totalChunks);
        }
      } catch (error) {
        console.error('Error processing QR code:', error);
      }
    }
  }
  
  // Check if all chunks are received and enable download if true
  function checkCompletionStatus(totalChunks) {
    // If already detected completion, skip
    if (completionDetected) return;
    
    // Verify all chunks received by checking the count
    if (protocol.totalReceivedChunks >= totalChunks) {
      try {
        console.log('All chunks received. Attempting file reconstruction...');
        const fileData = protocol.reconstructFile();
        if (fileData && fileData.blob) {
          console.log('File successfully reconstructed:', fileData.filename);
          downloadBtn.disabled = false;
          fileInfo.textContent = `Ready to download: ${fileData.filename} (${formatFileSize(fileData.blob.size)})`;
          completionDetected = true;
        } else {
          console.error('File reconstruction failed:', fileData);
          fileInfo.textContent = 'Error: File reconstruction failed. Try scanning missing chunks.';
        }
      } catch (error) {
        console.error('Error during file reconstruction:', error);
        fileInfo.textContent = 'Error during file reconstruction: ' + error.message;
      }
    }
  }
  
  // Create visualization for all chunks
  function createChunkIndicators(totalChunks) {
    chunksContainer.innerHTML = '';
    for (let i = 0; i < totalChunks; i++) {
      const indicator = document.createElement('div');
      indicator.className = 'chunk-indicator';
      indicator.textContent = i;
      indicator.title = `Chunk ${i}`;
      indicator.dataset.index = i;
      chunksContainer.appendChild(indicator);
    }
  }
  
  // Update a chunk indicator when received
  function updateChunkIndicator(index) {
    const indicator = chunksContainer.querySelector(`.chunk-indicator[data-index="${index}"]`);
    if (indicator) {
      indicator.classList.add('chunk-received');
    }
  }
  
  // Format file size in KB or MB
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
    chunksContainer.innerHTML = '';
    completionDetected = false;
  });
} 