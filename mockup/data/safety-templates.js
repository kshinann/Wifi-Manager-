/* Varia Connect — safety templates. One source for the fillable in-app forms
   and the printable Word/PDF versions.

   Section types:
     fields  — label/value inputs: t = text | date | time | num | area | select (opts)
     yesno   — checklist answered Yes / No / N/A
     checks  — tick-all-that-apply list
     table   — blank rows to fill (cols, rows)
     signs   — sign-off blocks (role, then name / signature / date & time)
     matrix  — 5×5 likelihood × severity risk matrix (DOSH HIRARC 2008)
     note    — fixed guidance text

   Limits and references are typical Malaysian practice for a draft. The
   company SHO must review every template before it is used on site. */
(function(){
const COMMON_HEAD = [
  {l:'Project / site',t:'text'},{l:'Permit no.',t:'text',auto:'PTW'},
  {l:'Date',t:'date'},{l:'Exact location (block / level / grid)',t:'text'},
  {l:'Description of work',t:'area'},{l:'Company / subcontractor',t:'text'},
  {l:'Permit holder (in charge on site)',t:'text'},{l:'Number of workers',t:'num'},
  {l:'Valid from',t:'time'},{l:'Valid until',t:'time'}
];
const SIGN_PTW = {h:'Authorisation',type:'signs',roles:[
  'Applicant / permit holder: I understand the hazards and will follow every precaution listed',
  'Safety & Health Officer / Site Safety Supervisor: site checked, precautions in place',
  'Site manager (issuer): permit approved']};
const CLOSE_PTW = {h:'Hand-back and closure',type:'yesno',items:[
  'Work completed / stopped (circle which)','All workers and tools withdrawn from the area',
  'Area left clean and safe; barriers removed or left in place as agreed',
  'Isolations removed or handed back (if any)']};
const SIGN_CLOSE = {h:'Closure sign-off',type:'signs',roles:['Permit holder','Issuer / SHO']};
const PPE = (extra) => ({h:'PPE required',type:'checks',items:[
  'Safety helmet with chin strap','Safety boots','High-visibility vest','Safety glasses / goggles','Gloves (specify type)'].concat(extra||[])});

window.VC_TEMPLATES = [
/* ---------------- Permits to work ---------------- */
{id:'PTW-GEN',cat:'Permits to work',title:'General Permit to Work',bm:'Permit Kerja Am',validity:'One shift, maximum 12 hours',
 use:'Any non-routine work that is not covered by a specific permit below, for example work in live areas, road closures or work near operating plant.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD},
  {h:'Hazards identified',type:'checks',items:['Falling objects','Moving plant / vehicles','Slips, trips and falls','Manual handling','Noise','Dust','Electricity','Hazardous chemicals','Public / third parties nearby','Other (specify)']},
  {h:'Precautions before work starts',type:'yesno',items:[
   'Method statement and risk assessment (HIRARC / JSA) reviewed with the team',
   'Toolbox talk held and attendance recorded today',
   'Work area barricaded with signage',
   'Workers hold valid CIDB green cards',
   'Tools and equipment inspected and fit for use',
   'Emergency route, first aider and fire extinguisher identified',
   'Other trades in the area informed']},
  PPE(['Ear protection','Dust mask']),
  SIGN_PTW, CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-HOT',cat:'Permits to work',title:'Hot Work Permit',bm:'Permit Kerja Panas',validity:'One shift; fire watch continues 30 minutes after work ends',
 use:'Welding, gas cutting, grinding, brazing, torch-on waterproofing and any work producing sparks or open flame.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([{l:'Type of hot work',t:'select',opts:['Arc welding','Gas cutting / welding','Grinding','Torch-on membrane','Other']}])},
  {h:'Precautions before work starts',type:'yesno',items:[
   'Combustible materials removed within 11 m, or covered with fire blankets',
   'Floor and wall openings covered to stop sparks falling to levels below',
   'Fire extinguisher (min. 9 kg dry powder) at the work point',
   'Trained fire watcher assigned, with no other duties',
   'Gas cylinders upright, chained, with flashback arrestors and regulators checked',
   'Welding set earthed; cables free of damage',
   'Gas test done if work is near drains, tanks or enclosed spaces',
   'Fire alarm / smoke detectors in the area isolated (if any) and fire team informed']},
  {h:'Gas test (if required)',type:'table',cols:['Time','LEL % (must be 0)','O₂ % (19.5–23.5)','Tested by'],rows:3},
  PPE(['Welding helmet / face shield','Leather welding gloves & apron','Fire-resistant clothing']),
  SIGN_PTW,
  {h:'Fire watch after work',type:'fields',fields:[{l:'Hot work finished at',t:'time'},{l:'Fire watch ended at (min. 30 min later)',t:'time'},{l:'Fire watcher name',t:'text'}]},
  CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-WAH',cat:'Permits to work',title:'Work at Height Permit',bm:'Permit Kerja di Tempat Tinggi',validity:'One shift',
 use:'Any work where a person could fall 2 m or more, or near an unprotected edge or opening: scaffolds, ladders, MEWPs, roofs, façade, lift shafts.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([{l:'Working height (m)',t:'num'},{l:'Access method',t:'select',opts:['Scaffold','Mobile scaffold','MEWP / scissor lift','Ladder (short duration only)','Rope access','Roof edge','Other']}])},
  {h:'Precautions before work starts',type:'yesno',items:[
   'Scaffold has a green tag inspected within the last 7 days',
   'Guardrails (top and mid rail) and toe boards in place at open edges',
   'Openings covered and marked "LUBANG / OPENING"',
   'Full-body harness with double lanyard inspected; anchor point identified',
   'MEWP operator trained; pre-use check done; ground firm and level',
   'Area below barricaded against falling objects',
   'Tools tied off / tool lanyards used',
   'Weather checked: stop work in heavy rain, lightning or strong wind',
   'Rescue plan in place for a suspended worker',
   'Workers medically fit (no fear of heights, dizziness or medication)']},
  PPE(['Full-body harness with double lanyard','Chin strap fastened']),
  SIGN_PTW, CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-CSE',cat:'Permits to work',title:'Confined Space Entry Permit',bm:'Permit Kemasukan Ruang Terkurung',validity:'One shift; retest gas after every break',
 use:'Entry into manholes, sumps, tanks, pits, ducts, culverts or any space with limited entry and exit and possible poor air. Follows the DOSH Industry Code of Practice for Safe Working in a Confined Space 2010.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([{l:'Confined space name / ID',t:'text'},{l:'Authorised Entry Supervisor (AES)',t:'text'},{l:'Authorised Gas Tester (AGT)',t:'text'},{l:'Standby person (AESP) at entrance',t:'text'}])},
  {h:'Precautions before entry',type:'yesno',items:[
   'All entrants and standby person trained as AESP (valid certificate)',
   'Space isolated: pipes blanked, valves locked, power locked out (LOTO)',
   'Space ventilated; forced ventilation running throughout the work',
   'Gas test done from the top, middle and bottom of the space',
   'Continuous personal gas detector worn by each entrant',
   'Rescue tripod, winch and harness set up at the entrance',
   'Standby person stays at the entrance at all times and never enters',
   'Communication method agreed (radio / signal rope)',
   'Entry log kept at the entrance',
   'Emergency services number and nearest hospital noted']},
  {h:'Atmospheric test record',type:'table',cols:['Time','O₂ % (19.5–23.5)','LEL % (<10)','H₂S ppm (<10)','CO ppm (<25)','Tested by (AGT)'],rows:5},
  {h:'Entry log',type:'table',cols:['Name','Time in','Time out','Signature'],rows:6},
  PPE(['Full-body harness with lifeline','Breathing apparatus (if required)','Personal gas detector']),
  SIGN_PTW, CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-LIFT',cat:'Permits to work',title:'Lifting Operation Permit',bm:'Permit Operasi Mengangkat',validity:'For the lift(s) described, within one shift',
 use:'Crane lifts with a tower crane, mobile crane or hoist. Required for every critical lift: loads over 75% of rated capacity, tandem lifts, lifts over occupied areas or near power lines.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([
   {l:'Crane type and ID',t:'text'},{l:'DOSH PMA certificate no. and expiry',t:'text'},{l:'Load description',t:'text'},
   {l:'Load weight incl. rigging (t)',t:'num'},{l:'Radius (m)',t:'num'},{l:'Rated capacity at this radius (t)',t:'num'},{l:'% of capacity',t:'num'},
   {l:'Crane operator (DOSH competency no.)',t:'text'},{l:'Rigger / signaller',t:'text'}])},
  {h:'Precautions before lifting',type:'yesno',items:[
   'Lift plan prepared and approved (mandatory for critical lifts)',
   'Crane PMA certificate valid and on site',
   'Daily pre-use check done; limit switches and LMI / SLI working',
   'Slings, shackles and hooks inspected; colour-coded tag current',
   'Outriggers fully extended on firm ground with mats (mobile crane)',
   'Exclusion zone barricaded; nobody under the suspended load',
   'Tag lines attached to control the load',
   'Wind speed checked within manufacturer limit (record below)',
   'Safe distance from overhead power lines confirmed with TNB if needed',
   'Signaller in sight of the operator or on radio; signals agreed']},
  {h:'Conditions at time of lift',type:'fields',fields:[{l:'Wind speed (m/s)',t:'num'},{l:'Weather',t:'select',opts:['Fine','Cloudy','Light rain','Heavy rain — stop','Thunderstorm — stop']}]},
  PPE(['Gloves for riggers']),
  SIGN_PTW, CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-EXC',cat:'Permits to work',title:'Excavation Permit',bm:'Permit Kerja Pengorekan',validity:'Until backfilled; inspect daily and after rain',
 use:'Any digging, trenching, piling or breaking ground, where underground services or collapse are a risk.',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([{l:'Excavation depth (m)',t:'num'},{l:'Length × width (m)',t:'text'},{l:'Method',t:'select',opts:['Excavator','Hand digging','Piling','Breaker','Other']}])},
  {h:'Underground services',type:'yesno',items:[
   'Service drawings checked (TNB, TM, water, IWK sewer, gas)',
   'Area scanned with CAT and Genny / GPR; services marked on the ground',
   'Trial holes dug by hand to expose services near the dig line',
   'Utility owner consulted where services are within 1 m']},
  {h:'Precautions',type:'yesno',items:[
   'Sides battered, benched or shored as per method statement (all trenches deeper than 1.5 m)',
   'Spoil and materials kept at least 1 m from the edge',
   'Edge protection or barricade around the excavation',
   'Safe access ladder every 15 m along the trench',
   'Dewatering pump available; water level monitored',
   'Plant kept back from the edge; stop blocks in place for vehicles',
   'Excavation inspected by a competent person at the start of every shift and after rain']},
  PPE(),
  SIGN_PTW, CLOSE_PTW, SIGN_CLOSE]},

