const fs = require("fs");
const path = require("path");

async function main() {
  if (network.name === "hardhat") {
    console.warn(
      "You are deploying to the Hardhat Network, which is reset every run. Use '--network localhost' for persistent deployment."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy Token and TokenERC20 contracts
  const contracts = {};
  contracts["TokenERC20"] = await deployContract("TokenERC20");
  // Deploy MyDepositContract with the TokenERC20 address as an argument
  contracts["MyDepositContract"] = await deployContract(
    "MyDepositContract",
    contracts["TokenERC20"].address
  );

  // Save deployed contracts to the frontend
  saveFrontendFiles(contracts);
}

async function deployContract(contractName, ...args) {
  try {
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy(...args);
    await contract.deployed();
    console.log(`${contractName} deployed at:`, contract.address);
    return contract;
  } catch (error) {
    console.error(`Failed to deploy ${contractName}:`, error);
    process.exit(1);
  }
}

function saveFrontendFiles(contracts) {
  const contractsDir = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "contracts"
  );

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  const contractAddresses = Object.keys(contracts).reduce((addresses, name) => {
    addresses[name] = contracts[name].address;
    return addresses;
  }, {});

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify(contractAddresses, null, 2)
  );

  for (const [name, contract] of Object.entries(contracts)) {
    const artifact = artifacts.readArtifactSync(name);
    fs.writeFileSync(
      path.join(contractsDir, `${name}.json`),
      JSON.stringify(artifact, null, 2)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
