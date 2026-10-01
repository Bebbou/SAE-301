import * as fct from "./fonctions.js";
import * as pierres from "./pierres.js";

/***********************************************************************/
/** CRISTAUX : quelques cristaux lumineux contre les murs des niveaux, pour meubler l'obscurité
/** solides (joueurs, ennemis et lasers les contournent), cassables à la pioche, et ils éclairent autour d'eux : de loin on voit leur lueur
/***********************************************************************/

const NB_CRISTAUX = 5; // par niveau : on veut de petits repères, pas un éclairage
const COUPS_CRISTAL = 5; // coups de pioche pour en venir à bout (un caillou en demande 3)
const PIERRES_CRISTAL = [2, 4]; // pierres lunaires lâchées par un cristal brisé (à coup sûr)
const DISTANCE_MIN_ENTRE_CRISTAUX = 220; // px
const DISTANCE_MIN_JOUEUR = 120; // px : pas de cristal sur le joueur à son arrivée
const DISTANCE_MIN_OBJET = 64; // px : ni sur le trou, l'échelle ou un caillou
// halo d'un cristal : [rayon en px, opacité] ; son opacité pulse doucement (cf. majLumieres dans niveau1.js)
export const HALO_CRISTAL = [[100, 0.1], [68, 0.16], [40, 0.28], [20, 0.55]];

// crée les cristaux du niveau : positions tirées au hasard une seule fois (gardées dans l'état du niveau, comme les cailloux)
export function creerCristaux(scene, calque_sol, calque_murs) {
  if (!scene.etat.cristaux) scene.etat.cristaux = tirerPositions(scene, calque_sol, calque_murs);

  // position = la base du cristal ; le sprite (38x39) est centré 19 px plus haut
  scene.groupe_cristaux = scene.physics.add.staticGroup();
  scene.cristaux = scene.etat.cristaux.map((position) => {
    const cristal = scene.groupe_cristaux.create(position.x, position.y - 19, "sprite_cristal");
    // hitbox sur le pied du cristal (colonnes 8 à 29, lignes 27 à 38) : on peut passer derrière le haut
    cristal.body.setSize(22, 12);
    cristal.body.setOffset(8, 27);
    cristal.setDepth(position.y); // même tri d'affichage que les joueurs et les cailloux
    cristal.coups_restants = position.coups ?? COUPS_CRISTAL;
    cristal.anims.play({ key: "anim_cristal", startFrame: Phaser.Math.Between(0, 23) }); // pas tous synchronisés
    cristal.phase = Math.random() * Math.PI * 2; // pour la pulsation de la lumière
    return cristal;
  });

  // solides : les joueurs, les ennemis (cf. ennemis.js) et les lasers s'y arrêtent
  scene.joueurs.forEach((j) => scene.physics.add.collider(j.sprite, scene.groupe_cristaux));
  scene.physics.add.collider(scene.projectiles, scene.groupe_cristaux, (projectile) => scene.impactLaser(projectile));
}

// état à sauvegarder dans le niveau : position de la base et coups restants de chaque cristal encore là
export function etatCristaux(scene) {
  return scene.cristaux.map((cristal) => ({ x: cristal.x, y: cristal.y + 19, coups: cristal.coups_restants }));
}

// coup de pioche : si un cristal est dans la zone de frappe (Phaser.Geom.Rectangle), il encaisse et la fonction renvoie true
// à 0 coup il se brise : éclats, lumière, et des pierres lunaires à coup sûr
export function frapperCristal(scene, zone) {
  const cristal = scene.cristaux.find((c) =>
    Phaser.Geom.Intersects.RectangleToRectangle(zone, new Phaser.Geom.Rectangle(c.body.x, c.body.y, c.body.width, c.body.height))
  );
  if (!cristal) return false;

  cristal.coups_restants--;
  if (cristal.coups_restants > 0) {
    // le cristal blanchit et tremble un instant
    cristal.setTintFill(0xffffff);
    scene.time.delayedCall(70, () => cristal.active && cristal.clearTint());
    scene.tweens.add({ targets: cristal, x: cristal.x + 2, duration: 40, yoyo: true, repeat: 1 });
    return true;
  }

  eclater(scene, cristal.x, cristal.y);
  pierres.lacherPierres(scene, cristal.x, cristal.y + 19, 1, PIERRES_CRISTAL[0], PIERRES_CRISTAL[1]);
  scene.cristaux.splice(scene.cristaux.indexOf(cristal), 1);
  cristal.destroy(); // son corps statique disparait avec lui
  return true;
}

// petits éclats dorés projetés autour du cristal brisé
function eclater(scene, x, y) {
  for (let i = 0; i < 10; i++) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(18, 44);
    const eclat = scene.add.rectangle(x, y, 4, 4, i % 2 ? 0xffd45e : 0xffa83a).setDepth(fct.PROFONDEUR.projectiles);
    scene.tweens.add({
      targets: eclat,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance + 8,
      alpha: 0,
      angle: Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(350, 600),
      ease: "Quad.easeOut",
      onComplete: () => eclat.destroy()
    });
  }
}

// cases de sol libres, collées à un mur, assez éloignées les unes des autres
function tirerPositions(scene, calque_sol, calque_murs) {
  const objets = [...scene.etat.cailloux, scene.etat.trou, scene.etat.montee].filter(Boolean);
  const loin = (x, y, liste, distance) => liste.every((o) => Phaser.Math.Distance.Between(x, y, o.x, o.y) >= distance);
  const contre_mur = (t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => calque_murs.hasTileAt(t.x + dx, t.y + dy));

  const candidats = calque_sol.filterTiles((t) =>
    !calque_murs.hasTileAt(t.x, t.y) &&
    contre_mur(t) &&
    loin(t.getCenterX(), t.getCenterY(), objets, DISTANCE_MIN_OBJET) &&
    scene.joueurs.every((j) => Phaser.Math.Distance.Between(t.getCenterX(), t.getCenterY(), j.sprite.x, j.sprite.y) >= DISTANCE_MIN_JOUEUR)
  );
  Phaser.Utils.Array.Shuffle(candidats);

  const positions = [];
  for (const t of candidats) {
    const x = t.getCenterX();
    const y = t.getCenterY() + 12; // la base du cristal est vers le bas de la case
    if (loin(x, y, positions, DISTANCE_MIN_ENTRE_CRISTAUX)) positions.push({ x: x, y: y });
    if (positions.length === NB_CRISTAUX) break;
  }
  return positions;
}
