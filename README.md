# 쿠팡 광고 분석기

쿠팡 광고 보고서를 브라우저에서 분석하는 정적 웹앱입니다. XLSX/XLS/CSV 업로드와 RAW 붙여넣기를 지원하며 데이터는 외부 서버로 전송되지 않고 브라우저에 저장됩니다.

## 실행

```bash
npm install
npm run dev
```

## 지원 분석

- 대시보드와 광고비, 매출, 주문, ROAS, CPA, 예상 순이익, 유입 추정
- 누수/효자 키워드와 상품/지면/행별 진단
- 상품 마스터 및 수익 계산 기준 설정

GitHub Pages 배포는 `.github/workflows/deploy-pages.yml`에서 자동으로 수행합니다.
