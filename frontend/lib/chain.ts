import { CHAIN_ID, RPC_URL } from "./constants";

export async function getProvider(): Promise<any> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found");
  }
  return window.ethereum;
}

export async function connectWallet(): Promise<string> {
  const provider = await getProvider();
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  if (!accounts.length) throw new Error("No accounts returned");
  return accounts[0];
}

export async function getChainId(): Promise<number> {
  const provider = await getProvider();
  const chainId: string = await provider.request({ method: "eth_chainId" });
  return parseInt(chainId, 16);
}

export async function switchToStudioNet(): Promise<void> {
  const provider = await getProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${CHAIN_ID.toString(16)}`,
            chainName: "GenLayer StudioNet",
            rpcUrls: [RPC_URL],
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
