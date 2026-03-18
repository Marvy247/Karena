# OptiDot — DoraHacks Submission

> **Hackathon:** Polkadot Solidity Hackathon 2026  
> **Track:** Track 2 — PVM Smart Contracts  
> **Deadline:** March 20, 2026  
> **Submission Portal:** https://dorahacks.io/hackathon/polkadot-solidity

---

## Pre-Submission Checklist

- [ ] Demo video recorded and uploaded (YouTube / Loom)
- [ ] GitHub repository is public
- [ ] All contracts verified live on explorer
- [ ] DoraHacks BUIDL page submitted

---

## Project Name

**OptiDot**

---

## Tagline

> PVM-Powered Autonomous Multi-Chain Yield Maximizer Vault — Monte Carlo risk simulations and genetic algorithm portfolio optimization, entirely on-chain, in Rust, on PolkaVM.

---

## Track & Categories

**Track 2: PVM Smart Contracts** — all three categories covered:

| Category | Implementation |
|---|---|
| **PVM-Experiments** | Custom Rust library (`no_std`, `cdylib`) — Monte Carlo simulation (10,000 paths), genetic algorithm optimizer (200 generations), Sharpe ratio, Value at Risk — compiled to RISC-V and called from Solidity via PVM ABI |
| **Native Assets** | Polkadot assets pallet precompile (`0x...0803`) for DOT deposit, withdrawal, and cross-strategy allocation |
| **Precompiles** | XCM precompile (`0x...0800`) for autonomous cross-parachain rebalancing; Governance precompile (`0x...0804`) for DAO-controlled strategy parameters and risk thresholds |

---

## Project Description

OptiDot is the first yield vault on Polkadot Hub that performs institutional-grade portfolio optimization entirely on-chain. Users deposit DOT, and the vault autonomously allocates capital across five Polkadot parachains — HydraDX, Astar, Moonbeam, Bifrost, and Interlay — using a Rust-powered compute engine running on PolkaVM.

**The core problem it solves:** Polkadot's yield is fragmented across 100+ parachains. Manually tracking and rebalancing across them is impractical. OptiDot automates this with on-chain intelligence that was previously impossible on EVM.

**How it works:**

1. **Deposit** — User deposits DOT into the ERC-4626 vault and receives `optiDOT` shares
2. **PVM Computes** — The Rust library runs 10,000 Monte Carlo simulation paths per strategy to calculate risk-adjusted expected returns, then evolves optimal portfolio weights using a 200-generation genetic algorithm with Sharpe ratio fitness scoring
3. **XCM Rebalances** — The vault allocates capital to the winning strategies via Polkadot Hub's native XCM precompile — no bridges, no off-chain keepers
4. **DAO Governs** — Strategy additions, risk thresholds, and fee parameters are controlled by DOT holders via the governance precompile

**Why PVM makes this possible:**

| Operation | EVM (Solidity) | PVM (Rust/RISC-V) | Speedup |
|---|---|---|---|
| Monte Carlo (10,000 paths) | ~5,800,000 gas | ~410,000 gas | **14.1×** |
| Genetic Optimizer (200 gen) | ~450,000 gas | ~32,000 gas | **14.0×** |
| Full Rebalance | ~6,272,000 gas | ~443,600 gas | **14.1×** |
| Wall-clock time | ~2,100 ms | ~52 ms | **40.4×** |

