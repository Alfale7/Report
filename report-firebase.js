// ═══════════════════════════════════════════════════════════
// 🔥 Firebase Reports v3.0 - ksa2030.one
// نظام صارم: التقرير كله مقفل إلا للمشتركين Lifetime
// ═══════════════════════════════════════════════════════════

import {
  auth,
  db,
  isLifetime,
  isAdmin,
  buildSubscribeWhatsAppLink,
  SITE_CONFIG,
  logout,
  getUserProfile
} from './firebase-config.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// التقارير التجريبية المجانية (يفتحها أي مستخدم مسجّل)
const FREE_TRIAL_REPORTS = ['tasis.html'];

let _user = null;
let _profile = null;
let _profileUnsub = null;
let _currentPage = window.location.pathname.split('/').pop() || 'index.html';
let _isReportPage = !['index.html', 'login.html', 'profile.html', 'admin.html', ''].includes(_currentPage);

// ═══ شاشة التحميل - تخفي التقرير حتى نتأكد ═══
function showFullPageLoader() {
  if (document.getElementById('fbFullLoader')) return;
  const l = document.createElement('div');
  l.id = 'fbFullLoader';
  l.innerHTML = `<style>
    #fbFullLoader{position:fixed;inset:0;z-index:999999;background:linear-gradient(135deg,#0a3447,#1e6b8a);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Tajawal','Cairo',sans-serif;}
    #fbFullLoader .sp{width:56px;height:56px;border:5px solid rgba(255,255,255,0.2);border-top-color:#d4a657;border-radius:50%;animation:fblSpin 0.8s linear infinite;margin-bottom:18px;}
    @keyframes fblSpin{to{transform:rotate(360deg);}}
    #fbFullLoader .tx{font-size:1rem;font-weight:900;opacity:0.95;}
    #fbFullLoader .sub{font-size:0.8rem;font-weight:600;opacity:0.7;margin-top:6px;}
  </style>
  <div class="sp"></div>
  <div class="tx">جاري التحقق من حسابك...</div>
  <div class="sub">لحظة من فضلك</div>`;
  document.body.appendChild(l);
}
function hideFullPageLoader() {
  const l = document.getElementById('fbFullLoader');
  if (l) l.remove();
}

// إظهار شاشة التحميل فوراً للتقارير
if (_isReportPage) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showFullPageLoader);
  } else {
    showFullPageLoader();
  }
}

// ═══ مراقبة Auth + Profile ═══
onAuthStateChanged(auth, (user) => {
  if (_profileUnsub) {
    _profileUnsub();
    _profileUnsub = null;
  }

  if (!user) {
    _user = null;
    _profile = null;
    localStorage.removeItem('loggedUser');
    localStorage.removeItem('isSubscribed');
    handleAccess();
    return;
  }

  _user = user;

  // Real-time listener للبروفايل
  _profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
    const wasLifetime = _profile ? isLifetime(_profile) : null;
    _profile = snap.exists() ? snap.data() : null;
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

    handleAccess();

    // 🎉 تم تفعيل اشتراكه تواً
    if (wasLifetime === false && nowLifetime === true) {
      showToast('🎉 تم تفعيل اشتراكك! تحمّل بلا حدود الآن', 'success');
    }
    // ⚠️ تم إلغاء اشتراكه تواً
    if (wasLifetime === true && nowLifetime === false) {
      showToast('⚠️ تم إلغاء اشتراكك', 'error');
    }
  });
});

// ═══ 🔥 الدالة الرئيسية: قرار الوصول ═══
function handleAccess() {
  // ما نتدخل في الصفحات اللي مش تقارير
  if (!_isReportPage) {
    hideFullPageLoader();
    refreshBadge();
    return;
  }

  // 1️⃣ زائر بدون تسجيل دخول → روح login
  if (!_user) {
    hideFullPageLoader();
    showLoginRequired();
    return;
  }

  // 2️⃣ مشترك Lifetime أو Admin → افتح التقرير
  if (isLifetime(_profile) || isAdmin(_user)) {
    hideFullPageLoader();
    removeAllGuards();
    refreshBadge();
    return;
  }

  // 3️⃣ مستخدم Free
  // إذا تقرير تجريبي مجاني (tasis) → افتح
  if (FREE_TRIAL_REPORTS.includes(_currentPage)) {
    hideFullPageLoader();
    removeAllGuards();
    refreshBadge();
    return;
  }

  // 4️⃣ مستخدم Free يحاول فتح تقرير مدفوع → اقفل + مودال
  hideFullPageLoader();
  showSubscribeGate();
}

