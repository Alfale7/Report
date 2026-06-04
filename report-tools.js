// ═══════════════════════════════════════════════════════════
// 🛠️ Report Tools v2 - أدوات عامة لكل التقارير
// ksa2030.one - يعمل تلقائياً في كل صفحة تقرير
// ═══════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────
// 1️⃣ كشف نوع التقرير
// ───────────────────────────────────────────────────────────
function getReportType() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || '';
  return filename.replace(/\.html?$/i, '') || 'unknown';
}

// ───────────────────────────────────────────────────────────
// 2️⃣ ترجمة عربية لأنواع التقارير
// ───────────────────────────────────────────────────────────
const TYPE_NAMES = {
  council: 'محضر مجلس المعلمين',
  enjaz: 'ملف الإنجاز',
  tasis: 'يوم التأسيس',
  watny: 'اليوم الوطني',
  radio: 'الإذاعة المدرسية',
  star: 'النجم الأسبوعي',
  arabic: 'تقرير اللغة العربية',
  exam: 'تقرير الاختبار',
  visit: 'الزيارة التبادلية',
  plan: 'الخطة',
  cert: 'الشهادة',
  teacher: 'تقرير المعلم',
  green: 'تقرير البيئة',
  kg: 'تقرير الأطفال',
  alm: 'تقرير المعلم',
  alm2: 'تقرير المعلم 2',
  report: 'التقرير',
  report2: 'التقرير 2',
  report3: 'التقرير 3',
  report4: 'التقرير 4',
  report5: 'التقرير 5',
  shawahed: 'الشواهد'
};

function getReportTitle() {
  const type = getReportType();
  return TYPE_NAMES[type] || document.title || 'تقرير';
}

// ───────────────────────────────────────────────────────────
// 3️⃣ شاشة تحميل فاخرة
// ───────────────────────────────────────────────────────────
function showLoader(text = '⏳ جاري التحميل...') {
  const loader = document.createElement('div');
  loader.id = '_ksaLoader';
  loader.style.cssText = `
    position:fixed;inset:0;background:rgba(5,10,18,0.95);
    backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    z-index:99999;display:flex;align-items:center;justify-content:center;
    flex-direction:column;gap:20px;
  `;
  loader.innerHTML = `
    <div style="width:60px;height:60px;border:5px solid rgba(232,197,71,0.2);border-top-color:#e8c547;border-radius:50%;animation:_kl 0.8s linear infinite;"></div>
    <div style="font:800 1.1rem 'Tajawal',sans-serif;color:#fff;text-align:center;">${text}</div>
    <style>@keyframes _kl{to{transform:rotate(360deg);}}</style>
  `;
  document.body.appendChild(loader);
  return loader;
}

function hideLoader() {
  const loader = document.getElementById('_ksaLoader');
  if (loader) {
    loader.style.transition = 'opacity 0.4s';
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 400);
  }
}

// ───────────────────────────────────────────────────────────
// 4️⃣ تتبع التصدير
// ───────────────────────────────────────────────────────────
async function logExport(format = 'pdf') {
  // امنع تسجيل مزدوج
  if (window._lastExportTime && (Date.now() - window._lastExportTime < 2000)) {
    console.log('⏭️ تخطي تسجيل مكرر');
    return;
  }
  window._lastExportTime = Date.now();
  
  console.log('📤 محاولة تسجيل تصدير:', format);
  
  // انتظر window.trackExport يصير جاهز (حتى 10 ثواني)
  let attempts = 0;
  while (typeof window.trackExport !== 'function' && attempts < 100) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (typeof window.trackExport === 'function') {
    try {
      await window.trackExport({
        type: getReportType(),
        title: getReportTitle(),
        format: format
      });
      console.log('✅ تم تسجيل التصدير:', getReportType(), format);
      
      // toast بصري للتأكيد
      showDebugToast('✅ تم حفظ في السجل');
    } catch (e) {
      console.error('❌ فشل تسجيل التصدير:', e);
      showDebugToast('❌ فشل التسجيل: ' + e.message);
    }
  } else {
    console.warn('⚠️ window.trackExport لم تتوفر بعد 10 ثواني');
    showDebugToast('⚠️ trackExport غير متاحة');
  }
}

