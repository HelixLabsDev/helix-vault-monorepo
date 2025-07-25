export const idlFactory = ({ IDL }) => {
  const result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const SharedProposalStatus = IDL.Variant({
    'Approved' : IDL.Null,
    'Executed' : IDL.Null,
    'Declined' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const SharedProposalAction = IDL.Variant({
    'CreateVault' : IDL.Record({
      'duration_secs' : IDL.Nat64,
      'token_type' : IDL.Text,
    }),
    'UpgradeVault' : IDL.Record({
      'vault_id' : IDL.Principal,
      'wasm_hash' : IDL.Text,
    }),
  });
  const SharedProposal = IDL.Record({
    'id' : IDL.Nat64,
    'status' : SharedProposalStatus,
    'title' : IDL.Text,
    'action' : SharedProposalAction,
    'description' : IDL.Text,
    'proposer' : IDL.Principal,
    'declines' : IDL.Vec(IDL.Principal),
    'approvals' : IDL.Vec(IDL.Principal),
  });
  return IDL.Service({
    'approve_proposal' : IDL.Func([IDL.Nat64], [result], []),
    'decline_proposal' : IDL.Func([IDL.Nat64], [result], []),
    'execute_proposal' : IDL.Func([IDL.Nat64], [result], []),
    'get_proposal' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(SharedProposal)],
        ['query'],
      ),
    'list_proposals' : IDL.Func([], [IDL.Vec(SharedProposal)], ['query']),
    'submit_proposal' : IDL.Func(
        [IDL.Text, IDL.Text, SharedProposalAction],
        [IDL.Nat64],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