function removeAllGuards() {
  const g = document.getElementById('reportLoginGuard');
  if (g) g.remove();
  const s = document.getElementById('subscribeGate');
  if (s) s.remove();
}

// ═══ شاشة "سجّل دخولك" (للزوار) ═══
function showLoginRequired() {
  if (document.getElementById('reportLoginGuard')) return;
  const g = document.createElement('div');
  g.id = 'reportLoginGuard';
  g.innerHTML = `<style>
    #reportLoginGuard{position:fixed;inset:0;z-index:999998;background:linear-gradient(135deg,#0a3447,#1e6b8a);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Tajawal','Cairo',sans-serif;}
    #reportLoginGuard .gc{background:#fff;border-radius:24px;padding:36px 28px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.5);position:relative;overflow:hidden;}
    #reportLoginGuard .gc::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#d4a657,#1e6b8a,#d4a657);}
    #reportLoginGuard .gi{font-size:3.5rem;margin-bottom:10px;display:inline-block;}
    #reportLoginGuard h2{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.35rem;color:#1a3a4e;margin-bottom:8px;}
    #reportLoginGuard p{font-size:0.92rem;color:#5a7080;font-weight:700;line-height:1.7;margin-bottom:20px;}
    #reportLoginGuard .gb{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:linear-gradient(135deg,#1e6b8a,#2a8aab);color:#fff;border-radius:13px;font-size:0.95rem;font-weight:900;text-decoration:none;margin-bottom:10px;}
    #reportLoginGuard .gb-ghost{background:#f0f4f8;color:#1a3a4e;}
  </style>
  <div class="gc">
    <div class="gi">🔐</div>
    <h2>سجّل الدخول للوصول</h2>
    <p>هذا التقرير مخصص لمستخدمي المنصة</p>
    <a href="login.html" class="gb" onclick="sessionStorage.setItem('returnAfterLogin','${_currentPage}');"><span>🔑</span><span>تسجيل الدخول</span></a>
    <a href="index.html" class="gb gb-ghost"><span>🏠</span><span>الرجوع للرئيسية</span></a>
  </div>`;
  document.body.appendChild(g);
}

