import * as fct from "./fonctions.js";
import * as butin from "./butin.js";

/***********************************************************************/
/** BONUS : potions lâchées (rarement) par les cailloux
/** soin immédiat, ou effet temporaire sur le joueur qui la ramasse : meilleure torche, vitesse
/***********************************************************************/

const CHANCE_BONUS = 0.12; // chance qu'un caillou cassé laisse une potion (en plus des pierres, tirées à part)
const ECHELLE_POTION = 1.5; // 16 px -> 24 px
// poids : plus il est grand, plus la potion est fréquente ; duree : ms (pour les effets temporaires)
const POTIONS = {
  heal: { poids: 40, soin: 30, texte: "+30 PV", couleur: "#8CE99A" },
  vision: { poids: 30, duree: 15000, texte: "Torche +", couleur: "#9CC9FF" },
  vitesse: { poids: 30, duree: 8000, texte: "Vitesse +", couleur: "#FFD28C" }
};
// effets temporaires : PORTEE_VISION multiplie la portée de la torche, FACTEUR_VITESSE la vitesse de marche et de sprint
export const PORTEE_VISION = 1.5;
export const FACTEUR_VITESSE = 1.35;
// halo d'une potion posée au sol : elle brille dans le noir (cf. majLumieres dans niveau1.js)
export const HALO_POTION = [[40, 0.12], [22, 0.3], [11, 0.55]];

// noms des effets temporaires, dans l'ordre d'affichage du HUD
export const EFFETS = Object.keys(POTIONS).filter((nom) => POTIONS[nom].duree);
export const DUREE_EFFET = (nom) => POTIONS[nom].duree;

// un caillou vient d'être cassé en (x, y) : avec un peu de chance, une potion jaillit
export function lacherBonus(scene, x, y) {
  if (Math.random() >= CHANCE_BONUS) return;
  const nom = tirerPotion();
  butin.lacherButin(scene, x, y, {
    image: "sprite_potion_" + nom,
    anim: "anim_potion_" + nom,
    echelle: ECHELLE_POTION,
    lumiere: true,
    ramasser: (scene_courante, joueur) => boire(scene_courante, joueur, nom)
  });
}

// tirage au hasard pondéré par les poids
function tirerPotion() {
  const noms = Object.keys(POTIONS);
  let reste = Math.random() * noms.reduce((total, nom) => total + POTIONS[nom].poids, 0);
  for (const nom of noms) {
    reste -= POTIONS[nom].poids;
    if (reste < 0) return nom;
  }
  return noms[0];
}

// le joueur ramasse la potion : l'effet est immédiat
function boire(scene, j, nom) {
  const potion = POTIONS[nom];
  if (potion.soin) scene.soigner(j, potion.soin);
  else j.effets[nom] = potion.duree; // reboire relance la durée
  fct.texteFlottant(scene, j.sprite.x, j.sprite.y - 44, potion.texte, potion.couleur);
}
