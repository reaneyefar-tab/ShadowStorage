const IPFS_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function randomBase58(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => IPFS_ALPHABET[byte % IPFS_ALPHABET.length]).join('');
}

export async function mockIPFSUpload(file: File) {
  const latency = 500 + Math.random() * 800;
  await new Promise(resolve => setTimeout(resolve, latency));

  return {
    hash: `Qm${randomBase58(44)}`,
    size: file.size,
    mimeType: file.type,
  };
}