EVM cannot run Monte Carlo at 10,000 paths without exceeding the block gas limit — it must be capped at ~1,000. PVM runs the full simulation within a normal gas budget. This is the exact use case PolkaVM was designed for.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Polkadot Hub                          │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │   OptiDot    │───▶│     PVMComputeEngine          │   │
│  │  (ERC-4626)  │    │  ┌────────────────────────┐  │   │
│  │  Solidity    │    │  │  Rust Library (RISC-V)  │  │   │
│  │  + resolc    │    │  │  • Monte Carlo (10k)    │  │   │
│  └──────┬───────┘    │  │  • Genetic Optimizer    │  │   │
│         │            │  │  • Sharpe Ratio         │  │   │
│         │            │  │  • Value at Risk        │  │   │
│         │            │  └────────────────────────┘  │   │
│         │            └──────────────────────────────┘   │
│         ├──▶ XCM Precompile → HydraDX · Astar           │
│         │                     Moonbeam · Bifrost         │
│         │                     Interlay                   │
│         ├──▶ Assets Precompile → Native DOT handling     │
│         └──▶ Governance Precompile → DAO parameters      │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, ERC-4626, OpenZeppelin |
| PVM Compute | Rust (`no_std`, `cdylib`, `opt-level=3`, LTO) |
| Compiler | resolc (revive) — Solidity → PolkaVM RISC-V |
| Testing | Foundry — 14 tests, all passing |
| Frontend | React, Vite, Tailwind CSS, Framer Motion, Ethers.js v6 |
| Network | Polkadot Hub TestNet (Chain ID: 420420417) |

---

## Deployed Contracts

**Network:** Polkadot Hub TestNet — Chain ID: `420420417`  
**RPC:** `https://eth-rpc-testnet.polkadot.io`

| Contract | Address | Explorer |
|---|---|---|
| OptiDot (Vault) | `0xDF445D3B191D7d0D0D31053890bEb1E712d96eCc` | [View ↗](https://blockscout-testnet.polkadot.io/address/0xDF445D3B191D7d0D0D31053890bEb1E712d96eCc) |
| PVMComputeEngine | `0x696dCC6E2B95D57F954d9fe78eBF0E8B75Ecea65` | [View ↗](https://blockscout-testnet.polkadot.io/address/0x696dCC6E2B95D57F954d9fe78eBF0E8B75Ecea65) |
| StrategyManager | `0xb08c332E097726c81CBB8aA48D6AEF2Cd67602Bc` | [View ↗](https://blockscout-testnet.polkadot.io/address/0xb08c332E097726c81CBB8aA48D6AEF2Cd67602Bc) |
| MockDOT | `0x241dEDF00F4F7b10E23076F1039cDD874F1C28E0` | [View ↗](https://blockscout-testnet.polkadot.io/address/0x241dEDF00F4F7b10E23076F1039cDD874F1C28E0) |

---

## Repository Structure

```
/contracts
  src/
    OptiDot.sol              — ERC-4626 vault + XCM + governance
    PVMComputeEngine.sol     — Solidity ABI over Rust library
    StrategyManager.sol      — 5 parachain strategies
    interfaces/
      IPolkadotPrecompiles.sol
  test/
    OptiDot.t.sol            — 14 tests, all passing
  script/
    Deploy.s.sol

/rust-lib
  src/lib.rs                 — Monte Carlo + genetic optimizer + Sharpe + VaR (no_std)

/frontend
  src/
    App.tsx                  — Landing, vault, how-it-works
    components/VaultDashboard.tsx
    hooks/useVault.ts
    context/WalletContext.tsx

/benchmarks
  README.md                  — Gas & performance comparison data
```

---

## Links

| Resource | URL |
|---|---|
| GitHub | https://github.com/Marvy247/OptiDot |
| Demo Video | `[paste URL here]` |
| Vault Explorer | https://blockscout-testnet.polkadot.io/address/0xDF445D3B191D7d0D0D31053890bEb1E712d96eCc |

---

## Judging Criteria Alignment

| Criterion | Evidence |
|---|---|
| **Technical depth in PVM** | Rust library with real simulation algorithms — 10k Monte Carlo paths, 200-gen genetic optimizer, Sharpe, VaR. Heaviest on-chain compute in the PVM track. |
| **Full use of native Polkadot features** | All three PVM categories covered at depth. XCM + Assets + Governance precompiles all integrated. |
| **Impact & production-readiness** | Solves real yield fragmentation problem. Full dApp with live metrics. 14 tests passing. Deployed and functional on testnet. |
| **Innovation** | First project to combine heavy PVM compute + native precompiles + DAO governance in a consumer-facing yield product. No other submission does all three. |

---

*"This is why we built PVM."*
