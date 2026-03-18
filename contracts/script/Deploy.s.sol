// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PVMComputeEngine.sol";
import "../src/StrategyManager.sol";
import "../src/PolkaVaultMax.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDOT is ERC20 {
    constructor() ERC20("Mock DOT", "mDOT") { _mint(msg.sender, 1_000_000 * 1e10); }
    function decimals() public pure override returns (uint8) { return 10; }
}

contract DeployPolkaVaultMax is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MockDOT dot = new MockDOT();
        console.log("MockDOT:", address(dot));

        PVMComputeEngine compute = new PVMComputeEngine();
        console.log("PVMComputeEngine:", address(compute));

        StrategyManager manager = new StrategyManager();
        console.log("StrategyManager:", address(manager));

        PolkaVaultMax vault = new PolkaVaultMax(IERC20(address(dot)), address(compute), address(manager));
        console.log("PolkaVaultMax:", address(vault));

        dot.approve(address(vault), type(uint256).max);
        console.log("Approval set. Deposit manually after deployment.");

        vm.stopBroadcast();
    }
}
