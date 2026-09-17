# FastImageAnnotator

FastStone Image Viewer 스타일의 이미지 뷰어 + 간단 주석 편집기입니다. 폴더 안의 사진들을 빠르게 훑어보면서 텍스트/도형 주석을 추가하고, 원본 덮어쓰기 또는 별도 파일로 저장할 수 있는 Windows 데스크톱 프로그램입니다.

## 주요 기능

- **폴더 탐색 + 반응형 썸네일 그리드** — 아이콘 크기(작게~가장 큰 아이콘) 선택 가능, 마지막 사용한 크기와 마지막으로 연 폴더 위치를 기억
- **주석 편집** — 텍스트, 원, 사각형, 화살표 그리기, 색상·선 굵기·글자 크기 조절 (마지막 값 자동 저장)
- **일관된 해상도** — 원본 사진 크기와 무관하게 1600x1200 고정 캔버스에서 편집·저장되어, 폴더 안 사진 해상도가 제각각이어도 주석 크기가 일정하게 유지됨
- **되돌리기(Undo) / Delete 키 삭제**
- **회전, 개별 사진 초기화**
- **선택 이미지만 저장 / 전체 저장**, 각각 원본 덮어쓰기 또는 `_edited` 별도 파일로 저장 선택 가능
- 다른 프로그램(zip 경로를 인자로 실행)에서 특정 폴더를 열어달라고 요청하면 자동으로 그 폴더를 여는 연동 기능

## 실행 방법

### 설치 파일로 실행 (일반 사용자)

[Releases](../../releases) 페이지에서 최신 `FastImageAnnotator Setup *.exe`를 내려받아 실행하세요. Windows SmartScreen 경고가 뜨면 "추가 정보 → 실행"을 선택하면 됩니다 (코드 서명이 없는 개인 배포 앱이라 뜨는 정상적인 경고입니다).

### 소스에서 직접 실행 (개발자)

```bash
npm install
npm run dev      # 개발 모드로 Electron 앱 실행
npm run dist     # Windows 설치 파일(NSIS) 빌드 -> release/ 폴더
```

## 기술 스택

- Electron + React + Vite
- [fabric.js](http://fabricjs.com/) — 이미지 위 주석 캔버스
- Zustand — 상태 관리 (아이콘 크기·도구 설정 등은 `localStorage`에 자동 저장)
- electron-store — 창 크기/위치, 마지막으로 연 폴더 기억

## 폴더 구조

```
electron/     Electron 메인 프로세스 (창 관리, 파일 시스템 IPC, media:// 프로토콜)
src/
  components/ Sidebar(폴더+썸네일), Viewer(주석 캔버스+툴바), TopBar, StatusBar
  store/      zustand 스토어 (탐색기 상태, 주석 데이터, 도구 설정)
  utils/      이미지 합성/저장, 도형 생성 유틸
```

## 참고 사항

- 지원 이미지 포맷: jpg, jpeg, png, gif, webp, bmp
- 압축을 풀어서 나온 일반 폴더도 동일하게 탐색 가능합니다 (별도의 zip 처리 기능은 없습니다)
- 로그 파일이나 원격 서버 통신은 없습니다 — 완전히 로컬에서 동작하는 프로그램입니다

## License

MIT
