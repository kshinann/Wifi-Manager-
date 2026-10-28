# PyInstaller spec: builds a single-file aiguard-agent executable.
#   cd agent && pip install pyinstaller psutil
#   pyinstaller --distpath dist packaging/aiguard-agent.spec
# Build on Windows for the .exe and on macOS for the Mac binary (PyInstaller does not cross-compile).
import os

root = os.path.abspath(os.path.join(SPECPATH, ".."))
a = Analysis([os.path.join(SPECPATH, "entry.py")], pathex=[root],
             hiddenimports=["aiguard_agent.monitors.process", "aiguard_agent.monitors.network",
                            "aiguard_agent.local_api", "aiguard_agent.service"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, name="aiguard-agent", console=True, upx=False)
