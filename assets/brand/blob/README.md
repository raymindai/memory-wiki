# MW Blob Morph

`mwblob_morph.svg` — 11개 블롭(`mwblob_01.svg` … `mwblob_11.svg`)이 Flubber로
vertex-to-vertex 보간된 SMIL 애니메이션 SVG. `<img>` 태그/`<object>` 모두 작동.

- viewBox: `0 0 220 200`, 각 블롭의 viewBox 중심을 (110, 100)에 정렬
- 듀레이션: 22초, 무한 루프 (블롭당 약 2초)
- 색은 CSS 변수 `--mw-blob` 로 외부에서 덮어쓰기 가능 (기본 `#fff`)

## Build

블롭 SVG를 추가/수정하거나 모핑 파라미터를 조정한 후 재생성:

```bash
cd /tmp/blob-morph        # or any scratch dir
npm install flubber svgpath
node /path/to/build-morph.mjs /path/to/output.svg
```

블롭 데이터(viewBox + subpath 좌표)는 `build-morph.mjs` 안에 인라인.
새 블롭을 더하려면 `blobs` 배열에 같은 형식으로 추가하면 됨.

## Tuning

- `FRAMES_PER_PAIR` (기본 8): 블롭 사이 샘플 수. 늘리면 모핑이 더 부드럽지만 파일 큼.
- `MAX_SEG` (기본 12): 곡선 리샘플 간격. 작을수록 정밀, 파일 큼.
- `DURATION` (기본 22초): 한 사이클 길이.

현재 출력: 89 프레임, ~300 KB.
