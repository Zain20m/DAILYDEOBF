"""v14 pipeline: shared harness + v14 lifter quirks."""

def lift(job, runner, patched, cfg, chunks, run_text, ppath, dpath, chunk_paths):
    import obfuscators.luraph_v15.driver as driver15
    import obfuscators.luraph_v14.devirt as devirt14
    import obfuscators.luraph_v15.devirt as devirt15

    saved = {}
    for name in ("run_big_stack", "lift_program", "collect_requests", "same_patches", "WalkCache"):
        if hasattr(devirt14, name):
            saved[name] = getattr(devirt15, name, None)
            setattr(devirt15, name, getattr(devirt14, name))
    try:
        return driver15.lift(job, runner, patched, cfg, chunks, run_text, ppath, dpath, chunk_paths)
    finally:
        for name, val in saved.items():
            if val is None:
                try:
                    delattr(devirt15, name)
                except Exception:
                    pass
            else:
                setattr(devirt15, name, val)
