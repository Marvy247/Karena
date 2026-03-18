import { useState, useEffect, useCallback } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import { VAULT_ADDRESS, ERC20_ABI, VAULT_ABI, DOT_ADDRESS } from "../constants";

export interface VaultMetrics {
  totalAssets: string;
  userShares: string;
  userAssets: string;
  estimatedAPY: number;
  sharpe: number;
  var95: number;
  bestStrategy: number;
  lastRebalance: number;
  rebalanceCooldown: number;
  historyLength: number;
}

export interface RebalancePoint {
  timestamp: number;
  totalAssets: string;
  sharpe: number;
  var95: number;
  bestStrategy: number;
}

const DECIMALS = 10;

export function useVault() {
  const { provider, signer, address } = useWallet();
  const [metrics, setMetrics] = useState<VaultMetrics | null>(null);
  const [history, setHistory] = useState<RebalancePoint[]>([]);
  const [dotBalance, setDotBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);

  const vault = useCallback(() =>
    provider ? new Contract(VAULT_ADDRESS, VAULT_ABI, signer ?? provider) : null,
  [provider, signer]);

  const dot = useCallback(() =>
    provider ? new Contract(DOT_ADDRESS, ERC20_ABI, signer ?? provider) : null,
  [provider, signer]);

  const refresh = useCallback(async () => {
    const v = vault();
    if (!v || !provider) return;
    setLoading(true);
    try {
      const [ta, apy, metrics_, histLen, cooldown, lastReb] = await Promise.all([
        v.totalAssets(), v.estimatedAPY(), v.getLatestMetrics(),
        v.getRebalanceHistoryLength(), v.rebalanceCooldown(), v.lastRebalance(),
      ]);

      let userShares = 0n, userAssets = 0n, dotBal = 0n;
      if (address) {
        [userShares, dotBal] = await Promise.all([v.balanceOf(address), dot()!.balanceOf(address)]);
        if (userShares > 0n) userAssets = await v.convertToAssets(userShares);
      }

      setDotBalance(formatUnits(dotBal, DECIMALS));
      setMetrics({
        totalAssets: formatUnits(ta, DECIMALS),
        userShares: formatUnits(userShares, DECIMALS),
        userAssets: formatUnits(userAssets, DECIMALS),
        estimatedAPY: Number(apy),
        sharpe: Number(metrics_[0]) / 1_000_000,
        var95: Number(metrics_[1]) / 1_000_000,
        bestStrategy: Number(metrics_[2]),
        lastRebalance: Number(lastReb),
        rebalanceCooldown: Number(cooldown),
        historyLength: Number(histLen),
      });

      const len = Number(histLen);
      const start = Math.max(0, len - 20);
      const points: RebalancePoint[] = [];
      for (let i = start; i < len; i++) {
        const r = await v.rebalanceHistory(i);
        points.push({
          timestamp: Number(r[0]),
          totalAssets: formatUnits(r[5], DECIMALS),
          sharpe: Number(r[3]) / 1_000_000,
          var95: Number(r[4]) / 1_000_000,
          bestStrategy: Number(r[1]),
        });
      }
      setHistory(points);
    } catch (e) {
      console.error("Vault read error:", e);
    } finally {
      setLoading(false);
    }
  }, [vault, dot, address, provider]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const deposit = useCallback(async (amount: string) => {
    const v = vault(); const d = dot();
    if (!v || !d || !signer || !address) return;
    setTxPending(true);
    try {
      const parsed = parseUnits(amount, DECIMALS);
      const allowance = await d.allowance(address, VAULT_ADDRESS);
      if (allowance < parsed) { const tx = await d.approve(VAULT_ADDRESS, parsed); await tx.wait(); }
      const tx = await v.deposit(parsed, address);
      await tx.wait();
      await refresh();
    } finally { setTxPending(false); }
  }, [vault, dot, signer, address, refresh]);

  const withdraw = useCallback(async (amount: string) => {
    const v = vault();
    if (!v || !signer || !address) return;
    setTxPending(true);
    try {
      const parsed = parseUnits(amount, DECIMALS);
      const shares = await v.convertToShares(parsed);
      const tx = await v.redeem(shares, address, address);
      await tx.wait();
      await refresh();
    } finally { setTxPending(false); }
  }, [vault, signer, address, refresh]);

  const rebalance = useCallback(async () => {
    const v = vault();
    if (!v || !signer) return;
    setTxPending(true);
    try {
      const tx = await v.rebalance();
      await tx.wait();
      await refresh();
    } finally { setTxPending(false); }
  }, [vault, signer, refresh]);

  return { metrics, history, dotBalance, loading, txPending, deposit, withdraw, rebalance, refresh };
}
