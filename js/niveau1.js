import * as fct from "./fonctions.js";
import * as generation from "./generation.js";

const LARGEUR_NIVEAU = 50; // cases de 32 px
const HAUTEUR_NIVEAU = 34;

const VITESSE_JOUEUR = 160; // px/s
const VITESSE_SPRINT = 260; // px/s
const PV_MAX = 100;
const STAMINA_MAX = 100;
const STAMINA_CONSO = 35; // stamina perdue par seconde de sprint
const STAMINA_RECUP = 20; // stamina regagnée par seconde sans sprinter
const DISTANCE_MIN_ECHELLE = 200; // px : l'échelle n'est pas cachée juste à coté du joueur
const DUREE_FONDU = 400; // ms
const NB_CAILLOUX = 14;
const DISTANCE_MIN_CAILLOU = 64; // px : pas de caillou sur le joueur à son arrivée
const COUPS_CAILLOU = 3; // coups de pioche pour casser un caillou
const PORTEE_FRAPPE = 12; // px : distance entre les pieds du joueur et le centre de la zone de frappe
const TAILLE_ZONE_FRAPPE = 16; // px
const PORTEE_TORCHE = 260; // px : longueur max du cône de lumière
const ANGLE_TORCHE = 60; // degrés : ouverture totale du cône
const NB_RAYONS_TORCHE = 49; // rayons lancés pour que les murs arrêtent la lumière (impair : un rayon au centre)
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

