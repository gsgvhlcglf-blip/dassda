import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('package_windows',ROOT/'scripts/package-windows.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PackageTests(unittest.TestCase):
    def test_clean_distribution_contains_bootstrap_and_no_private_or_linux_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive=module.package(Path(temporary)/'windows.zip')
            with zipfile.ZipFile(archive) as package:
                names=package.namelist()
                for required in ['1-KURULUM.cmd','2-BASLAT.cmd','3-YONETIM.cmd','windows/setup.ps1','scripts/local-server.mjs','public/images/hero.webp','.env.example','supabase/migrations/001_store.sql']:
                    self.assertIn('KUZMIN-Windows/'+required,names)
                for name in names:
                    parts=Path(name).parts
                    self.assertNotIn('..',parts)
                    self.assertFalse(any(p in parts for p in ['.data','.git','.next','node_modules','.runtime','uploads','__pycache__']))
                    self.assertFalse(Path(name).name.startswith('.env') and Path(name).name!='.env.example')
                self.assertIsNone(package.testzip())
                for name in ['1-KURULUM.cmd','2-BASLAT.cmd','3-YONETIM.cmd']:
                    data=package.read('KUZMIN-Windows/'+name)
                    self.assertIn(b'\r\n',data)
                    self.assertNotIn(b'\r\r\n',data)

if __name__=='__main__':unittest.main()
