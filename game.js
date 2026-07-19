
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const track = new Image();
track.src = "assets/tracks/clean_oval_track.jpg";

const sweeper = new Image();
sweeper.src = "assets/vehicles/street_sweeper_4brush_right.png";

const dirtImgs = [], leafImgs = [];
for (let i = 1; i <= 12; i++) {
  const n = String(i).padStart(2, "0");
  const d = new Image(), l = new Image();
  d.src = `assets/overlays/dirt/dirt_${n}.png`;
  l.src = `assets/overlays/leaves/leaves_${n}.png`;
  dirtImgs.push(d); leafImgs.push(l);
}

function viewportSize() {
  const de = document.documentElement;
  const width = Math.max(
    1,
    Math.round(window.innerWidth || 0),
    Math.round(de.clientWidth || 0)
  );
  const height = Math.max(
    1,
    Math.round(window.innerHeight || 0),
    Math.round(de.clientHeight || 0)
  );
  return { width, height };
}

function resize() {
  const vp = viewportSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = `${vp.width}px`;
  canvas.style.height = `${vp.height}px`;
  canvas.width = Math.round(vp.width * dpr);
  canvas.height = Math.round(vp.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function scheduleResize() {
  resize();
  setTimeout(resize, 80);
  setTimeout(resize, 250);
  setTimeout(resize, 600);
}

addEventListener("resize", scheduleResize);
addEventListener("orientationchange", scheduleResize);
window.visualViewport?.addEventListener("resize", scheduleResize);
resize();

const keys = {};
const keyboardInput = {
  up:false, down:false, left:false, right:false,
  primary:false, secondary:false
};
const keyLocks = {};
const touchInput = { throttle:0, steer:0, action:0, secondary:0, start:0, select:0 };
const activePointers = new Map();

function screenLayout() {
  const { width: vw, height: vh } = viewportSize();
  const landscape = vw >= vh;

  if (!landscape) {
    const gameW = vw;
    const gameH = Math.min(vh * 0.52, gameW * WORLD.h / WORLD.w);
    return {
      landscape:false,
      vw, vh,
      game:{ x:0, y:0, w:gameW, h:gameH },
      leftPanel:{ x:0, y:gameH, w:vw/2, h:vh-gameH },
      rightPanel:{ x:vw/2, y:gameH, w:vw/2, h:vh-gameH }
    };
  }

  const maxGameW = vw * 0.56;
  const maxGameH = vh * 0.92;
  const scale = Math.min(maxGameW / WORLD.w, maxGameH / WORLD.h);
  const gameW = WORLD.w * scale;
  const gameH = WORLD.h * scale;
  const gameX = (vw - gameW) / 2;
  const gameY = (vh - gameH) / 2;

  return {
    landscape:true,
    vw, vh,
    game:{ x:gameX, y:gameY, w:gameW, h:gameH },
    leftPanel:{ x:0, y:0, w:gameX, h:vh },
    rightPanel:{ x:gameX+gameW, y:0, w:vw-(gameX+gameW), h:vh }
  };
}

function touchControlLayout() {
  const s = screenLayout();
  const lp = s.leftPanel, rp = s.rightPanel;

  if (!s.landscape) {
    const d = Math.max(52, Math.min(82, lp.w * 0.34));
    const cx = lp.x + lp.w/2;
    const cy = lp.y + lp.h*0.60;
    const button = Math.max(58, Math.min(86, rp.w * 0.34));
    return {
      up:     { x:cx-d/2, y:cy-d*1.45, w:d, h:d },
      down:   { x:cx-d/2, y:cy+d*0.45, w:d, h:d },
      left:   { x:cx-d*1.5, y:cy-d/2, w:d, h:d },
      right:  { x:cx+d*0.5, y:cy-d/2, w:d, h:d },
      a:      { x:rp.x+rp.w*0.62-button/2, y:rp.y+rp.h*0.45-button/2, w:button, h:button },
      b:      { x:rp.x+rp.w*0.40-button/2, y:rp.y+rp.h*0.72-button/2, w:button, h:button },
      start:  { x:lp.x+lp.w*0.50, y:lp.y+12, w:Math.max(48,lp.w*0.30), h:34 },
      select: { x:lp.x+lp.w*0.14, y:lp.y+12, w:Math.max(48,lp.w*0.30), h:34 }
    };
  }

  const d = Math.max(54, Math.min(90, Math.min(lp.w, lp.h) * 0.28));
  const cx = lp.x + lp.w/2;
  const cy = lp.y + lp.h*0.64;
  const button = Math.max(58, Math.min(92, Math.min(rp.w, rp.h) * 0.30));

  return {
    up:     { x:cx-d/2, y:cy-d*1.45, w:d, h:d },
    down:   { x:cx-d/2, y:cy+d*0.45, w:d, h:d },
    left:   { x:cx-d*1.5, y:cy-d/2, w:d, h:d },
    right:  { x:cx+d*0.5, y:cy-d/2, w:d, h:d },
    a:      { x:rp.x+rp.w*0.58-button/2, y:rp.y+rp.h*0.53-button/2, w:button, h:button },
    b:      { x:rp.x+rp.w*0.40-button/2, y:rp.y+rp.h*0.73-button/2, w:button, h:button },
    start:  { x:lp.x+lp.w*0.53, y:lp.y+lp.h*0.10, w:Math.max(54,lp.w*0.28), h:38 },
    select: { x:lp.x+lp.w*0.19, y:lp.y+lp.h*0.10, w:Math.max(54,lp.w*0.28), h:38 }
  };
}
function pointInBox(x,y,b) {
  return x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h;
}

let previousTouchButtons = {a:false,b:false,start:false,select:false};

function vibrateTap() {
  try { navigator.vibrate?.(18); } catch (_) {}
}

function updateTouchInput() {
  touchInput.throttle = 0;
  touchInput.steer = 0;
  touchInput.action = 0;
  touchInput.secondary = 0;
  touchInput.start = 0;
  touchInput.select = 0;

  if (state !== "game") return;
  const layout = touchControlLayout();

  for (const p of activePointers.values()) {
    if (pointInBox(p.x,p.y,layout.left)) touchInput.steer -= 1;
    if (pointInBox(p.x,p.y,layout.right)) touchInput.steer += 1;
    if (pointInBox(p.x,p.y,layout.up)) touchInput.throttle += 1;
    if (pointInBox(p.x,p.y,layout.down)) touchInput.throttle -= 1;
    if (pointInBox(p.x,p.y,layout.a)) touchInput.action = 1;
    if (pointInBox(p.x,p.y,layout.b)) touchInput.secondary = 1;
    if (pointInBox(p.x,p.y,layout.start)) touchInput.start = 1;
    if (pointInBox(p.x,p.y,layout.select)) touchInput.select = 1;
  }

  touchInput.throttle = Math.max(-1, Math.min(1, touchInput.throttle));
  touchInput.steer = Math.max(-1, Math.min(1, touchInput.steer));

  const now = {
    a:touchInput.action>0,
    b:touchInput.secondary>0,
    start:touchInput.start>0,
    select:touchInput.select>0
  };

  for (const k of Object.keys(now)) {
    if (now[k] && !previousTouchButtons[k]) vibrateTap();
  }

  previousTouchButtons = now;

  if (touchInput.select) state = "menu";
}
function pointerPosition(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (viewportSize().width / Math.max(1, rect.width)),
    y: (e.clientY - rect.top) * (viewportSize().height / Math.max(1, rect.height))
  };
}

function touchPosition(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (viewportSize().width / Math.max(1, rect.width)),
    y: (touch.clientY - rect.top) * (viewportSize().height / Math.max(1, rect.height))
  };
}

function syncTouches(e) {
  e.preventDefault();
  activePointers.clear();
  for (const touch of e.touches) {
    activePointers.set(touch.identifier, touchPosition(touch));
  }
  updateTouchInput();
}

canvas.addEventListener("touchstart", syncTouches, {passive:false});
canvas.addEventListener("touchmove", syncTouches, {passive:false});
canvas.addEventListener("touchend", syncTouches, {passive:false});
canvas.addEventListener("touchcancel", syncTouches, {passive:false});

// Pointer events remain for mouse/stylus testing, but touch uses the handlers above.
canvas.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch") return;
  e.preventDefault();
  if (state !== "game") return;
  activePointers.set(e.pointerId, pointerPosition(e));
  updateTouchInput();
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" || !activePointers.has(e.pointerId)) return;
  e.preventDefault();
  activePointers.set(e.pointerId, pointerPosition(e));
  updateTouchInput();
});
function releasePointer(e) {
  if (e.pointerType === "touch") return;
  activePointers.delete(e.pointerId);
  updateTouchInput();
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

function setKeyboardKey(code, down) {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      keyboardInput.up = down;
      break;
    case "ArrowDown":
    case "KeyS":
      keyboardInput.down = down;
      break;
    case "ArrowLeft":
    case "KeyA":
      keyboardInput.left = down;
      break;
    case "ArrowRight":
    case "KeyD":
      keyboardInput.right = down;
      break;
    case "Space":
      keyboardInput.primary = down;
      break;
    case "ShiftLeft":
    case "ShiftRight":
    case "ControlLeft":
    case "ControlRight":
      keyboardInput.secondary = down;
      break;
  }
}

function clearKeyboardInput() {
  keyboardInput.up = false;
  keyboardInput.down = false;
  keyboardInput.left = false;
  keyboardInput.right = false;
  keyboardInput.primary = false;
  keyboardInput.secondary = false;
  for (const key of Object.keys(keys)) keys[key] = false;
}

addEventListener("keydown", e => {
  setKeyboardKey(e.code, true);
  keys[e.key.toLowerCase()] = true;

  if ([
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "Space","KeyW","KeyA","KeyS","KeyD"
  ].includes(e.code)) {
    e.preventDefault();
  }

  if (e.repeat && state === "menu") return;

  if (state === "menu") {
    if (e.code.startsWith("Digit")) {
      const idx = Number(e.code.slice(5)) - 1;
      if (idx >= 0 && idx < menuOptions.length) startGame(menuOptions[idx]);
    }

    if (e.code === "Enter" || e.code === "Space") {
      startGame(menuOptions[menuIndex]);
      e.preventDefault();
      return;
    }

    if (e.code === "ArrowRight" || e.code === "KeyD")
      menuIndex = Math.min(menuOptions.length - 1, menuIndex + 1);
    if (e.code === "ArrowLeft" || e.code === "KeyA")
      menuIndex = Math.max(0, menuIndex - 1);
    if (e.code === "ArrowDown" || e.code === "KeyS")
      menuIndex = Math.min(menuOptions.length - 1, menuIndex + 4);
    if (e.code === "ArrowUp" || e.code === "KeyW")
      menuIndex = Math.max(0, menuIndex - 4);
  } else {
    if (e.code === "KeyR") resetCurrentMode();
    if (e.code === "Escape" || e.code === "Tab") {
      e.preventDefault();
      backToMenu();
    }
  }
}, { passive:false });