{id:'PTW-LOTO',cat:'Permits to work',title:'Electrical Isolation (LOTO) Permit',bm:'Permit Pengasingan Elektrik (LOTO)',validity:'Until the isolation is removed',
 use:'Work on or near electrical installations, switchboards or machinery that must be made dead. Carried out by a competent person registered with Suruhanjaya Tenaga (chargeman / wireman as required).',
 sections:[
  {h:'Permit details',type:'fields',fields:COMMON_HEAD.concat([{l:'Equipment / circuit to be isolated',t:'text'},{l:'Isolation point (DB / switch no.)',t:'text'},{l:'Competent person & ST registration no.',t:'text'}])},
  {h:'Isolation steps',type:'yesno',items:[
   'Equipment users informed before switching off',
   'Switched off at the isolation point',
   'Personal padlock and "DANGER — DO NOT OPERATE" tag fitted by each worker',
   'Stored energy released (capacitors, springs, pressure)',
   'Tested dead with an approved voltage tester (tester proved before and after)',
   'Nearby live parts covered or barricaded',
   'Earthing applied where required']},
  {h:'Lock register',type:'table',cols:['Name','Lock no.','Time on','Time removed','Signature'],rows:5},
  PPE(['Insulated gloves (rated)','Arc-flash face shield (if live work nearby)']),
  SIGN_PTW,
  {h:'Re-energising',type:'yesno',items:['All locks and tags removed by their owners','Guards replaced; tools removed','Users informed before switching on']},
  SIGN_CLOSE]},

