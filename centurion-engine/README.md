# Centurion for DAILY DEOBF

The Discord picker includes a Centurion option. The included driver implements the v6 static factory-extraction route and uses the existing shared Luau AST binary in `luraph-v15-engine/bin`.

Centurion v6.1 is fingerprinted separately, but the supplied ZIP did not contain the required sibling `sandbox-copy-luraph` runtime. The bot reports this dependency clearly instead of pretending that v6.1 completed.

Generated Luau begins with `-- deobf by daily deobf`. Centurion v6 output is deliberately labelled stage-one/partial because the VM imports and boot order are not reconstructed by the static factory extraction step.
