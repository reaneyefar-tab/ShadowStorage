import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { TaskArguments } from "hardhat/types";
import { ethers } from "ethers";

const encoder = new TextEncoder();

function deriveKeyBytes(secretAddress: string, length: number): Uint8Array {
  let seed = ethers.keccak256(ethers.toUtf8Bytes(secretAddress.toLowerCase()));
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

function encryptIpfsHash(plainHash: string, secretAddress: string): string {
  const hashBytes = encoder.encode(plainHash);
  const key = deriveKeyBytes(secretAddress, hashBytes.length);
  const encrypted = hashBytes.map((byte, i) => byte ^ key[i]);
  return ethers.hexlify(encrypted);
}

async function resolveContract(hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers: hreEthers } = hre;
  const deployment = await deployments.get("ShadowStorage");
  const [signer] = await hreEthers.getSigners();
  const contract = await hreEthers.getContractAt("ShadowStorage", deployment.address);
  return { deployment, signer, contract };
}

task("task:address", "Prints the ShadowStorage address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const deployment = await hre.deployments.get("ShadowStorage");
  console.log(`ShadowStorage address is ${deployment.address}`);
});

task("task:file-count", "Prints how many encrypted files an address stored")
  .addOptionalParam("user", "User address to inspect")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { contract } = await resolveContract(hre);
    const [signer] = await hre.ethers.getSigners();
    const user = (taskArguments.user as string) ?? signer.address;
    const count = await contract.getFileCount(user);
    console.log(`Files stored for ${user}: ${count.toString()}`);
  });

task("task:store-file", "Encrypts a new file reference and stores it on-chain")
  .addParam("name", "Readable file name")
  .addParam("hash", "Plain IPFS hash generated off-chain")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { contract, signer, deployment } = await resolveContract(hre);
    const { fhevm } = hre;

    await fhevm.initializeCLIApi();

    const ephemeralWallet = ethers.Wallet.createRandom();
    const encryptedHash = encryptIpfsHash(taskArguments.hash as string, ephemeralWallet.address);

    const encryptedAddress = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(ephemeralWallet.address)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .saveFile(
        taskArguments.name as string,
        encryptedHash,
        encryptedAddress.handles[0],
        encryptedAddress.inputProof,
      );
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(
      `Stored '${taskArguments.name}' with encrypted hash ${encryptedHash} using secret ${ephemeralWallet.address}`,
    );
  });