/* ---------------- Risk assessment ---------------- */
{id:'RA-HIRARC',cat:'Risk assessment',title:'HIRARC — Hazard Identification, Risk Assessment and Risk Control',bm:'Pengenalpastian Hazard, Penaksiran Risiko dan Kawalan Risiko',validity:'Review when the method changes, after an incident, or at least yearly',
 use:'Formal risk assessment for each work activity, following the DOSH Guidelines for HIRARC (2008). Score risk = Likelihood × Severity using the matrix.',
 sections:[
  {h:'Assessment details',type:'fields',fields:[{l:'Project / site',t:'text'},{l:'Activity / process',t:'text'},{l:'Location',t:'text'},{l:'Assessment no.',t:'text'},{l:'Date',t:'date'},{l:'Assessed by',t:'text'},{l:'Review date',t:'date'}]},
  {h:'Risk matrix',type:'matrix'},
  {h:'Hazard register',type:'table',cols:['No.','Work step','Hazard','Effect / who is harmed','Existing controls','L','S','Risk (L×S)','Additional controls','Residual risk','PIC & due date'],rows:8,wide:true,w:[.04,.11,.11,.11,.12,.04,.04,.07,.14,.08,.14]},
  {h:'Hierarchy of controls',type:'note',text:'Apply controls in this order: 1. Eliminate the hazard. 2. Substitute with something less hazardous. 3. Engineering controls (guards, guardrails, ventilation). 4. Administrative controls (permits, procedures, training, signage). 5. PPE as the last line of defence.'},
  {h:'Approval',type:'signs',roles:['Prepared by (supervisor / engineer)','Reviewed by (SHO)','Approved by (project manager)']}]},

