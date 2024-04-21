// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract NegativeAmountHandler is EIP712 {
    struct Payment {
        address to;
        int256 amount; // Can be negative to indicate deduction or penalty
        uint256 nonce;
    }

    mapping(address => uint256) public nonces;

    // EIP712 Domain Separator initialization in constructor
    constructor() EIP712("NegativeAmountHandler", "1") {}

    // Function to handle a negative amount logic
    function handlePayment(Payment calldata payment, bytes calldata signature) external {
        require(_verify(_hash(payment), signature), "Invalid signature");
        require(payment.amount < 0, "Amount must be negative");
        
        // Example logic for negative amount handling
        // Here we just emit an event, but you could implement any logic you want
        emit PaymentHandled(payment.to, payment.amount, msg.sender);

        // Increment nonce after handling to prevent replay attacks
        nonces[payment.to]++;
    }

    // Create a hash of the payment details (EIP712 Typed Data)
    function _hash(Payment calldata payment) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Payment(address to,int256 amount,uint256 nonce)"),
            payment.to,
            payment.amount,
            payment.nonce
        )));
    }

    // Verify the signature
    function _verify(bytes32 digest, bytes calldata signature) internal view returns (bool) {
        address signer = ECDSA.recover(digest, signature);
        return signer == msg.sender && nonces[signer] == payment.nonce;
    }

    event PaymentHandled(address indexed to, int256 amount, address indexed executor);
}
