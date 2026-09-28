import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const BOX_ID = ethers.keccak256(ethers.toUtf8Bytes("TS-BOX-01"));
const OTHER_BOX_ID = ethers.keccak256(ethers.toUtf8Bytes("TS-BOX-02"));
const UNKNOWN_BOX_ID = ethers.keccak256(ethers.toUtf8Bytes("TS-BOX-99"));
const BINDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BINDER_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

async function deployRegistry() {
  const [admin, binder, stranger, deviceKey] = await ethers.getSigners();
  const registry = await ethers.deployContract("BoxRegistry", [admin.address]);
  await registry.connect(admin).grantRole(BINDER_ROLE, binder.address);
  return { registry, admin, binder, stranger, deviceKey };
}

describe("BoxRegistry", function () {
  describe("registerBox", function () {
    it("admin registers a new box", async function () {
      const { registry, admin, deviceKey } = await networkHelpers.loadFixture(deployRegistry);

      await expect(registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01"))
        .to.emit(registry, "BoxRegistered")
        .withArgs(BOX_ID, deviceKey.address, "TS-BOX-01");

      const box = await registry.getBox(BOX_ID);
      expect(box.deviceKey).to.equal(deviceKey.address);
      expect(box.active).to.equal(true);
      expect(box.activeOrderId).to.equal(0n);
      expect(box.label).to.equal("TS-BOX-01");
    });

    it("reverts BoxExists on a duplicate registration", async function () {
      const { registry, admin, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");

      await expect(registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01"))
        .to.be.revertedWithCustomError(registry, "BoxExists")
        .withArgs(BOX_ID);
    });

    it("reverts BoxExists on a duplicate even after the box was deactivated", async function () {
      const { registry, admin, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");
      await registry.connect(admin).setActive(BOX_ID, false);

      await expect(
        registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01"),
      ).to.be.revertedWithCustomError(registry, "BoxExists");
    });

    it("reverts when a non-admin registers a box", async function () {
      const { registry, stranger, deviceKey } = await networkHelpers.loadFixture(deployRegistry);

      await expect(registry.connect(stranger).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01"))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("setActive", function () {
    it("admin disables and re-enables a box", async function () {
      const { registry, admin, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");

      await expect(registry.connect(admin).setActive(BOX_ID, false))
        .to.emit(registry, "BoxActiveSet")
        .withArgs(BOX_ID, false);
      expect((await registry.getBox(BOX_ID)).active).to.equal(false);

      await expect(registry.connect(admin).setActive(BOX_ID, true))
        .to.emit(registry, "BoxActiveSet")
        .withArgs(BOX_ID, true);
      expect((await registry.getBox(BOX_ID)).active).to.equal(true);
    });

    it("reverts when a non-admin sets active state", async function () {
      const { registry, admin, stranger, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");

      await expect(registry.connect(stranger).setActive(BOX_ID, false))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("bind / unbind", function () {
    it("BINDER_ROLE binds a free active box, and unbind frees it", async function () {
      const { registry, admin, binder, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");

      await expect(registry.connect(binder).bind(BOX_ID, 7n))
        .to.emit(registry, "BoxBound")
        .withArgs(BOX_ID, 7n);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(7n);

      await expect(registry.connect(binder).unbind(BOX_ID))
        .to.emit(registry, "BoxUnbound")
        .withArgs(BOX_ID, 7n); // carries the orderId that was bound
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(0n);
    });

    it("reverts BoxUnavailable when binding an unregistered box", async function () {
      const { registry, binder } = await networkHelpers.loadFixture(deployRegistry);

      await expect(registry.connect(binder).bind(UNKNOWN_BOX_ID, 1n))
        .to.be.revertedWithCustomError(registry, "BoxUnavailable")
        .withArgs(UNKNOWN_BOX_ID);
    });

    it("reverts BoxUnavailable when binding an inactive box", async function () {
      const { registry, admin, binder, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");
      await registry.connect(admin).setActive(BOX_ID, false);

      await expect(registry.connect(binder).bind(BOX_ID, 1n))
        .to.be.revertedWithCustomError(registry, "BoxUnavailable")
        .withArgs(BOX_ID);
    });

    it("reverts BoxUnavailable when double-binding an already-bound box", async function () {
      const { registry, admin, binder, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");
      await registry.connect(binder).bind(BOX_ID, 1n);

      await expect(registry.connect(binder).bind(BOX_ID, 2n))
        .to.be.revertedWithCustomError(registry, "BoxUnavailable")
        .withArgs(BOX_ID);
    });

    it("reverts when a non-binder calls bind", async function () {
      const { registry, admin, stranger, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");

      await expect(registry.connect(stranger).bind(BOX_ID, 1n))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, BINDER_ROLE);
    });

    it("reverts when a non-binder calls unbind", async function () {
      const { registry, admin, binder, stranger, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");
      await registry.connect(binder).bind(BOX_ID, 1n);

      await expect(registry.connect(stranger).unbind(BOX_ID))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, BINDER_ROLE);
    });

    it("binding one box does not affect another box's free status", async function () {
      const { registry, admin, binder, deviceKey } = await networkHelpers.loadFixture(deployRegistry);
      await registry.connect(admin).registerBox(BOX_ID, deviceKey.address, "TS-BOX-01");
      await registry.connect(admin).registerBox(OTHER_BOX_ID, deviceKey.address, "TS-BOX-02");

      await registry.connect(binder).bind(BOX_ID, 1n);
      await expect(registry.connect(binder).bind(OTHER_BOX_ID, 2n))
        .to.emit(registry, "BoxBound")
        .withArgs(OTHER_BOX_ID, 2n);
    });
  });
});
