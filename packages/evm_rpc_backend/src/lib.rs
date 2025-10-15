use candid::{CandidType, Principal};
use ethers_core::abi::{Function, Param, ParamType, StateMutability, Token};
use ethers_core::types::{
    transaction::eip1559::Eip1559TransactionRequest, Address, NameOrAddress, Signature, H160, U256,
    U64,
};
use ethers_core::utils::{hex, keccak256};
use evm_rpc_canister_types::{
    BlockTag, EvmRpcCanister, FeeHistoryArgs, FeeHistoryResult, GetTransactionCountArgs,
    GetTransactionCountResult, GetTransactionReceiptResult, MultiFeeHistoryResult,
    MultiGetTransactionCountResult, MultiGetTransactionReceiptResult, RpcApi, RpcConfig,
    RpcServices, EVM_RPC,
};
use futures::channel::oneshot;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::call::RejectionCode;
use ic_cdk::storage::{stable_restore, stable_save};
use ic_cdk::{
    api::management_canister::ecdsa::{
        ecdsa_public_key, sign_with_ecdsa, EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument,
        SignWithEcdsaArgument,
    },
    query, update,
};
use ic_cdk_timers::set_timer;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::time::Duration;

const HELIX_VAULT_CANISTER_ID: &str = "b77ix-eeaaa-aaaaa-qaada-cai";
const BRIDGE_CONTRACT_ADDRESS: &str = "0xA198902f589BC4805ED4cA6089B9Fe46d1c9a866";
const ECDSA_KEY_NAME: &str = "secp256k1";
const MAX_ECDSA_RETRIES: u8 = 5;
const ECDSA_RETRY_BASE_DELAY_MS: u64 = 50;

thread_local! {
    static STATE: RefCell<CanisterState> = RefCell::new(CanisterState::default());
    static CACHED_IDENTITY: RefCell<Option<CachedIdentity>> = RefCell::new(None);
}

#[derive(Clone, Default)]
struct CanisterState {
    rpc_config: Option<RpcConfigState>,
}

#[derive(Clone)]
struct CachedIdentity {
    key_id: EcdsaKeyId,
    derivation_path: Vec<Vec<u8>>,
    canister_id: Option<Principal>,
    public_key: Vec<u8>,
    eth_address: String,
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct RpcConfigState {
    pub chain_id: u64,
    pub rpc_url: String,
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct BurnValidation {
    pub from: String,
    pub amount_wei: String,
    pub contract: String,
}

#[derive(Default, CandidType, Deserialize, Serialize)]
struct StableState {
    rpc_config: Option<RpcConfigState>,
}

impl From<CanisterState> for StableState {
    fn from(state: CanisterState) -> Self {
        StableState {
            rpc_config: state.rpc_config,
        }
    }
}

impl From<StableState> for CanisterState {
    fn from(state: StableState) -> Self {
        CanisterState {
            rpc_config: state.rpc_config,
        }
    }
}

#[ic_cdk::pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let stable: StableState = state.borrow().clone().into();
        stable_save((stable,))
            .unwrap_or_else(|e| ic_cdk::trap(&format!("failed to persist state: {}", e)));
    });
    CACHED_IDENTITY.with(|cache| cache.borrow_mut().take());
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    match stable_restore::<(StableState,)>() {
        Ok((stable,)) => {
            STATE.with(|state| {
                *state.borrow_mut() = stable.into();
            });
        }
        Err(_) => {
            STATE.with(|state| *state.borrow_mut() = CanisterState::default());
        }
    }
    CACHED_IDENTITY.with(|cache| cache.borrow_mut().take());
}

fn ensure_authorized() -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    if ic_cdk::api::is_controller(&caller) {
        return Ok(());
    }

    let helix_vault = Principal::from_text(HELIX_VAULT_CANISTER_ID)
        .map_err(|_| "Invalid HELIX_VAULT_CANISTER_ID constant".to_string())?;
    if caller == helix_vault {
        return Ok(());
    }

    Err(format!("Caller {} is not authorized", caller))
}

fn require_bridge_contract(input: &str) -> Result<(), String> {
    if !input.eq_ignore_ascii_case(BRIDGE_CONTRACT_ADDRESS) {
        Err("Unrecognized bridge contract address".to_string())
    } else {
        Ok(())
    }
}

