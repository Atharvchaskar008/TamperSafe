// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The subset of BoxRegistry the escrow needs. Kept minimal so the
/// escrow only depends on the two state-changing calls it actually makes.
interface IBoxRegistry {
    function bind(bytes32 boxId, uint256 orderId) external;
    function unbind(bytes32 boxId) external;
}