// scene de jeu : elle est relancée à chaque descente, avec le numéro du niveau suivant
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
    this.pv_depart = data.pv ?? PV_MAX;
    this.stamina_depart = data.stamina ?? STAMINA_MAX;
    this.equipement_depart = data.equipement || "pioche";
  }

  preload() {
  }

  create() {
    this.descente = false; // true pendant le fondu vers le niveau suivant

    /*************************************
     *  CREATION DE LA MAP (procédurale) *
     *************************************/
    // grille[y][x] = true si mur (cf. generation.js), puis on la traduit en tuiles
    const grille = generation.genererGrille(LARGEUR_NIVEAU, HAUTEUR_NIVEAU);
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
     *  CREATION DU PERSONNAGE  *
     ****************************/
    // départ sur une case de sol au hasard
    const depart = Phaser.Utils.Array.GetRandom(calque_sol.filterTiles((tuile) => tuile.index !== -1));
    this.player = this.physics.add.sprite(depart.getCenterX(), depart.getCenterY(), "sprite_joueur_walk_down");
    // hitbox réduite aux pieds du personnage
    this.player.setSize(12, 6);
    this.player.setOffset(10, 25);
    this.player.setCollideWorldBounds(true);
    this.player.pv = this.pv_depart;
    this.player.stamina = this.stamina_depart;
    this.player.equipement = this.equipement_depart;
    this.regard = new Phaser.Math.Vector2(0, 1); // direction dans laquelle le joueur frappe / tire

    this.physics.add.collider(this.player, calque_murs);
    this.projectiles = this.physics.add.group();
    this.eclats = []; // éclats de lumière laissés par les lasers qui touchent quelque chose
    this.physics.add.collider(this.projectiles, calque_murs, (projectile) => this.impactLaser(projectile));

    /****************************
     *  CAILLOUX + ECHELLE      *
     ****************************/
    this.placerCailloux(calque_sol, calque_murs);
    this.physics.add.collider(this.player, this.cailloux);
    // le laser s'arrête sur les cailloux (seule la pioche les casse)
    this.physics.add.collider(this.projectiles, this.cailloux, (projectile) => this.impactLaser(projectile));
    this.cacherEchelle();

    /****************************
     *  MONDE ET CAMERA         *
     ****************************/
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
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
    this.torche_allumee = true;
    this.angle_torche = this.regard.angle(); // angle affiché, qui rattrape le regard en douceur
    this.calque_murs = calque_murs; // les rayons de lumière s'arrêtent sur ce calque

    /****************************
     *  HUD                     *
     ****************************/
    this.barre_vie = fct.creerBarre(this, 20, 20, "sprite_barre_vie");
    this.barre_stamina = fct.creerBarre(this, 20, 60, "sprite_barre_stamina");
    this.add.text(1260, 20, "Niveau " + this.niveau, { fontSize: "28px", color: "#E8EBF0" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(fct.PROFONDEUR.hud);
    this.texte_equipement = this.add.text(20, 100, "", { fontSize: "22px", color: "#E8EBF0" })
      .setScrollFactor(0)
      .setDepth(fct.PROFONDEUR.hud);
    this.majTexteEquipement();

    /****************************
     *  COMMANDES               *
     ****************************/
    this.touches = fct.creerTouches(this, fct.TOUCHES_J1);

    this.majLumieres(0); // sinon la première image s'affiche sans obscurité
  }

  // dessine des cercles concentriques [rayon, opacité] dans la forme de lumière (coordonnées du monde)
  dessinerHalo(x, y, halo, facteur_rayon = 1, facteur_opacite = 1) {
    const camera = this.cameras.main;
    halo.forEach(([rayon, opacite]) => {
      this.forme_lumiere.fillStyle(0xffffff, opacite * facteur_opacite);
      this.forme_lumiere.fillCircle(x - camera.scrollX, y - camera.scrollY, rayon * facteur_rayon);
    });
  }

  // redessine l'obscurité : noir partout sauf les sources de lumière (joueur, torche, lasers, éclats)
  // chaque forme "gomme" une partie de l'obscurité : en les superposant on obtient un dégradé
  majLumieres(secondes) {
    // le calque est fixé à l'écran : on passe des coordonnées du monde à celles de l'écran
    const camera = this.cameras.main;
    const forme = this.forme_lumiere;
    forme.clear();

    // scintillement : petite variation douce (deux sinus de fréquences différentes)
    const t = this.time.now;
    const scintillement = 1 + SCINTILLEMENT_TORCHE * (Math.sin(t * 0.011) + 0.6 * Math.sin(t * 0.029)) / 1.6;

    this.dessinerHalo(this.player.x, this.player.y, HALO_JOUEUR, scintillement);

    // éclats d'impact : ils faiblissent jusqu'à disparaître
    this.eclats = this.eclats.filter((eclat) => t < eclat.fin);
    this.eclats.forEach((eclat) => {
      const restant = (eclat.fin - t) / DUREE_ECLAT; // 1 -> 0
      this.dessinerHalo(eclat.x, eclat.y, HALO_ECLAT, 1, restant);
    });

    // la lumière part des pieds : c'est la hitbox, elle n'est donc jamais dans un mur
    const ox = this.player.body.center.x;
    const oy = this.player.body.center.y;
    const portee = PORTEE_TORCHE * scintillement;
    const milieu = (NB_RAYONS_TORCHE - 1) / 2;
    const demi_angle = Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
    let distances = null; // longueur de chaque rayon du cône : reste null tant que la torche est éteinte

    if (this.torche_allumee) {
      // rotation fluide vers la direction du regard
      this.angle_torche = Phaser.Math.Angle.RotateTo(this.angle_torche, this.regard.angle(), VITESSE_ROTATION_TORCHE * secondes);
      distances = this.lancerRayons(ox, oy, portee);

      // couche 0 = cône complet (bords faibles) ... dernière couche = coeur court et serré
      for (let c = 0; c < NB_COUCHES_TORCHE; c++) {
        const progression = c / (NB_COUCHES_TORCHE - 1);
        const portee_couche = portee * Phaser.Math.Linear(1, 0.45, progression);
        const nb_cote = Math.round(milieu * Phaser.Math.Linear(1, 0.5, progression)); // rayons gardés de chaque côté

        const points = [new Phaser.Math.Vector2(ox - camera.scrollX, oy - camera.scrollY)];
        for (let i = milieu - nb_cote; i <= milieu + nb_cote; i++) {
          const angle = this.angle_torche + ((i - milieu) / milieu) * demi_angle;
          const distance = Math.min(distances[i], portee_couche);
          points.push(new Phaser.Math.Vector2(
            ox + Math.cos(angle) * distance - camera.scrollX,
            oy + Math.sin(angle) * distance - camera.scrollY
          ));
        }
        forme.fillStyle(0xffffff, OPACITE_COUCHE_TORCHE);
        forme.fillPoints(points, true);
      }
    }

    // chaque laser en vol éclaire autour de lui, une fois sorti de la lumière de la torche
    this.projectiles.getChildren().forEach((laser) => {
      const facteur = this.facteurHaloLaser(laser, ox, oy, distances, portee, milieu, demi_angle);
      if (facteur > 0) this.dessinerHalo(laser.x, laser.y, HALO_LASER, 1, facteur);
    });

    this.obscurite.fill(0x000000);
    this.obscurite.erase(forme);
  }

  // force du halo d'un laser, de 0 à 1 :
  // 0 quand le laser est dans le cône de la torche ou collé au joueur, 1 quand il en est sorti (transition douce)
  facteurHaloLaser(laser, ox, oy, distances, portee, milieu, demi_angle) {
    const distance_joueur = Phaser.Math.Distance.Between(ox, oy, laser.x, laser.y);

    // tout près du joueur, le halo du laser se confondrait avec celui du joueur
    const [debut, fin] = DISTANCE_HALO_LASER;
    let facteur = Phaser.Math.Clamp((distance_joueur - debut) / (fin - debut), 0, 1);

    if (distances) { // torche allumée : y a-t-il encore de la lumière à cet endroit ?
      const ecart = Phaser.Math.Angle.Wrap(Math.atan2(laser.y - oy, laser.x - ox) - this.angle_torche);
      const rayon = distances[Math.round(milieu + Phaser.Math.Clamp(ecart / demi_angle, -1, 1) * milieu)];
      const hors_cote = (Math.abs(ecart) - demi_angle + AVANCE_ANGLE_HALO_LASER) * distance_joueur; // px, > 0 : à côté du cône
      // > 0 : au-delà de la portée ou d'un mur ; l'avance ne vaut que pour la portée (un mur est éclairé jusqu'au bout)
      const avance = rayon < portee ? 0 : AVANCE_HALO_LASER;
      const hors_bout = distance_joueur - Math.min(rayon, portee) + avance;
      facteur *= Phaser.Math.Clamp(Math.max(hors_cote, hors_bout) / FONDU_HALO_LASER, 0, 1);
    }
    return facteur;
  }

  // lance NB_RAYONS_TORCHE rayons en éventail et renvoie, pour chacun, la distance parcourue avant un mur
  lancerRayons(ox, oy, portee) {
    const milieu = (NB_RAYONS_TORCHE - 1) / 2;
    const demi_angle = Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
    const distances = [];
    for (let i = 0; i < NB_RAYONS_TORCHE; i++) {
      const angle = this.angle_torche + ((i - milieu) / milieu) * demi_angle;
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

  // pose NB_CAILLOUX cailloux sur des cases de sol libres (sans mur), tirées au hasard
  placerCailloux(calque_sol, calque_murs) {
    const cases_libres = calque_sol.filterTiles((tuile) =>
      !calque_murs.hasTileAt(tuile.x, tuile.y) &&
      Phaser.Math.Distance.Between(tuile.getCenterX(), tuile.getCenterY(), this.player.x, this.player.y) >= DISTANCE_MIN_CAILLOU
    );
    Phaser.Utils.Array.Shuffle(cases_libres);

    this.cailloux = this.physics.add.staticGroup();
    cases_libres.slice(0, NB_CAILLOUX).forEach((tuile) => {
      const image = Phaser.Utils.Array.GetRandom(["img_caillou_1", "img_caillou_2"]);
      const caillou = this.cailloux.create(tuile.getCenterX(), tuile.getCenterY(), image);
      // hitbox sur le bas du caillou : le joueur peut passer derrière le haut
      caillou.body.setSize(24, 14);
      caillou.body.setOffset(4, 16);
      caillou.setDepth(caillou.y); // tri d'affichage vue de dessus : plus bas = devant
      caillou.coups_restants = COUPS_CAILLOU;
    });
  }

  // l'échelle est posée sous un caillou (loin du joueur si possible) et reste invisible tant qu'il n'est pas cassé
  cacherEchelle() {
    const loin = this.cailloux.getChildren().filter((caillou) =>
      Phaser.Math.Distance.Between(caillou.x, caillou.y, this.player.x, this.player.y) >= DISTANCE_MIN_ECHELLE
    );
    this.caillou_echelle = Phaser.Utils.Array.GetRandom(loin.length > 0 ? loin : this.cailloux.getChildren());

    this.echelle = this.physics.add.staticSprite(this.caillou_echelle.x, this.caillou_echelle.y, "img_echelle");
    this.echelle.body.setSize(16, 16); // il faut vraiment marcher dessus, pas juste la frôler
    this.echelle.setVisible(false);
  }

  majTexteEquipement() {
    this.texte_equipement.setText("Outil : " + this.player.equipement + " (H)");
  }

  // passe à l'équipement suivant de la liste EQUIPEMENTS
  changerEquipement() {
    const suivant = (EQUIPEMENTS.indexOf(this.player.equipement) + 1) % EQUIPEMENTS.length;
    this.player.equipement = EQUIPEMENTS[suivant];
    this.majTexteEquipement();
  }

  // tir de laser dans la direction du regard (8 directions)
  tirer() {
    const projectile = this.projectiles.create(
      this.player.x + this.regard.x * DEPART_LASER,
      this.player.y + this.regard.y * DEPART_LASER,
      "sprite_laser_bleu"
    );
    projectile.anims.play("anim_laser_bleu");
    projectile.setRotation(this.regard.angle()); // l'image pointe vers la droite (angle 0)
    // la hitbox ne tourne pas avec l'image : on prend un petit carré centré, valable dans toutes les directions
    projectile.body.setSize(8, 8);
    projectile.setDepth(fct.PROFONDEUR.projectiles); // au-dessus du décor, sous l'obscurité
    projectile.setVelocity(this.regard.x * VITESSE_LASER, this.regard.y * VITESSE_LASER);
    this.time.delayedCall(DUREE_VIE_LASER, () => projectile.destroy());
  }

  // le laser touche un mur ou un caillou : il laisse un éclat de lumière puis disparait
  impactLaser(projectile) {
    this.eclats.push({ x: projectile.x, y: projectile.y, fin: this.time.now + DUREE_ECLAT });
    projectile.destroy();
  }

  // coup de pioche sur le caillou juste devant le joueur
  frapper() {
    // zone de frappe carrée, décalée devant les pieds du joueur
    const zone = new Phaser.Geom.Rectangle(0, 0, TAILLE_ZONE_FRAPPE, TAILLE_ZONE_FRAPPE);
    Phaser.Geom.Rectangle.CenterOn(zone,
      this.player.body.center.x + this.regard.x * PORTEE_FRAPPE,
      this.player.body.center.y + this.regard.y * PORTEE_FRAPPE
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

    if (caillou === this.caillou_echelle) this.echelle.setVisible(true);
    caillou.destroy();
  }

  // fondu au noir puis relance de la scene avec le niveau suivant
  descendre() {
    this.descente = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.restart({
        niveau: this.niveau + 1,
        pv: this.player.pv,
        stamina: this.player.stamina,
        equipement: this.player.equipement
      });
    });
  }

  update(time, delta) {
    if (this.descente) return;

    const secondes = delta / 1000;

    let vx = 0;
    let vy = 0;
    if (this.touches.gauche.isDown) vx = -1;
    else if (this.touches.droite.isDown) vx = 1;
    if (this.touches.haut.isDown) vy = -1;
    else if (this.touches.bas.isDown) vy = 1;
    const bouge = vx !== 0 || vy !== 0;

    // stamina vide : il faut relâcher la touche avant de pouvoir re-sprinter
    if (this.touches.sprint.isUp) this.player.essouffle = false;

    // sprint : seulement si on bouge et qu'il reste de la stamina
    const sprint = this.touches.sprint.isDown && bouge && !this.player.essouffle;
    if (sprint) {
      this.player.stamina = Math.max(this.player.stamina - STAMINA_CONSO * secondes, 0);
      if (this.player.stamina === 0) this.player.essouffle = true;
    } else {
      this.player.stamina = Math.min(this.player.stamina + STAMINA_RECUP * secondes, STAMINA_MAX);
    }

    // normalisation : on ne va pas plus vite en diagonale
    this.player.body.velocity.set(vx, vy).normalize().scale(sprint ? VITESSE_SPRINT : VITESSE_JOUEUR);

    if (bouge) this.regard.set(vx, vy).normalize();
    if (Phaser.Input.Keyboard.JustDown(this.touches.changer_equipement)) this.changerEquipement();
    // F : l'action dépend de l'outil équipé
    if (Phaser.Input.Keyboard.JustDown(this.touches.frapper_tirer)) {
      if (this.player.equipement === "pioche") this.frapper();
      else this.tirer();
    }
    if (Phaser.Input.Keyboard.JustDown(this.touches.torche)) this.torche_allumee = !this.torche_allumee;
    this.majLumieres(secondes);

    // animation : la gauche est la droite retournée
    if (bouge) {
      let anim;
      if (vx === 0) anim = vy < 0 ? "up" : "down";
      else if (vy === 0) anim = "right";
      else anim = vy < 0 ? "up_diagonal" : "down_diagonal";
      this.player.setFlipX(vx < 0);
      this.player.anims.play("anim_joueur_walk_" + anim, true);
    } else {
      // pas d'animation idle : on s'arrête sur la première frame
      this.player.anims.stop();
      this.player.setFrame(0);
    }
    this.player.setDepth(this.player.y); // même tri d'affichage que les cailloux

    fct.majBarre(this.barre_vie, this.player.pv, PV_MAX);
    fct.majBarre(this.barre_stamina, this.player.stamina, STAMINA_MAX);

    // un seul joueur pour l'instant : en duo, il faudra que les deux soient sur l'échelle
    if (this.echelle.visible && this.physics.overlap(this.player, this.echelle)) this.descendre();
  }
}
