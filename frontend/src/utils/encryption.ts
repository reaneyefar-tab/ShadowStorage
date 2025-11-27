import { ethers } from 'ethers';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function deriveKey(secretAddress: string, length: number) {
  const normalized = secretAddress.toLowerCase();
  let seed = ethers.keccak256(ethers.toUtf8Bytes(normalized));
  let pool = ethers.getBytes(seed);
  const derived = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    derived[i] = pool[i % pool.length];
    if ((i + 1) % pool.length === 0 && i + 1 < length) {
      seed = ethers.keccak256(pool);
      pool = ethers.getBytes(seed);
    }
  }

  return derived;
}

function xorBytes(message: Uint8Array, key: Uint8Array) {
  const output = new Uint8Array(message.length);
  for (let i = 0; i < message.length; i++) {
    output[i] = message[i] ^ key[i];
  }
  return output;
}

export function encryptIpfsHash(ipfsHash: string, secretAddress: string) {
  const payload = encoder.encode(ipfsHash);
  const key = deriveKey(secretAddress, payload.length);
  const encrypted = xorBytes(payload, key);
  return ethers.hexlify(encrypted);
}

export function decryptIpfsHash(encryptedHex: string, secretAddress: string) {
  const payload = ethers.getBytes(encryptedHex as `0x${string}`);
  const key = deriveKey(secretAddress, payload.length);
  const decrypted = xorBytes(payload, key);
  return decoder.decode(decrypted);
}
