# پراپرٹی بولی ایپ — Firebase جوڑنے کا طریقہ

پروجیکٹ **Property Auctions** (`property-auctions`) پہلے سے بن چکا ہے، اور ایپ کا کوڈ اس سے جڑ چکا ہے۔ اب باقی کام Firebase Console میں آپ کے Google اکاؤنٹ سے کرنا ہے، ورنہ ایپ ڈیٹا نہیں دکھا سکے گی۔

لائیو ایپ پر **مالک کا نام، شناختی کارڈ یا کاغذات** کبھی نہ ڈالیں۔ عوام کو صرف پراپرٹی کی بنیادی تفصیل، تصویریں / یوٹیوب ویڈیو، اور بولی نظر آتی ہے۔ بولی دینے والے کا پورا نام اور فون صرف آپ (ایڈمن) کو دکھتا ہے، عوام کو صرف چھپا ہوا نمبر نظر آتا ہے مثلاً `03xx-xxx-4492`۔

ایڈمن کا خفیہ لنک عوامی گائیڈ میں نہیں لکھا۔ وہ صرف `ADMIN-SECRET.txt` فائل میں ہے، اسے کسی کے ساتھ شیئر نہ کریں اور اسے GitHub پر اپ لوڈ نہ کریں۔

---

## 1. Firestore آن کریں

1. [Firebase Console](https://console.firebase.google.com/) کھولیں اور `teamworkcomplex@gmail.com` سے لاگ ان کریں۔
2. پروجیکٹ **Property Auctions** کھولیں۔
3. بائیں مینو میں **Build → Firestore Database** کھولیں۔
4. **Create database** دبائیں، **Start in production mode** منتخب کریں۔
5. Location کے لیے **asia-south1** (ممبئی) مناسب ہے۔ **Enable** کریں۔

---

## 2. Google سائن اِن آن کریں

1. **Build → Authentication → Get started** کھولیں۔
2. **Sign-in method** میں **Google** کو **Enable** کر کے Save کریں۔ Support email اپنے Gmail پر رکھیں۔
3. **Authentication → Settings → Authorized domains** میں یہ ڈومین شامل کریں (اگر پہلے سے نہ ہو):

   `teamworkcomplex-sudo.github.io`

4. مقامی طور پر فائل کھولنے سے Google سائن اِن عموماً نہیں چلتا۔ ایپ کو GitHub Pages یا کسی اور https لنک پر چلائیں۔

---

## 3. سکیورٹی رولز چسپاں کر کے Publish کریں

1. Firebase Console میں **Build → Firestore Database → Rules** کھولیں۔
2. اسی فولڈر کی فائل `firestore.rules` کا پورا متن کاپی کر کے خانے میں چسپاں کریں (پرانے رولز مٹا دیں)۔
3. **Publish** دبائیں۔

ان رولز سے:

- ایڈمن صرف وہ Google اکاؤنٹ ہے جس کا verified ای میل `teamworkcomplex@gmail.com` ہو
- پراپرٹی، تصویریں اور نیلامی بند کرنا صرف ایڈمن کر سکتا ہے
- لاگ ان صارف صرف اپنی بولی لگا سکتا ہے (رقم + تبادلے والی پراپرٹی)، اور بولی موجودہ اعلیٰ بولی + increment سے کم نہیں ہو سکتی
- کوئی بولی بدل یا مٹا نہیں سکتا
- `bidPrivate` (پورا نام اور فون) صرف ایڈمن پڑھ سکتا ہے

رولز Publish کیے بغیر ایپ خالی رہے گی یا "database is not ready" کا پیغام دکھا سکتی ہے۔

---

## 4. ایڈمن پینل کیسے کھلے گا

1. لائیو ایپ کھولیں، **Account** دبائیں، اور **Continue with Google** سے `teamworkcomplex@gmail.com` سے سائن اِن کریں۔
2. پھر `ADMIN-SECRET.txt` میں دیا گیا خفیہ لنک کھولیں۔
3. اگر کوئی اور یہی لنک کھولے، یا آپ دوسرے اکاؤنٹ سے سائن اِن ہوں، تو صرف عوامی ہوم پیج نظر آئے گا۔ پرانا مقامی پاس ورڈ اب استعمال نہیں ہوتا۔

اصل حفاظت Firebase Auth اور اوپر Publish کیے گئے رولز ہیں۔ خفیہ لنک صرف پینل چھپانے کے لیے ہے۔

---

## 5. پراپرٹی اور بولیاں

- پراپرٹی، تصویریں (زیادہ سے زیادہ 4، دبائی ہوئی JPEG) اور YouTube ویڈیو صرف آپ ایڈمن پینل سے ڈالیں گے۔
- تصویریں Firebase Storage پر نہیں جاتیں، اس لیے Storage کا ادا شدہ پلان درکار نہیں۔
- عام صارف بولی کے ساتھ اپنی تبادلے والی پراپرٹی کی تفصیل لکھتے ہیں۔
- سب کے فون پر ایک ہی لائیو ڈیٹا نظر آئے گا، پہلے کی طرح صرف ایک براؤزر میں نہیں رہے گا۔

---

## 6. لائیو لنک

ایپ اس وقت یہاں لگی ہوئی ہے (جب نیا کوڈ اپ ڈیٹ ہو جائے):

https://teamworkcomplex-sudo.github.io/propertyexchange/auction/

`#/property/...` والے لنک اسی ایپ میں کھلتے ہیں۔ صفحے کا عنوان اس پراپرٹی کے مطابق بدل جاتا ہے۔ Google یا WhatsApp ہیش لنک (`#/...`) کا الگ پریویو عموماً نہیں بناتے۔

---

## 7. چیک لسٹ

- [ ] Firestore Database بن گیا (production)
- [ ] Google sign-in Enable ہے
- [ ] Authorized domain: `teamworkcomplex-sudo.github.io`
- [ ] `firestore.rules` چسپاں کر کے **Publish** ہو گئے
- [ ] لائیو ایپ ریفریش کی، **No auctions yet** یا آپ کی پراپرٹیز نظر آئیں
- [ ] Account سے Google سائن اِن چلتا ہے
- [ ] `ADMIN-SECRET.txt` نجی رکھی، ریپو میں اپ لوڈ نہیں کی
