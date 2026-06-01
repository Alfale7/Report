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
  getUserProfile,
  incrementDownloadCount
} from './firebase-config.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// التقارير التجريبية المجانية (يفتحها أي مستخدم مسجّل)
const FREE_TRIAL_REPORTS = ['tasis.html'];

// 👁️ تقارير المعاينة (تفتح لأي زائر/Free لكن الميزات التفاعلية مقفلة)
// يشاهد كل المحتوى لكن الكتابة/الرفع/التصدير = مدفوع
const VIEW_ONLY_REPORTS = ['report.html', 'tasis.html', 'watny.html', 'alm.html', 'alm2.html', 'green.html', 'shawahed.html', 'enjaz.html', 'kg.html', 'report2.html', 'report3.html', 'report4.html', 'teacher.html', 'arabic.html'];

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

  // 👁️ تقارير المعاينة → افتح للجميع (زائر/Free/Paid) في وضع المعاينة
  // الحماية بتكون على مستوى الميزات التفاعلية فقط
  if (VIEW_ONLY_REPORTS.includes(_currentPage)) {
    hideFullPageLoader();
    removeAllGuards();
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
  // ⚠️ تقرير التأسيس مجاني لكن يحتسب من حد الـ 2 تحميل المجاني
  if (FREE_TRIAL_REPORTS.includes(_currentPage)) {
    const downloadsUsed = _profile?.downloadsUsed || 0;
    const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT || 2;

    if (downloadsUsed >= limit) {
      // ⚠️ خلّص حد المجاني → اقفل
      hideFullPageLoader();
      showSubscribeGate();
      return;
    }

    // لسه عنده تحميلات مجانية
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
  const link = 'pay.html';
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
    #userBadgeFB{
      position:fixed;top:14px;left:14px;z-index:9998;
      display:flex;align-items:center;gap:10px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%),
        linear-gradient(135deg, rgba(15,41,66,0.92) 0%, rgba(26,74,110,0.92) 100%);
      backdrop-filter:blur(20px) saturate(140%);
      -webkit-backdrop-filter:blur(20px) saturate(140%);
      padding:7px 14px 7px 7px;
      border-radius:99px;
      border:1px solid ${admin?'rgba(212,166,87,0.3)':(lifetime?'rgba(58,168,208,0.25)':'rgba(255,255,255,0.1)')};
      box-shadow:
        0 1px 0 rgba(255,255,255,0.08) inset,
        0 12px 28px -8px rgba(0,0,0,0.5),
        0 4px 12px -4px ${admin?'rgba(212,166,87,0.3)':(lifetime?'rgba(30,107,138,0.35)':'rgba(0,0,0,0.4)')};
      font-family:'Tajawal','Cairo',sans-serif;
      cursor:pointer;
      transition:transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease, border-color 0.2s ease;
      -webkit-tap-highlight-color:transparent;
    }
    #userBadgeFB:hover{
      transform:translateY(-2px);
      border-color:${admin?'rgba(212,166,87,0.5)':(lifetime?'rgba(58,168,208,0.45)':'rgba(255,255,255,0.2)')};
      box-shadow:
        0 1px 0 rgba(255,255,255,0.12) inset,
        0 18px 36px -8px rgba(0,0,0,0.6),
        0 6px 16px -4px ${admin?'rgba(212,166,87,0.45)':(lifetime?'rgba(30,107,138,0.5)':'rgba(0,0,0,0.5)')};
    }
    #userBadgeFB:active{transform:translateY(0);}

    #userBadgeFB .av{
      position:relative;
      width:32px;height:32px;
      background:linear-gradient(135deg, ${admin?'#b8923d,#d4a657,#f0b855':(lifetime?'#1e6b8a,#2a8aab,#3aa8d0':'#4a5568,#2d3748')});
      color:#fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:900;font-size:0.88rem;flex-shrink:0;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.25) inset,
        0 3px 10px -2px ${admin?'rgba(212,166,87,0.5)':(lifetime?'rgba(30,107,138,0.5)':'rgba(0,0,0,0.4)')};
    }
    #userBadgeFB .av::after{
      content:"";
      position:absolute;bottom:-1px;left:-1px;
      width:9px;height:9px;
      background:#4caf50;
      border:2px solid #0f2942;
      border-radius:50%;
      box-shadow:0 0 6px rgba(76,175,80,0.6);
    }

    #userBadgeFB .info{
      display:flex;flex-direction:column;gap:0;line-height:1.25;
    }
    #userBadgeFB .nm{
      font-family:'Reem Kufi','Tajawal',sans-serif;
      font-size:0.78rem;font-weight:800;color:#fff;
      max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      letter-spacing:-0.01em;
    }
    #userBadgeFB .pl{
      font-size:0.6rem;font-weight:900;letter-spacing:0.5px;
      color:${admin?'#f0b855':(lifetime?'#a7d8ec':'rgba(255,255,255,0.6)')};
      display:flex;align-items:center;gap:3px;
    }
    #userBadgeFB .pl-ic{font-size:0.65rem;line-height:1;}

    /* القائمة المنسدلة */
    #userBadgeFB-menu{
      position:fixed;top:62px;left:14px;z-index:9999;
      background:linear-gradient(165deg,#0d1925 0%,#12202f 100%);
      backdrop-filter:blur(20px) saturate(140%);
      -webkit-backdrop-filter:blur(20px) saturate(140%);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:14px;padding:6px;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.05) inset,
        0 20px 50px -10px rgba(0,0,0,0.7),
        0 8px 22px -6px rgba(0,0,0,0.5);
      min-width:220px;
      display:none;
      font-family:'Tajawal','Cairo',sans-serif;
      opacity:0;transform:translateY(-8px) scale(0.96);
      transition:opacity 0.2s ease, transform 0.2s cubic-bezier(0.4,0,0.2,1);
      transform-origin:top left;
    }
    #userBadgeFB-menu.show{
      display:block;
      animation:badgeMenuIn 0.22s cubic-bezier(0.4,0,0.2,1) forwards;
    }
    @keyframes badgeMenuIn{
      to{opacity:1;transform:translateY(0) scale(1);}
    }

    #userBadgeFB-menu .mi{
      display:flex;align-items:center;gap:10px;
      padding:10px 12px;border-radius:10px;
      font-size:0.85rem;font-weight:700;
      color:rgba(255,255,255,0.85);
      text-decoration:none;cursor:pointer;
      transition:background 0.15s ease, color 0.15s ease;
    }
    #userBadgeFB-menu .mi:hover{
      background:rgba(255,255,255,0.06);
      color:#fff;
    }
    #userBadgeFB-menu .mi-icon{
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:8px;
      color:rgba(255,255,255,0.7);
      transition:all 0.15s ease;
      flex-shrink:0;
    }
    #userBadgeFB-menu .mi:hover .mi-icon{
      background:rgba(255,255,255,0.1);
      color:#fff;
    }
    #userBadgeFB-menu .mi.upgrade{color:#f0b855;}
    #userBadgeFB-menu .mi.upgrade .mi-icon{
      background:linear-gradient(135deg, rgba(212,166,87,0.18), rgba(240,184,85,0.08));
      border-color:rgba(212,166,87,0.35);
      color:#f0b855;
    }
    #userBadgeFB-menu .mi.upgrade:hover{
      background:linear-gradient(135deg, rgba(212,166,87,0.12), rgba(240,184,85,0.05));
      color:#f0b855;
    }
    #userBadgeFB-menu .mi.upgrade:hover .mi-icon{
      background:linear-gradient(135deg, rgba(212,166,87,0.28), rgba(240,184,85,0.15));
      border-color:rgba(212,166,87,0.5);
    }
    #userBadgeFB-menu .mi.adm{color:#f0b855;}
    #userBadgeFB-menu .mi.adm .mi-icon{
      background:rgba(212,166,87,0.12);
      border-color:rgba(212,166,87,0.3);
      color:#f0b855;
    }
    #userBadgeFB-menu .mi.dn{color:rgba(255,138,128,0.9);}
    #userBadgeFB-menu .mi.dn .mi-icon{
      background:rgba(244,67,54,0.08);
      border-color:rgba(244,67,54,0.2);
      color:#ff8a80;
    }
    #userBadgeFB-menu .mi.dn:hover{
      background:rgba(244,67,54,0.1);
      color:#ff8a80;
    }
    #userBadgeFB-menu .mi.dn:hover .mi-icon{
      background:rgba(244,67,54,0.2);
      border-color:rgba(244,67,54,0.4);
    }
    #userBadgeFB-menu .dv{
      height:1px;background:rgba(255,255,255,0.06);
      margin:4px 8px;
    }
  </style>
  <div class="av">${initial}</div>
  <div class="info">
    <div class="nm">${name}</div>
    <div class="pl">
      ${admin?'<span class="pl-ic">👑</span><span>ADMIN</span>':(lifetime?'<span class="pl-ic">💎</span><span>LIFETIME</span>':'<span>🆓 FREE</span>')}
    </div>
  </div>`;
  document.body.appendChild(b);

  const m = document.createElement('div');
  m.id = 'userBadgeFB-menu';
  m.innerHTML = `
    <a href="index.html" class="mi">
      <span class="mi-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </span>
      <span>الرئيسية</span>
    </a>
    <a href="profile.html" class="mi">
      <span class="mi-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </span>
      <span>الملف الشخصي</span>
    </a>
    ${admin?`
    <a href="admin.html" class="mi adm">
      <span class="mi-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L4 6V12C4 16.4 6.8 20.5 12 22C17.2 20.5 20 16.4 20 12V6L12 2Z"/>
          <path d="M9 12L11 14L15 10"/>
        </svg>
      </span>
      <span>لوحة الإدارة</span>
    </a>`:''}
    ${!lifetime&&!admin?`
    <a href="#" class="mi upgrade" onclick="window._fbShowUpgrade();return false;">
      <span class="mi-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </span>
      <span>اشترك الآن</span>
    </a>`:''}
    <div class="dv"></div>
    <a href="#" class="mi dn" onclick="window._fbLogout();return false;">
      <span class="mi-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </span>
      <span>تسجيل الخروج</span>
    </a>`;
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
window._fbShowUpgrade = function() {
  // ✨ استخدم نفس المودال الفخم اللي للميزات المدفوعة
  if (typeof window.showPremiumFeatureModal === 'function') {
    window.showPremiumFeatureModal('الاشتراك الكامل');
  } else {
    showSubscribeGate();
  }
};
window._fbLogout = async function() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.clear();
  await logout();
  window.location.href = 'index.html';
};

// قديمة - للتوافق - مُحدّثة لاستخدام المودال الجديد
window.checkDownloadAccess = async function() {
  // 👁️ تقارير المعاينة → اعرض المودال الفخم (بدون redirect)
  if (VIEW_ONLY_REPORTS.includes(_currentPage)) {
    if (isLifetime(_profile) || isAdmin(_user)) return true;
    window.showPremiumFeatureModal('تصدير التقرير');
    return false;
  }

  // تقارير عادية → المنطق القديم
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

// 📊 تتبّع التحميلات في Firebase (Real-time)
window.trackDownload = async function() {
  if (!_user) return false;

  // ✅ لو Lifetime أو Admin → بدون عد
  if (isLifetime(_profile) || isAdmin(_user)) {
    return true;
  }

  // ⚠️ Free user → سجّل التحميل
  try {
    const result = await incrementDownloadCount(_user.uid);
    if (result.success) {
      console.log('✅ تم تسجيل التحميل في Firebase');

      // 🔥 بعد الزيادة، إذا تجاوز الحد → اعرض شاشة الاشتراك
      const used = (_profile?.downloadsUsed || 0) + 1;
      const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT || 2;

      if (used >= limit) {
        // التحميل الأخير - اعرض رسالة بعد ثانية
        setTimeout(() => {
          alert('🎁 انتهت تحميلاتك المجانية!\n\nاشترك مرة واحدة فقط بـ 30 ريال للحصول على تحميلات بلا حدود 💎');
          showSubscribeGate();
        }, 800);
      }
      return true;
    }
  } catch (err) {
    console.error('فشل تسجيل التحميل:', err);
  }
  return false;
};

// ✋ فحص قبل التحميل (يمنع التحميل لو تجاوز الحد)
window.canDownload = function() {
  // 👁️ تقارير المعاينة → اعرض المودال الفخم
  if (VIEW_ONLY_REPORTS.includes(_currentPage)) {
    if (isLifetime(_profile) || isAdmin(_user)) return true;
    window.showPremiumFeatureModal('تصدير التقرير');
    return false;
  }

  if (!_user) return false;
  if (isLifetime(_profile) || isAdmin(_user)) return true;

  const used = _profile?.downloadsUsed || 0;
  const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT || 2;

  if (used >= limit) {
    showSubscribeGate();
    alert('🎁 لقد استخدمت جميع تحميلاتك المجانية\n\nاشترك مرة واحدة فقط بـ 30 ريال 💎');
    return false;
  }
  return true;
};

// ═══════════════════════════════════════════════════════
// 🎯 Premium Feature Gate (للوضع التفاعلي: رفع صور / كتابة)
// ═══════════════════════════════════════════════════════
// الفكرة: المستخدم Free يقدر يشوف التقرير بالكامل
// لكن لما يحاول يستخدم ميزة تفاعلية (يكتب أو يرفع صورة)
// يطلع له مودال "اشترك أولاً"

// يرجع true إذا المستخدم Lifetime أو Admin (يقدر يستخدم الميزة)
// يرجع false إذا Free/زائر (ويعرض المودال)
window.isPremiumUser = function() {
  return !!(_user && (isLifetime(_profile) || isAdmin(_user)));
};

// المودال الفخم لميزة مدفوعة
window.showPremiumFeatureModal = function(featureName = 'هذه الميزة') {
  // امنع تعدد المودالات
  if (document.getElementById('premiumFeatureModal')) return;

  const name = _user ? (_profile?.displayName || (_user.email || '').split('@')[0]) : '';
  const isGuest = !_user;
  const link = 'pay.html';

  const m = document.createElement('div');
  m.id = 'premiumFeatureModal';
  m.innerHTML = `<style>
    #premiumFeatureModal{position:fixed;inset:0;z-index:999997;background:rgba(5,10,18,0.72);backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Tajawal','Cairo',sans-serif;animation:pfmFadeIn 0.25s ease-out;}
    @keyframes pfmFadeIn{from{opacity:0;}to{opacity:1;}}
    #premiumFeatureModal *{box-sizing:border-box;}

    #premiumFeatureModal .pfm-card{
      width:100%;max-width:340px;
      background:linear-gradient(165deg,#0d1925 0%,#12202f 100%);
      border:1px solid rgba(212,166,87,0.25);
      border-radius:18px;
      padding:22px 20px 18px;
      color:#eef4f8;position:relative;overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
      animation:pfmSlideUp 0.35s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes pfmSlideUp{from{transform:translateY(16px) scale(0.96);opacity:0;}to{transform:translateY(0) scale(1);opacity:1;}}

    /* خط ذهبي رفيع علوي */
    #premiumFeatureModal .pfm-card::before{
      content:"";position:absolute;top:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent 10%,#f0b855 50%,transparent 90%);
      opacity:0.7;
    }

    /* زر الإغلاق */
    #premiumFeatureModal .pfm-x{
      position:absolute;top:10px;left:10px;
      width:28px;height:28px;
      background:transparent;border:1px solid rgba(255,255,255,0.12);
      color:rgba(255,255,255,0.6);
      border-radius:50%;cursor:pointer;
      font-size:0.95rem;font-weight:500;
      display:flex;align-items:center;justify-content:center;
      transition:all 0.18s;line-height:1;
    }
    #premiumFeatureModal .pfm-x:hover{
      background:rgba(255,255,255,0.08);
      color:#fff;border-color:rgba(255,255,255,0.25);
    }

    /* رأس المودال - أيقونة + شارة */
    #premiumFeatureModal .pfm-head{text-align:center;margin-bottom:16px;}
    #premiumFeatureModal .pfm-badge{
      display:inline-flex;align-items:center;gap:5px;
      background:rgba(212,166,87,0.12);
      border:1px solid rgba(212,166,87,0.3);
      color:#f0b855;
      padding:4px 11px;border-radius:99px;
      font-size:0.68rem;font-weight:800;letter-spacing:0.3px;
      margin-bottom:12px;
    }
    #premiumFeatureModal .pfm-emoji{
      font-size:2.2rem;line-height:1;
      filter:drop-shadow(0 3px 10px rgba(240,184,85,0.4));
      margin-bottom:8px;display:block;
    }

    /* العنوان والوصف */
    #premiumFeatureModal h2{
      font-family:'Reem Kufi','Tajawal',sans-serif;
      font-size:1.15rem;font-weight:800;
      color:#fff;margin-bottom:6px;letter-spacing:-0.2px;
    }
    #premiumFeatureModal .pfm-sub{
      font-size:0.82rem;color:rgba(238,244,248,0.65);
      font-weight:500;line-height:1.55;margin-bottom:0;
    }
    #premiumFeatureModal .pfm-sub strong{color:#f0b855;font-weight:700;}

    /* قائمة المزايا - مدمجة جداً */
    #premiumFeatureModal .pfm-list{
      display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;
      background:rgba(255,255,255,0.02);
      border:1px solid rgba(255,255,255,0.05);
      border-radius:11px;
      padding:10px 12px;margin-bottom:14px;
    }
    #premiumFeatureModal .pfm-li{
      display:flex;align-items:center;gap:5px;
      font-size:0.76rem;font-weight:600;
      color:rgba(238,244,248,0.85);
    }
    #premiumFeatureModal .pfm-li .ck{
      color:#16a34a;font-weight:900;font-size:0.85rem;line-height:1;
    }

    /* السعر - بنر أنيق صغير */
    #premiumFeatureModal .pfm-price{
      display:flex;align-items:center;justify-content:space-between;
      background:linear-gradient(135deg,rgba(212,166,87,0.1),rgba(245,158,11,0.04));
      border:1px solid rgba(212,166,87,0.3);
      border-radius:12px;padding:11px 14px;margin-bottom:12px;
    }
    #premiumFeatureModal .pfm-price-left{display:flex;flex-direction:column;gap:2px;}
    #premiumFeatureModal .pfm-price-label{
      font-size:0.65rem;font-weight:700;
      color:rgba(238,244,248,0.55);letter-spacing:0.4px;
    }
    #premiumFeatureModal .pfm-price-value{
      font-family:'Reem Kufi','Tajawal',sans-serif;
      font-size:1.4rem;font-weight:900;color:#f0b855;
      line-height:1;display:flex;align-items:baseline;gap:3px;
    }
    #premiumFeatureModal .pfm-price-value .cur{font-size:0.85rem;font-weight:700;}
    #premiumFeatureModal .pfm-price-right{
      background:rgba(22,163,74,0.15);
      border:1px solid rgba(22,163,74,0.35);
      color:#22c55e;
      padding:4px 10px;border-radius:99px;
      font-size:0.62rem;font-weight:800;text-align:center;line-height:1.3;
    }

    /* زر CTA رئيسي */
    #premiumFeatureModal .pfm-btn{
      display:flex;align-items:center;justify-content:center;gap:7px;
      width:100%;padding:12px;
      border:none;border-radius:11px;
      font-family:inherit;font-size:0.88rem;font-weight:800;
      cursor:pointer;text-decoration:none;
      transition:all 0.2s;margin-bottom:8px;
    }
    #premiumFeatureModal .pfm-btn-pay{
      background:linear-gradient(135deg,#25d366,#128c7e);
      color:#fff;
      box-shadow:0 6px 16px rgba(37,211,102,0.3);
    }
    #premiumFeatureModal .pfm-btn-pay:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(37,211,102,0.4);}
    #premiumFeatureModal .pfm-btn-login{
      background:linear-gradient(135deg,#2a8aab,#1e6b8a);
      color:#fff;
      box-shadow:0 6px 16px rgba(42,138,171,0.3);
    }
    #premiumFeatureModal .pfm-btn-login:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(42,138,171,0.4);}

    /* رابط ثانوي */
    #premiumFeatureModal .pfm-secondary{
      display:block;text-align:center;padding:8px;
      color:rgba(238,244,248,0.55);
      font-size:0.76rem;font-weight:600;
      text-decoration:none;
      transition:color 0.15s;
    }
    #premiumFeatureModal .pfm-secondary:hover{color:rgba(238,244,248,0.85);}

    /* ضمان (نص صغير) */
    #premiumFeatureModal .pfm-guarantee{
      text-align:center;
      font-size:0.66rem;font-weight:600;
      color:rgba(238,244,248,0.5);
      margin-bottom:4px;
    }
  </style>
  <div class="pfm-card">
    <button class="pfm-x" onclick="document.getElementById('premiumFeatureModal').remove()" aria-label="إغلاق">×</button>

    <div class="pfm-head">
      <div class="pfm-badge">🔒 ميزة مدفوعة</div>
      <span class="pfm-emoji">💎</span>
      <h2>${isGuest ? 'سجّل دخولك للاستخدام' : 'اشترك للاستخدام الكامل'}</h2>
      <p class="pfm-sub">${isGuest ? 'أنت في <strong>وضع المعاينة</strong> — للكتابة ورفع الصور سجّل دخولك أولاً' : `مرحباً ${name} — أنت في <strong>وضع المعاينة</strong>، فعّل اشتراكك لاستخدام كل المزايا`}</p>
    </div>

    <div class="pfm-list">
      <div class="pfm-li"><span class="ck">✓</span><span>كل الحقول</span></div>
      <div class="pfm-li"><span class="ck">✓</span><span>رفع الصور</span></div>
      <div class="pfm-li"><span class="ck">✓</span><span>تصدير PDF</span></div>
      <div class="pfm-li"><span class="ck">✓</span><span>مشاركة</span></div>
      <div class="pfm-li"><span class="ck">✓</span><span>+15 قالب</span></div>
      <div class="pfm-li"><span class="ck">✓</span><span>دعم فني</span></div>
    </div>

    <div class="pfm-price">
      <div class="pfm-price-left">
        <span class="pfm-price-label">اشتراك مدى الحياة</span>
        <span class="pfm-price-value">30 <span class="cur">ريال</span></span>
      </div>
      <div class="pfm-price-right">دفعة<br>واحدة</div>
    </div>

    ${isGuest 
      ? `<a href="login.html" class="pfm-btn pfm-btn-login" onclick="sessionStorage.setItem('returnAfterLogin','${_currentPage}');">
          <span style="font-size:1.05rem">🔑</span>
          <span>تسجيل الدخول</span>
        </a>`
      : `<a href="${link}" target="_blank" rel="noopener" class="pfm-btn pfm-btn-pay">
          <span style="font-size:1.05rem">📱</span>
          <span>اشترك عبر الواتساب</span>
        </a>
        <div class="pfm-guarantee">🛡️ ضمان استرداد كامل خلال 7 أيام</div>`
    }

    <a href="javascript:void(0)" class="pfm-secondary" onclick="document.getElementById('premiumFeatureModal').remove()">
      👁️ متابعة المشاهدة فقط
    </a>
  </div>`;
  document.body.appendChild(m);

  // إغلاق عند الضغط خارج الصندوق
  m.addEventListener('click', (e) => {
    if (e.target.id === 'premiumFeatureModal') m.remove();
  });
};

// دالة موحّدة: تفحص + تعرض المودال + ترجع true/false
window.checkPremiumFeature = function(featureName = 'هذه الميزة') {
  if (window.isPremiumUser()) return true;
  window.showPremiumFeatureModal(featureName);
  return false;
};

// 🎯 ربط تلقائي مع saveAsImage (إن وجدت)
// نُغلّف الدالة الأصلية - بحيث تفحص قبل التحميل ثم تسجّل بعده
setTimeout(() => {
  // 1️⃣ تصدير كصورة (PNG)
  if (typeof window.saveAsImage === 'function') {
    const _original = window.saveAsImage;
    window.saveAsImage = async function(...args) {
      if (!window.canDownload()) return;
      const result = await _original.apply(this, args);
      window.trackDownload();
      return result;
    };
    console.log('🔗 تم ربط saveAsImage بـ Firebase');
  }

  // 2️⃣ تصدير PDF
  if (typeof window.savePDF === 'function') {
    const _originalPDF = window.savePDF;
    window.savePDF = async function(...args) {
      if (!window.canDownload()) return;
      const result = await _originalPDF.apply(this, args);
      window.trackDownload();
      return result;
    };
    console.log('🔗 تم ربط savePDF بـ Firebase');
  }

  // 3️⃣ الطباعة (window.print) - معطّل!
  // ⚠️ الاعتراض كان يكسر window.print في iOS Safari
  // الحماية تتم من خلال بوابة الصفحة (handleAccess)
  // لا حاجة لاعتراض window.print هنا
  console.log('ℹ️ window.print غير معترض - الحماية من بوابة الصفحة');
  window._firebasePrintWrapped = false;

  // 4️⃣ printReport - معطّل أيضاً (لتجنب كسر الطباعة)
  // إذا كان الموقع يستخدم printReport، تشتغل عادي بدون اعتراض
  // الحماية من بوابة الصفحة كافية
  if (typeof window.printReport === 'function') {
    console.log('ℹ️ printReport موجودة - ليست معترضة');
  }

  // 5️⃣ حماية اختصار Ctrl+P / Cmd+P - معطّلة
  // 6️⃣ beforeprint - معطّلة نهائياً (كانت تكسر الطباعة الثانية في iOS)
  // ملاحظة: التتبع للمشتركين Free يتم من خلال beforeprint مرة واحدة فقط
  // لو احتجنا تتبع، نعمله من saveAsImage/savePDF بدلاً من الطباعة
}, 1000);
