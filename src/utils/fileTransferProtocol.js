import CryptoJS from 'crypto-js';

export default class FileTransferProtocol {
  constructor() {
    this.transferId = null;
    this.file = null;
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.transmissionInterval = null;
    this.receivedChunks = {};
    this.totalReceivedChunks = 0;
    this.filename = null;
    this.mimetype = null;
    this.totalChunks = 0;
  }
  
  // Generate a unique ID for the transfer session
  generateTransferId() {
    return 'transfer-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }
  
  // Process a file and split it into chunks
  async processFile(file, chunkSize) {
    this.file = file;
    this.transferId = this.generateTransferId();
    this.chunks = [];
    
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = new Uint8Array(reader.result);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = fileData.slice(start, end);
          
          // Convert chunk to base64
          const base64Chunk = this.arrayBufferToBase64(chunk);
          
          // Calculate checksum
          const checksum = CryptoJS.MD5(CryptoJS.enc.Base64.parse(base64Chunk)).toString();
          
          // Create chunk data object
          const chunkData = {
            id: this.transferId,
            filename: file.name,
            mimetype: file.type,
            totalChunks: totalChunks,
            chunkIndex: i,
            data: base64Chunk,
            checksum: checksum
          };
          
          this.chunks.push(chunkData);
        }
        
        resolve(this.chunks.length);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Convert array buffer to base64
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  
  // Get current chunk for QR code generation
  getCurrentChunk() {
    if (this.currentChunkIndex < this.chunks.length) {
      return this.chunks[this.currentChunkIndex];
    }
    return null;
  }
  
  // Move to the next chunk
  nextChunk() {
    this.currentChunkIndex = (this.currentChunkIndex + 1) % this.chunks.length;
    return this.getCurrentChunk();
  }
  
  // Process a received chunk from QR code
  processReceivedChunk(chunkData) {
    try {
      // Parse the JSON data
      const chunk = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
      
      // Basic validation
      if (!chunk.id || chunk.chunkIndex === undefined || !chunk.data) {
        console.error('Invalid chunk format:', chunk);
        return false;
      }
      
      // Check if we've already received this chunk
      const chunkKey = `${chunk.id}-${chunk.chunkIndex}`;
      if (this.receivedChunks[chunkKey]) {
        return false; // Duplicate chunk, ignore
      }
      
      // Verify checksum
      const calculatedChecksum = CryptoJS.MD5(CryptoJS.enc.Base64.parse(chunk.data)).toString();
      if (calculatedChecksum !== chunk.checksum) {
        console.error('Checksum mismatch for chunk:', chunk.chunkIndex);
        return false;
      }
      
      // Store the chunk
      this.receivedChunks[chunkKey] = chunk;
      this.totalReceivedChunks++;
      
      // Initialize the transfer info if this is the first chunk
      if (!this.transferId) {
        this.transferId = chunk.id;
        this.filename = chunk.filename;
        this.mimetype = chunk.mimetype;
        this.totalChunks = chunk.totalChunks;
      }
      
      // Check if we have all chunks
      const isComplete = this.totalReceivedChunks === chunk.totalChunks;
      
      return {
        isNewChunk: true,
        progress: (this.totalReceivedChunks / chunk.totalChunks) * 100,
        isComplete: isComplete
      };
    } catch (error) {
      console.error('Error processing chunk:', error);
      return false;
    }
  }
  
  // Reconstruct the file from received chunks
  reconstructFile() {
    if (!this.transferId) return null;
    
    // Sort chunks by index
    const sortedChunks = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunkKey = `${this.transferId}-${i}`;
      const chunk = this.receivedChunks[chunkKey];
      if (!chunk) {
        console.error(`Missing chunk at index ${i}`);
        return null;
      }
      sortedChunks.push(chunk);
    }
    
    // Combine all chunks
    const base64Data = sortedChunks.map(chunk => chunk.data).join('');
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob and return file object
    const blob = new Blob([bytes], { type: this.mimetype });
    return {
      blob: blob,
      filename: this.filename,
      mimetype: this.mimetype
    };
  }
  
  // Reset the receiver
  resetReceiver() {
    this.transferId = null;
    this.receivedChunks = {};
    this.totalReceivedChunks = 0;
    this.filename = null;
    this.mimetype = null;
    this.totalChunks = 0;
  }
} 