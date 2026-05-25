// ═══════════════════════════════════════════════════════════
// 🔥 Firebase Reports v2.0 - ksa2030.one
// النظام يعتمد على Firebase مباشرة (Real-time)
// ═══════════════════════════════════════════════════════════

import {
  auth,
  db,
  isLifetime,
  isAdmin,
  incrementDownloadCount,
  buildSubscribeWhatsAppLink,
  SITE_CONFIG,
  logout,
  getUserProfile
} from './firebase-config.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let _user = null;
let _profile = null;
let _userReady = false;
let _profileUnsub = null;

// ═══ شاشة الانتظار ═══
function showInitLoader() {
  if (document.getElementById('fbInitLoader')) return;
  const l = document.createElement('div');
  l.id = 'fbInitLoader';
  l.innerHTML = `<style>#fbInitLoader{position:fixed;inset:0;z-index:99997;background:rgba(10,52,71,0.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Tajawal','Cairo',sans-serif;}#fbInitLoader .sp{width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top-color:#d4a657;border-radius:50%;animation:fbiSpin 0.8s linear infinite;margin-bottom:14px;}@keyframes fbiSpin{to{transform:rotate(360deg);}}#fbInitLoader .tx{font-size:0.9rem;font-weight:800;opacity:0.9;}</style><div class="sp"></div><div class="tx">جاري التحقق...</div>`;
  document.body.appendChild(l);
}
function hideInitLoader() {
  const l = document.getElementById('fbInitLoader');
  if (l) l.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showInitLoader);
} else {
  showInitLoader();
}

// ═══ Auth + Profile Real-time Listener ═══
onAuthStateChanged(auth, (user) => {
  if (_profileUnsub) {
    _profileUnsub();
    _profileUnsub = null;
  }

  if (!user) {
    _user = null;
    _profile = null;
    _userReady = true;
    hideInitLoader();
    localStorage.removeItem('loggedUser');
    localStorage.removeItem('isSubscribed');
    if (!document.getElementById('reportLoginGuard')) showLoginRequired();
    return;
  }

  _user = user;

  // 🔥 مراقبة لحظية للبروفايل
  _profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
    const wasLifetime = _profile ? isLifetime(_profile) : null;
    _profile = snap.exists() ? snap.data() : null;
    _userReady = true;
    hideInitLoader();

    const nowLifetime = isLifetime(_profile);

    // مزامنة localStorage
    const phoneFromEmail = (_user.email || '').split('@')[0];
    const userPhone = _profile?.legacyPhone || phoneFromEmail || _user.phoneNumber || _user.uid;
    localStorage.setItem('loggedUser', userPhone);
    if (nowLifetime) {
      localStorage.setItem('isSubscribed', '1');
      localStorage.removeItem('free_downloads_used');
    } else {
      localStorage.removeItem('isSubscribed');
    }

    refreshBadge();

    // أغلق شاشة الدخول إن كانت ظاهرة
    const guard = document.getElementById('reportLoginGuard');
    if (guard) guard.remove();

    // 🎉 تم التفعيل تواً
    if (wasLifetime === false && nowLifetime === true) {
      showActivationToast();
      document.querySelectorAll('#fbUpgradeModal,#tasisUpgradeModal,[id*="UpgradeModal"]').forEach(m => {
        if (m.style) m.style.display = 'none';
      });
    }

    // ⚠️ تم إلغاء التفعيل
    if (wasLifetime === true && nowLifetime === false) {
      showDeactivationToast();
    }
  }, (err) => {
    console.error('Profile listener error:', err);
    _userReady = true;
    hideInitLoader();
  });
});

