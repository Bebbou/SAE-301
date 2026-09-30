import * as fct from "./fonctions.js";
import * as generation from "./generation.js";

const LARGEUR_NIVEAU = 50; // cases de 32 px
const HAUTEUR_NIVEAU = 34;

const ECHELLE_JOUEUR = 1.25; // taille du joueur (sa hitbox suit) ; 1 = sprite d'origine de 32 px
const VITESSE_JOUEUR = 160; // px/s
const VITESSE_SPRINT = 260; // px/s
const PV_MAX = 100;
const STAMINA_MAX = 100;
const STAMINA_CONSO = 35; // stamina perdue par seconde de sprint
const STAMINA_RECUP = 20; // stamina regagnée par seconde sans sprinter
const MARGE_ECRAN = 40; // px : en duo, la caméra suit le milieu des joueurs et aucun ne peut sortir de l'écran
const ECART_DEPART_JOUEURS = 30; // px : distance minimale entre deux joueurs à leur arrivée
const DISTANCE_MIN_ECHELLE = 200; // px : l'échelle n'est pas cachée juste à coté des joueurs
const DUREE_FONDU = 400; // ms
const NB_CAILLOUX = 14;
const DISTANCE_MIN_CAILLOU = 64; // px : pas de caillou sur un joueur à son arrivée
const COUPS_CAILLOU = 3; // coups de pioche pour casser un caillou
const FRAME_IMPACT_PIOCHE = 2; // frame de l'animation de coup (0 à 3) où la pioche touche : c'est là que le caillou encaisse
const AVANCE_PROFONDEUR_COUP = 20; // px : pendant un coup de côté, le joueur passe devant le caillou pour qu'on voie le fer de la pioche
const PORTEE_FRAPPE = 12; // px : distance entre les pieds du joueur et le centre de la zone de frappe
const TAILLE_ZONE_FRAPPE = 16; // px
const PORTEE_TORCHE = 260; // px : longueur max du cône de lumière
const ANGLE_TORCHE = 60; // degrés : ouverture totale du cône
const NB_RAYONS_TORCHE = 49; // rayons lancés pour que les murs arrêtent la lumière (impair : un rayon au centre)
const MILIEU_RAYONS = (NB_RAYONS_TORCHE - 1) / 2; // indice du rayon central
const DEMI_ANGLE_TORCHE = Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
const PAS_RAYON = 4; // px : précision des rayons
const PENETRATION_MUR = 12; // px : la lumière éclaire un peu la face du mur qu'elle touche
const NB_COUCHES_TORCHE = 12; // cônes superposés, du plus large au plus serré, pour le dégradé
const OPACITE_COUCHE_TORCHE = 0.25; // chaque couche retire 25 % de l'obscurité restante
const VITESSE_ROTATION_TORCHE = 12; // radians/s : le cône rejoint la direction du regard en douceur
const SCINTILLEMENT_TORCHE = 0.04; // variation de portée (+/- 4 %)
// halo autour du joueur : [rayon en px, opacité] ; le dernier cercle rend le perso toujours visible
const HALO_JOUEUR = [[28, 0.15], [14, 1]];
// lumière portée par chaque laser en vol, même principe que le halo du joueur
// elle n'apparait que lorsque le laser est sorti du cône de la torche (sinon la torche l'éclaire déjà)
const HALO_LASER = [[44, 0.15], [28, 0.25], [14, 0.6]];
const FONDU_HALO_LASER = 40; // px : distance sur laquelle le halo apparait en douceur
// le halo commence un peu AVANT la sortie du cône : la lumière y est déjà faible, le laser paraitrait s'éteindre
const AVANCE_HALO_LASER = 60; // px : avant le bout du cône (portée de la torche)
const AVANCE_ANGLE_HALO_LASER = Phaser.Math.DegToRad(8); // avant les bords du cône
const DISTANCE_HALO_LASER = [30, 80]; // px : près du joueur le halo est éteint, il est plein à partir de la 2e valeur
// éclat à l'impact d'un laser (mur ou caillou) : il s'éteint progressivement
const HALO_ECLAT = [[56, 0.2], [32, 0.4], [16, 0.8]];
const DUREE_ECLAT = 150; // ms
const VITESSE_LASER = 500; // px/s
const DUREE_VIE_LASER = 1200; // ms : le laser disparait s'il ne touche rien
const DEPART_LASER = 16; // px : le laser part un peu devant le joueur
const EQUIPEMENTS = ["pioche", "laser"]; // H passe de l'un à l'autre
// variante des sprites du joueur selon l'équipement (cf. VARIANTES_JOUEUR dans selection.js)
const VARIANTE_SPRITE = { pioche: "", laser: "_gun" };

