#!/bin/bash

# Read the long hex string into a single line with no trailing newline
wasm=$(tr -d '\n' < wasm_hex.txt)

# Verify it's even-length
if (( ${#wasm} % 2 != 0 )); then
  echo "❌ Error: Hex string length is odd. Aborting."
  exit 1
fi

# Write the Candid argument file
cat > upgrade_args.did <<EOF
(
  "Upgrade Vault for Test",
  "Upgrading the for Test vault with new code",
  variant {
    UpgradeVault = record {
      vault_id = principal "osvil-vyaaa-aaaaj-qnsba-cai";
      wasm_hash = "$wasm"
    }
  }
)
EOF

echo "✅ upgrade_args.did successfully generated."