// ═══ Toast التفعيل ═══
function showActivationToast() {
  const o = document.getElementById('activationToast');
  if (o) o.remove();
  const t = document.createElement('div');
  t.id = 'activationToast';
  t.innerHTML = `<style>#activationToast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#d4a657,#b8923d);color:#fff;padding:18px 24px;border-radius:18px;font-family:'Tajawal','Cairo',sans-serif;font-weight:900;box-shadow:0 18px 50px rgba(212,166,87,0.5);z-index:99999;max-width:340px;text-align:center;border:2px solid rgba(255,255,255,0.3);animation:atIn 0.5s cubic-bezier(0.34,1.56,0.64,1);}@keyframes atIn{from{opacity:0;transform:translate(-50%,-30px);}to{opacity:1;transform:translate(-50%,0);}}</style><div style="font-size:2.5rem;margin-bottom:6px;">🎉</div><div style="font-size:1.05rem;margin-bottom:4px;">تم تفعيل اشتراكك!</div><div style="font-size:0.82rem;font-weight:700;opacity:0.95;line-height:1.5;">مرحباً بك في عائلة المشتركين 💎<br>تحمّل بلا حدود الآن</div>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 5500);
}

// ═══ Toast إلغاء ═══
function showDeactivationToast() {
  const o = document.getElementById('deactivationToast');
  if (o) o.remove();
  const t = document.createElement('div');
  t.id = 'deactivationToast';
  t.innerHTML = `<style>#deactivationToast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;padding:16px 22px;border-radius:18px;font-family:'Tajawal','Cairo',sans-serif;font-weight:900;box-shadow:0 18px 50px rgba(220,38,38,0.5);z-index:99999;max-width:340px;text-align:center;}</style><div style="font-size:1rem;margin-bottom:4px;">⚠️ تم إلغاء اشتراكك</div><div style="font-size:0.82rem;font-weight:700;opacity:0.95;">للاستفسار: تواصل مع الإدارة</div>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 5000);
}

// ═══ شارة المستخدم ═══
function refreshBadge() {
  const ob = document.getElementById('userBadgeFB');
  const om = document.getElementById('userBadgeFB-menu');
  if (ob) ob.remove();
  if (om) om.remove();
  if (!_user) return;

  const lifetime = isLifetime(_profile);
  const admin = isAdmin(_user);
  const name = _profile?.displayName || (_user.email || '').split('@')[0] || 'مستخدم';
  const initial = admin ? '👑' : name.charAt(0).toUpperCase();

  const badge = document.createElement('div');
  badge.id = 'userBadgeFB';
  badge.innerHTML = `<style>#userBadgeFB{position:fixed;top:14px;left:14px;z-index:9998;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.98);padding:8px 14px 8px 8px;border-radius:99px;box-shadow:0 8px 24px rgba(0,0,0,0.18),0 0 0 1px ${admin?'rgba(124,45,18,0.4)':(lifetime?'rgba(212,166,87,0.4)':'rgba(30,107,138,0.2)')};font-family:'Tajawal','Cairo',sans-serif;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}#userBadgeFB:hover{transform:translateY(-2px);}#userBadgeFB .av{width:32px;height:32px;background:linear-gradient(135deg,${admin?'#7c2d12,#b8923d':(lifetime?'#d4a657,#b8923d':'#1e6b8a,#2a8aab')});color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.85rem;flex-shrink:0;}#userBadgeFB .nm{font-size:0.78rem;font-weight:900;color:#1a3a4e;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2;}#userBadgeFB .pl{font-size:0.62rem;font-weight:900;color:${admin?'#7c2d12':(lifetime?'#b8923d':'#5a7080')};line-height:1.2;}#userBadgeFB-menu{position:fixed;top:60px;left:14px;z-index:9999;background:#fff;border-radius:14px;padding:6px;box-shadow:0 18px 50px rgba(0,0,0,0.25);min-width:200px;display:none;font-family:'Tajawal','Cairo',sans-serif;}#userBadgeFB-menu.show{display:block;}#userBadgeFB-menu .mi{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;font-size:0.85rem;font-weight:800;color:#1a3a4e;text-decoration:none;}#userBadgeFB-menu .mi:hover{background:#f0f4f8;}#userBadgeFB-menu .mi.dn{color:#dc2626;}#userBadgeFB-menu .mi.adm{color:#7c2d12;background:#fef3c7;}#userBadgeFB-menu .dv{height:1px;background:#e8eef3;margin:4px 0;}@media (max-width:480px){#userBadgeFB{top:10px;left:10px;padding:6px 12px 6px 6px;}#userBadgeFB .av{width:28px;height:28px;font-size:0.78rem;}#userBadgeFB .nm{font-size:0.74rem;max-width:80px;}}</style><div class="av">${initial}</div><div><div class="nm">${name}</div><div class="pl">${admin?'👑 ADMIN':(lifetime?'💎 LIFETIME':'🆓 FREE')}</div></div>`;
  document.body.appendChild(badge);

  const menu = document.createElement('div');
  menu.id = 'userBadgeFB-menu';
  menu.innerHTML = `<a href="index.html" class="mi"><span>🏠</span><span>الرئيسية</span></a><a href="profile.html" class="mi"><span>👤</span><span>الملف الشخصي</span></a>${admin?'<a href="admin.html" class="mi adm"><span>🛠️</span><span>لوحة الإدارة</span></a>':''}${!lifetime&&!admin?'<a href="#" class="mi" onclick="window._fbShowUpgrade();return false;"><span>💎</span><span>اشترك الآن</span></a>':''}<div class="dv"></div><a href="#" class="mi dn" onclick="window._fbLogout();return false;"><span>🚪</span><span>تسجيل الخروج</span></a>`;
  document.body.appendChild(menu);

  badge.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); };
  document.addEventListener('click', () => menu.classList.remove('show'));
}

