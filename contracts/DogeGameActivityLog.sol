// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DogeGame Activity Log
/// @notice On-chain, discoverable record of DogeGame Creator Studio activity,
///         deployed on both 0G and DogeOS. The backend calls `log(action, refId)` for each real product
///         action (login, game generated, edited, published, played, scored,
///         liked/shared/followed, referral, points awarded, payment, asset
///         stored). Every call is one transaction per network, and `totalActivities` is a
///         single public counter a reviewer can read to see total on-chain usage.
contract DogeGameActivityLog {
    address public owner;
    uint256 public totalActivities;
    // Per-action-type counters, keyed by keccak256(action string).
    mapping(bytes32 => uint256) public actionCount;

    event Activity(
        address indexed sender,
        string action,
        string refId,
        uint256 timestamp,
        uint256 total
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Record one activity event.
    function log(string calldata action, string calldata refId) external onlyOwner {
        _log(action, refId);
    }

    /// @notice Record many activity events in a single transaction (gas-efficient).
    function logBatch(string[] calldata actions, string[] calldata refIds) external onlyOwner {
        require(actions.length == refIds.length, "length mismatch");
        for (uint256 i = 0; i < actions.length; i++) {
            _log(actions[i], refIds[i]);
        }
    }

    function _log(string calldata action, string calldata refId) internal {
        totalActivities += 1;
        actionCount[keccak256(bytes(action))] += 1;
        emit Activity(msg.sender, action, refId, block.timestamp, totalActivities);
    }

    /// @notice Read the counter for a specific action type (e.g. "login").
    function countOf(string calldata action) external view returns (uint256) {
        return actionCount[keccak256(bytes(action))];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        owner = newOwner;
    }
}