// ═══ شاشة "اشترك" (للمستخدمين Free) ═══
function showSubscribeGate() {
  if (document.getElementById('subscribeGate')) return;
  const link = buildSubscribeWhatsAppLink(_profile, _user);
  const name = _profile?.displayName || (_user.email || '').split('@')[0];

  const g = document.createElement('div');
  g.id = 'subscribeGate';
  g.innerHTML = `<style>
    #subscribeGate{position:fixed;inset:0;z-index:999998;background:linear-gradient(145deg,#1a1f2e,#2a3a4e);display:flex;align-items:center;justify-content:center;padding:18px;font-family:'Tajawal','Cairo',sans-serif;overflow-y:auto;color:#fff;}
    #subscribeGate .sg{max-width:420px;width:100%;text-align:center;padding:30px 22px;background:rgba(255,255,255,0.04);border:2px solid rgba(212,166,87,0.55);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,0.5);}
    #subscribeGate .ub{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#dc2626,#f59e0b);padding:6px 16px;border-radius:99px;font-size:0.78rem;font-weight:900;margin-bottom:14px;animation:sgPulse 2s ease-in-out infinite;}
    @keyframes sgPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}
    #subscribeGate .ic{font-size:3.6rem;margin-bottom:8px;display:inline-block;filter:drop-shadow(0 4px 10px rgba(212,166,87,0.5));}
    #subscribeGate h2{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.35rem;font-weight:900;margin-bottom:6px;}
    #subscribeGate .su{font-size:0.88rem;color:rgba(255,255,255,0.75);font-weight:700;margin-bottom:18px;line-height:1.6;}
    #subscribeGate .uf{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px 16px;margin-bottom:14px;text-align:right;}
    #subscribeGate .uft{padding:6px 0;font-size:0.86rem;font-weight:700;display:flex;align-items:center;gap:8px;}
    #subscribeGate .uft strong{color:#f4d690;}
    #subscribeGate .upb{background:linear-gradient(135deg,rgba(212,166,87,0.2),rgba(245,158,11,0.1));border:2px solid rgba(212,166,87,0.5);border-radius:16px;padding:16px;margin-bottom:14px;position:relative;}
    #subscribeGate .upt{position:absolute;top:-10px;right:50%;transform:translateX(50%);background:#dc2626;color:#fff;padding:3px 12px;border-radius:99px;font-size:0.7rem;font-weight:900;white-space:nowrap;box-shadow:0 4px 12px rgba(220,38,38,0.4);}
    #subscribeGate .uam{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:3.4rem;font-weight:900;color:#ffc107;line-height:1;}
    #subscribeGate .ucu{font-size:1.15rem;font-weight:800;color:#ffc107;}
    #subscribeGate .uo{display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:5px 16px;border-radius:99px;font-size:0.76rem;font-weight:900;margin-top:6px;}
    #subscribeGate .uct{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:1rem;font-weight:900;text-decoration:none;box-shadow:0 8px 22px rgba(37,211,102,0.45);margin-bottom:10px;box-sizing:border-box;}
    #subscribeGate .ug{font-size:0.76rem;color:rgba(255,255,255,0.7);font-weight:700;margin-bottom:14px;}
    #subscribeGate .actions{display:flex;gap:8px;}
    #subscribeGate .ac{flex:1;padding:11px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:11px;font-family:inherit;font-size:0.82rem;font-weight:800;text-decoration:none;text-align:center;}
    #subscribeGate .ac:hover{background:rgba(255,255,255,0.15);}
  </style>
  <div class="sg">
    <div class="ub">🔒 محتوى مدفوع</div>
    <div class="ic">💎</div>
    <h2>اشترك لفتح هذا التقرير</h2>
    <div class="su">مرحباً ${name} 👋<br>افتح كل القوالب الاحترافية بـ 30 ريال مدى الحياة</div>

    <div class="uf">
      <div class="uft"><span style="color:#16a34a">✓</span><strong>+15 قالب احترافي</strong> معتمد</div>
      <div class="uft"><span style="color:#16a34a">✓</span><strong>تحميلات بلا حدود</strong> · مدى الحياة</div>
      <div class="uft"><span style="color:#16a34a">✓</span>كل الألوان والثيمات</div>
      <div class="uft"><span style="color:#16a34a">✓</span><strong>تحديثات مجانية للأبد</strong></div>
      <div class="uft"><span style="color:#16a34a">✓</span>دعم فني عبر الواتساب</div>
    </div>

    <div class="upb">
      <div class="upt">🔥 عرض إطلاق محدود</div>
      <div style="display:flex;align-items:baseline;justify-content:center;gap:5px;margin-top:8px;">
        <span class="uam">30</span>
        <span class="ucu">ريال</span>
      </div>
      <div class="uo">💎 دفعة واحدة · مدى الحياة</div>
    </div>

    <a href="${link}" target="_blank" rel="noopener" class="uct">
      <span style="font-size:1.3rem">📱</span>
      <span>اشترك عبر الواتساب الآن</span>
    </a>
    <div class="ug">🛡️ ضمان استرداد كامل خلال 7 أيام</div>

    <div class="actions">
      <a href="index.html" class="ac">🏠 الرئيسية</a>
      <a href="tasis.html" class="ac">🎁 جرّب مجاناً</a>
    </div>
  </div>`;
  document.body.appendChild(g);
}

