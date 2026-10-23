from pathlib import Path

from pypdf import PdfReader

# 支持的文档类型
SUPPORTED_SUFFIXES = {".txt", ".md", ".pdf"}


def extract_text(file_path: Path) -> str:
    """从文档中提取纯文本，支持 txt / md / pdf"""
    suffix = file_path.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise ValueError(f"不支持的文件类型: {suffix}，仅支持 {sorted(SUPPORTED_SUFFIXES)}")

    if suffix == ".pdf":
        reader = PdfReader(str(file_path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    return file_path.read_text(encoding="utf-8")
