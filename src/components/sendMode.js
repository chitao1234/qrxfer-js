import QRCode from 'qrcode';

export function setupSendMode(protocol) {
  // Get DOM elements
  const fileInput = document.getElementById('file-input');
  const generateBtn = document.getElementById('generate-btn');
  const chunkSizeInput = document.getElementById('chunk-size');
  const displayDelayInput = document.getElementById('display-delay');
  const errorCorrectionSelect = document.getElementById('error-correction');
  const qrDisplay = document.getElementById('qr-display');
  const chunkCount = document.getElementById('chunk-count');
  const prevChunkBtn = document.getElementById('prev-chunk');
  const nextChunkBtn = document.getElementById('next-chunk');
  const currentChunkInput = document.getElementById('current-chunk-input');
  const toggleTransmissionBtn = document.getElementById('toggle-transmission');
  const chunksContainer = document.getElementById('send-chunks-container');
  
  // Enable/disable buttons based on file selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      generateBtn.disabled = false;
    } else {
      generateBtn.disabled = true;
      toggleTransmissionBtn.disabled = true;
      toggleTransmissionBtn.classList.remove('active');
      toggleTransmissionBtn.textContent = 'Start Transmission';
      prevChunkBtn.disabled = true;
      nextChunkBtn.disabled = true;
      currentChunkInput.disabled = true;
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
      toggleTransmissionBtn.disabled = false;
      prevChunkBtn.disabled = false;
      nextChunkBtn.disabled = false;
      currentChunkInput.disabled = false;
      currentChunkInput.value = 0;
      currentChunkInput.max = totalChunks - 1;
      
      // Generate and display the first QR code
      const firstChunk = protocol.getCurrentChunk();
      await generateQRCode(firstChunk);
      
      // Create chunk indicators
      createChunkIndicators(totalChunks);
      updateCurrentChunkIndicator(0);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file: ' + error.message);
    }
  });
  
  // Toggle transmission (start/stop)
  toggleTransmissionBtn.addEventListener('click', () => {
    const isActive = toggleTransmissionBtn.classList.contains('active');
    
    if (isActive) {
      // Stop transmission
      clearInterval(protocol.transmissionInterval);
      toggleTransmissionBtn.textContent = 'Start Transmission';
      toggleTransmissionBtn.classList.remove('active');
      prevChunkBtn.disabled = false;
      nextChunkBtn.disabled = false;
      currentChunkInput.disabled = false;
    } else {
      // Start transmission
      const delay = parseInt(displayDelayInput.value);
      toggleTransmissionBtn.textContent = 'Stop Transmission';
      toggleTransmissionBtn.classList.add('active');
      prevChunkBtn.disabled = true;
      nextChunkBtn.disabled = true;
      currentChunkInput.disabled = true;
      
      // Start cycling through QR codes
      protocol.transmissionInterval = setInterval(async () => {
        const chunk = protocol.nextChunk();
        const index = protocol.currentChunkIndex;
        chunkCount.textContent = `Chunk ${index + 1} of ${protocol.chunks.length}`;
        currentChunkInput.value = index;
        await generateQRCode(chunk);
        updateCurrentChunkIndicator(index);
      }, delay);
    }
  });
  
  // Navigate to previous chunk
  prevChunkBtn.addEventListener('click', async () => {
    if (protocol.currentChunkIndex > 0) {
      protocol.currentChunkIndex--;
      const chunk = protocol.getCurrentChunk();
      chunkCount.textContent = `Chunk ${protocol.currentChunkIndex + 1} of ${protocol.chunks.length}`;
      currentChunkInput.value = protocol.currentChunkIndex;
      await generateQRCode(chunk);
      updateCurrentChunkIndicator(protocol.currentChunkIndex);
    }
  });
  
  // Navigate to next chunk
  nextChunkBtn.addEventListener('click', async () => {
    if (protocol.currentChunkIndex < protocol.chunks.length - 1) {
      protocol.currentChunkIndex++;
      const chunk = protocol.getCurrentChunk();
      chunkCount.textContent = `Chunk ${protocol.currentChunkIndex + 1} of ${protocol.chunks.length}`;
      currentChunkInput.value = protocol.currentChunkIndex;
      await generateQRCode(chunk);
      updateCurrentChunkIndicator(protocol.currentChunkIndex);
    }
  });
  
  // Jump to specific chunk
  currentChunkInput.addEventListener('change', async () => {
    const targetIndex = parseInt(currentChunkInput.value);
    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= protocol.chunks.length) {
      currentChunkInput.value = protocol.currentChunkIndex;
      return;
    }
    
    protocol.currentChunkIndex = targetIndex;
    const chunk = protocol.getCurrentChunk();
    chunkCount.textContent = `Chunk ${protocol.currentChunkIndex + 1} of ${protocol.chunks.length}`;
    await generateQRCode(chunk);
    updateCurrentChunkIndicator(protocol.currentChunkIndex);
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
        errorCorrectionLevel: errorCorrectionSelect.value
      });
      qrDisplay.appendChild(canvas);
    } catch (error) {
      console.error('Error generating QR code:', error);
      qrDisplay.innerHTML = `<p>Error generating QR code: ${error.message}</p>`;
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
      
      // Add click event to jump to this chunk
      indicator.addEventListener('click', async () => {
        if (toggleTransmissionBtn.classList.contains('active')) {
          return; // Don't allow changing during transmission
        }
        protocol.currentChunkIndex = i;
        const chunk = protocol.getCurrentChunk();
        chunkCount.textContent = `Chunk ${i + 1} of ${protocol.chunks.length}`;
        currentChunkInput.value = i;
        await generateQRCode(chunk);
        updateCurrentChunkIndicator(i);
      });
      
      chunksContainer.appendChild(indicator);
    }
  }
  
  // Update current chunk indicator
  function updateCurrentChunkIndicator(index) {
    // Remove current highlight from all indicators
    const allIndicators = chunksContainer.querySelectorAll('.chunk-indicator');
    allIndicators.forEach(ind => ind.classList.remove('chunk-current'));
    
    // Highlight the current chunk
    const currentIndicator = chunksContainer.querySelector(`.chunk-indicator[data-index="${index}"]`);
    if (currentIndicator) {
      currentIndicator.classList.add('chunk-current');
      
      // Scroll to make visible if needed
      currentIndicator.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
} 