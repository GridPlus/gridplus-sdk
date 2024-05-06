// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

contract NegativeAmountHandler is EIP712 {
    string private constant SIGNING_DOMAIN = "NegativeAmountHandler";
    string private constant SIGNATURE_VERSION = "1";

    struct Data {
        int256 amount;
        string message;
    }

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    function verify(Data calldata data, bytes calldata signature) public view returns (bool) {
        address signer = _verify(_hash(data), signature);
        return signer == msg.sender;  // Ensure that the signer is the sender of the message
    }

    function _hash(Data calldata data) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Data(int256 amount,string message)"),
            data.amount,
            keccak256(bytes(data.message))
        )));
    }

    function _verify(bytes32 digest, bytes memory signature) internal view returns (address) {
        return ECDSA.recover(digest, signature);
    }
}
