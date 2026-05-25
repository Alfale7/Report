// ═══════════════════════════════════════════════════════════
// 🔥 Firebase Reports Integration - ksa2030.one
// ═══════════════════════════════════════════════════════════
// يربط كل ملف تقرير بنظام Firebase
// الاستخدام: <script type="module" src="report-firebase.js"></script>
// ═══════════════════════════════════════════════════════════

import {
  onUserChange,
  isLifetime,
  isSubscribed,
  canDownload,
  incrementDownloadCount,
  buildSubscribeWhatsAppLink,
  SITE_CONFIG,
  logout,
  auth,
  db,
  getUserProfile
} from './firebase-config.js';

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let _user = null;
let _profile = null;
let _userReady = false;
let _profileUnsubscribe = null;

// ═══ شاشة انتظار قصيرة أثناء تحميل Firebase ═══
function showInitLoader() {
  if (document.getElementById('fbInitLoader')) return;
  const loader = document.createElement('div');
  loader.id = 'fbInitLoader';
  loader.innerHTML = `
    <style>
      #fbInitLoader{position:fixed;inset:0;z-index:99997;background:rgba(10,52,71,0.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Tajawal','Cairo',sans-serif;}
      #fbInitLoader .fbi-spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top-color:#d4a657;border-radius:50%;animation:fbiSpin 0.8s linear infinite;margin-bottom:14px;}
      @keyframes fbiSpin{to{transform:rotate(360deg);}}
      #fbInitLoader .fbi-text{font-size:0.9rem;font-weight:800;opacity:0.9;}
    </style>
    <div class="fbi-spinner"></div>
    <div class="fbi-text">جاري التحقق من حسابك...</div>
  `;
  document.body.appendChild(loader);
}
function hideInitLoader() {
  const loader = document.getElementById('fbInitLoader');
  if (loader) loader.remove();
}

// إظهار شاشة الانتظار فور التحميل
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showInitLoader);
} else {
  showInitLoader();
}

// ═══ مراقبة حالة المستخدم ═══
onUserChange(async (data) => {
  _userReady = true;
  hideInitLoader();

  // إلغاء أي مراقبة سابقة
  if (_profileUnsubscribe) {
    _profileUnsubscribe();
    _profileUnsubscribe = null;
  }

  if (data?.user) {
    _user = data.user;
    _profile = data.profile;

    // 🔥 مراقبة لحظية للتحديثات (لما الأدمن يفعّل)
    _profileUnsubscribe = onSnapshot(doc(db, 'users', _user.uid), (snap) => {
      if (snap.exists()) {
        const oldPlan = _profile?.plan;
        _profile = snap.data();

        // ⚡ مزامنة فورية وقوية مع localStorage
        const phoneFromEmail = (_user.email || '').split('@')[0];
        const userPhone = _profile?.legacyPhone || phoneFromEmail || _user.phoneNumber || _user.uid;
        localStorage.setItem('loggedUser', userPhone);

        if (isLifetime(_profile)) {
          // ⚡ Lifetime - مسح أي قيود قديمة
          localStorage.setItem('isSubscribed', '1');
          localStorage.removeItem('free_downloads_used');

          // إذا تم التفعيل تواً (انتقل من free إلى lifetime)
          if (oldPlan === 'free' && _profile.plan === 'lifetime') {
            showActivationToast();

            // قفل أي مودال اشتراك مفتوح
            const upgradeModal = document.getElementById('fbUpgradeModal');
            if (upgradeModal) upgradeModal.style.display = 'none';

            // قفل أي مودال قديم
            document.querySelectorAll('#tasisUpgradeModal,#upgradeModal,[id*="UpgradeModal"]').forEach(m => {
              m.style.display = 'none';
            });

            // قفل شاشة "سجّل الدخول"
            const guard = document.getElementById('reportLoginGuard');
            if (guard) guard.remove();

            // حدث الشارة
            const badge = document.getElementById('userBadgeFB');
            const menu = document.getElementById('userBadgeFB-menu');
            if (badge) badge.remove();
            if (menu) menu.remove();
            addUserBadge();
          }
        } else {
          localStorage.removeItem('isSubscribed');
        }
      }
    });

    // مزامنة فورية مع localStorage القديم للتوافق
    const phoneFromEmail = (_user.email || '').split('@')[0];
    const userPhone = _profile?.legacyPhone || phoneFromEmail || _user.phoneNumber || _user.uid;
    localStorage.setItem('loggedUser', userPhone);

    if (isLifetime(_profile)) {
      localStorage.setItem('isSubscribed', '1');
      localStorage.removeItem('free_downloads_used'); // ⚡ مسح القيود القديمة
    } else {
      localStorage.removeItem('isSubscribed');
    }

    // إخفاء أي مودال دخول قديم
    document.querySelectorAll('[id*="loginModal"],[id*="login-modal"]').forEach(m => {
      if (m.style) m.style.display = 'none';
      m.classList?.remove('show', 'active');
    });

    // إضافة شارة "مشترك Lifetime" في الزاوية
    addUserBadge();

  } else {
    _user = null;
    _profile = null;
    localStorage.removeItem('loggedUser');
    localStorage.removeItem('isSubscribed');

    // المستخدم غير مسجّل - يطلب تسجيل دخول
    if (!document.getElementById('reportLoginGuard')) {
      showLoginRequired();
    }
  }
});

