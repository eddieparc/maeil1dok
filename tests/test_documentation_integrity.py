import re
import subprocess
import unittest
import urllib.parse
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
MACHINE_PATH = re.compile(r"(?:file:///)?/Users/[^/]+/|[A-Za-z]:\\Users\\[^\\]+\\")


def repository_files() -> list[Path]:
    output = subprocess.check_output(
        ["git", "ls-files", "-co", "--exclude-standard"],
        cwd=REPO_ROOT,
        text=True,
    )
    return [REPO_ROOT / name for name in output.splitlines()]


class DocumentationIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repository_paths = repository_files()
        cls.markdown_files = [
            path
            for path in cls.repository_paths
            if path.suffix.lower() in {".md", ".mdx"} and path.is_file()
        ]

    def test_documentation_has_no_machine_specific_paths(self):
        violations = []
        for path in self.markdown_files:
            for line_number, line in enumerate(path.read_text().splitlines(), start=1):
                if MACHINE_PATH.search(line):
                    violations.append(f"{path.relative_to(REPO_ROOT)}:{line_number}")
        self.assertEqual([], violations)

    def test_active_documentation_local_links_exist(self):
        available = {path.resolve() for path in self.repository_paths if path.exists()}
        violations = []
        for path in self.markdown_files:
            for line_number, line in enumerate(path.read_text().splitlines(), start=1):
                for raw_target in MARKDOWN_LINK.findall(line):
                    target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
                    if target.startswith(("http://", "https://", "mailto:", "#", "data:", "/")):
                        continue
                    target = urllib.parse.unquote(target.split("#", maxsplit=1)[0])
                    if not target:
                        continue
                    resolved = (path.parent / target).resolve()
                    if resolved in available:
                        continue
                    if resolved.is_dir() and any(
                        candidate.is_relative_to(resolved) for candidate in available
                    ):
                        continue
                    violations.append(
                        f"{path.relative_to(REPO_ROOT)}:{line_number} -> {target}"
                    )
        self.assertEqual([], violations)


if __name__ == "__main__":
    unittest.main()
