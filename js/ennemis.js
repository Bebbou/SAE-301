/***********************************************************************/
/** ENNEMIS : apparition, poursuite (pathfinding), dégâts
/***********************************************************************/

const TAILLE_CASE = 32; // px (cf. niveau1.js)
const NB_ENNEMIS = 4; // au niveau 1 ; un de plus tous les 3 niveaux, jusqu'à NB_ENNEMIS_MAX
const NB_ENNEMIS_MAX = 7;
const ECHELLE_ENNEMI = 1.25;

// types d'ennemis (images chargées dans selection.js, de 32x32)
// poids(niveau) : probabilité relative d'apparition (0 = n'apparait pas encore) ; corps : [largeur, hauteur, décalage x, décalage y] de la hitbox
// vitesse : px/s (le joueur marche à 160) ; degats : PV retirés au contact ; tireur : tire de loin au lieu de foncer sur le joueur
const TYPES = {
  slime: { sprite: "sprite_slime", anim: "anim_slime", pv: 3, vitesse: 70, degats: 15, poids: () => 100, corps: [22, 14, 5, 18] },
  alien_vert: {
    sprite: "sprite_alien_vert", anim: "anim_alien_vert", anim_tir: "anim_alien_vert_tir", pv: 3, vitesse: 55, degats: 10,
    poids: (niveau) => (niveau >= 2 ? 40 : 0), corps: [20, 14, 6, 18], tireur: true
  },
  alien_rouge: { sprite: "sprite_alien_rouge", anim: "anim_alien_rouge", pv: 5, vitesse: 95, degats: 20, poids: (niveau) => (niveau >= 3 ? 35 : 0), corps: [20, 14, 6, 18] }
};

