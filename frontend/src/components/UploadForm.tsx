import { useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { mockIPFSUpload } from '../utils/ipfs';
import { encryptIpfsHash } from '../utils/encryption';
import '../styles/UploadForm.css';

type UploadFormProps = {
  onStored?: () => void;
};

export function UploadForm({ onStored }: UploadFormProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
    setFileName(file?.name ?? '');
    setIpfsHash('');
    setStatusMessage('');
    setUploadProgress('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMessage('Please choose a file first.');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Connecting to IPFS gateway…');
    try {
      const result = await mockIPFSUpload(selectedFile);
      setIpfsHash(result.hash);
      setUploadProgress(`Generated pseudo IPFS hash: ${result.hash}`);
      setStatusMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : 'Failed to upload to IPFS');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!address) {
      setStatusMessage('Connect your wallet to store files.');
      return;
    }

    if (!selectedFile || !ipfsHash || !instance) {
      setStatusMessage('Select a file and upload it to IPFS first.');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setStatusMessage('Unable to access wallet signer.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('Encrypting metadata with Zama relayer…');
    try {
      const ephemeralWallet = Wallet.createRandom();

      const encryptedHash = encryptIpfsHash(ipfsHash, ephemeralWallet.address);
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(ephemeralWallet.address)
        .encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setStatusMessage('Submitting transaction to ShadowStorage…');
      const tx = await contract.saveFile(
        fileName.trim() || selectedFile.name,
        encryptedHash,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      await tx.wait();

      setStatusMessage('Stored on-chain! Refreshing file list…');
      setSelectedFile(null);
      setPreviewUrl('');
      setIpfsHash('');
      setUploadProgress('');
      setFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onStored?.();
    } catch (error) {
      console.error('Failed to store encrypted file', error);
      setStatusMessage(error instanceof Error ? error.message : 'Transaction failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="upload-card">
      <header>
        <h2>Encrypt a new file</h2>
        <p>Everything happens in your browser before touching the blockchain.</p>
      </header>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-control">
          <label htmlFor="file">Choose a document</label>
          <input
            id="file"
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg,.txt,.zip"
          />
          {previewUrl && (
            <div className="file-preview">
              <span>{selectedFile?.name}</span>
              <small>{(selectedFile?.size ?? 0) / 1024 < 1024 ? `${((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB` : `${((selectedFile?.size ?? 0) / 1024 / 1024).toFixed(1)} MB`}</small>
            </div>
          )}
        </div>

        <div className="form-control">
          <label htmlFor="fileName">File name on-chain</label>
          <input
            id="fileName"
            type="text"
            placeholder="Budget-proposal.pdf"
            value={fileName}
            onChange={event => setFileName(event.target.value)}
          />
        </div>

        <div className="form-control">
          <label>IPFS upload</label>
          <button type="button" onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? 'Uploading…' : ipfsHash ? 'Re-upload' : 'Upload to IPFS'}
          </button>
          {uploadProgress && <p className="info-text">{uploadProgress}</p>}
        </div>

        {ipfsHash && (
          <div className="form-control">
            <label>Generated IPFS hash</label>
            <div className="pill">{ipfsHash}</div>
          </div>
        )}

        <button type="submit" disabled={!address || !ipfsHash || isSaving || zamaLoading}>
          {zamaLoading ? 'Bootstrapping Zama relayer…' : isSaving ? 'Saving encrypted record…' : 'Store encrypted file'}
        </button>

        {statusMessage && <p className="info-text">{statusMessage}</p>}
        {zamaError && <p className="error-text">{zamaError}</p>}
      </form>
    </section>
  );
}
