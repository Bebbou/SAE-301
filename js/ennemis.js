/***********************************************************************/
/** ENNEMIS : apparition, poursuite (pathfinding), dégâts
/***********************************************************************/

const TAILLE_CASE = 32; // px (cf. niveau1.js)
const NB_ENNEMIS = 4; // par niveau
const PV_ENNEMI = 3;
const VITESSE_ENNEMI = 70; // px/s (le joueur marche à 160)
const ECHELLE_ENNEMI = 1.25;
const DISTANCE_MIN_APPARITION = 280; // px : pas d'ennemi qui apparait sur les joueurs
const RAYON_DETECTION = 300; // px : à cette distance l'ennemi repère un joueur...
const RAYON_ABANDON = 450; // px : ... et ne le lâche qu'au-delà de celle-ci
const DELAI_CHEMIN = 400; // ms entre deux calculs de chemin
const DEGATS_CONTACT = 15; // PV retirés au joueur touché
const INVULNERABILITE_JOUEUR = 1000; // ms après un coup reçu
const DUREE_RECUL = 180; // ms
const VITESSE_RECUL = 200; // px/s
const DEGATS_PIOCHE = 2;
const DEGATS_LASER = 1;

// les 8 cases voisines : [dx, dy]
const VOISINS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const case_de = (valeur) => Math.floor(valeur / TAILLE_CASE);
const centre_de = (indice) => indice * TAILLE_CASE + TAILLE_CASE / 2;

// cases où l'on ne peut pas marcher : murs (grille[y][x] = true) et cailloux
function casesBloquees(scene) {
  const bloquees = new Set();
  (scene.etat.grille || []).forEach((ligne, y) => ligne.forEach((mur, x) => { if (mur) bloquees.add(x + "," + y); }));
  scene.cailloux.getChildren().forEach((caillou) => bloquees.add(case_de(caillou.x) + "," + case_de(caillou.y)));
  scene.cristaux.forEach((cristal) => bloquees.add(case_de(cristal.body.center.x) + "," + case_de(cristal.body.center.y)));
  return bloquees;
}

// plus court chemin (parcours en largeur, 8 directions sans couper les coins) entre deux cases
// renvoie la liste des centres de cases à suivre, sans la case de départ ; [] si aucun chemin
export function chercherChemin(bloquees, largeur, hauteur, depart, arrivee) {
  const cle = (x, y) => x + "," + y;
  const precedent = new Map([[cle(depart.x, depart.y), null]]);
  const file = [depart];
  while (file.length > 0) {
    const courant = file.shift();
    if (courant.x === arrivee.x && courant.y === arrivee.y) {
      const chemin = [];
      for (let c = courant; precedent.get(cle(c.x, c.y)) !== null; c = precedent.get(cle(c.x, c.y))) {
        chemin.unshift({ x: centre_de(c.x), y: centre_de(c.y) });
      }
      return chemin;
    }
    for (const [dx, dy] of VOISINS) {
      const nx = courant.x + dx;
      const ny = courant.y + dy;
      if (precedent.has(cle(nx, ny)) || bloquees.has(cle(nx, ny))) continue;
      // en diagonale, les deux cases adjacentes doivent être libres (on ne frotte pas les coins)
      if (dx !== 0 && dy !== 0 && (bloquees.has(cle(courant.x + dx, courant.y)) || bloquees.has(cle(courant.x, courant.y + dy)))) continue;
      if (nx < 0 || ny < 0 || nx >= largeur || ny >= hauteur) continue;
      precedent.set(cle(nx, ny), courant);
      file.push({ x: nx, y: ny });
    }
  }
  return [];
}

// crée les ennemis sur des cases de sol libres, loin des joueurs
export function creerEnnemis(scene, calque_sol, calque_murs, nombre = NB_ENNEMIS) {
  scene.ennemis = scene.physics.add.group();
  const bloquees = casesBloquees(scene);
  const cases_libres = calque_sol.filterTiles((tuile) =>
    !bloquees.has(tuile.x + "," + tuile.y) &&
    Math.min(...scene.joueurs.map((j) => Phaser.Math.Distance.Between(tuile.getCenterX(), tuile.getCenterY(), j.sprite.x, j.sprite.y))) >= DISTANCE_MIN_APPARITION
  );
  Phaser.Utils.Array.Shuffle(cases_libres).slice(0, nombre).forEach((tuile) => {
    const ennemi = scene.ennemis.create(tuile.getCenterX(), tuile.getCenterY(), "sprite_slime");
    ennemi.setScale(ECHELLE_ENNEMI);
    ennemi.body.setSize(22, 14); // hitbox sur le bas du corps : colonnes 5 à 26, lignes 18 à 31 (pixels du sprite d'origine)
    ennemi.body.setOffset(5, 18);
    ennemi.pv = PV_ENNEMI;
    ennemi.chemin = [];
    ennemi.alerte = false;
    ennemi.prochain_chemin = 0;
    ennemi.recul_jusqua = 0;
    ennemi.anims.play("anim_slime");
  });

  scene.physics.add.collider(scene.ennemis, calque_murs);
  scene.physics.add.collider(scene.ennemis, scene.cailloux);
  if (scene.groupe_cristaux) scene.physics.add.collider(scene.ennemis, scene.groupe_cristaux);
  scene.physics.add.collider(scene.ennemis, scene.ennemis);
  // un ennemi qui touche un joueur lui fait des dégâts
  scene.joueurs.forEach((j) => {
    scene.physics.add.overlap(j.sprite, scene.ennemis, (sprite, ennemi) => blesserJoueur(scene, j, ennemi));
  });
  // un laser qui touche un ennemi s'arrête et lui fait des dégâts
  scene.physics.add.overlap(scene.projectiles, scene.ennemis, (projectile, ennemi) => {
    // la direction se lit avant impactLaser : il détruit le projectile (et son corps physique)
    const direction = new Phaser.Math.Vector2(projectile.body.velocity.x, projectile.body.velocity.y).normalize();
    scene.impactLaser(projectile);
    blesserEnnemi(scene, ennemi, DEGATS_LASER, direction);
  });
}

