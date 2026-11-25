// Doğum haritası: Güneş burcu, Ay burcu ve yükselen burç.
// Dış servis kullanılmaz. Güneş ve Ay için Meeus'un (Astronomical Algorithms) kısaltılmış serileri kullanılır
// (Güneş ≈ 0,01°, Ay ≈ 0,05° doğruluk); yükselen, doğum anının yıldız zamanı ve doğum yerinin enlemiyle bulunur.
// Türkiye'nin geçmişteki yaz saati uygulamaları tarayıcının saat dilimi veritabanından (Europe/Istanbul) alınır.
import { BURC_ADLARI } from "./gok.js";

const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI, mod360 = x => ((x % 360) + 360) % 360;

// 81 il: [ad, enlem, boylam] (il merkezi)
export const ILLER = [
  ["Adana", 37.00, 35.32], ["Adıyaman", 37.76, 38.28], ["Afyonkarahisar", 38.76, 30.54], ["Ağrı", 39.72, 43.05], ["Aksaray", 38.37, 34.03],
  ["Amasya", 40.65, 35.83], ["Ankara", 39.93, 32.86], ["Antalya", 36.90, 30.70], ["Ardahan", 41.11, 42.70], ["Artvin", 41.18, 41.82],
  ["Aydın", 37.85, 27.85], ["Balıkesir", 39.65, 27.88], ["Bartın", 41.64, 32.34], ["Batman", 37.88, 41.13], ["Bayburt", 40.26, 40.23],
  ["Bilecik", 40.14, 29.98], ["Bingöl", 38.88, 40.50], ["Bitlis", 38.40, 42.11], ["Bolu", 40.74, 31.61], ["Burdur", 37.72, 30.29],
  ["Bursa", 40.18, 29.06], ["Çanakkale", 40.15, 26.41], ["Çankırı", 40.60, 33.62], ["Çorum", 40.55, 34.96], ["Denizli", 37.78, 29.09],
  ["Diyarbakır", 37.91, 40.24], ["Düzce", 40.84, 31.16], ["Edirne", 41.68, 26.56], ["Elazığ", 38.67, 39.22], ["Erzincan", 39.75, 39.49],
  ["Erzurum", 39.90, 41.27], ["Eskişehir", 39.78, 30.52], ["Gaziantep", 37.07, 37.38], ["Giresun", 40.91, 38.39], ["Gümüşhane", 40.46, 39.48],
  ["Hakkari", 37.58, 43.74], ["Hatay", 36.20, 36.16], ["Iğdır", 39.92, 44.04], ["Isparta", 37.76, 30.55], ["İstanbul", 41.01, 28.98],
  ["İzmir", 38.42, 27.14], ["Kahramanmaraş", 37.58, 36.94], ["Karabük", 41.20, 32.62], ["Karaman", 37.18, 33.22], ["Kars", 40.60, 43.10],
  ["Kastamonu", 41.38, 33.78], ["Kayseri", 38.73, 35.49], ["Kırıkkale", 39.85, 33.51], ["Kırklareli", 41.73, 27.22], ["Kırşehir", 39.15, 34.16],
  ["Kilis", 36.72, 37.12], ["Kocaeli", 40.77, 29.92], ["Konya", 37.87, 32.48], ["Kütahya", 39.42, 29.98], ["Malatya", 38.35, 38.31],
  ["Manisa", 38.61, 27.43], ["Mardin", 37.31, 40.74], ["Mersin", 36.81, 34.64], ["Muğla", 37.22, 28.36], ["Muş", 38.75, 41.49],
  ["Nevşehir", 38.62, 34.71], ["Niğde", 37.97, 34.68], ["Ordu", 40.98, 37.88], ["Osmaniye", 37.07, 36.25], ["Rize", 41.02, 40.52],
  ["Sakarya", 40.78, 30.40], ["Samsun", 41.29, 36.33], ["Siirt", 37.93, 41.94], ["Sinop", 42.03, 35.15], ["Sivas", 39.75, 37.02],
  ["Şanlıurfa", 37.16, 38.80], ["Şırnak", 37.52, 42.46], ["Tekirdağ", 40.98, 27.51], ["Tokat", 40.31, 36.55], ["Trabzon", 41.00, 39.72],
  ["Tunceli", 39.11, 39.55], ["Uşak", 38.68, 29.41], ["Van", 38.49, 43.38], ["Yalova", 40.65, 29.27], ["Yozgat", 39.82, 34.81],
  ["Zonguldak", 41.45, 31.79],
];
export const ilBul = ad => ILLER.find(i => i[0] === ad) || null;

