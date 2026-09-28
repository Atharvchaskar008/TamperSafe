import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const BOX_ID = ethers.keccak256(ethers.toUtf8Bytes("TS-BOX-01"));
const OTHER_BOX_ID = ethers.keccak256(ethers.toUtf8Bytes("TS-BOX-02"));
const BASELINE_HASH = ethers.keccak256(ethers.toUtf8Bytes("baseline"));
const LOG_HEAD = ethers.keccak256(ethers.toUtf8Bytes("log-head"));
const EVIDENCE_HASH = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

const DEST_LAT = 12_971_599;
const DEST_LON = 77_594_566;
const ONE_HOUR = 3600;

// Order.status enum, matching ARCHITECTURE.md §6.
const Status = {
  None: 0,
  Funded: 1,
  InTransit: 2,
  UnlockRequested: 3,
  Delivered: 4,
  Tampered: 5,
  Expired: 6,
  Cancelled: 7,
};

async function deployAll() {
  const [admin, oracle, buyer, seller, courier, stranger] = await ethers.getSigners();

  const registry = await ethers.deployContract("BoxRegistry", [admin.address]);
  const escrow = await ethers.deployContract("TamperSafeEscrow", [admin.address, await registry.getAddress()]);

  const BINDER_ROLE = await registry.BINDER_ROLE();
  await registry.connect(admin).grantRole(BINDER_ROLE, await escrow.getAddress());
  await escrow.connect(admin).grantRole(ORACLE_ROLE, oracle.address);
  await registry.connect(admin).registerBox(BOX_ID, ethers.ZeroAddress, "TS-BOX-01");
  await registry.connect(admin).registerBox(OTHER_BOX_ID, ethers.ZeroAddress, "TS-BOX-02");

  return { registry, escrow, admin, oracle, buyer, seller, courier, stranger };
}

/** Creates a Funded order from `buyer` to `seller` and returns its id. */
async function createOrder(
  escrow: Awaited<ReturnType<typeof deployAll>>["escrow"],
  buyer: Awaited<ReturnType<typeof deployAll>>["buyer"],
  seller: Awaited<ReturnType<typeof deployAll>>["seller"],
  opts?: { amount?: bigint; deadlineOffset?: number },
) {
  const amount = opts?.amount ?? ethers.parseEther("1");
  const now = await networkHelpers.time.latest();
  const deadline = BigInt(now + (opts?.deadlineOffset ?? ONE_HOUR));

  const tx = await escrow
    .connect(buyer)
    .createOrder(seller.address, DEST_LAT, DEST_LON, deadline, { value: amount });
  await tx.wait();
  const id = await escrow.orderCount();
  return { id, amount, deadline };
}

