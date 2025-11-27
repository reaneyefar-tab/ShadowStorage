import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo-stack">
          <div className="logo-dot" />
          <div>
            <p className="logo-kicker">ShadowStorage</p>
            <h1 className="logo-title">Private file vault</h1>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
