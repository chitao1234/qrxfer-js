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
    if (!this.transferId) {
      console.error('No transfer ID set');
      return null;
    }
    
    if (this.totalReceivedChunks < this.totalChunks) {
      console.warn(`Missing chunks: ${this.totalReceivedChunks}/${this.totalChunks} received`);
    }
    
    // Log received chunks for debugging
    console.log(`Reconstructing file from ${this.totalReceivedChunks} chunks`, {
      transferId: this.transferId,
      totalChunks: this.totalChunks,
      filename: this.filename,
      mimetype: this.mimetype
    });
    
    // Sort chunks by index
    const sortedChunks = [];
    const missingChunks = [];
    
    for (let i = 0; i < this.totalChunks; i++) {
      const chunkKey = `${this.transferId}-${i}`;
      const chunk = this.receivedChunks[chunkKey];
      if (!chunk) {
        console.error(`Missing chunk at index ${i}`);
        missingChunks.push(i);
        // Continue and attempt reconstruction anyway in case some chunks were miscounted
      } else {
        sortedChunks.push(chunk);
      }
    }
    
    if (missingChunks.length > 0) {
      console.warn(`Missing ${missingChunks.length} chunks: ${missingChunks.join(', ')}`);
      // If we're missing too many chunks, don't attempt reconstruction
      if (missingChunks.length > Math.min(3, this.totalChunks * 0.1)) {
        return null;
      }
    }
    
    try {
      // Process each chunk separately and combine the binary data
      const allBinaryData = [];
      let totalSize = 0;
      
      // First pass - calculate total size and validate chunks
      for (const chunk of sortedChunks) {
        try {
          // Decode each chunk's base64 data separately
          const chunkBytes = this.base64ToUint8Array(chunk.data);
          totalSize += chunkBytes.length;
        } catch (error) {
          console.error(`Error decoding chunk ${chunk.chunkIndex}:`, error);
          return null;
        }
      }
      
      // Allocate a buffer for the entire file
      const combinedBuffer = new Uint8Array(totalSize);
      let offset = 0;
      
      // Second pass - fill the buffer
      for (const chunk of sortedChunks) {
        const chunkBytes = this.base64ToUint8Array(chunk.data);
        combinedBuffer.set(chunkBytes, offset);
        offset += chunkBytes.length;
      }
      
      // Create blob and return file object
      const blob = new Blob([combinedBuffer], { type: this.mimetype || 'application/octet-stream' });
      return {
        blob: blob,
        filename: this.filename || 'downloaded_file',
        mimetype: this.mimetype || 'application/octet-stream'
      };
    } catch (error) {
      console.error('Error reconstructing file:', error);
      return null;
    }
  }
  
  // Helper method to safely convert base64 to Uint8Array
  base64ToUint8Array(base64) {
    // Add padding if needed
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    
    try {
      const binaryString = window.atob(paddedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      console.error('Base64 decoding error:', error);
      throw new Error('Failed to decode base64 data: ' + error.message);
    }
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