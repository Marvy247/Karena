import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

interface WalletCtx {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletCtx>({
  provider: null, signer: null, address: null, chainId: null,
  connect: async () => {}, disconnect: () => {}, isConnecting: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) { alert("Install MetaMask or a Web3 wallet"); return; }
    setIsConnecting(true);
    try {
      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts", []);
      const s = await p.getSigner();
      const net = await p.getNetwork();
      setProvider(p); setSigner(s);
      setAddress(await s.getAddress());
      setChainId(Number(net.chainId));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null); setSigner(null); setAddress(null); setChainId(null);
  }, []);

  useEffect(() => {
    const eth = window.ethereum as any;
    if (eth) {
      eth.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) disconnect(); else connect();
      });
      eth.on("chainChanged", () => connect());
    }
  }, [connect, disconnect]);

  return (
    <WalletContext.Provider value={{ provider, signer, address, chainId, connect, disconnect, isConnecting }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