// Türkiye yerel saatini (o tarihteki resmî saat, yaz saati dahil) UTC milisaniyeye çevirir
function istOfset(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(new Date(t)).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(t / 60000) * 60000;
}
export function yereldenUTC(dt, saat = "12:00") {
  const [y, mo, d] = dt.split("-").map(Number), [h, mi] = saat.split(":").map(Number);
  const yerel = Date.UTC(y, mo - 1, d, h, mi);
  let t = yerel - 3 * 3600e3;
  for (let i = 0; i < 3; i++) t = yerel - istOfset(t);
  return t;
}

const jdT = t => { const jd = t / 864e5 + 2440587.5; return { jd, T: (jd - 2451545) / 36525 }; };

export function gunesBoylami(t) {
  const { T } = jdT(t);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = rad(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  return mod360(L0 + C - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * T)));
}

// [D, M, M', F, katsayı (1e-6 derece)]
const AY_TERIM = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],
  [2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],
  [0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],
  [2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],
  [2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069]];
export function ayBoylami(t) {
  const { T } = jdT(t);
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T,
    Mp = 134.9633964 + 477198.8675055 * T, F = 93.2720950 + 483202.0175233 * T, E = 1 - 0.002516 * T;
  let s = 0;
  for (const [a, b, c, d, k] of AY_TERIM) s += k * (Math.abs(b) === 1 ? E : Math.abs(b) === 2 ? E * E : 1) * Math.sin(rad(a * D + b * M + c * Mp + d * F));
  s += 3958 * Math.sin(rad(119.75 + 131.849 * T)) + 1962 * Math.sin(rad(Lp - F)) + 318 * Math.sin(rad(53.09 + 479264.29 * T));
  return mod360(Lp + s / 1e6 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * T)));
}

export function yukselenBoylami(t, enlem, boylam) {
  const { jd, T } = jdT(t);
  const ramc = rad(mod360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T + boylam));
  const e = rad(23.439291 - 0.0130042 * T);
  return mod360(deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(e) + Math.tan(rad(enlem)) * Math.sin(e)))));
}

const burcOf = lon => BURC_ADLARI[Math.floor(mod360(lon) / 30) % 12];
const sinirda = (lon, pay) => { const r = mod360(lon) % 30; return r < pay || r > 30 - pay; };

/**
 * Doğum haritası. dt: "YYYY-AA-GG", saat: "SS:DD" ya da boş (bilinmiyor), il: ILLER'deki ad ya da boş.
 * Döner: { gunes, ay, yk, ayKesin, ykKesin } — saat bilinmiyorsa Ay öğlen saatine göre; gün içinde burç değiştiriyorsa ayKesin=false.
 */
export function dogumHaritasi(dt, saat, il) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dt || "")) return null;
  const saatVar = /^\d{1,2}:\d{2}$/.test(saat || "");
  const t = yereldenUTC(dt, saatVar ? saat : "12:00");
  const g = gunesBoylami(t), a = ayBoylami(t);
  const sonuc = { gunes: burcOf(g), ay: burcOf(a), yk: "", ayKesin: true, ykKesin: true };
  if (!saatVar) {
    const a0 = burcOf(ayBoylami(yereldenUTC(dt, "00:00"))), a1 = burcOf(ayBoylami(yereldenUTC(dt, "23:59")));
    if (a0 !== a1) sonuc.ayKesin = false;
    sonuc.ykKesin = false;
  } else {
    if (sinirda(a, 0.3)) sonuc.ayKesin = false;
    const yer = ilBul(il);
    if (yer) { const y = yukselenBoylami(t, yer[1], yer[2]); sonuc.yk = burcOf(y); if (sinirda(y, 1)) sonuc.ykKesin = false; }
    else sonuc.ykKesin = false;
  }
  if (sinirda(g, 0.05)) sonuc.gunesSinir = true;
  return sonuc;
}
