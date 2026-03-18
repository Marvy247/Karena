// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXCMPrecompile {
    function xcmSend(uint32 paraId, address asset, uint256 amount, bytes calldata xcmMessage) external returns (bool);
    function transferToParachain(uint32 paraId, address recipient, address asset, uint256 amount) external returns (bool);
}

interface IAssetsPrecompile {
    function mint(uint128 assetId, address beneficiary, uint256 amount) external returns (bool);
    function burn(uint128 assetId, address who, uint256 amount) external returns (bool);
    function balanceOf(uint128 assetId, address who) external view returns (uint256);
    function transfer(uint128 assetId, address target, uint256 amount) external returns (bool);
}

interface IGovernancePrecompile {
    function propose(bytes calldata encodedCall, uint256 value) external returns (uint32 proposalIndex);
    function vote(uint32 refIndex, bool aye, uint256 balance) external returns (bool);
}

interface IPVMCompute {
    function monteCarloSimulate(uint64[] calldata strategies, uint64 paths, uint64 seed) external view returns (uint64 bestIndex);
    function geneticOptimize(int64[] calldata returns_, int64[] calldata risks, uint64 generations, uint64 seed) external view returns (uint64 packedWeights);
    function computeSharpe(int64[] calldata returns_, int64[] calldata risks) external pure returns (int64);
    function computeVaR(int64[] calldata returns_, uint64 confidenceScaled) external pure returns (int64);
}
