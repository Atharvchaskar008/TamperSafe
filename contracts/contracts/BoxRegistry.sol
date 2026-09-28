// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BoxRegistry
/// @notice Tracks TamperSafe boxes and which order (if any) each one is
/// currently bound to. Binding/unbinding is restricted to BINDER_ROLE,
/// granted to the TamperSafeEscrow contract so that only the escrow's state
/// machine can occupy or free a box.
contract BoxRegistry is AccessControl {
    /// @notice Granted to the escrow contract; the only role allowed to
    /// bind/unbind a box to an order.
    bytes32 public constant BINDER_ROLE = keccak256("BINDER_ROLE");

    struct Box {
        address deviceKey; // unused in P0, reserved for S2 device-signed attestations
        bool active;
        uint256 activeOrderId; // 0 == free (order ids start at 1)
        string label;
    }

    mapping(bytes32 => Box) private _boxes;
    // Tracked separately from `active` so a disabled box still reads as
    // "already registered" (BoxExists) rather than allowing re-registration
    // to silently reset its fields.
    mapping(bytes32 => bool) private _registered;

    event BoxRegistered(bytes32 indexed boxId, address deviceKey, string label);
    event BoxActiveSet(bytes32 indexed boxId, bool active);
    event BoxBound(bytes32 indexed boxId, uint256 indexed orderId);
    event BoxUnbound(bytes32 indexed boxId, uint256 indexed orderId);

    error BoxExists(bytes32 boxId);
    error BoxUnavailable(bytes32 boxId);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Registers a new box. Boxes start active.
    function registerBox(bytes32 boxId, address deviceKey, string calldata label)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_registered[boxId]) revert BoxExists(boxId);

        _registered[boxId] = true;
        _boxes[boxId] = Box({ deviceKey: deviceKey, active: true, activeOrderId: 0, label: label });
        emit BoxRegistered(boxId, deviceKey, label);
    }

    /// @notice Enables or disables a box. A disabled box cannot be bound.
    function setActive(bytes32 boxId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _boxes[boxId].active = active;
        emit BoxActiveSet(boxId, active);
    }

    /// @notice Binds a box to an order. The box must be active and free.
    function bind(bytes32 boxId, uint256 orderId) external onlyRole(BINDER_ROLE) {
        Box storage box = _boxes[boxId];
        if (!box.active || box.activeOrderId != 0) revert BoxUnavailable(boxId);
        box.activeOrderId = orderId;
        emit BoxBound(boxId, orderId);
    }

    /// @notice Frees a box so it can be bound to a future order.
    function unbind(bytes32 boxId) external onlyRole(BINDER_ROLE) {
        uint256 orderId = _boxes[boxId].activeOrderId;
        _boxes[boxId].activeOrderId = 0;
        emit BoxUnbound(boxId, orderId);
    }

    function getBox(bytes32 boxId) external view returns (Box memory) {
        return _boxes[boxId];
    }
}
