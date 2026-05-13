from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules

hiddenimports = collect_submodules("torch")
datas = collect_data_files("torch")
binaries = collect_dynamic_libs("torch")