// ═══ شاشة "سجّل دخولك" ═══
function showLoginRequired() {
  const g = document.createElement('div');
  g.id = 'reportLoginGuard';
  g.innerHTML = `<style>#reportLoginGuard{position:fixed;inset:0;z-index:99999;background:rgba(10,52,71,0.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Tajawal','Cairo',sans-serif;}#reportLoginGuard .gc{background:#fff;border-radius:24px;padding:36px 28px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.5);position:relative;overflow:hidden;}#reportLoginGuard .gc::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#d4a657,#1e6b8a,#d4a657);}#reportLoginGuard .gi{font-size:3.5rem;margin-bottom:10px;display:inline-block;}#reportLoginGuard h2{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.35rem;color:#1a3a4e;margin-bottom:8px;}#reportLoginGuard p{font-size:0.92rem;color:#5a7080;font-weight:700;line-height:1.7;margin-bottom:20px;}#reportLoginGuard .gb{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:linear-gradient(135deg,#1e6b8a,#2a8aab);color:#fff;border-radius:13px;font-family:inherit;font-size:0.95rem;font-weight:900;cursor:pointer;text-decoration:none;}#reportLoginGuard .gb-ghost{background:#f0f4f8;color:#1a3a4e;margin-top:10px;}#reportLoginGuard .gf{display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.74rem;color:#16a34a;font-weight:900;margin-top:14px;padding:8px 12px;background:#dcfce7;border-radius:99px;}</style><div class="gc"><div class="gi">🔐</div><h2>سجّل الدخول للوصول</h2><p>هذا التقرير مخصص لمستخدمي المنصة</p><a href="login.html" class="gb" onclick="sessionStorage.setItem('returnAfterLogin', window.location.pathname.split('/').pop());"><span>🔑</span><span>تسجيل الدخول</span></a><a href="index.html" class="gb gb-ghost"><span>🏠</span><span>الرجوع للرئيسية</span></a><div class="gf"><span>✨</span><span>تقريران مجانيان عند إنشاء حساب جديد</span></div></div>`;
  document.body.appendChild(g);
}

