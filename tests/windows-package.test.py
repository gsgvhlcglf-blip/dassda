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
    def test_source_distribution_excludes_executable_wrappers_and_private_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive=module.package(Path(temporary)/'source.zip')
            with zipfile.ZipFile(archive) as package:
                names=package.namelist()
                for required in ['scripts/local-install.mjs','scripts/read-secret.mjs','scripts/local-server.mjs','public/images/hero.webp','.env.example','supabase/migrations/001_store.sql']:
                    self.assertIn('KUZMIN-Yerel/'+required,names)
                for name in names:
                    parts=Path(name).parts
                    self.assertNotIn('..',parts)
                    self.assertFalse(any(p in parts for p in ['.data','.git','.next','node_modules','.runtime','uploads','__pycache__']))
                    self.assertFalse(Path(name).name.startswith('.env') and Path(name).name!='.env.example')
                    self.assertNotIn(Path(name).suffix.lower(),module.FORBIDDEN)
                self.assertIsNone(package.testzip())
if __name__=='__main__':unittest.main()
