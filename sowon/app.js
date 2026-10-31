(function () {
  'use strict';

  function start() {
    var core = window.SowonCore;
    if (!core) return;
    var $ = function (id) { return document.getElementById(id); };
    var setText = function (id, value) { var element = $(id); if (element) element.textContent = value; };
    var storage;
    try { storage = window.localStorage; } catch (_) { storage = null; }
    var store = core.createStore(storage);
    var state = store.visit();
    var selectedCategory = 'peace';
    var selectedBlessing = 'courage';
    var pendingDelete = null;
    var toastTimer = null;
    var breathTimer = null;
    var breathElapsed = 0;
    var breathStartedAt = 0;
    var breathRunning = false;
    var breathLastPhase = '';
    var soundEngine = null;
    var soundRequest = 0;
    var soundPlaying = false;
    var soundPending = false;
    var openers = new WeakMap();
    var trackedLabels = ['open-wish', 'save-wish', 'open-journal', 'complete-wish', 'delete-wish', 'open-breath', 'finish-breath', 'open-blessing', 'copy-blessing', 'share-blessing', 'receive-blessing', 'sound-on', 'sound-off', 'open-about'];

    function track(label) {
      if (trackedLabels.indexOf(label) === -1 || typeof window.__track !== 'function') return;
      try { window.__track('cta', 'sowon-' + label); } catch (_) { /* Analytics never interrupt the sanctuary. */ }
    }

    function toast(message) {
      if (!$('toast')) return;
      window.clearTimeout(toastTimer);
      $('toast').textContent = message;
      $('toast').hidden = false;
      if (typeof $('toast').showPopover === 'function') {
        $('toast').setAttribute('popover', 'manual');
        try { $('toast').showPopover(); } catch (_) { /* The status text remains available to assistive technology. */ }
      }
      $('toast').classList.add('is-visible');
      toastTimer = window.setTimeout(function () {
        $('toast').classList.remove('is-visible');
        if (typeof $('toast').hidePopover === 'function') { try { $('toast').hidePopover(); } catch (_) {} }
        $('toast').hidden = true;
      }, 4200);
    }

    function showStorageStatus() {
      if ($('storageNotice')) $('storageNotice').hidden = state.persistent;
      setText('journalStorageNote', state.persistent
        ? '소원은 이 브라우저에만 보관돼요. 최근 50개까지 간직하며, 브라우저 데이터를 지우면 함께 사라져요.'
        : '이 브라우저에서는 기록을 저장할 수 없어요. 현재 화면의 변경만 반영돼요. 새로고침하면 소원이 사라지거나 지운 기록이 다시 보일 수 있어요.');
    }

    function formatDate(value) {
      try {
        return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
      } catch (_) { return core.dateKey(value).replace(/-/g, '.'); }
    }

    function renderScene() {
      var field = $('lanternField');
      var points = [
        [15, 43, 0.3], [79, 36, 1.7], [28, 23, 1], [65, 16, 2.5], [9, 11, 3.1],
        [87, 9, 2.2], [43, 8, 0.7], [56, 35, 3.5], [37, 50, 1.4]
      ];
      if (field) {
        field.replaceChildren();
        state.wishes.slice(0, 9).forEach(function (wish, index) {
          var lantern = document.createElement('button');
          lantern.type = 'button';
          lantern.className = 'floating-lantern lantern lantern--' + wish.category;
          lantern.dataset.openJournal = '';
          lantern.setAttribute('aria-label', '내 소원 기록 열기, 불빛 ' + (index + 1));
          lantern.style.setProperty('--x', points[index][0] + '%');
          lantern.style.setProperty('--y', points[index][1] + '%');
          lantern.style.setProperty('--delay', points[index][2] + 's');
          ['lantern-halo', 'lantern-body', 'lantern-flame', 'lantern-tassel'].forEach(function (className) {
            var part = document.createElement('span');
            part.className = className;
            part.setAttribute('aria-hidden', 'true');
            lantern.appendChild(part);
          });
          field.appendChild(lantern);
        });
      }
      document.body.classList.toggle('has-wishes', state.wishes.length > 0);
      if ($('sceneLantern')) $('sceneLantern').classList.toggle('is-lit', state.wishes.length > 0);
      setText('lanternCount', state.wishes.length);
      setText('visitCount', '머문 날 ' + state.visits.length + '일');
      setText('journalCount', state.wishes.length);
      setText('lunaGreeting', state.wishes.length ? '당신이 남긴 작은 빛, 이곳에 잘 머물고 있어요.' : '어서 와요. 오늘은 어떤 마음을 안고 왔나요?');
    }

    function makeButton(label, action, id) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'entry-action';
      button.textContent = label;
      button.setAttribute(action, id);
      return button;
    }

    function renderJournal() {
      var list = $('journalList');
      if (!list) return;
      list.replaceChildren();
      if ($('journalEmpty')) $('journalEmpty').hidden = state.wishes.length > 0;
      var completed = state.wishes.filter(function (wish) { return Boolean(wish.completedAt); }).length;
      setText('journalSummary', state.wishes.length ? '간직한 바람 ' + state.wishes.length + '개 · 이루어진 바람 ' + completed + '개' : '아직 밝혀둔 소원이 없어요.');
      state.wishes.forEach(function (wish) {
        var article = document.createElement('article');
        article.className = 'journal-entry' + (wish.completedAt ? ' is-complete' : '');
        var meta = document.createElement('div');
        meta.className = 'journal-meta';
        var category = document.createElement('span');
        category.textContent = core.getCategory(wish.category).label;
        var date = document.createElement('time');
        date.dateTime = wish.createdAt;
        date.textContent = formatDate(wish.createdAt);
        meta.append(category, date);
        var text = document.createElement('p');
        text.className = 'journal-wish';
        text.textContent = wish.text;
        article.append(meta, text);
        if (wish.intention) {
          var intention = document.createElement('p');
          intention.className = 'journal-intention';
          var prefix = document.createElement('span');
          prefix.textContent = '나의 작은 실천 · ';
          intention.append(prefix, document.createTextNode(wish.intention));
          article.appendChild(intention);
        }
        if (wish.completedAt) {
          var finished = document.createElement('p');
          finished.className = 'journal-completed';
          finished.textContent = formatDate(wish.completedAt) + ' · 이루어진 마음을 간직했어요.';
          article.appendChild(finished);
        }
        var actions = document.createElement('div');
        actions.className = 'journal-actions';
        var toggle = makeButton(wish.completedAt ? '다시 마음에 품기' : '이루었어요', 'data-toggle-wish', wish.id);
        toggle.setAttribute('aria-pressed', String(Boolean(wish.completedAt)));
        var remove = makeButton('지우기', 'data-delete-wish', wish.id);
        remove.classList.add('entry-action--delete');
        actions.append(toggle, remove);
        article.appendChild(actions);
        list.appendChild(article);
      });
      showStorageStatus();
    }

    function renderState() {
      renderScene();
      renderJournal();
      showStorageStatus();
      document.dispatchEvent(new CustomEvent('sowon:state', { detail: { wishCount: state.wishes.length } }));
    }

    function renderSeason() {
      var season = core.getSeason();
      setText('seasonLabel', season.label);
      setText('seasonMessage', season.message);
      setText('seasonEyebrow', season.eyebrow);
    }

    function refreshFromStorage(recordVisit) {
      var active = document.activeElement;
      var action = active && typeof active.closest === 'function' ? active.closest('[data-toggle-wish], [data-delete-wish]') : null;
      var attribute = action && (action.hasAttribute('data-toggle-wish') ? 'data-toggle-wish' : 'data-delete-wish');
      var wishId = action && action.getAttribute(attribute);
      state = recordVisit ? store.visit() : store.refresh();
      renderState();
      renderSeason();
      // Keep an open form and its draft untouched. Only replaced journal buttons need focus repair.
      if (action && $('journalDialog') && $('journalDialog').open && !document.hidden) {
        var replacement = $('journalList').querySelector('[' + attribute + '="' + wishId + '"]');
        if (replacement) replacement.focus();
        else if ($('journalSummary')) { $('journalSummary').setAttribute('tabindex', '-1'); $('journalSummary').focus(); }
      }
    }

    function openDialog(dialog, opener) {
      if (!dialog) return;
      var returnFocus = opener || document.activeElement;
      if (dialog.id !== 'deleteDialog') {
        var seenDialogs = new Set();
        while (returnFocus && typeof returnFocus.closest === 'function' && returnFocus.closest('dialog')) {
          var parentDialog = returnFocus.closest('dialog');
          if (seenDialogs.has(parentDialog)) { returnFocus = null; break; }
          seenDialogs.add(parentDialog);
          returnFocus = openers.get(parentDialog);
        }
        if (!returnFocus || returnFocus === document.body || !returnFocus.isConnected) returnFocus = document.querySelector('[data-open-wish]');
      }
      if (dialog.id !== 'deleteDialog') {
        document.querySelectorAll('dialog[open]').forEach(function (other) {
          if (other !== dialog) other.close();
        });
      }
      if (dialog.open) return;
      openers.set(dialog, returnFocus);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('dialog-open');
    }

    function closeDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else { dialog.removeAttribute('open'); onDialogClose(dialog); }
    }

    function onDialogClose(dialog) {
      if (dialog.id === 'breathDialog') resetBreath();
      if (dialog.id === 'deleteDialog') pendingDelete = null;
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
      var opener = openers.get(dialog);
      if (!document.querySelector('dialog[open]')) {
        var focusTarget = opener && opener.isConnected ? opener : document.querySelector('.shrine-header [data-open-journal]') || document.querySelector('[data-open-wish]');
        if (focusTarget) { try { focusTarget.focus({ preventScroll: true }); } catch (_) { focusTarget.focus(); } }
      }
    }

    document.querySelectorAll('dialog').forEach(function (dialog) {
      var outsideDown = false;
      function isOutside(event) {
        var rect = dialog.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      }
      dialog.addEventListener('pointerdown', function (event) { outsideDown = event.target === dialog && isOutside(event); });
      dialog.addEventListener('pointerup', function (event) {
        if (outsideDown && event.target === dialog && isOutside(event)) closeDialog(dialog);
        outsideDown = false;
      });
      dialog.addEventListener('close', function () { onDialogClose(dialog); });
    });

    function renderCategoryChoices() {
      var container = $('categoryChoices');
      if (!container) return;
      container.replaceChildren();
      core.CATEGORIES.forEach(function (category) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-choice' + (category.id === selectedCategory ? ' is-selected' : '');
        button.dataset.category = category.id;
        button.setAttribute('aria-pressed', String(category.id === selectedCategory));
        button.textContent = category.label;
        container.appendChild(button);
      });
      renderIntentionSuggestions();
    }

    function renderIntentionSuggestions() {
      var container = $('intentionSuggestions');
      if (!container) return;
      container.replaceChildren();
      core.getCategory(selectedCategory).intentSuggestions.forEach(function (suggestion) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'suggestion-chip';
        button.dataset.intention = suggestion;
        button.textContent = suggestion;
        container.appendChild(button);
      });
    }

    function updateWishCount() {
      var count = core.codePointLength($('wishText') ? $('wishText').value : '');
      setText('wishCount', count + ' / 120');
      if ($('wishCount')) $('wishCount').classList.toggle('is-over-limit', count > 120);
      if ($('wishError') && $('wishText') && count <= 120 && (!$('intentionText') || $('intentionText').getAttribute('aria-invalid') !== 'true')) {
        $('wishText').removeAttribute('aria-invalid');
        $('wishError').textContent = '';
        $('wishError').hidden = true;
      }
    }

    function prepareWish() {
      if ($('wishForm')) $('wishForm').reset();
      selectedCategory = 'peace';
      renderCategoryChoices();
      if ($('wishFormPanel')) $('wishFormPanel').hidden = false;
      if ($('wishSuccess')) $('wishSuccess').hidden = true;
      if ($('wishDialog')) $('wishDialog').setAttribute('aria-labelledby', 'wishTitle');
      setText('wishError', '');
      if ($('wishError')) $('wishError').hidden = true;
      if ($('wishText')) $('wishText').removeAttribute('aria-invalid');
      if ($('intentionText')) $('intentionText').removeAttribute('aria-invalid');
      updateWishCount();
    }

    if ($('wishText')) $('wishText').addEventListener('input', updateWishCount);
    if ($('intentionText')) $('intentionText').addEventListener('input', function () {
      if ($('intentionText').getAttribute('aria-invalid') !== 'true' || core.codePointLength($('intentionText').value.trim()) > 80) return;
      $('intentionText').removeAttribute('aria-invalid');
      if ($('wishError')) { $('wishError').textContent = ''; $('wishError').hidden = true; }
    });
    if ($('wishForm')) $('wishForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var wasFull = state.wishes.length >= core.MAX_WISHES;
      try {
        state = store.addWish({ text: $('wishText').value, category: selectedCategory, intention: $('intentionText') ? $('intentionText').value : '' });
        var saved = state.wishes[0];
        setText('successWish', saved.text);
        setText('successIntention', saved.intention || '오늘은 마음을 밝혀두는 것만으로도 충분해요.');
        setText('successGuidance', core.getCategory(saved.category).guidance);
        setText('successDate', formatDate(saved.createdAt));
        if ($('wishFormPanel')) $('wishFormPanel').hidden = true;
        if ($('wishSuccess')) $('wishSuccess').hidden = false;
        if ($('wishDialog')) $('wishDialog').setAttribute('aria-labelledby', 'successTitle');
        renderState();
        document.dispatchEvent(new CustomEvent('sowon:gesture', { detail: { kind: 'wish' } }));
        track('save-wish');
        if ($('successDone')) $('successDone').focus();
        if (wasFull) toast('새 바람을 간직했어요. 보관 한도에 따라 가장 오래된 소원 하나는 지워졌어요.');
        else if (!state.persistent) toast('불빛을 밝혔어요. 이 브라우저에서는 페이지를 떠나면 기록이 사라질 수 있어요.');
      } catch (error) {
        setText('wishError', error.message || '소원을 다시 확인해주세요.');
        if ($('wishError')) $('wishError').hidden = false;
        if ($('wishText')) $('wishText').removeAttribute('aria-invalid');
        if ($('intentionText')) $('intentionText').removeAttribute('aria-invalid');
        var invalidWish = !$('wishText') || !$('wishText').value.trim() || core.codePointLength($('wishText').value.trim()) > 120;
        var invalidField = !invalidWish && $('intentionText') && core.codePointLength($('intentionText').value.trim()) > 80 ? $('intentionText') : $('wishText');
        if (invalidField) {
          invalidField.setAttribute('aria-invalid', 'true');
          if (!invalidField.getAttribute('aria-describedby')) invalidField.setAttribute('aria-describedby', 'wishError');
          invalidField.focus();
        }
      }
    });

    function renderBreath() {
      var elapsed = breathElapsed + (breathRunning ? performance.now() - breathStartedAt : 0);
      elapsed = Math.min(56000, Math.max(0, elapsed));
      var progress = elapsed / 56000 * 100;
      var phase = 'rest';
      var label = '편안한 자세로 앉아주세요';
      var hint = '코로 천천히 들이쉬고, 편한 만큼 내쉬어요.';
      var scale = 0.76;
      var round = Math.min(4, Math.floor(elapsed / 14000) + 1);
      if (elapsed >= 56000) {
        phase = 'complete'; label = '잘 쉬어왔어요'; hint = '지금의 고요함을 잠시 느껴보세요.'; scale = 1;
      } else if (elapsed > 0 || breathRunning) {
        var cycle = elapsed % 14000;
        if (cycle < 4000) {
          phase = 'inhale'; label = '천천히 들이쉬어요'; hint = '4초 동안, 편안한 만큼'; scale = 0.76 + cycle / 4000 * 0.34;
        } else if (cycle < 8000) {
          phase = 'hold'; label = '잠시 머물러요'; hint = '4초 동안, 힘을 빼고 가볍게'; scale = 1.1;
        } else {
          phase = 'exhale'; label = '길게 내쉬어요'; hint = '6초 동안, 어깨를 부드럽게'; scale = 1.1 - (cycle - 8000) / 6000 * 0.34;
        }
      }
      if (phase !== breathLastPhase) { setText('breathPhase', label); breathLastPhase = phase; }
      setText('breathHint', !breathRunning && elapsed > 0 && elapsed < 56000 ? '잠시 멈췄어요. 준비되면 이어서 시작해요.' : hint);
      setText('breathCounter', elapsed >= 56000 ? '네 번의 호흡을 마쳤어요' : round + ' / 4번의 호흡');
      if ($('breathOrb')) {
        $('breathOrb').dataset.phase = phase;
        $('breathOrb').classList.toggle('is-running', breathRunning);
        $('breathOrb').style.setProperty('--breath-scale', scale.toFixed(3));
      }
      if ($('breathProgress')) {
        $('breathProgress').style.setProperty('--progress', progress.toFixed(1) + '%');
        $('breathProgress').setAttribute('aria-valuenow', String(Math.round(progress)));
        if ('value' in $('breathProgress')) $('breathProgress').value = progress;
      }
      if ($('breathFinish')) $('breathFinish').hidden = elapsed < 56000;
      setText('breathStart', breathRunning ? '잠시 멈추기' : elapsed >= 56000 ? '한 번 더 쉬어가기' : elapsed > 0 ? '이어서 숨 고르기' : '마음 고르기 시작');
    }

    function pauseBreath() {
      if (breathRunning) breathElapsed = Math.min(56000, breathElapsed + performance.now() - breathStartedAt);
      breathRunning = false;
      window.clearTimeout(breathTimer);
      breathTimer = null;
      renderBreath();
    }

    function resetBreath() {
      breathRunning = false;
      window.clearTimeout(breathTimer);
      breathTimer = null;
      breathElapsed = 0;
      breathLastPhase = '';
      renderBreath();
    }

    function tickBreath() {
      if (!breathRunning) return;
      if (document.hidden || !$('breathDialog') || !$('breathDialog').open) { pauseBreath(); return; }
      if (breathElapsed + performance.now() - breathStartedAt >= 56000) {
        breathElapsed = 56000;
        breathRunning = false;
        breathTimer = null;
        renderBreath();
        track('finish-breath');
        return;
      }
      renderBreath();
      breathTimer = window.setTimeout(tickBreath, 100);
    }

    if ($('breathStart')) $('breathStart').addEventListener('click', function () {
      if (breathRunning) { pauseBreath(); return; }
      if (breathElapsed >= 56000) resetBreath();
      breathStartedAt = performance.now();
      breathRunning = true;
      tickBreath();
    });
    if ($('breathReset')) $('breathReset').addEventListener('click', resetBreath);

    function updateSoundButton() {
      if ($('soundToggle')) {
        $('soundToggle').setAttribute('aria-pressed', String(soundPlaying));
        $('soundToggle').setAttribute('aria-label', soundPlaying ? '배경 소리 끄기' : '배경 소리 켜기');
        $('soundToggle').classList.toggle('is-on', soundPlaying);
        $('soundToggle').disabled = soundPending;
      }
      setText('soundLabel', soundPlaying ? '소리 끄기' : '소리 켜기');
    }

    function disposeSound(engine, fade) {
      if (!engine) return;
      try {
        var time = engine.context.currentTime;
        engine.gain.gain.cancelScheduledValues(time);
        engine.gain.gain.setValueAtTime(engine.gain.gain.value, time);
        engine.gain.gain.linearRampToValueAtTime(0, time + (fade ? 0.2 : 0));
        window.setTimeout(function () {
          engine.sources.forEach(function (source) { try { source.stop(); source.disconnect(); } catch (_) {} });
          engine.context.close().catch(function () {});
        }, fade ? 230 : 0);
      } catch (_) { try { engine.context.close().catch(function () {}); } catch (_) {} }
    }

    function stopSound(fade) {
      soundRequest += 1;
      var previous = soundEngine;
      soundEngine = null;
      soundPlaying = false;
      soundPending = false;
      disposeSound(previous, fade);
      state = store.setSound(false);
      updateSoundButton();
      showStorageStatus();
    }

    async function startSound() {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { toast('이 브라우저에서는 배경 소리를 지원하지 않아요.'); return; }
      var request = ++soundRequest;
      var engine;
      soundPending = true;
      updateSoundButton();
      try {
        var context = new AudioContext();
        var master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        engine = { context: context, gain: master, sources: [] };
        soundEngine = engine;
        [174.61, 261.63].forEach(function (frequency, index) {
          var oscillator = context.createOscillator();
          var voice = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          voice.gain.value = index === 0 ? 0.035 : 0.018;
          oscillator.connect(voice); voice.connect(master); oscillator.start();
          engine.sources.push(oscillator);
        });
        var buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
        var channel = buffer.getChannelData(0);
        for (var i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * 0.4;
        var wind = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var windGain = context.createGain();
        wind.buffer = buffer; wind.loop = true;
        filter.type = 'lowpass'; filter.frequency.value = 330;
        windGain.gain.value = 0.05;
        wind.connect(filter); filter.connect(windGain); windGain.connect(master); wind.start();
        engine.sources.push(wind);
        await context.resume();
        if (request !== soundRequest || document.hidden) { disposeSound(engine, false); return; }
        master.gain.linearRampToValueAtTime(0.3, context.currentTime + 1.2);
        soundPlaying = true;
        state = store.setSound(true);
        track('sound-on');
      } catch (_) {
        if (request === soundRequest) {
          soundEngine = null;
          soundPlaying = false;
          disposeSound(engine, false);
          toast('소리를 재생하지 못했어요. 다시 눌러주세요.');
        }
      } finally {
        if (request === soundRequest) { soundPending = false; updateSoundButton(); showStorageStatus(); }
      }
    }

    if ($('soundToggle')) $('soundToggle').addEventListener('click', function () {
      if (soundPlaying) { stopSound(true); track('sound-off'); }
      else startSound();
    });

    function blessingUrl() {
      try { return core.createBlessingUrl(window.location.href, selectedBlessing); } catch (_) { return ''; }
    }

    function renderBlessing() {
      var choices = $('blessingChoices');
      if (choices) {
        choices.replaceChildren();
        core.BLESSINGS.forEach(function (blessing) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'blessing-choice' + (blessing.id === selectedBlessing ? ' is-selected' : '');
          button.dataset.blessing = blessing.id;
          button.setAttribute('aria-pressed', String(blessing.id === selectedBlessing));
          button.textContent = blessing.label;
          choices.appendChild(button);
        });
      }
      setText('blessingPreview', core.getBlessing(selectedBlessing).message);
      setText('blessingStatus', '');
      if ($('blessingLink')) $('blessingLink').value = blessingUrl();
    }

    async function copyBlessing() {
      var url = blessingUrl();
      if (!url) { setText('blessingStatus', '공유 주소를 만들 수 없어요. 온라인 주소에서 다시 열어주세요.'); return; }
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(url);
        setText('blessingStatus', '응원 링크를 복사했어요. 전하고 싶은 사람에게 붙여넣어 주세요.');
        track('copy-blessing');
      } catch (_) {
        var input = $('blessingLink');
        if (input) { input.value = url; input.focus(); input.select(); input.setSelectionRange(0, url.length); }
        setText('blessingStatus', '주소를 선택해두었어요. 길게 누르거나 복사 단축키로 복사해주세요.');
      }
    }

    if ($('blessingCopy')) $('blessingCopy').addEventListener('click', copyBlessing);
    if ($('blessingShare')) $('blessingShare').addEventListener('click', async function () {
      var url = blessingUrl();
      if (!url) { setText('blessingStatus', '공유 주소를 만들 수 없어요. 온라인 주소에서 다시 열어주세요.'); return; }
      if (typeof navigator.share !== 'function') { await copyBlessing(); return; }
      try {
        await navigator.share({ title: '당신에게 보내는 작은 불빛 · 삼라 소원당', text: core.getBlessing(selectedBlessing).message, url: url });
        track('share-blessing');
        setText('blessingStatus', '따뜻한 마음이 닿기를 바라요.');
      } catch (error) {
        if (!error || error.name !== 'AbortError') await copyBlessing();
      }
    });

    function receiveBlessing() {
      var blessing = core.parseBlessingHash(window.location.hash);
      if (!blessing) return;
      selectedBlessing = blessing.id;
      renderBlessing();
      var receive = $('blessingReceive');
      if (receive) receive.hidden = false;
      setText('receivedBlessing', blessing.message);
      openDialog(receive && receive.tagName === 'DIALOG' ? receive : $('blessingDialog'));
      track('receive-blessing');
    }

    document.addEventListener('click', function (event) {
      if (!(event.target instanceof Element)) return;
      var target = event.target;
      var close = target.closest('[data-close]');
      if (close) { event.preventDefault(); closeDialog(close.closest('dialog')); return; }
      var category = target.closest('[data-category]');
      if (category && core.getCategory(category.dataset.category)) {
        selectedCategory = category.dataset.category;
        renderCategoryChoices();
        var selected = $('categoryChoices').querySelector('[data-category="' + selectedCategory + '"]');
        if (selected) selected.focus();
        return;
      }
      var intention = target.closest('[data-intention]');
      if (intention && $('intentionText')) { $('intentionText').value = intention.dataset.intention; $('intentionText').focus(); return; }
      var blessing = target.closest('[data-blessing]');
      if (blessing && core.getBlessing(blessing.dataset.blessing)) {
        selectedBlessing = blessing.dataset.blessing;
        if ($('blessingReceive')) $('blessingReceive').hidden = true;
        renderBlessing();
        var choice = $('blessingChoices').querySelector('[data-blessing="' + selectedBlessing + '"]');
        if (choice) choice.focus();
        return;
      }
      var toggle = target.closest('[data-toggle-wish]');
      if (toggle) {
        var id = toggle.dataset.toggleWish;
        state = store.toggleWish(id);
        renderState();
        var newToggle = $('journalList').querySelector('[data-toggle-wish="' + id + '"]');
        if (newToggle) newToggle.focus();
        track('complete-wish');
        return;
      }
      var remove = target.closest('[data-delete-wish]');
      if (remove) {
        pendingDelete = remove.dataset.deleteWish;
        var wish = state.wishes.find(function (item) { return item.id === pendingDelete; });
        if (!wish) return;
        setText('deleteWishText', wish.text);
        openDialog($('deleteDialog'), remove);
        return;
      }
      var entries = [
        ['[data-open-wish]', 'wishDialog', 'open-wish'], ['[data-open-journal]', 'journalDialog', 'open-journal'],
        ['[data-open-breath]', 'breathDialog', 'open-breath'], ['[data-open-blessing]', 'blessingDialog', 'open-blessing'],
        ['[data-open-about]', 'aboutDialog', 'open-about']
      ];
      for (var i = 0; i < entries.length; i += 1) {
        var opener = target.closest(entries[i][0]);
        if (!opener) continue;
        event.preventDefault();
        var dialog = $(entries[i][1]);
        if (entries[i][1] === 'wishDialog') prepareWish();
        if (entries[i][1] === 'journalDialog') renderJournal();
        if (entries[i][1] === 'blessingDialog') { renderBlessing(); if ($('blessingReceive')) $('blessingReceive').hidden = true; }
        openDialog(dialog, opener);
        track(entries[i][2]);
        return;
      }
    });

    if ($('confirmDelete')) $('confirmDelete').addEventListener('click', function () {
      if (!pendingDelete) return;
      state = store.removeWish(pendingDelete);
      pendingDelete = null;
      closeDialog($('deleteDialog'));
      renderState();
      if ($('journalSummary')) { $('journalSummary').setAttribute('tabindex', '-1'); $('journalSummary').focus(); }
      toast(state.persistent ? '이 기기에서 소원을 지웠어요.' : '지금 화면에서 소원을 지웠어요. 저장할 수 없어 새로고침하면 다시 보일 수 있어요.');
      track('delete-wish');
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refreshFromStorage(true); return; }
      if (breathRunning) pauseBreath();
      if (soundEngine || soundPending || soundPlaying) stopSound(false);
    });
    window.addEventListener('storage', function (event) {
      if (event.key !== core.STORAGE_KEY && event.key !== null) return;
      if (event.storageArea && storage && event.storageArea !== storage) return;
      refreshFromStorage(false);
    });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) refreshFromStorage(true);
    });
    window.addEventListener('pagehide', function () {
      pauseBreath();
      if (soundEngine || soundPending || soundPlaying) stopSound(false);
    });
    window.addEventListener('hashchange', receiveBlessing);
    document.addEventListener('sowon:open', function (event) {
      var action = event.detail && event.detail.action;
      var dialogId = { wish: 'wishDialog', breath: 'breathDialog', blessing: 'blessingDialog' }[action];
      if (!dialogId || !['wish', 'breath', 'blessing'].includes(action)) return;
      if (action === 'wish') prepareWish();
      if (action === 'blessing') {
        renderBlessing();
        if ($('blessingReceive')) $('blessingReceive').hidden = true;
      }
      var selector = action === 'wish' ? '[data-open-wish]' : action === 'breath' ? '[data-open-breath]' : '[data-open-blessing]';
      openDialog($(dialogId), document.querySelector('.ritual-dock ' + selector) || document.querySelector(selector));
      track('open-' + action);
    });

    renderSeason();
    renderCategoryChoices();
    renderBlessing();
    renderState();
    resetBreath();
    updateSoundButton();
    receiveBlessing();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
