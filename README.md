# Karena

> **On-Chain Evolutionary Battle Arena — Polkadot Solidity Hackathon 2026**  
> Track 2: PVM Smart Contracts · All three categories covered

---

## Overview

Karena is the first fully on-chain esports arena on Polkadot Hub. Players deploy strategy agents with custom genetic parameters, a Rust library running on PolkaVM evolves them over 200 generations, and a 10,000-path Monte Carlo tournament determines the champion. Winners earn DOT and mint dynamic on-chain NFTs.

This is compute that is physically impossible on EVM. PolkaVM makes it real.

---

## Why This Exists

The EVM block gas limit (~15M) makes it impossible to run:
- Monte Carlo simulation at 10,000 paths
- Genetic evolution beyond ~50 generations
- A full evolve + tournament in a single transaction

PVM runs all of it in one transaction, within a normal gas budget. Karena is built entirely around this capability gap.

---

## PVM Benchmark

| Operation | EVM | PVM (Rust/RISC-V) | Speedup |
|---|---|---|---|
| Genetic Evolution (200 gen, pop 16) | ~8,400,000 gas | ~300,000 gas | **28×** |
| Monte Carlo Tournament (10,000 paths) | ~5,800,000 gas | ~112,000 gas | **52×** |
| A\* Pathfinding (16×16 grid) | ~620,000 gas | ~18,000 gas | **34×** |
| Agent Power Score | ~45,000 gas | ~3,200 gas | **14×** |
| Full Tournament (single tx) | ❌ Exceeds block limit | ✅ ~430,000 gas | **∞** |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Polkadot Hub                           │
│                                                               │
│   ┌─────────────────┐     ┌──────────────────────────────┐   │
│   │  ArenaManager   │────▶│      PVMBattleEngine          │   │
│   │  (Solidity)     │     │  ┌────────────────────────┐  │   │
│   │  · Arenas       │     │  │  Rust Library (RISC-V)  │  │   │
│   │  · Tournaments  │     │  │  · Genetic Evolution    │  │   │
│   │  · XCM joins    │     │  │  · Monte Carlo (10k)    │  │   │
│   └──────┬──────────┘     │  │  · A* Pathfinding       │  │   │
│          │                │  │  · Agent Power Score    │  │   │
│   ┌──────▼──────────┐     │  └────────────────────────┘  │   │
│   │   AgentNFT      │     └──────────────────────────────┘   │
│   │   (ERC-721)     │                                         │
│   │   On-chain SVG  │     ┌──────────────────────────────┐   │
│   └─────────────────┘     │  Polkadot Precompiles          │   │
│                            │  0x800  XCM — cross-chain     │   │
│   ┌─────────────────┐     │  0x803  Assets — native DOT   │   │
│   │  MockDOT        │     │  0x804  Governance — DAO       │   │
│   │  (10 decimals)  │     └──────────────────────────────┘   │
│   └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## PVM Categories

| Category | Implementation |
|---|---|
| **PVM-Experiments** | `rust-lib/src/lib.rs` — `no_std` Rust library with genetic algorithm (200 generations, pop 16), Monte Carlo battle simulation (10,000 paths), A\* pathfinding on procedurally generated maps, and agent power scoring. Called from Solidity via PVM ABI. |
| **Native Assets** | MockDOT (10 decimals, matching Polkadot Hub native asset precision). Assets precompile (`0x803`) for prize pool distribution and entry fee handling. |
| **Precompiles** | XCM precompile (`0x800`) for cross-parachain player joins from HydraDX, Astar, Moonbeam, and Bifrost. Governance precompile (`0x804`) for DAO-controlled arena rules and prize parameters. |

---

## Contracts

| Contract | Description |
|---|---|
| `PVMBattleEngine` | Solidity ABI surface over the Rust PVM library. Transparent EVM fallback for local testing. |
| `ArenaManager` | Arena lifecycle, player registration, tournament brackets, XCM cross-chain joins, governance integration. |
| `AgentNFT` | ERC-721 with fully on-chain SVG metadata. No IPFS. NFT art evolves dynamically with each win. |
| `MockDOT` | Testnet DOT token (10 decimals). Includes public faucet. |

---

## Deployed Contracts

**Network:** Polkadot Hub TestNet — Chain ID `420420417`  
**RPC:** `https://eth-rpc-testnet.polkadot.io`  
**Explorer:** `https://blockscout-testnet.polkadot.io`

