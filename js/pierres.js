import * as fct from "./fonctions.js";
import * as butin from "./butin.js";

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
const ECHELLE_ICONE_HUD = 2; // 16 px -> 32 px
const POSITION_HUD = { x: 600, y: 64 }; // px : sous "Niveau N", au milieu de l'écran (icône ; le texte est à sa droite)

// nombre de pierres de l'équipe (partagé par les deux joueurs), gardé dans le registry pour suivre d'un niveau à l'autre
export const nombrePierres = (scene) => scene.registry.get("pierres_lunaires") ?? 0;

// icône + "x0" en haut de l'écran
export function creerCompteur(scene) {
  scene.icone_pierre = scene.add.image(POSITION_HUD.x, POSITION_HUD.y, "img_pierre_lunaire")
    .setScale(ECHELLE_ICONE_HUD)
    .setScrollFactor(0)
    .setDepth(fct.PROFONDEUR.hud);
  scene.texte_pierre = scene.add.text(POSITION_HUD.x + 26, POSITION_HUD.y, "", { fontFamily: fct.POLICES.bouton, fontSize: "22px", color: "#E8EBF0", stroke: "#20283A", strokeThickness: 5 })
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(fct.PROFONDEUR.hud);
  majCompteur(scene);
}

function majCompteur(scene) {
  scene.texte_pierre.setText("x" + nombrePierres(scene));
}

// retire des pierres du compteur (offrande) ; renvoie false, sans rien retirer, s'il n'y en a pas assez
export function retirerPierres(scene, nombre) {
  if (nombrePierres(scene) < nombre) return false;
  scene.registry.set("pierres_lunaires", nombrePierres(scene) - nombre);
  majCompteur(scene);
  scene.tweens.add({ targets: scene.icone_pierre, scale: ECHELLE_ICONE_HUD * 0.75, duration: 70, yoyo: true });
  return true;
}

// +1 au compteur, avec un petit coup de zoom sur l'icône
const PIERRE = {
  image: "img_pierre_lunaire",
  echelle: ECHELLE_PIERRE,
  ramasser: (scene) => {
    scene.registry.set("pierres_lunaires", nombrePierres(scene) + 1);
    majCompteur(scene);
    scene.tweens.add({ targets: scene.icone_pierre, scale: ECHELLE_ICONE_HUD * 1.35, duration: 70, yoyo: true });
  }
};

// un caillou vient d'être cassé en (x, y) : avec un peu de chance, 1 à 3 pierres jaillissent autour
// (un cristal cassé en lâche à coup sûr, plus : chance = 1, cf. cristaux.js)
export function lacherPierres(scene, x, y, chance = CHANCE_DROP, minimum = PIERRES_MIN, maximum = PIERRES_MAX) {
  if (Math.random() >= chance) return;
  // la lumière jaillit avec les pierres : elle s'élargit en s'éteignant (éclat géré par niveau1.js, comme l'impact des lasers)
  scene.eclats.push({ x: x, y: y - 6, fin: scene.time.now + DUREE_LUEUR, duree: DUREE_LUEUR, halo: HALO_LUEUR, expansion: true });
  const nombre = Phaser.Math.Between(minimum, maximum);
  for (let i = 0; i < nombre; i++) butin.lacherButin(scene, x, y, PIERRE);
}
