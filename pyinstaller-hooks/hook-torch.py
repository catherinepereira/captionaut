"""Minimal torch hook for PyInstaller.

`collect_submodules("torch")` recursively imports the entire torch package
graph, which hangs the local build (high memory + slow). We enumerate only
the submodules Whisper / pyannote / Demucs actually touch at runtime and
let PyInstaller's static analysis pick up the rest by import chasing.
"""
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

datas = collect_data_files("torch")
binaries = collect_dynamic_libs("torch")

hiddenimports = [
    "torch",
    "torch._C",
    "torch._ops",
    "torch.nn",
    "torch.nn.functional",
    "torch.nn.modules",
    "torch.cuda",
    "torch.backends",
    "torch.backends.cudnn",
    "torch.backends.mkl",
    "torch.distributions",
    "torch.fft",
    "torch.serialization",
    "torch.utils",
    "torch.utils.data",
    "torch.jit",
]
