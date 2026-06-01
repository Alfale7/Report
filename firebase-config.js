// ═══════════════════════════════════════════════════════════
// 🔥 Firebase Config - ksa2030.one
// ═══════════════════════════════════════════════════════════
// نظام الاشتراك: مرة واحدة 30 ريال = مدى الحياة (Lifetime)
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ═══ Config ═══
const firebaseConfig = {
  apiKey: "AIzaSyAtLYfxOXcAyLbkXsMZLhhxS5Z80HUvrRE",
  authDomain: "ksa2030-reports.firebaseapp.com",
  projectId: "ksa2030-reports",
  storageBucket: "ksa2030-reports.firebasestorage.app",
  messagingSenderId: "225178284318",
  appId: "1:225178284318:web:edf7873a90859d1358590f",
  measurementId: "G-PMV1MTQDFX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ═══ ثوابت الموقع ═══
export const SITE_CONFIG = {
  PRICE: 30,
  CURRENCY: 'ريال',
  PLAN_TYPE: 'lifetime',
  FREE_DOWNLOADS_LIMIT: 2,
  WHATSAPP_NUMBER: '966550522867',
  WHATSAPP_MESSAGE: 'السلام عليكم، أرغب في الاشتراك بمنصة التقارير'
};

// ═══ المصادقة ═══

export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user, { authMethod: 'google' });
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

export async function registerWithEmail(email, password, extra = {}) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(result.user, { authMethod: 'email', ...extra });
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

// ═══════════════════════════════════════════════════════════
// 📱 دخول بالجوال: نبحث في Firestore عن الإيميل المرتبط بالجوال
//    ثم نسجّل دخول Firebase العادي
// ═══════════════════════════════════════════════════════════
export async function loginWithPhone(phone, password) {
  try {
    // تنظيف رقم الجوال
    let cleanPhone = phone.replace(/\s/g, '').replace(/^\+966/, '0').replace(/^966/, '0');
    if (!cleanPhone.startsWith('05')) cleanPhone = '0' + cleanPhone;
    
    if (!/^05\d{8}$/.test(cleanPhone)) {
      return { success: false, error: 'رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05' };
    }

    // ابحث في collection users عن المستخدم بهذا الرقم
    // نبحث في 3 حقول محتملة: phone, legacyPhone, phoneNumber
    const usersRef = collection(db, 'users');
    
    // نبحث أولاً في الحقل الجديد phone
    let snap = await getDocs(query(usersRef, where('phone', '==', cleanPhone), limit(1)));
    
    // إذا ما حصلنا، نبحث في legacyPhone
    if (snap.empty) {
      snap = await getDocs(query(usersRef, where('legacyPhone', '==', cleanPhone), limit(1)));
    }
    
    // إذا ما حصلنا، نبحث في phoneNumber
    if (snap.empty) {
      snap = await getDocs(query(usersRef, where('phoneNumber', '==', cleanPhone), limit(1)));
    }

    if (snap.empty) {
      return { success: false, error: 'لا يوجد حساب بهذا الرقم. سجّل حساب جديد أولاً.' };
    }

    // وجدنا المستخدم - نأخذ إيميله
    const userData = snap.docs[0].data();
    const userEmail = userData.email;

    if (!userEmail) {
      return { success: false, error: 'لا يوجد إيميل مرتبط بهذا الرقم' };
    }

    // سجّل دخول بالإيميل + كلمة المرور
    const result = await signInWithEmailAndPassword(auth, userEmail, password);
    await ensureUserDoc(result.user, { authMethod: 'phone' });
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

export async function sendPhoneOTP(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
  try {
    let formatted = phoneNumber.trim().replace(/\s/g, '');
    if (formatted.startsWith('05')) {
      formatted = '+966' + formatted.substring(1);
    } else if (formatted.startsWith('5') && formatted.length === 9) {
      formatted = '+966' + formatted;
    } else if (!formatted.startsWith('+')) {
      formatted = '+966' + formatted;
    }

    if (!window._recaptchaVerifier) {
      window._recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          window._recaptchaVerifier?.clear();
          window._recaptchaVerifier = null;
        }
      });
    }

    const confirmationResult = await signInWithPhoneNumber(auth, formatted, window._recaptchaVerifier);
    window._confirmationResult = confirmationResult;
    return { success: true, phoneNumber: formatted };
  } catch (error) {
    if (window._recaptchaVerifier) {
      window._recaptchaVerifier.clear();
      window._recaptchaVerifier = null;
    }
    return { success: false, error: parseAuthError(error) };
  }
}

