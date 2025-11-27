import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptIpfsHash } from '../utils/encryption';
import '../styles/FileList.css';

type ChainFileTuple = readonly [string, string, `0x${string}`, bigint];

type FileListProps = {
  refreshKey: number;
};

export function FileList({ refreshKey }: FileListProps) {
  const { address } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [activeDecrypt, setActiveDecrypt] = useState<number | null>(null);
  const [decryptedDetails, setDecryptedDetails] = useState<Record<number, { ipfsHash: string; secretAddress: string }>>({});
  const [errorMessage, setErrorMessage] = useState('');

  const {
    data,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getFiles',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    if (address) {
      refetch();
    }
  }, [address, refreshKey, refetch]);

  const files = useMemo(() => {
    if (!data) {
      return [];
    }

    return (data as readonly unknown[]).map((item, index) => {
      const tuple = item as Partial<Record<'fileName' | 'encryptedIpfsHash' | 'encryptedSecret' | 'createdAt', unknown>> &
        ChainFileTuple;

      return {
        index,
        fileName: (tuple.fileName as string) ?? tuple[0],
        encryptedHash: (tuple.encryptedIpfsHash as string) ?? tuple[1],
        encryptedSecret: ((tuple.encryptedSecret as string) ?? tuple[2]) as string,
        createdAt: Number((tuple.createdAt as bigint) ?? tuple[3]),
      };
    });
  }, [data]);

  const decryptRecord = async (index: number, encryptedSecret: string, encryptedHash: string) => {
    if (!instance || !address) {
      setErrorMessage('Connect wallet and wait for the Zama SDK.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setErrorMessage('Unable to access wallet signer.');
      return;
    }

    setActiveDecrypt(index);
    setErrorMessage('');
    try {
      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const eip712 = instance.createEIP712(keypair.publicKey, [CONTRACT_ADDRESS], startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const response = await instance.userDecrypt(
        [{ handle: encryptedSecret, contractAddress: CONTRACT_ADDRESS }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        [CONTRACT_ADDRESS],
        address,
        startTimestamp,
        durationDays,
      );

      const decryptedAddress = response[encryptedSecret];
      if (!decryptedAddress) {
        throw new Error('Unable to decrypt encrypted wallet address.');
      }

      const originalHash = decryptIpfsHash(encryptedHash, decryptedAddress);
      setDecryptedDetails(prev => ({
        ...prev,
        [index]: {
          ipfsHash: originalHash,
          secretAddress: decryptedAddress,
        },
      }));
    } catch (error) {
      console.error('Failed to decrypt record', error);
      setErrorMessage(error instanceof Error ? error.message : 'Decryption failed');
    } finally {
      setActiveDecrypt(null);
    }
  };

  if (!address) {
    return (
      <section className="files-card">
        <p>Please connect your wallet to view encrypted files.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="files-card">
        <p>Loading encrypted files from the blockchain…</p>
      </section>
    );
  }

  if (!files.length) {
    return (
      <section className="files-card">
        <p>No encrypted files found yet.</p>
        <p className="info-text">Upload your first document to see it appear here.</p>
      </section>
    );
  }

  return (
    <section className="files-card">
      <header>
        <h2>Stored files</h2>
        <p>Decrypt the hidden wallet to reveal the original IPFS hash.</p>
      </header>
      <div className="files-grid">
        {files.map(file => (
          <article key={`${file.fileName}-${file.index}`} className="file-entry">
            <div className="file-header">
              <h3>{file.fileName}</h3>
              <span>{new Date(file.createdAt * 1000).toLocaleString()}</span>
            </div>
            <p className="hash-line">
              Encrypted hash:
              <code>{file.encryptedHash.slice(0, 18)}…</code>
            </p>
            {decryptedDetails[file.index] ? (
              <div className="decrypted-panel">
                <p>
                  <strong>IPFS hash:</strong> {decryptedDetails[file.index].ipfsHash}
                </p>
                {/* <p>
                  <strong>Secret wallet:</strong> {decryptedDetails[file.index].secretAddress}
                </p> */}
                <a
                  href={`https://ipfs.io/ipfs/${decryptedDetails[file.index].ipfsHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open via public gateway
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => decryptRecord(file.index, file.encryptedSecret, file.encryptedHash)}
                disabled={activeDecrypt === file.index || !instance}
              >
                {activeDecrypt === file.index ? 'Decrypting…' : 'Decrypt secret address'}
              </button>
            )}
          </article>
        ))}
      </div>
      {errorMessage && <p className="error-text">{errorMessage}</p>}
    </section>
  );
}
