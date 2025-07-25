use candid::{CandidType, Principal};
use ethers_core::abi::{Function, Param, ParamType, StateMutability, Token};
use ethers_core::types::{transaction::eip1559::Eip1559TransactionRequest, Address, NameOrAddress, Signature, U256, U64, H160};
use ethers_core::utils::{hex, keccak256};
use ic_cdk::{api::management_canister::ecdsa::{ecdsa_public_key, sign_with_ecdsa, EcdsaKeyId, EcdsaCurve, EcdsaPublicKeyArgument, SignWithEcdsaArgument}, export_candid, update, query};
use evm_rpc_canister_types::{RpcServices, RpcError, RpcConfig, RpcApi, EVM_RPC, FeeHistoryArgs, FeeHistoryResult, MultiGetTransactionReceiptResult, MultiFeeHistoryResult, EvmRpcCanister, BlockTag, GetTransactionCountArgs, MultiGetTransactionCountResult, GetTransactionCountResult, GetTransactionReceiptResult};
use ic_cdk::api::call::call_with_payment128;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

thread_local! {
    static RPC_CONFIG: RefCell<Option<RpcConfigState>> = RefCell::new(None);
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct RpcConfigState {
    pub chain_id: u64,
    pub rpc_url: String,
}

#[update]
pub fn set_rpc_config(chain_id: u64, rpc_url: String) -> Result<(), String> {
    RPC_CONFIG.with(|cfg| {
        cfg.borrow_mut().replace(RpcConfigState { chain_id, rpc_url });
    });
    Ok(())
}

#[query]
pub fn get_rpc_config() -> Option<RpcConfigState> {
    RPC_CONFIG.with(|cfg| cfg.borrow().clone())
}

fn get_rpc_services() -> Result<RpcServices, String> {
    RPC_CONFIG.with(|cfg| {
        cfg.borrow().clone().map(|c| RpcServices::Custom {
            chainId: c.chain_id,
            services: vec![RpcApi {
                url: c.rpc_url,
                headers: None,
            }],
        }).ok_or("RPC config not set".to_string())
    })
}

#[derive(CandidType, serde::Serialize, serde::Deserialize)]
pub struct TransferArgs {
    to: String,     // Hex-encoded address
    value: String,  // Value in wei
    gas: Option<u64>, // Optional gas limit
}

#[derive(Debug, Clone, CandidType, serde::Serialize)]
pub struct SignedTransaction {
    pub tx_hex: String,
    pub tx_hash: String,
}

struct FeeEstimates {
    max_fee_per_gas: U256,
    max_priority_fee_per_gas: U256,
}

type CallResult<T> = Result<T, String>;
type TransactionHash = String;

fn nat_to_hex(nat: &candid::Nat) -> String {
    let bytes = nat.0.to_bytes_le(); // Convert to little-endian bytes
    let hex = hex::encode(&bytes);
    // Reverse bytes to get correct hex representation
    let chars: Vec<char> = hex.chars().collect();
    let reversed_hex: String = chars.chunks(2).rev().flat_map(|chunk| chunk.iter()).collect();
    // Trim leading zeros, ensure at least one digit
    let trimmed = reversed_hex.trim_start_matches('0');
    if trimmed.is_empty() { "0".to_string() } else { trimmed.to_string() }
}

pub async fn get_canister_public_key(
    key_id: EcdsaKeyId,
    canister_id: Option<Principal>,
    derivation_path: Vec<Vec<u8>>,
) -> Vec<u8> {
    let (key,) = ecdsa_public_key(EcdsaPublicKeyArgument {
        canister_id,
        derivation_path,
        key_id,
    })
    .await
    .expect("failed to get public key");
    key.public_key
}

pub async fn sign_eip1559_transaction(
    tx: Eip1559TransactionRequest,
    key_id: EcdsaKeyId,
    derivation_path: Vec<Vec<u8>>,
) -> SignedTransaction {
    const EIP1559_TX_ID: u8 = 2;

    let ecdsa_pub_key = get_canister_public_key(key_id.clone(), None, derivation_path.clone()).await;

    let mut unsigned_tx_bytes = tx.rlp().to_vec();
    unsigned_tx_bytes.insert(0, EIP1559_TX_ID);

    let txhash = keccak256(&unsigned_tx_bytes);

    let signature = sign_with_ecdsa(SignWithEcdsaArgument {
        message_hash: txhash.to_vec(),
        derivation_path,
        key_id,
    })
    .await
    .expect("failed to sign the transaction")
    .0
    .signature;

    let signature = Signature {
        v: y_parity(&txhash, &signature, &ecdsa_pub_key),
        r: U256::from_big_endian(&signature[0..32]),
        s: U256::from_big_endian(&signature[32..64]),
    };

    let mut signed_tx_bytes = tx.rlp_signed(&signature).to_vec();
    signed_tx_bytes.insert(0, EIP1559_TX_ID);

    SignedTransaction {
        tx_hex: format!("0x{}", hex::encode(&signed_tx_bytes)),
        tx_hash: format!("0x{}", hex::encode(keccak256(&signed_tx_bytes))),
    }
}

pub fn pubkey_bytes_to_address(pubkey_bytes: &[u8]) -> String {
    use ethers_core::k256::elliptic_curve::sec1::ToEncodedPoint;
    use ethers_core::k256::PublicKey;

    let key = PublicKey::from_sec1_bytes(pubkey_bytes).expect("failed to parse the public key as SEC1");
    let point = key.to_encoded_point(false);
    let point_bytes = point.as_bytes();
    assert_eq!(point_bytes[0], 0x04);

    let hash = keccak256(&point_bytes[1..]);
    ethers_core::utils::to_checksum(&Address::from_slice(&hash[12..32]), None)
}

fn y_parity(prehash: &[u8], sig: &[u8], pubkey: &[u8]) -> u64 {
    use ethers_core::k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    let orig_key = VerifyingKey::from_sec1_bytes(pubkey).expect("failed to parse the pubkey");
    let signature = Signature::try_from(sig).unwrap();
    for parity in [0u8, 1] {
        let recid = RecoveryId::try_from(parity).unwrap();
        let recovered_key = VerifyingKey::recover_from_prehash(prehash, &signature, recid)
            .expect("failed to recover key");
        if recovered_key == orig_key {
            return parity as u64;
        }
    }

    panic!(
        "failed to recover the parity bit from a signature; sig: {}, pubkey: {}",
        hex::encode(sig),
        hex::encode(pubkey)
    )
}

#[update]
async fn get_canister_eth_address() -> String {
    let key_id = EcdsaKeyId {
        curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };
    let pubkey = get_canister_public_key(key_id, None, vec![]).await;
    pubkey_bytes_to_address(&pubkey)
}

async fn estimate_transaction_fees(
    block_count: u64,
    rpc_services: RpcServices,
    evm_rpc: EvmRpcCanister,
) -> CallResult<FeeEstimates> {
    let args = FeeHistoryArgs {
        blockCount: block_count.into(),
        newestBlock: BlockTag::Latest,
        rewardPercentiles: Some(vec![20u8].into()),
    };
    let (result,) = evm_rpc
        .eth_fee_history(rpc_services.clone(), None, args, 10_000_000_000)
        .await
        .map_err(|e| format!("Failed to get fee history: {:?}", e))?;

    match result {
        MultiFeeHistoryResult::Consistent(r) => match r {
            FeeHistoryResult::Ok(fee_history) => {
                // Define a default Nat value with a longer lifetime
                let default_base_fee = candid::Nat::from(10_000_000_000u64);
                let base_fee_nat = fee_history.baseFeePerGas.last().unwrap_or(&default_base_fee);
                ic_cdk::println!("base_fee_nat: {:?}", base_fee_nat);
                let base_fee_str = nat_to_hex(base_fee_nat);
                ic_cdk::println!("base_fee_str: {}", base_fee_str);
                let base_fee = U256::from_str_radix(&base_fee_str, 16)
                    .map_err(|e| format!("Failed to parse base_fee: {:?}", e))?;

                // Parse reward (already correctly handled with a Vec)
                let default_reward = vec![candid::Nat::from(1_000_000_000u64)];
                let reward_vec = fee_history.reward.last().unwrap_or(&default_reward);
                ic_cdk::println!("reward_vec[0]: {:?}", reward_vec[0]);
                let reward_str = nat_to_hex(&reward_vec[0]);
                ic_cdk::println!("reward_str: {}", reward_str);
                let reward = U256::from_str_radix(&reward_str, 16)
                    .map_err(|e| format!("Failed to parse reward: {:?}", e))?;

                Ok(FeeEstimates {
                    max_fee_per_gas: base_fee + reward,
                    max_priority_fee_per_gas: reward,
                })
            },
            FeeHistoryResult::Err(err) => Err(format!("Fee history error: {:?}", err)),
        },
        MultiFeeHistoryResult::Inconsistent(_) => Err("Inconsistent fee history results".to_string()),
    }
}

async fn send_raw_transaction(
    tx: SignedTransaction,
    rpc_services: RpcServices,
    evm_rpc: EvmRpcCanister,
) -> CallResult<TransactionHash> {
    let cycles = 10_000_000_000;

    match evm_rpc
        .eth_send_raw_transaction(rpc_services, None, tx.tx_hex, cycles)
        .await
    {
        Ok((_result,)) => {
            ic_cdk::println!("Transaction hash: {}", tx.tx_hash);
            Ok(tx.tx_hash)
        }
        Err(e) => Err(format!("RPC error: {:?}", e)),
    }
}

#[update]
pub async fn transfer_eth(
    transfer_args: TransferArgs,
    nonce: u64,
) -> CallResult<TransactionHash> {
    let to_bytes = hex::decode(transfer_args.to.strip_prefix("0x").unwrap_or(&transfer_args.to))
        .map_err(|e| format!("Invalid 'to' address: {:?}", e))?;
    let to = Some(NameOrAddress::Address(Address::from_slice(&to_bytes)));

    let value = U256::from_dec_str(&transfer_args.value)
        .map_err(|e| format!("Invalid value: {:?}", e))?;

    let gas = transfer_args.gas.map(U256::from).unwrap_or(U256::from(21000));

    let rpc_services = get_rpc_services()?;


    let key_id = EcdsaKeyId {
        curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let evm_rpc = EVM_RPC;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone())
        .await
        .map_err(|e| format!("Fee estimation failed: {:?}", e))?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to,
        value: Some(value),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(gas),
        nonce: Some(U256::from(nonce)),
        chain_id: Some(U64::from(17000u64)),
        data: Default::default(),
        access_list: Default::default(),
    };

    let tx = sign_eip1559_transaction(tx, key_id, vec![]).await;

    send_raw_transaction(tx, rpc_services, evm_rpc).await
}

