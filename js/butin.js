/***********************************************************************/
/** BUTIN : objets lâchés par les cailloux (pierres lunaires, potions...)
/** ils jaillissent du caillou, rebondissent, flottent au sol, puis sont attirés et ramassés par le joueur proche
/***********************************************************************/

const PORTEE_EJECTION = [20, 38]; // px : distance min / max à laquelle un objet est éjecté
const DUREE_EJECTION = 380; // ms
const HAUTEUR_SAUT = 22; // px
const RAYON_AIMANT = 56; // px : un objet posé est attiré par le joueur le plus proche à cette distance
const VITESSE_AIMANT = 260; // px/s
const RAYON_RAMASSAGE = 12; // px

// à appeler une fois par niveau (la liste des objets posés au sol)
export function initButin(scene) {
  scene.butin = [];
}

// définition d'un objet : { image, echelle, anim (optionnel : animation Phaser à jouer), lumiere (optionnel : éclaire autour de lui),
//                           ramasser(scene, joueur) : ce qui se passe quand un joueur le ramasse }
// l'objet saute de (x, y) vers un point voisin (pas dans un mur), puis attend d'être ramassé
export function lacherButin(scene, x, y, definition) {
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

  const objet = definition.anim ? scene.add.sprite(x, y, definition.image).play(definition.anim) : scene.add.image(x, y, definition.image);
  objet.setScale(definition.echelle).setDepth(cible.y - 8);
  objet.definition = definition;
  objet.pret = false; // pas ramassable pendant le saut
  objet.flot = 0; // petit mouvement de haut en bas une fois posé
  scene.butin.push(objet);

  // saut : x en ligne droite, y monte puis retombe en rebondissant
  scene.tweens.add({ targets: objet, x: cible.x, duration: DUREE_EJECTION });
  scene.tweens.chain({
    targets: objet,
    tweens: [
      { y: Math.min(y, cible.y) - HAUTEUR_SAUT, duration: DUREE_EJECTION * 0.4, ease: "Sine.easeOut" },
      { y: cible.y, duration: DUREE_EJECTION * 0.6, ease: "Bounce.easeOut" }
    ],
    onComplete: () => {
      if (!objet.active) return;
      objet.base_y = objet.y;
      objet.pret = true;
      objet.tween_flot = scene.tweens.add({ targets: objet, flot: -2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  });
}

// chaque image : les objets posés sont attirés par le joueur proche, puis ramassés
export function majButin(scene, secondes) {
  for (let i = scene.butin.length - 1; i >= 0; i--) {
    const objet = scene.butin[i];
    if (!objet.pret) continue;

    let proche = null;
    let distance = Infinity;
    scene.joueurs.forEach((j) => {
      const d = Phaser.Math.Distance.Between(objet.x, objet.base_y, j.sprite.body.center.x, j.sprite.body.center.y);
      if (d < distance) { distance = d; proche = j; }
    });

    if (distance <= RAYON_RAMASSAGE) {
      scene.butin.splice(i, 1);
      objet.destroy();
      objet.definition.ramasser(scene, proche);
      continue;
    }
    if (distance <= RAYON_AIMANT) {
      if (objet.tween_flot) { objet.tween_flot.remove(); objet.tween_flot = null; objet.flot = 0; }
      const centre = proche.sprite.body.center;
      const pas = Math.min(VITESSE_AIMANT * secondes, distance);
      objet.x += ((centre.x - objet.x) / distance) * pas;
      objet.base_y += ((centre.y - objet.base_y) / distance) * pas;
    }
    objet.y = objet.base_y + objet.flot;
  }
}