{id:'RA-JSA',cat:'Risk assessment',title:'Job Safety Analysis (JSA)',bm:'Analisis Keselamatan Kerja',validity:'For the job and crew named; redo if the method changes',
 use:'Quick, step-by-step risk check done with the work crew before a specific job. Shorter than a HIRARC; use it at the workface.',
 sections:[
  {h:'Job details',type:'fields',fields:[{l:'Job / task',t:'text'},{l:'Location',t:'text'},{l:'Date',t:'date'},{l:'Supervisor',t:'text'},{l:'Related HIRARC no.',t:'text'},{l:'Related permit no.',t:'text'}]},
  {h:'Job steps',type:'table',cols:['Step','What we do','What could go wrong (hazard)','How we stop it (control)','Who'],rows:8,wide:true,w:[.06,.22,.26,.30,.16]},
  PPE(),
  {h:'Crew sign-on: I took part in this JSA and understand the controls',type:'table',cols:['Name','Trade','CIDB card no.','Signature'],rows:8}]},

/* ---------------- Inspections & checklists ---------------- */
{id:'INS-SITE',cat:'Inspections & checklists',title:'Daily Site Safety Inspection',bm:'Pemeriksaan Keselamatan Tapak Harian',validity:'Daily, before 10 am',
 use:'Walk-round by the SHO or site safety supervisor. Any "No" needs an action, owner and due date.',
 sections:[
  {h:'Inspection details',type:'fields',fields:[{l:'Project / site',t:'text'},{l:'Date',t:'date'},{l:'Time',t:'time'},{l:'Inspected by',t:'text'},{l:'Areas covered',t:'text'},{l:'Weather',t:'select',opts:['Fine','Cloudy','Rain','After heavy rain']}]},
  {h:'Housekeeping & access',type:'yesno',items:['Walkways and stairs clear of materials and debris','Rubbish removed; no protruding nails','Adequate lighting in basements, stairwells and cores','Drinking water and rest area available']},
  {h:'Falls & openings',type:'yesno',items:['Edge protection complete on all open edges','Floor openings and lift shafts covered or guarded','Scaffolds tagged green; no missing boards or rails','Ladders secured and in good condition']},
  {h:'Plant, lifting & electrical',type:'yesno',items:['Crane and hoist PMA certificates valid','Lifting gear tagged with the current colour code','Temporary DBs locked, with ELCB/RCCB working','Cables elevated or protected; no damaged plugs']},
  {h:'Fire, health & environment',type:'yesno',items:['Fire extinguishers in place and in date','Chemicals labelled; SDS available','Silt trap and wash trough working; no muddy runoff to drains','Mosquito breeding checked (no stagnant water)']},
  {h:'People',type:'yesno',items:['All workers wearing required PPE','Toolbox talk held this morning','Permits displayed at each permit-controlled work area']},
  {h:'Findings and actions',type:'table',cols:['No.','Finding (photo ref.)','Action required','PIC','Due','Closed (date)'],rows:6,wide:true,w:[.06,.32,.3,.12,.1,.1]},
  {h:'Sign-off',type:'signs',roles:['Inspected by','Acknowledged by site manager']}]},

