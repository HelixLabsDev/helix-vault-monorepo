export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'approve_erc20' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text })],
        [],
      ),
    'get_canister_eth_address' : IDL.Func([], [IDL.Text], []),
    'mint' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text })],
        [],
      ),
    'transfer_eth' : IDL.Func(
        [
          IDL.Record({
            'to' : IDL.Text,
            'gas' : IDL.Opt(IDL.Nat64),
            'value' : IDL.Text,
          }),
          IDL.Nat64,
        ],
        [IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text })],
        [],
      ),
    'transfer_from_erc20' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text],
        [IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text })],
        [],
      ),
    'verify_tx_receipt_with_validation' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text],
        [IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
