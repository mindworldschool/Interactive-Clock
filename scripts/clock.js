(function(){
  const i18n = {
   
    ua: { title: "Інтерактивний годинник" },
    en: { title: "Interactive Clock" },
    ru: { title: "Интерактивные часы" },
    es: { title: "Reloj interactivo" },
    labels: {
      normal:   {ua:"Звичайний",   en:"Normal",  ru:"Обычный",     es:"Normal"},
      training: {ua:"Тренування",  en:"Training",  ru:"Тренировка",   es:"Entrenamiento"},
      free:     {ua:"Вільно",      en:"Free",   ru:"Свободно",      es:"Libre"},
      task:     {ua:"Завдання",    en:"Task",   ru:"Задание",      es:"Tarea"}
    },
    ui: {
      taskTitle:{ ua:"Завдання", en:"Task", ru:"Задание", es:"Tarea"},
      newTask:{ ua:"Нове завдання", en:"New task", ru:"Новое задание", es:"Nueva tarea"},
      check:{ ua:"Перевірка", en:"Check", ru:"Проверка", es:"Comprobar"},
      ok:{ ua:"СУПЕР!", en:"SUPER!", ru:"SUPER!", es:"¡SUPER!"},
      retry:{ ua:"Спробуй ще раз", en:"Try again", ru:"Попробуй ещё раз", es:"Inténtalo otra vez"}
    }
  };

  const dom = {
    title: document.querySelector('.mws-title'),
    switcher: document.querySelector('.lang-switch'),
    container: document.querySelector('.clock-scale'),
    face: document.querySelector('.face'),
    feedbackClip: document.querySelector('.feedback-clip'),
    confettiWrap:   document.querySelector('.confetti-wrap'), 
    confettiCanvas: document.querySelector('.confetti-canvas'),
    hands: {
      hour: document.querySelector('.hand.hour'),
      minute: document.querySelector('.hand.minute'),
      second: document.querySelector('.hand.second')
    },
    digital: document.getElementById('digitalTime'),
    modeSwitch: document.querySelector('.mode-switch'),
    trainSwitch: document.querySelector('.train-switch'),
    taskActions: document.querySelector('.task-actions'),
    taskTargetWrap: document.querySelector('.task-msg-row .task-target'),
    taskTarget: document.querySelector('.task-msg-row .target-time'),
    taskTitle: document.querySelector('.task-title'),
    taskNew: document.querySelector('.task-actions .btn-task'),
    taskCheck: document.querySelector('.task-actions .btn-check'),
    taskMsg: document.querySelector('.task-msg-row .task-msg')
  };

  // === AUDIO: пул кликов + тиканье/фанфары/ошибка ===
  const sounds = {
    tick: document.getElementById('sndTick'),
    clickPool: [
      document.getElementById('sndClick1'),
      document.getElementById('sndClick2'),
      document.getElementById('sndClick3'),
    ].filter(Boolean),
    fanfare: document.getElementById('sndFanfare'),
    fail: document.getElementById('sndFail')
  };
  let clickIndex = 0;

  function playClick(){
    if(!sounds.clickPool.length) return;
    const s = sounds.clickPool[clickIndex % sounds.clickPool.length];
    clickIndex++;
    try{ s.currentTime = 0; s.play(); }catch(e){}
  }
  function playSound(name){
    const s = sounds[name];
    if(!s) return;
    try{ s.currentTime = 0; s.play(); }catch(e){}
  }

  /* iOS/Safari — разблокировка звука на первом касании */
  const _unlockOnce = ()=>{
    Object.values(sounds).forEach(v=>{
      if(Array.isArray(v)) v.forEach(a=>{ try{ a.play().then(()=>a.pause()); }catch(e){} });
      else { try{ v && v.play().then(()=>v.pause()); }catch(e){} }
    });
    document.removeEventListener('pointerdown', _unlockOnce);
    document.removeEventListener('touchstart', _unlockOnce);
  };
  document.addEventListener('pointerdown', _unlockOnce, {once:true});
  document.addEventListener('touchstart', _unlockOnce, {once:true});

  // Language
  let lang = localStorage.getItem('mws_lang') || 'ua';
  function setLang(l){
    lang = l in i18n ? l : 'ua';
    localStorage.setItem('mws_lang', lang);
    if(dom.title) dom.title.textContent = i18n[lang].title;
    if(dom.switcher){
      [...dom.switcher.querySelectorAll('button')].forEach(b=>{
        b.classList.toggle('active', b.dataset.lang === lang);
      });
    }
    applyModeLabels();
    applyTaskLabels();
  }
  dom.switcher?.addEventListener('click', e=>{
    const b = e.target.closest('button[data-lang]');
    if(!b) return;
    setLang(b.dataset.lang);
  });
  setLang(lang);

  // Build ticks & labels
  const ticks = [], minuteLabels = [], hourLabels = [], hour24Labels = [];
  const container = dom.container;
  function ensureBuilt(){
    if(ticks.length) return;
    for(let i=0;i<60;i++){
      const t = document.createElement('div');
      t.className = 'tick' + (i%5===0 ? ' major' : '');
      container.appendChild(t);
      ticks.push(t);
      if(i%5===0){
        const m = document.createElement('div');
        m.className = 'mlabel';
        m.textContent = (i===0?60:i);
        container.appendChild(m);
        minuteLabels.push(m);
      }
    }
    for(let n=1;n<=12;n++){
      const el = document.createElement('div');
      el.className = 'num';
      el.textContent = n;
      container.appendChild(el);
      hourLabels.push(el);
    }
    for(let n=13;n<=24;n++){
      const el = document.createElement('div');
      el.className = 'num24';
      el.textContent = n;
      container.appendChild(el);
      hour24Labels.push(el);
    }
  }
  ensureBuilt();

  function layoutAll(){
    const faceRect = dom.face.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const cx = contRect.width/2;
    const cy = contRect.height/2;
    const rOuter = faceRect.width/2;
    const rTick  = rOuter * 0.98;
    const rMinLbl= rOuter * 1.08;
    const rHour  = rOuter * 0.80;
    const r24    = rOuter * 0.66;
    const offset = 0.7;

    ticks.forEach((t,i)=>{
      const deg = i*6 + offset;
      t.style.left = cx + 'px';
      t.style.top  = cy + 'px';
      t.style.transform = `rotate(${deg}deg) translate(${rTick}px,0)`;
    });
    minuteLabels.forEach((m, idx)=>{
      const val = (idx+1)*5;
      const rad = (val*6 - 90) * Math.PI/180;
      const x = cx + rMinLbl * Math.cos(rad);
      const y = cy + rMinLbl * Math.sin(rad);
      m.style.left = x + 'px'; m.style.top  = y + 'px';
      m.style.fontSize = (faceRect.width * 0.045) + 'px';
      m.textContent = (val===60?60:val);
    });
    hourLabels.forEach((el,i)=>{
      const n = i+1;
      const rad = (n*30 - 90) * Math.PI/180;
      const x = cx + rHour * Math.cos(rad);
      const y = cy + rHour * Math.sin(rad);
      el.style.left = x + 'px'; el.style.top  = y + 'px';
      el.style.fontSize = (faceRect.width * 0.07) + 'px';
    });
    hour24Labels.forEach((el,i)=>{
      const n = i+13;
      const rad = ((n-12)*30 - 90) * Math.PI/180;
      const x = cx + r24 * Math.cos(rad);
      const y = cy + r24 * Math.sin(rad);
      el.style.left = x + 'px'; el.style.top  = y + 'px';
      el.style.fontSize = (faceRect.width * 0.038) + 'px';
    });
  }
  window.addEventListener('resize', layoutAll);
  new ResizeObserver(layoutAll).observe(dom.face);

  // Digital
  function pad(n){ return n<10 ? ('0'+n) : ''+n; }
  function setDigital(h, m, s){
    if(!dom.digital) return;
    dom.digital.textContent = (s==null)
      ? `${pad(h)}:${pad(m)}`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // Feedback
  function showFeedback(text, ok = true){
    if(!dom.feedbackClip) return;
    const span = document.createElement('div');
    span.className = 'feedback-burst' + (ok ? '' : ' error');
    span.textContent = text;
    dom.feedbackClip.appendChild(span);
    requestAnimationFrame(()=> span.classList.add('play'));
    span.addEventListener('animationend', ()=> span.remove());
  }

  // === Hands & drag ===
  let lastAngle = { hour: 0, minute: 0 }; // для «трещётки»

  function setAngle(el, deg){
    el.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;
    el.dataset.angle = deg;
    if(mode === 'training' && trainMode === 'free'){
      const mm = Math.round((parseFloat(dom.hands.minute.dataset.angle)||0)/6) % 60;
      let hh = Math.round((parseFloat(dom.hands.hour.dataset.angle)||0)/30) % 12; if(hh===0) hh=12;
      setDigital(hh, mm, null);
    }
  }
  function enableDrag(el, step){
    let dragging = false;
    function onDown(ev){
      dragging = true;
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
      ev.preventDefault();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, {once:true});
    }
    function onMove(ev){
      if(!dragging) return;
      const rect = dom.face.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      let deg = Math.atan2(dy, dx) * 180/Math.PI + 90;
      if(deg < 0) deg += 360;
      const snapped = step ? Math.round(deg/step)*step : deg;

      // «трещётка»: щелчок при каждом шаге
      const key = el.classList.contains('hour') ? 'hour' : 'minute';
      const diff = Math.abs(snapped - lastAngle[key]);
      if(diff >= step - 0.001){
        playClick();
        lastAngle[key] = snapped;
      }

      setAngle(el, snapped);
    }
    function onUp(){ dragging = false; window.removeEventListener('pointermove', onMove); }
    el.addEventListener('pointerdown', onDown);
  }
  function disableAllDrag(){
    ['hour','minute','second'].forEach(k=>{
      const el = dom.hands[k];
      if(!el) return;
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      dom.hands[k] = clone;
    });
  }

  // === Confetti (из центра, обрезано кругом) ===
  function confettiBurst(){
    const canvas = dom.confettiCanvas;
    if(!canvas) return;
    const wrap = dom.confettiWrap;
    const rect = wrap.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height));
    canvas.width = size; canvas.height = size;

    const ctx = canvas.getContext('2d');
    const N = 170;
    const parts = [];
    for(let i=0;i<N;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 2 + Math.random()*3;
      parts.push({
        x: size/2, y: size/2,
        vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - (Math.random()*2+1.5),
        r: 2 + Math.random()*3,
        color: `hsl(${Math.floor(Math.random()*360)},90%,60%)`,
        rot: Math.random()*Math.PI, vr: (Math.random()-.5)*0.25
      });
    }
    const start = performance.now();
    (function tick(t){
      const elapsed = t - start;
      ctx.clearRect(0,0,size,size);
      parts.forEach(p=>{
        p.vy = (p.vy ?? -2) + 0.07; // «гравитация»
        p.x += p.vx; p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
        ctx.restore();
      });
      if(elapsed < 1300){
        requestAnimationFrame(tick);
      }else{
        ctx.clearRect(0,0,size,size);
      }
    })(performance.now());
  }

  // Modes
  let timer = null;
  function stopTimer(){
    if(timer){ clearInterval(timer); timer=null; }
    try{ if(sounds.tick){ sounds.tick.pause(); sounds.tick.currentTime = 0; } }catch(e){}
  }
  function startRealtime(){
    stopTimer();
    dom.hands.second.classList.remove('hidden');
    try{ if(sounds.tick){ sounds.tick.currentTime = 0; sounds.tick.loop = true; sounds.tick.play(); } }catch(e){}
    timer = setInterval(()=>{
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds()/1000;
      const m = d.getMinutes() + s/60;
      const h = (d.getHours()%12) + m/60;
      setAngle(dom.hands.second, s*6);
      setAngle(dom.hands.minute, m*6);
      setAngle(dom.hands.hour,   h*30);
      setDigital(Math.floor(h===0?12:h), Math.floor(m), Math.floor(s));
    }, 50);
  }

  let mode = 'current'; // current | training
  let trainMode = 'free'; // free | task
  function setEnabled(el, on){ if(!el) return; el.classList.toggle('disabled', !on); }

  function applyMode(){
    if(mode === 'current'){
      disableAllDrag();
      startRealtime();
      setEnabled(dom.trainSwitch, false);
      setEnabled(dom.taskActions, false);
      dom.taskTargetWrap?.classList.add('hidden');
    }else{
      stopTimer();
      dom.hands.second.classList.add('hidden');
      disableAllDrag();
      enableDrag(dom.hands.minute, 6);
      enableDrag(dom.hands.hour, 15); // 15° = полчаса
      setEnabled(dom.trainSwitch, true);
      const enableTask = (trainMode === 'task');
      setEnabled(dom.taskActions, enableTask);
      dom.taskTargetWrap?.classList.toggle('hidden', !enableTask);
      if(enableTask){
        if(!target) randomTask(); else setDigital(target.h, target.m, null);
      }else{
        const mdeg = parseFloat(dom.hands.minute.dataset.angle)||0;
        const hdeg = parseFloat(dom.hands.hour.dataset.angle)||0;
        const mm = Math.round(mdeg/6) % 60;
        let hh = Math.round(hdeg/30) % 12; if(hh===0) hh=12;
        setDigital(hh, mm, null);
      }
    }
    applyModeLabels();
  }

  dom.modeSwitch?.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-mode]'); if(!b) return;
    mode = b.dataset.mode;
    [...dom.modeSwitch.querySelectorAll('button')].forEach(btn=>btn.classList.toggle('active', btn===b));
    applyMode();
  });

  dom.trainSwitch?.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-train]'); if(!b) return;
    trainMode = b.dataset.train;
    [...dom.trainSwitch.querySelectorAll('button')].forEach(btn=>btn.classList.toggle('active', btn===b));
    const enableTask = (trainMode === 'task');
    setEnabled(dom.taskActions, enableTask);
    dom.taskTargetWrap?.classList.toggle('hidden', !enableTask);
    if(mode === 'training'){
      if(enableTask){
        if(!target) randomTask(); else setDigital(target.h, target.m, null);
      }else{
        const mdeg = parseFloat(dom.hands.minute.dataset.angle)||0;
        const hdeg = parseFloat(dom.hands.hour.dataset.angle)||0;
        const mm = Math.round(mdeg/6) % 60;
        let hh = Math.round(hdeg/30) % 12; if(hh===0) hh=12;
        setDigital(hh, mm, null);
      }
    }
  });

  // i18n labels
  function applyModeLabels(){
    if(dom.modeSwitch){
      const b1 = dom.modeSwitch.querySelector('button[data-mode="current"]');
      const b2 = dom.modeSwitch.querySelector('button[data-mode="training"]');
      if(b1) b1.textContent = i18n.labels.normal[lang] || i18n.labels.normal.ru;
      if(b2) b2.textContent = i18n.labels.training[lang] || i18n.labels.training.ru;
    }
    if(dom.trainSwitch){
      const f = dom.trainSwitch.querySelector('button[data-train="free"]');
      const t = dom.trainSwitch.querySelector('button[data-train="task"]');
      if(f) f.textContent = i18n.labels.free[lang] || i18n.labels.free.ru;
      if(t) t.textContent = i18n.labels.task[lang] || i18n.labels.task.ru;
    }
  }
  function applyTaskLabels(){
    if(dom.taskTitle) dom.taskTitle.textContent = (i18n.ui.taskTitle[lang] || i18n.ui.taskTitle.ru) + ':';
    if(dom.taskNew)   dom.taskNew.textContent   = i18n.ui.newTask[lang] || i18n.ui.newTask.ru;
    if(dom.taskCheck) dom.taskCheck.textContent = i18n.ui.check[lang]   || i18n.ui.check.ru;
  }

  // Task logic
  let target = null;
  function randomTask(){
    let h = Math.floor(Math.random()*13);
    const m = Math.floor(Math.random()*12) * 5;
    if(h===0) h=12;
    target = {h, m};
    if(dom.taskTarget) dom.taskTarget.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    if(trainMode === 'task') setDigital(h, m, null);
    if(dom.taskMsg) dom.taskMsg.textContent = '';
  }
  function checkAnswer(){
    if(trainMode === 'task' && !target){
      // если цели нет — создаём и показываем, чтобы не было "ничего не происходит"
      randomTask();
      showFeedback(i18n.ui.taskTitle[lang] || i18n.ui.taskTitle.ru, false);
      return;
    }
    const mdeg = parseFloat(dom.hands.minute.dataset.angle)||0;
    const hdeg = parseFloat(dom.hands.hour.dataset.angle)||0;
    const mm = Math.round(mdeg/6) % 60;
    let hh = Math.round(hdeg/30) % 12; if(hh===0) hh=12;

    const ok = target ? (mm === target.m && hh === target.h) : false;
    showFeedback(ok ? (i18n.ui.ok[lang]||i18n.ui.ok.ru) : (i18n.ui.retry[lang]||i18n.ui.retry.ru), ok);

    if(ok){
      playSound('fanfare');
      confettiBurst();
    }else{
      playSound('fail');
    }
  }
  dom.taskNew?.addEventListener('click', randomTask);
  dom.taskCheck?.addEventListener('click', checkAnswer);

  // Init
  layoutAll();
  (function syncNow(){
    const d = new Date();
    const s = d.getSeconds();
    const m = d.getMinutes() + s/60;
    const h = (d.getHours()%12) + m/60;
    setAngle(dom.hands.second, s*6);
    setAngle(dom.hands.minute, m*6);
    setAngle(dom.hands.hour,   h*30);
    setDigital(Math.floor(h===0?12:h), Math.floor(m), Math.floor(s));
  })();
  applyModeLabels();
  applyTaskLabels();
  applyMode();
})();

  function tryResumeAudio(){
    try{
      if(sounds.tick && mode === 'current'){
        sounds.tick.play().catch(()=>{});
      }
    }catch(e){}
  }
  document.addEventListener('pointerdown', tryResumeAudio, {once:false});
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible') tryResumeAudio();
  });

  // Default volumes
  function setVolumes(){
    try{
      if(sounds.tick)    sounds.tick.volume    = 0.35;
      if(sounds.fanfare) sounds.fanfare.volume = 0.9;
      if(sounds.fail)    sounds.fail.volume    = 0.9;
      if(sounds.clickPool && sounds.clickPool.length){
        sounds.clickPool.forEach(a=>{ if(a) a.volume = 0.7; });
      }
    }catch(e){}
  }
  setVolumes();

  // Arm audio on first real user gesture
  let audioArmed = false;
  function armAudioOnce(){
    if(audioArmed) return;
    audioArmed = true;
    const pool = [sounds.tick, ...(sounds.clickPool||[]), sounds.fanfare, sounds.fail].filter(Boolean);
    pool.forEach(a=>{ try{ a.currentTime = 0; a.play().then(()=>a.pause()).catch(()=>{}); }catch(e){} });
    try{
      if(sounds.tick && mode === 'current'){
        sounds.tick.currentTime = 0;
        sounds.tick.loop = true;
        sounds.tick.play().catch(()=>{});
      }
    }catch(e){}
  }
  document.addEventListener('pointerdown', armAudioOnce, {once:false});
  document.querySelector('.clock-scale')?.addEventListener('pointerdown', armAudioOnce, {once:false});
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible'){
      try{ if(sounds.tick && mode === 'current'){ sounds.tick.play().catch(()=>{}); } }catch(e){}
    }
  });