// tirs des aliens verts
const PORTEE_TIR = 300; // px : distance max pour tirer
const DISTANCE_TIR = 190; // px : le tireur s'arrête à cette distance et tire, il n'avance que s'il est plus loin
const DELAI_TIR = 2200; // ms entre deux tirs
const DUREE_VISEE = 450; // ms : l'animation de tir, avant que le projectile parte
const VITESSE_TIR = 230; // px/s
const DEGATS_TIR = 10;
const DUREE_VIE_TIR = 2200; // ms
const DISTANCE_MIN_APPARITION = 280; // px : pas d'ennemi qui apparait sur les joueurs
const RAYON_DETECTION = 300; // px : à cette distance l'ennemi repère un joueur...
const RAYON_ABANDON = 450; // px : ... et ne le lâche qu'au-delà de celle-ci
const DELAI_CHEMIN = 400; // ms entre deux calculs de chemin
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
// nombre : par défaut selon le niveau (la salle safe en demande 0)
export function creerEnnemis(scene, calque_sol, calque_murs, nombre = Math.min(NB_ENNEMIS + Math.floor((scene.niveau - 1) / 3), NB_ENNEMIS_MAX)) {
  scene.ennemis = scene.physics.add.group();
  scene.tirs_ennemis = scene.physics.add.group(); // projectiles des aliens verts
  const bloquees = casesBloquees(scene);
  const cases_libres = calque_sol.filterTiles((tuile) =>
    !bloquees.has(tuile.x + "," + tuile.y) &&
    Math.min(...scene.joueurs.map((j) => Phaser.Math.Distance.Between(tuile.getCenterX(), tuile.getCenterY(), j.sprite.x, j.sprite.y))) >= DISTANCE_MIN_APPARITION
  );
  Phaser.Utils.Array.Shuffle(cases_libres).slice(0, nombre).forEach((tuile) => {
    const type = TYPES[tirerType(scene.niveau)];
    const ennemi = scene.ennemis.create(tuile.getCenterX(), tuile.getCenterY(), type.sprite);
    ennemi.setScale(ECHELLE_ENNEMI);
    ennemi.body.setSize(type.corps[0], type.corps[1]); // hitbox sur le bas du corps (pixels du sprite d'origine)
    ennemi.body.setOffset(type.corps[2], type.corps[3]);
    ennemi.type = type;
    ennemi.pv = type.pv;
    ennemi.chemin = [];
    ennemi.alerte = false;
    ennemi.prochain_chemin = 0;
    ennemi.recul_jusqua = 0;
    ennemi.prochain_tir = 0;
    ennemi.vise = false; // true pendant l'animation de tir
    ennemi.anims.play(type.anim);
  });

  scene.physics.add.collider(scene.ennemis, calque_murs);
  scene.physics.add.collider(scene.ennemis, scene.cailloux);
  if (scene.groupe_cristaux) scene.physics.add.collider(scene.ennemis, scene.groupe_cristaux);
  scene.physics.add.collider(scene.ennemis, scene.ennemis);
  // un ennemi qui touche un joueur lui fait des dégâts
  scene.joueurs.forEach((j) => {
    scene.physics.add.overlap(j.sprite, scene.ennemis, (sprite, ennemi) => blesserJoueur(scene, j, ennemi));
  });
  // les tirs des aliens s'arrêtent sur les murs, les cailloux et les cristaux, et blessent les joueurs
  scene.physics.add.collider(scene.tirs_ennemis, calque_murs, (tir) => tir.destroy());
  scene.physics.add.collider(scene.tirs_ennemis, scene.cailloux, (tir) => tir.destroy());
  if (scene.groupe_cristaux) scene.physics.add.collider(scene.tirs_ennemis, scene.groupe_cristaux, (tir) => tir.destroy());
  scene.joueurs.forEach((j) => {
    scene.physics.add.overlap(j.sprite, scene.tirs_ennemis, (sprite, tir) => {
      if (degatsJoueur(scene, j, DEGATS_TIR)) tir.destroy();
    });
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
    if (ennemi.vise) { // en train de viser : il ne bouge plus
      ennemi.setVelocity(0, 0);
      return;
    }

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

    // alien vert : il tire dès qu'il voit le joueur à portée, et s'arrête à bonne distance au lieu de venir au contact
    if (ennemi.type.tireur && distance <= PORTEE_TIR && ligneDeVue(scene, position, cible)) {
      if (maintenant >= ennemi.prochain_tir) {
        viser(scene, ennemi, cible);
        return;
      }
      if (distance <= DISTANCE_TIR) {
        ennemi.setVelocity(0, 0);
        if (Math.abs(cible.x - position.x) > 4) ennemi.setFlipX(cible.x < position.x);
        return;
      }
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
    ennemi.setVelocity(direction.x * ennemi.type.vitesse, direction.y * ennemi.type.vitesse);
    if (Math.abs(direction.x) > 0.1) ennemi.setFlipX(direction.x < 0);
  });
}

// type d'ennemi tiré au hasard, selon les poids du niveau (le slime est toujours possible)
function tirerType(niveau) {
  const noms = Object.keys(TYPES);
  let reste = Math.random() * noms.reduce((total, nom) => total + TYPES[nom].poids(niveau), 0);
  for (const nom of noms) {
    reste -= TYPES[nom].poids(niveau);
    if (reste < 0) return nom;
  }
  return "slime";
}

// aucun mur entre deux points (on teste un point tous les 16 px)
function ligneDeVue(scene, a, b) {
  const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  for (let d = 16; d < distance; d += 16) {
    const x = a.x + ((b.x - a.x) * d) / distance;
    const y = a.y + ((b.y - a.y) * d) / distance;
    if (scene.calque_murs.hasTileAtWorldXY(x, y)) return false;
  }
  return true;
}

// alien vert : animation de tir, puis le projectile part vers la position du joueur à ce moment-là
function viser(scene, ennemi, cible) {
  ennemi.vise = true;
  ennemi.setVelocity(0, 0);
  if (Math.abs(cible.x - ennemi.x) > 4) ennemi.setFlipX(cible.x < ennemi.x);
  ennemi.anims.play(ennemi.type.anim_tir);
  scene.time.delayedCall(DUREE_VISEE, () => {
    if (!ennemi.active) return; // tué pendant qu'il visait
    const origine = ennemi.body.center;
    const but = scene.joueurs.reduce((proche, j) => // le joueur le plus proche, maintenant
      Phaser.Math.Distance.Between(origine.x, origine.y, j.sprite.x, j.sprite.y) < Phaser.Math.Distance.Between(origine.x, origine.y, proche.sprite.x, proche.sprite.y) ? j : proche
    ).sprite.body.center;
    const direction = new Phaser.Math.Vector2(but.x - origine.x, but.y - origine.y).normalize();
    const tir = scene.tirs_ennemis.create(origine.x, origine.y, "sprite_laser_bleu").setTint(0x7cff7c).setDepth(5000);
    tir.anims.play("anim_laser_bleu");
    tir.setRotation(direction.angle());
    tir.body.setSize(8, 8);
    tir.setVelocity(direction.x * VITESSE_TIR, direction.y * VITESSE_TIR);
    scene.time.delayedCall(DUREE_VIE_TIR, () => tir.destroy());
    ennemi.vise = false;
    ennemi.prochain_tir = scene.time.now + DELAI_TIR;
    ennemi.anims.play(ennemi.type.anim);
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

// PV en moins pour un joueur, puis invulnérabilité courte (le sprite clignote) ; renvoie false si le coup n'a pas porté
function degatsJoueur(scene, j, degats) {
  const maintenant = scene.time.now;
  if (j.pv <= 0 || maintenant < (j.invulnerable_jusqua ?? 0)) return false;
  j.pv = Math.max(j.pv - degats, 0);
  j.invulnerable_jusqua = maintenant + INVULNERABILITE_JOUEUR;
  scene.tweens.add({ targets: j.sprite, alpha: 0.3, duration: 90, yoyo: true, repeat: 4, onComplete: () => j.sprite.setAlpha(1) });
  scene.cameras.main.shake(120, 0.004);
  return true;
}

// contact avec un ennemi : dégâts de son type, et petit recul
function blesserJoueur(scene, j, ennemi) {
  if (!ennemi.active || !degatsJoueur(scene, j, ennemi.type.degats)) return;
  const maintenant = scene.time.now;
  // l'ennemi recule lui aussi, pour ne pas enchainer les coups sans que le joueur puisse réagir
  const direction = new Phaser.Math.Vector2(ennemi.x - j.sprite.x, ennemi.y - j.sprite.y).normalize();
  ennemi.recul_jusqua = maintenant + DUREE_RECUL;
  ennemi.setVelocity(direction.x * VITESSE_RECUL, direction.y * VITESSE_RECUL);
}
