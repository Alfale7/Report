// ═══════════════════════════════════════════════════════════
// 🛠️ Report Tools - أدوات عامة لكل التقارير
// ksa2030.one - يعمل تلقائياً في كل صفحة تقرير
// ═══════════════════════════════════════════════════════════
//
// كيف يشتغل:
// 1. يكتشف نوع التقرير من اسم الصفحة (council.html → council)
// 2. يستعيد البيانات تلقائياً لو ?restore=1
// 3. يلتقط تصدير PDF/PNG تلقائياً ويحفظه في السجل
//
// الاستخدام:
// <script type="module" src="./report-tools.js"></script>
// (يضاف لكل ملف تقرير)
//
// ═══════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────
// 1️⃣ كشف نوع التقرير
// ───────────────────────────────────────────────────────────
function getReportType() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || '';
  const type = filename.replace(/\.html?$/i, '') || 'unknown';
  return type;
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
// 4️⃣ استعادة التقرير من السحابة (?restore=1)
// ───────────────────────────────────────────────────────────
function tryRestoreFromCloud() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('restore') !== '1') return;
  
  try {
    const stored = localStorage.getItem('ksa_restore_export');
    if (!stored) {
      cleanupUrl();
      return;
    }
    
    const data = JSON.parse(stored);
    if (!data.content) {
      cleanupUrl();
      return;
    }
    
    const loader = showLoader('⏳ جاري استعادة بياناتك...');
    
    // عبّي الحقول
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
// 5️⃣ التقاط التصدير تلقائياً
// ───────────────────────────────────────────────────────────
// نراقب jsPDF.save() ولما يتم تصدير، نسجله

function hookPdfSave() {
  // انتظر jsPDF يحمل
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (attempts > 40) { // 4 ثواني
      clearInterval(checkInterval);
      return;
    }
    
    // ابحث عن jsPDF
    let jsPDF = null;
    if (window.jspdf?.jsPDF) jsPDF = window.jspdf.jsPDF;
    else if (window.jsPDF) jsPDF = window.jsPDF;
    
    if (!jsPDF) return;
    
    clearInterval(checkInterval);
    
    // اربط على prototype.save
    if (jsPDF.prototype._originalSave) return; // تم بالفعل
    
    jsPDF.prototype._originalSave = jsPDF.prototype.save;
    jsPDF.prototype.save = function(...args) {
      const result = this._originalSave.apply(this, args);
      
      // سجل التصدير
      setTimeout(() => {
        if (typeof window.trackExport === 'function') {
          window.trackExport({
            type: getReportType(),
            title: getReportTitle(),
            format: 'pdf'
          });
        }
      }, 100);
      
      return result;
    };
    
    console.log('✅ تم ربط jsPDF.save بـ trackExport');
  }, 100);
}

// ───────────────────────────────────────────────────────────
// 6️⃣ التقاط تصدير الصور (canvas.toBlob/toDataURL)
// ───────────────────────────────────────────────────────────
function hookCanvasExport() {
  // نراقب أي canvas يستخدم toBlob لـ تنزيل صورة
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    return originalToBlob.call(this, function(blob) {
      // سجل التصدير
      if (blob && typeof window.trackExport === 'function') {
        // تأخير صغير عشان نتفادى التسجيل المضاعف مع PDF
        setTimeout(() => {
          // فقط لو ما تم تسجيل PDF في آخر ثانية
          if (!window._lastPdfExport || (Date.now() - window._lastPdfExport > 2000)) {
            window.trackExport({
              type: getReportType(),
              title: getReportTitle(),
              format: 'png'
            });
          }
        }, 200);
      }
      if (callback) callback(blob);
    }, ...args);
  };
  
  console.log('✅ تم ربط canvas.toBlob بـ trackExport');
}

// ───────────────────────────────────────────────────────────
// 7️⃣ التشغيل التلقائي
// ───────────────────────────────────────────────────────────
function init() {
  // ابدأ مراقبة jsPDF فوراً
  hookPdfSave();
  
  // ابدأ مراقبة canvas
  hookCanvasExport();
  
  // استعد بعد ما الـ DOM يجهز
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // أعطي 500ms لأي loadData() تخلّص
      setTimeout(tryRestoreFromCloud, 500);
    });
  } else {
    setTimeout(tryRestoreFromCloud, 500);
  }
}

// شغّل
init();

console.log('🛠️ Report Tools loaded for:', getReportType());