// ═══ شارة المستخدم في الزاوية ═══
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

  const b = document.createElement('div');
  b.id = 'userBadgeFB';
  b.innerHTML = `<style>
    #userBadgeFB{position:fixed;top:14px;left:14px;z-index:9998;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.98);padding:8px 14px 8px 8px;border-radius:99px;box-shadow:0 8px 24px rgba(0,0,0,0.18),0 0 0 1px ${admin?'rgba(124,45,18,0.4)':(lifetime?'rgba(212,166,87,0.4)':'rgba(30,107,138,0.2)')};font-family:'Tajawal','Cairo',sans-serif;cursor:pointer;}
    #userBadgeFB:hover{transform:translateY(-2px);}
    #userBadgeFB .av{width:32px;height:32px;background:linear-gradient(135deg,${admin?'#7c2d12,#b8923d':(lifetime?'#d4a657,#b8923d':'#1e6b8a,#2a8aab')});color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.85rem;flex-shrink:0;}
    #userBadgeFB .nm{font-size:0.78rem;font-weight:900;color:#1a3a4e;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    #userBadgeFB .pl{font-size:0.62rem;font-weight:900;color:${admin?'#7c2d12':(lifetime?'#b8923d':'#5a7080')};}
    #userBadgeFB-menu{position:fixed;top:60px;left:14px;z-index:9999;background:#fff;border-radius:14px;padding:6px;box-shadow:0 18px 50px rgba(0,0,0,0.25);min-width:200px;display:none;font-family:'Tajawal','Cairo',sans-serif;}
    #userBadgeFB-menu.show{display:block;}
    #userBadgeFB-menu .mi{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;font-size:0.85rem;font-weight:800;color:#1a3a4e;text-decoration:none;cursor:pointer;}
    #userBadgeFB-menu .mi:hover{background:#f0f4f8;}
    #userBadgeFB-menu .mi.dn{color:#dc2626;}
    #userBadgeFB-menu .mi.adm{color:#7c2d12;background:#fef3c7;}
    #userBadgeFB-menu .dv{height:1px;background:#e8eef3;margin:4px 0;}
  </style>
  <div class="av">${initial}</div>
  <div><div class="nm">${name}</div><div class="pl">${admin?'👑 ADMIN':(lifetime?'💎 LIFETIME':'🆓 FREE')}</div></div>`;
  document.body.appendChild(b);

  const m = document.createElement('div');
  m.id = 'userBadgeFB-menu';
  m.innerHTML = `<a href="index.html" class="mi"><span>🏠</span><span>الرئيسية</span></a>
    <a href="profile.html" class="mi"><span>👤</span><span>الملف الشخصي</span></a>
    ${admin?'<a href="admin.html" class="mi adm"><span>🛠️</span><span>لوحة الإدارة</span></a>':''}
    ${!lifetime&&!admin?'<a href="#" class="mi" onclick="window._fbShowUpgrade();return false;"><span>💎</span><span>اشترك الآن</span></a>':''}
    <div class="dv"></div>
    <a href="#" class="mi dn" onclick="window._fbLogout();return false;"><span>🚪</span><span>تسجيل الخروج</span></a>`;
  document.body.appendChild(m);

  b.onclick = (e) => { e.stopPropagation(); m.classList.toggle('show'); };
  document.addEventListener('click', () => m.classList.remove('show'));
}

// ═══ Toast ═══
function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${type==='success'?'linear-gradient(135deg,#d4a657,#b8923d)':'linear-gradient(135deg,#dc2626,#991b1b)'};color:#fff;padding:14px 22px;border-radius:18px;font-family:"Tajawal","Cairo",sans-serif;font-weight:900;font-size:0.9rem;box-shadow:0 18px 50px rgba(0,0,0,0.4);z-index:999999;max-width:340px;text-align:center;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 4500);
}

// ═══ APIs مساعدة ═══
window._fbShowUpgrade = function() { showSubscribeGate(); };
window._fbLogout = async function() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.clear();
  await logout();
  window.location.href = 'index.html';
};

// قديمة - للتوافق
window.checkDownloadAccess = async function() {
  if (!_user) {
    sessionStorage.setItem('returnAfterLogin', _currentPage);
    window.location.href = 'login.html';
    return false;
  }
  if (isLifetime(_profile) || isAdmin(_user)) return true;
  showSubscribeGate();
  return false;
};

window.getFirebaseUser = () => _user;
window.getFirebaseProfile = () => _profile;
window.isFirebaseLifetime = () => isLifetime(_profile);
window.isFirebaseAdmin = () => isAdmin(_user);
