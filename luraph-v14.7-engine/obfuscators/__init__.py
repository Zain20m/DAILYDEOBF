"""Luraph-only registry used by the v15 frontend.

The v14.7, v14.8, and v14.9 engines are loaded directly by cli.py.
"""
from obfuscators.base import Obfuscator, Job  # noqa: F401
from obfuscators.luraph_v15 import LuraphV15

PLUGINS = [LuraphV15()]
MIN_CONFIDENCE = 0.5


def by_name(name):
    for plugin in PLUGINS:
        if plugin.name == name:
            return plugin
    raise KeyError("unknown obfuscator %r (known: %s)" % (name, ", ".join(p.name for p in PLUGINS)))


def scores(source):
    """Return confidence/plugin pairs, highest confidence first."""
    result = []
    for plugin in PLUGINS:
        try:
            confidence = plugin.detect(source)
        except Exception:  # noqa: BLE001
            confidence = 0.0
        result.append((confidence, plugin))
    return sorted(result, key=lambda pair: -pair[0])


def detect(source):
    """Return the best Luraph plugin and confidence for `source`."""
    confidence, plugin = scores(source)[0]
    return plugin, confidence
