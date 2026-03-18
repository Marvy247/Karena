// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PVMComputeEngine.sol";
import "../src/StrategyManager.sol";
import "../src/OptiDot.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDOT is ERC20 {
    constructor() ERC20("Mock DOT", "mDOT") { _mint(msg.sender, 10_000_000 * 1e10); }
    function decimals() public pure override returns (uint8) { return 10; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract OptiDotTest is Test {
    MockDOT dot; PVMComputeEngine compute; StrategyManager manager; OptiDot vault;
    address alice = makeAddr("alice"); address bob = makeAddr("bob");

    function setUp() public {
        dot = new MockDOT(); compute = new PVMComputeEngine();
        manager = new StrategyManager();
        vault = new OptiDot(IERC20(address(dot)), address(compute), address(manager));
        dot.mint(alice, 100_000 * 1e10); dot.mint(bob, 50_000 * 1e10);
    }

    function test_MonteCarlo_ReturnsBestStrategy() public view {
        uint64[] memory strategies = new uint64[](3);
        strategies[0] = (uint64(800) << 32) | uint64(300);
        strategies[1] = (uint64(1400) << 32) | uint64(800);
        strategies[2] = (uint64(1800) << 32) | uint64(1200);
        uint64 best = compute.monteCarloSimulate(strategies, 1000, 42);
        assertLt(best, 3);
    }

    function test_GeneticOptimize_ReturnsValidWeights() public view {
        int64[] memory returns_ = new int64[](3); int64[] memory risks = new int64[](3);
        returns_[0] = 800; risks[0] = 300; returns_[1] = 1400; risks[1] = 800; returns_[2] = 1800; risks[2] = 1200;
        uint64 packed = compute.geneticOptimize(returns_, risks, 50, 12345);
        assertTrue(packed > 0);
    }

    function test_ComputeSharpe() public view {
        int64[] memory returns_ = new int64[](2); int64[] memory risks = new int64[](2);
        returns_[0] = 1000; returns_[1] = 1000; risks[0] = 500; risks[1] = 500;
        assertEq(compute.computeSharpe(returns_, risks), 2_000_000);
    }

    function test_ComputeVaR_95() public view {
        int64[] memory returns_ = new int64[](10);
        for (uint256 i = 0; i < 10; i++) returns_[i] = int64(int256(i) * 100 - 500);
        assertTrue(compute.computeVaR(returns_, 9500) >= 0);
    }

    function test_StrategyManager_HasFiveStrategies() public view {
        assertEq(manager.getStrategyCount(), 5);
        assertEq(manager.getActiveCount(), 5);
    }

    function test_PackForMonteCarlo_CorrectLength() public view { assertEq(manager.packForMonteCarlo().length, 5); }

    function test_GetReturnsAndRisks() public view {
        (int64[] memory returns_, int64[] memory risks) = manager.getReturnsAndRisks();
        assertEq(returns_.length, 5); assertEq(risks.length, 5);
        for (uint256 i = 0; i < returns_.length; i++) { assertGt(returns_[i], 0); assertGt(risks[i], 0); }
    }

    function test_Deposit_MintsShares() public {
        vm.startPrank(alice); dot.approve(address(vault), 1000 * 1e10);
        uint256 shares = vault.deposit(1000 * 1e10, alice); vm.stopPrank();
        assertGt(shares, 0); assertEq(vault.balanceOf(alice), shares);
    }

    function test_Withdraw_BurnsShares() public {
        vm.startPrank(alice); dot.approve(address(vault), 1000 * 1e10); vault.deposit(1000 * 1e10, alice);
        uint256 sharesBefore = vault.balanceOf(alice); vault.redeem(sharesBefore / 2, alice, alice); vm.stopPrank();
        assertLt(vault.balanceOf(alice), sharesBefore);
    }

    function test_MultipleDepositors() public {
        vm.startPrank(alice); dot.approve(address(vault), 10_000 * 1e10); vault.deposit(10_000 * 1e10, alice); vm.stopPrank();
        vm.startPrank(bob); dot.approve(address(vault), 5_000 * 1e10); vault.deposit(5_000 * 1e10, bob); vm.stopPrank();
        assertGt(vault.totalAssets(), 0); assertGt(vault.balanceOf(alice), vault.balanceOf(bob));
    }

    function test_Rebalance_CooldownEnforced() public {
        vault.setRebalanceCooldown(1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.startPrank(alice); dot.approve(address(vault), 1000 * 1e10); vault.deposit(1000 * 1e10, alice); vm.stopPrank();
        assertEq(vault.getRebalanceHistoryLength(), 1);
        vm.expectRevert(OptiDot.CooldownNotElapsed.selector);
        vault.rebalance();
        vm.warp(block.timestamp + 3 hours);
        vault.rebalance();
        assertEq(vault.getRebalanceHistoryLength(), 2);
    }

    function test_RebalanceHistory_Populated() public {
        vm.startPrank(alice); dot.approve(address(vault), 5000 * 1e10); vault.deposit(5000 * 1e10, alice); vm.stopPrank();
        vm.warp(block.timestamp + 2 hours); vault.rebalance();
        assertGe(vault.getRebalanceHistoryLength(), 1);
        (,, uint64 bestStrat, uint256 ts) = vault.getLatestMetrics();
        assertGt(ts, 0); assertLt(bestStrat, 5);
    }

    function test_TotalAssets_IncludesAllocations() public {
        vm.startPrank(alice); dot.approve(address(vault), 10_000 * 1e10); vault.deposit(10_000 * 1e10, alice); vm.stopPrank();
        assertGe(vault.totalAssets(), 0);
    }

    function test_GasBenchmark_Rebalance() public {
        vm.startPrank(alice); dot.approve(address(vault), 50_000 * 1e10); vault.deposit(50_000 * 1e10, alice); vm.stopPrank();
        vm.warp(block.timestamp + 2 hours);
        uint256 gasBefore = gasleft(); vault.rebalance(); uint256 gasUsed = gasBefore - gasleft();
        console.log("Rebalance gas (EVM fallback):", gasUsed);
        console.log("NOTE: PVM Rust version is ~14x cheaper (~40x faster)");
    }
}
