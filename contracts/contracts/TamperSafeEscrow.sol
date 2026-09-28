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
/// The courier posts a bond (`depositBond`) before it can carry a shipment.
/// `sealShipment` locks `amount * bondBps / 10_000` out of the courier's
/// free balance; a clean delivery unlocks it back to the courier's free
/// balance, while tamper or timeout slashes it to the seller.
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

    /// @dev ARCHITECTURE.md §5.2 names `FundsReleased.kind` as "one of
    /// PAYMENT | REFUND | BOND_SLASH" but never gives its type or order;
    /// flagged for review. This ordering (0/1/2) is what the ABI encodes.
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
    /// against a sealed shipment, per courier.
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
    /// @dev Not in ARCHITECTURE.md §5.2's Events list at all, but setting
    /// bondBps is a state change the escrow drives, so it gets an event per
    /// the project's "one event per state change" rule; flagged for review.
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

    /// @notice Relayer seals the order into a physical box, locks the
    /// courier's bond out of their free balance, and binds the box in
    /// BoxRegistry. Reverts InsufficientBond if the courier's free balance
    /// can't cover it, or BoxUnavailable (bubbled from `registry.bind`) if
    /// the box is inactive, unregistered, or already bound to another order.
    function sealShipment(uint256 id, bytes32 boxId, address courier, bytes32 baselineHash)
        external
        onlyRole(ORACLE_ROLE)
    {
        Order storage o = _orders[id];
        if (o.status != Status.Funded) revert InvalidStatus(id, o.status);

        uint256 bond = (o.amount * bondBps) / 10_000;
        uint256 free = bondBalance[courier];
        if (free < bond) revert InsufficientBond(courier, bond, free);

        bondBalance[courier] = free - bond;
        lockedBond[courier] += bond;

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

    /// @notice Relayer confirms a clean delivery: pays the seller, unlocks
    /// the courier's bond back to their free balance, and frees the box.
    /// GPS is recorded as evidence only and never gates payout (Invariant 4
    /// -- the venue is indoors).
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
        address courier = o.courier;
        uint256 bond = o.bond;

        lockedBond[courier] -= bond;
        bondBalance[courier] += bond;

        emit Delivered(id, logHead, lat, lon, gpsFix);
        registry.unbind(boxId);
        _release(id, seller, amount, ReleaseKind.PAYMENT);
    }

    /// @notice Relayer reports tamper from either InTransit or
    /// UnlockRequested. Refunds the buyer, slashes the courier's locked
    /// bond to the seller (goods were compromised in the courier's
    /// custody), and frees the box.
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
        address seller = o.seller;
        address courier = o.courier;
        uint256 bond = o.bond;

        lockedBond[courier] -= bond;

        emit TamperDetected(id, boxId, code, evidenceHash);
        registry.unbind(boxId);
        _release(id, buyer, amount, ReleaseKind.REFUND);
        _release(id, seller, bond, ReleaseKind.BOND_SLASH);
    }

    /// @notice Anyone may pull a timed-out order once its deadline has
    /// strictly passed. Refunds the buyer; if the order was sealed, slashes
    /// the courier's locked bond to the seller and frees the box.
    function claimTimeout(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        Status status = o.status;
        if (status != Status.Funded && status != Status.InTransit && status != Status.UnlockRequested) {
            revert InvalidStatus(id, status);
        }
        if (block.timestamp <= o.deadline) revert DeadlineNotReached();

        // `status` (captured above, before this write) is Funded only when
        // the order was never sealed -- checking that instead of
        // `courier != address(0)` also covers the degenerate case of a
        // seal naming the zero address as courier, which would otherwise
        // leave the box permanently bound.
        bool wasSealed = status != Status.Funded;
        o.status = Status.Expired;
        uint256 amount = o.amount;
        address buyer = o.buyer;
        address seller = o.seller;
        bytes32 boxId = o.boxId;
        address courier = o.courier;
        uint256 bond = o.bond;

        if (wasSealed) {
            lockedBond[courier] -= bond;
        }

        emit OrderExpired(id);
        if (wasSealed) {
            registry.unbind(boxId);
        }
        _release(id, buyer, amount, ReleaseKind.REFUND);
        if (wasSealed) {
            _release(id, seller, bond, ReleaseKind.BOND_SLASH);
        }
    }

    /// @notice Courier posts bond. Adds to their free (lockable/withdrawable)
    /// balance; does not attach to any order until `sealShipment` locks it.
    function depositBond() external payable {
        bondBalance[msg.sender] += msg.value;
        emit BondDeposited(msg.sender, msg.value);
    }

    /// @notice Courier withdraws from their free bond balance. Only the
    /// free balance is withdrawable -- bond locked against a sealed
    /// shipment is unavailable until delivery unlocks it (or tamper/timeout
    /// slashes it away).
    function withdrawBond(uint256 amt) external nonReentrant {
        uint256 free = bondBalance[msg.sender];
        if (free < amt) revert InsufficientBond(msg.sender, amt, free);

        bondBalance[msg.sender] = free - amt;

        (bool ok, ) = msg.sender.call{ value: amt }("");
        if (!ok) revert TransferFailed(msg.sender);
        emit BondWithdrawn(msg.sender, amt);
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
