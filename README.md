# Prompt Repository

가운데 큰 소개 박스인 `Thumbnail. Name. Prompt Copy.` 섹션을 제거한 버전입니다.
화면 구조는 다음과 같습니다.

1. 상단 로고 / 사이트명 / REFRESH / Sheet connected
2. 검색창 / 카테고리 필터
3. 카드 목록

## 구글시트 연결 유지 방법

기존 프로젝트의 `config.js` 파일에 있던 `SHEET_CSV_URL` 값을 새 `config.js`에 그대로 붙여넣으세요.

```js
window.SHEET_CSV_URL = "기존 구글시트 CSV 주소";
```

`SHEET_CSV_URL`이 비어 있으면 `google_sheet_template.csv` 샘플 데이터가 표시됩니다.

## 썸네일 이미지 넣는 방법

구글시트의 `thumbnail` 열에는 둘 중 하나를 넣으면 됩니다.

```txt
https://example.com/image.png
```

또는 Netlify에 올린 이미지 파일이면 다음처럼 넣습니다.

```txt
/images/00001.png
```

이 경우 프로젝트 안의 `images` 폴더에 `00001.png` 파일이 있어야 합니다.

## Netlify 배포

이 폴더 전체를 Netlify에 다시 드래그 앤 드롭하면 됩니다.
GitHub 연결 배포를 쓰고 있다면 이 파일들로 기존 파일을 교체한 뒤 push하면 됩니다.


## Category values

구글시트 `category` 열에는 아래 값 중 하나를 넣으면 됩니다.

- SLIDE
- PHOTO
- TRAVEL
- FOOD
- LIFE
- ETC

소문자로 `slide`, `photo`처럼 입력해도 사이트에서 자동으로 대문자 처리됩니다.
