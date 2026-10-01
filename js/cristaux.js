/***********************************************************************/
/** CRISTAUX : quelques cristaux lumineux contre les murs des niveaux, pour meubler l'obscurité
/** de simples décors (on passe devant), mais ils éclairent autour d'eux : de loin on voit leur lueur
/***********************************************************************/

const NB_CRISTAUX = 5; // par niveau : on veut de petits repères, pas un éclairage
const DISTANCE_MIN_ENTRE_CRISTAUX = 220; // px
const DISTANCE_MIN_JOUEUR = 120; // px : pas de cristal sur le joueur à son arrivée
const DISTANCE_MIN_OBJET = 64; // px : ni sur le trou, l'échelle ou un caillou
// halo d'un cristal : [rayon en px, opacité] ; son opacité pulse doucement (cf. majLumieres dans niveau1.js)
export const HALO_CRISTAL = [[100, 0.1], [68, 0.16], [40, 0.28], [20, 0.55]];

// crée les cristaux du niveau : positions tirées au hasard une seule fois (gardées dans l'état du niveau, comme les cailloux)
export function creerCristaux(scene, calque_sol, calque_murs) {
  if (!scene.etat.cristaux) scene.etat.cristaux = tirerPositions(scene, calque_sol, calque_murs);

  scene.cristaux = scene.etat.cristaux.map((position) => {
    const cristal = scene.add.sprite(position.x, position.y, "sprite_cristal")
      .setOrigin(0.5, 1) // posé par sa base
      .setDepth(position.y); // même tri d'affichage que les joueurs et les cailloux
    cristal.anims.play({ key: "anim_cristal", startFrame: Phaser.Math.Between(0, 23) }); // pas tous synchronisés
    cristal.phase = Math.random() * Math.PI * 2; // pour la pulsation de la lumière
    return cristal;
  });
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
