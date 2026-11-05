# Centurion for DAILY DEOBF

## Current support

- **Centurion v6:** static AST extraction of `c3` factory functions. Output is stage-one/partial, not a complete runnable reconstruction.
- **Centurion v6.1:** detected but not supported by this adapter.

The original v6.1 implementation depends on a separate `sandbox-copy-luraph/harness.py` runtime and its companion frozen data. Those runtime files were not included in the supplied package. The current DAILY DEOBF adapter deliberately stops on v6.1; it does not import or execute that harness. Merely creating the folder or adding placeholder files will not enable the route. The genuine runtime implementation and its compatible dependencies must be integrated and tested before v6.1 can be enabled.

The v6 route uses the shared Luau AST binary in `luraph-v15-engine/bin`. Temporary AST inputs are created uniquely per run so concurrent Discord requests do not overwrite each other.

Generated Luau begins with the exact header `--deobf by daily deobf`.