// ═══ مودال اشتراك ═══
window._fbShowUpgrade = function() {
  if (document.getElementById('fbUpgradeModal')) {
    document.getElementById('fbUpgradeModal').style.display = 'flex';
    return;
  }
  const m = document.createElement('div');
  m.id = 'fbUpgradeModal';
  const link = buildSubscribeWhatsAppLink(_profile, _user);
  const used = _profile?.downloadsUsed || 0;
  const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT;

  m.innerHTML = `<style>#fbUpgradeModal{position:fixed;inset:0;z-index:99999;background:rgba(0,15,30,0.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;font-family:'Tajawal','Cairo',sans-serif;overflow-y:auto;}#fbUpgradeModal .uc{background:linear-gradient(145deg,#1a1f2e,#2a3a4e);border:2px solid rgba(212,166,87,0.55);border-radius:24px;padding:28px 22px 22px;max-width:420px;width:100%;text-align:center;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,0.7);max-height:92vh;overflow-y:auto;position:relative;}#fbUpgradeModal .uclose{position:absolute;top:12px;left:12px;background:rgba(255,255,255,0.1);color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;font-weight:900;border:1px solid rgba(255,255,255,0.15);font-family:inherit;}#fbUpgradeModal .ub{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#dc2626,#f59e0b);padding:5px 14px;border-radius:99px;font-size:0.74rem;font-weight:900;margin-bottom:10px;}#fbUpgradeModal .uf{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:13px 16px;margin-bottom:14px;text-align:right;}#fbUpgradeModal .uft{padding:5px 0;font-size:0.85rem;font-weight:700;display:flex;align-items:center;gap:8px;}#fbUpgradeModal .uft strong{color:#f4d690;}#fbUpgradeModal .upb{background:linear-gradient(135deg,rgba(212,166,87,0.2),rgba(245,158,11,0.1));border:2px solid rgba(212,166,87,0.5);border-radius:16px;padding:14px;margin-bottom:14px;position:relative;}#fbUpgradeModal .upt{position:absolute;top:-10px;right:50%;transform:translateX(50%);background:#dc2626;color:#fff;padding:3px 12px;border-radius:99px;font-size:0.68rem;font-weight:900;white-space:nowrap;}#fbUpgradeModal .uct{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:0.96rem;font-weight:900;text-decoration:none;margin-bottom:8px;box-sizing:border-box;}</style><div class="uc"><button class="uclose" onclick="document.getElementById('fbUpgradeModal').style.display='none';">×</button><div class="ub">🔒 ${used >= limit ? 'استخدمت '+used+' من '+limit+' تحميلات' : 'افتح كل التقارير'}</div><div style="font-size:3rem;margin-bottom:6px;">💎</div><h2 style="font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.3rem;font-weight:900;margin-bottom:5px;">احصل على الباقة الكاملة</h2><p style="font-size:0.84rem;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:16px;">دفعة واحدة فقط · بدون تجديد سنوي</p><div class="uf"><div class="uft"><span style="color:#16a34a">✓</span><strong>+15 قالب احترافي</strong></div><div class="uft"><span style="color:#16a34a">✓</span><strong>تحميلات بلا حدود</strong></div><div class="uft"><span style="color:#16a34a">✓</span>كل الألوان والثيمات</div><div class="uft"><span style="color:#16a34a">✓</span><strong>تحديثات مجانية للأبد</strong></div></div><div class="upb"><div class="upt">🔥 عرض إطلاق محدود</div><div style="display:flex;align-items:baseline;justify-content:center;gap:5px;margin-top:6px;"><span style="font-family:'Reem Kufi','Tajawal',sans-serif;font-size:3.2rem;font-weight:900;color:#ffc107;">30</span><span style="font-size:1.1rem;font-weight:800;color:#ffc107;">ريال</span></div><div style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:4px 14px;border-radius:99px;font-size:0.72rem;font-weight:900;margin-top:4px;">💎 مدى الحياة</div></div><a href="${link}" target="_blank" rel="noopener" class="uct"><span style="font-size:1.2rem">📱</span><span>اشترك عبر الواتساب الآن</span></a><div style="font-size:0.72rem;color:rgba(255,255,255,0.65);font-weight:700;margin-bottom:12px;">🛡️ ضمان استرداد كامل خلال 7 أيام</div></div>`;
  document.body.appendChild(m);
};

window._fbLogout = async function() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.clear();
  await logout();
  window.location.href = 'index.html';
};

// ═══ 🔥 الأهم: فحص الوصول قبل التحميل ═══
// يستدعى من زر التحميل في كل تقرير
window.checkDownloadAccess = async function() {
  // انتظر Firebase ينتهي
  if (!_userReady) {
    for (let i = 0; i < 30 && !_userReady; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // ❌ لا يوجد مستخدم
  if (!_user) {
    sessionStorage.setItem('returnAfterLogin', window.location.pathname.split('/').pop());
    window.location.href = 'login.html';
    return false;
  }

  // 🔥 جلب أحدث Profile مباشرة من Firebase (تجاوز أي cache)
  const freshProfile = await getUserProfile(_user.uid);
  _profile = freshProfile;

  // ✅ مشترك Lifetime - يحمّل بلا حدود
  if (isLifetime(_profile)) {
    return true;
  }

  // 🆓 مستخدم Free
  const used = _profile?.downloadsUsed || 0;
  const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT;

  if (used >= limit) {
    window._fbShowUpgrade();
    return false;
  }

  // زيد العداد
  await incrementDownloadCount(_user.uid);
  const remaining = limit - used - 1;
  if (remaining > 0) {
    showQuickToast(`✨ متبقي لك ${remaining} تحميل مجاني`);
  } else {
    showQuickToast(`🎁 هذا آخر تحميل مجاني!`);
  }
  return true;
};

function showQuickToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#1a3a4e;color:#fff;padding:12px 22px;border-radius:99px;font-family:"Tajawal","Cairo",sans-serif;font-weight:900;font-size:0.85rem;box-shadow:0 12px 30px rgba(0,0,0,0.3);z-index:99998;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

// APIs للتقارير
window.getFirebaseUser = () => _user;
window.getFirebaseProfile = () => _profile;
window.isFirebaseLifetime = () => isLifetime(_profile);
window.isFirebaseAdmin = () => isAdmin(_user);
