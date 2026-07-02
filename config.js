/*
  구글시트 CSV 연결 주소를 여기에 넣습니다.

  1) 구글시트를 '웹에 게시'한 경우 예시:
  window.SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/xxxx/pub?output=csv";

  2) 일반 구글시트 ID를 쓰는 경우 예시:
  window.SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/스프레드시트ID/gviz/tq?tqx=out:csv&gid=0";
*/
window.SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1BJC9LsaA_k57y0pMv4HyDcd-bpSrBGIeNDCK7jJjUx4/gviz/tq?tqx=out:csv&gid=0";

/*
  thumbnail 열에 /images/00001.png 또는 images/00001.png처럼 상대경로를 넣을 때의 기본 주소입니다.
  비워두면 현재 Netlify 사이트 기준으로 자동 처리됩니다.
*/
window.IMAGE_BASE_URL = "";

/*
  SHEET_CSV_URL이 비어 있거나 구글시트 연결에 실패하면 샘플 CSV를 보여줍니다.
*/
window.LOCAL_FALLBACK_CSV = "./google_sheet_template.csv";
