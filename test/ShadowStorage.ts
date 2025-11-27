import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { ShadowStorage, ShadowStorage__factory } from "../types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

type Signers = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ShadowStorage")) as ShadowStorage__factory;
  const contract = (await factory.deploy()) as ShadowStorage;
  return { contract, address: await contract.getAddress() };
}

describe("ShadowStorage", function () {
  let contract: ShadowStorage;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    signers = { owner, alice, bob };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    const deployment = await deployFixture();
    contract = deployment.contract;
    contractAddress = deployment.address;
  });

  async function encryptAddress(owner: HardhatEthersSigner, addressToEncrypt: string) {
    return fhevm.createEncryptedInput(contractAddress, owner.address).addAddress(addressToEncrypt).encrypt();
  }

  it("starts with empty storage", async function () {
    const count = await contract.getFileCount(signers.alice.address);
    expect(count).to.equal(0);
    const files = await contract.getFiles(signers.alice.address);
    expect(files.length).to.equal(0);
  });

  it("saves a file record and can be retrieved", async function () {
    const encryptedAddress = await encryptAddress(signers.alice, signers.bob.address);
    const encryptedHash = "0xbeef";

    await expect(
      contract.connect(signers.alice).saveFile("report.pdf", encryptedHash, encryptedAddress.handles[0], encryptedAddress.inputProof),
    )
      .to.emit(contract, "FileStored")
      .withArgs(signers.alice.address, 0, "report.pdf", encryptedHash);

    const stored = await contract.getFile(signers.alice.address, 0);
    expect(stored.fileName).to.equal("report.pdf");
    expect(stored.encryptedIpfsHash).to.equal(encryptedHash);
    expect(await contract.getFileCount(signers.alice.address)).to.equal(1);
  });

  it("returns all files for an account", async function () {
    for (let i = 0; i < 2; i++) {
      const encryptedAddress = await encryptAddress(signers.alice, ethers.Wallet.createRandom().address);
      await contract
        .connect(signers.alice)
        .saveFile(`file-${i}`, `0xdata${i}`, encryptedAddress.handles[0], encryptedAddress.inputProof);
    }

    const files = await contract.getFiles(signers.alice.address);
    expect(files.length).to.equal(2);
    expect(files[0].fileName).to.equal("file-0");
    expect(files[1].fileName).to.equal("file-1");
  });

  it("grants decrypt permission to another account", async function () {
    const encryptedAddress = await encryptAddress(signers.alice, signers.alice.address);
    await contract
      .connect(signers.alice)
      .saveFile("notes.txt", "0x1234", encryptedAddress.handles[0], encryptedAddress.inputProof);

    await expect(contract.connect(signers.alice).grantDecryptPermission(0, signers.bob.address))
      .to.emit(contract, "FileAccessGranted")
      .withArgs(signers.alice.address, signers.bob.address, 0);
  });

  it("reverts on invalid input", async function () {
    await expect(contract.saveFile("", "0x1234", ethers.ZeroHash, "0x")).to.be.revertedWith("EMPTY_NAME");
    await expect(contract.saveFile("name", "", ethers.ZeroHash, "0x")).to.be.revertedWith("EMPTY_HASH");
    await expect(contract.getFile(signers.alice.address, 0)).to.be.revertedWith("INVALID_INDEX");
    await expect(contract.connect(signers.alice).grantDecryptPermission(0, signers.bob.address)).to.be.revertedWith(
      "INVALID_INDEX",
    );
    const encryptedAddress = await encryptAddress(signers.alice, signers.alice.address);
    await contract
      .connect(signers.alice)
      .saveFile("name", "0x1234", encryptedAddress.handles[0], encryptedAddress.inputProof);
    await expect(contract.connect(signers.alice).grantDecryptPermission(0, ethers.ZeroAddress)).to.be.revertedWith(
      "INVALID_ACCOUNT",
    );
  });
});
