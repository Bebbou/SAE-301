import * as fct from "./fonctions.js";
import * as pierres from "./pierres.js";
import { STATUE } from "./salle_safe.js";

/***********************************************************************/
/** OFFRANDE : à la statue de la salle safe, on offre des pierres lunaires en échange de PV et de stamina
/** une bulle au-dessus de la statue indique qu'on peut donner ; bouton "interagir avec un objet" (O ou T)
/***********************************************************************/

const PIERRES_MAX = 5; // pierres données au maximum par appui (pour ne pas appuyer 20 fois) ; on n'en donne pas plus que nécessaire
const PORTEE = 56; // px : distance max entre le joueur et la statue pour que la bulle apparaisse
const BULLE_Y = 118; // px : position (monde) de la bulle, au-dessus de la tête de la statue
const LARGEUR_BULLE = 104;
const HAUTEUR_BULLE = 62;
const DUREE_VOL = 440; // ms : la pierre vole du joueur vers la statue
const COULEUR_ANNEAU = 0xec8697; // rose de la palette

// crée la bulle (cachée tant que personne n'est près de la statue)
export function creerOffrande(scene) {
  const fond = scene.add.graphics();
  fond.fillStyle(0x111a32, 0.94);
  fond.lineStyle(3, COULEUR_ANNEAU);
  // petite queue qui pointe vers la statue, puis le corps de la bulle par-dessus
  fond.fillTriangle(-9, HAUTEUR_BULLE / 2 - 2, 9, HAUTEUR_BULLE / 2 - 2, 0, HAUTEUR_BULLE / 2 + 12);
  fond.strokeTriangle(-9, HAUTEUR_BULLE / 2 - 2, 9, HAUTEUR_BULLE / 2 - 2, 0, HAUTEUR_BULLE / 2 + 12);
  fond.fillRoundedRect(-LARGEUR_BULLE / 2, -HAUTEUR_BULLE / 2, LARGEUR_BULLE, HAUTEUR_BULLE, 16);
  fond.strokeRoundedRect(-LARGEUR_BULLE / 2, -HAUTEUR_BULLE / 2, LARGEUR_BULLE, HAUTEUR_BULLE, 16);
  // la queue ne doit pas laisser de trait en travers de la bulle
  fond.fillStyle(0x111a32, 1);
  fond.fillRect(-8, HAUTEUR_BULLE / 2 - 3, 16, 3);

  const icone = scene.add.image(-28, -8, "img_pierre_lunaire").setScale(2);
  const cout = scene.add.text(-10, -8, "x" + PIERRES_MAX, { fontFamily: fct.POLICES.bouton, fontSize: "20px", color: "#E8EBF0" }).setOrigin(0, 0.5);
  const touches = scene.add.text(0, 18, "", { fontFamily: fct.POLICES.bouton, fontSize: "12px", color: "#BFC3CC" }).setOrigin(0.5);

  const bulle = scene.add.container(STATUE.centre_x, BULLE_Y, [fond, icone, cout, touches])
    .setDepth(fct.PROFONDEUR.projectiles)
    .setScale(0);
  scene.offrande = { bulle: bulle, cout: cout, touches: touches, affichee: false };
}

// distance entre un point et le rectangle de la statue
function distanceStatue(x, y) {
  const [rx, ry, largeur, hauteur] = STATUE.rect;
  const dx = Math.max(rx - x, 0, x - (rx + largeur));
  const dy = Math.max(ry - y, 0, y - (ry + hauteur));
  return Math.hypot(dx, dy);
}