describe("TamperSafeEscrow", function () {
  describe("createOrder", function () {
    it("opens a Funded order and holds the funds", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const amount = ethers.parseEther("2");
      const now = await networkHelpers.time.latest();
      const deadline = BigInt(now + ONE_HOUR);

      await expect(
        escrow.connect(buyer).createOrder(seller.address, DEST_LAT, DEST_LON, deadline, { value: amount }),
      )
        .to.emit(escrow, "OrderCreated")
        .withArgs(1n, buyer.address, seller.address, amount, deadline);

      const order = await escrow.getOrder(1n);
      expect(order.buyer).to.equal(buyer.address);
      expect(order.seller).to.equal(seller.address);
      expect(order.amount).to.equal(amount);
      expect(order.status).to.equal(Status.Funded);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amount);
    });

    it("reverts ZeroAmount on a zero-value order", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const deadline = BigInt((await networkHelpers.time.latest()) + ONE_HOUR);

      await expect(
        escrow.connect(buyer).createOrder(seller.address, DEST_LAT, DEST_LON, deadline, { value: 0n }),
      ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    });

    it("reverts InvalidSeller when the buyer names themselves as seller", async function () {
      const { escrow, buyer } = await networkHelpers.loadFixture(deployAll);
      const deadline = BigInt((await networkHelpers.time.latest()) + ONE_HOUR);

      await expect(
        escrow
          .connect(buyer)
          .createOrder(buyer.address, DEST_LAT, DEST_LON, deadline, { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(escrow, "InvalidSeller");
    });

    it("reverts BadDeadline on a past or current-block deadline", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const now = await networkHelpers.time.latest();

      await expect(
        escrow
          .connect(buyer)
          .createOrder(seller.address, DEST_LAT, DEST_LON, BigInt(now), { value: ethers.parseEther("1") }),
      ).to.be.revertedWithCustomError(escrow, "BadDeadline");
    });
  });

  describe("cancelOrder", function () {
    it("buyer cancels a Funded order and is refunded in full", async function () {
      const { escrow, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(buyer).cancelOrder(id))
        .to.emit(escrow, "OrderCancelled")
        .withArgs(id)
        .and.to.emit(escrow, "FundsReleased")
        .withArgs(id, buyer.address, amount, 1n); // ReleaseKind.REFUND

      expect((await escrow.getOrder(id)).status).to.equal(Status.Cancelled);
    });

    it("asserts the buyer/seller/courier balance deltas on cancel", async function () {
      const { escrow, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(buyer).cancelOrder(id)).to.changeEtherBalances(
        ethers,
        [buyer, seller, courier],
        [amount, 0n, 0n],
      );
    });

    it("reverts NotBuyer when a non-buyer cancels", async function () {
      const { escrow, buyer, seller, stranger } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(stranger).cancelOrder(id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });

    it("reverts InvalidStatus when the order is not Funded", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(buyer).cancelOrder(id);

      await expect(escrow.connect(buyer).cancelOrder(id))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.Cancelled);
    });
  });

  describe("sealShipment", function () {
    it("oracle seals a Funded order into InTransit and binds the box", async function () {
      const { registry, escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      const expectedBond = amount; // bondBps default 10_000 == 100%

      await expect(escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH))
        .to.emit(escrow, "ShipmentSealed")
        .withArgs(id, BOX_ID, courier.address, expectedBond, BASELINE_HASH);

      const order = await escrow.getOrder(id);
      expect(order.status).to.equal(Status.InTransit);
      expect(order.courier).to.equal(courier.address);
      expect(order.boxId).to.equal(BOX_ID);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(id);
    });

    it("reverts when a non-oracle calls sealShipment", async function () {
      const { escrow, buyer, seller, courier, stranger } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(stranger).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH))
        .to.be.revertedWithCustomError(escrow, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ORACLE_ROLE);
    });

    it("reverts InvalidStatus when the order is not Funded", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.InTransit);
    });

    it("reverts BoxUnavailable on a double-bind (box already sealed to another order)", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id: id1 } = await createOrder(escrow, buyer, seller);
      const { id: id2 } = await createOrder(escrow, buyer, seller);

      await escrow.connect(oracle).sealShipment(id1, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(oracle).sealShipment(id2, BOX_ID, courier.address, BASELINE_HASH))
        .to.be.revertedWithCustomError(escrow, "BoxUnavailable")
        .withArgs(BOX_ID);
    });
  });

  describe("requestUnlock", function () {
    it("buyer moves InTransit to UnlockRequested", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(buyer).requestUnlock(id))
        .to.emit(escrow, "UnlockRequested")
        .withArgs(id, BOX_ID);
      expect((await escrow.getOrder(id)).status).to.equal(Status.UnlockRequested);
    });

    it("reverts NotBuyer when a non-buyer requests unlock", async function () {
      const { escrow, oracle, buyer, seller, courier, stranger } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(stranger).requestUnlock(id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });

    it("reverts InvalidStatus when the order is not InTransit", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(buyer).requestUnlock(id))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.Funded);
    });
  });

  describe("confirmDelivery (happy path)", function () {
    it("oracle confirms delivery: pays the seller, frees the box", async function () {
      const { registry, escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await escrow.connect(buyer).requestUnlock(id);

      await expect(
        escrow.connect(oracle).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true),
      )
        .to.emit(escrow, "Delivered")
        .withArgs(id, LOG_HEAD, DEST_LAT, DEST_LON, true)
        .and.to.emit(escrow, "FundsReleased")
        .withArgs(id, seller.address, amount, 0n); // ReleaseKind.PAYMENT

      const order = await escrow.getOrder(id);
      expect(order.status).to.equal(Status.Delivered);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(0n);
    });

    it("asserts the buyer/seller/courier balance deltas on delivery", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await escrow.connect(buyer).requestUnlock(id);

      // No bond mechanics yet in this commit: the courier's balance does
      // not move on delivery (it will once bond lock/unlock lands).
      await expect(
        escrow.connect(oracle).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true),
      ).to.changeEtherBalances(ethers, [buyer, seller, courier], [0n, amount, 0n]);
    });

    it("reverts when a non-oracle calls confirmDelivery", async function () {
      const { escrow, oracle, buyer, seller, courier, stranger } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await escrow.connect(buyer).requestUnlock(id);

      await expect(
        escrow.connect(stranger).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true),
      )
        .to.be.revertedWithCustomError(escrow, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ORACLE_ROLE);
    });

    it("reverts InvalidStatus when the order is not UnlockRequested", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(oracle).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.InTransit);
    });
  });

  describe("reportTamper", function () {
    it("from InTransit: refunds the buyer and frees the box", async function () {
      const { registry, escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(oracle).reportTamper(id, 1, EVIDENCE_HASH))
        .to.emit(escrow, "TamperDetected")
        .withArgs(id, BOX_ID, 1, EVIDENCE_HASH)
        .and.to.emit(escrow, "FundsReleased")
        .withArgs(id, buyer.address, amount, 1n); // REFUND

      const order = await escrow.getOrder(id);
      expect(order.status).to.equal(Status.Tampered);
      expect(order.tamperCode).to.equal(1);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(0n);
    });

    it("from UnlockRequested: refunds the buyer and frees the box", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await escrow.connect(buyer).requestUnlock(id);

      await expect(escrow.connect(oracle).reportTamper(id, 2, EVIDENCE_HASH))
        .to.emit(escrow, "TamperDetected")
        .withArgs(id, BOX_ID, 2, EVIDENCE_HASH);

      expect((await escrow.getOrder(id)).status).to.equal(Status.Tampered);
    });

    it("asserts the buyer/seller/courier balance deltas on tamper", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      // No bond mechanics yet: only the buyer's refund moves real ether.
      await expect(escrow.connect(oracle).reportTamper(id, 1, EVIDENCE_HASH)).to.changeEtherBalances(
        ethers,
        [buyer, seller, courier],
        [amount, 0n, 0n],
      );
    });

    it("reverts when a non-oracle calls reportTamper", async function () {
      const { escrow, oracle, buyer, seller, courier, stranger } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);

      await expect(escrow.connect(stranger).reportTamper(id, 1, EVIDENCE_HASH))
        .to.be.revertedWithCustomError(escrow, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ORACLE_ROLE);
    });

    it("reverts InvalidStatus from Funded (never sealed)", async function () {
      const { escrow, oracle, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);

      await expect(escrow.connect(oracle).reportTamper(id, 1, EVIDENCE_HASH))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.Funded);
    });
  });

  describe("claimTimeout", function () {
    it("from Funded: expires and refunds the buyer, box never bound", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id, amount, deadline } = await createOrder(escrow, buyer, seller);
      await networkHelpers.time.increaseTo(deadline + 1n);

      await expect(escrow.connect(seller).claimTimeout(id)) // "anyone" can call
        .to.emit(escrow, "OrderExpired")
        .withArgs(id)
        .and.to.emit(escrow, "FundsReleased")
        .withArgs(id, buyer.address, amount, 1n); // REFUND

      expect((await escrow.getOrder(id)).status).to.equal(Status.Expired);
    });

    it("from InTransit: expires, refunds the buyer, and frees the box", async function () {
      const { registry, escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, deadline } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await networkHelpers.time.increaseTo(deadline + 1n);

      await expect(escrow.connect(seller).claimTimeout(id)).to.emit(escrow, "OrderExpired").withArgs(id);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(0n);
      expect((await escrow.getOrder(id)).status).to.equal(Status.Expired);
    });

    it("from UnlockRequested: expires, refunds the buyer, and frees the box", async function () {
      const { registry, escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, deadline } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await escrow.connect(buyer).requestUnlock(id);
      await networkHelpers.time.increaseTo(deadline + 1n);

      await expect(escrow.connect(buyer).claimTimeout(id)).to.emit(escrow, "OrderExpired").withArgs(id);
      expect((await registry.getBox(BOX_ID)).activeOrderId).to.equal(0n);
      expect((await escrow.getOrder(id)).status).to.equal(Status.Expired);
    });

    it("asserts the buyer/seller/courier balance deltas on timeout", async function () {
      const { escrow, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      const { id, amount, deadline } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      await networkHelpers.time.increaseTo(deadline + 1n);

      await expect(escrow.connect(seller).claimTimeout(id)).to.changeEtherBalances(
        ethers,
        [buyer, seller, courier],
        [amount, 0n, 0n],
      );
    });

    it("reverts DeadlineNotReached exactly at the deadline (strict >)", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id, deadline } = await createOrder(escrow, buyer, seller);

      // Land the claimTimeout tx's own block exactly on the deadline
      // (not one second past it), to test the strict `>` boundary.
      await networkHelpers.time.setNextBlockTimestamp(deadline);
      await expect(escrow.connect(buyer).claimTimeout(id)).to.be.revertedWithCustomError(
        escrow,
        "DeadlineNotReached",
      );
    });

    it("succeeds one second past the deadline", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id, deadline } = await createOrder(escrow, buyer, seller);

      await networkHelpers.time.increaseTo(deadline + 1n);
      await expect(escrow.connect(buyer).claimTimeout(id)).to.emit(escrow, "OrderExpired");
    });

    it("reverts InvalidStatus on a terminal order even past its deadline", async function () {
      const { escrow, buyer, seller } = await networkHelpers.loadFixture(deployAll);
      const { id } = await createOrder(escrow, buyer, seller);
      await escrow.connect(buyer).cancelOrder(id);

      const order = await escrow.getOrder(id);
      await networkHelpers.time.increaseTo(order.deadline + 1n);
      await expect(escrow.connect(buyer).claimTimeout(id))
        .to.be.revertedWithCustomError(escrow, "InvalidStatus")
        .withArgs(id, Status.Cancelled);
    });
  });

  describe("terminal states are frozen", function () {
    const terminalCases: Array<{
      name: string;
      reach: (ctx: Awaited<ReturnType<typeof deployAll>>, id: bigint, deadline: bigint) => Promise<void>;
      expectedStatus: number;
    }> = [
      {
        name: "Delivered",
        expectedStatus: Status.Delivered,
        reach: async (ctx, id) => {
          await ctx.escrow.connect(ctx.oracle).sealShipment(id, BOX_ID, ctx.courier.address, BASELINE_HASH);
          await ctx.escrow.connect(ctx.buyer).requestUnlock(id);
          await ctx.escrow.connect(ctx.oracle).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true);
        },
      },
      {
        name: "Tampered",
        expectedStatus: Status.Tampered,
        reach: async (ctx, id) => {
          await ctx.escrow.connect(ctx.oracle).sealShipment(id, BOX_ID, ctx.courier.address, BASELINE_HASH);
          await ctx.escrow.connect(ctx.oracle).reportTamper(id, 1, EVIDENCE_HASH);
        },
      },
      {
        name: "Expired",
        expectedStatus: Status.Expired,
        reach: async (ctx, id, deadline) => {
          await networkHelpers.time.increaseTo(deadline + 1n);
          await ctx.escrow.connect(ctx.buyer).claimTimeout(id);
        },
      },
      {
        name: "Cancelled",
        expectedStatus: Status.Cancelled,
        reach: async (ctx, id) => {
          await ctx.escrow.connect(ctx.buyer).cancelOrder(id);
        },
      },
    ];

    for (const { name, reach, expectedStatus } of terminalCases) {
      it(`${name}: cancelOrder / sealShipment / requestUnlock / confirmDelivery / reportTamper / claimTimeout all revert InvalidStatus`, async function () {
        const ctx = await networkHelpers.loadFixture(deployAll);
        const { id, deadline } = await createOrder(ctx.escrow, ctx.buyer, ctx.seller);
        await reach(ctx, id, deadline);
        expect((await ctx.escrow.getOrder(id)).status).to.equal(expectedStatus);

        await expect(ctx.escrow.connect(ctx.buyer).cancelOrder(id))
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
        await expect(
          ctx.escrow.connect(ctx.oracle).sealShipment(id, OTHER_BOX_ID, ctx.courier.address, BASELINE_HASH),
        )
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
        await expect(ctx.escrow.connect(ctx.buyer).requestUnlock(id))
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
        await expect(
          ctx.escrow.connect(ctx.oracle).confirmDelivery(id, LOG_HEAD, DEST_LAT, DEST_LON, true),
        )
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
        await expect(ctx.escrow.connect(ctx.oracle).reportTamper(id, 1, EVIDENCE_HASH))
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
        await expect(ctx.escrow.connect(ctx.buyer).claimTimeout(id))
          .to.be.revertedWithCustomError(ctx.escrow, "InvalidStatus")
          .withArgs(id, expectedStatus);
      });
    }
  });

  describe("setBondBps", function () {
    it("admin sets a new bps and it applies to the next seal", async function () {
      const { escrow, admin, oracle, buyer, seller, courier } = await networkHelpers.loadFixture(deployAll);
      await expect(escrow.connect(admin).setBondBps(5_000)).to.emit(escrow, "BondBpsSet").withArgs(5_000);

      const { id, amount } = await createOrder(escrow, buyer, seller);
      await escrow.connect(oracle).sealShipment(id, BOX_ID, courier.address, BASELINE_HASH);
      expect((await escrow.getOrder(id)).bond).to.equal(amount / 2n);
    });

    it("reverts when a non-admin calls setBondBps", async function () {
      const { escrow, stranger } = await networkHelpers.loadFixture(deployAll);

      await expect(escrow.connect(stranger).setBondBps(5_000))
        .to.be.revertedWithCustomError(escrow, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });
  });
});
