import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Install MetaMask to use this app");
      return;
    }
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []);
    const walletSigner = await browserProvider.getSigner();
    const address = await walletSigner.getAddress();
    setProvider(browserProvider);
    setSigner(walletSigner);
    setAccount(address);
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
  }, []);

  // Restore existing session on mount without prompting
  useEffect(() => {
    async function tryAutoConnect() {
      if (!window.ethereum) return;
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await browserProvider.send("eth_accounts", []);
        if (accounts.length > 0) {
          const walletSigner = await browserProvider.getSigner();
          const address = await walletSigner.getAddress();
          setProvider(browserProvider);
          setSigner(walletSigner);
          setAccount(address);
        }
      } catch {
        // no prior session
      }
    }
    tryAutoConnect();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [disconnect]);

  return { account, provider, signer, connect, disconnect };
}