addEventListener("keyup", e => {
  setKeyboardKey(e.code, false);
  keys[e.key.toLowerCase()] = false;
});

addEventListener("blur", clearKeyboardInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearKeyboardInput();
});

canvas.addEventListener("click", e => {
  if (state !== "menu") return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const ui = getMenuLayout();
  for (const b of ui.buttons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      startGame(b.id);
      return;
    }
  }
});

const WORLD = { w: 1600, h: 900 };
const checkpoints = [
  { x: 800, y: 705, r: 95 },
  { x: 1320, y: 450, r: 105 },
  { x: 800, y: 165, r: 105 },
  { x: 280, y: 450, r: 105 }
];

const vehicleDefs = {
  streetsweeper:  { id:"streetsweeper",  name:"Street Sweeper",     subtitle:"Clean leaves and dirt piles",       max:330, acc:220, rev:110, turn:2.35,fric:0.945, objective:"sweeping",    targetName:"PILES",      color:"#7bff31" },
  bulldozer:      { id:"bulldozer",      name:"Bulldozer",          subtitle:"Clear mud piles",                    max:240, acc:160, rev:90,  turn:2.0, fric:0.94,  objective:"clear",       targetName:"MUD",        color:"#e0b52f" },
  superhero:      { id:"superhero",      name:"Superhero",          subtitle:"Collect stars",                     max:310, acc:240, rev:150, turn:3.1, fric:0.93,  objective:"collect",     targetName:"STARS",      color:"#e63946" },
  racecar:        { id:"racecar",        name:"Racecar",            subtitle:"Three-lap time trial",              max:430, acc:320, rev:120, turn:2.9, fric:0.948, objective:"laps",        targetName:"LAPS",       color:"#3fa9f5" },
  fighterjet:     { id:"fighterjet",     name:"Fighter Jet",        subtitle:"Launch missiles at targets",        max:470, acc:340, rev:90,  turn:2.9, fric:0.955, objective:"targets",     targetName:"TARGETS",    color:"#9dd4ff" },
  helicopter:     { id:"helicopter",     name:"Helicopter",         subtitle:"Spotlight the hidden beacons",      max:300, acc:220, rev:150, turn:3.2, fric:0.92,  objective:"spotlight",   targetName:"BEACONS",    color:"#d9ff78" },
  tracklesstrain: { id:"tracklesstrain", name:"Trackless Train",    subtitle:"Pick up passengers",                max:185, acc:120, rev:65,  turn:1.55,fric:0.95,  objective:"stations",    targetName:"PASSENGERS", color:"#ffb347" },
  arff:           { id:"arff",           name:"ARFF Truck",         subtitle:"Extinguish burning planes",         max:250, acc:170, rev:90,  turn:2.1, fric:0.945, objective:"extinguish",  targetName:"FIRES",      color:"#ff6b57" },
  ambulance:      { id:"ambulance",      name:"Ambulance",          subtitle:"Deploy stretcher and rescue",       max:275, acc:200, rev:100, turn:2.5, fric:0.945, objective:"patients",    targetName:"PATIENTS",   color:"#f4f4f4" },
  hovercraft:     { id:"hovercraft",     name:"Hovercraft",         subtitle:"Rescue stuck vehicles in swamp",    max:280, acc:200, rev:120, turn:2.7, fric:0.935, objective:"swamprescue", targetName:"RESCUES",    color:"#8be1ff" },
  garbagetruck:    { id:"garbagetruck",    name:"Garbage Truck",      subtitle:"Lift and empty dumpsters",          max:205, acc:135, rev:80,  turn:1.85,fric:0.95,  objective:"dumpsters",   targetName:"DUMPSTERS",  color:"#6fcf68" },
  icecreamtruck:   { id:"icecreamtruck",   name:"Ice Cream Truck",    subtitle:"Stop at parks and serve treats",    max:220, acc:150, rev:85,  turn:2.1, fric:0.945, objective:"parks",       targetName:"PARKS",      color:"#ff9fd8" },
  foodtruck:       { id:"foodtruck",       name:"Food Truck",         subtitle:"Stop at farmers markets",           max:215, acc:145, rev:85,  turn:2.0, fric:0.945, objective:"markets",     targetName:"MARKETS",    color:"#ffb15a" },
  chariot:         { id:"chariot",         name:"Chariot",            subtitle:"Race in the Circus Maximus",         max:355, acc:255, rev:95,  turn:2.75,fric:0.948, objective:"laps",        targetName:"LAPS",       color:"#d6b04a" },
  monstertruck:    { id:"monstertruck",    name:"Monster Truck",      subtitle:"Crush parked cars",                    max:285, acc:210, rev:105, turn:2.35,fric:0.942, objective:"crush",       targetName:"CARS",       color:"#9d63ff" }
};

let state = "menu";
const menuOptions = [
  "streetsweeper","bulldozer","superhero","racecar",
  "fighterjet","helicopter","tracklesstrain",
  "arff","ambulance","hovercraft",
  "garbagetruck","icecreamtruck","foodtruck","chariot","monstertruck"
];
let menuIndex = 0;

let vehicle = null;
let car = { x: 445, y: 650, a: 0, v: 0 };
let objects = [];
let cleaned = 0;
let finished = false;
let start = performance.now();
let lap = 1, nextCheckpoint = 0, lapStart = performance.now();
let brushAngle = 0, sparkleAngle = 0;
let actionHold = 0;
let spotlightOn = false;
let projectiles = [], particles = [];
let trainSegments = [];
let rescuePulse = 0;

function road(x, y) {
  const ox = (x - 800) / 650, oy = (y - 450) / 350;
  const ix = (x - 800) / 385, iy = (y - 450) / 155;
  return ox * ox + oy * oy < 1.02 && ix * ix + iy * iy > 1.0;
}

function applyWorldBounds() {
  // Keep every vehicle inside the visible world.
  // Aircraft receive a slightly larger safety margin so their sprites remain fully visible.
  const margin =
    vehicle.id === "fighterjet" ? 58 :
    vehicle.id === "helicopter" ? 52 :
    vehicle.id === "tracklesstrain" ? 60 :
    vehicle.id === "chariot" ? 56 :
    42;

  let hitX = false, hitY = false;

  if (car.x < margin) {
    car.x = margin;
    hitX = true;
  } else if (car.x > WORLD.w - margin) {
    car.x = WORLD.w - margin;
    hitX = true;
  }

  if (car.y < margin) {
    car.y = margin;
    hitY = true;
  } else if (car.y > WORLD.h - margin) {
    car.y = WORLD.h - margin;
    hitY = true;
  }

  if (hitX || hitY) {
    // Remove outward momentum so the vehicle does not jitter against the border.
    car.v *= vehicle.id === "fighterjet" || vehicle.id === "helicopter" ? 0.45 : 0.30;

    // Gently turn aircraft back toward the center rather than making them feel stuck.
    if (vehicle.id === "fighterjet" || vehicle.id === "helicopter") {
      const targetAngle = Math.atan2(WORLD.h / 2 - car.y, WORLD.w / 2 - car.x);
      let delta = targetAngle - car.a;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      car.a += delta * 0.18;
    }
  }
}
function justPressedSpace() {
  const down = keyboardInput.primary || touchInput.action > 0;
  const jp = down && !keyLocks.space;
  keyLocks.space = down;
  return jp;
}
function input() {
  let th = 0;
  let st = 0;

  if (keyboardInput.up) th += 1;
  if (keyboardInput.down) th -= 1;
  if (keyboardInput.left) st -= 1;
  if (keyboardInput.right) st += 1;

  th += touchInput.throttle;
  st += touchInput.steer;

  return {
    th: Math.max(-1, Math.min(1, th)),
    st: Math.max(-1, Math.min(1, st)),
    power: keyboardInput.primary || touchInput.action ? 1 : 0,
    secondary: keyboardInput.secondary || touchInput.secondary ? 1 : 0
  };
}

function startGame(id) {
  clearKeyboardInput();
  activePointers.clear();
  updateTouchInput();
  state = "game";
  vehicle = vehicleDefs[id];
  resetCurrentMode();
}
function backToMenu() {
  clearKeyboardInput();
  state = "menu";
  activePointers.clear();
  updateTouchInput();
}

function resetCurrentMode() {
  car = { x: 445, y: 650, a: 0, v: 0, max: vehicle.max, acc: vehicle.acc, rev: vehicle.rev, turn: vehicle.turn, fric: vehicle.fric };
  objects = [];
  projectiles = [];
  particles = [];
  trainSegments = [];
  cleaned = 0;
  finished = false;
  start = performance.now();
  lap = 1;
  nextCheckpoint = 0;
  lapStart = performance.now();
  brushAngle = 0;
  sparkleAngle = 0;
  actionHold = 0;
  spotlightOn = false;
  rescuePulse = 0;
  activePointers.clear();
  updateTouchInput();
  seedObjects();
}

