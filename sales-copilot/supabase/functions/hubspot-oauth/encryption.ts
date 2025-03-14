export function encrypt(text: string, key: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key);
  
  // Simple XOR encryption (for demo purposes)
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

export function decrypt(encryptedText: string, key: string): string {
  const decoder = new TextDecoder();
  const keyData = new TextEncoder().encode(key);
  
  const data = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ keyData[i % keyData.length];
  }
  
  return decoder.decode(decrypted);
} 