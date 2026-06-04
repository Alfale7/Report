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
  
  // انتظر window.trackExport يصير جاهز
  let attempts = 0;
  while (typeof window.trackExport !== 'function' && attempts < 30) {
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
    } catch (e) {
      console.error('❌ فشل تسجيل التصدير:', e);
    }
  } else {
    console.warn('⚠️ window.trackExport غير متاحة بعد');
  }
}

// ───────────────────────────────────────────────────────────
// 5️⃣ مراقبة jsPDF (مع watcher على window.jspdf)
// ───────────────────────────────────────────────────────────
function hookPdfSave() {
  let _jspdfValue = undefined;
  let _hooked = false;
  
  function tryHook(jspdfObj) {
    if (_hooked) return;
    if (!jspdfObj || !jspdfObj.jsPDF) return;
    
    const jsPDF = jspdfObj.jsPDF;
    if (jsPDF.prototype._ksaHooked) return;
    
    const originalSave = jsPDF.prototype.save;
    jsPDF.prototype._ksaHooked = true;
    jsPDF.prototype.save = function(...args) {
      const result = originalSave.apply(this, args);
      logExport('pdf');
      return result;
    };
    
    _hooked = true;
    console.log('🔗 تم ربط jsPDF.save');
  }
  
  // إذا موجود مسبقاً
  if (window.jspdf) {
    tryHook(window.jspdf);
    if (_hooked) return;
  }
  
  // استخدم Object.defineProperty لمراقبة التعيين
  try {
    Object.defineProperty(window, 'jspdf', {
      configurable: true,
      get() { return _jspdfValue; },
      set(v) {
        _jspdfValue = v;
        tryHook(v);
      }
    });
  } catch (e) {
    // fallback: polling
    const interval = setInterval(() => {
      if (window.jspdf) {
        tryHook(window.jspdf);
        clearInterval(interval);
      }
    }, 200);
    setTimeout(() => clearInterval(interval), 10000);
  }
}

// ───────────────────────────────────────────────────────────
// 6️⃣ مراقبة canvas.toBlob (لتصدير الصور)
// ───────────────────────────────────────────────────────────
function hookCanvasExport() {
  if (HTMLCanvasElement.prototype._ksaHooked) return;
  HTMLCanvasElement.prototype._ksaHooked = true;
  
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    return originalToBlob.call(this, function(blob) {
      if (blob && blob.size > 50000) { // تجاهل blobs صغيرة (مش تصدير حقيقي)
        logExport('png');
      }
      if (callback) callback(blob);
    }, ...args);
  };
  console.log('🔗 تم ربط canvas.toBlob');
}

// ───────────────────────────────────────────────────────────
// 7️⃣ استعادة التقرير من السحابة
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
// 8️⃣ التشغيل
// ───────────────────────────────────────────────────────────
hookPdfSave();
hookCanvasExport();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(tryRestoreFromCloud, 500);
  });
} else {
  setTimeout(tryRestoreFromCloud, 500);
}

console.log('🛠️ Report Tools loaded for:', getReportType());