// chaque image : affiche ou cache la bulle, et traite le bouton "objet" des joueurs proches
export function majOffrande(scene) {
  const o = scene.offrande;
  const proches = scene.joueurs.filter((j) => distanceStatue(j.sprite.body.center.x, j.sprite.body.center.y) <= PORTEE);

  if ((proches.length > 0) !== o.affichee) {
    o.affichee = proches.length > 0;
    scene.tweens.killTweensOf(o.bulle);
    scene.tweens.add(o.affichee
      ? { targets: o.bulle, scale: 1, duration: 220, ease: "Back.easeOut" }
      : { targets: o.bulle, scale: 0, duration: 120, ease: "Quad.easeIn" });
  }
  o.bulle.y = BULLE_Y + Math.sin(scene.time.now / 300) * 2.5; // elle flotte doucement
  if (proches.length === 0) return;

  // la bulle annonce le nombre de pierres qui partiraient (rouge : aucune pierre)
  const possedees = pierres.nombrePierres(scene);
  const prevu = Math.max(1, Math.min(PIERRES_MAX, ...proches.map((j) => scene.pierresPourSoigner(j))));
  o.cout.setText("x" + prevu);
  o.cout.setColor(possedees > 0 ? "#E8EBF0" : "#FF6B6B");
  o.touches.setText(proches.map((j) => "[" + j.definition.touches.objet + "]").join(" "));

  for (const j of proches) {
    if (!Phaser.Input.Keyboard.JustDown(j.touches.objet)) continue;
    const necessaires = scene.pierresPourSoigner(j);
    const nombre = Math.min(PIERRES_MAX, necessaires, possedees);
    if (necessaires === 0) refuser(scene, j, "Déjà en forme !");
    else if (nombre === 0) refuser(scene, j, "Pas de pierre lunaire");
    else {
      pierres.retirerPierres(scene, nombre);
      offrir(scene, j, nombre);
    }
    break; // une offrande par image
  }
}

// la bulle tremble et un petit texte explique pourquoi
function refuser(scene, j, message) {
  scene.tweens.add({ targets: scene.offrande.bulle, angle: { from: -4, to: 4 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => scene.offrande.bulle.setAngle(0) });
  texteFlottant(scene, j, message, "#FF6B6B");
}

// la pierre vole du joueur vers la statue ; à l'arrivée un anneau de lumière part de la statue et le joueur est soigné
function offrir(scene, j, nombre) {
  const arrivee = { x: STATUE.centre_x, y: STATUE.rect[1] + 40 };
  const pierre = scene.add.image(j.sprite.x, j.sprite.y - 12, "img_pierre_lunaire").setScale(1.5).setDepth(fct.PROFONDEUR.projectiles);
  scene.tweens.add({ targets: pierre, x: arrivee.x, duration: DUREE_VOL });
  scene.tweens.chain({
    targets: pierre,
    tweens: [
      { y: Math.min(pierre.y, arrivee.y) - 40, duration: DUREE_VOL * 0.5, ease: "Sine.easeOut" },
      { y: arrivee.y, duration: DUREE_VOL * 0.5, ease: "Sine.easeIn" }
    ],
    onComplete: () => {
      pierre.destroy();
      anneau(scene, arrivee.x, arrivee.y);
      const pv = scene.recevoirOffrande(j, nombre);
      texteFlottant(scene, j, pv > 0 ? "+" + pv + " PV" : "Stamina !", "#8CE99A");
      // le joueur s'illumine un instant
      j.sprite.setTintFill(0xffd9df);
      scene.time.delayedCall(140, () => j.sprite.active && j.sprite.clearTint());
    }
  });
}

// anneau de lumière qui s'élargit en s'éteignant
function anneau(scene, x, y) {
  const g = scene.add.graphics({ x: x, y: y }).setDepth(fct.PROFONDEUR.projectiles);
  g.lineStyle(4, COULEUR_ANNEAU);
  g.strokeCircle(0, 0, 16);
  g.fillStyle(COULEUR_ANNEAU, 0.25);
  g.fillCircle(0, 0, 16);
  scene.tweens.add({ targets: g, scale: 5, alpha: 0, duration: 650, ease: "Quad.easeOut", onComplete: () => g.destroy() });
}

// texte qui monte au-dessus du joueur en s'effaçant
function texteFlottant(scene, j, message, couleur) {
  fct.texteFlottant(scene, j.sprite.x, j.sprite.y - 44, message, couleur);
}