// chaque image : les ennemis repèrent le joueur le plus proche, calculent un chemin puis le suivent
export function majEnnemis(scene) {
  const maintenant = scene.time.now;
  const bloquees = casesBloquees(scene);

  scene.ennemis.getChildren().forEach((ennemi) => {
    ennemi.setDepth(ennemi.y);
    if (maintenant < ennemi.recul_jusqua) return; // repoussé par un coup : on laisse la vitesse du recul

    const position = ennemi.body.center;
    let cible = null;
    let distance = Infinity;
    scene.joueurs.forEach((j) => {
      const d = Phaser.Math.Distance.Between(position.x, position.y, j.sprite.body.center.x, j.sprite.body.center.y);
      if (d < distance) { distance = d; cible = j.sprite.body.center; }
    });

    if (distance <= RAYON_DETECTION) ennemi.alerte = true;
    else if (distance > RAYON_ABANDON) ennemi.alerte = false;
    if (!ennemi.alerte) {
      ennemi.setVelocity(0, 0);
      return;
    }

    if (maintenant >= ennemi.prochain_chemin) {
      const grille = scene.etat.grille;
      ennemi.chemin = chercherChemin(bloquees, grille[0].length, grille.length, { x: case_de(position.x), y: case_de(position.y) }, { x: case_de(cible.x), y: case_de(cible.y) });
      ennemi.prochain_chemin = maintenant + DELAI_CHEMIN;
    }
    // prochain point du chemin ; dans la même case que le joueur (ou sans chemin), on fonce droit sur lui
    while (ennemi.chemin.length > 1 && Phaser.Math.Distance.Between(position.x, position.y, ennemi.chemin[0].x, ennemi.chemin[0].y) < 6) ennemi.chemin.shift();
    const but = ennemi.chemin.length > 1 ? ennemi.chemin[0] : cible;
    const direction = new Phaser.Math.Vector2(but.x - position.x, but.y - position.y).normalize();
    ennemi.setVelocity(direction.x * VITESSE_ENNEMI, direction.y * VITESSE_ENNEMI);
    if (Math.abs(direction.x) > 0.1) ennemi.setFlipX(direction.x < 0);
  });
}

// dégâts à un ennemi : clignotement rouge, recul dans la direction du coup, mort à 0 PV
export function blesserEnnemi(scene, ennemi, degats, direction) {
  if (!ennemi.active) return;
  ennemi.pv -= degats;
  if (ennemi.pv <= 0) {
    ennemi.body.enable = false;
    scene.tweens.add({ targets: ennemi, alpha: 0, scale: ECHELLE_ENNEMI * 1.3, duration: 180, onComplete: () => ennemi.destroy() });
    return;
  }
  ennemi.setTintFill(0xffffff);
  scene.time.delayedCall(80, () => ennemi.active && ennemi.clearTint());
  ennemi.alerte = true;
  ennemi.recul_jusqua = scene.time.now + DUREE_RECUL;
  ennemi.setVelocity(direction.x * VITESSE_RECUL, direction.y * VITESSE_RECUL);
}

// coup de pioche : les ennemis dans la zone de frappe (Phaser.Geom.Rectangle) encaissent
export function frapperEnnemis(scene, zone, regard) {
  scene.ennemis.getChildren().forEach((ennemi) => {
    const corps = new Phaser.Geom.Rectangle(ennemi.body.x, ennemi.body.y, ennemi.body.width, ennemi.body.height);
    if (Phaser.Geom.Intersects.RectangleToRectangle(zone, corps)) blesserEnnemi(scene, ennemi, DEGATS_PIOCHE, regard);
  });
}

// dégâts à un joueur : PV en moins, petit recul, puis invulnérabilité courte (le sprite clignote)
function blesserJoueur(scene, j, ennemi) {
  const maintenant = scene.time.now;
  if (!ennemi.active || j.pv <= 0 || maintenant < (j.invulnerable_jusqua ?? 0)) return;
  j.pv = Math.max(j.pv - DEGATS_CONTACT, 0);
  j.invulnerable_jusqua = maintenant + INVULNERABILITE_JOUEUR;
  scene.tweens.add({ targets: j.sprite, alpha: 0.3, duration: 90, yoyo: true, repeat: 4, onComplete: () => j.sprite.setAlpha(1) });
  scene.cameras.main.shake(120, 0.004);
  // l'ennemi recule lui aussi, pour ne pas enchainer les coups sans que le joueur puisse réagir
  const direction = new Phaser.Math.Vector2(ennemi.x - j.sprite.x, ennemi.y - j.sprite.y).normalize();
  ennemi.recul_jusqua = maintenant + DUREE_RECUL;
  ennemi.setVelocity(direction.x * VITESSE_RECUL, direction.y * VITESSE_RECUL);
}
