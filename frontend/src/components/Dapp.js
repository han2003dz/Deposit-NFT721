import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import TokenERC20Artifact from "../contracts/TokenERC20.json";
import DepositArtifact from "../contracts/MyDepositContract.json";
import contractAddress from "../contracts/contract-address.json";
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Deposit } from "./Transfer";

const HARDHAT_NETWORK_ID = "59141";
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export const Dapp = () => {
  const [tokenData, setTokenData] = useState();
  const [selectedAddress, setSelectedAddress] = useState();
  const [initialBalance, setInitialBalance] = useState();
  const [mintedBalance, setMintedBalance] = useState();
  const [networkError, setNetworkError] = useState();

  const [tokenERC20, setTokenERC20] = useState();
  const [depositContract, setDepositContract] = useState();
  const [nextTokenId, setNextTokenId] = useState(null);

  let provider;

  useEffect(() => {
    if (selectedAddress) {
      initializeEthers();
      getTokenData();
      startPollingData();
      setupWalletListeners();

      return () => {
        stopPollingData();
      };
    }
  }, [selectedAddress]);

  const initializeEthers = () => {
    if (!contractAddress.TokenERC20 || !contractAddress.MyDepositContract) {
      console.error("Invalid contract address");
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    try {
      const tokenContract = new ethers.Contract(
        contractAddress.TokenERC20,
        TokenERC20Artifact.abi,
        provider.getSigner(0)
      );
      setTokenERC20(tokenContract);

      const depositContractInstance = new ethers.Contract(
        contractAddress.MyDepositContract,
        DepositArtifact.abi,
        provider.getSigner(0)
      );
      setDepositContract(depositContractInstance);
      fetchNextTokenId(); // Fetch the nextTokenId after initializing the contract
    } catch (error) {
      console.error("Error initializing contracts:", error);
    }
  };

  const fetchNextTokenId = async () => {
    if (!depositContract) return;
    try {
      const tokenId = await depositContract.nextTokenId();
      setNextTokenId(tokenId.toString());
    } catch (error) {
      console.error("Error fetching nextTokenId:", error);
    }
  };

  const setupWalletListeners = () => {
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      stopPollingData();
      if (!newAddress) {
        resetState();
      } else {
        initialize(newAddress);
      }
    });
  };

  const getTokenData = async () => {
    if (!tokenERC20) return;
    try {
      const name = await tokenERC20.name();
      const symbol = await tokenERC20.symbol();
      setTokenData({ name, symbol });
      await updateBalance(true); // Cập nhật số dư ban đầu
    } catch (error) {
      console.error("Error getting token data:", error);
    }
  };

  const updateBalance = async (isInitial = false) => {
    if (!tokenERC20 || !selectedAddress) return;
    try {
      const balance = await tokenERC20.balanceOf(selectedAddress);
      if (isInitial) {
        setInitialBalance(balance);
      }
      setMintedBalance(balance);
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  };

  const startPollingData = () => {
    const pollDataInterval = setInterval(updateBalance, 1000);
    updateBalance();
    return () => clearInterval(pollDataInterval);
  };

  const stopPollingData = () => clearInterval(startPollingData);

  const mintTokens = async (amount) => {
    if (!tokenERC20 || typeof tokenERC20.mint !== "function") {
      console.error("Mint method is not available on the contract");
      return;
    }

    try {
      const tx = await tokenERC20.mint(amount);
      await tx.wait();
      console.log("Mint successful");
      await updateBalance(); // Cập nhật số dư sau khi mint
    } catch (error) {
      console.error("Mint failed:", error);
    }
  };

  const depositTokens = async (amount) => {
    if (!tokenERC20 || !depositContract) {
      console.error("Contracts not initialized correctly");
      return;
    }

    try {
      const approveTx = await tokenERC20.approve(
        depositContract.address,
        amount
      );
      await approveTx.wait();

      const tx = await depositContract.deposit(amount);
      const receipt = await tx.wait();

      console.log("receipt", receipt);

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      await updateBalance();
      console.log("Deposit successful");
      fetchNextTokenId(); // Fetch the updated nextTokenId after deposit
    } catch (error) {
      if (error.code !== ERROR_CODE_TX_REJECTED_BY_USER) {
        console.error("Deposit failed:", error);
      }
    }
  };

  const connectWallet = async () => {
    const [userAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    checkNetwork();
    initialize(userAddress);
  };

  const initialize = useCallback((userAddress) => {
    setSelectedAddress(userAddress);
    initializeEthers();
    getTokenData();
    startPollingData();
  }, []);

  const switchChain = async () => {
    const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`;
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    initialize(selectedAddress);
  };

  const checkNetwork = () => {
    if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
      switchChain();
    }
  };

  const dismissNetworkError = () => setNetworkError(undefined);

  const resetState = () => {
    setTokenData(undefined);
    setSelectedAddress(undefined);
    setInitialBalance(undefined);
    setMintedBalance(undefined);
    setNetworkError(undefined);
  };

  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }

  if (!selectedAddress) {
    return (
      <ConnectWallet
        connectWallet={connectWallet}
        networkError={networkError}
        dismiss={dismissNetworkError}
      />
    );
  }

  if (!tokenData || !mintedBalance) {
    return <Loading />;
  }

  return (
    <div className="container p-4">
      <div className="row">
        <div className="col-12">
          <h4>
            Initial Balance: {initialBalance?.toString()} {tokenData.symbol}
          </h4>
          <h4>
            Minted Balance: {mintedBalance?.toString()} {tokenData.symbol}
          </h4>
          <h4>Next Token ID: {nextTokenId}</h4>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <button onClick={() => mintTokens(10000)} className="btn btn-primary">
            Mint 10000 Tokens
          </button>
        </div>
      </div>
      <div className="row">
        <div className="col-4">
          <Deposit
            depositTokens={depositTokens}
            tokenSymbol={tokenData.symbol}
          />
        </div>
      </div>
    </div>
  );
};