| Contract | Address |
|---|---|
| MockDOT | [`0xf1919E7a4F179778082845e347B854e446E16e48`](https://blockscout-testnet.polkadot.io/address/0xf1919E7a4F179778082845e347B854e446E16e48) |
| PVMBattleEngine | [`0x07B15f39637976C416983B57D723099655747335`](https://blockscout-testnet.polkadot.io/address/0x07B15f39637976C416983B57D723099655747335) |
| ArenaManager | [`0xc193e2BC9f29F2932f98839bB5A4cB7a6483fF59`](https://blockscout-testnet.polkadot.io/address/0xc193e2BC9f29F2932f98839bB5A4cB7a6483fF59) |
| AgentNFT | [`0xd498EF9Cbf003D19C69AeE5B02A8E53e02E264e2`](https://blockscout-testnet.polkadot.io/address/0xd498EF9Cbf003D19C69AeE5B02A8E53e02E264e2) |

---

## Repo Structure

```
/contracts
  src/
    PVMBattleEngine.sol        Solidity ABI over Rust PVM library
    ArenaManager.sol           Arena + tournament + XCM + governance
    AgentNFT.sol               ERC-721 with on-chain SVG metadata
    MockDOT.sol                Testnet DOT token with faucet
    interfaces/
      IKarenaPrecompiles.sol   XCM, Assets, Governance, PVM interfaces
  test/
    Karena.t.sol               17 tests — all passing
  script/
    Deploy.s.sol

/rust-lib
  src/lib.rs                   Genetic algo + Monte Carlo + A* + power score (no_std)
  Cargo.toml

/frontend
  src/
    App.tsx                    Landing page, arena route, how-it-works
    components/
      ArenaDashboard.tsx       Agent builder, arena info, tournament history
      BattleCanvas.tsx         Live 2D battle visualization (Canvas API)
    hooks/
      useArena.ts              Contract reads/writes, auto-refresh
    context/
      WalletContext.tsx        MetaMask, auto-reconnect, network switching

/benchmarks
  README.md                    Gas & performance comparison data
```

---

## Quick Start

### Contracts

```bash
cd contracts
forge install
forge test                    # 17 tests pass
```

### Deploy

```bash
cp .env.example .env          # add PRIVATE_KEY
forge script script/Deploy.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io \
  --broadcast --legacy
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Test Results

```
Suite result: ok. 17 passed; 0 failed; 0 skipped
```

| Test | Description |
|---|---|
| `test_GeneticEvolveReturnsPacked` | Winner genes packed correctly into uint64 |
| `test_GeneticEvolveIsDeterministic` | Same seed → same winner every time |
| `test_MonteCarloTournamentPicksWinner` | Strongest agent wins statistically |
| `test_AstarPathfindManhattan` | Pathfinding returns correct distance |
| `test_ComputeAgentPowerStrongerWins` | Power score ranks agents correctly |
| `test_CreateArena` | Arena created with correct parameters |
| `test_JoinArena` | Agent genes stored on-chain correctly |
| `test_CannotJoinTwice` | Duplicate join reverts |
| `test_FullTournamentFlow` | End-to-end: join → start → finalize → winner |
| `test_MintChampionNFT` | NFT minted to correct owner |
| `test_NFTTokenURIIsOnChain` | Metadata is fully on-chain base64 |
| `test_RecordWinEvolvesNFT` | Win count increments correctly |
| `test_MockDOTDecimals` | 10 decimals matching Polkadot Hub native |
| `test_MockDOTFaucet` | Faucet distributes correct amount |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, OpenZeppelin, ERC-721 |
| PVM Compute | Rust (`no_std`, `cdylib`, `opt-level=3`, LTO) |
| Compiler | resolc (revive) — Solidity → PolkaVM RISC-V |
| Testing | Foundry (`forge test`) |
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Ethers.js v6 |
| Visualization | Canvas API — particles, trails, screen shake, procedural maps |
| Network | Polkadot Hub TestNet (Chain ID: 420420417) |

---

## Links

| | |
|---|---|
| GitHub | https://github.com/Marvy247/Karena |
| Explorer | https://blockscout-testnet.polkadot.io |
| Hackathon | https://dorahacks.io/hackathon/polkadot-solidity |
