import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import TokenERC20Artifact from "../contracts/TokenERC20.json";
import DepositArtifact from "../contracts/MyDepositContract.json";
import contractAddress from "../contracts/contract-address.json";
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Deposit } from "./Transfer";
import Swal from "sweetalert2";

const HARDHAT_NETWORK_ID = "97";
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export const Dapp = () => {
  const [tokenData, setTokenData] = useState();
  const [tokenERC721Data, setTokenERC721Data] = useState({
    name: "",
    symbol: "",
  });
  const [selectedAddress, setSelectedAddress] = useState();
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

      // Fetch the ERC721 name and symbol
      fetchERC721Data(depositContractInstance);
      fetchNextTokenId();
    } catch (error) {
      console.error("Error initializing contracts:", error);
    }
  };

  const fetchERC721Data = async (contract) => {
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      setTokenERC721Data({ name, symbol });
    } catch (error) {
      console.error("Error fetching ERC721 data:", error);
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
      await updateBalance(true);
    } catch (error) {
      console.error("Error getting token data:", error);
    }
  };

  const updateBalance = async (isInitial = false) => {
    if (!tokenERC20 || !selectedAddress) return;
    try {
      const balance = await tokenERC20.balanceOf(selectedAddress);
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
      Swal.fire({
        title: "Success!",
        text: `Successfully minted ${amount} tokens!`,
        icon: "success",
        confirmButtonText: "OK",
      });
      await updateBalance();
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
      Swal.fire({
        title: "Success!",
        text: `Deposit successful`,
        icon: "success",
        confirmButtonText: "OK",
      });
      await updateBalance();
      console.log("Deposit successful");
      fetchNextTokenId();
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
    setTokenERC721Data({ name: "", symbol: "" });
    setSelectedAddress(undefined);
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
    <div className="container my-4">
      <div className="row text-center">
        <div className="col-lg-4 col-md-6 mb-4">
          <div className="card p-3 shadow-sm border-light">
            <h4 className="mb-3">
              Minted Balance: {mintedBalance?.toString()} {tokenData.symbol}
            </h4>
            <button
              onClick={() => mintTokens(10000)}
              className="btn btn-primary btn-lg w-100"
            >
              Mint 10000 Tokens
            </button>
          </div>
        </div>

        <div className="col-lg-4 col-md-6 mb-4">
          <div className="card p-3 shadow-sm border-light">
            <Deposit
              depositTokens={depositTokens}
              tokenSymbol={tokenData.symbol}
            />
          </div>
        </div>

        <div className="col-lg-4 col-md-12 mb-4">
          <div className="card p-3 shadow-sm border-light text-center">
            <div>Token ID: {nextTokenId}</div>
            {`${nextTokenId}` === "1" ? (
              <h4>
                Holding: {nextTokenId} {tokenERC721Data.symbol}
              </h4>
            ) : (
              <h4>Holding 0 {tokenERC721Data.symbol}</h4>
            )}
          </div>
        </div>

        {/* <div className="col-lg-4 col-md-12 mb-4">
          <div className="card p-3 shadow-sm border-light text-center">
            <h4>NFT Name: {tokenERC721Data.name}</h4>
            <h5>NFT Symbol: {tokenERC721Data.symbol}</h5>
          </div>
        </div> */}
      </div>
    </div>
  );
};
