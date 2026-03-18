// Deployed on Polkadot Hub TestNet (Chain ID: 420420417)
export const VAULT_ADDRESS = "0x3e23aCD980a8550Ecd71b589F517Dd632E0D7d98";
export const COMPUTE_ADDRESS = "0x696dCC6E2B95D57F954d9fe78eBF0E8B75Ecea65";
export const DOT_ADDRESS = "0x241dEDF00F4F7b10E23076F1039cDD874F1C28E0"; // MockDOT

export const POLKADOT_HUB_CHAIN_ID = 420420417;

export const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function rebalance() external",
  "function totalAssets() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function estimatedAPY() view returns (uint256)",
  "function getLatestMetrics() view returns (int64 sharpe, int64 var95, uint64 bestStrategy, uint256 ts)",
  "function getRebalanceHistoryLength() view returns (uint256)",
  "function rebalanceHistory(uint256) view returns (uint256 timestamp, uint64 bestStrategyIndex, uint64 packedWeights, int64 sharpeRatio, int64 valueAtRisk, uint256 totalAssets_)",
  "function lastRebalance() view returns (uint256)",
  "function rebalanceCooldown() view returns (uint256)",
  "function asset() view returns (address)",
  "event Rebalanced(uint64 indexed bestStrategy, uint64 packedWeights, int64 sharpe, int64 var95, uint256 totalAssets)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export const STRATEGY_NAMES = [
  "HydraDX Stablecoin LP",
  "Astar DEX USDC/DOT",
  "Moonbeam Lending",
  "Bifrost vDOT Staking",
  "Interlay iBTC Vault",
];