// ═══ Toast إعلان التفعيل ═══
function showActivationToast() {
  // أزل القديم لو موجود
  const old = document.getElementById('activationToast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'activationToast';
  toast.innerHTML = `
    <style>
      #activationToast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#d4a657,#b8923d);color:#fff;padding:18px 24px;border-radius:18px;font-family:'Tajawal','Cairo',sans-serif;font-weight:900;box-shadow:0 18px 50px rgba(212,166,87,0.5);z-index:99999;animation:actToastIn 0.5s cubic-bezier(0.34,1.56,0.64,1);max-width:340px;text-align:center;border:2px solid rgba(255,255,255,0.3);}
      @keyframes actToastIn{from{opacity:0;transform:translate(-50%,-30px) scale(0.9);}to{opacity:1;transform:translate(-50%,0) scale(1);}}
      #activationToast .at-icon{font-size:2.5rem;margin-bottom:6px;display:block;animation:atBounce 0.6s ease-in-out infinite alternate;}
      @keyframes atBounce{from{transform:translateY(0);}to{transform:translateY(-6px);}}
      #activationToast .at-title{font-size:1.05rem;margin-bottom:4px;}
      #activationToast .at-sub{font-size:0.82rem;font-weight:700;opacity:0.95;line-height:1.5;}
    </style>
    <span class="at-icon">🎉</span>
    <div class="at-title">تم تفعيل اشتراكك!</div>
    <div class="at-sub">مرحباً بك في عائلة المشتركين 💎<br>تحمّل بلا حدود الآن</div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -20px)';
    setTimeout(() => toast.remove(), 500);
  }, 5500);
}

// ═══ شارة المستخدم ═══
function addUserBadge() {
  if (document.getElementById('userBadgeFB')) return;

  const badge = document.createElement('div');
  badge.id = 'userBadgeFB';
  const lifetime = isLifetime(_profile);
  const name = _profile?.displayName || (_user.email || '').split('@')[0] || 'مستخدم';
  const initial = name.charAt(0).toUpperCase();

  badge.innerHTML = `
    <style>
      #userBadgeFB{position:fixed;top:14px;left:14px;z-index:9998;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.98);padding:8px 14px 8px 8px;border-radius:99px;box-shadow:0 8px 24px rgba(0,0,0,0.18),0 0 0 1px ${lifetime ? 'rgba(212,166,87,0.4)' : 'rgba(30,107,138,0.2)'};font-family:'Tajawal','Cairo',sans-serif;cursor:pointer;transition:all 0.2s;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
      #userBadgeFB:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,0.25);}
      #userBadgeFB .avatar{width:32px;height:32px;background:linear-gradient(135deg,${lifetime ? '#d4a657,#b8923d' : '#1e6b8a,#2a8aab'});color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.85rem;flex-shrink:0;}
      #userBadgeFB .info{display:flex;flex-direction:column;line-height:1.2;}
      #userBadgeFB .name{font-size:0.78rem;font-weight:900;color:#1a3a4e;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #userBadgeFB .plan{font-size:0.62rem;font-weight:900;color:${lifetime ? '#b8923d' : '#5a7080'};letter-spacing:0.3px;}
      #userBadgeFB-menu{position:fixed;top:60px;left:14px;z-index:9999;background:#fff;border-radius:14px;padding:6px;box-shadow:0 18px 50px rgba(0,0,0,0.25),0 0 0 1px rgba(0,0,0,0.08);min-width:200px;display:none;animation:badgeMenuIn 0.2s;font-family:'Tajawal','Cairo',sans-serif;}
      #userBadgeFB-menu.show{display:block;}
      @keyframes badgeMenuIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
      #userBadgeFB-menu .menu-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;font-size:0.85rem;font-weight:800;color:#1a3a4e;cursor:pointer;transition:background 0.15s;text-decoration:none;}
      #userBadgeFB-menu .menu-item:hover{background:#f0f4f8;}
      #userBadgeFB-menu .menu-item.danger{color:#dc2626;}
      #userBadgeFB-menu .menu-item.danger:hover{background:#fef2f2;}
      #userBadgeFB-menu .menu-divider{height:1px;background:#e8eef3;margin:4px 0;}
      @media (max-width:480px){
        #userBadgeFB{top:10px;left:10px;padding:6px 12px 6px 6px;}
        #userBadgeFB .avatar{width:28px;height:28px;font-size:0.78rem;}
        #userBadgeFB .name{font-size:0.74rem;max-width:80px;}
        #userBadgeFB .plan{font-size:0.58rem;}
      }
    </style>
    <div class="avatar">${initial}</div>
    <div class="info">
      <div class="name">${name}</div>
      <div class="plan">${lifetime ? '💎 LIFETIME' : '🆓 FREE'}</div>
    </div>
  `;

  document.body.appendChild(badge);

  // قائمة منسدلة
  const menu = document.createElement('div');
  menu.id = 'userBadgeFB-menu';
  menu.innerHTML = `
    <a href="index.html" class="menu-item"><span>🏠</span><span>الرئيسية</span></a>
    <a href="profile.html" class="menu-item"><span>👤</span><span>الملف الشخصي</span></a>
    ${!lifetime ? '<a href="#" class="menu-item" onclick="window._fbShowUpgrade();return false;"><span>💎</span><span>اشترك الآن</span></a>' : ''}
    <div class="menu-divider"></div>
    <a href="#" class="menu-item danger" onclick="window._fbLogout();return false;"><span>🚪</span><span>تسجيل الخروج</span></a>
  `;
  document.body.appendChild(menu);

  badge.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  };
  document.addEventListener('click', () => menu.classList.remove('show'));
}

// ═══ شاشة "يجب تسجيل الدخول" ═══
function showLoginRequired() {
  const guard = document.createElement('div');
  guard.id = 'reportLoginGuard';
  guard.innerHTML = `
    <style>
      #reportLoginGuard{position:fixed;inset:0;z-index:99999;background:rgba(10,52,71,0.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Tajawal','Cairo',sans-serif;animation:guardFadeIn 0.4s;}
      @keyframes guardFadeIn{from{opacity:0;}to{opacity:1;}}
      #reportLoginGuard .gcard{background:#fff;border-radius:24px;padding:36px 28px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.5);position:relative;overflow:hidden;}
      #reportLoginGuard .gcard::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#d4a657,#1e6b8a,#d4a657);background-size:200% 100%;animation:rainbow 3s linear infinite;}
      @keyframes rainbow{0%{background-position:0% 0;}100%{background-position:200% 0;}}
      #reportLoginGuard .gicon{font-size:3.5rem;margin-bottom:10px;animation:lockPulse 2s ease-in-out infinite;display:inline-block;}
      @keyframes lockPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}
      #reportLoginGuard h2{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.35rem;color:#1a3a4e;margin-bottom:8px;}
      #reportLoginGuard p{font-size:0.92rem;color:#5a7080;font-weight:700;line-height:1.7;margin-bottom:20px;}
      #reportLoginGuard .gbtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:linear-gradient(135deg,#1e6b8a,#2a8aab);color:#fff;border:none;border-radius:13px;font-family:inherit;font-size:0.95rem;font-weight:900;cursor:pointer;box-shadow:0 8px 22px rgba(30,107,138,0.4);transition:transform 0.2s;text-decoration:none;}
      #reportLoginGuard .gbtn:hover{transform:translateY(-2px);}
      #reportLoginGuard .gbtn-ghost{background:#f0f4f8;color:#1a3a4e;box-shadow:none;margin-top:10px;}
      #reportLoginGuard .gfeat{display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.74rem;color:#16a34a;font-weight:900;margin-top:14px;padding:8px 12px;background:#dcfce7;border-radius:99px;}
    </style>
    <div class="gcard">
      <div class="gicon">🔐</div>
      <h2>سجّل الدخول للوصول</h2>
      <p>هذا التقرير مخصص لمستخدمي المنصة<br>سجّل دخولك أو أنشئ حساباً جديداً (مجاناً)</p>
      <a href="login.html" class="gbtn">
        <span>🔑</span><span>تسجيل الدخول</span>
      </a>
      <a href="index.html" class="gbtn gbtn-ghost">
        <span>🏠</span><span>الرجوع للرئيسية</span>
      </a>
      <div class="gfeat">
        <span>✨</span><span>تقريران مجانيان عند إنشاء حساب جديد</span>
      </div>
    </div>
  `;
  document.body.appendChild(guard);
}

// ═══ مودال "اشترك الآن" ═══
window._fbShowUpgrade = function() {
  if (document.getElementById('fbUpgradeModal')) {
    document.getElementById('fbUpgradeModal').style.display = 'flex';
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'fbUpgradeModal';
  const link = buildSubscribeWhatsAppLink(_profile, _user);
  const used = _profile?.downloadsUsed || 0;
  const limit = _profile?.downloadsLimit || SITE_CONFIG.FREE_DOWNLOADS_LIMIT;

  modal.innerHTML = `
    <style>
      #fbUpgradeModal{position:fixed;inset:0;z-index:99999;background:rgba(0,15,30,0.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;font-family:'Tajawal','Cairo',sans-serif;animation:guardFadeIn 0.3s;overflow-y:auto;}
      #fbUpgradeModal .ucard{background:linear-gradient(145deg,#1a1f2e,#2a3a4e);border:2px solid rgba(212,166,87,0.55);border-radius:24px;padding:28px 22px 22px;max-width:420px;width:100%;text-align:center;position:relative;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,0.7);max-height:92vh;overflow-y:auto;}
      #fbUpgradeModal .uclose{position:absolute;top:12px;left:12px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;font-weight:900;display:flex;align-items:center;justify-content:center;font-family:inherit;}
      #fbUpgradeModal .ulimit-banner{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#dc2626,#f59e0b);padding:5px 14px;border-radius:99px;font-size:0.74rem;font-weight:900;margin-bottom:10px;box-shadow:0 6px 18px rgba(220,38,38,0.4);}
      #fbUpgradeModal .uicon{font-size:3rem;margin-bottom:6px;display:inline-block;filter:drop-shadow(0 4px 8px rgba(212,166,87,0.5));}
      #fbUpgradeModal .utitle{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:1.3rem;font-weight:900;color:#fff;margin-bottom:5px;}
      #fbUpgradeModal .usub{font-size:0.84rem;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:16px;line-height:1.6;}
      #fbUpgradeModal .ufeatures{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:13px 16px;margin-bottom:14px;text-align:right;}
      #fbUpgradeModal .ufeat{padding:5px 0;font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.95);display:flex;align-items:center;gap:8px;}
      #fbUpgradeModal .ufeat strong{color:#f4d690;}
      #fbUpgradeModal .uprice-block{background:linear-gradient(135deg,rgba(212,166,87,0.2),rgba(245,158,11,0.1));border:2px solid rgba(212,166,87,0.5);border-radius:16px;padding:14px;margin-bottom:14px;position:relative;}
      #fbUpgradeModal .uprice-tag{position:absolute;top:-10px;right:50%;transform:translateX(50%);background:#dc2626;color:#fff;padding:3px 12px;border-radius:99px;font-size:0.68rem;font-weight:900;letter-spacing:0.5px;white-space:nowrap;}
      #fbUpgradeModal .uprice-row{display:flex;align-items:baseline;justify-content:center;gap:5px;margin-top:8px;}
      #fbUpgradeModal .uprice-amount{font-family:'Reem Kufi','Tajawal',sans-serif;font-size:3.2rem;font-weight:900;color:#ffc107;line-height:1;}
      #fbUpgradeModal .uprice-cur{font-size:1.1rem;font-weight:800;color:#ffc107;}
      #fbUpgradeModal .uprice-once{display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:4px 14px;border-radius:99px;font-size:0.72rem;font-weight:900;margin-top:4px;}
      #fbUpgradeModal .ucta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:0.96rem;font-weight:900;cursor:pointer;text-decoration:none;box-shadow:0 8px 22px rgba(37,211,102,0.4);margin-bottom:8px;box-sizing:border-box;transition:transform 0.2s;}
      #fbUpgradeModal .ucta:hover{transform:translateY(-2px);}
      #fbUpgradeModal .ulater{background:transparent;border:none;color:rgba(255,255,255,0.5);font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;padding:8px;text-decoration:underline;}
      #fbUpgradeModal .uguarantee{font-size:0.72rem;color:rgba(255,255,255,0.65);font-weight:700;margin-bottom:12px;}
    </style>
    <div class="ucard">
      <button class="uclose" onclick="document.getElementById('fbUpgradeModal').style.display='none';">×</button>

      <div class="ulimit-banner">
        <span>🔒</span>
        <span>استخدمت ${used} من ${limit} تحميلات مجانية</span>
      </div>

      <div class="uicon">💎</div>
      <h2 class="utitle">افتح كل الميزات بـ 30 ريال</h2>
      <p class="usub">دفعة واحدة فقط · بدون تجديد سنوي</p>

      <div class="ufeatures">
        <div class="ufeat"><span style="color:#16a34a">✓</span> <strong>+15 قالب احترافي</strong> معتمد</div>
        <div class="ufeat"><span style="color:#16a34a">✓</span> <strong>تحميلات بلا حدود</strong> · مدى الحياة</div>
        <div class="ufeat"><span style="color:#16a34a">✓</span> كل الألوان والثيمات</div>
        <div class="ufeat"><span style="color:#16a34a">✓</span> <strong>تحديثات مجانية</strong> للأبد</div>
        <div class="ufeat"><span style="color:#16a34a">✓</span> دعم فني مباشر عبر الواتساب</div>
      </div>

      <div class="uprice-block">
        <div class="uprice-tag">🔥 عرض إطلاق محدود</div>
        <div class="uprice-row">
          <span class="uprice-amount">30</span>
          <span class="uprice-cur">ريال</span>
        </div>
        <div class="uprice-once">💎 مدى الحياة</div>
      </div>

      <a href="${link}" target="_blank" rel="noopener" class="ucta">
        <span style="font-size:1.2rem">📱</span>
        <span>اشترك عبر الواتساب الآن</span>
      </a>

      <div class="uguarantee">🛡️ ضمان استرداد كامل خلال 7 أيام</div>

      <button class="ulater" onclick="document.getElementById('fbUpgradeModal').style.display='none';">ربما لاحقاً</button>
    </div>
  `;

  document.body.appendChild(modal);
};

// ═══ تسجيل خروج ═══
window._fbLogout = async function() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.removeItem('loggedUser');
  localStorage.removeItem('isSubscribed');
  await logout();
  window.location.href = 'index.html';
};

// ═══ دالة فحص قبل التحميل (نستدعيها من زر تحميل) ═══
window.checkDownloadAccess = async function() {
  if (!_userReady) {
    alert('جاري التحقق من حسابك، الرجاء الانتظار...');
    return false;
  }

  if (!_user) {
    showLoginRequired();
    return false;
  }

  const check = canDownload(_profile);
  if (!check.allowed) {
    window._fbShowUpgrade();
    return false;
  }

  // مسموح - زيد العداد
  if (check.reason === 'free_trial') {
    await incrementDownloadCount(_user.uid);

    // حدث الـ profile محلياً
    if (_profile) {
      _profile.downloadsUsed = (_profile.downloadsUsed || 0) + 1;
      const remaining = (_profile.downloadsLimit || 2) - _profile.downloadsUsed;
      if (remaining > 0) {
        showQuickToast(`✨ متبقي لك ${remaining} تحميل${remaining === 1 ? '' : 'ات'} مجاني${remaining === 1 ? '' : 'ة'}`);
      }
    }
  }

  return true;
};

// ═══ Toast إعلان سريع ═══
function showQuickToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#1a3a4e;color:#fff;padding:12px 22px;border-radius:99px;font-family:"Tajawal","Cairo",sans-serif;font-weight:900;font-size:0.85rem;box-shadow:0 12px 30px rgba(0,0,0,0.3);z-index:99998;animation:toastIn 0.3s;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// إتاحة المستخدم للنوافذ الأخرى لو احتاج
window.getFirebaseUser = () => _user;
window.getFirebaseProfile = () => _profile;
window.isFirebaseLifetime = () => isLifetime(_profile);
