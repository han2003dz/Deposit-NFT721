require("@nomicfoundation/hardhat-toolbox");
require("./tasks/faucet");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: `https://linea-sepolia.infura.io/v3/${process.env.API_KEY}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
};
