/* ============================================================================
   BRTV · 线性图标库（替代 emoji，统一 24/线性/currentColor）
   用法：window.brtvIcon('snow') -> 完整 <svg> 字符串
   React：<span className="ico" dangerouslySetInnerHTML={{__html: brtvIcon('snow')}} />
   尺寸由 .ico 的 font-size 控制（svg = 1em）；颜色继承 currentColor
   ========================================================================== */
(function () {
  // 每个值是 svg 内部标记；描边图标继承 wrapper 的 stroke=currentColor，
  // 填充图标在内部自行声明 fill="currentColor" stroke="none"
  const I = {
    /* —— 场景 —— */
    produce: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>',
    audit:   '<path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    live:    '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M7.6 7.6a6 6 0 000 8.8M16.4 7.6a6 6 0 010 8.8M5 5a10 10 0 000 14M19 5a10 10 0 010 14"/>',
    plan:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    feedback:'<path d="M3 17l6-6 4 4 7-7"/><path d="M16 8h5v5"/>',
    operate: '<circle cx="9" cy="9" r="3.2"/><path d="M3.4 20a5.6 5.6 0 0111.2 0"/><path d="M16 6.3a3 3 0 010 5.6"/><path d="M16 14.4A5.6 5.6 0 0120.6 20"/>',
    /* —— 渠道 —— */
    tv:      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 3.5L16 3"/>',
    radio:   '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M7 9l11-4.2"/><circle cx="8" cy="14.5" r="2.4"/><path d="M14 13h4M14 16.5h4"/>',
    app:     '<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M10.5 18h3"/>',
    fm:      '<path d="M4 14v-1.5a8 8 0 0116 0V14"/><rect x="3" y="13.5" width="4" height="6.5" rx="1.6"/><rect x="17" y="13.5" width="4" height="6.5" rx="1.6"/>',
    channel: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M10 8.5l5.5 3.5L10 15.5z" fill="currentColor" stroke="none"/>',
    shortvid:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M11 7.5v7a2.2 2.2 0 11-2.2-2.2"/><path d="M11 7.5c.2 1.6 1.4 2.8 3 2.8"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/>',
    intl:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/><path d="M5 6.5c2 1.2 12 1.2 14 0M5 17.5c2-1.2 12-1.2 14 0"/>',
    /* —— 媒体类型 —— */
    video:   '<path d="M8.5 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none"/>',
    image:   '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 15.5l-5-5L5 20"/>',
    audio:   '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3M9 21h6"/>',
    text:    '<path d="M5 5h14M5 10h14M5 15h9"/>',
    /* —— 素材/天气场景（thumb 图标）—— */
    snow:    '<path d="M12 2.5v19M4 7l16 10M20 7L4 17"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/><path d="M4.5 11.5l2.5-.7M19.5 12.5l-2.5.7"/>',
    wind:    '<path d="M3 9h11a3 3 0 10-3-3"/><path d="M3 14h15a3 3 0 11-3 3"/>',
    subway:  '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11.5h14"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/><path d="M8 21l2.2-3.5M16 21l-2.2-3.5"/>',
    gov:     '<path d="M3 9l9-5 9 5"/><rect x="5" y="9" width="14" height="11" rx="1"/><path d="M8 20v-6M12 20v-6M16 20v-6"/>',
    studio:  '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3M9 21h6"/>',
    house:   '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    /* —— 动作 —— */
    edit:    '<path d="M14 5l5 5M4 20l.8-4L15.5 5.3a1.8 1.8 0 012.6 0l.6.6a1.8 1.8 0 010 2.6L8 19.2z"/>',
    sparkle: '<path d="M12 3.5l1.7 4.8L18.5 10l-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z" fill="currentColor" stroke="none"/><path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none"/>',
    expand:  '<path d="M12 5v14M5 12h14"/>',
    check:   '<path d="M5 12.5l4.5 4.5L20 6.5"/>',
    bolt:    '<path d="M13 2.5L4 14h6.5l-1 7.5L20 10h-6.5z" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.1 5.4"/><path d="M20 4.5V11h-6.5"/>',
    send:    '<path d="M21 3.5L10.5 14M21 3.5l-6.8 17.5-3.7-7.2-7.2-3.7z"/>',
    rocket:  '<path d="M5 14c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 4.5c3 0 5 2 5 5-1 5-6 8.5-9 9.5l-4.5-4.5C7 11.5 10.5 6 14.5 4.5z"/><circle cx="14" cy="10" r="1.6"/>',
    eye:     '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    swap:    '<path d="M7 4L3 8l4 4"/><path d="M3 8h12.5a4 4 0 014 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8.5a4 4 0 01-4-4"/>',
    scissors:'<circle cx="6" cy="6.5" r="2.4"/><circle cx="6" cy="17.5" r="2.4"/><path d="M8 8l12 9.5M8 16L20 6.5"/>',
    mic:     '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3M9 21h6"/>',
    search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    sendarrow:'<path d="M5 12h13M12 5l7 7-7 7"/>',
    /* —— 导航 / 系统 —— */
    home:    '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    target:  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    film:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>',
    shield:  '<path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    user:    '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/>',
    back:    '<path d="M15 5l-7 7 7 7"/>',
    more:    '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    bell:    '<path d="M6 9a6 6 0 1112 0c0 4.5 2 6 2 6H4s2-1.5 2-6z"/><path d="M10 19a2 2 0 004 0"/>',
    lock:    '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.5 5.5l-2 2M7.5 16.5l-2 2M18.5 18.5l-2-2M7.5 7.5l-2-2"/>',
    chat:    '<path d="M4 5.5h16v10H9l-4 3v-3H4z"/><path d="M8 9h8M8 12h5"/>',
    cowork:  '<path d="M4 5.5h13v9H8l-3.5 2.6V14.5H4z"/><path d="M9 9.5l1.4 4.5 4.5-1.4z" fill="currentColor" stroke="none"/>',
    pipeline:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    imchat:  '<rect x="6" y="3" width="12" height="18" rx="2.2"/><path d="M9 7.5h6M9 11h4"/>',
    play:    '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
    pause:   '<rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    fire:    '<path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0012 12a2.5 2.5 0 002.5-2.5C16 12 17 13.5 17 16a5 5 0 01-10 0c0-3 2-5 3-7 1-2 1.5-4 2-6z" fill="currentColor" stroke="none"/>',
    grid:    '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    layers:  '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    clock:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    upload:  '<path d="M12 16V5M8 9l4-4 4 4"/><path d="M4 16v3h16v-3"/>',
    wand:    '<path d="M6 18L16 8"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none"/><path d="M19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z" fill="currentColor" stroke="none"/>',
    flag:    '<path d="M5 21V4M5 4h11l-2 3 2 3H5"/>',
    drama:   '<path d="M4 6c0 6 2 9 5 9s5-3 5-9M9 8.5h.01M12.5 8.5h.01"/><path d="M14 9c1.5-.5 4-.3 6 .5 0 5-2 7.5-4.5 7.5"/>',
    podcast: '<circle cx="12" cy="9" r="4"/><path d="M12 13v5M8 21h8"/><path d="M6.5 9a5.5 5.5 0 0111 0"/>',
  };

  function brtvIcon(name, attrs) {
    const inner = I[name];
    if (!inner) return '';
    const extra = attrs || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" ' + extra + '>' + inner + '</svg>';
  }
  window.BRTVI = I;
  window.brtvIcon = brtvIcon;
})();
