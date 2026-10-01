import * as fct from "./fonctions.js";

/***********************************************************************/
/** PIERRES LUNAIRES : petits drops à la Stardew Valley + compteur du HUD
/***********************************************************************/

const CHANCE_DROP = 0.3; // chance qu'un caillou cassé laisse des pierres
const PIERRES_MIN = 1;
const PIERRES_MAX = 3;
// lueur quand des pierres jaillissent : [rayon en px, opacité] (même principe que les halos de niveau1.js)
const HALO_LUEUR = [[150, 0.15], [110, 0.2], [76, 0.3], [46, 0.5], [24, 0.9]];
const DUREE_LUEUR = 1100; // ms
const ECHELLE_PIERRE = 1.5; // la pierre fait 16 px : affichée à 24 px
const PORTEE_EJECTION = [20, 38]; // px : distance min / max à laquelle une pierre est éjectée
const DUREE_EJECTION = 380; // ms
const HAUTEUR_SAUT = 22; // px
const RAYON_AIMANT = 56; // px : une pierre posée est attirée par le joueur le plus proche à cette distance
const VITESSE_AIMANT = 260; // px/s
const RAYON_RAMASSAGE = 12; // px
const ECHELLE_ICONE_HUD = 2; // 16 px -> 32 px
const POSITION_HUD = { x: 600, y: 64 }; // px : sous "Niveau N", au milieu de l'écran (icône ; le texte est à sa droite)

// nombre de pierres de l'équipe (partagé par les deux joueurs), gardé dans le registry pour suivre d'un niveau à l'autre
export const nombrePierres = (scene) => scene.registry.get("pierres_lunaires") ?? 0;

// icône + "x0" en haut de l'écran
export function creerCompteur(scene) {
  scene.pierres = []; // pierres posées au sol dans ce niveau
  scene.icone_pierre = scene.add.image(POSITION_HUD.x, POSITION_HUD.y, "img_pierre_lunaire")
    .setScale(ECHELLE_ICONE_HUD)
    .setScrollFactor(0)
    .setDepth(fct.PROFONDEUR.hud);
  scene.texte_pierre = scene.add.text(POSITION_HUD.x + 26, POSITION_HUD.y, "", { fontSize: "28px", fontStyle: "bold", color: "#E8EBF0", stroke: "#20283A", strokeThickness: 5 })
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(fct.PROFONDEUR.hud);
  majCompteur(scene);
}

function majCompteur(scene) {
  scene.texte_pierre.setText("x" + nombrePierres(scene));
}

// un caillou vient d'être cassé en (x, y) : avec un peu de chance, 1 à 3 pierres jaillissent autour
export function lacherPierres(scene, x, y) {
  if (Math.random() >= CHANCE_DROP) return;
  // la lumière jaillit avec les pierres : elle s'élargit en s'éteignant (éclat géré par niveau1.js, comme l'impact des lasers)
  scene.eclats.push({ x: x, y: y - 6, fin: scene.time.now + DUREE_LUEUR, duree: DUREE_LUEUR, halo: HALO_LUEUR, expansion: true });
  const nombre = Phaser.Math.Between(PIERRES_MIN, PIERRES_MAX);
  for (let i = 0; i < nombre; i++) creerPierre(scene, x, y);
}

// une pierre saute du caillou vers un point voisin (pas dans un mur), puis attend d'être ramassée
function creerPierre(scene, x, y) {
  let cible = { x: x, y: y };
  for (let essai = 0; essai < 10; essai++) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.FloatBetween(PORTEE_EJECTION[0], PORTEE_EJECTION[1]);
    const x_essai = x + Math.cos(angle) * distance;
    const y_essai = y + Math.sin(angle) * distance;
    if (!scene.calque_murs.hasTileAtWorldXY(x_essai, y_essai)) {
      cible = { x: x_essai, y: y_essai };
      break;
    }
  }

  const pierre = scene.add.image(x, y, "img_pierre_lunaire").setScale(ECHELLE_PIERRE).setDepth(cible.y - 8);
  pierre.pret = false; // pas ramassable pendant le saut
  pierre.flot = 0; // petit mouvement de haut en bas une fois posée
  scene.pierres.push(pierre);

  // saut : x en ligne droite, y monte puis retombe en rebondissant
  scene.tweens.add({ targets: pierre, x: cible.x, duration: DUREE_EJECTION });
  scene.tweens.chain({
    targets: pierre,
    tweens: [
      { y: Math.min(y, cible.y) - HAUTEUR_SAUT, duration: DUREE_EJECTION * 0.4, ease: "Sine.easeOut" },
      { y: cible.y, duration: DUREE_EJECTION * 0.6, ease: "Bounce.easeOut" }
    ],
    onComplete: () => {
      if (!pierre.active) return;
      pierre.base_y = pierre.y;
      pierre.pret = true;
      pierre.tween_flot = scene.tweens.add({ targets: pierre, flot: -2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  });
}

// chaque image : les pierres posées sont attirées par le joueur proche, puis ramassées
export function majPierres(scene, secondes) {
  for (let i = scene.pierres.length - 1; i >= 0; i--) {
    const pierre = scene.pierres[i];
    if (!pierre.pret) continue;

    let proche = null;
    let distance = Infinity;
    scene.joueurs.forEach((j) => {
      const d = Phaser.Math.Distance.Between(pierre.x, pierre.base_y, j.sprite.body.center.x, j.sprite.body.center.y);
      if (d < distance) { distance = d; proche = j.sprite.body.center; }
    });

    if (distance <= RAYON_RAMASSAGE) {
      ramasser(scene, pierre);
      scene.pierres.splice(i, 1);
      continue;
    }
    if (distance <= RAYON_AIMANT) {
      if (pierre.tween_flot) { pierre.tween_flot.remove(); pierre.tween_flot = null; pierre.flot = 0; }
      const pas = Math.min(VITESSE_AIMANT * secondes, distance);
      pierre.x += ((proche.x - pierre.x) / distance) * pas;
      pierre.base_y += ((proche.y - pierre.base_y) / distance) * pas;
    }
    pierre.y = pierre.base_y + pierre.flot;
  }
}

// +1 au compteur, avec un petit coup de zoom sur l'icône
function ramasser(scene, pierre) {
  pierre.destroy();
  scene.registry.set("pierres_lunaires", nombrePierres(scene) + 1);
  majCompteur(scene);
  scene.tweens.add({ targets: scene.icone_pierre, scale: ECHELLE_ICONE_HUD * 1.35, duration: 70, yoyo: true });
}
