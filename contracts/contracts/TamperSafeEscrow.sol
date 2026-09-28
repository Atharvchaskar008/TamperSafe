// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IBoxRegistry } from "./interfaces/IBoxRegistry.sol";

/// @title TamperSafeEscrow
/// @notice Holds a buyer's tMSTC from order creation to delivery. The
/// relayer (ORACLE_ROLE) drives the state machine (seal / tamper / deliver);
/// it never names a payee -- payees are fixed by the order (buyer, seller)
/// and the seal (courier). Buyer intent (create / cancel / requestUnlock)
/// is always signed by the buyer's own wallet.
///
/// NOTE: this first cut has no courier bond mechanics yet (`bondBalance` /
/// `lockedBond` are declared but unused, and `sealShipment` does not lock
/// anything). Courier bond deposit/lock/slash lands in the next commit per
/// docs/IMPLEMENTATION_PLAN.md M1 task 4.
contract TamperSafeEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @dev Order status, matching ARCHITECTURE.md §6 exactly: 0 None,
    /// 1 Funded, 2 InTransit, 3 UnlockRequested, 4 Delivered, 5 Tampered,
    /// 6 Expired, 7 Cancelled. Delivered/Tampered/Expired/Cancelled are
    /// terminal: every mutating function reverts InvalidStatus on them.
    enum Status {
        None,
        Funded,
        InTransit,
        UnlockRequested,
        Delivered,
        Tampered,
        Expired,
        Cancelled
    }

    /// @dev Not in ARCHITECTURE.md §5.2's Events list, but is a state
    /// change the escrow drives, so it gets an event per the project's
    /// "one event per state change" rule.
    enum ReleaseKind {
        PAYMENT,
        REFUND,
        BOND_SLASH
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        uint64 deadline;
        int32 destLat;
        int32 destLon;
        address courier;
        bytes32 boxId;
        uint256 bond;
        bytes32 baselineHash;
        Status status;
        uint8 tamperCode;
    }

    IBoxRegistry public immutable registry;

    /// @dev Basis points of `amount` locked as the courier's bond at seal
    /// time. Default 10 000 = 100% (bond = goods value), per §5.2.
    uint16 public bondBps = 10_000;

    uint256 public orderCount;
    mapping(uint256 => Order) private _orders;

    /// @dev Free (withdrawable / lockable) bond and bond currently locked
    /// against a sealed shipment, per courier. Unused until the bond
    /// mechanics commit; declared now so storage layout is stable.
    mapping(address => uint256) public bondBalance;
    mapping(address => uint256) public lockedBond;

    event OrderCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint64 deadline
    );
    event OrderCancelled(uint256 indexed id);
    event BondDeposited(address indexed courier, uint256 amount);
    event BondWithdrawn(address indexed courier, uint256 amount);
    event ShipmentSealed(
        uint256 indexed id,
        bytes32 indexed boxId,
        address indexed courier,
        uint256 bond,
        bytes32 baselineHash
    );
    event UnlockRequested(uint256 indexed id, bytes32 indexed boxId);
    event Delivered(uint256 indexed id, bytes32 logHead, int32 lat, int32 lon, bool gpsFix);
    event TamperDetected(uint256 indexed id, bytes32 indexed boxId, uint8 code, bytes32 evidenceHash);
    event OrderExpired(uint256 indexed id);
    event FundsReleased(uint256 indexed id, address indexed to, uint256 amount, ReleaseKind kind);
    event BondBpsSet(uint16 bps);

    error InvalidStatus(uint256 id, Status current);
    error NotBuyer();
    /// @dev Not in ARCHITECTURE.md §5.2's Errors list. createOrder's row
    /// says it "reverts on ... seller == buyer" but no listed error fits;
    /// flagged to the main session, added here as the obvious name.
    error InvalidSeller();
    error BoxUnavailable(bytes32 boxId);
    error InsufficientBond(address courier, uint256 needed, uint256 free);
    error DeadlineNotReached();
    error BadDeadline();
    error ZeroAmount();
    error TransferFailed(address to);

    constructor(address admin, address registryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        registry = IBoxRegistry(registryAddress);
    }

    /// @notice Buyer opens and funds an order. Reverts on zero value, a
    /// past/zero deadline, or naming themselves as the seller.
    function createOrder(address seller, int32 destLat, int32 destLon, uint64 deadline)
        external
        payable
        returns (uint256 orderId)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (seller == msg.sender) revert InvalidSeller();
        if (deadline <= block.timestamp) revert BadDeadline();

        orderId = ++orderCount;
        _orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            deadline: deadline,
            destLat: destLat,
            destLon: destLon,
            courier: address(0),
            boxId: bytes32(0),
            bond: 0,
            baselineHash: bytes32(0),
            status: Status.Funded,
            tamperCode: 0
        });

        emit OrderCreated(orderId, msg.sender, seller, msg.value, deadline);
    }

    /// @notice Buyer cancels before dispatch. Only legal while Funded
    /// (never sealed, so there is no box or bond to unwind).
    function cancelOrder(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        if (o.buyer != msg.sender) revert NotBuyer();
        if (o.status != Status.Funded) revert InvalidStatus(id, o.status);

        o.status = Status.Cancelled;
        uint256 amount = o.amount;

        emit OrderCancelled(id);
        _release(id, o.buyer, amount, ReleaseKind.REFUND);
    }

    /// @notice Relayer seals the order into a physical box and binds the
    /// box in BoxRegistry. `registry.bind` reverts BoxUnavailable if the
    /// box is inactive, unregistered, or already bound to another order.
    function sealShipment(uint256 id, bytes32 boxId, address courier, bytes32 baselineHash)
        external
        onlyRole(ORACLE_ROLE)
    {
        Order storage o = _orders[id];
        if (o.status != Status.Funded) revert InvalidStatus(id, o.status);

        uint256 bond = (o.amount * bondBps) / 10_000;

        o.courier = courier;
        o.boxId = boxId;
        o.bond = bond;
        o.baselineHash = baselineHash;
        o.status = Status.InTransit;

        emit ShipmentSealed(id, boxId, courier, bond, baselineHash);
        registry.bind(boxId, id);
    }

    /// @notice Buyer presses "Confirm & Unlock" at the doorstep. Funds do
    /// not move here -- this only flags the relayer to send UNLOCK to the
    /// box; confirmDelivery (oracle) is what pays out.
    function requestUnlock(uint256 id) external {
        Order storage o = _orders[id];
        if (o.buyer != msg.sender) revert NotBuyer();
        if (o.status != Status.InTransit) revert InvalidStatus(id, o.status);

        o.status = Status.UnlockRequested;
        emit UnlockRequested(id, o.boxId);
    }

    /// @notice Relayer confirms a clean delivery: pays the seller and frees
    /// the box. GPS is recorded as evidence only and never gates payout
    /// (Invariant 4 -- the venue is indoors).
    function confirmDelivery(uint256 id, bytes32 logHead, int32 lat, int32 lon, bool gpsFix)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        Order storage o = _orders[id];
        if (o.status != Status.UnlockRequested) revert InvalidStatus(id, o.status);

        o.status = Status.Delivered;
        bytes32 boxId = o.boxId;
        uint256 amount = o.amount;
        address seller = o.seller;

        emit Delivered(id, logHead, lat, lon, gpsFix);
        registry.unbind(boxId);
        _release(id, seller, amount, ReleaseKind.PAYMENT);
    }

    /// @notice Relayer reports tamper from either InTransit or
    /// UnlockRequested. Refunds the buyer and frees the box.
    function reportTamper(uint256 id, uint8 code, bytes32 evidenceHash)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        Order storage o = _orders[id];
        if (o.status != Status.InTransit && o.status != Status.UnlockRequested) {
            revert InvalidStatus(id, o.status);
        }

        o.status = Status.Tampered;
        o.tamperCode = code;
        bytes32 boxId = o.boxId;
        uint256 amount = o.amount;
        address buyer = o.buyer;

        emit TamperDetected(id, boxId, code, evidenceHash);
        registry.unbind(boxId);
        _release(id, buyer, amount, ReleaseKind.REFUND);
    }

    /// @notice Anyone may pull a timed-out order once its deadline has
    /// strictly passed. Refunds the buyer; frees the box if it was sealed.
    function claimTimeout(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        Status status = o.status;
        if (status != Status.Funded && status != Status.InTransit && status != Status.UnlockRequested) {
            revert InvalidStatus(id, status);
        }
        if (block.timestamp <= o.deadline) revert DeadlineNotReached();

        bool wasSealed = o.courier != address(0);
        o.status = Status.Expired;
        uint256 amount = o.amount;
        address buyer = o.buyer;
        bytes32 boxId = o.boxId;

        emit OrderExpired(id);
        if (wasSealed) {
            registry.unbind(boxId);
        }
        _release(id, buyer, amount, ReleaseKind.REFUND);
    }

    function setBondBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bondBps = bps;
        emit BondBpsSet(bps);
    }

    function getOrder(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    /// @dev Push-payment via a low-level call (checks-effects-interactions:
    /// callers set all state before invoking this). Reverts TransferFailed
    /// if the recipient rejects the value.
    function _release(uint256 id, address to, uint256 amount, ReleaseKind kind) private {
        (bool ok, ) = to.call{ value: amount }("");
        if (!ok) revert TransferFailed(to);
        emit FundsReleased(id, to, amount, kind);
    }
}