fn decode_h160(value: &str, context: &str) -> Result<H160, String> {
    let bytes = hex::decode(value.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid {}: {}", context, e))?;
    if bytes.len() != 20 {
        return Err(format!(
            "Invalid {} length: expected 20 bytes, got {}",
            context,
            bytes.len()
        ));
    }
    Ok(H160::from_slice(&bytes))
}

fn normalize_address(value: &str) -> Result<String, String> {
    let bytes = hex::decode(value.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid address: {}", e))?;
    if bytes.len() != 20 {
        return Err(format!(
            "Invalid address length: expected 20 bytes, got {}",
            bytes.len()
        ));
    }
    Ok(format!("0x{}", hex::encode(bytes)))
}

fn backoff_delay(attempt: u8) -> Duration {
    let multiplier = 1u64 << attempt;
    Duration::from_millis(ECDSA_RETRY_BASE_DELAY_MS * multiplier)
}

async fn sleep_duration(delay: Duration) {
    if delay.is_zero() {
        return;
    }

    let (sender, receiver) = oneshot::channel::<()>();
    set_timer(delay, move || {
        let _ = sender.send(());
    });

    let _ = receiver.await;
}

async fn fetch_public_key_with_retry(
    key_id: EcdsaKeyId,
    canister_id: Option<Principal>,
    derivation_path: Vec<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    for attempt in 0..MAX_ECDSA_RETRIES {
        let args = EcdsaPublicKeyArgument {
            canister_id,
            derivation_path: derivation_path.clone(),
            key_id: key_id.clone(),
        };

        match ecdsa_public_key(args).await {
            Ok((response,)) => return Ok(response.public_key),
            Err((code, msg)) => {
                if code == RejectionCode::SysTransient && attempt + 1 < MAX_ECDSA_RETRIES {
                    sleep_duration(backoff_delay(attempt + 1)).await;
                    continue;
                }
                return Err(format!("ecdsa_public_key rejected: {:?}: {}", code, msg));
            }
        }
    }

    Err("ecdsa_public_key exhausted retries".to_string())
}

async fn sign_with_ecdsa_retry(
    message_hash: Vec<u8>,
    key_id: EcdsaKeyId,
    derivation_path: Vec<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    for attempt in 0..MAX_ECDSA_RETRIES {
        let args = SignWithEcdsaArgument {
            message_hash: message_hash.clone(),
            derivation_path: derivation_path.clone(),
            key_id: key_id.clone(),
        };

        match sign_with_ecdsa(args).await {
            Ok((response,)) => return Ok(response.signature),
            Err((code, msg)) => {
                if code == RejectionCode::SysTransient && attempt + 1 < MAX_ECDSA_RETRIES {
                    sleep_duration(backoff_delay(attempt + 1)).await;
                    continue;
                }
                return Err(format!("sign_with_ecdsa rejected: {:?}: {}", code, msg));
            }
        }
    }

    Err("sign_with_ecdsa exhausted retries".to_string())
}

async fn ensure_identity(
    key_id: EcdsaKeyId,
    canister_id: Option<Principal>,
    derivation_path: Vec<Vec<u8>>,
) -> Result<CachedIdentity, String> {
    if let Some(identity) = CACHED_IDENTITY.with(|cache| cache.borrow().clone()) {
        if identity.key_id == key_id
            && identity.canister_id == canister_id
            && identity.derivation_path == derivation_path
        {
            return Ok(identity);
        }
    }

    let public_key =
        fetch_public_key_with_retry(key_id.clone(), canister_id.clone(), derivation_path.clone())
            .await?;
    let eth_address = pubkey_bytes_to_address(&public_key)?;

    let identity = CachedIdentity {
        key_id,
        canister_id,
        derivation_path,
        public_key,
        eth_address,
    };

    CACHED_IDENTITY.with(|cache| {
        *cache.borrow_mut() = Some(identity.clone());
    });

    Ok(identity)
}

#[update]
pub fn set_rpc_config(chain_id: u64, rpc_url: String) -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    if !ic_cdk::api::is_controller(&caller) {
        return Err("Only controllers may update RPC configuration".to_string());
    }

    STATE.with(|cfg| {
        cfg.borrow_mut().rpc_config = Some(RpcConfigState { chain_id, rpc_url });
    });

    Ok(())
}

#[query]
pub fn get_rpc_config() -> Option<RpcConfigState> {
    STATE.with(|cfg| cfg.borrow().rpc_config.clone())
}

fn get_rpc_services() -> Result<RpcServices, String> {
    STATE.with(|cfg| {
        cfg.borrow()
            .rpc_config
            .clone()
            .map(|c| RpcServices::Custom {
                chainId: c.chain_id,
                services: vec![RpcApi {
                    url: c.rpc_url,
                    headers: None,
                }],
            })
            .ok_or("RPC config not set".to_string())
    })
}

#[derive(CandidType, serde::Serialize, serde::Deserialize)]
pub struct TransferArgs {
    to: String,       // Hex-encoded address
    value: String,    // Value in wei
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
    let reversed_hex: String = chars
        .chunks(2)
        .rev()
        .flat_map(|chunk| chunk.iter())
        .collect();
    // Trim leading zeros, ensure at least one digit
    let trimmed = reversed_hex.trim_start_matches('0');
    if trimmed.is_empty() {
        "0".to_string()
    } else {
        trimmed.to_string()
    }
}

pub async fn get_canister_public_key(
    key_id: EcdsaKeyId,
    canister_id: Option<Principal>,
    derivation_path: Vec<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    ensure_identity(key_id, canister_id, derivation_path)
        .await
        .map(|identity| identity.public_key)
}

pub async fn sign_eip1559_transaction(
    tx: Eip1559TransactionRequest,
    key_id: EcdsaKeyId,
    derivation_path: Vec<Vec<u8>>,
) -> Result<SignedTransaction, String> {
    const EIP1559_TX_ID: u8 = 2;

    let identity = ensure_identity(key_id.clone(), None, derivation_path.clone()).await?;
    let ecdsa_pub_key = identity.public_key.clone();

    let mut unsigned_tx_bytes = tx.rlp().to_vec();
    unsigned_tx_bytes.insert(0, EIP1559_TX_ID);

    let txhash = keccak256(&unsigned_tx_bytes);

    let signature_bytes = sign_with_ecdsa_retry(txhash.to_vec(), key_id, derivation_path).await?;

    let signature = Signature {
        v: y_parity(&txhash, &signature_bytes, &ecdsa_pub_key)?,
        r: U256::from_big_endian(&signature_bytes[0..32]),
        s: U256::from_big_endian(&signature_bytes[32..64]),
    };

    let mut signed_tx_bytes = tx.rlp_signed(&signature).to_vec();
    signed_tx_bytes.insert(0, EIP1559_TX_ID);

    Ok(SignedTransaction {
        tx_hex: format!("0x{}", hex::encode(&signed_tx_bytes)),
        tx_hash: format!("0x{}", hex::encode(keccak256(&signed_tx_bytes))),
    })
}

pub fn pubkey_bytes_to_address(pubkey_bytes: &[u8]) -> Result<String, String> {
    use ethers_core::k256::elliptic_curve::sec1::ToEncodedPoint;
    use ethers_core::k256::PublicKey;

    let key = PublicKey::from_sec1_bytes(pubkey_bytes)
        .map_err(|e| format!("failed to parse public key: {:?}", e))?;
    let point = key.to_encoded_point(false);
    let point_bytes = point.as_bytes();
    if point_bytes.first().copied() != Some(0x04) {
        return Err("public key is not in uncompressed SEC1 format".to_string());
    }

    let hash = keccak256(&point_bytes[1..]);
    Ok(ethers_core::utils::to_checksum(
        &Address::from_slice(&hash[12..32]),
        None,
    ))
}

fn y_parity(prehash: &[u8], sig: &[u8], pubkey: &[u8]) -> Result<u64, String> {
    use ethers_core::k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    let orig_key =
        VerifyingKey::from_sec1_bytes(pubkey).map_err(|e| format!("invalid pubkey: {:?}", e))?;
    let signature =
        Signature::try_from(sig).map_err(|e| format!("invalid signature bytes: {:?}", e))?;
    for parity in [0u8, 1] {
        let recid =
            RecoveryId::try_from(parity).map_err(|e| format!("invalid recovery id: {:?}", e))?;
        if let Ok(recovered_key) = VerifyingKey::recover_from_prehash(prehash, &signature, recid) {
            if recovered_key == orig_key {
                return Ok(parity as u64);
            }
        }
    }

    Err(format!(
        "failed to recover parity bit; sig: {}, pubkey: {}",
        hex::encode(sig),
        hex::encode(pubkey)
    ))
}

#[update]
pub async fn get_canister_eth_address() -> Result<String, String> {
    ensure_authorized()?;
    let key_id = EcdsaKeyId {
        curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };
    ensure_identity(key_id, None, vec![])
        .await
        .map(|identity| identity.eth_address)
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
                let base_fee_nat = fee_history
                    .baseFeePerGas
                    .last()
                    .unwrap_or(&default_base_fee);
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
            }
            FeeHistoryResult::Err(err) => Err(format!("Fee history error: {:?}", err)),
        },
        MultiFeeHistoryResult::Inconsistent(_) => {
            Err("Inconsistent fee history results".to_string())
        }
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
pub async fn transfer_eth(transfer_args: TransferArgs, nonce: u64) -> CallResult<TransactionHash> {
    ensure_authorized()?;
    let to_bytes = hex::decode(
        transfer_args
            .to
            .strip_prefix("0x")
            .unwrap_or(&transfer_args.to),
    )
    .map_err(|e| format!("Invalid 'to' address: {:?}", e))?;
    let to = Some(NameOrAddress::Address(Address::from_slice(&to_bytes)));

    let value =
        U256::from_dec_str(&transfer_args.value).map_err(|e| format!("Invalid value: {:?}", e))?;

    let gas = transfer_args
        .gas
        .map(U256::from)
        .unwrap_or(U256::from(21000));

    let rpc_services = get_rpc_services()?;

    let key_id = EcdsaKeyId {
        curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
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

    let tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;

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
                U256::from_str_radix(&hex_str, 16)
                    .map_err(|e| format!("Failed to parse nonce: {:?}", e))
            }
            GetTransactionCountResult::Err(err) => Err(format!("Error fetching nonce: {:?}", err)),
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
    ensure_authorized()?;
    require_bridge_contract(&contract_address)?;

    let contract_addr = decode_h160(&contract_address, "contract")?;
    let spender_addr = decode_h160(&spender, "spender")?;
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };

    let identity = ensure_identity(key_id.clone(), None, vec![]).await?;
    let sender = identity.eth_address.clone();
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let approve_fn = Function {
        name: "approve".to_string(),
        inputs: vec![
            Param {
                name: "spender".to_string(),
                kind: ParamType::Address,
                internal_type: None,
            },
            Param {
                name: "amount".to_string(),
                kind: ParamType::Uint(256),
                internal_type: None,
            },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };

    let data = approve_fn
        .encode_input(&[Token::Address(spender_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

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

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn transfer_from_erc20(
    contract_address: String,
    from: String,
    to: String,
    amount: String,
) -> CallResult<TransactionHash> {
    ensure_authorized()?;
    require_bridge_contract(&contract_address)?;

    let contract_addr = decode_h160(&contract_address, "contract")?;
    let from_addr = decode_h160(&from, "from")?;
    let to_addr = decode_h160(&to, "to")?;
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };

    let identity = ensure_identity(key_id.clone(), None, vec![]).await?;
    let sender = identity.eth_address.clone();
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let transfer_from_fn = Function {
        name: "transferFrom".to_string(),
        inputs: vec![
            Param {
                name: "from".to_string(),
                kind: ParamType::Address,
                internal_type: None,
            },
            Param {
                name: "to".to_string(),
                kind: ParamType::Address,
                internal_type: None,
            },
            Param {
                name: "amount".to_string(),
                kind: ParamType::Uint(256),
                internal_type: None,
            },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = transfer_from_fn
        .encode_input(&[
            Token::Address(from_addr),
            Token::Address(to_addr),
            Token::Uint(amount_u256),
        ])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

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

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn mint(
    contract_address: String,
    to: String,
    amount: String,
) -> CallResult<TransactionHash> {
    ensure_authorized()?;
    require_bridge_contract(&contract_address)?;

    let contract_addr = decode_h160(&contract_address, "contract")?;
    let to_addr = decode_h160(&to, "to")?;
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };

    let identity = ensure_identity(key_id.clone(), None, vec![]).await?;
    let sender = identity.eth_address.clone();
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let mint_fn = Function {
        name: "mint".to_string(),
        inputs: vec![
            Param {
                name: "to".to_string(),
                kind: ParamType::Address,
                internal_type: None,
            },
            Param {
                name: "amount".to_string(),
                kind: ParamType::Uint(256),
                internal_type: None,
            },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = mint_fn
        .encode_input(&[Token::Address(to_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

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

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn burn(contract_address: String, amount: String) -> CallResult<TransactionHash> {
    ensure_authorized()?;
    require_bridge_contract(&contract_address)?;

    let contract_addr = decode_h160(&contract_address, "contract")?;
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };

    let identity = ensure_identity(key_id.clone(), None, vec![]).await?;
    let sender = identity.eth_address.clone();
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let mint_fn = Function {
        name: "burn".to_string(),
        inputs: vec![Param {
            name: "amount".to_string(),
            kind: ParamType::Uint(256),
            internal_type: None,
        }],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = mint_fn
        .encode_input(&[Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

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

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[update]
pub async fn burn_from(
    contract_address: String,
    from: String,
    amount: String,
) -> CallResult<TransactionHash> {
    ensure_authorized()?;
    require_bridge_contract(&contract_address)?;

    let contract_addr = decode_h160(&contract_address, "contract")?;
    let from_addr = decode_h160(&from, "from")?;
    let amount_u256 = U256::from_dec_str(&amount).map_err(|e| format!("Invalid amount: {}", e))?;

    let rpc_services = get_rpc_services()?;

    let evm_rpc = EVM_RPC;

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: ECDSA_KEY_NAME.to_string(),
    };

    let identity = ensure_identity(key_id.clone(), None, vec![]).await?;
    let sender = identity.eth_address.clone();
    let nonce = get_nonce(sender.clone(), rpc_services.clone(), evm_rpc.clone()).await?;

    let burn_from_fn = Function {
        name: "burnFrom".to_string(),
        inputs: vec![
            Param {
                name: "from".to_string(),
                kind: ParamType::Address,
                internal_type: None,
            },
            Param {
                name: "amount".to_string(),
                kind: ParamType::Uint(256),
                internal_type: None,
            },
        ],
        outputs: vec![],
        constant: Some(false),
        state_mutability: StateMutability::NonPayable,
    };
    let data = burn_from_fn
        .encode_input(&[Token::Address(from_addr), Token::Uint(amount_u256)])
        .map_err(|e| format!("Failed to encode data: {}", e))?;

    let FeeEstimates {
        max_fee_per_gas,
        max_priority_fee_per_gas,
    } = estimate_transaction_fees(9, rpc_services.clone(), evm_rpc.clone()).await?;

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

    let signed_tx = sign_eip1559_transaction(tx, key_id, vec![]).await?;
    send_raw_transaction(signed_tx, rpc_services, evm_rpc).await
}

#[ic_cdk::update]
pub async fn verify_tx_receipt_with_validation(
    tx_hash: String,
    expected_from: String,
    expected_amount: String,
    expected_contract: String,
) -> Result<BurnValidation, String> {
    ensure_authorized()?;
    require_bridge_contract(&expected_contract)?;

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

    let expected_from_normalized = normalize_address(&expected_from)?;
    let contract_lower = BRIDGE_CONTRACT_ADDRESS.to_lowercase();

    match result {
        MultiGetTransactionReceiptResult::Consistent(receipt_result) => match receipt_result {
            GetTransactionReceiptResult::Ok(receipt_opt) => {
                let receipt = receipt_opt
                    .ok_or_else(|| "Transaction receipt not yet available.".to_string())?;

                for log in receipt.logs {
                    if log.address.to_lowercase() != contract_lower {
                        continue;
                    }

                    if log.topics.len() < 3 {
                        continue;
                    }

                    let from_topic = &log.topics[1];
                    let to_topic = &log.topics[2];

                    if from_topic.len() < 66 || to_topic.len() < 66 {
                        continue;
                    }

                    let from_suffix = &from_topic[from_topic.len() - 40..];
                    let to_suffix = &to_topic[to_topic.len() - 40..];

                    let from_candidate = normalize_address(&format!("0x{}", from_suffix))?;
                    let is_zero_address = to_suffix.chars().all(|c| c == '0');

                    if !is_zero_address || from_candidate != expected_from_normalized {
                        continue;
                    }

                    let data_hex = log.data.trim_start_matches("0x");
                    let amount_u256 =
                        U256::from_str_radix(if data_hex.is_empty() { "0" } else { data_hex }, 16)
                            .map_err(|e| format!("Failed to parse burn amount: {:?}", e))?;
                    let expected_amount_u256 = U256::from_dec_str(&expected_amount)
                        .map_err(|e| format!("Invalid expected amount: {:?}", e))?;

                    if amount_u256 != expected_amount_u256 {
                        continue;
                    }

                    return Ok(BurnValidation {
                        from: expected_from_normalized.clone(),
                        amount_wei: amount_u256.to_string(),
                        contract: contract_lower.clone(),
                    });
                }

                Err("Burn log with matching details not found.".to_string())
            }
            GetTransactionReceiptResult::Err(err) => Err(format!("Transaction error: {:?}", err)),
        },
        MultiGetTransactionReceiptResult::Inconsistent(_) => {
            Err("Inconsistent result from RPC".to_string())
        }
    }
}

ic_cdk::export_candid!();