function seedObjects() {
  const countByType = {
    streetsweeper: 42,
    bulldozer: 34, superhero: 24, fighterjet: 12, helicopter: 18,
    tracklesstrain: 10, arff: 12, ambulance: 10, hovercraft: 8,
    garbagetruck: 10, icecreamtruck: 8, foodtruck: 8,
    monstertruck: 14
  };
  const count = countByType[vehicle.id] || 0;
  for (let i = 0; i < count; i++) {
    let x, y, t;
    if (vehicle.id === "hovercraft") {
      // swampy grass/infield locations
      t = i / Math.max(1, count) * Math.PI * 2 + (Math.random()-0.5)*0.35;
      x = 800 + Math.cos(t) * (230 + Math.random()*250);
      y = 450 + Math.sin(t) * (120 + Math.random()*220);
    } else {
      t = i / Math.max(1, count) * Math.PI * 2 + (Math.random()-0.5)*0.18;
      const lane = 500 + (Math.random()-0.5)*160;
      x = 800 + Math.cos(t) * lane * 1.17;
      y = 450 + Math.sin(t) * lane * 0.50;
    }

    if (vehicle.id === "streetsweeper") {
      const isLeaf = i % 3 !== 0;
      objects.push({
        x,y,
        kind:isLeaf ? "sweepleaves" : "sweepdirt",
        img:(isLeaf ? leafImgs : dirtImgs)[Math.floor(Math.random()*12)],
        scale:0.75+Math.random()*0.5,
        rot:Math.random()*Math.PI*2,
        done:false
      });
    }
    else if (vehicle.id === "bulldozer") objects.push({ x,y, kind:"mud", img:dirtImgs[Math.floor(Math.random()*dirtImgs.length)], scale:0.95+Math.random()*0.6, rot:Math.random()*Math.PI*2, done:false });
    else if (vehicle.id === "superhero") objects.push({ x,y, kind:"star", scale:0.95+Math.random()*0.35, rot:Math.random()*Math.PI*2, done:false });
    else if (vehicle.id === "fighterjet") objects.push({ x,y, kind:"target", scale:1.0+Math.random()*0.3, done:false });
    else if (vehicle.id === "helicopter") objects.push({ x,y, kind:"beacon", scale:0.9+Math.random()*0.4, done:false, revealed:false });
    else if (vehicle.id === "tracklesstrain") objects.push({ x,y, kind:"passenger", scale:0.9+Math.random()*0.2, done:false });
    else if (vehicle.id === "arff") objects.push({ x,y, kind:"burningplane", scale:1.0+Math.random()*0.3, done:false, fire:1.0 });
    else if (vehicle.id === "ambulance") objects.push({ x,y, kind:"patient", scale:1.0, done:false });
    else if (vehicle.id === "hovercraft") objects.push({ x,y, kind:"stuckvehicle", scale:1.0+Math.random()*0.25, done:false, swamp:0.8+Math.random()*0.5 });
    else if (vehicle.id === "garbagetruck") objects.push({ x,y, kind:"dumpster", scale:0.95+Math.random()*0.2, done:false, lift:0, dumping:false });
    else if (vehicle.id === "icecreamtruck") objects.push({ x,y, kind:"park", scale:0.9+Math.random()*0.2, done:false, served:0 });
    else if (vehicle.id === "foodtruck") objects.push({ x,y, kind:"market", scale:0.9+Math.random()*0.2, done:false, served:0 });
    else if (vehicle.id === "monstertruck") objects.push({
      x,y,
      kind:"crushcar",
      scale:0.9+Math.random()*0.25,
      color:["#d94a3a","#3f8fd2","#e2b23d","#7d8a91","#d46fb2"][i%5],
      rot:Math.random()*Math.PI*2,
      done:false,
      crush:0
    });
  }

  if (vehicle.id === "tracklesstrain") {
    trainSegments = [{x:car.x,y:car.y,a:0},{x:car.x-45,y:car.y,a:0},{x:car.x-90,y:car.y,a:0}];
  }
}

function spawnExplosion(x, y, color = "#ffd04d", count = 14) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random()*120;
    particles.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:0.45+Math.random()*0.25, color, size:2+Math.random()*4 });
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}
function updateProjectiles(dt) {
  for (const m of projectiles) {
    if (!m.alive) continue;
    m.x += Math.cos(m.a) * m.speed * dt;
    m.y += Math.sin(m.a) * m.speed * dt;
    m.life -= dt;
    if (m.life <= 0) { m.alive = false; continue; }
    for (const o of objects) {
      if (o.done) continue;
      if (o.kind === "target" && Math.hypot(o.x - m.x, o.y - m.y) < 28) {
        o.done = true; cleaned++; m.alive = false; spawnExplosion(o.x, o.y, "#ff9f43", 18); break;
      }
    }
  }
  projectiles = projectiles.filter(m => m.alive);
}
function updateTrain() {
  if (!trainSegments.length) return;
  const followDist = 52;
  trainSegments[0].x = car.x; trainSegments[0].y = car.y; trainSegments[0].a = car.a;
  for (let i = 1; i < trainSegments.length; i++) {
    const prev = trainSegments[i-1], seg = trainSegments[i];
    const dx = prev.x - seg.x, dy = prev.y - seg.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const nx = dx / d, ny = dy / d;
    seg.x = prev.x - nx * followDist;
    seg.y = prev.y - ny * followDist;
    seg.a = Math.atan2(dy, dx);
  }
}

function update(dt) {
  if (state !== "game" || finished) return;
  const i = input();

  // action channels
  actionHold = Math.max(0, Math.min(1, i.power));
  spotlightOn = vehicle.id === "helicopter" && actionHold > 0.1;
  rescuePulse = Math.max(0, rescuePulse - dt);

  // Fire jet missiles
  if (vehicle.id === "fighterjet" && justPressedSpace()) {
    const px = car.x + Math.cos(car.a) * 42;
    const py = car.y + Math.sin(car.a) * 42;
    projectiles.push({ x:px, y:py, a:car.a, speed:720, life:1.4, alive:true });
  }

  // Movement
  if (i.th > 0) car.v += car.acc * i.th * dt;
  else if (i.th < 0) car.v += car.rev * i.th * dt;
  else car.v *= Math.pow(car.fric, dt * 60);
  car.v = Math.max(-car.rev, Math.min(car.max, car.v));

  // All vehicles can rotate in place.
  // Once moving, steering still reverses naturally when backing up.
  const moving = Math.abs(car.v) > 3;
  const turnGrip = moving ? Math.max(0.72, Math.min(1, Math.abs(car.v) / 65)) : 0.82;
  const turnDirection = moving ? Math.sign(car.v) : 1;
  car.a += i.st * car.turn * turnGrip * turnDirection * dt;

  car.x += Math.cos(car.a) * car.v * dt;
  car.y += Math.sin(car.a) * car.v * dt;

  applyWorldBounds();

  let offroadPenalty = 0.952;
  if (vehicle.id === "racecar") offroadPenalty = 0.90;
  if (vehicle.id === "fighterjet") offroadPenalty = 0.985;
  if (vehicle.id === "helicopter") offroadPenalty = 1.0;
  if (vehicle.id === "hovercraft") offroadPenalty = 1.0;
  if (!road(car.x, car.y)) car.v *= offroadPenalty;

  brushAngle += (2.0 + Math.abs(car.v) * 0.20) * dt;
  sparkleAngle += (4.0 + Math.abs(car.v) * 0.10) * dt;

  if (vehicle.id === "fighterjet") updateProjectiles(dt);
  if (vehicle.id === "tracklesstrain") updateTrain();
  updateParticles(dt);

  // Objective interactions
  for (const o of objects) {
    if (o.done) continue;
    const dist = Math.hypot(o.x - car.x, o.y - car.y);

    if (vehicle.id === "streetsweeper") {
      const radius = actionHold > 0.1 ? 118 : 62;
      if (dist < radius) {
        o.done = true;
        cleaned++;
        spawnExplosion(o.x, o.y, o.kind === "sweepleaves" ? "#d99b35" : "#8d6843", 5);
      }
    }
    else if (vehicle.id === "bulldozer") {
      const radius = actionHold > 0.1 ? 115 : 60;
      if (dist < radius) { o.done = true; cleaned++; }
    }
    else if (vehicle.id === "superhero") {
      const radius = actionHold > 0.1 ? 90 : 42;
      if (dist < radius) { o.done = true; cleaned++; spawnExplosion(o.x, o.y, "#ffe26a", 10); }
    }
    else if (vehicle.id === "helicopter") {
      if (dist < 160) o.revealed = true;
      if (spotlightOn && dist < 72) { o.done = true; cleaned++; spawnExplosion(o.x, o.y, "#d9ff78", 10); }
    }
    else if (vehicle.id === "tracklesstrain") {
      if (dist < 42) { o.done = true; cleaned++; spawnExplosion(o.x, o.y, "#ffb347", 8); }
    }
    else if (vehicle.id === "arff") {
      // extinguish in a forward cone when holding action
      if (actionHold > 0.1) {
        const angTo = Math.atan2(o.y - car.y, o.x - car.x);
        let dAng = angTo - car.a;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        if (dist < 115 && Math.abs(dAng) < 0.55) {
          o.fire = Math.max(0, o.fire - dt * 1.6);
          if (o.fire <= 0) { o.done = true; cleaned++; spawnExplosion(o.x, o.y, "#b0e7ff", 12); }
        }
      }
    }
    else if (vehicle.id === "ambulance") {
      const stretcherReach = 26 + actionHold * 48;
      const backX = car.x - Math.cos(car.a) * (26 + actionHold * 34);
      const backY = car.y - Math.sin(car.a) * (26 + actionHold * 34);
      const d = Math.hypot(o.x - backX, o.y - backY);
      if (actionHold > 0.1 && d < 26) {
        o.done = true; cleaned++; spawnExplosion(o.x, o.y, "#ffffff", 8);
      }
    }
    else if (vehicle.id === "hovercraft") {
      const radius = actionHold > 0.1 ? 72 : 48;
      if (dist < radius) { o.done = true; cleaned++; rescuePulse = 0.25; spawnExplosion(o.x, o.y, "#8be1ff", 10); }
    }
    else if (vehicle.id === "garbagetruck") {
      // Hold action near a dumpster: lift, tip, and empty into the rear hopper.
      if (actionHold > 0.1 && dist < 58) {
        o.lift = Math.min(1, o.lift + dt * 1.2);
        if (o.lift >= 1 && !o.done) {
          o.done = true;
          cleaned++;
          spawnExplosion(o.x, o.y, "#6fcf68", 8);
        }
      }
    }
    else if (vehicle.id === "icecreamtruck") {
      // Stop near a park and hold action to serve.
      if (Math.abs(car.v) < 35 && actionHold > 0.1 && dist < 65) {
        o.served = Math.min(1, o.served + dt * 1.15);
        if (o.served >= 1 && !o.done) {
          o.done = true;
          cleaned++;
          spawnExplosion(o.x, o.y, "#ff9fd8", 10);
        }
      }
    }
    else if (vehicle.id === "foodtruck") {
      // Stop near a farmers market and hold action to serve.
      if (Math.abs(car.v) < 35 && actionHold > 0.1 && dist < 65) {
        o.served = Math.min(1, o.served + dt * 1.05);
        if (o.served >= 1 && !o.done) {
          o.done = true;
          cleaned++;
          spawnExplosion(o.x, o.y, "#ffb15a", 10);
        }
      }
    }
    else if (vehicle.id === "monstertruck") {
      // Drive directly over each parked car to crush it.
      if (dist < 42) {
        o.crush = Math.min(1, o.crush + dt * (1.8 + Math.abs(car.v) / 90));
        car.v *= 0.985;
        if (o.crush >= 1 && !o.done) {
          o.done = true;
          cleaned++;
          spawnExplosion(o.x, o.y, "#b5b5b5", 14);
        }
      }
    }
  }

  if (vehicle.objective !== "laps" && objects.length > 0 && cleaned >= objects.length) finished = true;

  // laps
  const cp = checkpoints[nextCheckpoint];
  if (Math.hypot(car.x - cp.x, car.y - cp.y) < cp.r) {
    nextCheckpoint++;
    if (nextCheckpoint >= checkpoints.length) {
      nextCheckpoint = 0;
      lapStart = performance.now();
      lap++;
      if (lap > 3 && vehicle.objective === "laps") finished = true;
    }
  }
}