// scene de jeu : elle est relancée à chaque changement de niveau (descente ou montée), avec le numéro du niveau voulu
// l'état de chaque niveau visité est gardé dans this.registry ("niveaux") : on retrouve un niveau tel qu'on l'a laissé
// les joueurs (1 ou 2 selon this.registry "nb_joueurs") sont dans this.joueurs : un objet par joueur, cf. creerJoueur
export default class niveau1 extends Phaser.Scene {
  // constructeur de la classe
  constructor() {
    super({
      key: "niveau1" //  ici on précise le nom de la classe en tant qu'identifiant
    });
  }

  // données transmises par scene.start / scene.restart
  init(data) {
    this.niveau = data.niveau || 1;
    // "haut" : on arrive par l'échelle de montée (on vient de descendre) ; "bas" : on arrive à côté du trou (on vient de remonter)
    this.arrivee = data.arrivee || "haut";
    this.donnees_joueurs = data.joueurs || []; // { pv, stamina, equipement } de chaque joueur, transmis d'un niveau à l'autre
  }

  preload() {
  }

  create() {
    this.changement_niveau = false; // true pendant le fondu vers un autre niveau

    /*************************************
     *  CREATION DE LA MAP (procédurale) *
     *************************************/
    // état du niveau : plan de la grotte, cailloux, trou, échelle de montée (cf. sauvegarderEtat)
    // un niveau déjà visité est reconstruit à l'identique ; un nouveau est généré au hasard
    const niveaux = this.registry.get("niveaux");
    const nouveau = !niveaux[this.niveau];
    if (nouveau) {
      niveaux[this.niveau] = {
        grille: generation.genererGrille(LARGEUR_NIVEAU, HAUTEUR_NIVEAU),
        cailloux: null, // liste { x, y, image, coups_restants, cache_le_trou }, tirée au hasard plus bas
        trou: null, // { x, y } : la descente, sous l'un des cailloux
        trou_revele: false,
        montee: null // { x, y } : l'échelle vers le niveau précédent (aucune au niveau 1)
      };
    }
    this.etat = niveaux[this.niveau];
    // grille[y][x] = true si mur (cf. generation.js), puis on la traduit en tuiles
    const grille = this.etat.grille;
    const map = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: LARGEUR_NIVEAU, height: HAUTEUR_NIVEAU });
    const tileset = map.addTilesetImage("walls_floor", "tiles_walls_floor");
    const calque_sol = map.createBlankLayer("sol", tileset);
    const calque_murs = map.createBlankLayer("murs", tileset);
    grille.forEach((ligne, y) => ligne.forEach((mur, x) => {
      if (mur) calque_murs.putTileAt(generation.tuileMur(grille, x, y), x, y);
      else calque_sol.putTileAt(generation.TUILES.sol, x, y);
    }));
    calque_murs.setCollisionByExclusion([-1]); // toutes les tuiles non vides du calque "murs" sont solides

    /****************************
     *  CREATION DES PERSONNAGES *
     ****************************/
    const nb_joueurs = Math.min(this.registry.get("nb_joueurs") ?? 1, fct.JOUEURS.length);
    const departs = this.choisirDeparts(calque_sol, nouveau, nb_joueurs);
    this.joueurs = fct.JOUEURS.slice(0, nb_joueurs).map((definition, i) =>
      this.creerJoueur(definition, departs[i], this.donnees_joueurs[i] || {})
    );

    // les joueurs ne se bloquent pas entre eux : pas de collision joueur / joueur
    this.joueurs.forEach((j) => this.physics.add.collider(j.sprite, calque_murs));
    this.projectiles = this.physics.add.group();
    this.eclats = []; // éclats de lumière laissés par les lasers qui touchent quelque chose
    this.physics.add.collider(this.projectiles, calque_murs, (projectile) => this.impactLaser(projectile));

    /****************************
     *  CAILLOUX + ECHELLES     *
     ****************************/
    if (!this.etat.cailloux) this.tirerCailloux(calque_sol, calque_murs); // nouveau niveau : positions au hasard
    this.creerCailloux();
    this.joueurs.forEach((j) => this.physics.add.collider(j.sprite, this.cailloux));
    // le laser s'arrête sur les cailloux (seule la pioche les casse)
    this.physics.add.collider(this.projectiles, this.cailloux, (projectile) => this.impactLaser(projectile));
    this.creerEchelles();
    // "1/2" affiché au-dessus d'une échelle quand un seul des deux joueurs est dessus
    this.compteur_echelle = this.add.text(0, 0, "", { fontSize: "20px", color: "#E8EBF0" })
      .setOrigin(0.5, 1)
      .setDepth(fct.PROFONDEUR.projectiles)
      .setVisible(false);

    /****************************
     *  MONDE ET CAMERA         *
     ****************************/
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // la caméra suit le milieu des joueurs (avec un seul joueur : le joueur lui-même)
    this.cible_camera = this.add.zone(0, 0, 1, 1);
    this.placerCible();
    this.cameras.main.startFollow(this.cible_camera);
    this.cameras.main.fadeIn(DUREE_FONDU);

    /****************************
     *  OBSCURITE + TORCHE      *
     ****************************/
    // calque noir fixé à l'écran, au-dessus du jeu mais sous le HUD
    // à chaque image on le remplit de noir puis on y "gomme" la forme de la lumière
    this.obscurite = this.add.renderTexture(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(fct.PROFONDEUR.obscurite);
    this.forme_lumiere = this.make.graphics({}, false); // pas affiché : sert seulement de gomme
    this.calque_murs = calque_murs; // les rayons de lumière s'arrêtent sur ce calque

    /****************************
     *  HUD                     *
     ****************************/
    this.joueurs.forEach((j) => this.creerHud(j));
    this.add.text(this.scale.width / 2, 20, "Niveau " + this.niveau, { fontSize: "28px", color: "#E8EBF0" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(fct.PROFONDEUR.hud);

    this.majLumieres(0); // sinon la première image s'affiche sans obscurité
  }

  // crée un joueur : un objet qui regroupe tout ce qui lui est propre (sprite, touches, vie, outil, torche...)
  creerJoueur(definition, depart, donnees) {
    const j = {
      definition: definition,
      touches: fct.creerTouches(this, definition.touches),
      pv: donnees.pv ?? PV_MAX,
      stamina: donnees.stamina ?? STAMINA_MAX,
      essouffle: false, // stamina vide : il faut relâcher la touche avant de pouvoir re-sprinter
      equipement: donnees.equipement || "pioche",
      regard: new Phaser.Math.Vector2(0, 1), // direction dans laquelle le joueur frappe / tire
      sprite_direction: "down", // dernière direction de marche : sert aussi à l'arrêt, quand on change d'équipement
      sprite_retourne: false, // le joueur regarde-t-il à gauche (sprite de droite retourné) ?
      frappe: null, // coup de pioche en cours : { regard, touche }
      torche_allumee: true,
      angle_torche: Math.PI / 2 // angle affiché du cône, qui rattrape le regard en douceur
    };
    j.sprite = this.physics.add.sprite(depart.x, depart.y, fct.cleSprite(definition, "walk_down" + VARIANTE_SPRITE[j.equipement]));
    j.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation) => {
      if (animation.key.startsWith(fct.cleAnim(definition, "pioche_"))) j.frappe = null; // fin du coup : retour à la marche
    });
    // hitbox réduite aux pieds du personnage (en pixels du sprite d'origine : elle suit l'échelle)
    j.sprite.setSize(12, 6);
    j.sprite.setOffset(10, 25);
    j.sprite.setScale(ECHELLE_JOUEUR);
    j.sprite.setCollideWorldBounds(true);
    return j;
  }

  // HUD d'un joueur : la bulle d'équipement dans un coin haut, puis ses deux barres à côté
  // joueur 1 : coin haut gauche ; joueur 2 : coin haut droit, en miroir
  // la grande bulle (72 px) a la même hauteur que les deux barres empilées (32 + 8 + 32 px)
  creerHud(j) {
    const a_droite = j.definition.numero === 2;
    j.barre_vie = fct.creerBarre(this, 0, 20, "sprite_barre_vie");
    j.barre_stamina = fct.creerBarre(this, 0, 60, "sprite_barre_stamina");
    const x_barres = a_droite ? this.scale.width - 132 - j.barre_vie.displayWidth : 132;
    j.barre_vie.setX(x_barres);
    j.barre_stamina.setX(x_barres);
    // équipement actuel en grand, suivant en petit (en bas de la grande, du côté des barres il s'arrête avant elles)
    const x_bulle = a_droite ? this.scale.width - 56 : 56;
    j.bulles = fct.creerBullesEquipement(this, x_bulle, 56, EQUIPEMENTS, j.equipement, a_droite ? -1 : 1);
  }

  // dessine des cercles concentriques [rayon, opacité] dans la forme de lumière (coordonnées du monde)
  dessinerHalo(x, y, halo, facteur_rayon = 1, facteur_opacite = 1) {
    const camera = this.cameras.main;
    halo.forEach(([rayon, opacite]) => {
      this.forme_lumiere.fillStyle(0xffffff, opacite * facteur_opacite);
      this.forme_lumiere.fillCircle(x - camera.scrollX, y - camera.scrollY, rayon * facteur_rayon);
    });
  }

  // dessine le cône de lumière d'un joueur : plusieurs cônes superposés, du plus large au plus serré
  dessinerCone(cone) {
    const camera = this.cameras.main;
    // couche 0 = cône complet (bords faibles) ... dernière couche = coeur court et serré
    for (let c = 0; c < NB_COUCHES_TORCHE; c++) {
      const progression = c / (NB_COUCHES_TORCHE - 1);
      const portee_couche = cone.portee * Phaser.Math.Linear(1, 0.45, progression);
      const nb_cote = Math.round(MILIEU_RAYONS * Phaser.Math.Linear(1, 0.5, progression)); // rayons gardés de chaque côté

      const points = [new Phaser.Math.Vector2(cone.ox - camera.scrollX, cone.oy - camera.scrollY)];
      for (let i = MILIEU_RAYONS - nb_cote; i <= MILIEU_RAYONS + nb_cote; i++) {
        const angle = cone.angle + ((i - MILIEU_RAYONS) / MILIEU_RAYONS) * DEMI_ANGLE_TORCHE;
        const distance = Math.min(cone.distances[i], portee_couche);
        points.push(new Phaser.Math.Vector2(
          cone.ox + Math.cos(angle) * distance - camera.scrollX,
          cone.oy + Math.sin(angle) * distance - camera.scrollY
        ));
      }
      this.forme_lumiere.fillStyle(0xffffff, OPACITE_COUCHE_TORCHE);
      this.forme_lumiere.fillPoints(points, true);
    }
  }

  // redessine l'obscurité : noir partout sauf les sources de lumière (joueurs, torches, lasers, éclats)
  // chaque forme "gomme" une partie de l'obscurité : en les superposant on obtient un dégradé
  majLumieres(secondes) {
    const forme = this.forme_lumiere;
    forme.clear();

    // scintillement : petite variation douce (deux sinus de fréquences différentes)
    const t = this.time.now;
    const scintillement = 1 + SCINTILLEMENT_TORCHE * (Math.sin(t * 0.011) + 0.6 * Math.sin(t * 0.029)) / 1.6;

    this.joueurs.forEach((j) => this.dessinerHalo(j.sprite.x, j.sprite.y, HALO_JOUEUR, scintillement));

    // éclats d'impact : ils faiblissent jusqu'à disparaître
    this.eclats = this.eclats.filter((eclat) => t < eclat.fin);
    this.eclats.forEach((eclat) => {
      const restant = (eclat.fin - t) / DUREE_ECLAT; // 1 -> 0
      this.dessinerHalo(eclat.x, eclat.y, HALO_ECLAT, 1, restant);
    });

    // cône de chaque joueur : la lumière part des pieds (la hitbox), elle n'est donc jamais dans un mur
    const portee = PORTEE_TORCHE * scintillement;
    const cones = this.joueurs.map((j) => {
      const cone = { ox: j.sprite.body.center.x, oy: j.sprite.body.center.y, portee: portee, angle: j.angle_torche, distances: null };
      if (j.torche_allumee) { // distances reste null tant que la torche est éteinte
        // rotation fluide vers la direction du regard
        j.angle_torche = Phaser.Math.Angle.RotateTo(j.angle_torche, j.regard.angle(), VITESSE_ROTATION_TORCHE * secondes);
        cone.angle = j.angle_torche;
        cone.distances = this.lancerRayons(cone.ox, cone.oy, portee, cone.angle);
        this.dessinerCone(cone);
      }
      return cone;
    });

    // chaque laser en vol éclaire autour de lui, une fois sorti de la lumière de la torche (de tous les joueurs)
    this.projectiles.getChildren().forEach((laser) => {
      const facteur = Math.min(...cones.map((cone) => this.facteurHaloLaser(laser, cone)));
      if (facteur > 0) this.dessinerHalo(laser.x, laser.y, HALO_LASER, 1, facteur);
    });

    this.obscurite.fill(0x000000);
    this.obscurite.erase(forme);
  }

  // force du halo d'un laser par rapport à la torche d'un joueur, de 0 à 1 :
  // 0 quand le laser est dans le cône ou collé au joueur, 1 quand il en est sorti (transition douce)
  facteurHaloLaser(laser, cone) {
    const distance_joueur = Phaser.Math.Distance.Between(cone.ox, cone.oy, laser.x, laser.y);

    // tout près du joueur, le halo du laser se confondrait avec celui du joueur
    const [debut, fin] = DISTANCE_HALO_LASER;
    let facteur = Phaser.Math.Clamp((distance_joueur - debut) / (fin - debut), 0, 1);

    if (cone.distances) { // torche allumée : y a-t-il encore de la lumière à cet endroit ?
      const ecart = Phaser.Math.Angle.Wrap(Math.atan2(laser.y - cone.oy, laser.x - cone.ox) - cone.angle);
      const rayon = cone.distances[Math.round(MILIEU_RAYONS + Phaser.Math.Clamp(ecart / DEMI_ANGLE_TORCHE, -1, 1) * MILIEU_RAYONS)];
      const hors_cote = (Math.abs(ecart) - DEMI_ANGLE_TORCHE + AVANCE_ANGLE_HALO_LASER) * distance_joueur; // px, > 0 : à côté du cône
      // > 0 : au-delà de la portée ou d'un mur ; l'avance ne vaut que pour la portée (un mur est éclairé jusqu'au bout)
      const avance = rayon < cone.portee ? 0 : AVANCE_HALO_LASER;
      const hors_bout = distance_joueur - Math.min(rayon, cone.portee) + avance;
      facteur *= Phaser.Math.Clamp(Math.max(hors_cote, hors_bout) / FONDU_HALO_LASER, 0, 1);
    }
    return facteur;
  }

  // lance NB_RAYONS_TORCHE rayons en éventail autour de l'angle donné
  // renvoie, pour chacun, la distance parcourue avant un mur
  lancerRayons(ox, oy, portee, angle_central) {
    const distances = [];
    for (let i = 0; i < NB_RAYONS_TORCHE; i++) {
      const angle = angle_central + ((i - MILIEU_RAYONS) / MILIEU_RAYONS) * DEMI_ANGLE_TORCHE;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let distance = 0;
      while (distance < portee && !this.calque_murs.hasTileAtWorldXY(ox + dx * distance, oy + dy * distance)) {
        distance += PAS_RAYON;
      }
      distances.push(Math.min(distance + PENETRATION_MUR, portee));
    }
    return distances;
  }

  // points de départ des joueurs, en coordonnées du monde (un par joueur)
  // - tout premier niveau : une case de sol au hasard, les joueurs l'un à côté de l'autre
  // - sinon : à côté (pas dessus : on ne repart pas aussitôt) de l'échelle par laquelle on arrive,
  //   c'est-à-dire l'échelle de montée si on descend, ou le trou si on remonte
  choisirDeparts(calque_sol, nouveau, nb_joueurs) {
    const cases_sol = calque_sol.filterTiles((tuile) => tuile.index !== -1);
    const centre = (tuile) => ({ x: tuile.getCenterX(), y: tuile.getCenterY() });
    const distance = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

    let origine;
    const premier_depart = nouveau && this.niveau === 1; // pas d'échelle : le premier joueur se place sur l'origine
    if (premier_depart) {
      origine = centre(Phaser.Utils.Array.GetRandom(cases_sol));
    } else {
      if (nouveau) this.etat.montee = centre(Phaser.Utils.Array.GetRandom(cases_sol)); // l'échelle de montée est là où on arrive
      origine = this.arrivee === "bas" ? this.etat.trou : this.etat.montee;
    }

    const cailloux = this.etat.cailloux || []; // vide dans un niveau tout neuf : ils sont tirés après le départ
    const candidats = cases_sol.map(centre)
      .filter((case_sol) => distance(case_sol, origine) <= 100 && (premier_depart || distance(case_sol, origine) >= 32))
      .filter((case_sol) => cailloux.every((caillou) => distance(case_sol, caillou) >= 40))
      .sort((a, b) => distance(a, origine) - distance(b, origine));

    // les cases libres les plus proches de l'origine, assez éloignées les unes des autres
    const departs = [];
    candidats.forEach((candidat) => {
      if (departs.length < nb_joueurs && departs.every((depart) => distance(candidat, depart) >= ECART_DEPART_JOUEURS)) {
        departs.push(candidat);
      }
    });
    while (departs.length < nb_joueurs) departs.push(origine); // secours : aucune case libre
    return departs;
  }

  // distance du point (x, y) au joueur le plus proche
  distanceAuxJoueurs(x, y) {
    return Math.min(...this.joueurs.map((j) => Phaser.Math.Distance.Between(x, y, j.sprite.x, j.sprite.y)));
  }

  // tire NB_CAILLOUX cailloux sur des cases de sol libres (sans mur), et choisit celui qui cache le trou
  tirerCailloux(calque_sol, calque_murs) {
    const cases_libres = calque_sol.filterTiles((tuile) =>
      !calque_murs.hasTileAt(tuile.x, tuile.y) &&
      this.distanceAuxJoueurs(tuile.getCenterX(), tuile.getCenterY()) >= DISTANCE_MIN_CAILLOU
    );
    Phaser.Utils.Array.Shuffle(cases_libres);
    this.etat.cailloux = cases_libres.slice(0, NB_CAILLOUX).map((tuile) => ({
      x: tuile.getCenterX(),
      y: tuile.getCenterY(),
      image: Phaser.Utils.Array.GetRandom(["img_caillou_1", "img_caillou_2"]),
      coups_restants: COUPS_CAILLOU,
      cache_le_trou: false
    }));

    // le trou est caché sous l'un des cailloux, loin des joueurs si possible
    const loin = this.etat.cailloux.filter((caillou) => this.distanceAuxJoueurs(caillou.x, caillou.y) >= DISTANCE_MIN_ECHELLE);
    const choisi = Phaser.Utils.Array.GetRandom(loin.length > 0 ? loin : this.etat.cailloux);
    choisi.cache_le_trou = true;
    this.etat.trou = { x: choisi.x, y: choisi.y };
  }

  // crée les cailloux à partir de l'état du niveau
  creerCailloux() {
    this.cailloux = this.physics.add.staticGroup();
    this.etat.cailloux.forEach((donnees) => {
      const caillou = this.cailloux.create(donnees.x, donnees.y, donnees.image);
      // hitbox sur le bas du caillou : le joueur peut passer derrière le haut
      caillou.body.setSize(24, 14);
      caillou.body.setOffset(4, 16);
      caillou.setDepth(caillou.y); // tri d'affichage vue de dessus : plus bas = devant
      caillou.coups_restants = donnees.coups_restants;
      if (donnees.cache_le_trou) this.caillou_trou = caillou;
    });
  }

  // le trou (descente) est sous son caillou, invisible tant que celui-ci n'est pas cassé ;
  // l'échelle de montée existe à partir du niveau 2
  creerEchelles() {
    // objets posés au sol : au-dessus de la carte, sous les joueurs et les cailloux (dont la profondeur est leur y)
    this.trou = this.physics.add.staticSprite(this.etat.trou.x, this.etat.trou.y, "img_trou").setDepth(1);
    this.trou.body.setSize(16, 16); // il faut vraiment marcher dessus, pas juste la frôler
    this.trou.setVisible(this.etat.trou_revele);

    this.echelle_montee = null;
    if (this.etat.montee) {
      this.echelle_montee = this.physics.add.staticSprite(this.etat.montee.x, this.etat.montee.y, "img_echelle").setDepth(1);
      this.echelle_montee.body.setSize(16, 16);
    }
  }

  // la caméra suit le milieu des joueurs
  placerCible() {
    const n = this.joueurs.length;
    const x = this.joueurs.reduce((somme, j) => somme + j.sprite.x, 0) / n;
    const y = this.joueurs.reduce((somme, j) => somme + j.sprite.y, 0) / n;
    this.cible_camera.setPosition(x, y);
  }

  // en duo, aucun joueur ne peut sortir de l'écran : on le retient (ou on l'entraine avec la caméra) à la marge près
  limiterAEcran() {
    if (this.joueurs.length < 2) return;
    const vue = this.cameras.main.worldView;
    if (vue.width <= 2 * MARGE_ECRAN) return; // la caméra n'a pas encore calculé sa vue (toute première image)
    this.joueurs.forEach((j) => {
      j.sprite.x = Phaser.Math.Clamp(j.sprite.x, vue.left + MARGE_ECRAN, vue.right - MARGE_ECRAN);
      j.sprite.y = Phaser.Math.Clamp(j.sprite.y, vue.top + MARGE_ECRAN, vue.bottom - MARGE_ECRAN);
    });
  }

  // passe à l'équipement suivant de la liste EQUIPEMENTS
  changerEquipement(j) {
    const suivant = (EQUIPEMENTS.indexOf(j.equipement) + 1) % EQUIPEMENTS.length;
    j.equipement = EQUIPEMENTS[suivant];
    j.bulles.changer(j.equipement);
    j.frappe = null; // changer d'outil annule un coup de pioche en cours
  }

  // tir de laser dans la direction du regard (8 directions), de la couleur du joueur
  tirer(j) {
    const couleur = j.definition.laser;
    const projectile = this.projectiles.create(
      j.sprite.x + j.regard.x * DEPART_LASER,
      j.sprite.y + j.regard.y * DEPART_LASER,
      "sprite_laser_" + couleur
    );
    projectile.anims.play("anim_laser_" + couleur);
    projectile.setRotation(j.regard.angle()); // l'image pointe vers la droite (angle 0)
    // la hitbox ne tourne pas avec l'image : on prend un petit carré centré, valable dans toutes les directions
    projectile.body.setSize(8, 8);
    projectile.setDepth(fct.PROFONDEUR.projectiles); // au-dessus du décor, sous l'obscurité
    projectile.setVelocity(j.regard.x * VITESSE_LASER, j.regard.y * VITESSE_LASER);
    this.time.delayedCall(DUREE_VIE_LASER, () => projectile.destroy());
  }

  // le laser touche un mur ou un caillou : il laisse un éclat de lumière puis disparait
  impactLaser(projectile) {
    this.eclats.push({ x: projectile.x, y: projectile.y, fin: this.time.now + DUREE_ECLAT });
    projectile.destroy();
  }

  // lance l'animation du coup de pioche ; le caillou n'encaisse qu'à la frame d'impact (cf. majJoueur)
  commencerFrappe(j) {
    if (j.frappe) return; // un coup à la fois : on attend la fin de l'animation
    const regard = j.regard.clone(); // direction figée : le joueur peut bouger pendant le coup
    // 3 sprites de coup : bas, haut et droite (retournée pour la gauche ; les diagonales prennent la droite)
    if (Math.abs(regard.x) < 0.1) j.sprite_direction = regard.y < 0 ? "up" : "down";
    else j.sprite_direction = "right";
    j.sprite_retourne = regard.x < 0;
    j.sprite.setFlipX(j.sprite_retourne);
    j.sprite.anims.play(fct.cleAnim(j.definition, "pioche_" + j.sprite_direction));
    j.frappe = { regard: regard, touche: false };
  }

  // coup de pioche sur le caillou situé devant le joueur, dans la direction donnée
  frapper(j, regard) {
    // zone de frappe carrée, décalée devant les pieds du joueur
    const zone = new Phaser.Geom.Rectangle(0, 0, TAILLE_ZONE_FRAPPE, TAILLE_ZONE_FRAPPE);
    Phaser.Geom.Rectangle.CenterOn(zone,
      j.sprite.body.center.x + regard.x * PORTEE_FRAPPE,
      j.sprite.body.center.y + regard.y * PORTEE_FRAPPE
    );
    const caillou = this.cailloux.getChildren().find((c) =>
      Phaser.Geom.Intersects.RectangleToRectangle(zone, new Phaser.Geom.Rectangle(c.body.x, c.body.y, c.body.width, c.body.height))
    );
    if (!caillou) return;

    caillou.coups_restants--;
    if (caillou.coups_restants > 0) {
      // petit tremblement pour montrer que le coup a porté
      this.tweens.add({ targets: caillou, x: caillou.x + 2, duration: 40, yoyo: true, repeat: 1 });
      return;
    }

    if (caillou === this.caillou_trou) this.trou.setVisible(true);
    caillou.destroy();
  }

  // recopie dans l'état du niveau ce qui a changé depuis qu'on y est : cailloux restants (et leurs coups), trou révélé
  sauvegarderEtat() {
    this.etat.cailloux = this.cailloux.getChildren().map((caillou) => ({
      x: caillou.x,
      y: caillou.y,
      image: caillou.texture.key,
      coups_restants: caillou.coups_restants,
      cache_le_trou: caillou === this.caillou_trou
    }));
    this.etat.trou_revele = this.trou.visible;
  }

  // fondu au noir, sauvegarde du niveau, puis relance de la scene sur le niveau voulu
  // arrivee : "haut" quand on descend, "bas" quand on remonte (cf. init)
  changerDeNiveau(niveau, arrivee) {
    this.changement_niveau = true;
    this.joueurs.forEach((j) => {
      j.sprite.setVelocity(0, 0);
      j.sprite.anims.stop();
    });
    this.sauvegarderEtat();
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.restart({
        niveau: niveau,
        arrivee: arrivee,
        joueurs: this.joueurs.map((j) => ({ pv: j.pv, stamina: j.stamina, equipement: j.equipement }))
      });
    });
  }

  // déplacement, actions et animation d'un joueur, selon ses touches
  majJoueur(j, secondes) {
    const touches = j.touches;
    let vx = 0;
    let vy = 0;
    if (touches.gauche.isDown) vx = -1;
    else if (touches.droite.isDown) vx = 1;
    if (touches.haut.isDown) vy = -1;
    else if (touches.bas.isDown) vy = 1;
    const bouge = vx !== 0 || vy !== 0;

    // stamina vide : il faut relâcher la touche avant de pouvoir re-sprinter
    if (touches.sprint.isUp) j.essouffle = false;

    // sprint : seulement si on bouge et qu'il reste de la stamina
    const sprint = touches.sprint.isDown && bouge && !j.essouffle;
    if (sprint) {
      j.stamina = Math.max(j.stamina - STAMINA_CONSO * secondes, 0);
      if (j.stamina === 0) j.essouffle = true;
    } else {
      j.stamina = Math.min(j.stamina + STAMINA_RECUP * secondes, STAMINA_MAX);
    }

    // normalisation : on ne va pas plus vite en diagonale
    j.sprite.body.velocity.set(vx, vy).normalize().scale(sprint ? VITESSE_SPRINT : VITESSE_JOUEUR);

    if (bouge) j.regard.set(vx, vy).normalize();
    if (Phaser.Input.Keyboard.JustDown(touches.changer_equipement)) this.changerEquipement(j);
    // F (pour le joueur 1) : l'action dépend de l'outil équipé
    if (Phaser.Input.Keyboard.JustDown(touches.frapper_tirer)) {
      if (j.equipement === "pioche") this.commencerFrappe(j);
      else this.tirer(j);
    }
    if (Phaser.Input.Keyboard.JustDown(touches.torche)) j.torche_allumee = !j.torche_allumee;

    // animation : la gauche est la droite retournée ; le joueur tient le fusil ou non selon l'équipement
    const variante = VARIANTE_SPRITE[j.equipement];
    if (j.frappe) {
      // coup de pioche en cours : son animation remplace celle de marche, l'impact a lieu à la frame FRAME_IMPACT_PIOCHE
      if (!j.frappe.touche && j.sprite.anims.currentFrame.textureFrame >= FRAME_IMPACT_PIOCHE) {
        j.frappe.touche = true;
        this.frapper(j, j.frappe.regard);
      }
    } else if (bouge) {
      if (vx === 0) j.sprite_direction = vy < 0 ? "up" : "down";
      else if (vy === 0) j.sprite_direction = "right";
      else j.sprite_direction = vy < 0 ? "up_diagonal" : "down_diagonal";
      j.sprite_retourne = vx < 0;
      j.sprite.setFlipX(j.sprite_retourne);
      j.sprite.anims.play(fct.cleAnim(j.definition, "walk_" + j.sprite_direction + variante), true);
    } else {
      // pas d'animation idle : on s'arrête sur la première frame (de la bonne variante si l'équipement vient de changer)
      j.sprite.anims.stop();
      j.sprite.setFlipX(j.sprite_retourne);
      j.sprite.setTexture(fct.cleSprite(j.definition, "walk_" + j.sprite_direction + variante), 0);
    }
    // même tri d'affichage que les cailloux (plus bas = devant), avec une avance pour les coups de côté
    const avance = j.frappe && j.sprite_direction === "right" ? AVANCE_PROFONDEUR_COUP : 0;
    j.sprite.setDepth(j.sprite.y + avance);

    fct.majBarre(j.barre_vie, j.pv, PV_MAX);
    fct.majBarre(j.barre_stamina, j.stamina, STAMINA_MAX);
  }

  update(time, delta) {
    if (this.changement_niveau) return;

    const secondes = delta / 1000;
    this.joueurs.forEach((j) => this.majJoueur(j, secondes));
    this.placerCible();
    this.limiterAEcran();
    this.majLumieres(secondes);

    // changement de niveau : tous les joueurs doivent être sur l'échelle (le trou ou l'échelle de montée)
    // tant qu'un seul des deux y est, on affiche "1/2" au-dessus
    const passages = [
      { objet: this.trou.visible ? this.trou : null, niveau: this.niveau + 1, arrivee: "haut" },
      { objet: this.echelle_montee, niveau: this.niveau - 1, arrivee: "bas" }
    ];
    let partiel = null;
    for (const passage of passages) {
      if (!passage.objet) continue;
      const nb_dessus = this.joueurs.filter((j) => this.physics.overlap(j.sprite, passage.objet)).length;
      if (nb_dessus === this.joueurs.length) {
        this.changerDeNiveau(passage.niveau, passage.arrivee);
        return;
      }
      if (nb_dessus > 0) partiel = { objet: passage.objet, nb_dessus: nb_dessus };
    }
    this.compteur_echelle.setVisible(partiel !== null);
    if (partiel) {
      this.compteur_echelle.setText(partiel.nb_dessus + "/" + this.joueurs.length);
      this.compteur_echelle.setPosition(partiel.objet.x, partiel.objet.y - 20);
    }
  }
}
