interface EncryptedPacket {
    version: number;
    iv: string;        // base64
    data: string;      // base64
    checksum: string;  // simple verification
}

export class EncryptionManager {
  private keyPair: CryptoKeyPair | null = null;
  private symmetricKeys: Record<string, CryptoKey> = {};
  private wallet: any;
  private isInitialized = false;

  constructor(wallet: any) {
    this.wallet = wallet;
  }

  getStoredKeyIds(): string[] {
    return Object.keys(this.symmetricKeys);
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('EncryptionManager already initialized');
      return;
    }

    try {
      // generate rsa key pair for asymmetric encryption
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      await this.loadStoredKeys();
      this.isInitialized = true;
      console.log('EncryptionManager initialized with keys:', Object.keys(this.symmetricKeys));
    } catch (error) {
      console.error('Failed to initialize EncryptionManager:', error);
      throw error;
    }
  }

  private debugEncryptionFormat(data: Uint8Array, stage: string) {
    console.log(`[${stage}] Format check:`, {
        totalLength: data.length,
        ivSection: stage.includes('pre-encryption') ? null : Array.from(data.slice(0, 12)),
        dataSection: {
            length: stage.includes('pre-encryption') ? data.length : data.length - 12,
            firstBytes: Array.from(data.slice(0, 4)),
            lastBytes: Array.from(data.slice(-4))
        }
    });
  }

  private async getKeyId(friendId: string): Promise<string> {
    const currentAccountId = await this.getCurrentAccountId();
    const accounts = [currentAccountId, friendId].sort();
    return `${accounts[0]}:${accounts[1]}`;
  }

  async encryptData(data: any, friendId: string): Promise<string | null> {
    try {
      const keyId = await this.getKeyId(friendId);
      console.log('Encrypting with key:', { friendId, keyId, availableKeys: Object.keys(this.symmetricKeys) });
      
      const key = this.symmetricKeys[keyId];
      if (!key) {
        console.error('No key found for:', keyId);
        return null;
      }

      // create a structured packet
      const packet: EncryptedPacket = {
        version: 1,
        iv: '',
        data: '',
        checksum: ''
      };

      // convert data to string
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);

      // generate iv
      const iv = crypto.getRandomValues(new Uint8Array(12));
      packet.iv = btoa(String.fromCharCode(...iv));

      // encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        dataBuffer
      );

      // store encrypted data
      packet.data = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      
      // add simple checksum
      packet.checksum = btoa(jsonString.length.toString());

      // return the complete packet
      return JSON.stringify(packet);
    } catch (error) {
      console.error('Encryption failed:', error);
      return null;
    }
  }

  
  // for decrypting friend's data
  async decryptData(encryptedString: string, friendId: string): Promise<any> {
    try {
      const keyId = await this.getKeyId(friendId);
      const key = this.symmetricKeys[keyId];

      console.log('Decrypting with key:', {
        friendId,
        keyId,
        availableKeys: Object.keys(this.symmetricKeys)
      });

      if (!key) throw new Error(`No decryption key found for ${keyId}`);

      // parse the encrypted packet
      const packet: EncryptedPacket = JSON.parse(encryptedString);
      if (packet.version !== 1) {
        throw new Error('Unsupported packet version');
      }

      // decode the iv and encrypted data
      const iv = new Uint8Array(atob(packet.iv).split('').map(c => c.charCodeAt(0)));
      const encryptedData = new Uint8Array(atob(packet.data).split('').map(c => c.charCodeAt(0)));

      // decrypt
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        encryptedData
      );

      // decode and parse
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  // for exporting public key to share with friends
  async exportPublicKey(): Promise<string> {
    if (!this.keyPair?.publicKey) {
      throw new Error('Key pair not initialized');
    }
    const exported = await window.crypto.subtle.exportKey(
      "spki",
      this.keyPair.publicKey
    );
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // for storing friend's symmetric key
  async storeSymmetricKey(accountId: string, key: CryptoKey) {
    try {
        // Export the key to raw format for storage
        const rawKey = await window.crypto.subtle.exportKey('raw', key);
        
        // Get existing keys from localStorage
        const storedKeys = localStorage.getItem('symmetricKeys');
        const keyMap = storedKeys ? JSON.parse(storedKeys) : {};
        
        // Store the new key
        keyMap[accountId] = Array.from(new Uint8Array(rawKey));
        localStorage.setItem('symmetricKeys', JSON.stringify(keyMap));
        
        // Add to in-memory map
        this.symmetricKeys[accountId] = key;
        
        console.log('stored key for:', accountId);
        console.log('current stored keys:', Object.keys(keyMap));
    } catch (error) {
        console.error('Error storing symmetric key:', error);
        throw error;
    }
  }

  async generateSymmetricKey(): Promise<CryptoKey> {
    const key = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );
    return key;
  }

  async encryptKeyForFriend(symmetricKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
    try {
        // Export symmetric key as raw bytes
        const rawKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
        
        // Encrypt symmetric key with friend's public key
        const encryptedKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            rawKey
        );
        
        // Convert to base64 safely
        const bytes = new Uint8Array(encryptedKey);
        const base64 = btoa(String.fromCharCode.apply(null, bytes));
        
        return base64;
    } catch (error) {
        console.error('Error encrypting key for friend:', error);
        throw error;
    }
  }

  async loadStoredKeys() {
    try {
        const storedKeys = localStorage.getItem('symmetricKeys');
        if (!storedKeys) return;

        const keyMap = JSON.parse(storedKeys);
        console.log('Loading stored keys:', Object.keys(keyMap));

        for (const [keyId, keyData] of Object.entries(keyMap)) {
            try {
                const keyArray = new Uint8Array(keyData as number[]);
                const key = await this.restoreKeyFromStorage(keyArray);
                this.symmetricKeys[keyId] = key;
                console.log('Restored key:', keyId);
            } catch (e) {
                console.error('Failed to restore key:', keyId, e);
            }
        }
    } catch (error) {
        console.error('Error loading keys:', error);
    }
  }

  async debugSymmetricKey(friendId: string) {
    try {
      const key = this.symmetricKeys.get(friendId);
      if (!key) {
        console.log('no key found for', friendId);
        return;
      }
      
      const exported = await window.crypto.subtle.exportKey('raw', key);
      console.log('key bytes:', new Uint8Array(exported));
      return true;
    } catch (error) {
      console.error('error exporting key:', error);
      return false;
    }
  }

  async validateEncryptedData(base64Data: string): Promise<boolean> {
    try {
        const decoded = atob(base64Data);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }

        // Check minimum length (12 bytes IV + at least 16 bytes for smallest encrypted data + tag)
        if (bytes.length < 28) {
            console.error('Data too short:', bytes.length);
            return false;
        }

        // Extract components
        const iv = bytes.slice(0, 12);
        const encryptedWithTag = bytes.slice(12);

        console.log('Data validation:', {
            totalLength: bytes.length,
            ivLength: iv.length,
            encryptedWithTagLength: encryptedWithTag.length,
            firstBytes: Array.from(bytes.slice(0, 4)),
            lastBytes: Array.from(bytes.slice(-4))
        });

        return iv.length === 12 && encryptedWithTag.length >= 16;
    } catch (e) {
        console.error('Validation error:', e);
        return false;
    }
  }

  async verifyEncryption(data: any): Promise<boolean> {
    try {
        const testKey = await this.generateSymmetricKey();
        const encrypted = await this.encryptData(data, undefined, testKey);
        const decrypted = await this.decryptData(encrypted, undefined, testKey);
        
        console.log('encryption verification:', {
            originalLength: JSON.stringify(data).length,
            encryptedLength: encrypted.length,
            decryptedMatch: JSON.stringify(data) === JSON.stringify(decrypted)
        });
        
        return true;
    } catch (error) {
        console.error('encryption verification failed:', error);
        return false;
    }
  }

  async establishSymmetricKey(friendId: string): Promise<CryptoKey> {
    // generate new symmetric key
    const symmetricKey = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );

    // store it locally
    await this.storeSymmetricKey(friendId, symmetricKey);

    // export for sharing
    const rawKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
    
    // encrypt it with friend's public key

    return symmetricKey;
  }

  // helper method to get current account id
  private async getCurrentAccountId(): Promise<string> {
    try {
        const selector = await this.wallet.selector;
        const state = selector.store.getState();
        const accountId = state.accounts[0]?.accountId;
        
        if (!accountId) {
            throw new Error('No account ID found in wallet state');
        }
        
        return accountId;
    } catch (error) {
        console.error('Error getting current account ID:', error);
        throw error;
    }
  }

  async storeBidirectionalKey(friendId: string, key: CryptoKey) {
    try {
        const currentAccountId = await this.getCurrentAccountId();
        console.log('Storing key for accounts:', {
            current: currentAccountId,
            friend: friendId
        });

        // Create bidirectional key ID
        const accounts = [currentAccountId, friendId].sort();
        const keyId = `${accounts[0]}:${accounts[1]}`;
        
        // Export key
        const rawKey = await window.crypto.subtle.exportKey('raw', key);
        const keyArray = Array.from(new Uint8Array(rawKey));
        
        // Store in localStorage
        const storedKeys = localStorage.getItem('symmetricKeys') || '{}';
        const keyMap = JSON.parse(storedKeys);
        keyMap[keyId] = keyArray;
        localStorage.setItem('symmetricKeys', JSON.stringify(keyMap));
        
        // Store in memory
        this.symmetricKeys[keyId] = key;
        
        console.log('Key stored:', {
            keyId,
            availableKeys: Object.keys(this.symmetricKeys)
        });
        
        return true;
    } catch (error) {
        console.error('Error storing key:', error);
        throw error;
    }
  }

  async importPublicKey(publicKeyData: string): Promise<CryptoKey> {
    try {
        console.log('Importing public key data:', {
            rawData: publicKeyData,
            length: publicKeyData?.length,
            isBase64: this.isBase64(publicKeyData)
        });
        
        // if not base64, try to parse it first
        let base64Key = publicKeyData;
        try {
            const parsed = JSON.parse(publicKeyData);
            base64Key = parsed.key || parsed.publicKey || publicKeyData;
        } catch (e) {
            // not JSON, use as is
        }

        // decode base64 public key
        const keyData = atob(base64Key);
        const keyBytes = new Uint8Array(keyData.length);
        for (let i = 0; i < keyData.length; i++) {
            keyBytes[i] = keyData.charCodeAt(i);
        }
        
        // import as crypto key
        return await window.crypto.subtle.importKey(
            'spki',
            keyBytes,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            },
            true,
            ['encrypt']
        );
    } catch (error) {
        console.error('error importing public key:', error);
        throw error;
    }
  }

  // helper to check if string is base64
  private isBase64(str: string): boolean {
    try {
        return btoa(atob(str)) === str;
    } catch (e) {
        return false;
    }
  }

  private async restoreKeyFromStorage(keyData: Uint8Array): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "raw",
        keyData,
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
  }

  async verifyKeyExchange(friendId: string): Promise<boolean> {
    try {
        // Get the deterministic key ID
        const currentAccountId = await this.getCurrentAccountId();
        const accounts = [currentAccountId, friendId].sort();
        const keyId = `${accounts[0]}:${accounts[1]}`;
        
        // Check if we have the key
        const hasKey = Object.keys(this.symmetricKeys).includes(keyId);
        if (!hasKey) {
            console.error('No stored key found for:', keyId);
            return false;
        }
        
        // Test encryption/decryption
        const testData = { test: 'verification', timestamp: Date.now() };
        const encrypted = await this.encryptData(testData, friendId);
        if (!encrypted) {
            return false;
        }
        
        const decrypted = await this.decryptData(encrypted, friendId);
        if (!decrypted) {
            return false;
        }
        
        return JSON.stringify(testData) === JSON.stringify(decrypted);
    } catch (error) {
        console.error('Key verification failed:', error);
        return false;
    }
  }

  async debugKeys(accountId: string): Promise<void> {
    console.log('Debugging keys for:', accountId);
    
    const currentAccountId = await this.getCurrentAccountId();
    console.log('Current account:', currentAccountId);
    
    const availableKeys = Object.keys(this.symmetricKeys);
    console.log('Available keys:', availableKeys);
    
    for (const keyId of availableKeys) {
        const key = this.symmetricKeys[keyId];
        console.log(`Key ${keyId}:`, {
            type: key.type,
            algorithm: key.algorithm,
            extractable: key.extractable,
            usages: key.usages
        });
    }
  }

  async analyzeEncryptedData(friendId: string, encryptedData: string | null): Promise<any> {
    try {
      if (!encryptedData) {
        console.log('No data to analyze for:', friendId);
        return null;
      }

      // validate that the data is base64 encoded
      const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(encryptedData);
      if (!isBase64) {
        console.log('Data is not base64 encoded:', friendId);
        return null;
      }

      try {
        // attempt to decode and decrypt
        const decrypted = await this.decryptData(encryptedData, friendId);
        if (!decrypted) {
          console.log('Failed to decrypt data for:', friendId);
          return null;
        }
        return decrypted;
      } catch (error) {
        console.log('Decryption failed for:', friendId, error);
        return null;
      }
    } catch (error) {
      console.log('Analysis failed:', error);
      return null;
    }
  }

  async debugEncryptionProcess(data: any, accountId: string): Promise<void> {
    try {
        console.log('Debug encryption process:', {
            originalData: data,
            accountId
        });

        // Try encryption
        const encrypted = await this.encryptData(data, accountId);
        console.log('Encrypted result:', {
            length: encrypted.length,
            sample: encrypted.slice(0, 50)
        });

        // Try decryption
        const decrypted = await this.decryptData(encrypted, accountId);
        console.log('Decryption result:', {
            success: !!decrypted,
            data: decrypted
        });

        // Compare
        const match = JSON.stringify(data) === JSON.stringify(decrypted);
        console.log('Verification:', {
            match,
            originalLength: JSON.stringify(data).length,
            decryptedLength: decrypted ? JSON.stringify(decrypted).length : 0
        });
    } catch (e) {
        console.error('Debug process failed:', e);
    }
  }

  private async restoreKey(rawKeyData: number[]): Promise<CryptoKey> {
    const keyBytes = new Uint8Array(rawKeyData);
    return await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        {
            name: 'AES-GCM',
            length: 256
        },
        true,
        ['encrypt', 'decrypt']
    );
  }

  async loadStoredKeys(): Promise<void> {
    try {
        const storedKeys = localStorage.getItem('symmetricKeys');
        if (!storedKeys) return;

        const keyMap = JSON.parse(storedKeys);
        for (const [accountId, rawKeyData] of Object.entries(keyMap)) {
            try {
                const key = await this.restoreKey(rawKeyData as number[]);
                this.symmetricKeys[accountId] = key;
                console.log('Restored key:', accountId);
            } catch (error) {
                console.error('Failed to restore key for:', accountId, error);
            }
        }
    } catch (error) {
        console.error('Error loading stored keys:', error);
    }
  }

  async verifyEncryptionSystem(accountId: string): Promise<void> {
    try {
        // 1. check what keys we have
        console.log('Available keys:', {
            keyIds: Object.keys(this.symmetricKeys),
            currentAccountId: await this.getCurrentAccountId()
        });

        // 2. test new encryption/decryption
        const testData = { test: 'hello', timestamp: Date.now() };
        console.log('Testing with data:', testData);

        // try encrypt
        const encrypted = await this.encryptData(testData, accountId);
        console.log('Encryption result:', {
            success: !!encrypted,
            length: encrypted?.length
        });

        // try decrypt
        const decrypted = await this.decryptData(encrypted, accountId);
        console.log('Decryption result:', {
            success: !!decrypted,
            matches: JSON.stringify(decrypted) === JSON.stringify(testData),
            decrypted
        });

    } catch (error) {
        console.error('Verification failed:', error);
    }
  }

  async testEncryptionDecryption(friendId: string): Promise<boolean> {
    try {
      const keyId = await this.getKeyId(friendId);
      if (!this.symmetricKeys[keyId]) {
        console.log(`No key found for ${friendId}, skipping test`);
        return false;
      }

      const testData = { test: 'verification', timestamp: Date.now() };
      const encrypted = await this.encryptData(testData, friendId);
      if (!encrypted) return false;

      const decrypted = await this.decryptData(encrypted, friendId);
      if (!decrypted) return false;

      const success = JSON.stringify(testData) === JSON.stringify(decrypted);
      console.log('Key verification result:', { friendId, success });
      return success;
    } catch (error) {
      console.error('Key verification failed:', error);
      return false;
    }
  }

  async basicEncryptionTest(accountId: string): Promise<boolean> {
    try {
        // Generate a test key
        const key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );

        // Test data
        const data = new TextEncoder().encode('test message');
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            key,
            data
        );

        // Decrypt
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            key,
            encrypted
        );

        const result = new TextDecoder().decode(decrypted);
        console.log('Basic test result:', {
            original: 'test message',
            decrypted: result,
            success: result === 'test message'
        });

        return true;
    } catch (error) {
        console.error('Basic test failed:', error);
        return false;
    }
  }

  async initiateFriendRequest(friendId: string): Promise<{publicKey: string, encryptedKey: string}> {
    // generate symmetric key for this friendship
    const symmetricKey = await this.generateSymmetricKey();
    
    // store it locally with a bidirectional ID
    await this.storeBidirectionalKey(friendId, symmetricKey);
    
    // export our public key
    const publicKey = await this.exportPublicKey();
    
    // export and encrypt symmetric key
    const rawKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
    const encryptedKey = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
    
    return {
      publicKey,
      encryptedKey
    };
  }

  async acceptFriendRequest(friendId: string, theirPublicKey: string): Promise<{publicKey: string, encryptedKey: string}> {
    // import their public key
    const publicKey = await this.importPublicKey(theirPublicKey);
    
    // generate our symmetric key
    const symmetricKey = await this.generateSymmetricKey();
    
    // store it locally
    await this.storeBidirectionalKey(friendId, symmetricKey);
    
    // export our public key
    const ourPublicKey = await this.exportPublicKey();
    
    // encrypt our symmetric key with their public key
    const rawKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
    const encryptedKey = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
    
    return {
      publicKey: ourPublicKey,
      encryptedKey
    };
  }
}

function debugCheckStoredKeys() {
    const storedKeys = localStorage.getItem('symmetricKeys');
    console.log('Raw stored keys:', storedKeys);
    if (storedKeys) {
        const parsed = JSON.parse(storedKeys);
        console.log('Parsed stored keys:', Object.keys(parsed));
        for (const [friendId, keyData] of Object.entries(parsed)) {
            console.log(`Key data for ${friendId}:`, keyData);
        }
    }
}

const acceptFriendRequest = async (request: any) => {
    try {
        await encryptionManager.storeBidirectionalKey(request.from, symmetricKey);
        console.log('Stored symmetric key locally');
        debugCheckStoredKeys();
    } catch (error) {
        console.error('Error accepting friend request:', error);
    }
};
