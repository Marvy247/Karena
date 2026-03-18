// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/OptiDot.sol";

contract Redeploy is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        OptiDot vault = new OptiDot(
            IERC20(0x241dEDF00F4F7b10E23076F1039cDD874F1C28E0),
            0x696dCC6E2B95D57F954d9fe78eBF0E8B75Ecea65,
            0xb08c332E097726c81CBB8aA48D6AEF2Cd67602Bc
        );
        console.log("OptiDot:", address(vault));
        vm.stopBroadcast();
    }
}