{id:'INS-SCAF',cat:'Inspections & checklists',title:'Scaffold Inspection Checklist (Scafftag)',bm:'Senarai Semak Pemeriksaan Perancah',validity:'Before first use, at least every 7 days, and after bad weather or alteration',
 use:'Inspection by a competent scaffolder or designated person. Green tag = safe to use. Red tag = do not use.',
 sections:[
  {h:'Scaffold details',type:'fields',fields:[{l:'Scaffold ID / location',t:'text'},{l:'Type',t:'select',opts:['Tubular & fitting','System scaffold','Mobile tower','Cantilever / truss-out','Hanging']},{l:'Height (m)',t:'num'},{l:'Duty / load class',t:'text'},{l:'Erected by',t:'text'},{l:'Date of inspection',t:'date'}]},
  {h:'Checks',type:'yesno',items:['Base plates and sole boards on firm ground','Standards plumb; ledgers and transoms level','Bracing complete; ties to building at required spacing','Fully boarded platform; boards secured, no gaps or overhang','Guardrails (top & mid) and toe boards on all open sides','Safe access ladder or stair, secured and extending 1 m above platform','No overloading (materials within duty rating)','Couplers tight; no damaged tubes','Debris netting / catch fans in place where required','Clearance from overhead power lines']},
  {h:'Result',type:'fields',fields:[{l:'Tag status',t:'select',opts:['GREEN — safe to use','RED — do not use']},{l:'Defects found / action taken',t:'area'},{l:'Next inspection due',t:'date'}]},
  {h:'Inspector',type:'signs',roles:['Competent scaffold inspector']}]},

{id:'INS-PPE',cat:'Inspections & checklists',title:'PPE Issue Record',bm:'Rekod Pengeluaran PPE',validity:'Ongoing register',
 use:'Record of PPE issued to each worker. Workers sign to confirm they received it and were shown how to use it.',
 sections:[
  {h:'Details',type:'fields',fields:[{l:'Project / site',t:'text'},{l:'Company / subcontractor',t:'text'},{l:'Issued by (storekeeper)',t:'text'}]},
  {h:'Issue register',type:'table',cols:['Date','Worker name','CIDB card no.','Item (helmet / boots / vest / harness / gloves / other)','Size','Qty','New / replacement','Worker signature'],rows:12,wide:true,w:[.09,.18,.12,.22,.06,.05,.12,.16]}]},

