# Centurion for DAILY DEOBF

## Current support

- **Centurion v6:** static AST extraction supports both the `c3` factory-table layout and the alternate returned-table layout used by the `Centurion v6.0 sample 1` fixture. Output is stage-one/partial, not a complete runnable reconstruction.
- **Centurion v6.1:** detected but not supported by this adapter.

The original v6.1 implementation depends on a separate `sandbox-copy-luraph/harness.py` runtime and its companion frozen data. Those runtime files were not included in the supplied package. The current DAILY DEOBF adapter deliberately stops on v6.1; it does not import or execute that harness. Merely creating the folder or adding placeholder files will not enable the route. The genuine runtime implementation and its compatible dependencies must be integrated and tested before v6.1 can be enabled.

The v6 routes use the shared Luau AST binary in `luraph-v15-engine/bin`. The returned-table adapter extracts direct function values from the top-level returned array table; it does not claim to reconstruct the VM boot sequence or produce a complete runnable script. Temporary AST inputs are created uniquely per run so concurrent Discord requests do not overwrite each other.

Generated Luau begins with the exact header `--deobf by daily deobf`.
