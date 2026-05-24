# 🚀 دليل تشغيل نظام Firebase - ksa2030.one

# 💎 نظام الاشتراك: 30 ريال مرة واحدة = مدى الحياة

-----

## 📦 الملفات الجديدة

|الملف               |الوصف                                    |
|--------------------|-----------------------------------------|
|`firebase-config.js`|القلب - إعدادات + كل الوظائف             |
|`login.html`        |صفحة تسجيل الدخول (جوال + إيميل + Google)|
|`profile.html`      |الملف الشخصي + زر الاشتراك (30 ريال)     |
|`migrate-users.html`|نقل الـ18 مشترك القديم                   |
|`admin.html`        |لوحة الإدارة (للتفعيل اليدوي)            |
|`upgrade-modal.js`  |مودال الاشتراك المشترك                   |
|`firestore.rules`   |قواعد الحماية                            |

-----

## 🎯 الخطوات بالترتيب

### الخطوة 1️⃣ - تطبيق Security Rules

🔗 Firebase Console → **Firestore Database** → **Rules**

افتح `firestore.rules` → انسخ من `rules_version = '2';` حتى آخر `}` الأخيرة → الصقه في Firebase → **Publish**

-----

### الخطوة 2️⃣ - رفع الملفات على ksa2030.one

```
✅ firebase-config.js
✅ upgrade-modal.js
✅ login.html
✅ profile.html
✅ admin.html
✅ migrate-users.html (احذفه بعد الاستخدام)
```

-----

### الخطوة 3️⃣ - نقل المشتركين الـ18

افتح في المتصفح:

```
https://ksa2030.one/migrate-users.html
```

اضغط **🚀 بدء النقل - كلهم Lifetime 💎**

⏳ انتظر 30 ثانية → كل الـ18 يصيرون Lifetime تلقائياً

⚠️ **بعد النجاح، احذف `migrate-users.html` من السيرفر فوراً**

-----

### الخطوة 4️⃣ - تفعيل صلاحيات الأدمن (مهم!)

#### أ) سجّل دخول كأدمن

افتح `https://ksa2030.one/login.html` وسجّل بإيميلك الشخصي

#### ب) احصل على UID

1. افتح Firebase Console → Authentication → Users
1. ابحث عن إيميلك
1. انسخ الـ **User UID** (مثل: `aBcDeF123XyZ...`)

#### ج) أضف UID في firebase-config.js

افتح `firebase-config.js` وابحث عن:

```javascript
const ADMIN_UIDS = [
  // ضع UID حسابك هنا بعد التسجيل
];
```

غيّرها لـ:

```javascript
const ADMIN_UIDS = [
  'aBcDeF123XyZ...'  // UID حسابك
];
```

ارفع الملف المعدّل للموقع.

#### د) جرّب admin.html

```
https://ksa2030.one/admin.html
```

لازم تشوف لوحة الإدارة الآن ✅

-----

## 🎬 كيف يعمل النظام كاملاً

### للمستخدم الجديد:

```
1. يفتح ksa2030.one
2. يضغط "تسجيل دخول"
3. يسجّل بجواله + OTP
4. يدخل المنصة + يشوف 15 تقرير
5. يحمّل تقريرين (مجاناً)
6. يحاول ثالث → 🔒 مودال "اشترك بـ 30 ريال مدى الحياة"
7. يضغط زر WhatsApp → يكلّمك
8. أنت تستلم: "معرّف الحساب: aBc12345"
9. تفتح admin.html → تبحث عنه → تضغط "✨ تفعيل Lifetime"
10. ✅ مفعّل فوراً - يحمّل بلا حدود
```

### للمشترك القديم (بعد النقل):

```
1. يفتح ksa2030.one/login.html
2. يختار "إيميل"
3. الإيميل: 0501234567@phone.ksa2030.one
4. كلمة السر: 1234 (القديمة)
5. ✅ يدخل ويحمّل بلا حدود (Lifetime مفعّل)
```

-----

## 💰 حساب الأرباح المتوقع

|المشتركون |الإيراد (30 ريال × عدد)|
|----------|-----------------------|
|50 مشترك  |**1,500 ريال**         |
|100 مشترك |**3,000 ريال**         |
|500 مشترك |**15,000 ريال**        |
|1000 مشترك|**30,000 ريال**        |
|5000 مشترك|**150,000 ريال**       |

**كل شي ربح صافي** (التكلفة: Firebase مجاناً تحت 10K SMS) 🚀

-----

## 📊 بنية البيانات في Firestore

```
firestore/
  └─ users/
       └─ {uid}/
            ├─ uid: "abc123..."
            ├─ phoneNumber: "+966501234567"
            ├─ email: "0501234567@phone.ksa2030.one"
            ├─ displayName: "أحمد محمد"
            ├─ plan: "lifetime" | "free"
            ├─ activatedAt: Timestamp  (متى تفعّل)
            ├─ downloadsUsed: 12
            ├─ downloadsLimit: 999999 (Lifetime) أو 2 (Free)
            ├─ createdAt: Timestamp
            ├─ lastLoginAt: Timestamp
            └─ migratedFromLegacy: true (للمنقولين)
```

-----

## 🛡️ الأمان

### ✅ آمن 100%:

- المستخدم لا يقدر يصير Lifetime من نفسه
- Security Rules تمنع التلاعب
- كل تفعيل يمر منك يدوياً

### ⚠️ مهم:

1. **احذف migrate-users.html** بعد النقل
1. **لا تشارك ملف admin.html** علناً (لكنه محمي - بدون UID صحيح ما يفتح)
1. **ضع Budget Alert $5** في Firebase

-----

## 🔄 المرحلة التالية (بعد ما تختبر هذي)

سأبني:

- ✅ تحديث `index.html` للتكامل مع Firebase
- ✅ تحديث كل التقارير (10 ملفات) لاستخدام `upgrade-modal.js`
- ✅ زر “تسجيل دخول” في الهيدر الرئيسي
- ✅ مزامنة بيانات التقارير بين الأجهزة

-----

## 🆘 استكشاف الأخطاء

### “Operation not allowed”

✅ تأكد فعّلت Email/Password في Authentication

### “Permission denied” في admin.html

✅ تأكد أضفت UID في ADMIN_UIDS

### Migration script يفشل

✅ تأكد Email/Password مفعّل
✅ شغّله من ksa2030.one (مش من file://)

### مستخدم منقول ما يقدر يدخل

✅ الإيميل: `رقمه@phone.ksa2030.one`
✅ كلمة السر: 1234 (أو ما كان معاه قديماً)

-----

## 📞 الخطوة التالية

بعد ما:

1. ✅ تطبّق Security Rules
1. ✅ ترفع الملفات الجديدة
1. ✅ تنقل الـ18 مشترك
1. ✅ تضيف UID حسابك في ADMIN_UIDS
1. ✅ تجرّب admin.html

**ارجع لي وقولّي “تم”** وأبدأ المرحلة 2:

- تحديث index.html
- تحديث كل التقارير
- ربط نظام التحميل بـ Firebase

🚀💚