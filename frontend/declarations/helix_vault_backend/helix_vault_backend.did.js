export const idlFactory = ({ IDL }) => {
  const ResultText = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  return IDL.Service({
    'deposit_icrc1' : IDL.Func([IDL.Nat, IDL.Text], [ResultText], []),
    'get_transfer_fee' : IDL.Func([], [IDL.Nat], ['query']),
    'get_user_balance' : IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
    'get_vault_balance' : IDL.Func([], [IDL.Nat], ['query']),
    'sync_state' : IDL.Func([], [ResultText], []),
    'unlock_icrc1' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Nat, IDL.Text],
        [ResultText],
        [],
      ),
    'withdraw_icrc1' : IDL.Func([IDL.Nat], [ResultText], []),
  });
};
export const init = ({ IDL }) => { return []; };