{id:'INS-LIFT',cat:'Inspections & checklists',title:'Lifting Gear & Crane Pre-use Checklist',bm:'Senarai Semak Pra-Guna Kren dan Alat Angkat',validity:'Daily before first lift',
 use:'Filled by the crane operator before the first lift of the day. Any "No" means the crane or gear is not used until fixed.',
 sections:[
  {h:'Details',type:'fields',fields:[{l:'Crane / hoist ID',t:'text'},{l:'Date',t:'date'},{l:'Operator',t:'text'},{l:'Hour meter',t:'num'}]},
  {h:'Crane checks',type:'yesno',items:['PMA certificate valid and displayed','Load chart in the cab','Limit switches (hoist, slew, trolley) working','LMI / SLI working; alarm audible','Brakes working','Wire ropes: no broken wires, kinks or crushing','Hook safety latch working','No oil leaks; fluid levels correct','Anemometer working','Horn, lights and radio working']},
  {h:'Lifting gear checks',type:'yesno',items:['Slings carry SWL label and current colour tag','No cuts, burns or broken stitching on webbing slings','Chain slings: no stretched or damaged links','Shackles: correct pin, not bent','Spreader beams / lifting frames certified']},
  {h:'Sign-off',type:'signs',roles:['Crane operator','Lifting supervisor']}]},

{id:'INS-PLANT',cat:'Inspections & checklists',title:'Machinery & Plant Pre-use Checklist',bm:'Senarai Semak Pra-Guna Jentera',validity:'Daily before use',
 use:'For excavators, loaders, dump trucks, rollers, generators and similar plant. A failed check locks the machine out until a supervisor clears it.',
 sections:[
  {h:'Details',type:'fields',fields:[{l:'Machine type & ID',t:'text'},{l:'Date',t:'date'},{l:'Operator (licence / competency no.)',t:'text'},{l:'Hour meter',t:'num'}]},
  {h:'Checks',type:'yesno',items:['Engine oil, coolant and hydraulic oil levels correct','No leaks under the machine','Tyres / tracks in good condition','Brakes and parking brake working','Seat belt fitted and working','Reverse alarm and beacon working','Mirrors and windows clean, not cracked','Fire extinguisher on board','Bucket teeth, pins and quick-hitch locked','Guards in place on moving parts']},
  {h:'Result',type:'fields',fields:[{l:'Machine status',t:'select',opts:['Fit for use','Not fit — locked out']},{l:'Defects found',t:'area'}]},
  {h:'Sign-off',type:'signs',roles:['Operator','Supervisor']}]},

