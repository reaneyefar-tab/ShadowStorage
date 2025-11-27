import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { UploadForm } from './UploadForm';
import { FileList } from './FileList';
import '../styles/StorageApp.css';

export function StorageApp() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('upload');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleStored = () => {
    setActiveTab('files');
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="storage-app">
      <Header />
      <main className="storage-main">
        <section className="hero">
          <div>
            <p className="hero-kicker">ShadowStorage · Encrypted file locker</p>
            <h1 className="hero-title">Store IPFS references with FHE privacy</h1>
            <p className="hero-description">
              Upload any document from your device, wrap its IPFS hash with a locally generated wallet,
              encrypt that wallet with Zama FHE, and recover everything on demand without exposing secrets on-chain.
            </p>
            <div className="hero-stats">
              <div>
                <p className="stat-label">Connected wallet</p>
                <p className="stat-value">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'}</p>
              </div>
              <div>
                <p className="stat-label">Network</p>
                <p className="stat-value">Sepolia</p>
              </div>
            </div>
          </div>
        </section>

        <div className="tab-navigation">
          <button
            className={activeTab === 'upload' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('upload')}
          >
            Upload file
          </button>
          <button
            className={activeTab === 'files' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('files')}
          >
            My encrypted files
          </button>
        </div>

        {activeTab === 'upload' ? (
          <UploadForm onStored={handleStored} />
        ) : (
          <FileList refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
