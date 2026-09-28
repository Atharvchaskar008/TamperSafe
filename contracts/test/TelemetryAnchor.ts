import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const HEAD_1 = ethers.keccak256(ethers.toUtf8Bytes("head-1"));
const HEAD_2 = ethers.keccak256(ethers.toUtf8Bytes("head-2"));
const EVIDENCE_HASH = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
const ORDER_ID = 1n;

async function deployAnchor() {
  const [admin, oracle, stranger] = await ethers.getSigners();
  const anchor = await ethers.deployContract("TelemetryAnchor", [admin.address]);
  await anchor.connect(admin).grantRole(ORACLE_ROLE, oracle.address);
  return { anchor, admin, oracle, stranger };
}

describe("TelemetryAnchor", function () {
  describe("anchor", function () {
    it("oracle anchors the first head for an order (seq > 0)", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);

      await expect(anchor.connect(oracle).anchor(ORDER_ID, 1, HEAD_1, 20))
        .to.emit(anchor, "Anchored")
        .withArgs(ORDER_ID, 1, HEAD_1, 20);

      const latest = await anchor.latest(ORDER_ID);
      expect(latest.seq).to.equal(1);
      expect(latest.head).to.equal(HEAD_1);
    });

    it("accepts a strictly increasing seq", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);
      await anchor.connect(oracle).anchor(ORDER_ID, 1, HEAD_1, 20);

      await expect(anchor.connect(oracle).anchor(ORDER_ID, 21, HEAD_2, 20))
        .to.emit(anchor, "Anchored")
        .withArgs(ORDER_ID, 21, HEAD_2, 20);

      const latest = await anchor.latest(ORDER_ID);
      expect(latest.seq).to.equal(21);
      expect(latest.head).to.equal(HEAD_2);
    });

    it("reverts StaleSeq on a non-increasing seq (equal)", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);
      await anchor.connect(oracle).anchor(ORDER_ID, 5, HEAD_1, 20);

      await expect(anchor.connect(oracle).anchor(ORDER_ID, 5, HEAD_2, 20))
        .to.be.revertedWithCustomError(anchor, "StaleSeq")
        .withArgs(ORDER_ID, 5, 5);
    });

    it("reverts StaleSeq on a non-increasing seq (lower)", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);
      await anchor.connect(oracle).anchor(ORDER_ID, 5, HEAD_1, 20);

      await expect(anchor.connect(oracle).anchor(ORDER_ID, 3, HEAD_2, 20))
        .to.be.revertedWithCustomError(anchor, "StaleSeq")
        .withArgs(ORDER_ID, 3, 5);
    });

    it("reverts StaleSeq on a first anchor with seq 0", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);

      await expect(anchor.connect(oracle).anchor(ORDER_ID, 0, HEAD_1, 20))
        .to.be.revertedWithCustomError(anchor, "StaleSeq")
        .withArgs(ORDER_ID, 0, 0);
    });

    it("tracks separate orders independently", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);
      await anchor.connect(oracle).anchor(1n, 10, HEAD_1, 5);
      await anchor.connect(oracle).anchor(2n, 1, HEAD_2, 1);

      expect((await anchor.latest(1n)).seq).to.equal(10);
      expect((await anchor.latest(2n)).seq).to.equal(1);
    });

    it("reverts when a non-oracle calls anchor", async function () {
      const { anchor, stranger } = await networkHelpers.loadFixture(deployAnchor);

      await expect(anchor.connect(stranger).anchor(ORDER_ID, 1, HEAD_1, 20))
        .to.be.revertedWithCustomError(anchor, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ORACLE_ROLE);
    });
  });

  describe("logAlert", function () {
    it("oracle logs an alert (emits only, no state change)", async function () {
      const { anchor, oracle } = await networkHelpers.loadFixture(deployAnchor);

      await expect(anchor.connect(oracle).logAlert(ORDER_ID, 10, EVIDENCE_HASH))
        .to.emit(anchor, "Alert")
        .withArgs(ORDER_ID, 10, EVIDENCE_HASH);

      // logAlert must never touch the anchored seq/head for the order.
      expect((await anchor.latest(ORDER_ID)).seq).to.equal(0);
    });

    it("reverts when a non-oracle calls logAlert", async function () {
      const { anchor, stranger } = await networkHelpers.loadFixture(deployAnchor);

      await expect(anchor.connect(stranger).logAlert(ORDER_ID, 10, EVIDENCE_HASH))
        .to.be.revertedWithCustomError(anchor, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ORACLE_ROLE);
    });
  });
});
