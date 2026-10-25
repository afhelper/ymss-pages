"""ymss.kr의 활성 시그니처 목록을 signatures.json에 갱신합니다."""

import json
import os
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen


API_URL = "https://ymss.kr/api/signatures?is_active=1"
OUTPUT_PATH = Path(__file__).with_name("signatures.json")


def main():
    request = Request(
        API_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SigListUpdater/1.0)",
            "Referer": "https://ymss.kr/sig",
        },
    )

    with urlopen(request, timeout=30) as response:
        data = json.load(response)

    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("API 응답에 유효한 items 목록이 없습니다.")
    if not all(
        isinstance(item, dict)
        and isinstance(item.get("title"), str)
        and isinstance(item.get("unit_price"), (int, float))
        for item in items
    ):
        raise ValueError("API 항목의 형식이 예상과 다릅니다. 기존 파일은 그대로 유지합니다.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=OUTPUT_PATH.parent, delete=False
        ) as temp_file:
            temp_path = Path(temp_file.name)
            json.dump(data, temp_file, ensure_ascii=False, separators=(",", ":"))
            temp_file.write("\n")
        os.replace(temp_path, OUTPUT_PATH)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()

    print(f"갱신 완료: {len(items)}개 항목 → {OUTPUT_PATH.name}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(f"갱신 실패: {error}") from error
