import * as fct from "./fonctions.js";

/***********************************************************************/
/** VARIABLES GLOBALES 
/***********************************************************************/

var player; // désigne le sprite du joueur
var clavier; // pour la gestion du clavier
var groupe_plateformes;

// définition de la classe "selection"
export default class selection extends Phaser.Scene {
  constructor() {
    super({ key: "selection" }); // mettre le meme nom que le nom de la classe
  }

  /***********************************************************************/
  /** FONCTION PRELOAD 
/***********************************************************************/

  /** La fonction preload est appelée une et une seule fois,
   * lors du chargement de la scene dans le jeu.
   * On y trouve surtout le chargement des assets (images, son ..)
   */
  preload() {
    const baseURL = this.sys.game.config.baseURL;
    
    this.load.setBaseURL(baseURL);
    
    // tous les assets du jeu sont placés dans le sous-répertoire src/assets/
    this.load.image("img_ciel", "./assets/sky.png");
    this.load.image("img_plateforme", "./assets/platform.png");
    this.load.spritesheet("img_perso", "./assets/dude.png", {
      frameWidth: 32,
      frameHeight: 48
    });
    this.load.image("img_porte1", "./assets/door1.png");
    this.load.image("img_porte2", "./assets/door2.png");
    this.load.image("img_porte3", "./assets/door3.png");
  }

  /***********************************************************************/
  /** FONCTION CREATE 
/***********************************************************************/

  /* La fonction create est appelée lors du lancement de la scene
   * si on relance la scene, elle sera appelée a nouveau
   * on y trouve toutes les instructions permettant de créer la scene
   * placement des peronnages, des sprites, des platesformes, création des animations
   * ainsi que toutes les instructions permettant de planifier des evenements
   */
  create() {
      fct.doNothing();
      fct.doAlsoNothing();

    /*************************************
     *  CREATION DU MONDE + PLATEFORMES  *
     *************************************/

    // On ajoute une simple image de fond, le ciel, au centre de la zone affichée (400, 300)
    // Par défaut le point d'ancrage d'une image est le centre de cette derniere
    this.add.image(400, 300, "img_ciel");

    // la création d'un groupes permet de gérer simultanément les éléments d'une meme famille
    //  Le groupe groupe_plateformes contiendra le sol et deux platesformes sur lesquelles sauter
    // notez le mot clé "staticGroup" : le static indique que ces élements sont fixes : pas de gravite,
    // ni de possibilité de les pousser.
    groupe_plateformes = this.physics.add.staticGroup();
    // une fois le groupe créé, on va créer les platesformes , le sol, et les ajouter au groupe groupe_plateformes

    // l'image img_plateforme fait 400x32. On en met 2 à coté pour faire le sol
    // la méthode create permet de créer et d'ajouter automatiquement des objets à un groupe
    // on précise 2 parametres : chaque coordonnées et la texture de l'objet, et "voila!"
    groupe_plateformes.create(200, 584, "img_plateforme");
    groupe_plateformes.create(600, 584, "img_plateforme");

    //  on ajoute 3 platesformes flottantes
    groupe_plateformes.create(600, 450, "img_plateforme");
    groupe_plateformes.create(50, 300, "img_plateforme");
    groupe_plateformes.create(750, 270, "img_plateforme");

    /****************************
     *  Ajout des portes   *
     ****************************/
    this.porte1 = this.physics.add.staticSprite(600, 414, "img_porte1");
    this.porte2 = this.physics.add.staticSprite(50, 264, "img_porte2");
    this.porte3 = this.physics.add.staticSprite(750, 234, "img_porte3");

    /****************************
     *  CREATION DU PERSONNAGE  *
     ****************************/

    // On créée un nouveeau personnage : player
    player = this.physics.add.sprite(100, 450, "img_perso");

    //  propriétées physiqyes de l'objet player :
    player.setBounce(0.2); // on donne un petit coefficient de rebond
    player.setCollideWorldBounds(true); // le player se cognera contre les bords du monde

    /***************************
     *  CREATION DES ANIMATIONS *
     ****************************/
    // dans cette partie, on crée les animations, à partir des spritesheet
    // chaque animation est une succession de frame à vitesse de défilement défini
    // une animation doit avoir un nom. Quand on voudra la jouer sur un sprite, on utilisera la méthode play()
    // creation de l'animation "anim_tourne_gauche" qui sera jouée sur le player lorsque ce dernier tourne à gauche
    this.anims.create({
      key: "anim_tourne_gauche", // key est le nom de l'animation : doit etre unique poru la scene.
      frames: this.anims.generateFrameNumbers("img_perso", {
        start: 0,
        end: 3
      }), // on prend toutes les frames de img perso numerotées de 0 à 3
      frameRate: 10, // vitesse de défilement des frames
      repeat: -1 // nombre de répétitions de l'animation. -1 = infini
    });

    // creation de l'animation "anim_tourne_face" qui sera jouée sur le player lorsque ce dernier n'avance pas.
    this.anims.create({
      key: "anim_face",
      frames: [{ key: "img_perso", frame: 4 }],
      frameRate: 20
    });

    // creation de l'animation "anim_tourne_droite" qui sera jouée sur le player lorsque ce dernier tourne à droite
    this.anims.create({
      key: "anim_tourne_droite",
      frames: this.anims.generateFrameNumbers("img_perso", {
        start: 5,
        end: 8
      }),
      frameRate: 10,
      repeat: -1
    });

    /***********************
     *  CREATION DU CLAVIER *
     ************************/
    // ceci permet de creer un clavier et de mapper des touches, connaitre l'état des touches
    clavier = this.input.keyboard.createCursorKeys();

    /*****************************************************
     *  GESTION DES INTERATIONS ENTRE  GROUPES ET ELEMENTS *
     ******************************************************/

    //  Collide the player and the groupe_etoiles with the groupe_plateformes
    this.physics.add.collider(player, groupe_plateformes);
  }

  /***********************************************************************/
  /** FONCTION UPDATE 
/***********************************************************************/

  update() {
    
    if (clavier.left.isDown) {
      player.setVelocityX(-160);
      player.anims.play("anim_tourne_gauche", true);
    } else if (clavier.right.isDown) {
      player.setVelocityX(160);
      player.anims.play("anim_tourne_droite", true);
    } else {
      player.setVelocityX(0);
      player.anims.play("anim_face");
    }

    if (clavier.up.isDown && player.body.touching.down) {
      player.setVelocityY(-330);
    }

    if (Phaser.Input.Keyboard.JustDown(clavier.space) == true) {
      if (this.physics.overlap(player, this.porte1))
        this.scene.switch("niveau1");
      if (this.physics.overlap(player, this.porte2))
        this.scene.switch("niveau2");
      if (this.physics.overlap(player, this.porte3))
        this.scene.switch("niveau3");
    }
  }
}

/***********************************************************************/
/** CONFIGURATION GLOBALE DU JEU ET LANCEMENT 
/***********************************************************************/
