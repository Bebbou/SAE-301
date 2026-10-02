import * as fct from "./fonctions.js";
import * as bonus from "./bonus.js";
import * as cristaux from "./cristaux.js";

/***********************************************************************/
/** LUMIERE : le jeu est dans le noir, la torche et quelques objets éclairent
/**
/** Le principe tient en 3 étapes, refaites à chaque image :
/**   1. une grande image noire couvre tout l'écran (scene.obscurite)
/**   2. on dessine en blanc, sur un "calque de gomme" (scene.forme_lumiere), tout ce qui éclaire :
/**      des cercles autour des sources de lumière et le cône de la torche
/**   3. on gomme (erase) ce calque dans le noir : là où on a dessiné, le jeu redevient visible
/***********************************************************************/

const PORTEE_TORCHE = 260; // px : longueur du cône de lumière
const ANGLE_TORCHE = 60; // degrés : ouverture du cône
const NB_RAYONS = 15; // rayons lancés dans le cône pour savoir où s'arrêtent les murs
const PAS_RAYON = 8; // px : un rayon avance de 8 px à la fois jusqu'à toucher un mur
const COUCHES_CONE = [1, 0.75, 0.5, 0.25]; // le cône est dessiné 4 fois, de plus en plus court : plus on est près, plus c'est éclairé
const OPACITE_COUCHE = 0.3;

// un halo = des cercles concentriques [rayon en px, opacité] : la lumière est plus forte au centre
const HALO_JOUEUR = [[28, 0.2], [14, 1]]; // le dernier cercle (opacité 1) rend le joueur toujours visible
const HALO_LASER = [[44, 0.2], [28, 0.3], [14, 0.6]];
const HALO_ECLAT = [[56, 0.2], [32, 0.4], [16, 0.8]]; // lueur quand un laser touche un mur
const DUREE_ECLAT = 150; // ms
const HALO_TIR_ENNEMI = [[34, 0.2], [18, 0.5], [9, 0.85]];

// crée le noir qui couvre l'écran et le calque de gomme (dans la salle safe : pas d'obscurité du tout)
export function creerObscurite(scene) {
  scene.obscurite = scene.etat.safe ? null : scene.add.renderTexture(0, 0, scene.scale.width, scene.scale.height)
    .setOrigin(0, 0)
    .setScrollFactor(0) // il reste collé à l'écran quand la caméra bouge
    .setDepth(fct.PROFONDEUR.obscurite); // au-dessus du jeu, sous l'affichage (HUD)
  scene.forme_lumiere = scene.make.graphics({}, false); // jamais affiché : sert seulement de gomme
}

// un laser touche un mur : une petite lueur de 150 ms
export function ajouterEclat(scene, x, y) {
  if (scene.etat.safe) return; // rien à éclairer dans la salle safe
  scene.eclats.push({ x: x, y: y, fin: scene.time.now + DUREE_ECLAT });
}

// dessine un halo sur le calque de gomme (les coordonnées du monde sont converties en coordonnées d'écran)
function halo(scene, x, y, rayons, opacite = 1, echelle = 1) {
  const camera = scene.cameras.main;
  rayons.forEach(([rayon, force]) => {
    scene.forme_lumiere.fillStyle(0xffffff, force * opacite);
    scene.forme_lumiere.fillCircle(x - camera.scrollX, y - camera.scrollY, rayon * echelle);
  });
}

// longueur du cône du joueur (la potion de vision l'allonge)
function porteeTorche(joueur) {
  return PORTEE_TORCHE * (joueur.effets.vision > 0 ? bonus.PORTEE_VISION : 1);
}

