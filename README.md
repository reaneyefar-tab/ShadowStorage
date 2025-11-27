# ShadowStorage

ShadowStorage is a privacy-first file reference vault built with Zama's FHEVM. Users keep their files locally, generate a pseudo IPFS hash, wrap it with an ephemeral EVM address, and store the encrypted references on-chain. Decryption is performed through Zama's relayer so secrets never leak on-chain or to the backend.

## Why ShadowStorage
- Keeps real files off-chain while still offering verifiable, timestamped records.
- Hides raw IPFS hashes by encrypting them with a locally generated wallet that only the user controls.
- Uses Fully Homomorphic Encryption (FHE) so decryption rights can be granted without exposing plaintext.
- Non-custodial and network-ready: wallets sign everything and the contract enforces permissions.
- Gas-efficient footprint: only small strings and encrypted addresses are stored.

## What It Solves
- On-chain storage pointers often leak IPFS hashes; ShadowStorage obfuscates them with user-held secrets.
- Teams need to prove a file existed at a point in time without revealing its contents; encrypted metadata plus timestamps provide that auditability.
- Sharing decryption selectively is hard; `grantDecryptPermission` delegates access for a given record without re-uploading.
- Keeping keys safe while still enabling recovery; the relayer-based FHE flow decrypts only when the user signs an EIP-712 request.

## How It Works
1. User selects a local file in the frontend.
2. A pseudo IPFS upload runs in the browser, generating a random-looking hash (no real upload required).
3. The app creates a random EVM address `A` and XOR-encrypts the IPFS hash with key material derived from `A`.
4. `A` is encrypted with Zama FHE and stored on-chain with the encrypted hash and file name via `saveFile`.
5. Anyone can read encrypted records, but only the owner (or granted accounts) can request a relayer decrypt of `A`.
6. Once `A` is decrypted client-side, the user recovers the original IPFS hash and can open it via a public gateway.

## Tech Stack
- Smart contracts: Solidity 0.8.27, Hardhat, hardhat-deploy, TypeChain, Solidity coverage, gas reporter.
- FHE: Zama FHEVM (`@fhevm/solidity`, `@fhevm/hardhat-plugin`) and relayer SDK (`@zama-fhe/relayer-sdk`).
- Frontend: React + Vite + TypeScript, RainbowKit + wagmi + viem (reads), ethers (writes).
- Tooling: ESLint, Prettier, Chai/Mocha tests, pnpm-compatible npm scripts.

## Repository Layout
- `contracts/` — `ShadowStorage.sol` contract.
- `deploy/` — hardhat-deploy script for all networks.
- `tasks/` — custom Hardhat tasks for storing and inspecting records.
- `test/` — unit tests (FHE mock aware).
- `deployments/` — generated deployment artifacts; use `deployments/sepolia/ShadowStorage.json` to feed the frontend ABI.
- `frontend/` — Vite React dapp (no environment variables; contract config is static).
- `docs/` — Zama-specific implementation notes (`docs/zama_llm.md`, `docs/zama_doc_relayer.md`).

## Prerequisites
- Node.js 20+
- npm 7+
- A Sepolia wallet private key (no mnemonic) with test ETH.
- Infura API key for Sepolia RPC access.

## Backend / Contract Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Environment file (root `.env`) — required keys
   ```
   INFURA_API_KEY=<your_infura_project_id>
   PRIVATE_KEY=<hex_private_key_with_or_without_0x_prefix>
   ETHERSCAN_API_KEY=<optional_for_verification>
   ```
   Do not use mnemonics; the Hardhat config expects `PRIVATE_KEY` and Infura.
3. Compile & test
   ```bash
   npm run compile
   npm run test           # uses FHE mock; skips when FHE mock is unavailable
   npm run coverage       # optional
   ```
4. Local development network
   ```bash
   npm run chain              # starts Hardhat node
   npm run deploy:localhost   # deploys ShadowStorage to localhost
   ```
5. Custom Hardhat tasks
   - `npx hardhat task:address --network <network>` — print contract address.
   - `npx hardhat task:file-count --network <network> --user <address>` — list stored files for a user.
   - `npx hardhat task:store-file --network <network> --name "<file>" --hash "<ipfsHash>"` — encrypt and store a record using the CLI flow.
6. Deploy to Sepolia
   ```bash
   npm run deploy:sepolia
   # Optional verification (after updating the address)
   npm run verify:sepolia -- <DEPLOYED_ADDRESS>
   ```
   Deployment uses `PRIVATE_KEY` + Infura; ensure the account has Sepolia ETH.

## Frontend Setup
1. Install dependencies
   ```bash
   cd frontend
   npm install
   ```
2. Point to the live contract
   - Open `frontend/src/config/contracts.ts`.
   - Set `CONTRACT_ADDRESS` to the deployed address from `deployments/sepolia/ShadowStorage.json`.
   - Replace `CONTRACT_ABI` with the ABI array from the same JSON (frontend must use the generated ABI and no `.env` files).
3. Run the app
   ```bash
   npm run dev
   ```
   Connect a Sepolia wallet via RainbowKit, upload a file, generate the pseudo IPFS hash, store it, then decrypt to reveal the original hash and the ephemeral secret address.

## Key Advantages in Use
- **End-to-end secrecy**: IPFS hash is never on-chain in plaintext; decryption requires the user's signature and the relayer.
- **Deterministic recovery**: XOR encryption with the ephemeral wallet makes the hash recoverable only after decrypting `A`.
- **Permissioned sharing**: `grantDecryptPermission` lets owners delegate decryption rights per record without new uploads.
- **Chain-portable metadata**: Small storage footprint keeps gas predictable and lets the same pattern work across supported FHEVM networks.
- **Browser-first UX**: All encryption and mock IPFS work happens client-side; no backend dependencies.

## Future Plans
- Swap the mock IPFS uploader for a production pinning flow while preserving the deterministic encryption scheme.
- Add batch uploads and pagination for large libraries.
- Extend relayer UX with clearer signature prompts and expiry controls.
- Build a download-helper that fetches from configurable gateways once the IPFS hash is recovered.
- Multi-chain support once additional FHEVM networks are available.

## Notes & References
- Zama protocol details: `docs/zama_llm.md` and `docs/zama_doc_relayer.md`.
- Contract ABI source of truth: `deployments/sepolia/ShadowStorage.json` (copy into the frontend config).
- Frontend reads use viem; writes use ethers per project guidelines.
- No Tailwind or frontend environment variables are required; configuration stays in code.
