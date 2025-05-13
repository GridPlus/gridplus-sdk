#!/bin/bash

# --- Configuration ---
RPC_URL="http://localhost:8545"
DELEGATE_CONTRACT="0x5fbdb2315678afecb367f032d93f642f64180aa3"
AUTHORIZER_SENDER_EOA="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
AUTHORIZER_SENDER_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

CHAIN_ID=31337
RECIPIENT1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
RECIPIENT2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
VALUE1_WEI=$(cast --to-wei 0.01 ether)
VALUE2_WEI=$(cast --to-wei 0.02 ether)
GAS_LIMIT=150000
MAX_FEE_PER_GAS="1gwei"
MAX_PRIORITY_FEE_PER_GAS="0.1gwei"
GAS_PRICE="1gwei"

# --- Helper Function ---
die() {
    echo "Error: $1" >&2
    exit 1
}

# --- Step 1: Sign the EIP-7702 Authorization ---
echo "Signing authorization for EOA ${AUTHORIZER_SENDER_EOA} to use code from ${DELEGATE_CONTRACT}..."
SIGNED_AUTH_HEX=$(cast wallet sign-auth $DELEGATE_CONTRACT --private-key $AUTHORIZER_SENDER_PK --chain $CHAIN_ID --rpc-url $RPC_URL) || die "Failed to sign authorization using 'cast wallet sign-auth'"
echo "Signed Authorization Hex: $SIGNED_AUTH_HEX"

# --- Step 2: Prepare the transaction data for the delegate call ---
echo "Encoding delegate call data for executeBatch..."
DELEGATE_CALL_DATA=$(cast abi-encode "executeBatch((address,uint256,bytes)[])" "[($RECIPIENT1, $VALUE1_WEI, 0x), ($RECIPIENT2, $VALUE2_WEI, 0x)]") || die "Failed to encode delegate call data"
echo "Delegate Call Data: $DELEGATE_CALL_DATA"

# --- Step 3: Send the EIP-7702 Transaction - Reordered Arguments ---
echo "Sending EIP-7702 transaction from ${SENDER_EOA} to ${AUTHORIZER_EOA}..."
# Try putting --auth AFTER positional arguments (to, calldata)
cast send --private-key $AUTHORIZER_SENDER_PK \
         --rpc-url $RPC_URL \
         --chain $CHAIN_ID \
         --gas-limit $GAS_LIMIT \
         --gas-price $GAS_PRICE \
         $AUTHORIZER_SENDER_EOA \
         $DELEGATE_CALL_DATA \
         --auth $SIGNED_AUTH_HEX || die "Cast send failed"

echo "Transaction sent successfully!"

exit 0