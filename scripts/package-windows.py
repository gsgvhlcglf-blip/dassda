"""Build a source-only local distribution; installation uses official, separately installed Node.js."""
from pathlib import Path
import sys
import zipfile

ROOT=Path(__file__).resolve().parent.parent
TOP_LEVEL=['BASLAMADAN-ONCE.txt','README.md','AGENTS.md','.env.example','.gitignore','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','playwright.config.ts']
DIRECTORIES=['src','scripts','docs','tests','supabase','database','public/images','quick-panel']
FORBIDDEN={'.cmd','.bat','.ps1','.vbs','.exe','.dll','.com','.scr','.msi','.pyc'}

def source_files():
    files=[ROOT/name for name in TOP_LEVEL]
    for directory in DIRECTORIES:
        files.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    icon=ROOT/'public/icon.svg'
    if icon.exists():files.append(icon)
    for file in files:
        if file.is_symlink() or not file.resolve().is_relative_to(ROOT):raise RuntimeError(f'Unsafe package path: {file.name}')
        if file.suffix.lower() in FORBIDDEN:raise RuntimeError(f'Windows executable wrapper must not be packaged: {file.name}')
        if file.name.startswith('.env') and file.name!='.env.example':raise RuntimeError('Private environment file must not be packaged')
    return sorted(set(files))

def package(destination):
    destination=Path(destination)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
        for file in source_files():archive.write(file,Path('KUZMIN-Yerel')/file.relative_to(ROOT))
    return destination

if __name__=='__main__':
    output=package(sys.argv[1] if len(sys.argv)>1 else ROOT.parent/'artifacts/KUZMIN-Kaynak.zip')
    print(f'Source package created: {output} ({output.stat().st_size} bytes)')
