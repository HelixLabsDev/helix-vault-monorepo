import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface GovernanceProposal {
  'id' : bigint,
  'status' : ProposalStatus,
  'title' : string,
  'action' : ProposalAction,
  'description' : string,
  'deadline' : bigint,
  'executed_vault_id' : [] | [Principal],
  'voters' : Array<Principal>,
  'proposer' : Principal,
  'votes_for' : bigint,
  'votes_against' : bigint,
}
export type ProposalAction = { 'CreateVault' : { 'token_symbol' : string } } |
  {
    'UpgradeVault' : {
      'new_code_hash' : Uint8Array | number[],
      'vault_id' : string,
    }
  };
export type ProposalStatus = { 'Approved' : null } |
  { 'Rejected' : null } |
  { 'Executed' : null } |
  { 'Pending' : null };
export interface _SERVICE {
  'add_controller_to_vault' : ActorMethod<
    [Principal, Principal],
    { 'ok' : null } |
      { 'err' : string }
  >,
  'execute_proposal' : ActorMethod<
    [bigint],
    { 'Ok' : Principal } |
      { 'Err' : string }
  >,
  'get_proposal' : ActorMethod<[bigint], [] | [GovernanceProposal]>,
  'list_created_vaults' : ActorMethod<[], Array<Principal>>,
  'list_proposals' : ActorMethod<[], Array<GovernanceProposal>>,
  'submit_proposal' : ActorMethod<
    [
      {
        'title' : string,
        'action' : ProposalAction,
        'description' : string,
        'duration_secs' : bigint,
      },
    ],
    bigint
  >,
  'vote_proposal' : ActorMethod<
    [bigint, boolean],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
