# پراپرٹی بولی ایپ — آن لائن لگانے کا طریقہ

یہ پیش نظارہ (preview) ابھی آپ کے کمپیوٹر پر آف لائن چلتی ہے۔ ڈیٹا صرف اسی براؤزر میں رہتا ہے۔ جب آپ ایپ کو لوگوں کے لیے آن لائن کھولنا چاہیں، نیچے والا طریقہ اپنائیں۔ اس گائیڈ میں کوئی اکاؤنٹ آپ کے لیے نہیں بنایا گیا۔

لائیو ایپ پر **مالک کا نام، شناختی کارڈ یا کاغذات** کبھی نہ ڈالیں — عوامی بولی میں صرف پراپرٹی کی بنیادی تفصیل اور بولی دکھائیں۔

---

## 1. مفت Firebase پروجیکٹ بنائیں

1. براؤزر میں [https://console.firebase.google.com](https://console.firebase.google.com) کھولیں اور اپنے Google اکاؤنٹ سے لاگ ان کریں۔
2. **Add project** دبائیں، نام رکھیں مثلاً `twc-property-auction`۔
3. Google Analytics کو بند رکھ سکتے ہیں۔ **Create project** دبائیں۔

---

## 2. Firestore آن کریں

1. بائیں مینو میں **Build → Firestore Database** کھولیں۔
2. **Create database** دبائیں، **Start in production mode** منتخب کریں۔
3. Location کے لیے **asia-south1** (ممبئی) مناسب ہے۔ **Enable** کریں۔

---

## 3. فون لاگ ان (Phone Authentication) آن کریں

1. **Build → Authentication → Get started** کھولیں۔
2. **Sign-in method** میں **Phone** کو **Enable** کر کے Save کریں۔
3. شروع میں **Phone → Phone numbers for testing** میں اپنے ٹیسٹ نمبرز ڈال سکتے ہیں، تاکہ اصلی SMS نہ جائے۔

**نوٹ:** اصل SMS بھیجنے کے لیے بعد میں Google Blaze (بلنگ) اکاؤنٹ درکار ہو سکتا ہے۔ ٹیسٹ نمبرز مفت رہتے ہیں۔

---

## 4. سکیورٹی رولز — صرف ایک ایڈمن (ضرور لگائیں)

Firestore میں **Rules** ٹیپ کھولیں، نیچے والا متن مکمل چسپاں کر کے **Publish** کریں۔

ایڈمن صرف آپ ہوں گے۔ طریقہ:

1. Authentication میں اپنے فون نمبر سے ایک بار لاگ ان کریں۔
2. اس یوزر کا **UID** کاپی کریں۔
3. نیچے رولز میں `PASTE_YOUR_ADMIN_UID_HERE` کی جگہ وہی UID لکھیں۔
4. وہی UID `index.html` میں `ADMIN_UID` پر بھی چسپاں کریں۔

ان رولز سے:

- پراپرٹی صرف اس ایک ایڈمن UID سے ڈالی، بدلائی یا مٹائی جا سکتی ہے
- عام لاگ ان صارف صرف نئی بولی لگا سکتا ہے (رقم + اپنی تبادلے والی پراپرٹی کی تفصیل)
- کوئی بھی بولی بدل یا مٹا نہیں سکتا
- پیش نظارہ کا PIN `1234` لائیو سائٹ پر کبھی استعمال نہ کریں — اصلی سکیورٹی یہ Firebase رولز ہیں

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn()
        && request.auth.uid == 'PASTE_YOUR_ADMIN_UID_HERE';
    }

    match /properties/{id} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /bids/{id} {
      allow read: if true;
      allow create: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.amount is number
        && request.resource.data.amount > 0
        && request.resource.data.propertyId is string;
      allow update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Config ایپ میں چسپاں کریں

1. Firebase میں ⚙️ **Project settings → Your apps → Web** (`</>`) سے ایک ویب ایپ رجسٹر کریں۔
2. جو `firebaseConfig` ملے، اسے `index.html` میں `FIREBASE CONFIG PLACEHOLDER` والی جگہ پر پیسٹ کریں۔
3. اسی فائل میں `USE_FIREBASE` کو `true` کر دیں، `ADMIN_UID` میں اپنا Firebase UID لکھیں، اور پھر Firebase والے ڈیٹا فنکشنز (Firestore + Phone Auth) جوڑیں۔ فی الحال ایپ لوکل ڈیمو پر چلتی ہے۔ ایڈمن فہرست میں کئی تصویریں اور YouTube لنک (watch، youtu.be، Shorts، embed) ڈال سکتا ہے؛ دوسرے لوگ صرف بولی اور اپنی تبادلے والی پراپرٹی کی تفصیل دے سکتے ہیں۔

---

## 6. GitHub Pages پر اپ لوڈ کریں

1. [https://github.com](https://github.com) پر `teamworkcomplex-sudo` سے لاگ ان کریں۔
2. **New repository** بنائیں، نام رکھیں: `propertyauction`، اسے **Public** رکھیں۔
3. `index.html` (اور چاہیں تو یہ گائیڈ) اس ریپو میں اپ لوڈ کریں۔ فائل ریپو کے روٹ (سب سے اوپر) پر ہونی چاہیے۔
4. **Settings → Pages** کھولیں، **Deploy from a branch** منتخب کریں، برانچ `main`، فولڈر `/ (root)`، پھر **Save** کریں۔
5. چند منٹ بعد ایپ اس لنک پر کھلے گی:

**https://teamworkcomplex-sudo.github.io/propertyauction**

لوگ یہی لنک موبائل پر کھول کر بولی دے سکیں گے۔

---

## 7. مفت پلان کی حد

Firebase Spark (مفت) پلان پر روزانہ پڑھائی اور لکھائی کی حد ہوتی ہے۔ چھوٹے ہفتہ وار ایونٹ کے لیے عام طور پر کافی ہے۔ اگر ایک ساتھ بہت سے لوگ بولی دیں تو حد پوری ہو سکتی ہے — Console میں **Usage** دیکھتے رہیں۔ فون Auth کے اصلی SMS بعد میں الگ سے چارج ہو سکتے ہیں۔ GitHub Pages چھوٹی سٹیٹک ویب ایپ کے لیے مفت ہے۔

---

## 8. بعد میں Play Store یا APK (اختیاری)

- **APK / براہِ راست انسٹال:** اس ویب ایپ کو بعد میں Capacitor یا Trusted Web Activity سے APK بنا کر WhatsApp یا اپنی ویب سائٹ سے دیا جا سکتا ہے — اس پر Google کی فیس نہیں۔
- **Play Store:** Google Play Console اکاؤنٹ کی **ایک بار کی فیس 25 ڈالر** ہے۔ پھر ایپ پبلش کی جا سکتی ہے۔ نئے ذاتی اکاؤنٹ پر پہلے تھوڑی بند ٹیسٹنگ درکار ہوتی ہے۔

آن لائن کرنے سے پہلے پاس ورڈ، PIN اور Firebase رولز ضرور چیک کریں۔ اس پیش نظارہ کا PIN `1234` صرف ڈیمو کے لیے ہے، لائیو سائٹ پر کبھی استعمال نہ کریں۔
