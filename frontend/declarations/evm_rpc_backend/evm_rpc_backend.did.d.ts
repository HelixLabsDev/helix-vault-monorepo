import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface _SERVICE {
  'approve_erc20' : ActorMethod<
    [string, string, string],
    { 'ok' : string } |
      { 'err' : string }
  >,
  'get_canister_eth_address' : ActorMethod<[], string>,
  'mint' : ActorMethod<
    [string, string, string],
    { 'ok' : string } |
      { 'err' : string }
  >,
  'transfer_eth' : ActorMethod<
    [{ 'to' : string, 'gas' : [] | [bigint], 'value' : string }, bigint],
    { 'ok' : string } |
      { 'err' : string }
  >,
  'transfer_from_erc20' : ActorMethod<
    [string, string, string, string],
    { 'ok' : string } |
      { 'err' : string }
  >,
  'verify_tx_receipt_with_validation' : ActorMethod<
    [string, string, string, string],
    { 'ok' : string } |
      { 'err' : string }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