async fn get_nonce(
    address: String,
    rpc_services: RpcServices,
    evm_rpc: EvmRpcCanister,
) -> Result<U256, String> {
    let args = GetTransactionCountArgs {
        address,
        block: BlockTag::Latest,
    };

    let (result,) = evm_rpc
        .eth_get_transaction_count(rpc_services.clone(), None, args, 10_000_000_000)
        .await
        .map_err(|e| format!("Failed to fetch nonce: {:?}", e))?;

    match result {
        MultiGetTransactionCountResult::Consistent(inner) => match inner {
            GetTransactionCountResult::Ok(nonce_candid_nat) => {
                let hex_str = nat_to_hex(&nonce_candid_nat);
                U256::from_str_radix(&hex_str, 16).map_err(|e| format!("Failed to parse nonce: {:?}", e))
            },
            GetTransactionCountResult::Err(err) => Err(format!("Error fetching nonce: {:?}", err))
        },
        _ => Err("Inconsistent nonce result from provider.".to_string()),
    }
}

#[update]
pub async fn approve_erc20(
    contract_address: String,
    spender: String,
    amount: String,
) -> CallResult<TransactionHash> {
    let contract_addr = H160::from_slice(&hex::decode(contract_address.trim_start_matches("0x")).map_err(|e| format!("Invalid contract: {}", e))?);
    let spender_addr = H160::from_slice(&hex::decode(spender.trim_start_matches("0x")).map_err(|e| format!("Invalid spender: {}", e))?);
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let pubkey = get_canister_public_key(key_id.clone(), None, vec![]).await;
    let sender = pubkey_bytes_to_address(&pubkey);
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let approve_fn = Function {
        name: "approve".to_string(),
        inputs: vec![
            Param { name: "spender".to_string(), kind: ParamType::Address, internal_type: None },
            Param { name: "amount".to_string(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };

    let data = approve_fn.encode_input(&[Token::Address(spender_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates { max_fee_per_gas, max_priority_fee_per_gas } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(NameOrAddress::Address(contract_addr)),
        value: Some(U256::zero()),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(U256::from(300_000)),
        nonce: Some(nonce),
        chain_id: Some(U64::from(17000)),
        data: Some(data.into()),
        access_list: Default::default(),
    };

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn transfer_from_erc20(
    contract_address: String,
    from: String,
    to: String,
    amount: String,
) -> CallResult<TransactionHash> {
    let contract_addr = H160::from_slice(&hex::decode(contract_address.trim_start_matches("0x")).map_err(|e| format!("Invalid contract: {}", e))?);
    let from_addr = H160::from_slice(&hex::decode(from.trim_start_matches("0x")).map_err(|e| format!("Invalid from: {}", e))?);
    let to_addr = H160::from_slice(&hex::decode(to.trim_start_matches("0x")).map_err(|e| format!("Invalid to: {}", e))?);
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let pubkey = get_canister_public_key(key_id.clone(), None, vec![]).await;
    let sender = pubkey_bytes_to_address(&pubkey);
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let transfer_from_fn = Function {
        name: "transferFrom".to_string(),
        inputs: vec![
            Param { name: "from".to_string(), kind: ParamType::Address, internal_type: None },
            Param { name: "to".to_string(), kind: ParamType::Address, internal_type: None },
            Param { name: "amount".to_string(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = transfer_from_fn.encode_input(&[Token::Address(from_addr), Token::Address(to_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates { max_fee_per_gas, max_priority_fee_per_gas } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(NameOrAddress::Address(contract_addr)),
        value: Some(U256::zero()),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(U256::from(300_000)),
        nonce: Some(nonce),
        chain_id: Some(U64::from(17000)),
        data: Some(data.into()),
        access_list: Default::default(),
    };

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn mint(
    contract_address: String,
    to: String,
    amount: String,
) -> CallResult<TransactionHash> {
    let contract_addr = H160::from_slice(&hex::decode(contract_address.trim_start_matches("0x")).map_err(|e| format!("Invalid contract: {}", e))?);
    let to_addr = H160::from_slice(&hex::decode(to.trim_start_matches("0x")).map_err(|e| format!("Invalid to: {}", e))?);
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let pubkey = get_canister_public_key(key_id.clone(), None, vec![]).await;
    let sender = pubkey_bytes_to_address(&pubkey);
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let mint_fn = Function {
        name: "mint".to_string(),
        inputs: vec![
            Param { name: "to".to_string(), kind: ParamType::Address, internal_type: None },
            Param { name: "amount".to_string(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = mint_fn.encode_input(&[Token::Address(to_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates { max_fee_per_gas, max_priority_fee_per_gas } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(NameOrAddress::Address(contract_addr)),
        value: Some(U256::zero()),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(U256::from(300_000)),
        nonce: Some(nonce),
        chain_id: Some(U64::from(17000)),
        data: Some(data.into()),
        access_list: Default::default(),
    };

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn burn(
    contract_address: String,
    amount: String,
) -> CallResult<TransactionHash> {
    let contract_addr = H160::from_slice(&hex::decode(contract_address.trim_start_matches("0x")).map_err(|e| format!("Invalid contract: {}", e))?);
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let pubkey = get_canister_public_key(key_id.clone(), None, vec![]).await;
    let sender = pubkey_bytes_to_address(&pubkey);
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let mint_fn = Function {
        name: "burn".to_string(),
        inputs: vec![
            Param { name: "amount".to_string(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = mint_fn.encode_input(&[Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates { max_fee_per_gas, max_priority_fee_per_gas } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(NameOrAddress::Address(contract_addr)),
        value: Some(U256::zero()),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(U256::from(300_000)),
        nonce: Some(nonce),
        chain_id: Some(U64::from(17000)),
        data: Some(data.into()),
        access_list: Default::default(),
    };

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn burn_from(
    contract_address: String,
    from: String,
    amount: String,
) -> CallResult<TransactionHash> {
    let contract_addr = H160::from_slice(&hex::decode(contract_address.trim_start_matches("0x")).map_err(|e| format!("Invalid contract: {}", e))?);
    let from_addr = H160::from_slice(&hex::decode(from.trim_start_matches("0x")).map_err(|e| format!("Invalid from: {}", e))?);
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(),
    };

    let pubkey = get_canister_public_key(key_id.clone(), None, vec![]).await;
    let sender = pubkey_bytes_to_address(&pubkey);
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let burn_from_fn = Function {
        name: "transferFrom".to_string(),
        inputs: vec![
            Param { name: "from".to_string(), kind: ParamType::Address, internal_type: None },
            Param { name: "amount".to_string(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = burn_from_fn.encode_input(&[Token::Address(from_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates { max_fee_per_gas, max_priority_fee_per_gas } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(NameOrAddress::Address(contract_addr)),
        value: Some(U256::zero()),
        max_fee_per_gas: Some(max_fee_per_gas),
        max_priority_fee_per_gas: Some(max_priority_fee_per_gas),
        gas: Some(U256::from(300_000)),
        nonce: Some(nonce),
        chain_id: Some(U64::from(17000)),
        data: Some(data.into()),
        access_list: Default::default(),
    };

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[ic_cdk::update]
pub async fn verify_tx_receipt_with_validation(
    tx_hash: String,
    expected_from: String,
    expected_amount: String,
    expected_contract: String,
) -> Result<String, String> {
    use ethers_core::types::U256;

    let rpc_services = get_rpc_services()?;
    let evm_rpc = EVM_RPC;
    let cycles = 10_000_000_000;

    let (result,): (MultiGetTransactionReceiptResult,) = call_with_payment128(
        evm_rpc.0,
        "eth_getTransactionReceipt",
        (rpc_services.clone(), None::<RpcConfig>, tx_hash.clone()),
        cycles,
    )
    .await
    .map_err(|e| format!("Call failed: {:?}", e))?;

    match result {
        MultiGetTransactionReceiptResult::Consistent(receipt_result) => {
            match receipt_result {
                GetTransactionReceiptResult::Ok(receipt_opt) => {
                    let receipt = match receipt_opt {
                        Some(r) => r,
                        None => return Err("Transaction receipt not yet available.".to_string()),
                    };

                    let logs = receipt.logs;
                    let expected_from = expected_from.to_lowercase();
                    let expected_contract = expected_contract.to_lowercase();
                    let expected_amount_hex = format!("{:x}", U256::from_dec_str(&expected_amount).unwrap());

                    for log in logs {
                        let log_address = log.address.to_lowercase();

                        if log_address != expected_contract {
                            continue;
                        }

                        if log.topics.len() >= 3 {
                            let from_hex = &log.topics[1][26..];
                            let to_hex = &log.topics[2][26..];

                            let is_zero_address = to_hex.chars().all(|c| c == '0');
                            let from_matches = from_hex.to_lowercase() == expected_from.trim_start_matches("0x").to_lowercase();

                            let log_data_clean = log.data.trim_start_matches("0x").trim_start_matches('0');
                            let expected_clean = expected_amount_hex.trim_start_matches('0');
                            let amount_matches = log_data_clean == expected_clean;

                            if from_matches && is_zero_address && amount_matches {
                                return Ok(format!(
                                    "✅ Valid burn confirmed\n• Amount: {}\n• From: {}\n• Contract: {}",
                                    expected_amount, expected_from, expected_contract
                                ));
                            }
                        }
                    }

                    Err("❌ Burn log with matching details not found.".to_string())
                }
                GetTransactionReceiptResult::Err(err) => Err(format!("Transaction error: {:?}", err)),
            }
        }
        MultiGetTransactionReceiptResult::Inconsistent(_) => {
            Err("Inconsistent result from RPC".to_string())
        }
    }
}

ic_cdk::export_candid!();