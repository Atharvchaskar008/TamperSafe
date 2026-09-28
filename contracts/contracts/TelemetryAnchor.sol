// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TelemetryAnchor
/// @notice Anchors the box's off-chain hash-chain head on-chain so the
/// dashboard's "Verify log" can recompute the chain and compare it against
/// a value that can't be rewritten after the fact. Also relays evidence-only
/// alerts (SHOCK, TILT, SIGNAL_LOST, ...) that never change escrow state.
contract TelemetryAnchor is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    struct Anchor {
        uint32 seq;
        bytes32 head;
        uint256 timestamp;
    }

    mapping(uint256 => Anchor) private _latest;

    event Anchored(uint256 indexed orderId, uint32 seq, bytes32 head, uint16 count);
    event Alert(uint256 indexed orderId, uint8 code, bytes32 evidenceHash);

    /// @dev Not in ARCHITECTURE.md §5.3 (no Errors table is given at all),
    /// flagged for review: `anchor` needs some revert for a non-increasing
    /// seq, and this is the obvious name/shape.
    error StaleSeq(uint256 orderId, uint32 seq, uint32 latestSeq);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Relayer anchors the box's hash-chain head for an order.
    /// `seq` must strictly increase over the previously anchored seq for
    /// that order (0 before the first anchor).
    function anchor(uint256 orderId, uint32 seq, bytes32 head, uint16 count) external onlyRole(ORACLE_ROLE) {
        uint32 latestSeq = _latest[orderId].seq;
        if (seq <= latestSeq) revert StaleSeq(orderId, seq, latestSeq);

        _latest[orderId] = Anchor({ seq: seq, head: head, timestamp: block.timestamp });
        emit Anchored(orderId, seq, head, count);
    }

    /// @notice Relayer logs an evidence-only alert. Never changes escrow
    /// state; purely for the dashboard's Evidence tab.
    function logAlert(uint256 orderId, uint8 code, bytes32 evidenceHash) external onlyRole(ORACLE_ROLE) {
        emit Alert(orderId, code, evidenceHash);
    }

    function latest(uint256 orderId) external view returns (Anchor memory) {
        return _latest[orderId];
    }
}
