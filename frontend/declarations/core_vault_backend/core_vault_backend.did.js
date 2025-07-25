export const idlFactory = ({ IDL }) => {
  const ProposalStatus = IDL.Variant({
    'Approved' : IDL.Null,
    'Rejected' : IDL.Null,
    'Executed' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const ProposalAction = IDL.Variant({
    'CreateVault' : IDL.Record({ 'token_symbol' : IDL.Text }),
    'UpgradeVault' : IDL.Record({
      'new_code_hash' : IDL.Vec(IDL.Nat8),
      'vault_id' : IDL.Text,
    }),
  });
  const GovernanceProposal = IDL.Record({
    'id' : IDL.Nat64,
    'status' : ProposalStatus,
    'title' : IDL.Text,
    'action' : ProposalAction,
    'description' : IDL.Text,
    'deadline' : IDL.Nat64,
    'executed_vault_id' : IDL.Opt(IDL.Principal),
    'voters' : IDL.Vec(IDL.Principal),
    'proposer' : IDL.Principal,
    'votes_for' : IDL.Nat64,
    'votes_against' : IDL.Nat64,
  });
  return IDL.Service({
    'add_controller_to_vault' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text })],
        [],
      ),
    'execute_proposal' : IDL.Func(
        [IDL.Nat64],
        [IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : IDL.Text })],
        [],
      ),
    'get_proposal' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(GovernanceProposal)],
        ['query'],
      ),
    'list_created_vaults' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
    'list_proposals' : IDL.Func([], [IDL.Vec(GovernanceProposal)], ['query']),
    'submit_proposal' : IDL.Func(
        [
          IDL.Record({
            'title' : IDL.Text,
            'action' : ProposalAction,
            'description' : IDL.Text,
            'duration_secs' : IDL.Nat64,
          }),
        ],
        [IDL.Nat64],
        [],
      ),
    'vote_proposal' : IDL.Func(
        [IDL.Nat64, IDL.Bool],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
