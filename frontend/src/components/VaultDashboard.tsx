import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { useVault } from '../hooks/useVault';
import { useWallet } from '../context/WalletContext';
import { STRATEGY_NAMES } from '../constants';

export default function VaultDashboard() {
  const { address } = useWallet();
  const { metrics, history, dotBalance, loading, txPending, deposit, withdraw, rebalance } = useVault();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    const t = toast.loading('Depositing...');
    try {
      await deposit(depositAmount);
      toast.success(`Deposited ${depositAmount} DOT`, { id: t });
      setDepositAmount('');
    } catch (e: any) {
      toast.error(e?.reason ?? e?.message ?? 'Transaction failed', { id: t });
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    const t = toast.loading('Withdrawing...');
    try {
      await withdraw(withdrawAmount);
      toast.success(`Withdrew ${withdrawAmount} DOT`, { id: t });
      setWithdrawAmount('');
    } catch (e: any) {
      toast.error(e?.reason ?? e?.message ?? 'Transaction failed', { id: t });
    }
  };

  const handleRebalance = async () => {
    const t = toast.loading('Running PVM rebalance...');
    try {
      await rebalance();
      toast.success('Vault rebalanced via PVM Monte Carlo + Genetic Optimizer!', { id: t });
    } catch (e: any) {
      toast.error(e?.reason ?? e?.message ?? 'Rebalance failed', { id: t });
    }
  };

  const canRebalance = metrics
    ? Date.now() / 1000 >= metrics.lastRebalance + metrics.rebalanceCooldown
    : false;

  const chartData = history.map(h => ({
    time: new Date(h.timestamp * 1000).toLocaleDateString(),
    tvl: parseFloat(h.totalAssets),
    sharpe: h.sharpe.toFixed(3),
  }));

  const metricCards = [
    { label: "Total Value Locked", value: metrics ? `${parseFloat(metrics.totalAssets).toLocaleString(undefined, { maximumFractionDigits: 2 })} DOT` : '—', sub: "across all strategies", icon: "💰" },
    { label: "Estimated APY", value: metrics ? `${(metrics.estimatedAPY / 100).toFixed(2)}%` : '—', sub: "risk-adjusted (Sharpe-weighted)", icon: "📈" },
    { label: "Sharpe Ratio", value: metrics ? metrics.sharpe.toFixed(3) : '—', sub: "higher = better risk/return", icon: "⚖️" },
    { label: "95% VaR", value: metrics ? `${(metrics.var95 * 100).toFixed(2)}%` : '—', sub: "max expected daily loss", icon: "🛡️" },
  ];

  const strategies = [
    { name: "HydraDX Stablecoin LP", paraId: 2034, apy: "8.5%", risk: "Low", color: "bg-green-100 text-green-700" },
    { name: "Astar DEX USDC/DOT", paraId: 2006, apy: "14.0%", risk: "Medium", color: "bg-yellow-100 text-yellow-700" },
    { name: "Moonbeam Lending", paraId: 2004, apy: "9.5%", risk: "Low-Med", color: "bg-blue-100 text-blue-700" },
    { name: "Bifrost vDOT", paraId: 2001, apy: "11.0%", risk: "Low", color: "bg-purple-100 text-purple-700" },
    { name: "Interlay iBTC", paraId: 2032, apy: "18.0%", risk: "High", color: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-4xl text-text-main">Vault Dashboard</h1>
          <p className="text-text-dim mt-1">PVM-powered autonomous yield optimization across Polkadot</p>
        </div>
        <button
          onClick={handleRebalance}
          disabled={txPending || !address || !canRebalance}
          className="flex items-center gap-2 px-6 py-3 bg-accent-indigo text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-40"
        >
          {txPending ? '⏳ Running...' : '🔄 Rebalance Now'}
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-6 border border-app-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-dim text-sm">{card.label}</span>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="font-serif font-bold text-2xl text-text-main mb-1">
              {loading ? <span className="animate-pulse text-text-pale">...</span> : card.value}
            </div>
            <div className="text-xs text-text-pale">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Best strategy badge */}
      {metrics && metrics.historyLength > 0 && (
        <div className="glass rounded-2xl p-4 border border-accent-indigo/30 bg-accent-indigo/5 flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <span className="font-medium text-text-main">PVM Optimizer recommends: </span>
            <span className="font-bold text-accent-indigo">
              {STRATEGY_NAMES[metrics.bestStrategy] ?? `Strategy ${metrics.bestStrategy}`}
            </span>
            <span className="text-text-dim text-sm ml-2">
              (last rebalanced {new Date(metrics.lastRebalance * 1000).toLocaleString()})
            </span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* TVL Chart */}
        <div className="md:col-span-2 glass rounded-2xl p-6 border border-app-border">
          <h3 className="font-bold text-lg mb-4">TVL History</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} DOT`, 'TVL']} />
                <Area type="monotone" dataKey="tvl" stroke="#6366f1" fill="url(#tvlGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-text-pale">
              No rebalance history yet. Deposit and trigger a rebalance.
            </div>
          )}
        </div>

        {/* Deposit / Withdraw */}
        <div className="glass rounded-2xl p-6 border border-app-border">
          <div className="flex gap-2 mb-6">
            {(['deposit', 'withdraw'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-accent-indigo text-white' : 'text-text-dim hover:bg-app-hover'
                }`}>
                {tab === 'deposit' ? '⬇️ Deposit' : '⬆️ Withdraw'}
              </button>
            ))}
          </div>

          {activeTab === 'deposit' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-dim mb-1 block">Amount (DOT)</label>
                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border border-app-border bg-white text-text-main focus:outline-none focus:border-accent-indigo transition-colors" />
                <div className="text-xs text-text-pale mt-1">Balance: {parseFloat(dotBalance).toFixed(4)} DOT</div>
              </div>
              <button onClick={() => setDepositAmount(dotBalance)} className="text-xs text-accent-indigo hover:underline">Use max</button>
              <button onClick={handleDeposit} disabled={txPending || !address || !depositAmount}
                className="w-full py-3 bg-accent-indigo text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-40">
                {txPending ? 'Processing...' : 'Deposit DOT'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-dim mb-1 block">Amount (DOT)</label>
                <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border border-app-border bg-white text-text-main focus:outline-none focus:border-accent-indigo transition-colors" />
                <div className="text-xs text-text-pale mt-1">
                  Your position: {metrics ? parseFloat(metrics.userAssets).toFixed(4) : '0'} DOT
                </div>
              </div>
              <button onClick={() => setWithdrawAmount(metrics?.userAssets ?? '0')} className="text-xs text-accent-indigo hover:underline">Withdraw all</button>
              <button onClick={handleWithdraw} disabled={txPending || !address || !withdrawAmount}
                className="w-full py-3 border border-accent-indigo text-accent-indigo rounded-xl font-medium hover:bg-accent-indigo hover:text-white transition-all disabled:opacity-40">
                {txPending ? 'Processing...' : 'Withdraw DOT'}
              </button>
            </div>
          )}

          {address && metrics && (
            <div className="mt-6 pt-6 border-t border-app-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">Your shares</span>
                <span className="font-medium">{parseFloat(metrics.userShares).toFixed(4)} optiDOT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">Your assets</span>
                <span className="font-medium text-accent-indigo">{parseFloat(metrics.userAssets).toFixed(4)} DOT</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sharpe chart */}
      {chartData.length > 1 && (
        <div className="glass rounded-2xl p-6 border border-app-border">
          <h3 className="font-bold text-lg mb-4">Sharpe Ratio Over Time</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [String(v), 'Sharpe']} />
              <Line type="monotone" dataKey="sharpe" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Strategy cards */}
      <div className="glass rounded-2xl p-6 border border-app-border">
        <h3 className="font-bold text-lg mb-4">Active Strategies</h3>
        <div className="grid md:grid-cols-5 gap-3">
          {strategies.map((s, i) => (
            <div key={i} className="rounded-xl p-4 border border-app-border bg-white/50">
              <div className="font-medium text-sm mb-2 leading-tight">{s.name}</div>
              <div className="text-xs text-text-pale mb-2">Para #{s.paraId}</div>
              <div className="font-bold text-accent-indigo">{s.apy}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
