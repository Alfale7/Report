// ═══════════════════════════════════════════════════════════
// 🛠️ Report Tools v4 - أدوات عامة لكل التقارير
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
// 2️⃣ شاشة تحميل
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

function showDebugToast(msg, color = '#e8c547') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:rgba(15,41,66,0.95);color:${color};
    padding:12px 22px;border-radius:12px;
    font:700 0.88rem 'Tajawal',sans-serif;
    border:1px solid ${color}66;
    box-shadow:0 8px 24px rgba(0,0,0,0.5);
    z-index:99998;backdrop-filter:blur(10px);
    animation:_dt 0.3s ease-out;max-width:90%;
  `;
  t.textContent = msg;
  if (!document.getElementById('_dt_anim')) {
    const style = document.createElement('style');
    style.id = '_dt_anim';
    style.textContent = '@keyframes _dt{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ───────────────────────────────────────────────────────────
// 3️⃣ جمع البيانات الكاملة من localStorage + DOM
// ───────────────────────────────────────────────────────────
function collectFullData() {
  const data = {
    // البيانات النصية
    fields: {},
    // الصور (Data URLs)
    images: {},
    // localStorage كامل لهذه الصفحة
    storage: {}
  };
  
  // 1. اجمع كل الحقول النصية
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
    const val = el.value?.trim();
    if (val && val.length > 0) {
      const key = el.id || el.name || `field_${Object.keys(data.fields).length}`;
      data.fields[key] = val;
    }
  });
  
  // 2. ContentEditable
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    const text = (el.innerText || el.textContent || '').trim();
    if (text && text.length > 1 && text !== '...' && text !== '-') {
      const key = el.id || el.dataset?.field || `editable_${Object.keys(data.fields).length}`;
      data.fields[key] = text;
    }
  });
  
  // 3. كل صور الـ <img> بصيغة Data URL
  document.querySelectorAll('img').forEach((el, idx) => {
    const src = el.src || '';
    if (src.startsWith('data:image/')) {
      const key = el.id || el.dataset?.field || `img_${idx}`;
      data.images[key] = src;
    }
  });
  
  // 4. خلفيات CSS بـ Data URL
  document.querySelectorAll('[style*="background-image"]').forEach((el, idx) => {
    const bg = el.style.backgroundImage || '';
    if (bg.includes('data:image/')) {
      const key = el.id || el.dataset?.field || `bg_${idx}`;
      data.images['__bg_' + key] = bg;
    }
  });
  
  // 5. كل localStorage المرتبط بهذه الصفحة
  const type = getReportType();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // تجاهل المفاتيح العامة
      if (k === 'siteLang' || k === 'loggedUser' || k === 'isSubscribed') continue;
      if (k.startsWith('ksa2030_')) continue;
      if (k === 'free_downloads_used') continue;
      if (k === 'ksa_restore_export') continue;
      
      const v = localStorage.getItem(k);
      if (v && v.length < 900000) { // تجنب القيم الضخمة (>900KB)
        data.storage[k] = v;
      }
    }
  } catch (e) { console.warn('localStorage read error:', e); }
  
  return data;
}

// ───────────────────────────────────────────────────────────
// 4️⃣ استعادة البيانات
// ───────────────────────────────────────────────────────────
function restoreFullData(data) {
  let restored = 0;
  
  if (!data) return restored;
  
  // 1. استعد localStorage أولاً (مهم - قبل DOM)
  if (data.storage) {
    Object.entries(data.storage).forEach(([k, v]) => {
      try {
        localStorage.setItem(k, v);
        restored++;
      } catch (e) { console.warn('storage set error:', e); }
    });
  }
  
  // 2. استدع loadData لو موجودة لتحدّث الـ DOM
  if (typeof window.loadData === 'function') {
    try { window.loadData(); } catch (e) { console.warn(e); }
  }
  
  // 3. استعد الحقول مباشرة (احتياط)
  if (data.fields) {
    Object.entries(data.fields).forEach(([key, value]) => {
      if (!value) return;
      let el = document.getElementById(key);
      if (!el) el = document.querySelector(`[name="${key}"]`);
      if (!el) el = document.querySelector(`[data-field="${key}"]`);
      if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (el.type !== 'file') el.value = value;
        } else {
          el.innerText = value;
        }
        restored++;
      }
    });
  }
  
  // 4. استعد الصور
  if (data.images) {
    Object.entries(data.images).forEach(([key, value]) => {
      if (!value) return;
      
      // خلفية
      if (key.startsWith('__bg_')) {
        const realKey = key.replace('__bg_', '');
        let el = document.getElementById(realKey);
        if (!el) el = document.querySelector(`[data-field="${realKey}"]`);
        if (el) {
          el.style.backgroundImage = value;
          restored++;
        }
        return;
      }
      
      // صورة
      let el = document.getElementById(key);
      if (!el) el = document.querySelector(`[data-field="${key}"]`);
      if (el && el.tagName === 'IMG') {
        el.src = value;
        el.style.display = '';
        restored++;
      }
    });
  }
  
  return restored;
}

// ───────────────────────────────────────────────────────────
// 5️⃣ تسجيل التصدير
// ───────────────────────────────────────────────────────────
async function logExport(format = 'pdf') {
  if (window._lastExportTime && (Date.now() - window._lastExportTime < 3000)) {
    console.log('⏭️ تخطي تكرار');
    return;
  }
  window._lastExportTime = Date.now();
  
  // انتظر trackExport
  let attempts = 0;
  while (typeof window.trackExport !== 'function' && attempts < 100) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (typeof window.trackExport !== 'function') {
    console.warn('⚠️ trackExport غير متاحة');
    showDebugToast('⚠️ سجّل دخولك لحفظ التصدير', '#fde047');
    return;
  }
  
  try {
    // اجمع البيانات الكاملة
    const fullData = collectFullData();
    
    // ادمج الكل في content واحد
    const content = {
      ...fullData.fields,
      ...fullData.images,
      __storage__: JSON.stringify(fullData.storage)
    };
    
    // فحص الحجم - Firestore حده 1 MB
    const sizeKB = Math.round(JSON.stringify(content).length / 1024);
    console.log('📤 جاري تسجيل التصدير...', {
      fields: Object.keys(fullData.fields).length,
      images: Object.keys(fullData.images).length,
      storage_keys: Object.keys(fullData.storage).length,
      size: sizeKB + ' KB'
    });
    
    // لو الحجم كبير جداً، احذف الصور الكبيرة
    let finalContent = content;
    if (sizeKB > 800) {
      console.warn('⚠️ الحجم كبير، حذف الصور الكبيرة');
      finalContent = { ...fullData.fields, __sizeLimited__: true };
      // أضف الصور الصغيرة فقط
      Object.entries(fullData.images).forEach(([k, v]) => {
        if (v && v.length < 100000) { // <100KB لكل صورة
          finalContent[k] = v;
        }
      });
      finalContent.__storage__ = JSON.stringify(fullData.storage).substring(0, 200000);
      
      const newSize = Math.round(JSON.stringify(finalContent).length / 1024);
      console.log('📉 الحجم بعد الحذف:', newSize + ' KB');
      showDebugToast(`⚠️ بعض الصور الكبيرة لم تُحفظ (${sizeKB}KB)`, '#fde047');
    }
    
    await window.trackExport({
      type: getReportType(),
      title: getReportTitle(),
      format: format,
      content: finalContent
    });
    
    console.log('✅ تم التسجيل');
    showDebugToast('✅ تم حفظ التقرير في سجلك');
  } catch (e) {
    console.error('❌ خطأ:', e);
    showDebugToast('❌ ' + e.message, '#fca5a5');
  }
}

// ───────────────────────────────────────────────────────────
// 6️⃣ مراقبة أزرار التصدير (بطرق متعددة)
// ───────────────────────────────────────────────────────────
function hookExportButtons() {
  const exportKeywords = [
    'pdf', 'تصدير', 'حفظ التقرير', 'تحميل', 'export', 'download',
    'image', 'صورة', 'png', 'jpg', 'تصدير كصورة', 'حفظ pdf'
  ];
  
  function isExportButton(el) {
    if (!el) return false;
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A') return false;
    
    const text = (el.textContent || '').toLowerCase().trim();
    const onclick = (el.getAttribute('onclick') || '').toLowerCase();
    const cls = (el.className || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    
    // ابحث في كل المصادر
    return exportKeywords.some(kw => {
      const k = kw.toLowerCase();
      return text.includes(k) || onclick.includes(k) || cls.includes(k) || id.includes(k);
    });
  }
  
  function detectFormat(el) {
    const text = (el.textContent || '').toLowerCase();
    const onclick = (el.getAttribute('onclick') || '').toLowerCase();
    const cls = (el.className || '').toLowerCase();
    
    if (text.includes('png') || text.includes('صورة') || 
        onclick.includes('image') || onclick.includes('png') ||
        cls.includes('image')) {
      return 'png';
    }
    return 'pdf';
  }
  
  document.addEventListener('click', function(e) {
    let target = e.target;
    for (let i = 0; i < 6 && target; i++) {
      if (isExportButton(target)) {
        const format = detectFormat(target);
        console.log('🎯 زر تصدير:', target.textContent?.trim().substring(0, 30), '→', format);
        
        // انتظر التصدير ينتهي قبل ما نسجل
        setTimeout(() => logExport(format), 2500);
        return;
      }
      target = target.parentElement;
    }
  }, true);
  
  console.log('🔗 مراقبة أزرار التصدير مفعّلة');
}

// ───────────────────────────────────────────────────────────
// 7️⃣ استعادة من السحابة
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
    
    // افصل storage عن باقي البيانات
    const fullData = { fields: {}, images: {}, storage: {} };
    Object.entries(data.content).forEach(([k, v]) => {
      if (k === '__storage__' && typeof v === 'string') {
        try { fullData.storage = JSON.parse(v); } catch (e) {}
      } else if (typeof v === 'string' && v.startsWith('data:image/')) {
        fullData.images[k] = v;
      } else if (k.startsWith('__bg_')) {
        fullData.images[k] = v;
      } else {
        fullData.fields[k] = v;
      }
    });
    
    const restored = restoreFullData(fullData);
    
    localStorage.removeItem('ksa_restore_export');
    cleanupUrl();
    
    setTimeout(() => {
      hideLoader();
      if (restored > 0) {
        showDebugToast(`✅ تمت استعادة بياناتك بنجاح`);
      }
    }, 500);
  } catch (e) {
    console.warn('فشلت الاستعادة:', e);
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hookExportButtons();
    setTimeout(tryRestoreFromCloud, 800);
  });
} else {
  hookExportButtons();
  setTimeout(tryRestoreFromCloud, 800);
}

console.log('🛠️ Report Tools v4 loaded for:', getReportType());
