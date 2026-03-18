// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./StrategyManager.sol";
import "./interfaces/IPolkadotPrecompiles.sol";

/// @title PolkaVaultMax
/// @notice ERC-4626 autonomous yield vault powered by PVM Monte Carlo + genetic optimization.
/// PVM Track: PVM-experiments + Native Assets + XCM/Governance Precompiles
contract PolkaVaultMax is ERC4626, Ownable, ReentrancyGuard {
    IXCMPrecompile public constant XCM =
        IXCMPrecompile(0x0000000000000000000000000000000000000800);
    IAssetsPrecompile public constant ASSETS =
        IAssetsPrecompile(0x0000000000000000000000000000000000000803);

    IPVMCompute public pvmCompute;
    StrategyManager public strategyManager;

    uint256 public lastRebalance;
    uint256 public rebalanceCooldown = 1 hours;
    uint256 public performanceFee = 1000;
    uint256 public accumulatedFees;

    mapping(uint256 => uint256) public strategyAllocations;

    struct RebalanceRecord {
        uint256 timestamp;
        uint64 bestStrategyIndex;
        uint64 packedWeights;
        int64 sharpeRatio;
        int64 valueAtRisk;
        uint256 totalAssets_;
    }
    RebalanceRecord[] public rebalanceHistory;

    event Rebalanced(uint64 indexed bestStrategy, uint64 packedWeights, int64 sharpe, int64 var95, uint256 totalAssets);
    event XCMTransferExecuted(uint32 indexed paraId, uint256 amount);
    event PerformanceFeeCollected(uint256 amount);
    event PVMComputeUpdated(address indexed newCompute);
    event RebalanceCooldownUpdated(uint256 newCooldown);

    error CooldownNotElapsed();
    error NoPVMCompute();
    error NoActiveStrategies();

    constructor(IERC20 asset_, address pvmCompute_, address strategyManager_)
        ERC4626(asset_) ERC20("PolkaVaultMax Shares", "pvmMAX") Ownable(msg.sender)
    {
        pvmCompute = IPVMCompute(pvmCompute_);
        strategyManager = StrategyManager(strategyManager_);
    }

    function totalAssets() public view override returns (uint256) {
        uint256 total = IERC20(asset()).balanceOf(address(this));
        uint256 count = strategyManager.getStrategyCount();
        for (uint256 i = 0; i < count; i++) total += strategyAllocations[i];
        return total - accumulatedFees;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        super._deposit(caller, receiver, assets, shares);
        if (block.timestamp >= lastRebalance + rebalanceCooldown) _rebalance();
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal override nonReentrant
    {
        uint256 liquid = IERC20(asset()).balanceOf(address(this));
        if (liquid < assets + accumulatedFees) _recallFromStrategies(assets + accumulatedFees - liquid);
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    function rebalance() external {
        if (block.timestamp < lastRebalance + rebalanceCooldown) revert CooldownNotElapsed();
        _rebalance();
    }

    function _rebalance() internal {
        if (address(pvmCompute) == address(0)) revert NoPVMCompute();
        uint256 activeCount = strategyManager.getActiveCount();
        if (activeCount == 0) revert NoActiveStrategies();

        uint64[] memory packed = strategyManager.packForMonteCarlo();
        (int64[] memory returns_, int64[] memory risks) = strategyManager.getReturnsAndRisks();

        uint64 bestIdx = pvmCompute.monteCarloSimulate(packed, 10_000, uint64(block.timestamp ^ block.prevrandao));
        uint64 packedWeights = pvmCompute.geneticOptimize(returns_, risks, 200, uint64(block.timestamp ^ uint256(blockhash(block.number - 1))));
        int64 sharpe = pvmCompute.computeSharpe(returns_, risks);
        int64 var95   = pvmCompute.computeVaR(returns_, 9500);

        _allocateByWeights(packedWeights, activeCount);
        _collectFee();

        lastRebalance = block.timestamp;
        rebalanceHistory.push(RebalanceRecord(block.timestamp, bestIdx, packedWeights, sharpe, var95, totalAssets()));
        emit Rebalanced(bestIdx, packedWeights, sharpe, var95, totalAssets());
    }

    function _allocateByWeights(uint64 packedWeights, uint256 count) internal {
        uint256 deployable = IERC20(asset()).balanceOf(address(this));
        if (deployable <= accumulatedFees) return;
        deployable -= accumulatedFees;

        uint256 totalWeight = 0;
        uint8[8] memory weights;
        for (uint256 i = 0; i < count && i < 8; i++) {
            weights[i] = uint8((packedWeights >> (i * 8)) & 0xFF);
            totalWeight += weights[i];
        }
        if (totalWeight == 0) return;

        for (uint256 i = 0; i < count && i < 8; i++) {
            if (weights[i] == 0) continue;
            uint256 alloc = (deployable * weights[i]) / totalWeight;
            if (alloc == 0) continue;
            StrategyManager.Strategy memory s = _getStrategy(i);
            if (s.paraId != 0) {
                bytes memory xcmCall = abi.encodeWithSelector(
                    IXCMPrecompile.transferToParachain.selector, s.paraId, s.adapter, asset(), alloc
                );
                (bool ok,) = address(XCM).call(xcmCall);
                if (ok) emit XCMTransferExecuted(s.paraId, alloc);
            }
            strategyAllocations[i] += alloc;
        }
    }

    function _getStrategy(uint256 idx) internal view returns (StrategyManager.Strategy memory s) {
        uint256 j = 0;
        uint256 total = strategyManager.getStrategyCount();
        for (uint256 i = 0; i < total; i++) {
            (string memory name, uint32 paraId, address adapter, int64 ret, int64 risk, uint256 allocated, bool active) =
                strategyManager.strategies(i);
            if (!active) continue;
            if (j == idx) return StrategyManager.Strategy(name, paraId, adapter, ret, risk, allocated, active);
            j++;
        }
    }

    function _recallFromStrategies(uint256 needed) internal {
        uint256 total = strategyManager.getStrategyCount();
        for (uint256 i = 0; i < total && needed > 0; i++) {
            uint256 alloc = strategyAllocations[i];
            if (alloc == 0) continue;
            uint256 recall = alloc < needed ? alloc : needed;
            strategyAllocations[i] -= recall;
            needed -= recall;
        }
    }

    function _collectFee() internal {
        uint256 assets_ = totalAssets();
        if (assets_ == 0) return;
        uint256 fee = (assets_ * performanceFee) / 10_000 / 365;
        accumulatedFees += fee;
        emit PerformanceFeeCollected(fee);
    }

    function setRebalanceCooldown(uint256 cooldown) external onlyOwner {
        rebalanceCooldown = cooldown;
        emit RebalanceCooldownUpdated(cooldown);
    }
    function setPerformanceFee(uint256 fee) external onlyOwner { require(fee <= 3000); performanceFee = fee; }
    function setPVMCompute(address compute) external onlyOwner { pvmCompute = IPVMCompute(compute); emit PVMComputeUpdated(compute); }
    function withdrawFees(address to) external onlyOwner { uint256 f = accumulatedFees; accumulatedFees = 0; IERC20(asset()).transfer(to, f); }

    function getRebalanceHistoryLength() external view returns (uint256) { return rebalanceHistory.length; }
    function getLatestMetrics() external view returns (int64 sharpe, int64 var95, uint64 bestStrategy, uint256 ts) {
        if (rebalanceHistory.length == 0) return (0, 0, 0, 0);
        RebalanceRecord storage r = rebalanceHistory[rebalanceHistory.length - 1];
        return (r.sharpeRatio, r.valueAtRisk, r.bestStrategyIndex, r.timestamp);
    }
    function estimatedAPY() external view returns (uint256) {
        if (rebalanceHistory.length == 0) return 0;
        RebalanceRecord storage r = rebalanceHistory[rebalanceHistory.length - 1];
        if (r.sharpeRatio <= 0) return 0;
        return uint256(uint64(r.sharpeRatio)) / 100_000;
    }
}
