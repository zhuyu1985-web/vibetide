/* ============================================================================
   BRTV · 智能交互工作台 — 共享 Mock 数据（单一数据真相源）
   主线：北京迎入冬来最强寒潮 · 多部门启动应急响应（新闻频道 + 融媒体中心）
   挂载到 window.BRTV，三端共用
   ========================================================================== */
window.BRTV = (function () {
  /* —— AI 数字员工 —— */
  const employees = [
    { id:'daoyan',  name:'编导 Agent', short:'导', role:'数字编导',          color:'#D11A2A', status:'busy', desc:'统筹选题→成片全流程编排', skills:['全流程编排','多版本分产','质量自检'] },
    { id:'topic',   name:'析言',       short:'选', role:'热点研判官',        color:'#8C2B22', status:'on',   desc:'7×24 全网热点监测 · 传播力预测', skills:['全网监测','NLP聚类','传播力预测'] },
    { id:'writer',  name:'成文',       short:'稿', role:'智能撰稿员',        color:'#B8001C', status:'busy', desc:'模块化撰稿 · 多体裁一键成稿', skills:['消息','通讯','口播稿'] },
    { id:'cutter',  name:'快刀',       short:'剪', role:'AI 粗剪师',         color:'#C8102E', status:'on',   desc:'素材秒级粗剪 · 多版本分产', skills:['智能粗剪','横竖屏','集锦'] },
    { id:'tagger',  name:'识万',       short:'标', role:'标引检索员',        color:'#9D5A2A', status:'on',   desc:'自动打标 · 跨模态检索', skills:['人物识别','场景标签','跨模态检索'] },
    { id:'caption', name:'同声',       short:'幕', role:'智能字幕员',        color:'#7A3B30', status:'on',   desc:'语音转写 · 多语种字幕', skills:['ASR转写','字幕校对','多语种'] },
    { id:'auditor', name:'守正',       short:'审', role:'AI 审核员',         color:'#5E1A18', status:'busy', desc:'多模态预审 · 风险标记', skills:['敏感筛查','版权识别','合规复核'] },
    { id:'pub',     name:'通达',       short:'发', role:'分发官',            color:'#A8201A', status:'on',   desc:'多平台一键分发 · 回流统计', skills:['多平台分发','定时发布','回流统计'] },
    { id:'data',    name:'见微',       short:'数', role:'数据分析官',        color:'#C8A86A', status:'on',   desc:'分钟级收视 · 传播效能看板', skills:['收视分析','传播力指数','日报生成'] },
  ];
  const emp = id => employees.find(e => e.id === id);

  /* —— 发布渠道 / 平台 —— */
  const channels = [
    { id:'btv1', name:'北京卫视',       kind:'电视', icon:'tv', users:'—' },
    { id:'news', name:'北京新闻广播',   kind:'广播', icon:'radio', users:'—' },
    { id:'bjtime', name:'北京时间 APP', kind:'客户端', icon:'app', users:'1240万' },
    { id:'ttfm', name:'听听 FM',        kind:'音频', icon:'fm', users:'860万' },
    { id:'sph',  name:'BRTV 视频号',    kind:'视频号', icon:'channel', users:'430万' },
    { id:'dy',   name:'抖音·北京时间',  kind:'短视频', icon:'shortvid', users:'2870万' },
    { id:'wb',   name:'微博·北京时间',  kind:'微博', icon:'globe', users:'1960万' },
    { id:'intl', name:'国际传播中心',   kind:'多语种', icon:'intl', users:'海外' },
  ];

  /* —— 主线选题：寒潮应急 —— */
  const story = {
    id:'coldwave',
    title:'北京迎入冬来最强寒潮 多部门启动应急响应',
    cat:'突发 · 民生',
    channel:'新闻频道 / 融媒体中心',
    leadEditor:'值班主编 · 周屿',
    reporter:'前方记者 · 林晚 / 赵峻',
    startedAt:'今天 06:42',
    heat: 98,
    summary:'受强冷空气影响，北京自今晨起气温骤降 12℃，气象台升级发布寒潮橙色预警。市交通、城管、供热等多部门连夜启动应急响应，全市除雪保畅、保供暖同步展开。',
    departments:['市气象台','市交通委','城管执法局','市供热办','轨道交通'],
    materials:[
      { id:'m1', type:'video', title:'长安街连夜除雪作业 5G回传', dur:'02:14', thumb:'thumb-snow', icon:'snow', src:'前方记者林晚 06:55', tags:['除雪','长安街','夜间作业'], people:['环卫工人'], status:'tagged' },
      { id:'m2', type:'video', title:'八达岭风口实测 阵风9级', dur:'01:38', thumb:'thumb-road', icon:'wind', src:'外勤赵峻 07:20', tags:['大风','八达岭','体感'], people:['记者出镜'], status:'tagged' },
      { id:'m3', type:'video', title:'早高峰地铁客流疏导', dur:'01:05', thumb:'thumb-city', icon:'subway', src:'轨道交通供稿 07:48', tags:['早高峰','地铁','客流'], people:[], status:'tagging' },
      { id:'m4', type:'image', title:'气象台寒潮预警发布会', dur:'图', thumb:'thumb-gov', icon:'gov', src:'市气象台 07:10', tags:['气象台','预警','发布会'], people:['首席预报员'], status:'tagged' },
      { id:'m5', type:'audio', title:'供热集团巡检负责人采访', dur:'03:22', thumb:'thumb-studio', icon:'studio', src:'电话连线 08:02', tags:['供暖','巡检','保障'], people:['供热集团'], status:'tagged' },
      { id:'m6', type:'video', title:'社区为独居老人送暖', dur:'01:52', thumb:'thumb-night', icon:'house', src:'通讯员供稿 08:30', tags:['社区','关怀','独居老人'], people:['社区工作者'], status:'tagged' },
    ],
    // ④ 撰稿初稿（AI 生成，可编辑）
    draftFlash:'【快讯】北京升级发布寒潮橙色预警。受强冷空气影响，今晨本市气温较昨日同期下降 12℃，预计明晨平原地区最低气温降至 -9℃。市交通、城管、供热等部门已连夜启动应急响应，全市主干道除雪保畅、供暖保障同步展开。请市民注意防寒保暖、错峰出行。',
    draftFull:[
      { h:'寒潮来袭 北京升级橙色预警', p:'今天清晨，一股入冬以来最强冷空气抵达北京。市气象台于 7 时升级发布寒潮橙色预警，预计未来 24 小时本市大部地区气温将下降 10 至 12℃，阵风可达 7 至 8 级，山区局地 9 级以上。' },
      { h:'多部门连夜启动应急响应', p:'记者从市交通委了解到，全市除雪保畅队伍已于凌晨集结，长安街、二环、机场高速等重点路段实施不间断作业。城管部门加强户外广告牌、临时构筑物巡查，防范大风次生风险。' },
      { h:'保供暖 把温暖送到末端', p:'市供热办表示，全市供热管网运行平稳，已组织专班对老旧小区、独居老人等重点对象开展巡检。多个社区连夜为困难群众送上取暖物资，确保室温达标。' },
    ],
    autoTags:['寒潮','橙色预警','应急响应','除雪保畅','保供暖','早高峰','气象台','民生'],
    // ⑤ 多版本分产
    versions:[
      { id:'tv',   name:'电视长版',     fmt:'16:9 · 横屏', dur:'02:30', target:'北京卫视《北京新闻》', icon:'tv', tone:'thumb-snow', note:'完整事件 + 多部门联动' },
      { id:'vert', name:'客户端竖屏版', fmt:'9:16 · 竖屏', dur:'00:45', target:'北京时间 / 抖音 / 视频号', icon:'app', tone:'thumb-road', note:'快节奏 + 大字幕 + 卡点' },
      { id:'fm',   name:'听听FM音频版', fmt:'纯音频',     dur:'01:10', target:'听听 FM / 北京新闻广播', icon:'fm', tone:'thumb-studio', note:'口播稿 + 现场同期声' },
      { id:'intl', name:'国际传播版',   fmt:'16:9 · 英文', dur:'01:40', target:'国际传播中心', icon:'intl', tone:'thumb-night', note:'英文字幕 + 配音' },
    ],
    // 分镜（粗剪时间轴）
    shots:[
      { n:'01', tone:'thumb-snow' }, { n:'02', tone:'thumb-road' }, { n:'03', tone:'thumb-gov' },
      { n:'04', tone:'thumb-city' }, { n:'05', tone:'thumb-studio' }, { n:'06', tone:'thumb-night' }, { n:'07', tone:'thumb-snow' },
    ],
    // ⑥ 质量自检
    quality:[
      { k:'事实核验', v:96, note:'数据与气象台口径一致' },
      { k:'敏感筛查', v:100, note:'未发现敏感内容' },
      { k:'标题规范', v:88, note:'建议精简副标题' },
      { k:'画面合规', v:94, note:'1 处水印待确认' },
    ],
  };

  /* —— 流水线 7 步 —— */
  const pipeline = [
    { id:'ingest',  label:'素材入库',     sub:'5G回传 / 采集', owner:'tagger', state:'done' },
    { id:'tag',     label:'AI 自动打标',  sub:'标签·人物·字幕', owner:'tagger', state:'done' },
    { id:'search',  label:'跨模态检索',   sub:'秒级匹配',      owner:'tagger', state:'done' },
    { id:'create',  label:'AI 粗剪·撰稿', sub:'初稿+粗剪',     owner:'writer', state:'active' },
    { id:'multi',   label:'多版本分产',   sub:'一键四版',      owner:'cutter', state:'pending' },
    { id:'refine',  label:'人工精修终审', sub:'改字·换图·审核', owner:'auditor', state:'pending' },
    { id:'publish', label:'一键分发',     sub:'多平台',        owner:'pub',    state:'pending' },
  ];

  /* —— 顶部量化指标 —— */
  const metrics = [
    { k:'成片周期', val:50, unit:'%', prefix:'缩短', delta:'−50%', good:true },
    { k:'素材检索效率', val:100, unit:'×', prefix:'提升', delta:'100×', good:true },
    { k:'快讯响应', val:5, unit:'分钟', prefix:'', delta:'30min→5min', good:true },
    { k:'今日产出', val:37, unit:'条', prefix:'', delta:'+12', good:true },
  ];

  /* —— 选题策划：热点榜 —— */
  const trending = [
    { rank:1, title:'北京入冬最强寒潮 多部门应急', heat:98, trend:'+312%', pred:'极高', cat:'突发', src:'微博/抖音/本地', picked:true },
    { rank:2, title:'中轴线申遗成功一周年', heat:86, trend:'+64%', pred:'高', cat:'文化', src:'微博/视频号' },
    { rank:3, title:'早高峰多条地铁限流提示', heat:79, trend:'+128%', pred:'高', cat:'民生', src:'本地/抖音' },
    { rank:4, title:'2026 服贸会筹备进展', heat:71, trend:'+22%', pred:'中', cat:'经济', src:'微博/今日头条' },
    { rank:5, title:'老旧小区加装电梯新政', heat:64, trend:'+41%', pred:'中', cat:'民生', src:'本地' },
    { rank:6, title:'冬奥场馆赛后利用观察', heat:58, trend:'+9%', pred:'中', cat:'体育', src:'视频号' },
    { rank:7, title:'京津冀首条市域铁路', heat:52, trend:'+17%', pred:'中', cat:'交通', src:'微博' },
    { rank:8, title:'初雪打卡故宫红墙白雪', heat:49, trend:'+88%', pred:'高', cat:'文化', src:'抖音/小红书' },
  ];

  /* —— 智能审核：风险标记 —— */
  const auditQueue = [
    { id:'a1', level:'high', flag:'时政复核', title:'寒潮稿涉部门表态 需多级复核', detail:'稿件引用市交通委表态，触发时政强制多级复核流程', who:'守正', at:'08:36', status:'待终审' },
    { id:'a2', level:'mid',  flag:'画面合规', title:'竖屏版 00:12 处出现外台水印', detail:'AI 检出第三方水印，建议裁切或替换', who:'守正', at:'08:34', status:'待处理' },
    { id:'a3', level:'low',  flag:'字幕校对', title:'「橙色预警」误写为「黄色预警」', detail:'字幕与口播不一致，已自动定位 3 处', who:'同声', at:'08:31', status:'已修正' },
    { id:'a4', level:'pass', flag:'敏感筛查', title:'全文敏感词扫描通过', detail:'文字 / 画面 / 音频三模态巡检无异常', who:'守正', at:'08:28', status:'通过' },
    { id:'a5', level:'mid',  flag:'广告剔除', title:'素材入镜商铺招牌 建议虚化', detail:'命中 15 类定向剔除中的「商业标识」', who:'守正', at:'08:25', status:'待处理' },
  ];

  /* —— 融媒直播：多画面监看 —— */
  const liveSignals = [
    { id:'s1', name:'演播室主信号', tone:'thumb-studio', live:true },
    { id:'s2', name:'长安街 5G 前方', tone:'thumb-snow', live:true },
    { id:'s3', name:'八达岭风口', tone:'thumb-road', live:false },
    { id:'s4', name:'地铁早高峰', tone:'thumb-city', live:false },
    { id:'s5', name:'气象台连线', tone:'thumb-gov', live:false },
    { id:'s6', name:'供热指挥中心', tone:'thumb-night', live:false },
    { id:'s7', name:'社区现场', tone:'thumb-snow', live:false },
    { id:'s8', name:'无人机航拍', tone:'thumb-road', live:false },
  ];

  /* —— 传播反馈：分钟级收视曲线 + 平台数据 —— */
  const ratingCurve = [12,18,26,31,29,34,42,55,61,58,67,73,69,78,84,80,88,92,86,79,71,64];
  const platformPerf = [
    { id:'dy',   name:'抖音·北京时间', play:'1286万', rate:'+182%', tone:'#D11A2A' },
    { id:'sph',  name:'BRTV 视频号',  play:'472万',  rate:'+96%',  tone:'#8C2B22' },
    { id:'bjtime', name:'北京时间 APP', play:'368万', rate:'+54%',  tone:'#C8102E' },
    { id:'wb',   name:'微博·北京时间', play:'910万',  rate:'+121%', tone:'#A8201A' },
  ];
  const briefStats = [
    { k:'全网总播放', v:'3,041', unit:'万' },
    { k:'传播力指数', v:'92.6', unit:'分' },
    { k:'峰值收视率', v:'4.18', unit:'%' },
    { k:'话题上榜', v:'5', unit:'个' },
  ];

  /* —— 用户运营：千人千面推荐流 + 画像 —— */
  const userProfile = {
    name:'用户 · 京城晚归人', tags:['通勤族','关注民生','22:00活跃','听播客'],
    interests:[ {k:'民生服务',v:82}, {k:'交通出行',v:74}, {k:'本地文化',v:61}, {k:'财经',v:38} ],
  };
  const recoFeed = [
    { id:'r1', title:'寒潮天通勤指南：这 6 条地铁早高峰限流', match:96, tone:'thumb-city', kind:'图文' },
    { id:'r2', title:'听听FM｜今晚冷到破纪录？气象台首席解读', match:91, tone:'thumb-studio', kind:'音频' },
    { id:'r3', title:'30秒看懂｜北京除雪保畅是怎么连夜打的', match:88, tone:'thumb-snow', kind:'竖屏' },
    { id:'r4', title:'故宫红墙白雪 今冬第一波打卡攻略', match:79, tone:'thumb-gov', kind:'图集' },
  ];

  /* —— 六大场景（一句话定位 + 3指标 + 流程 + 代表输出）—— */
  const scenarios = [
    {
      id:'produce', name:'智能生产', tagline:'门户心脏 · AI 完成 80% 粗活，人工 20% 精修终审',
      icon:'produce', accent:'#D11A2A', priority:'P0', share:'31.1%', deep:true,
      metrics:[ {n:'50%',l:'成片周期缩短'}, {n:'100×',l:'素材检索效率'}, {n:'5min',l:'快讯响应'} ],
      flow:['素材入库','AI打标','跨模态检索','AI粗剪/撰稿','多版本分产','人工精修','一键分发'],
      roles:'文稿编辑·视频剪辑·音频编辑·国际传播', centers:'7 个业务中心',
    },
    {
      id:'audit', name:'智能审核', tagline:'安全红线守护者 · AI 预筛标记，人工终审不可跳过',
      icon:'audit', accent:'#8C2B22', priority:'P0', share:'10.7%',
      metrics:[ {n:'40%',l:'审片效率提升'}, {n:'≈0',l:'漏检率'}, {n:'实时',l:'直播巡检'} ],
      flow:['AI预审','标记风险','人工终审','实时巡检','异常阻断','查删归档'],
      roles:'审核主编·技术值班', centers:'5 个业务中心',
      outTitle:'风险标记审核台',
    },
    {
      id:'live', name:'融媒直播', tagline:'直播全流程自动化 · AI 搭建推流拆条，导播人工干预',
      icon:'live', accent:'#C8102E', priority:'P1', share:'10.2%',
      metrics:[ {n:'10min',l:'直播搭建'}, {n:'0人工',l:'自动集锦'}, {n:'1人',l:'OPC 全流程'} ],
      flow:['自动搭建','AI推流','智能监看','实时互动','AI拆条','多平台分发'],
      roles:'导播·主播·运营·技术值班', centers:'5 个业务中心',
      outTitle:'多画面导播监看台',
    },
    {
      id:'plan', name:'选题策划', tagline:'7×24 热点监测 + 传播力预测 · 编辑从找选题变判选题',
      icon:'plan', accent:'#A8201A', priority:'P1', share:'9.0%',
      metrics:[ {n:'分钟级',l:'热点发现'}, {n:'50%',l:'试错成本降低'}, {n:'自动',l:'同题对标'} ],
      flow:['全网监测','AI聚类','热度预测','选题推送','编辑研判','共享协作'],
      roles:'策划编辑·制片人·记者', centers:'4 个业务中心',
      outTitle:'热点榜 + 传播力预测',
    },
    {
      id:'feedback', name:'传播反馈', tagline:'全平台数据自动采集分析 · 反哺选题形成大闭环',
      icon:'feedback', accent:'#9D5A2A', priority:'P1', share:'9.0%', dark:true,
      metrics:[ {n:'自动',l:'报表生成'}, {n:'分钟级',l:'收视分析'}, {n:'全链路',l:'效能量化'} ],
      flow:['数据采集','自动分析','效能看板','简报生成','反哺选题','策略优化'],
      roles:'运营编辑·制片人·策划编辑', centers:'5 个业务中心',
      outTitle:'分钟级收视效能大屏',
    },
    {
      id:'operate', name:'用户运营', tagline:'千人千面推荐 + AI 互动 · 人工专注策略设定',
      icon:'operate', accent:'#C8A86A', priority:'P1', share:'6.8%',
      metrics:[ {n:'千人千面',l:'个性推荐'}, {n:'60%',l:'发现成本降低'}, {n:'秒级',l:'私域响应'} ],
      flow:['用户画像','兴趣图谱','千人千面','AI互动','日活跟踪','留存变现'],
      roles:'新媒体运营·运营编辑', centers:'3 个业务中心',
      outTitle:'千人千面推荐流',
    },
  ];

  /* —— IM 群消息流（融媒生产群）—— */
  const imThread = [
    { who:'topic', type:'card', cardKind:'topic', t:'06:42', title:'热点预警 · 极高传播力',
      lines:['「北京入冬最强寒潮」全网热度 98','预测传播力：极高 · 建议立即立项'], actions:['一键立项','看研判'] },
    { who:'me', type:'text', t:'06:43', text:'立项，按突发民生走快讯+成片，@编导 Agent 排一下' },
    { who:'daoyan', type:'text', t:'06:43', text:'收到，已建任务「寒潮应急」，拉前方记者 5G 回传，撰稿/粗剪并行。' },
    { who:'tagger', type:'card', cardKind:'material', t:'07:01', title:'素材已入库并打标',
      lines:['长安街除雪 5G回传 02:14','已自动生成 8 个标签 · 识别 1 位出镜记者'], actions:['查看素材'] },
    { who:'writer', type:'card', cardKind:'draft', t:'07:12', title:'快讯初稿已生成',
      lines:['北京升级发布寒潮橙色预警……','耗时 38 秒 · 可直接编辑'], actions:['编辑稿件','一键成片'] },
    { who:'me', type:'text', t:'07:14', text:'@快刀 出一个竖屏 45 秒版，大字幕卡点' },
    { who:'cutter', type:'text', t:'07:14', text:'正在粗剪竖屏版…', working:true },
    { who:'cutter', type:'card', cardKind:'video', t:'07:16', title:'竖屏版粗剪完成 00:45',
      lines:['9:16 · 大字幕 · 6 个分镜','配《北京时间》片头'], actions:['预览','送审'] },
    { who:'auditor', type:'card', cardKind:'audit', t:'08:36', title:'审核：1 项需时政复核',
      lines:['稿件涉部门表态，触发多级复核','其余敏感/版权巡检通过'], actions:['去终审'] },
  ];

  return { employees, emp, channels, story, pipeline, metrics, trending, auditQueue,
    liveSignals, ratingCurve, platformPerf, briefStats, userProfile, recoFeed, scenarios, imThread };
})();
