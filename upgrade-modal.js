// ═══════════════════════════════════════════════════════════
// 🎁 Upgrade Modal مشترك - 30 ريال مدى الحياة
// ═══════════════════════════════════════════════════════════
// يُستخدم في كل ملفات التقارير
// ═══════════════════════════════════════════════════════════
//
// طريقة الاستخدام في أي تقرير:
// 1. أضف <script type="module" src="upgrade-modal.js"></script>
// 2. استدعِ: showUpgradeModal()
//
// أو نسخ الكود مباشرة داخل ملف التقرير
// ═══════════════════════════════════════════════════════════

import { SITE_CONFIG, buildSubscribeWhatsAppLink, onUserChange } from './firebase-config.js';

let _currentProfile = null;
let _currentUser = null;

// نتابع المستخدم لبناء رابط WhatsApp ديناميكي
onUserChange((data) => {
  if (data) {
    _currentUser = data.user;
    _currentProfile = data.profile;
  }
});

export function showUpgradeModal() {
  let modal = document.getElementById('lifetimeUpgradeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'lifetimeUpgradeModal';
    modal.innerHTML = `
      <div class="lum-overlay" onclick="if(event.target===this)closeLifetimeModal()">
        <div class="lum-card">
          <button class="lum-close" onclick="closeLifetimeModal()">✕</button>

          <div class="lum-icon">💎</div>

          <h2 class="lum-title">انتهت تحميلاتك المجانية!</h2>
          <p class="lum-subtitle">استمتعت بالقوالب؟ احصل على كل شي بـ 30 ريال فقط</p>

          <div class="lum-features">
            <div class="lum-feat">✅ <strong>15 قالب احترافي</strong> معتمد</div>
            <div class="lum-feat">✅ <strong>تحميلات بلا حدود</strong> · مدى الحياة</div>
            <div class="lum-feat">✅ كل الألوان والثيمات</div>
            <div class="lum-feat">✅ <strong>تحديثات مجانية</strong> للأبد</div>
            <div class="lum-feat">✅ دعم فني عبر الواتساب</div>
          </div>

          <div class="lum-price-block">
            <div class="lum-once">دفعة واحدة فقط 🔥</div>
            <div class="lum-price-new">
              <span class="lum-amount">30</span>
              <span class="lum-currency">ريال</span>
            </div>
            <div class="lum-lifetime-badge">💎 مدى الحياة · بدون تجديد</div>
          </div>

          <div class="lum-social">🔥 انضم لأكثر من 500+ معلم اشتركوا</div>
          <div class="lum-guarantee">🛡️ ضمان استرداد كامل خلال 7 أيام</div>

          <a href="#" target="_blank" rel="noopener" class="lum-cta" id="lumWhatsappBtn">
            <span style="font-size:1.25rem">📱</span>
            <span>اشترك عبر الواتساب الآن</span>
          </a>

          <button class="lum-later" onclick="closeLifetimeModal()">ربما لاحقاً</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = `
      .lum-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,15,30,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;font-family:'Tajawal','Cairo',sans-serif;}
      .lum-card{background:linear-gradient(135deg,#1a1f2e,#2a3a4e);border:2px solid rgba(212,166,87,0.5);border-radius:24px;padding:30px 24px 22px;max-width:420px;width:100%;text-align:center;position:relative;box-shadow:0 25px 70px rgba(0,0,0,0.7);max-height:92vh;overflow-y:auto;}
      .lum-close{position:absolute;top:14px;left:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:inherit;}
      .lum-icon{font-size:3.2rem;margin-bottom:8px;display:inline-block;filter:drop-shadow(0 4px 8px rgba(212,166,87,0.5));}
      .lum-title{font-family:'Reem Kufi','Cairo','Tajawal',sans-serif;font-size:1.32rem;font-weight:900;color:#fff;margin-bottom:6px;}
      .lum-subtitle{font-size:0.84rem;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:18px;line-height:1.6;}
      .lum-features{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px 16px;margin-bottom:16px;text-align:right;}
      .lum-feat{padding:6px 0;font-size:0.86rem;font-weight:600;color:rgba(255,255,255,0.95);}
      .lum-feat strong{color:#f4d690;}
      .lum-price-block{background:linear-gradient(135deg,rgba(212,166,87,0.18),rgba(245,158,11,0.1));border:2px solid rgba(212,166,87,0.45);border-radius:16px;padding:14px 16px 14px;margin-bottom:14px;position:relative;}
      .lum-once{position:absolute;top:-10px;right:50%;transform:translateX(50%);background:#dc2626;color:#fff;padding:3px 12px;border-radius:99px;font-size:0.7rem;font-weight:900;letter-spacing:0.5px;}
      .lum-price-new{display:flex;align-items:baseline;justify-content:center;gap:6px;margin-top:6px;margin-bottom:4px;}
      .lum-amount{font-family:'Reem Kufi','Cairo','Tajawal',sans-serif;font-size:3rem;font-weight:900;color:#ffc107;line-height:1;}
      .lum-currency{font-size:1.1rem;font-weight:800;color:#ffc107;}
      .lum-lifetime-badge{display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:5px 14px;border-radius:99px;font-size:0.74rem;font-weight:900;letter-spacing:0.5px;margin-top:4px;}
      .lum-social{background:rgba(212,166,87,0.12);border:1px solid rgba(212,166,87,0.3);color:#f4d690;padding:8px 14px;border-radius:99px;font-size:0.76rem;font-weight:700;margin-bottom:10px;}
      .lum-guarantee{color:rgba(255,255,255,0.7);font-size:0.74rem;font-weight:600;margin-bottom:16px;}
      .lum-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px 20px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:0.98rem;font-weight:900;cursor:pointer;text-decoration:none;box-shadow:0 8px 24px rgba(37,211,102,0.4);margin-bottom:8px;box-sizing:border-box;}
      .lum-cta:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(37,211,102,0.5);}
      .lum-later{background:transparent;border:none;color:rgba(255,255,255,0.5);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer;padding:8px;text-decoration:underline;}
      @media (max-width:480px){.lum-card{padding:24px 20px 20px;}.lum-icon{font-size:2.6rem;}.lum-title{font-size:1.15rem;}.lum-amount{font-size:2.4rem;}.lum-cta{font-size:0.9rem;padding:13px 16px;}}
    `;
    document.head.appendChild(style);

    // الإغلاق
    window.closeLifetimeModal = function() {
      const m = document.getElementById('lifetimeUpgradeModal');
      if (m) m.style.display = 'none';
      document.body.style.overflow = '';
    };
  }

  // تحديث رابط WhatsApp
  const btn = document.getElementById('lumWhatsappBtn');
  if (btn) {
    btn.href = buildSubscribeWhatsAppLink(_currentProfile, _currentUser);
  }

  document.body.style.overflow = 'hidden';
  modal.style.display = 'block';
}

// إتاحة الدالة عالمياً
window.showLifetimeUpgrade = showUpgradeModal;
