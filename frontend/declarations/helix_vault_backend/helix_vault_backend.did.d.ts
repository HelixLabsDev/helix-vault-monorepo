import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type ResultText = { 'Ok' : string } |
  { 'Err' : string };
export interface _SERVICE {
  'deposit_icrc1' : ActorMethod<[bigint, string], ResultText>,
  'get_transfer_fee' : ActorMethod<[], bigint>,
  'get_user_balance' : ActorMethod<[Principal], bigint>,
  'get_vault_balance' : ActorMethod<[], bigint>,
  'sync_state' : ActorMethod<[], ResultText>,
  'unlock_icrc1' : ActorMethod<
    [string, string, string, bigint, string],
    ResultText
  >,
  'withdraw_icrc1' : ActorMethod<[bigint], ResultText>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