// toast بصري بسيط للتشخيص
function showDebugToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:rgba(15,41,66,0.95);color:#e8c547;
    padding:12px 22px;border-radius:12px;
    font:700 0.88rem 'Tajawal',sans-serif;
    border:1px solid rgba(232,197,71,0.4);
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
    z-index:99998;backdrop-filter:blur(10px);
    animation:_dt 0.3s ease-out;
  `;
  t.textContent = msg;
  const style = document.createElement('style');
  style.textContent = '@keyframes _dt{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
  document.head.appendChild(style);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ───────────────────────────────────────────────────────────
// 5️⃣ مراقبة أزرار التصدير (الاستراتيجية الجديدة)
// ───────────────────────────────────────────────────────────
function hookExportButtons() {
  // قائمة العناصر التي قد تكون أزرار تصدير
  const exportKeywords = [
    'pdf', 'PDF', 'تصدير', 'حفظ', 'تحميل',
    'export', 'save', 'download', 'image', 'صورة',
    'png', 'PNG', 'jpg', 'JPG'
  ];
  
  function isExportButton(el) {
    if (!el || el.tagName !== 'BUTTON' && el.tagName !== 'A') return false;
    
    const text = (el.textContent || '').toLowerCase();
    const onclick = (el.getAttribute('onclick') || '').toLowerCase();
    const cls = (el.className || '').toLowerCase();
    
    return exportKeywords.some(kw => 
      text.includes(kw.toLowerCase()) || 
      onclick.includes(kw.toLowerCase()) ||
      cls.includes('pdf') || cls.includes('export') || cls.includes('download')
    );
  }
  
  function detectFormat(el) {
    const text = (el.textContent || '').toLowerCase();
    const onclick = (el.getAttribute('onclick') || '').toLowerCase();
    
    if (text.includes('png') || text.includes('صورة') || onclick.includes('image') || onclick.includes('png')) {
      return 'png';
    }
    return 'pdf';
  }
  
  // نراقب أي click في الصفحة
  document.addEventListener('click', function(e) {
    let target = e.target;
    
    // ابحث في الـ ancestors إذا الـ target الفعلي ابنه
    for (let i = 0; i < 5 && target; i++) {
      if (isExportButton(target)) {
        const format = detectFormat(target);
        console.log('🎯 اُكتشف زر تصدير:', target.textContent?.trim().substring(0, 30), format);
        
        // سجّل التصدير بعد ثانية (نعطي للتصدير وقت)
        setTimeout(() => {
          logExport(format);
        }, 1500);
        
        return; // اخرج من اللوب
      }
      target = target.parentElement;
    }
  }, true); // capture phase
  
  console.log('🔗 تم تفعيل مراقبة أزرار التصدير');
}

// ───────────────────────────────────────────────────────────
// 6️⃣ استعادة التقرير من السحابة
// ───────────────────────────────────────────────────────────
function tryRestoreFromCloud() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('restore') !== '1') return;
  
  try {
    const stored = localStorage.getItem('ksa_restore_export');
    if (!stored) { cleanupUrl(); return; }
    
    const data = JSON.parse(stored);
    if (!data.content) { cleanupUrl(); return; }
    
    showLoader('⏳ جاري استعادة بياناتك...');
    
    let restored = 0;
    Object.entries(data.content).forEach(([key, value]) => {
      if (!value) return;
      let el = document.getElementById(key);
      if (!el) el = document.querySelector(`[name="${key}"]`);
      if (!el) el = document.querySelector(`[data-field="${key}"]`);
      if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          el.value = value;
        } else {
          el.innerText = value;
        }
        restored++;
      }
    });
    
    if (restored > 0 && typeof window.saveData === 'function') {
      window.saveData();
    }
    
    localStorage.removeItem('ksa_restore_export');
    cleanupUrl();
    
    setTimeout(() => {
      hideLoader();
      if (restored > 0 && typeof window.showToast === 'function') {
        window.showToast(`✅ تمت استعادة ${restored} حقل`);
      }
    }, 400);
  } catch (e) {
    console.warn('فشلت استعادة التقرير:', e);
    hideLoader();
  }
}

function cleanupUrl() {
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// ───────────────────────────────────────────────────────────
// 7️⃣ التشغيل
// ───────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hookExportButtons();
    setTimeout(tryRestoreFromCloud, 500);
  });
} else {
  hookExportButtons();
  setTimeout(tryRestoreFromCloud, 500);
}

console.log('🛠️ Report Tools v3 loaded for:', getReportType());
