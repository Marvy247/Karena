// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPolkadotPrecompiles.sol";

contract StrategyManager is Ownable {
    struct Strategy {
        string name;
        uint32 paraId;
        address adapter;
        int64 expectedReturn;
        int64 risk;
        uint256 allocatedAssets;
        bool active;
    }

    Strategy[] public strategies;

    IGovernancePrecompile public constant GOVERNANCE =
        IGovernancePrecompile(0x0000000000000000000000000000000000000804);

    event StrategyAdded(uint256 indexed id, string name, uint32 paraId);
    event StrategyUpdated(uint256 indexed id, int64 newReturn, int64 newRisk);
    event StrategyDeactivated(uint256 indexed id);

    constructor() Ownable(msg.sender) {
        _addStrategy("HydraDX Stablecoin LP",  2034, address(0), 850,  300);
        _addStrategy("Astar DEX USDC/DOT",      2006, address(0), 1400, 800);
        _addStrategy("Moonbeam Lending",         2004, address(0), 950,  450);
        _addStrategy("Bifrost vDOT Staking",     2001, address(0), 1100, 350);
        _addStrategy("Interlay iBTC Vault",      2032, address(0), 1800, 1200);
    }

    function _addStrategy(string memory name, uint32 paraId, address adapter, int64 ret, int64 risk) internal {
        strategies.push(Strategy(name, paraId, adapter, ret, risk, 0, true));
        emit StrategyAdded(strategies.length - 1, name, paraId);
    }

    function addStrategy(string calldata name, uint32 paraId, address adapter, int64 ret, int64 risk) external onlyOwner {
        _addStrategy(name, paraId, adapter, ret, risk);
    }

    function updateMetrics(uint256 id, int64 ret, int64 risk) external onlyOwner {
        strategies[id].expectedReturn = ret;
        strategies[id].risk = risk;
        emit StrategyUpdated(id, ret, risk);
    }

    function deactivate(uint256 id) external onlyOwner {
        strategies[id].active = false;
        emit StrategyDeactivated(id);
    }

    function getActiveCount() public view returns (uint256 count) {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].active) count++;
        }
    }

    function getStrategyCount() external view returns (uint256) { return strategies.length; }

    function packForMonteCarlo() external view returns (uint64[] memory packed) {
        uint256 count = getActiveCount();
        packed = new uint64[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].active) continue;
            packed[j++] = (uint64(uint32(uint64(strategies[i].expectedReturn))) << 32)
                | uint64(uint32(uint64(strategies[i].risk)));
        }
    }

    function getReturnsAndRisks() external view returns (int64[] memory returns_, int64[] memory risks) {
        uint256 count = getActiveCount();
        returns_ = new int64[](count);
        risks = new int64[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].active) continue;
            returns_[j] = strategies[i].expectedReturn;
            risks[j] = strategies[i].risk;
            j++;
        }
    }
}
