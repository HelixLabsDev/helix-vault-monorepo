import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface SharedProposal {
  'id' : bigint,
  'status' : SharedProposalStatus,
  'title' : string,
  'action' : SharedProposalAction,
  'description' : string,
  'proposer' : Principal,
  'declines' : Array<Principal>,
  'approvals' : Array<Principal>,
}
export type SharedProposalAction = {
    'CreateVault' : { 'duration_secs' : bigint, 'token_type' : string }
  } |
  { 'UpgradeVault' : { 'vault_id' : Principal, 'wasm_hash' : string } };
export type SharedProposalStatus = { 'Approved' : null } |
  { 'Executed' : null } |
  { 'Declined' : null } |
  { 'Pending' : null };
export type result = { 'ok' : null } |
  { 'err' : string };
export interface _SERVICE {
  'approve_proposal' : ActorMethod<[bigint], result>,
  'decline_proposal' : ActorMethod<[bigint], result>,
  'execute_proposal' : ActorMethod<[bigint], result>,
  'get_proposal' : ActorMethod<[bigint], [] | [SharedProposal]>,
  'list_proposals' : ActorMethod<[], Array<SharedProposal>>,
  'submit_proposal' : ActorMethod<
    [string, string, SharedProposalAction],
    bigint
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