// le cône est un polygone : le joueur, puis un point au bout de chaque rayon
// un rayon part du joueur dans une direction et avance par petits pas, jusqu'à la portée maximale ou jusqu'à un mur
function pointsDuCone(scene, joueur) {
  const x = joueur.sprite.body.center.x;
  const y = joueur.sprite.body.center.y;
  const portee = porteeTorche(joueur);
  const demi_angle = Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
  const points = [{ x: x, y: y }];

  for (let i = 0; i < NB_RAYONS; i++) {
    // de -demi_angle à +demi_angle autour de la direction du regard
    const angle = joueur.regard.angle() - demi_angle + (i / (NB_RAYONS - 1)) * 2 * demi_angle;
    let distance = 0;
    while (distance < portee && !scene.calque_murs.hasTileAtWorldXY(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance)) {
      distance += PAS_RAYON;
    }
    points.push({ x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance });
  }
  return points;
}

// dessine le cône 4 fois, du plus long au plus court : le centre s'éclaire 4 fois, le bout une seule
function dessinerCone(scene, joueur) {
  const camera = scene.cameras.main;
  const points = pointsDuCone(scene, joueur);
  const origine = points[0];
  COUCHES_CONE.forEach((echelle) => {
    // on rapproche chaque point de l'origine pour raccourcir le cône
    const reduits = points.map((p) => new Phaser.Math.Vector2(
      origine.x + (p.x - origine.x) * echelle - camera.scrollX,
      origine.y + (p.y - origine.y) * echelle - camera.scrollY
    ));
    scene.forme_lumiere.fillStyle(0xffffff, OPACITE_COUCHE);
    scene.forme_lumiere.fillPoints(reduits, true);
  });
}

// le point (x, y) est-il dans le cône du joueur ? (assez près, et dans l'angle du regard)
function dansLeCone(joueur, x, y) {
  const centre = joueur.sprite.body.center;
  const distance = Phaser.Math.Distance.Between(centre.x, centre.y, x, y);
  const ecart = Phaser.Math.Angle.Wrap(Math.atan2(y - centre.y, x - centre.x) - joueur.regard.angle());
  return distance <= porteeTorche(joueur) && Math.abs(ecart) <= Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
}

// à appeler à chaque image : redessine toute la lumière
export function majLumieres(scene) {
  if (scene.etat.safe) return; // salle safe : pas d'obscurité, donc rien à éclairer
  scene.forme_lumiere.clear();

  // le joueur : un petit halo autour de lui, et le cône de sa torche si elle est allumée
  scene.joueurs.forEach((j) => {
    halo(scene, j.sprite.x, j.sprite.y, HALO_JOUEUR);
    if (j.torche_allumee) dessinerCone(scene, j);
  });

  // un laser éclaire autour de lui, sauf quand la torche d'un joueur l'éclaire déjà
  scene.projectiles.getChildren().forEach((laser) => {
    const deja_eclaire = scene.joueurs.some((j) => j.torche_allumee && dansLeCone(j, laser.x, laser.y));
    if (!deja_eclaire) halo(scene, laser.x, laser.y, HALO_LASER);
  });

  // les éclats d'impact : ils faiblissent jusqu'à disparaître
  scene.eclats = scene.eclats.filter((eclat) => scene.time.now < eclat.fin);
  scene.eclats.forEach((eclat) => {
    const restant = (eclat.fin - scene.time.now) / (eclat.duree ?? DUREE_ECLAT); // 1 puis 0
    const echelle = eclat.expansion ? 0.6 + 0.4 * (1 - restant) : 1; // certains s'élargissent en s'éteignant (cf. pierres.js)
    halo(scene, eclat.x, eclat.y, eclat.halo ?? HALO_ECLAT, restant, echelle);
  });

  // les objets qui brillent : potions au sol, tirs des aliens, cristaux
  scene.butin.forEach((objet) => {
    if (objet.definition.lumiere) halo(scene, objet.x, objet.y, bonus.HALO_POTION);
  });
  scene.tirs_ennemis.getChildren().forEach((tir) => halo(scene, tir.x, tir.y, HALO_TIR_ENNEMI));
  scene.cristaux.forEach((cristal) => halo(scene, cristal.x, cristal.y, cristaux.HALO_CRISTAL));

  // étapes 1 et 3 : tout noir, puis on gomme tout ce qui a été dessiné
  scene.obscurite.fill(0x000000);
  scene.obscurite.erase(scene.forme_lumiere);
}
