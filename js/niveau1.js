import * as fct from "./fonctions.js";

const VITESSE_JOUEUR = 160; // px/s
const VITESSE_SPRINT = 260; // px/s
const PV_MAX = 100;
const STAMINA_MAX = 100;
const STAMINA_CONSO = 35; // stamina perdue par seconde de sprint
const STAMINA_RECUP = 20; // stamina regagnée par seconde sans sprinter
const DISTANCE_MIN_ECHELLE = 200; // px : l'échelle n'est pas cachée juste à coté du joueur
const DUREE_FONDU = 400; // ms
const NB_CAILLOUX = 8;
const DISTANCE_MIN_CAILLOU = 64; // px : pas de caillou sur le joueur à son arrivée
const COUPS_CAILLOU = 3; // coups de pioche pour casser un caillou
const PORTEE_FRAPPE = 12; // px : distance entre les pieds du joueur et le centre de la zone de frappe
const TAILLE_ZONE_FRAPPE = 16; // px
const PORTEE_TORCHE = 220; // px : longueur du cône de lumière
const ANGLE_TORCHE = 60; // degrés : ouverture totale du cône
const RAYON_JOUEUR_VISIBLE = 14; // px : cercle autour du joueur pour qu'on le voie dans le noir (0 = invisible)

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
  }

  preload() {
  }

  create() {
    this.descente = false; // true pendant le fondu vers le niveau suivant

    /*************************************
     *  CREATION DE LA MAP               *
     *************************************/
    const map = this.make.tilemap({ key: "map_test" });

    // premier parametre : nom du tileset dans Tiled / second : clé de l'image chargée dans selection
    const tilesets = [
      map.addTilesetImage("decorative_cracks_floor", "tiles_decorative_cracks_floor"),
      map.addTilesetImage("decorative_cracks_walls", "tiles_decorative_cracks_walls"),
      map.addTilesetImage("walls_floor", "tiles_walls_floor")
    ];

    // les noms des calques doivent etre identiques à ceux de Tiled
    const calque_sol = map.createLayer("sol", tilesets);
    const calque_murs = map.createLayer("murs", tilesets);
    calque_murs.setCollisionByExclusion([-1]); // toutes les tuiles non vides du calque "murs" sont solides

    /****************************
     *  CREATION DU PERSONNAGE  *
     ****************************/
    this.player = this.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, "sprite_joueur_walk_down");
    // hitbox réduite aux pieds du personnage
    this.player.setSize(12, 6);
    this.player.setOffset(10, 25);
    this.player.setCollideWorldBounds(true);
    this.player.pv = this.pv_depart;
    this.player.stamina = this.stamina_depart;
    this.regard = new Phaser.Math.Vector2(0, 1); // direction dans laquelle le joueur frappe

    this.physics.add.collider(this.player, calque_murs);

    /****************************
     *  CAILLOUX + ECHELLE      *
     ****************************/
    this.placerCailloux(calque_sol, calque_murs);
    this.physics.add.collider(this.player, this.cailloux);
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
      .setDepth(900);
    this.forme_lumiere = this.make.graphics({}, false); // pas affiché : sert seulement de gomme
    this.torche_allumee = true;

    /****************************
     *  HUD                     *
     ****************************/
    this.barre_vie = fct.creerBarre(this, 20, 20, "sprite_barre_vie");
    this.barre_stamina = fct.creerBarre(this, 20, 76, "sprite_barre_stamina");
    this.add.text(1260, 20, "Niveau " + this.niveau, { fontSize: "28px", color: "#E8EBF0" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.clavier = this.input.keyboard.createCursorKeys();
    this.touche_sprint = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.touche_frappe = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.touche_torche = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);

    this.majTorche(); // sinon la première image s'affiche sans obscurité
  }

  // redessine l'obscurité : noir partout sauf le cône de la torche (et le joueur)
  majTorche() {
    // le calque est fixé à l'écran : on passe des coordonnées du monde à celles de l'écran
    const camera = this.cameras.main;
    const x = this.player.x - camera.scrollX;
    const y = this.player.y - camera.scrollY;

    const forme = this.forme_lumiere;
    forme.clear();
    forme.fillStyle(0xffffff);
    forme.fillCircle(x, y, RAYON_JOUEUR_VISIBLE);
    if (this.torche_allumee) {
      const direction = this.regard.angle(); // radians, 0 = vers la droite
      const demi_angle = Phaser.Math.DegToRad(ANGLE_TORCHE / 2);
      forme.slice(x, y, PORTEE_TORCHE, direction - demi_angle, direction + demi_angle);
      forme.fillPath();
    }

    this.obscurite.fill(0x000000);
    this.obscurite.erase(forme);
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
        stamina: this.player.stamina
      });
    });
  }

  update(time, delta) {
    if (this.descente) return;

    const secondes = delta / 1000;

    let vx = 0;
    let vy = 0;
    if (this.clavier.left.isDown) vx = -1;
    else if (this.clavier.right.isDown) vx = 1;
    if (this.clavier.up.isDown) vy = -1;
    else if (this.clavier.down.isDown) vy = 1;
    const bouge = vx !== 0 || vy !== 0;

    // stamina vide : il faut relâcher la touche avant de pouvoir re-sprinter
    if (this.touche_sprint.isUp) this.player.essouffle = false;

    // sprint : seulement si on bouge et qu'il reste de la stamina
    const sprint = this.touche_sprint.isDown && bouge && !this.player.essouffle;
    if (sprint) {
      this.player.stamina = Math.max(this.player.stamina - STAMINA_CONSO * secondes, 0);
      if (this.player.stamina === 0) this.player.essouffle = true;
    } else {
      this.player.stamina = Math.min(this.player.stamina + STAMINA_RECUP * secondes, STAMINA_MAX);
    }

    // normalisation : on ne va pas plus vite en diagonale
    this.player.body.velocity.set(vx, vy).normalize().scale(sprint ? VITESSE_SPRINT : VITESSE_JOUEUR);

    if (bouge) this.regard.set(vx, vy).normalize();
    if (Phaser.Input.Keyboard.JustDown(this.touche_frappe)) this.frapper();
    if (Phaser.Input.Keyboard.JustDown(this.touche_torche)) this.torche_allumee = !this.torche_allumee;
    this.majTorche();

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
