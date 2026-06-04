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
  addDoc,
  deleteDoc,
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
  PRICE: 49,              // ← السعر الافتراضي (لو فشل تحميل من Firestore)
  ORIGINAL_PRICE: 99,     // ← السعر المشطوب الافتراضي
  CURRENCY: 'ريال',
  PLAN_TYPE: 'lifetime',
  FREE_DOWNLOADS_LIMIT: 2,
  WHATSAPP_NUMBER: '966552052867',
  WHATSAPP_MESSAGE: 'السلام عليكم، أرغب في الاشتراك بمنصة التقارير'
};

// ═══════════════════════════════════════════════
// 💰 نظام التسعير الديناميكي (يقرأ من Firestore)
// ═══════════════════════════════════════════════

// 💾 مفتاح الكاش في localStorage
const PRICING_CACHE_KEY = 'ksa2030_pricing_cache_v1';

// 🚀 استرجاع السعر من الكاش (إن وجد) - فوري قبل ما Firestore يجيب
function loadCachedPricing() {
  try {
    const cached = localStorage.getItem(PRICING_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // ✅ نتحقق من أن الكاش ليس قديماً جداً (7 أيام)
      const age = Date.now() - (data.cachedAt || 0);
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return {
          currentPrice: Number(data.currentPrice) || SITE_CONFIG.PRICE,
          originalPrice: Number(data.originalPrice) || SITE_CONFIG.ORIGINAL_PRICE,
          currency: data.currency || SITE_CONFIG.CURRENCY,
          isOfferActive: data.isOfferActive !== false,
          offerLabel: data.offerLabel || 'عرض محدود',
          offerEmoji: data.offerEmoji || '🔥',
          discountPercent: calculateDiscount(
            Number(data.currentPrice),
            Number(data.originalPrice)
          ),
          loaded: true,
          fromCache: true
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load cached pricing:', e);
  }
  return null;
}

// 💾 حفظ السعر في الكاش
function saveCachedPricing(pricing) {
  try {
    localStorage.setItem(PRICING_CACHE_KEY, JSON.stringify({
      ...pricing,
      cachedAt: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to cache pricing:', e);
  }
}

// 🌐 حالة السعر الحالي (cache في الذاكرة) - يبدأ من الكاش لو موجود!
let _currentPricing = loadCachedPricing() || {
  currentPrice: SITE_CONFIG.PRICE,
  originalPrice: SITE_CONFIG.ORIGINAL_PRICE,
  currency: SITE_CONFIG.CURRENCY,
  isOfferActive: true,
  offerLabel: 'عرض محدود',
  offerEmoji: '🔥',
  discountPercent: calculateDiscount(SITE_CONFIG.PRICE, SITE_CONFIG.ORIGINAL_PRICE),
  loaded: true,  // ⚡ نعتبره loaded من الكاش
  fromCache: false
};

// 🌐 خلّيه متاح فوراً للعالم الخارجي (قبل أي asynchronous wait)
if (typeof window !== 'undefined') {
  window.__PRICING__ = _currentPricing;
}

// 📡 المستمعين للتغييرات
const _pricingListeners = new Set();

/**
 * احصل على بيانات التسعير الحالية
 * @returns {Object} كائن التسعير
 */
export function getPricing() {
  return { ..._currentPricing };
}

/**
 * احسب نسبة الخصم تلقائياً
 */
function calculateDiscount(current, original) {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

/**
 * استمع لتغييرات السعر (Real-time)
 * @param {Function} callback يستقبل بيانات التسعير
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function onPricingChange(callback) {
  _pricingListeners.add(callback);
  // أرسل القيمة الحالية فوراً
  if (_currentPricing.loaded) {
    callback(_currentPricing);
  }
  // دالة إلغاء الاشتراك
  return () => _pricingListeners.delete(callback);
}

/**
 * 🔴 تشغيل المراقبة اللحظية للسعر من Firestore
 * يستدعى تلقائياً عند تحميل الصفحة
 */
function initPricingWatcher() {
  const pricingRef = doc(db, 'settings', 'pricing');

  onSnapshot(pricingRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      _currentPricing = {
        currentPrice: Number(data.currentPrice) || SITE_CONFIG.PRICE,
        originalPrice: Number(data.originalPrice) || SITE_CONFIG.ORIGINAL_PRICE,
        currency: data.currency || SITE_CONFIG.CURRENCY,
        isOfferActive: data.isOfferActive !== false,
        offerLabel: data.offerLabel || 'عرض محدود',
        offerEmoji: data.offerEmoji || '🔥',
        discountPercent: calculateDiscount(
          Number(data.currentPrice),
          Number(data.originalPrice)
        ),
        loaded: true,
        fromCache: false,
        updatedAt: data.updatedAt
      };
      
      // 💾 احفظ في الكاش للزيارة القادمة (تحميل فوري)
      saveCachedPricing(_currentPricing);
    } else {
      // لا يوجد ملف في Firestore - استخدم الافتراضي
      _currentPricing = {
        currentPrice: SITE_CONFIG.PRICE,
        originalPrice: SITE_CONFIG.ORIGINAL_PRICE,
        currency: SITE_CONFIG.CURRENCY,
        isOfferActive: true,
        offerLabel: 'عرض محدود',
        offerEmoji: '🔥',
        discountPercent: calculateDiscount(SITE_CONFIG.PRICE, SITE_CONFIG.ORIGINAL_PRICE),
        loaded: true,
        fromCache: false
      };
    }

    // 📢 أبلغ جميع المستمعين
    _pricingListeners.forEach(cb => {
      try { cb(_currentPricing); } catch (e) { console.error(e); }
    });

    // 🌐 وفّر الوصول الجلوبال
    window.__PRICING__ = _currentPricing;
    
    // 🔥 حدّث DOM elements تلقائياً (data-price-* attributes)
    updatePriceElements();
  }, (err) => {
    console.warn('Pricing watcher error:', err);
    _currentPricing.loaded = true;
  });
}

/**
 * 🎨 حدّث كل العناصر في الـ DOM اللي عليها data-price-* attribute
 * استخدام في HTML: <span data-price="current">49</span>
 */
function updatePriceElements() {
  if (typeof document === 'undefined') return;

  // 💰 السعر الحالي
  document.querySelectorAll('[data-price="current"]').forEach(el => {
    el.textContent = _currentPricing.currentPrice;
  });

  // 💸 السعر الأصلي (المشطوب)
  document.querySelectorAll('[data-price="original"]').forEach(el => {
    el.textContent = _currentPricing.originalPrice;
  });

  // 💱 العملة
  document.querySelectorAll('[data-price="currency"]').forEach(el => {
    el.textContent = _currentPricing.currency;
  });

  // 🎁 نسبة الخصم
  document.querySelectorAll('[data-price="discount"]').forEach(el => {
    el.textContent = _currentPricing.discountPercent;
  });

  // 🏷️ نص العرض
  document.querySelectorAll('[data-price="offer-label"]').forEach(el => {
    el.textContent = _currentPricing.offerLabel;
  });

  // 🎯 إخفاء/إظهار العرض
  document.querySelectorAll('[data-price="offer-wrap"]').forEach(el => {
    el.style.display = _currentPricing.isOfferActive ? '' : 'none';
  });

  // 💎 السعر بالهلالات (لـ Moyasar)
  document.querySelectorAll('[data-price="halalas"]').forEach(el => {
    el.textContent = _currentPricing.currentPrice * 100;
  });

  // 💰 جملة السعر الكاملة "49 ريال"
  document.querySelectorAll('[data-price="full"]').forEach(el => {
    el.textContent = `${_currentPricing.currentPrice} ${_currentPricing.currency}`;
  });

  // ✨ كشف الأسعار للزائر الجديد (anti-flash)
  if (typeof window !== 'undefined') {
    window.__PRICING_WAITING__ = false;
    if (typeof window.__APPLY_PRICING_FN__ === 'function') {
      window.__APPLY_PRICING_FN__();
    }
    // كشف عام
    if (document.documentElement) {
      document.documentElement.classList.add('price-ready');
    }
  }
}

/**
 * 🔧 (للأدمن فقط) حدّث بيانات التسعير في Firestore
 * @param {Object} pricing الحقول الجديدة
 * @returns {Promise}
 */
export async function updatePricing(pricing) {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const pricingRef = doc(db, 'settings', 'pricing');
  await setDoc(pricingRef, {
    currentPrice: Number(pricing.currentPrice),
    originalPrice: Number(pricing.originalPrice),
    currency: pricing.currency || 'ريال',
    isOfferActive: pricing.isOfferActive !== false,
    offerLabel: pricing.offerLabel || 'عرض محدود',
    offerEmoji: pricing.offerEmoji || '🔥',
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });

  return true;
}

// 🚀 ابدأ المراقبة فوراً
if (typeof window !== 'undefined') {
  initPricingWatcher();
}


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

// ═══════════════════════════════════════════════════════
// 🛠️ وضع الصيانة (Maintenance Mode)
// يفعّلها الأدمن من admin.html
// لما تكون مفعّلة → الزوار والمستخدمون العاديون يشوفون صفحة "تحت الصيانة"
// الأدمن يظل يشتغل عادي
// ═══════════════════════════════════════════════════════
export async function getMaintenanceMode() {
  try {
    const ref = doc(db, 'settings', 'maintenance');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    return {
      active: false,
      message: 'الموقع تحت الصيانة والتحديث',
      submessage: 'نعتذر عن الإزعاج، نعمل على تحسين خدماتنا لكم'
    };
  } catch (error) {
    console.error('getMaintenanceMode:', error);
    return { active: false };
  }
}

export async function setMaintenanceMode(active, customMessage = null) {
  try {
    const data = {
      active: !!active,
      updatedAt: serverTimestamp()
    };
    if (customMessage !== null) {
      data.message = customMessage.message || 'الموقع تحت الصيانة والتحديث';
      data.submessage = customMessage.submessage || 'نعتذر عن الإزعاج، نعمل على تحسين خدماتنا لكم';
    }
    await setDoc(doc(db, 'settings', 'maintenance'), data, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function listenToMaintenance(callback) {
  const ref = doc(db, 'settings', 'maintenance');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback({ active: false });
    }
  }, (error) => {
    console.error('listenToMaintenance:', error);
    callback({ active: false });
  });
}

// ═══════════════════════════════════════════════════════
// 📲 نشر التقارير - يولّد رابط فريد لكل تقرير
// المعلم يحفظ تقريره → نولّد له ID فريد
// يقدر يشاركه برابط أو QR Code
// ═══════════════════════════════════════════════════════

// 🔧 توليد ID قصير ومميز للتقرير (مثل: a3k9x2)
function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// 📤 نشر تقرير جديد (أو تحديث موجود)
export async function publishReport(reportData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً' };
    }

    // إذا التقرير له ID مسبق، نحدّثه. وإلا نولّد ID جديد
    const reportId = reportData.reportId || generateShortId();

    const data = {
      reportId,
      userId: user.uid,
      userEmail: user.email,
      reportType: reportData.reportType || 'general', // مثل: report, watny, etc.
      reportTitle: reportData.reportTitle || 'تقرير مدرسي',
      content: reportData.content, // كل بيانات التقرير
      theme: reportData.theme || '',
      lang: reportData.lang || 'ar',
      views: reportData.views || 0,
      createdAt: reportData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'publishedReports', reportId), data, { merge: true });

    return {
      success: true,
      reportId,
      url: `${window.location.origin}/view.html?r=${reportId}`
    };
  } catch (error) {
    console.error('publishReport:', error);
    return { success: false, error: error.message };
  }
}

// 📥 قراءة تقرير منشور بواسطة ID
export async function getPublishedReport(reportId) {
  try {
    if (!reportId || typeof reportId !== 'string') {
      return { success: false, error: 'رقم التقرير غير صحيح' };
    }
    const snap = await getDoc(doc(db, 'publishedReports', reportId));
    if (!snap.exists()) {
      return { success: false, error: 'التقرير غير موجود' };
    }
    return { success: true, data: snap.data() };
  } catch (error) {
    console.error('getPublishedReport:', error);
    return { success: false, error: error.message };
  }
}

// 📊 زيادة عداد المشاهدات
export async function incrementReportViews(reportId) {
  try {
    const ref = doc(db, 'publishedReports', reportId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const currentViews = snap.data().views || 0;
      await setDoc(ref, { views: currentViews + 1 }, { merge: true });
    }
  } catch (error) {
    console.warn('incrementReportViews failed:', error);
  }
}

// 📋 قائمة التقارير المنشورة للمستخدم الحالي
export async function getUserPublishedReports(uid) {
  try {
    if (!uid) return { success: false, error: 'معرّف المستخدم مفقود' };
    const q = query(
      collection(db, 'publishedReports'),
      where('userId', '==', uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const reports = [];
    snap.forEach(doc => reports.push(doc.data()));
    return { success: true, reports };
  } catch (error) {
    console.error('getUserPublishedReports:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════
// 📋 سجل التقارير المُصدّرة (Export History)
// ═══════════════════════════════════════════════════════════

/**
 * حفظ تصدير في السجل
 * @param {Object} data - { type, title, format, templateId }
 */
export async function logExport(data) {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, error: 'يلزم تسجيل الدخول' };
    
    const exportData = {
      userId: u.uid,
      type: data.type || 'unknown',           // council, enjaz, tasis...
      title: data.title || 'تقرير بدون عنوان',
      format: data.format || 'pdf',            // pdf, png, jpg
      templateId: data.templateId || data.type,
      exportedAt: serverTimestamp(),
      createdAt: Timestamp.now()
    };
    
    const ref = await addDoc(collection(db, 'users', u.uid, 'exports'), exportData);
    return { success: true, exportId: ref.id };
  } catch (error) {
    console.error('logExport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * الحصول على سجل التصدير
 */
export async function getExportHistory(uid = null, limitCount = 50) {
  try {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return { success: false, error: 'يلزم تسجيل الدخول' };
    
    const q = query(
      collection(db, 'users', targetUid, 'exports'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const exports = [];
    snap.forEach(doc => exports.push({ id: doc.id, ...doc.data() }));
    
    // رتّب يدوياً
    exports.sort((a, b) => {
      const aTime = a.exportedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.exportedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    return { success: true, exports };
  } catch (error) {
    console.error('getExportHistory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * حذف سجل تصدير
 */
export async function deleteExportLog(exportId) {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, error: 'يلزم تسجيل الدخول' };
    await deleteDoc(doc(db, 'users', u.uid, 'exports', exportId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════
// ⭐ المفضلة (Favorites)
// ═══════════════════════════════════════════════════════════

/**
 * إضافة/إزالة قالب من المفضلة (toggle)
 */
export async function toggleFavorite(templateId, metadata = {}) {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, error: 'يلزم تسجيل الدخول' };
    
    const favRef = doc(db, 'users', u.uid, 'favorites', templateId);
    const snap = await getDoc(favRef);
    
    if (snap.exists()) {
      // محذوف - أحذف
      await deleteDoc(favRef);
      return { success: true, isFavorite: false };
    } else {
      // إضافة
      await setDoc(favRef, {
        templateId,
        title: metadata.title || templateId,
        category: metadata.category || 'general',
        icon: metadata.icon || '📋',
        url: metadata.url || templateId + '.html',
        addedAt: serverTimestamp()
      });
      return { success: true, isFavorite: true };
    }
  } catch (error) {
    console.error('toggleFavorite:', error);
    return { success: false, error: error.message };
  }
}

/**
 * الحصول على قائمة المفضلة
 */
export async function getFavorites(uid = null) {
  try {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return { success: false, favorites: [] };
    
    const q = query(collection(db, 'users', targetUid, 'favorites'));
    const snap = await getDocs(q);
    const favorites = [];
    snap.forEach(doc => favorites.push({ id: doc.id, ...doc.data() }));
    
    favorites.sort((a, b) => {
      const aTime = a.addedAt?.toMillis?.() || 0;
      const bTime = b.addedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    return { success: true, favorites };
  } catch (error) {
    return { success: false, favorites: [], error: error.message };
  }
}

/**
 * التحقق إذا قالب في المفضلة
 */
export async function isFavorite(templateId) {
  try {
    const u = auth.currentUser;
    if (!u) return false;
    const snap = await getDoc(doc(db, 'users', u.uid, 'favorites', templateId));
    return snap.exists();
  } catch (error) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// 🔗 المشاركات (Shared Reports)
// ═══════════════════════════════════════════════════════════

/**
 * إنشاء رابط مشاركة لتقرير
 */
export async function createShare(data) {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, error: 'يلزم تسجيل الدخول' };
    
    const shareData = {
      userId: u.uid,
      type: data.type || 'unknown',
      title: data.title || 'تقرير مشارك',
      content: data.content || {},           // بيانات التقرير
      htmlSnapshot: data.htmlSnapshot || '', // نسخة HTML (اختياري)
      views: 0,
      createdAt: serverTimestamp(),
      expiresAt: data.expiresAt || null      // اختياري
    };
    
    const ref = await addDoc(collection(db, 'shares'), shareData);
    return { 
      success: true, 
      shareId: ref.id,
      shareUrl: `https://ksa2030.one/view.html?id=${ref.id}`
    };
  } catch (error) {
    console.error('createShare:', error);
    return { success: false, error: error.message };
  }
}

/**
 * جلب تقرير مشارك
 */
export async function getShare(shareId) {
  try {
    if (!shareId) return { success: false, error: 'معرّف المشاركة مفقود' };
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) return { success: false, error: 'التقرير غير موجود' };
    
    const data = snap.data();
    
    // التحقق من انتهاء الصلاحية
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      return { success: false, error: 'انتهت صلاحية الرابط' };
    }
    
    // زيادة العدّاد
    await updateDoc(doc(db, 'shares', shareId), { 
      views: (data.views || 0) + 1,
      lastViewedAt: serverTimestamp()
    });
    
    return { success: true, share: { id: shareId, ...data } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * جلب مشاركات المستخدم
 */
export async function getUserShares() {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, shares: [] };
    
    // اطلب بدون orderBy عشان نتجنب مشاكل الحقول الفاضية
    const q = query(
      collection(db, 'shares'),
      where('userId', '==', u.uid),
      limit(50)
    );
    const snap = await getDocs(q);
    const shares = [];
    snap.forEach(doc => shares.push({ id: doc.id, ...doc.data() }));
    
    // رتّب يدوياً بالـ JavaScript
    shares.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    return { success: true, shares };
  } catch (error) {
    console.error('getUserShares:', error);
    return { success: false, shares: [], error: error.message };
  }
}

/**
 * حذف مشاركة
 */
export async function deleteShare(shareId) {
  try {
    const u = auth.currentUser;
    if (!u) return { success: false, error: 'يلزم تسجيل الدخول' };
    await deleteDoc(doc(db, 'shares', shareId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
