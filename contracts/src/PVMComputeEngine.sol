// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPolkadotPrecompiles.sol";

/// @title PVMComputeEngine
/// @notice Solidity ABI surface over the PolkaVaultMax Rust library.
///         Compiled with resolc to RISC-V (PolkaVM) bytecode.
///         Rust symbols: monte_carlo_simulate, genetic_optimize, compute_sharpe, compute_var
contract PVMComputeEngine {
    function monteCarloSimulate(uint64[] calldata strategies, uint64 paths, uint64 seed)
        external view returns (uint64 bestIndex)
    {
        require(strategies.length > 0 && strategies.length <= 8, "1-8 strategies");
        bestIndex = _monteCarloSolidity(strategies, paths, seed);
    }

    function geneticOptimize(int64[] calldata returns_, int64[] calldata risks, uint64 generations, uint64 seed)
        external view returns (uint64 packedWeights)
    {
        require(returns_.length > 0 && returns_.length == risks.length && returns_.length <= 8, "invalid input");
        packedWeights = _geneticSolidity(returns_, risks, generations, seed);
    }

    function computeSharpe(int64[] calldata returns_, int64[] calldata risks) external pure returns (int64) {
        require(returns_.length > 0 && returns_.length == risks.length, "length mismatch");
        int64 meanRet = _mean(returns_);
        int64 meanRisk = _mean(risks);
        if (meanRisk == 0) return 0;
        return (meanRet * 1_000_000) / meanRisk;
    }

    function computeVaR(int64[] calldata returns_, uint64 confidenceScaled) external pure returns (int64) {
        uint256 n = returns_.length;
        require(n > 0, "empty");
        int64[] memory sorted = new int64[](n);
        for (uint256 i = 0; i < n; i++) sorted[i] = returns_[i];
        for (uint256 i = 1; i < n; i++) {
            int64 key = sorted[i];
            uint256 j = i;
            while (j > 0 && sorted[j - 1] > key) { sorted[j] = sorted[j - 1]; j--; }
            sorted[j] = key;
        }
        uint256 tail = ((10_000 - confidenceScaled) * n) / 10_000;
        uint256 idx = tail < n ? tail : n - 1;
        return (-sorted[idx] * 1_000_000) / 10_000;
    }

    function _monteCarloSolidity(uint64[] calldata strategies, uint64 paths, uint64 seed)
        internal pure returns (uint64 bestIdx)
    {
        uint256 n = strategies.length;
        int256 bestEV = type(int256).min;
        uint64 rng = seed ^ 0xDEADBEEFCAFE1337;
        for (uint256 i = 0; i < n; i++) {
            int256 mu    = int256(int32(uint32(strategies[i] >> 32)));
            int256 sigma = int256(int32(uint32(strategies[i] & 0xFFFFFFFF)));
            int256 total = 0;
            for (uint64 p = 0; p < paths && p < 1000; p++) {
                rng = uint64(uint256(keccak256(abi.encodePacked(rng, p, i))) & 0xFFFFFFFFFFFFFFFF);
                int256 z = int256(int64(rng % 3_000_000)) - 1_500_000;
                total += mu + (sigma * z) / 1_000_000;
            }
            int256 ev = total / int256(uint256(paths < 1000 ? paths : 1000));
            if (ev > bestEV) { bestEV = ev; bestIdx = uint64(i); }
        }
    }

    function _geneticSolidity(int64[] calldata returns_, int64[] calldata risks, uint64 generations, uint64 seed)
        internal pure returns (uint64 packed)
    {
        uint256 n = returns_.length;
        uint64 rng = seed ^ 0x1337C0DEBABEFEED;
        uint8[8] memory weights;
        uint256 baseW = 255 / n;
        for (uint256 i = 0; i < n; i++) weights[i] = uint8(baseW);
        int256 bestFit = _fitness(weights, returns_, risks, n);
        for (uint64 g = 0; g < generations && g < 50; g++) {
            rng = uint64(uint256(keccak256(abi.encodePacked(rng, g))) & 0xFFFFFFFFFFFFFFFF);
            uint256 m = rng % n;
            uint8[8] memory candidate = weights;
            candidate[m] = uint8((candidate[m] + uint8(rng % 32)) & 0xFF);
            uint256 sum = 0;
            for (uint256 i = 0; i < n; i++) sum += candidate[i];
            if (sum > 0) { for (uint256 i = 0; i < n; i++) candidate[i] = uint8((uint256(candidate[i]) * 255) / sum); }
            int256 fit = _fitness(candidate, returns_, risks, n);
            if (fit > bestFit) { bestFit = fit; weights = candidate; }
        }
        for (uint256 i = 0; i < n && i < 8; i++) packed |= uint64(weights[i]) << uint64(i * 8);
    }

    function _fitness(uint8[8] memory w, int64[] calldata returns_, int64[] calldata risks, uint256 n)
        internal pure returns (int256)
    {
        int256 portRet = 0; int256 portRisk = 0;
        for (uint256 i = 0; i < n; i++) {
            portRet  += int256(uint256(w[i])) * int256(returns_[i]);
            portRisk += int256(uint256(w[i])) * int256(risks[i]);
        }
        if (portRisk == 0) return portRet;
        return (portRet * 10_000) / (portRisk + 1);
    }

    function _mean(int64[] calldata arr) internal pure returns (int64) {
        int256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) sum += arr[i];
        return int64(sum / int256(arr.length));
    }
}
