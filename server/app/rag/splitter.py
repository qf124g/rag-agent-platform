from app.config import settings

# 切分时的分隔符优先级：尽量在段落/句子边界断开
_SEPARATORS = ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]


def split_text(text: str) -> list[str]:
    """递归字符切分：优先按自然边界切，超长块再降级到更细分隔符"""
    return _recursive_split(text, settings.chunk_size, settings.chunk_overlap)


def _recursive_split(text: str, chunk_size: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    # 找到当前文本中存在的优先级最高的分隔符
    separator = _SEPARATORS[-1]
    for sep in _SEPARATORS:
        if sep == "" or sep in text:
            separator = sep
            break

    splits = text.split(separator) if separator else list(text)
    return _merge_splits(splits, separator, chunk_size, overlap)


def _merge_splits(splits: list[str], separator: str, chunk_size: int, overlap: int) -> list[str]:
    """把小片段按长度上限合并成块，块间保留重叠窗口维持上下文连贯"""
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    sep_len = len(separator)

    for piece in splits:
        piece_len = len(piece)
        if current and current_len + piece_len + sep_len > chunk_size:
            chunks.append(separator.join(current))
            # 从尾部保留 overlap 长度的内容作为下一块开头
            while current and current_len > overlap:
                current_len -= len(current[0]) + sep_len
                current.pop(0)
        current.append(piece)
        current_len += piece_len + sep_len

    if current:
        chunks.append(separator.join(current))

    # 仍有超长块（单个词/段落超过 chunk_size）则强制硬切
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) > chunk_size:
            result.extend(chunk[i : i + chunk_size] for i in range(0, len(chunk), chunk_size - overlap))
        else:
            result.append(chunk)
    return [c for c in result if c.strip()]