/* ---------------- Reporting forms ---------------- */
{id:'REP-INC',cat:'Reporting forms',title:'Incident & Near-Miss Report',bm:'Laporan Insiden dan Nyaris Kemalangan',validity:'Report immediately; investigation within 48 hours',
 use:'For every injury, near miss, dangerous occurrence or property damage. Under NADOPOD 2004, a death, serious bodily injury, or injury keeping a worker off work for more than 4 days must be reported to the nearest DOSH (JKKP) office by the quickest means, followed by form JKKP 6 within 7 days.',
 sections:[
  {h:'What happened',type:'fields',fields:[{l:'Report no.',t:'text'},{l:'Date of incident',t:'date'},{l:'Time',t:'time'},{l:'Exact location',t:'text'},
   {l:'Type',t:'select',opts:['Near miss','First aid case','Medical treatment case','Lost time injury','Dangerous occurrence','Fatality','Property damage','Environmental']},
   {l:'Description (what, how, sequence of events)',t:'area'},{l:'Immediate action taken',t:'area'}]},
  {h:'Person(s) involved',type:'table',cols:['Name','Company','Trade','Injury (part of body / nature)','Treatment / hospital','MC days'],rows:3,wide:true},
  {h:'Witnesses',type:'table',cols:['Name','Company','Contact'],rows:3},
  {h:'Investigation',type:'fields',fields:[{l:'Immediate causes (unsafe act / unsafe condition)',t:'area'},{l:'Root causes (5 Whys)',t:'area'},{l:'Photos / evidence reference',t:'text'}]},
  {h:'Corrective and preventive actions',type:'table',cols:['Action','PIC','Due','Status'],rows:4,w:[.5,.2,.15,.15]},
  {h:'Notification',type:'yesno',items:['Client / consultant informed','DOSH (JKKP) notified by quickest means (if NADOPOD reportable)','JKKP 6 submitted within 7 days (if reportable)','PERKESO (SOCSO) claim form started (if injury)']},
  {h:'Sign-off',type:'signs',roles:['Reported by','Investigated by (SHO)','Reviewed by (project manager)']}]},

{id:'REP-TBT',cat:'Reporting forms',title:'Toolbox Talk Attendance',bm:'Kehadiran Taklimat Keselamatan',validity:'Daily',
 use:'Short safety briefing before work starts. Keep the talk under 15 minutes and use the language the crew understands.',
 sections:[
  {h:'Talk details',type:'fields',fields:[{l:'Date',t:'date'},{l:'Time',t:'time'},{l:'Location',t:'text'},{l:'Topic',t:'text'},{l:'Presented by',t:'text'},
   {l:'Language(s) used',t:'select',opts:['Bahasa Malaysia','English','Bengali','Nepali','Myanmar','Indonesian','Vietnamese','Mixed']},{l:'Key points covered',t:'area'}]},
  {h:'Attendance',type:'table',cols:['No.','Name','Company / trade','CIDB card no.','Signature / thumbprint'],rows:20,wide:true,w:[.06,.3,.24,.18,.22]}]},

{id:'REP-SHC',cat:'Reporting forms',title:'Monthly Safety & Health Committee Report',bm:'Laporan Bulanan Jawatankuasa Keselamatan dan Kesihatan',validity:'Monthly (committee must meet at least once every 3 months under the OSH (Safety and Health Committee) Regulations 1996)',
 use:'Summary for the site safety and health committee meeting and for head office.',
 sections:[
  {h:'Report details',type:'fields',fields:[{l:'Project / site',t:'text'},{l:'Month',t:'text'},{l:'Meeting date',t:'date'},{l:'Chairperson',t:'text'},{l:'Secretary (SHO)',t:'text'}]},
  {h:'Statistics this month',type:'fields',fields:[{l:'Average workers on site',t:'num'},{l:'Man-hours worked',t:'num'},{l:'Days without LTI (to date)',t:'num'},{l:'Lost time injuries',t:'num'},{l:'Medical treatment cases',t:'num'},{l:'First aid cases',t:'num'},{l:'Near misses reported',t:'num'},{l:'Hazard observations raised / closed',t:'text'},{l:'Toolbox talks held / average attendance %',t:'text'},{l:'Permits issued',t:'num'}]},
  {h:'Incidents summary',type:'table',cols:['Date','Type','Description','Root cause','Action status'],rows:4,wide:true},
  {h:'Inspections and audits',type:'table',cols:['Date','By (internal / DOSH / client)','Key findings','Status'],rows:3},
  {h:'Matters arising and decisions',type:'table',cols:['No.','Matter','Decision / action','PIC','Due'],rows:5,wide:true,w:[.06,.32,.34,.14,.14]},
  {h:'Attendance',type:'table',cols:['Name','Position / company','Signature'],rows:8},
  {h:'Approval',type:'signs',roles:['Chairperson','Secretary (SHO)']}]}
];
})();