// ---------- Drawing helpers ----------
function panel(x, y, w, h) {
  ctx.fillStyle = "#050706dd";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffffff33";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function text(s, x, y, size = 18, align = "left", color = "#fff", weight = "700") {
  ctx.font = `${weight} ${size}px Arial`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function wp(t, x, y) { return [t.ox + x * t.scale, t.oy + y * t.scale]; }

function drawBrushSpinnerLocal(x, y, angle, radius, front = false, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius * 1.2);
  g.addColorStop(0, front ? "rgba(255,206,74,0.18)" : "rgba(227,177,55,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = front ? "#24282c" : "#1d2124"; ctx.beginPath(); ctx.arc(x, y, radius * 0.58, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#535b62"; ctx.beginPath(); ctx.arc(x, y, radius * 0.20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = front ? "#d6a52c" : "#c49223"; ctx.lineWidth = Math.max(1.2, radius * 0.10);
  for (let k = 0; k < 16; k++) {
    const a = angle + k / 16 * Math.PI * 2, inner = radius * 0.18, outer = radius * 0.98;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.restore();
}

// --- vehicle sprites ---
function drawSweeperWithSpinners(t) {
  const [cx, cy] = wp(t, car.x, car.y);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(car.a);
  const sw = 148 * t.scale, sh = 83 * t.scale, mainR = 12.5 * t.scale, auxR = 9.5 * t.scale;
  drawBrushSpinnerLocal(44*t.scale,-20*t.scale, brushAngle*2.8, mainR, true, 1);
  drawBrushSpinnerLocal(44*t.scale, 20*t.scale,-brushAngle*2.6, mainR, true, 1);
  drawBrushSpinnerLocal(-44*t.scale,-20*t.scale,-brushAngle*2.2, mainR, false, 1);
  drawBrushSpinnerLocal(-44*t.scale, 20*t.scale, brushAngle*2.0, mainR, false, 1);
  drawBrushSpinnerLocal(58*t.scale, 0, brushAngle*3.0, auxR, true, .95);
  drawBrushSpinnerLocal(-58*t.scale,0,-brushAngle*2.3, auxR, false, .90);
  ctx.drawImage(sweeper, -sw/2, -sh/2, sw, sh);
  ctx.restore();
}
function drawBulldozerLocal() {
  ctx.fillStyle = "#1a1f24"; ctx.beginPath(); ctx.roundRect(-42,-22,84,44,8); ctx.fill();
  ctx.fillStyle = "#e0b52f"; ctx.beginPath(); ctx.roundRect(-28,-18,40,36,8); ctx.fill();
  ctx.fillStyle = "#f1c94b"; ctx.beginPath(); ctx.roundRect(-8,-14,32,28,6); ctx.fill();
  ctx.fillStyle = "#1b2229"; ctx.beginPath(); ctx.roundRect(-22,-12,15,24,4); ctx.fill();
  ctx.fillStyle = "rgba(102,165,205,0.45)"; ctx.fillRect(-19,-9,9,18);
  ctx.fillStyle = "#20262b"; ctx.fillRect(-36,-22,14,44); ctx.fillRect(-8,-22,14,44);
  ctx.fillStyle = "#8e9498"; ctx.beginPath(); ctx.moveTo(30,-18); ctx.lineTo(55,-14); ctx.lineTo(55,14); ctx.lineTo(30,18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#72787d"; ctx.fillRect(22,-10,10,20);
}
function drawBulldozer(t) { const [cx,cy]=wp(t,car.x,car.y); ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale); drawBulldozerLocal(); ctx.restore(); }

function drawStarPickup(x, y, radius, angle) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.fillStyle = "#ffd84a"; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI/2 + i * Math.PI / 5, r = i % 2 === 0 ? radius : radius * 0.46;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function drawSuperheroLocal() {
  ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.moveTo(-8,-22); ctx.lineTo(-28,-12); ctx.lineTo(-22,0); ctx.lineTo(-28,12); ctx.lineTo(-8,22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1d3557"; ctx.beginPath(); ctx.ellipse(5,0,16,12,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "#ffd4a3"; ctx.beginPath(); ctx.arc(16,0,9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "#ffdd57"; ctx.fillRect(0,-3,10,6);
  ctx.fillStyle = "#111";
  [[-4,-9],[-4,9],[13,-10],[13,10]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
}
function drawSuperhero(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale*1.15,t.scale*1.15);
  for (let i=0;i<6;i++) {
    const a = sparkleAngle + i * Math.PI / 3;
    drawStarPickup(Math.cos(a)*22, Math.sin(a)*22, 4, -a);
  }
  drawSuperheroLocal();
  ctx.restore();
}
function drawRacecarLocal() {
  ctx.fillStyle="#d91e2f"; ctx.beginPath(); ctx.roundRect(-42,-10,62,20,8); ctx.fill(); ctx.beginPath(); ctx.roundRect(-8,-16,28,32,10); ctx.fill();
  ctx.fillStyle="#91d9ff"; ctx.fillRect(-4,-8,12,16);
  ctx.fillStyle="#111";
  [[-26,-10],[-26,10],[-2,-15],[-2,15],[20,-15],[20,15],[34,-10],[34,10]].forEach(([x,y]) => { ctx.beginPath(); ctx.ellipse(x,y,7,4,0,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle="#f6f6f6"; ctx.fillRect(18,-4,18,8); ctx.fillRect(-52,-20,10,40);
}
function drawRacecar(t){ const [cx,cy]=wp(t,car.x,car.y); ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale); drawRacecarLocal(); ctx.restore(); }

function drawJetLocal() {
  ctx.fillStyle="#9fb3c4";
  ctx.beginPath(); ctx.moveTo(46,0); ctx.lineTo(14,-10); ctx.lineTo(-26,-10); ctx.lineTo(-42,-4); ctx.lineTo(-46,0); ctx.lineTo(-42,4); ctx.lineTo(-26,10); ctx.lineTo(14,10); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#788b9b"; ctx.beginPath(); ctx.moveTo(-10,-26); ctx.lineTo(10,-8); ctx.lineTo(-10,-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10,26); ctx.lineTo(10,8); ctx.lineTo(-10,4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#d6ecff"; ctx.beginPath(); ctx.ellipse(14,0,9,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#4b5e6d"; ctx.fillRect(-34,-18,10,6); ctx.fillRect(-34,12,10,6);
  ctx.fillStyle="#ff9f43"; ctx.fillRect(-49,-3,6,6);
}
function drawJet(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale);
  ctx.fillStyle="rgba(255,180,60,0.25)"; ctx.fillRect(-58,-4,12,8);
  drawJetLocal();
  ctx.restore();
}
function drawHelicopterLocal() {
  ctx.fillStyle="#6d8f3c"; ctx.beginPath(); ctx.roundRect(-28,-14,44,28,8); ctx.fill();
  ctx.fillStyle="#d2f0ff"; ctx.beginPath(); ctx.roundRect(10,-10,16,20,6); ctx.fill();
  ctx.fillStyle="#3a4a28"; ctx.fillRect(-10,-3,32,6);
  ctx.fillStyle="#1e2427"; ctx.fillRect(-38,-2,16,4);
  ctx.fillRect(-44,-10,12,3); ctx.fillRect(-44,7,12,3);
  ctx.fillStyle="#222"; ctx.fillRect(-8,-28,18,4); ctx.fillRect(0,-34,2,16); ctx.fillRect(-18,-30,38,2);
  ctx.fillStyle="#4c5960"; ctx.fillRect(-12,18,26,3); ctx.fillRect(-20,22,42,3);
}
function drawHelicopter(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale);
  if (spotlightOn) {
    const g = ctx.createRadialGradient(28,0,6,28,0,90);
    g.addColorStop(0,"rgba(230,255,160,0.24)"); g.addColorStop(1,"rgba(230,255,160,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(28,0,90,0,Math.PI*2); ctx.fill();
  }
  drawHelicopterLocal();
  ctx.restore();
}
function drawTracklessTrainLocal(color="#cc3d2b") {
  ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(-34,-16,34,32,8); ctx.fill();
  ctx.fillStyle="#ffd65c"; ctx.beginPath(); ctx.roundRect(-8,-14,28,28,8); ctx.fill();
  ctx.fillStyle="#d4f2ff"; ctx.fillRect(-2,-8,12,16);
  ctx.fillStyle="#1c252b"; [[-22,-18],[-22,18],[8,-18],[8,18]].forEach(([x,y]) => { ctx.beginPath(); ctx.ellipse(x,y,6,4,0,0,Math.PI*2); ctx.fill(); });
}
function drawTracklessTrain(t) {
  for (let i = trainSegments.length - 1; i >= 1; i--) {
    const seg = trainSegments[i], [x,y]=wp(t,seg.x,seg.y);
    ctx.save(); ctx.translate(x,y); ctx.rotate(seg.a || car.a); ctx.scale(t.scale,t.scale);
    const color = i === 1 ? "#2f7ec2" : "#3aaa35";
    ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(-24,-14,48,28,6); ctx.fill();
    ctx.fillStyle="#cfefff"; ctx.fillRect(-12,-9,24,18);
    ctx.fillStyle="#1c252b"; [[-14,-16],[-14,16],[14,-16],[14,16]].forEach(([wx,wy])=>{ ctx.beginPath(); ctx.ellipse(wx,wy,5,3.5,0,0,Math.PI*2); ctx.fill(); });
    ctx.restore();
  }
  const [cx,cy]=wp(t,car.x,car.y); ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale); drawTracklessTrainLocal(); ctx.restore();
}
function drawARFFLocal() {
  ctx.fillStyle="#c92925"; ctx.beginPath(); ctx.roundRect(-50,-18,86,36,8); ctx.fill();
  ctx.fillStyle="#efefef"; ctx.beginPath(); ctx.roundRect(-22,-15,26,30,6); ctx.fill();
  ctx.fillStyle="#cfefff"; ctx.fillRect(-16,-8,12,16);
  ctx.fillStyle="#888"; ctx.fillRect(20,-20,10,4); ctx.fillRect(24,-28,4,10); ctx.fillRect(16,-30,20,3); // roof turret
  ctx.fillStyle="#111"; [[-34,-20],[-34,20],[-6,-20],[-6,20],[24,-20],[24,20]].forEach(([x,y])=>{ ctx.beginPath(); ctx.ellipse(x,y,7,4.5,0,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle="#f5d547"; ctx.fillRect(34,-10,8,20);
}
function drawARFF(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale);
  if (actionHold > 0.1) {
    ctx.fillStyle = "rgba(180,230,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(20,-18); ctx.lineTo(110,-45); ctx.lineTo(110,45); ctx.lineTo(20,18); ctx.closePath();
    ctx.fill();
  }
  drawARFFLocal();
  ctx.restore();
}
function drawAmbulanceLocal() {
  ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.roundRect(-46,-18,84,36,8); ctx.fill();
  ctx.fillStyle="#d72525"; ctx.fillRect(-12,-5,16,10); ctx.fillRect(-7,-10,6,20);
  ctx.fillStyle="#cfefff"; ctx.beginPath(); ctx.roundRect(-34,-12,18,24,5); ctx.fill();
  ctx.fillStyle="#111"; [[-28,-20],[-28,20],[6,-20],[6,20],[28,-20],[28,20]].forEach(([x,y])=>{ ctx.beginPath(); ctx.ellipse(x,y,7,4.5,0,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle="#ff952f"; ctx.fillRect(-4,-22,12,4);
}
function drawAmbulance(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale);
  // stretcher extends from the back
  if (actionHold > 0.05) {
    const ext = actionHold * 38;
    ctx.fillStyle="#cfd3d8"; ctx.fillRect(-40-ext,-6,ext+18,12);
    ctx.fillStyle="#d33"; ctx.fillRect(-22-ext,-4,14,8);
    ctx.fillStyle="#666"; ctx.fillRect(-38-ext,6,3,8); ctx.fillRect(-10-ext,6,3,8);
  }
  drawAmbulanceLocal();
  ctx.restore();
}
function drawHovercraftLocal() {
  ctx.fillStyle="#efefef"; ctx.beginPath(); ctx.roundRect(-40,-18,68,36,14); ctx.fill();
  ctx.fillStyle="#1f2d38"; ctx.beginPath(); ctx.roundRect(-12,-12,20,24,6); ctx.fill();
  ctx.fillStyle="#8be1ff"; ctx.fillRect(-8,-8,12,16);
  ctx.fillStyle="#333"; ctx.beginPath(); ctx.arc(22,0,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#555"; ctx.beginPath(); ctx.arc(22,0,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#111"; ctx.beginPath(); ctx.roundRect(-46,-22,80,44,18); ctx.strokeStyle="#111"; ctx.lineWidth=6; ctx.stroke();
}
function drawHovercraft(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale,t.scale);
  ctx.fillStyle="rgba(139,225,255,0.18)";
  ctx.beginPath(); ctx.ellipse(0,0,65,28,0,0,Math.PI*2); ctx.fill();
  if (rescuePulse > 0) {
    ctx.strokeStyle = "rgba(139,225,255,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,36 + (0.25-rescuePulse)*110,0,Math.PI*2); ctx.stroke();
  }
  drawHovercraftLocal();
  ctx.restore();
}


function drawGarbageTruckLocal(action=0) {
  // rear hopper on left, cab on right; facing right
  ctx.fillStyle="#2d7b3d"; ctx.beginPath(); ctx.roundRect(-48,-18,66,36,8); ctx.fill();
  ctx.fillStyle="#e8ecee"; ctx.beginPath(); ctx.roundRect(14,-16,28,32,7); ctx.fill();
  ctx.fillStyle="#b7ddf0"; ctx.fillRect(22,-9,12,18);
  ctx.fillStyle="#111";
  [[-34,-20],[-34,20],[-4,-20],[-4,20],[28,-20],[28,20]].forEach(([x,y])=>{ctx.beginPath();ctx.ellipse(x,y,7,4.5,0,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle="#1d4f28"; ctx.fillRect(-50,-10,10,20);
  // grabber arm extends from side/rear
  const ext = action * 34;
  ctx.strokeStyle="#6d7378"; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(-8,18); ctx.lineTo(-12,26+ext*0.3); ctx.lineTo(-34-ext,28); ctx.stroke();
  ctx.fillStyle="#444"; ctx.fillRect(-40-ext,22,12,12);
  // hopper lid
  ctx.fillStyle="#1f5e2f"; ctx.fillRect(-44,-22,44,5);
}
function drawGarbageTruck(t){
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(car.a);ctx.scale(t.scale,t.scale);
  drawGarbageTruckLocal(actionHold);
  ctx.restore();
}

function drawIceCreamTruckLocal() {
  ctx.fillStyle="#fff7fb"; ctx.beginPath(); ctx.roundRect(-42,-17,78,34,8); ctx.fill();
  ctx.fillStyle="#ff9fd8"; ctx.fillRect(-8,-15,26,30);
  ctx.fillStyle="#aee7ff"; ctx.fillRect(20,-9,12,18);
  ctx.fillStyle="#ffec8f"; ctx.fillRect(-28,-13,14,11);
  ctx.fillStyle="#111";
  [[-28,-20],[-28,20],[12,-20],[12,20],[28,-20],[28,20]].forEach(([x,y])=>{ctx.beginPath();ctx.ellipse(x,y,7,4.5,0,0,Math.PI*2);ctx.fill();});
  // roof cone
  ctx.fillStyle="#ffd45c"; ctx.beginPath(); ctx.moveTo(-6,-22); ctx.lineTo(2,-34); ctx.lineTo(10,-22); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(2,-37,5,0,Math.PI*2); ctx.fill();
}
function drawIceCreamTruck(t){
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(car.a);ctx.scale(t.scale,t.scale);
  drawIceCreamTruckLocal();
  if(actionHold>0.1){ctx.strokeStyle="rgba(255,159,216,.55)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,34+actionHold*10,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawFoodTruckLocal() {
  ctx.fillStyle="#f5a34d"; ctx.beginPath(); ctx.roundRect(-42,-17,78,34,8); ctx.fill();
  ctx.fillStyle="#f7f3e8"; ctx.fillRect(-8,-14,28,28);
  ctx.fillStyle="#aee7ff"; ctx.fillRect(22,-9,10,18);
  ctx.fillStyle="#6f4d2f"; ctx.fillRect(-30,-12,16,10);
  ctx.fillStyle="#111";
  [[-28,-20],[-28,20],[12,-20],[12,20],[28,-20],[28,20]].forEach(([x,y])=>{ctx.beginPath();ctx.ellipse(x,y,7,4.5,0,0,Math.PI*2);ctx.fill();});
  // service awning
  ctx.fillStyle="#3b8d4c"; ctx.fillRect(-6,-22,30,5);
}
function drawFoodTruck(t){
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(car.a);ctx.scale(t.scale,t.scale);
  drawFoodTruckLocal();
  if(actionHold>0.1){ctx.strokeStyle="rgba(255,177,90,.55)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,34+actionHold*10,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}


function drawChariotLocal() {
  // facing right
  // horses
  function horse(x,y,body="#f2e2be", mane="#7a5638"){
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(x,y,14,8,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+11,y-8,8,6,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = mane;
    ctx.beginPath(); ctx.moveTo(x+6,y-9); ctx.lineTo(x+11,y-16); ctx.lineTo(x+2,y-10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#7a5638";
    ctx.fillRect(x-6,y+5,2,10); ctx.fillRect(x+2,y+5,2,10); ctx.fillRect(x+11,y+4,2,10); ctx.fillRect(x+15,y+4,2,10);
    ctx.strokeStyle = "#5d4630"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x+18,y); ctx.lineTo(x+28,y); ctx.stroke();
  }
  horse(-2,-11,"#f2e2be","#7a5638");
  horse(2,11,"#f4d0a6","#69462b");

  // yoke / poles
  ctx.strokeStyle = "#8a6a3f"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22,-2); ctx.lineTo(48,-2); ctx.moveTo(22,2); ctx.lineTo(48,2); ctx.stroke();

  // chariot body
  ctx.fillStyle = "#b42f1f";
  ctx.beginPath(); ctx.moveTo(46,-18); ctx.lineTo(66,-14); ctx.lineTo(66,14); ctx.lineTo(46,18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d7b25b";
  ctx.fillRect(48,-18,4,36); ctx.fillRect(58,-16,3,32);
  ctx.beginPath(); ctx.arc(58,0,17, -Math.PI/2, Math.PI/2); ctx.strokeStyle="#d7b25b"; ctx.lineWidth=4; ctx.stroke();

  // wheels
  function wheel(x,y){
    ctx.fillStyle="#8b5a2b"; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#d9bf77"; ctx.lineWidth=2;
    for(let i=0;i<8;i++){
      const a = i/8*Math.PI*2 + brushAngle*1.5;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*9,y+Math.sin(a)*9); ctx.stroke();
    }
    ctx.fillStyle="#d9bf77"; ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill();
  }
  wheel(54,-16); wheel(54,16);

  // driver
  ctx.fillStyle="#f2c89b"; ctx.beginPath(); ctx.arc(52,-3,4.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#f5f0e8"; ctx.fillRect(48,1,8,10);
  ctx.strokeStyle="#5d4630"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(48,2); ctx.lineTo(28,-4); ctx.moveTo(48,6); ctx.lineTo(28,4); ctx.stroke();
}
function drawChariot(t) {
  const [cx,cy] = wp(t,car.x,car.y);
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(car.a); ctx.scale(t.scale*0.95,t.scale*0.95);
  drawChariotLocal();
  ctx.restore();
}

function drawDolphinCounter(x,y,active=true,flip=false,scale=1){
  ctx.save(); ctx.translate(x,y); ctx.scale(scale*(flip?-1:1), scale);
  ctx.fillStyle = active ? "#4aa3d8" : "#6e7d86";
  ctx.beginPath();
  ctx.moveTo(-12,0); ctx.quadraticCurveTo(-2,-10,10,-4); ctx.quadraticCurveTo(6,4,-3,6);
  ctx.quadraticCurveTo(4,10,12,7); ctx.quadraticCurveTo(4,15,-7,10); ctx.quadraticCurveTo(-13,6,-12,0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d9ecf7"; ctx.beginPath(); ctx.arc(5,-2,1.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawCircusMaximusTrack(t) {
  const ox=t.ox, oy=t.oy, sw=WORLD.w*t.scale, sh=WORLD.h*t.scale;
  // Outer grounds
  ctx.fillStyle = "#b9a07d";
  ctx.fillRect(ox, oy, sw, sh);

  // Seating / cavea rings
  ctx.fillStyle = "#b86d4a"; ctx.fillRect(ox, oy, sw, sh*0.11);
  ctx.fillStyle = "#c87c57"; ctx.fillRect(ox, oy+sh*0.89, sw, sh*0.11);
  ctx.fillStyle = "#c06f4f"; ctx.fillRect(ox, oy+sh*0.11, sw*0.08, sh*0.78);
  ctx.fillStyle = "#c06f4f"; ctx.fillRect(ox+sw*0.92, oy+sh*0.11, sw*0.08, sh*0.78);

  // Stands stripes
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i=0;i<10;i++){
    ctx.fillRect(ox, oy + i*sh*0.011, sw, sh*0.004);
    ctx.fillRect(ox, oy + sh*0.89 + i*sh*0.011, sw, sh*0.004);
  }

  // Arena sand outer oval
  const cx = ox + sw/2, cy = oy + sh/2;
  ctx.fillStyle = "#d8c18d";
  ctx.beginPath();
  ctx.ellipse(cx, cy, sw*0.41, sh*0.29, 0, 0, Math.PI*2);
  ctx.fill();

  // Track lane ring
  ctx.fillStyle = "#d3bb84";
  ctx.beginPath();
  ctx.ellipse(cx, cy, sw*0.38, sh*0.25, 0, 0, Math.PI*2);
  ctx.fill();

  // Inner field cutout
  ctx.fillStyle = "#c7b07c";
  ctx.beginPath();
  ctx.ellipse(cx, cy, sw*0.23, sh*0.10, 0, 0, Math.PI*2);
  ctx.fill();

  // Spina
  const spW = sw*0.53, spH = sh*0.10, spX = cx-spW/2, spY = cy-spH/2;
  ctx.fillStyle = "#bea36c";
  ctx.beginPath(); ctx.roundRect(spX,spY,spW,spH,spH/2); ctx.fill();
  ctx.strokeStyle = "#9b8555"; ctx.lineWidth = 2; ctx.stroke();

  // Metae (turning posts) at ends of spina
  function metae(mx,my){
    ctx.fillStyle="#ddd2b1";
    for(let i=-1;i<=1;i++){
      ctx.beginPath();
      ctx.moveTo(mx+i*10*t.scale, my+18*t.scale);
      ctx.lineTo(mx-6*t.scale+i*10*t.scale, my-12*t.scale);
      ctx.lineTo(mx+6*t.scale+i*10*t.scale, my-12*t.scale);
      ctx.closePath();
      ctx.fill();
    }
  }
  metae(spX+18*t.scale, cy);
  metae(spX+spW-18*t.scale, cy);

  // Obelisk
  ctx.fillStyle="#d9c89c";
  ctx.beginPath();
  ctx.moveTo(cx, spY-2*t.scale);
  ctx.lineTo(cx-12*t.scale, spY+spH*0.64);
  ctx.lineTo(cx+12*t.scale, spY+spH*0.64);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(cx-10*t.scale, spY+spH*0.64, 20*t.scale, 38*t.scale);
  ctx.fillStyle="#bda574";
  ctx.fillRect(cx-14*t.scale, spY+spH*0.64+38*t.scale, 28*t.scale, 8*t.scale);

  // Decorative spina details
  ctx.fillStyle="#8a6a3f";
  for(let i=0;i<5;i++){
    ctx.beginPath(); ctx.arc(spX+spW*(0.18+i*0.16), cy, 4*t.scale, 0, Math.PI*2); ctx.fill();
  }

  // Dolphin lap counters (7)
  const completed = Math.max(0, Math.min(7, lap-1));
  for(let i=0;i<7;i++){
    drawDolphinCounter(cx - 92*t.scale + i*30*t.scale, spY + 14*t.scale, i >= completed, i%2===1, 0.9*t.scale);
  }

  // starting gates on left side
  ctx.fillStyle="#a85f3f";
  for(let i=0;i<8;i++){
    ctx.fillRect(ox+sw*0.07 + i*10*t.scale, cy - 48*t.scale + i*3*t.scale, 8*t.scale, 42*t.scale);
  }

  // lane guides
  ctx.strokeStyle = "rgba(146,112,55,0.45)";
  ctx.lineWidth = 2;
  for(let k=0;k<4;k++){
    ctx.beginPath();
    ctx.ellipse(cx, cy, (sw*(0.30+k*0.02)), (sh*(0.17+k*0.02)), 0, 0, Math.PI*2);
    ctx.stroke();
  }
}

function drawMonsterTruckLocal() {
  // Oversized wheels
  ctx.fillStyle="#101214";
  [[-27,-24],[-27,24],[24,-24],[24,24]].forEach(([x,y])=>{
    ctx.beginPath(); ctx.ellipse(x,y,13,9,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#52585d"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#22282d"; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#101214";
  });

  // chassis
  ctx.fillStyle="#2a2d31";
  ctx.fillRect(-34,-12,68,24);

  // body
  ctx.fillStyle="#7d45d8";
  ctx.beginPath(); ctx.roundRect(-26,-18,48,36,9); ctx.fill();
  ctx.fillStyle="#9d63ff";
  ctx.beginPath(); ctx.roundRect(10,-14,24,28,7); ctx.fill();

  // windows
  ctx.fillStyle="#b9e8ff";
  ctx.fillRect(15,-8,11,16);

  // roll bars
  ctx.strokeStyle="#d5d5d5";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(-16,-18); ctx.lineTo(-10,-29); ctx.lineTo(8,-29); ctx.lineTo(14,-18);
  ctx.stroke();

  // bumpers
  ctx.fillStyle="#c7c9cb";
  ctx.fillRect(32,-11,6,22);
  ctx.fillRect(-38,-10,5,20);

  // hood stripe
  ctx.fillStyle="#f3d94a";
  ctx.fillRect(-4,-15,7,30);
}

function drawMonsterTruck(t) {
  const [cx,cy]=wp(t,car.x,car.y);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(car.a);
  ctx.scale(t.scale*1.05,t.scale*1.05);
  drawMonsterTruckLocal();
  ctx.restore();
}

function drawCrushCar(x,y,s,color,rot,crush=0) {
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rot);
  ctx.scale(s, s * (1 - crush*0.65));

  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.roundRect(-18,-9,36,18,5);
  ctx.fill();

  ctx.fillStyle="#aee5ff";
  ctx.fillRect(-7,-7,13,14);

  ctx.fillStyle="#111";
  ctx.beginPath(); ctx.ellipse(-11,-11,5,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-11,11,5,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11,-11,5,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11,11,5,3,0,0,Math.PI*2); ctx.fill();

  if (crush > 0) {
    ctx.strokeStyle="rgba(255,255,255,0.45)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(-10,-5); ctx.lineTo(0,4); ctx.lineTo(10,-5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCurrentVehicle(t) {
  if (vehicle.id === "streetsweeper") drawSweeperWithSpinners(t);
  else if (vehicle.id === "bulldozer") drawBulldozer(t);
  else if (vehicle.id === "superhero") drawSuperhero(t);
  else if (vehicle.id === "racecar") drawRacecar(t);
  else if (vehicle.id === "fighterjet") drawJet(t);
  else if (vehicle.id === "helicopter") drawHelicopter(t);
  else if (vehicle.id === "tracklesstrain") drawTracklessTrain(t);
  else if (vehicle.id === "arff") drawARFF(t);
  else if (vehicle.id === "ambulance") drawAmbulance(t);
  else if (vehicle.id === "hovercraft") drawHovercraft(t);
  else if (vehicle.id === "garbagetruck") drawGarbageTruck(t);
  else if (vehicle.id === "icecreamtruck") drawIceCreamTruck(t);
  else if (vehicle.id === "foodtruck") drawFoodTruck(t);
  else if (vehicle.id === "chariot") drawChariot(t);
  else if (vehicle.id === "monstertruck") drawMonsterTruck(t);
  else drawSweeperWithSpinners(t);
}

// object drawing
function drawPassenger(x, y, s) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle="#ffd1a1"; ctx.beginPath(); ctx.arc(0,-8,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#5fa8d3"; ctx.beginPath(); ctx.roundRect(-5,-2,10,14,4); ctx.fill();
  ctx.fillStyle="#333"; ctx.fillRect(-4,12,3,6); ctx.fillRect(1,12,3,6);
  ctx.restore();
}
function drawBurningPlane(x, y, s, fire) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle="#d8dde2";
  ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(6,-6); ctx.lineTo(-14,-6); ctx.lineTo(-24,-2); ctx.lineTo(-26,0); ctx.lineTo(-24,2); ctx.lineTo(-14,6); ctx.lineTo(6,6); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#96a7b6"; ctx.fillRect(-12,-14,6,8); ctx.fillRect(-12,6,6,8);
  for (let i=0;i<3;i++) {
    const ox = -8 + i*6;
    ctx.fillStyle = `rgba(255, ${120 + i*30}, 0, ${0.4 + fire*0.5})`;
    ctx.beginPath(); ctx.moveTo(ox, -4); ctx.lineTo(ox+6, -10-fire*8); ctx.lineTo(ox+3, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox, 4); ctx.lineTo(ox+6, 10+fire*8); ctx.lineTo(ox+3, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawPatient(x, y, s) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle="#d0d0d0"; ctx.fillRect(-10,6,20,4);
  ctx.fillStyle="#f2c18f"; ctx.beginPath(); ctx.arc(-6,0,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#4a89dc"; ctx.fillRect(-2,-3,12,8);
  ctx.fillStyle="#333"; ctx.fillRect(6,5,3,8); ctx.fillRect(11,5,3,8);
  ctx.restore();
}
function drawStuckVehicle(x, y, s, swamp) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle=`rgba(72,108,63,${0.55+0.2*swamp})`; ctx.beginPath(); ctx.ellipse(0,8,28,16,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#d8892c"; ctx.beginPath(); ctx.roundRect(-16,-8,24,16,4); ctx.fill();
  ctx.fillStyle="#97b8c8"; ctx.fillRect(-10,-6,9,7);
  ctx.strokeStyle="#7d5419"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(8,-4); ctx.lineTo(20,-12); ctx.lineTo(27,-4); ctx.stroke();
  ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(-10,10,5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(2,10,5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}


function drawDumpster(x,y,s,lift=0) {
  ctx.save();ctx.translate(x,y - lift*18);ctx.scale(s,s);
  ctx.rotate(-lift*0.7);
  ctx.fillStyle="#4e6b57";ctx.beginPath();ctx.roundRect(-14,-9,28,18,3);ctx.fill();
  ctx.fillStyle="#32463a";ctx.fillRect(-16,-12,32,5);
  ctx.fillStyle="#111";ctx.beginPath();ctx.arc(-9,11,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(9,11,3,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawPark(x,y,s,served=0){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle="#4b9d4a";ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#7a4f2c";ctx.fillRect(-14,8,28,4);ctx.fillRect(-10,12,3,8);ctx.fillRect(7,12,3,8);
  ctx.fillStyle="#3f7f3a";ctx.beginPath();ctx.arc(-8,-10,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(8,-8,7,0,Math.PI*2);ctx.fill();
  if(served>0){ctx.fillStyle="#ff9fd8";ctx.beginPath();ctx.arc(0,-2,5+served*4,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawMarket(x,y,s,served=0){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle="#f1d28a";ctx.fillRect(-18,-10,36,20);
  ctx.fillStyle="#3b8d4c";ctx.beginPath();ctx.moveTo(-20,-10);ctx.lineTo(20,-10);ctx.lineTo(14,-18);ctx.lineTo(-14,-18);ctx.closePath();ctx.fill();
  ctx.fillStyle="#d95f45";ctx.beginPath();ctx.arc(-8,2,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#f2c14e";ctx.beginPath();ctx.arc(0,2,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#6ab04c";ctx.beginPath();ctx.arc(8,2,4,0,Math.PI*2);ctx.fill();
  if(served>0){ctx.strokeStyle="rgba(255,177,90,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16+served*6,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawObjects(t) {
  // helicopter swamp/aesthetic overlay for hovercraft mode
  if (vehicle.id === "hovercraft") {
    for (const o of objects) {
      if (o.done) continue;
      const [x,y] = wp(t,o.x,o.y);
      ctx.fillStyle = "rgba(72,108,63,0.32)";
      ctx.beginPath(); ctx.ellipse(x, y + 10*t.scale, 38*t.scale*o.swamp, 24*t.scale*o.swamp, 0, 0, Math.PI*2); ctx.fill();
    }
  }

  for (const o of objects) {
    if (o.done) continue;
    const [x,y] = wp(t,o.x,o.y);
    if (o.kind === "sweepleaves" || o.kind === "sweepdirt") {
      const img = o.img, w = img.width * o.scale * t.scale, h = img.height * o.scale * t.scale;
      ctx.save(); ctx.translate(x,y); ctx.rotate(o.rot); ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
    } else if (o.kind === "mud") {
      const img = o.img, w = img.width * o.scale * t.scale, h = img.height * o.scale * t.scale;
      ctx.save(); ctx.translate(x,y); ctx.rotate(o.rot); ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
    } else if (o.kind === "star") {
      drawStarPickup(x,y,12*o.scale*t.scale,sparkleAngle+o.rot);
    } else if (o.kind === "target") {
      ctx.save(); ctx.translate(x,y); ctx.scale(o.scale*t.scale,o.scale*t.scale);
      ctx.fillStyle="#ef5350"; ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ef5350"; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else if (o.kind === "beacon") {
      const visible = o.revealed || spotlightOn;
      ctx.save(); ctx.translate(x,y); ctx.globalAlpha = visible ? 1 : 0.18;
      ctx.fillStyle="#9df26a"; ctx.beginPath(); ctx.arc(0,0,9*o.scale*t.scale,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#d9ff78"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,15*o.scale*t.scale + Math.sin(sparkleAngle*2)*2,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    } else if (o.kind === "passenger") {
      drawPassenger(x,y,0.9*o.scale*t.scale*2.4);
    } else if (o.kind === "burningplane") {
      drawBurningPlane(x,y,0.95*o.scale*t.scale*2.2,o.fire);
    } else if (o.kind === "patient") {
      drawPatient(x,y,0.9*t.scale*2.0);
    } else if (o.kind === "stuckvehicle") {
      drawStuckVehicle(x,y,0.95*o.scale*t.scale*2.0,o.swamp);
    } else if (o.kind === "dumpster") {
      drawDumpster(x,y,0.95*o.scale*t.scale*2.0,o.lift||0);
    } else if (o.kind === "park") {
      drawPark(x,y,0.95*o.scale*t.scale*2.0,o.served||0);
    } else if (o.kind === "market") {
      drawMarket(x,y,0.95*o.scale*t.scale*2.0,o.served||0);
    } else if (o.kind === "crushcar") {
      drawCrushCar(x,y,0.95*o.scale*t.scale*2.0,o.color,o.rot,o.crush||0);
    }
  }

  for (const m of projectiles) {
    const [x,y]=wp(t,m.x,m.y);
    ctx.save(); ctx.translate(x,y); ctx.rotate(m.a);
    ctx.fillStyle="#ffcf5a"; ctx.fillRect(-10*t.scale,-2*t.scale,20*t.scale,4*t.scale);
    ctx.fillStyle="#fff1b0"; ctx.fillRect(8*t.scale,-1*t.scale,7*t.scale,2*t.scale);
    ctx.restore();
  }

  for (const p of particles) {
    const [x,y]=wp(t,p.x,p.y);
    ctx.globalAlpha = Math.max(0,p.life/0.7);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x,y,p.size*t.scale,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function goalText() {
  if (vehicle.id==="streetsweeper") return "Clean all the leaves and dirt piles!";
  if (vehicle.id==="bulldozer") return "Clear all the mud piles!";
  if (vehicle.id==="superhero") return "Collect all the stars!";
  if (vehicle.id==="racecar") return "Finish 3 laps as fast as you can!";
  if (vehicle.id==="fighterjet") return "Fire missiles at all the targets!";
  if (vehicle.id==="helicopter") return "Hold Space to sweep the spotlight over the beacons!";
  if (vehicle.id==="tracklesstrain") return "Pick up all the passengers!";
  if (vehicle.id==="arff") return "Spray the burning planes until the fires go out!";
  if (vehicle.id==="ambulance") return "Hold Space to deploy the stretcher and load patients!";
  if (vehicle.id==="hovercraft") return "Rescue all the construction vehicles stuck in the swamp!";
  if (vehicle.id==="garbagetruck") return "Hold Space near each dumpster to lift and empty it!";
  if (vehicle.id==="icecreamtruck") return "Stop at every park and hold Space to serve ice cream!";
  if (vehicle.id==="foodtruck") return "Stop at every farmers market and hold Space to serve food!";
  if (vehicle.id==="chariot") return "Race 3 laps around the Circus Maximus!";
  if (vehicle.id==="monstertruck") return "Drive over every parked car and crush it!";
  return "";
}
function abilityText() {
  if (vehicle.id==="streetsweeper") return "POWER SUCTION";
  if (vehicle.id==="bulldozer") return "PUSH POWER";
  if (vehicle.id==="superhero") return "HERO DASH";
  if (vehicle.id==="racecar") return "SPEED";
  if (vehicle.id==="fighterjet") return "MISSILES";
  if (vehicle.id==="helicopter") return "SPOTLIGHT";
  if (vehicle.id==="tracklesstrain") return "ROAD TRAIN";
  if (vehicle.id==="arff") return "FOAM SPRAY";
  if (vehicle.id==="ambulance") return "STRETCHER";
  if (vehicle.id==="hovercraft") return "RESCUE";
  if (vehicle.id==="garbagetruck") return "GRABBER ARM";
  if (vehicle.id==="icecreamtruck") return "SERVE TREATS";
  if (vehicle.id==="foodtruck") return "SERVE FOOD";
  if (vehicle.id==="chariot") return "REINS";
  if (vehicle.id==="monstertruck") return "GIANT TIRES";
  return "READY";
}
function actionLabel() {
  if (vehicle.id==="streetsweeper") return "SUCTION";
  if (vehicle.id==="fighterjet") return "FIRE";
  if (vehicle.id==="helicopter") return "LIGHT";
  if (vehicle.id==="arff") return "SPRAY";
  if (vehicle.id==="ambulance") return "DEPLOY";
  if (vehicle.id==="garbagetruck") return "LIFT";
  if (vehicle.id==="icecreamtruck") return "SERVE";
  if (vehicle.id==="foodtruck") return "SERVE";
  if (vehicle.id==="chariot") return "NONE";
  if (vehicle.id==="monstertruck") return "CRUSH";
  if (vehicle.id==="racecar") return "NONE";
  return "ACTION";
}

function drawHUD(t) {
  const x = t.ox, y = t.oy;
  const w = WORLD.w * t.scale;
  const h = WORLD.h * t.scale;
  const s = Math.max(0.58, Math.min(1, t.scale * 1.55));

  const leftW = 230*s;
  const rightW = 242*s;
  const top = y + 12*s;

  panel(x+12*s, top, leftW, 158*s);
  text(vehicle.name.toUpperCase(), x+25*s, top+24*s, 15*s, "left", vehicle.color);
  text("LAP", x+25*s, top+49*s, 11*s, "left", "#9a9");
  text(`${Math.min(lap,3)} / 3`, x+25*s, top+75*s, 24*s);
  text(vehicle.targetName, x+25*s, top+100*s, 11*s, "left", "#9a9");
  const progress = vehicle.objective === "laps" ? "3 LAPS" : `${cleaned} / ${objects.length}`;
  text(progress, x+25*s, top+131*s, 20*s, "left", vehicle.color);

  panel(x+w-rightW-12*s, top, rightW, 132*s);
  text("RACE INFO", x+w-rightW/2-12*s, top+24*s, 15*s, "center");
  text("SPEED", x+w-rightW+4*s, top+54*s, 11*s, "left", "#aaa");
  text(`${Math.round(Math.abs(car.v))} KM/H`, x+w-26*s, top+55*s, 15*s, "right");
  text("A", x+w-rightW+4*s, top+84*s, 11*s, "left", "#aaa");
  text(actionLabel(), x+w-26*s, top+85*s, 13*s, "right", "#fff");
  text("B", x+w-rightW+4*s, top+112*s, 11*s, "left", "#aaa");
  text(secondaryAbilityText(), x+w-26*s, top+113*s, 12*s, "right", vehicle.color);
}

function drawTouchButton(box, label, circle=false, fontSize=null) {
  ctx.save();
  ctx.fillStyle = "rgba(15,15,15,0.90)";
  ctx.strokeStyle = "rgba(115,115,115,0.78)";
  ctx.lineWidth = 3;
  ctx.beginPath();

  if (circle) {
    ctx.arc(box.x+box.w/2, box.y+box.h/2, Math.min(box.w,box.h)/2, 0, Math.PI*2);
  } else {
    ctx.roundRect(box.x, box.y, box.w, box.h, Math.min(18, box.h/2));
  }

  ctx.fill();
  ctx.stroke();
  text(label, box.x + box.w/2, box.y + box.h/2 + (fontSize || Math.max(18, box.w*0.28))*0.33,
       fontSize || Math.max(18, box.w*0.28), "center", "#777");
  ctx.restore();
}

function drawDPad(layout) {
  drawTouchButton(layout.up, "▲");
  drawTouchButton(layout.down, "▼");
  drawTouchButton(layout.left, "◀");
  drawTouchButton(layout.right, "▶");

  const cx = layout.left.x + layout.left.w;
  const cy = layout.up.y + layout.up.h + layout.left.h/2;
  ctx.save();
  ctx.strokeStyle = "rgba(115,115,115,0.78)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(layout.left.w,layout.left.h)*0.35, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function secondaryAbilityText() {
  if (vehicle.id==="streetsweeper") return "VACUUM BOOST";
  if (vehicle.id==="monstertruck") return "NITRO";
  if (vehicle.id==="helicopter") return "RESCUE WINCH";
  if (vehicle.id==="fighterjet") return "MISSILE";
  if (vehicle.id==="bulldozer") return "PUSH BOOST";
  if (vehicle.id==="hovercraft") return "TURBO FAN";
  if (vehicle.id==="garbagetruck") return "COMPACT";
  if (vehicle.id==="ambulance") return "SIREN";
  if (vehicle.id==="arff") return "FOAM";
  if (vehicle.id==="icecreamtruck") return "JINGLE";
  if (vehicle.id==="foodtruck") return "FAST COOK";
  if (vehicle.id==="chariot") return "TIGHT TURN";
  return "SECONDARY";
}

function drawWrappedCentered(textValue, centerX, topY, maxWidth, fontSize=16, lineHeight=21, color="#bdbdbd") {
  const words = String(textValue).split(/\s+/);
  const lines = [];
  let line = "";

  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);

  lines.forEach((ln,i) => {
    text(ln, centerX, topY+i*lineHeight, fontSize, "center", color, "700");
  });

  ctx.restore();
}

function drawTouchControls() {
  if (state !== "game") return;

  const s = screenLayout();
  const layout = touchControlLayout();
  const lp = s.leftPanel;
  const rp = s.rightPanel;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(lp.x, lp.y, lp.w, lp.h);
  ctx.fillRect(rp.x, rp.y, rp.w, rp.h);
  ctx.restore();

  drawTouchButton(layout.select, "SELECT", false, 13);
  drawTouchButton(layout.start, "START", false, 13);

  drawDPad(layout);
  drawTouchButton(layout.a, "A", true, Math.max(28, layout.a.w*0.42));
  drawTouchButton(layout.b, "B", true, Math.max(28, layout.b.w*0.42));

  const instructions = `${goalText()}  A: ${actionText()}  B: ${secondaryAbilityText()}`;
  drawWrappedCentered(
    instructions,
    rp.x + rp.w/2,
    rp.y + Math.max(24, rp.h*0.10),
    Math.max(80, rp.w*0.80),
    Math.max(12, Math.min(17, rp.w*0.075)),
    Math.max(17, Math.min(23, rp.w*0.10)),
    "#b8b8b8"
  );
}
function drawFinish(vw, vh) {
  panel(vw/2-255, vh/2-112, 510, 224);
  text(`${vehicle.name.toUpperCase()} COMPLETE!`, vw/2, vh/2-38, 36, "center", vehicle.color);
  text(`Finished in ${((performance.now()-start)/1000).toFixed(1)} seconds`, vw/2, vh/2+6, 20, "center");
  text("R to replay • Esc for menu", vw/2, vh/2+58, 18, "center", "#ddd");
}

function drawMenuPreview(id, x, y, scale) {
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  if (id==="streetsweeper") {
    if (sweeper.complete) ctx.drawImage(sweeper,-52,-29,104,58);
  }
  else if (id==="bulldozer") drawBulldozerLocal();
  else if (id==="superhero") drawSuperheroLocal();
  else if (id==="racecar") drawRacecarLocal();
  else if (id==="fighterjet") drawJetLocal();
  else if (id==="helicopter") drawHelicopterLocal();
  else if (id==="tracklesstrain") drawTracklessTrainLocal();
  else if (id==="arff") drawARFFLocal();
  else if (id==="ambulance") drawAmbulanceLocal();
  else if (id==="hovercraft") drawHovercraftLocal();
  else if (id==="garbagetruck") drawGarbageTruckLocal(0);
  else if (id==="icecreamtruck") drawIceCreamTruckLocal();
  else if (id==="foodtruck") drawFoodTruckLocal();
  else if (id==="chariot") drawChariotLocal();
  else if (id==="monstertruck") drawMonsterTruckLocal();
  ctx.restore();
}
function getMenuLayout() {
  const { width: vw, height: vh } = viewportSize();
  const cols = 4, rows = 3;
  const bw = Math.min(270, (vw - 120) / 4);
  const bh = 64;
  const gapX = 14, gapY = 14;
  const totalW = bw*4 + gapX*3;
  const startX = vw/2 - totalW/2;
  const startY = 132;
  const buttons = [];
  menuOptions.forEach((id, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    buttons.push({ id, idx, x: startX + col*(bw+gapX), y: startY + row*(bh+gapY), w: bw, h: bh });
  });
  return { buttons };
}
function drawMenu() {
  const { width: vw, height: vh } = viewportSize();
  ctx.clearRect(0,0,vw,vh);
  ctx.fillStyle = "#0a1208"; ctx.fillRect(0,0,vw,vh);
  const scale = Math.min(vw/WORLD.w, vh/WORLD.h), ox = (vw-WORLD.w*scale)/2, oy = (vh-WORLD.h*scale)/2;
  ctx.globalAlpha = 0.22; ctx.drawImage(track, ox, oy, WORLD.w*scale, WORLD.h*scale); ctx.globalAlpha = 1;
  text("MULTI-VEHICLE RACER", vw/2, 74, 38, "center", "#8dff34");
  text("Benjy Input Repair Build v0.5.4", vw/2, 106, 17, "center", "#d8ffd1", "400");
  text("Pick a vehicle", vw/2, 125, 22, "center", "#fff");

  const ui = getMenuLayout();
  ui.buttons.forEach(b => {
    const selected = menuOptions[menuIndex] === b.id;
    ctx.fillStyle = selected ? "#163114e8" : "#091109e0";
    ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle = selected ? "#8dff34" : "#ffffff22";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(b.x+0.5,b.y+0.5,b.w-1,b.h-1);

    drawMenuPreview(b.id, b.x+34, b.y+32, 0.32);
    const def = vehicleDefs[b.id];
    text(def.name, b.x+62, b.y+21, 14, "left", "#fff");
    text(def.subtitle, b.x+62, b.y+40, 9, "left", "#dbe7d8", "400");
    text(String(b.idx + 1), b.x + b.w - 22, b.y + 28, 20, "center", selected ? "#8dff34" : "#bbb");
  });

  panel(vw/2 - 330, vh - 76, 660, 52);
  text("Click a vehicle. Keys 1–9 select the first nine. Enter starts. Esc returns here.", vw/2, vh - 43, 15, "center", "#fff");
}

function draw() {
  const { width: vw, height: vh } = viewportSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(vw*dpr) || canvas.height !== Math.round(vh*dpr)) resize();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if (state === "menu") { drawMenu(); return; }

  const layout = screenLayout();
  const scale = Math.min(layout.game.w/WORLD.w, layout.game.h/WORLD.h);
  const t = { scale, ox:layout.game.x, oy:layout.game.y };

  ctx.clearRect(0,0,vw,vh);
  ctx.fillStyle = "#080908";
  ctx.fillRect(0,0,vw,vh);
  if (vehicle.id === "chariot") drawCircusMaximusTrack(t);
  else ctx.drawImage(track, t.ox, t.oy, WORLD.w*scale, WORLD.h*scale);

  // spotlight darkness overlay for helicopter
  if (vehicle.id === "helicopter") {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0,0,vw,vh);
  }

  drawObjects(t);
  drawCurrentVehicle(t);
  drawHUD(t);
  drawTouchControls();
  if (finished) drawFinish(vw,vh);
}

let last = performance.now();
function loop(n) {
  const dt = Math.min(0.033, (n - last) / 1000);
  last = n;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