export async function verifyPhoneOTP(code, password = null) {
  try {
    if (!window._confirmationResult) {
      return { success: false, error: 'انتهت صلاحية الجلسة. أعد إرسال الكود.' };
    }
    const result = await window._confirmationResult.confirm(code);

    if (password && result.user) {
      const fakeEmail = `${result.user.uid}@phone.ksa2030.one`;
      try {
        const credential = EmailAuthProvider.credential(fakeEmail, password);
        await linkWithCredential(result.user, credential);
      } catch (linkErr) {
        console.log('Link note:', linkErr.code);
      }
    }

    await ensureUserDoc(result.user, {
      authMethod: 'phone',
      phoneNumber: result.user.phoneNumber
    });

    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

export async function logout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function onUserChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      callback({ user, profile });
    } else {
      callback(null);
    }
  });
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
}

// ═══ ملف المستخدم ═══

async function ensureUserDoc(user, extra = {}) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      plan: 'free',
      activatedAt: null,
      downloadsUsed: 0,
      downloadsLimit: SITE_CONFIG.FREE_DOWNLOADS_LIMIT,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      ...extra
    });
  } else {
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      ...extra
    });
  }
}

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
}

export async function updateUserProfile(uid, updates) {
  try {
    await updateDoc(doc(db, 'users', uid), updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function incrementDownloadCount(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      downloadsUsed: increment(1),
      lastDownloadAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══ إعدادات العرض والمؤقت ═══

export async function getOfferSettings() {
  try {
    const ref = doc(db, 'settings', 'offer');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    // افتراضي
    return {
      active: false,
      title: '🔥 عرض إطلاق محدود',
      subtitle: 'الفرصة الذهبية للاشتراك',
      endDate: null,
      ribbonText: 'عرض حصري'
    };
  } catch (error) {
    console.error('getOfferSettings:', error);
    return null;
  }
}

export async function setOfferSettings(settings) {
  try {
    await setDoc(doc(db, 'settings', 'offer'), {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function listenToOffer(callback) {
  const ref = doc(db, 'settings', 'offer');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback({
        active: false,
        title: '🔥 عرض إطلاق محدود',
        subtitle: 'الفرصة الذهبية للاشتراك',
        endDate: null,
        ribbonText: 'عرض حصري'
      });
    }
  });
}

// ═══ الصلاحيات ═══

export function isLifetime(profile) {
  if (!profile) return false;
  return profile.plan === 'lifetime';
}

export function isSubscribed(profile) {
  return isLifetime(profile);
}

export function canDownload(profile) {
  if (isLifetime(profile)) return { allowed: true, reason: 'lifetime' };
  const used = profile?.downloadsUsed || 0;
  const limit = profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT;
  if (used < limit) return { allowed: true, reason: 'free_trial', remaining: limit - used };
  return { allowed: false, reason: 'limit_reached' };
}

export function buildSubscribeWhatsAppLink(profile, user) {
  const userId = user?.uid?.substring(0, 8) || 'GUEST';
  const phone = profile?.phoneNumber || user?.phoneNumber || '';
  const email = profile?.email || user?.email || '';

  let msg = `${SITE_CONFIG.WHATSAPP_MESSAGE}\n\n`;
  msg += `معرّف الحساب: ${userId}\n`;
  if (phone) msg += `الجوال: ${phone}\n`;
  if (email && !email.includes('@phone.')) msg += `الإيميل: ${email}\n`;
  msg += `\nالمبلغ: ${SITE_CONFIG.PRICE} ${SITE_CONFIG.CURRENCY} (مدى الحياة)`;

  return `https://wa.me/${SITE_CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ═══ Admin Functions ═══

const ADMIN_UIDS = [
  'bKJ4YdvOEkRCPJ8qMqEyDJsM3ua2'  // nawaf4223@hotmail.com
];

export function isAdmin(user) {
  if (!user) return false;
  return ADMIN_UIDS.includes(user.uid);
}

export async function getAllUsers(limitCount = 100) {
  try {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getAllUsers error:', error);
    return [];
  }
}

export async function findUser(searchTerm) {
  try {
    const term = searchTerm.trim();
    const results = [];

    let q1;
    if (term.startsWith('05')) {
      q1 = query(collection(db, 'users'), where('phoneNumber', '==', '+966' + term.substring(1)));
    } else if (term.startsWith('+966')) {
      q1 = query(collection(db, 'users'), where('phoneNumber', '==', term));
    } else if (term.startsWith('5') && term.length === 9) {
      q1 = query(collection(db, 'users'), where('phoneNumber', '==', '+966' + term));
    }

    if (q1) {
      const snap1 = await getDocs(q1);
      snap1.forEach(d => results.push({ id: d.id, ...d.data() }));
    }

    if (term.includes('@') || results.length === 0) {
      const q2 = query(collection(db, 'users'), where('email', '==', term));
      const snap2 = await getDocs(q2);
      snap2.forEach(d => {
        if (!results.find(r => r.id === d.id)) {
          results.push({ id: d.id, ...d.data() });
        }
      });
    }

    // 🆔 بحث بمعرّف العميل (أول 8 حروف من UID)
    if (results.length === 0 && term.length >= 4 && term.length <= 10 && !term.includes('@')) {
      const allSnap = await getDocs(query(collection(db, 'users'), limit(500)));
      allSnap.forEach(d => {
        if (d.id.startsWith(term)) {
          if (!results.find(r => r.id === d.id)) {
            results.push({ id: d.id, ...d.data() });
          }
        }
      });
    }

    return results;
  } catch (error) {
    console.error('findUser error:', error);
    return [];
  }
}

export async function activateUserLifetime(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan: 'lifetime',
      activatedAt: serverTimestamp(),
      downloadsLimit: 999999
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deactivateUser(uid) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan: 'free',
      activatedAt: null,
      downloadsLimit: SITE_CONFIG.FREE_DOWNLOADS_LIMIT
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══ مساعدات ═══

function parseAuthError(error) {
  const code = error.code || '';
  const messages = {
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
    'auth/user-disabled': 'هذا الحساب موقوف',
    'auth/user-not-found': 'لا يوجد حساب بهذه البيانات',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
    'auth/email-already-in-use': 'هذا البريد مسجّل مسبقاً',
    'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
    'auth/invalid-phone-number': 'رقم الجوال غير صحيح',
    'auth/missing-phone-number': 'أدخل رقم الجوال',
    'auth/quota-exceeded': 'تجاوزت الحد المسموح، حاول لاحقاً',
    'auth/invalid-verification-code': 'كود التحقق غير صحيح',
    'auth/code-expired': 'انتهت صلاحية الكود',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً',
    'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
    'auth/popup-closed-by-user': 'تم إلغاء تسجيل الدخول',
    'auth/popup-blocked': 'المتصفح حجب النافذة المنبثقة',
    'auth/operation-not-allowed': 'هذه الطريقة غير مفعّلة'
  };
  return messages[code] || error.message || 'حدث خطأ غير متوقع';
}

export { auth, db, app, Timestamp };
