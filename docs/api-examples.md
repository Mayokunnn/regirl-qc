# API cURL examples

## Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@regirl.local","password":"password123"}'
```

## Create draft session
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"styleId":"<STYLE_ID>","skuId":"<SKU_ID>","stylistName":"Amina"}'
```

## Request angle upload URL
```bash
curl -X POST http://localhost:3000/sessions/<SESSION_ID>/angles/front/upload-url \
  -H "Authorization: Bearer <TOKEN>"
```

## Submit session
```bash
curl -X POST http://localhost:3000/sessions/<SESSION_ID>/submit \
  -H "Authorization: Bearer <TOKEN>"
```
