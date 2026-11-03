"""Build a clean, secret-free source distribution. Dependencies install on Windows."""
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TOP_LEVEL = ["1-KURULUM.cmd", "2-BASLAT.cmd", "3-YONETIM.cmd", "BASLAMADAN-ONCE.txt", "README.md", "AGENTS.md", ".env.example", ".gitignore", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "playwright.config.ts"]
DIRECTORIES = ["src", "scripts", "windows", "docs", "tests", "supabase", "public/images"]

def source_files():
    files = [ROOT / name for name in TOP_LEVEL]
    for directory in DIRECTORIES:
        files.extend(p for p in (ROOT / directory).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    icon = ROOT / "public/icon.svg"
    if icon.exists():
        files.append(icon)
    for file in files:
        if file.is_symlink() or not file.resolve().is_relative_to(ROOT):
            raise RuntimeError(f"Unsafe package path: {file.name}")
        if file.name.startswith(".env") and file.name != ".env.example":
            raise RuntimeError("Private environment file must not be packaged")
    return sorted(set(files))

def package(destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination,"w",zipfile.ZIP_DEFLATED) as archive:
        for file in source_files():
            archive.write(file, Path("KUZMIN-Windows") / file.relative_to(ROOT))
    return destination

if __name__ == "__main__":
    output = package(sys.argv[1] if len(sys.argv)>1 else ROOT.parent / "artifacts/KUZMIN-Windows.zip")
    print(f"Windows package created: {output} ({output.stat().st_size} bytes)")
