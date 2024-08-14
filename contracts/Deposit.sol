// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyDepositContract is ERC721, Ownable {
    IERC20 public erc20Token;
    uint256 public constant DEPOSIT_THRESHOLD = 10000;
    uint256 public nextTokenId;

    mapping(address => uint256) public deposits;

    constructor(IERC20 _erc20Token) ERC721("MyNFT", "MNFT") Ownable(msg.sender) {
        erc20Token = _erc20Token;  
    }

    function deposit(uint256 amount) external  {
        require(amount > 0, "Amount must be greater than zero");
        require(erc20Token.allowance(msg.sender, address(this)) >= amount, "error");
        
        erc20Token.transferFrom(msg.sender, address(this), amount);

        deposits[msg.sender] += amount;

        if (deposits[msg.sender] >= DEPOSIT_THRESHOLD && balanceOf(msg.sender) <= 1) {
            mintNFT(msg.sender);
        }
    }

    function mintNFT(address to) public {
        _safeMint(to, nextTokenId);
        nextTokenId++;
    }

    function getNextTokenId() external view returns (uint256) {
        return nextTokenId;
    }
}
